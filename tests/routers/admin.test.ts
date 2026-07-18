import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTRPCMsw } from 'msw-trpc'
import { appRouter, type AppRouter } from '../../src/server/root'
import { createTRPCContext } from '../../src/server/trpc'
import { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'

// Create a comprehensive mock Prisma client
const prismaMock = {
  service: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  serviceImport: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  category: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  }
} as any

// Mock the services
vi.mock('../../src/lib/services/metadata-validator')
vi.mock('../../src/lib/services/docker-hub-extractor')

import { MetadataValidator } from '../../src/lib/services/metadata-validator'
import { DockerHubExtractor } from '../../src/lib/services/docker-hub-extractor'

const MockMetadataValidator = MetadataValidator as vi.MockedClass<typeof MetadataValidator>
const MockDockerHubExtractor = DockerHubExtractor as vi.MockedClass<typeof DockerHubExtractor>

describe('Admin Router', () => {
  const testSuffix = Date.now().toString()
  let caller: ReturnType<typeof appRouter.createCaller>
  
  // Mock admin user
  const adminUser = {
    id: 'admin-user-id',
    email: 'admin@example.com',
    role: 'admin',
    name: 'Admin User'
  }

  // Mock regular user
  const regularUser = {
    id: 'regular-user-id',
    email: 'user@example.com',
    role: 'user',
    name: 'Regular User'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create caller with admin context
    caller = appRouter.createCaller({
      prisma: prismaMock as any,
      user: adminUser,
      req: {} as any,
      res: {} as any
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication & Authorization', () => {
    it('should reject non-admin users from accessing admin endpoints', async () => {
      const regularCaller = appRouter.createCaller({
        prisma: prismaMock as any,
        user: regularUser,
        req: {} as any,
        res: {} as any
      })

      await expect(regularCaller.admin.getDashboard()).rejects.toThrow('Admin access required')
    })

    it('should reject unauthenticated users', async () => {
      const unauthenticatedCaller = appRouter.createCaller({
        prisma: prismaMock as any,
        user: null,
        req: {} as any,
        res: {} as any
      })

      await expect(unauthenticatedCaller.admin.getDashboard()).rejects.toThrow()
    })

    it('should allow admin users to access admin endpoints', async () => {
      // Mock dashboard data
      prismaMock.serviceImport.count.mockResolvedValueOnce(5) // pending imports
      prismaMock.service.count
        .mockResolvedValueOnce(3) // pending services
        .mockResolvedValueOnce(25) // total services
        .mockResolvedValueOnce(20) // approved services
      prismaMock.serviceImport.count
        .mockResolvedValueOnce(10) // total imports
      prismaMock.category.count.mockResolvedValueOnce(8) // total categories
      prismaMock.serviceImport.findMany.mockResolvedValueOnce([]) // recent activity

      const result = await caller.admin.getDashboard()
      
      expect(result).toHaveProperty('pendingImports', 5)
      expect(result).toHaveProperty('pendingServices', 3)
      expect(result.systemStats).toEqual({
        totalServices: 25,
        totalImports: 10,
        totalCategories: 8,
        approvedServices: 20
      })
    })
  })

  describe('Dashboard', () => {
    it('should return comprehensive dashboard data', async () => {
      const mockRecentActivity = [
        {
          id: 1,
          name: `test-service-${testSuffix}`,
          status: 'pending',
          createdAt: new Date(),
          sourceUrl: 'docker.io/test/service'
        }
      ]

      prismaMock.serviceImport.count
        .mockResolvedValueOnce(5) // pending imports
        .mockResolvedValueOnce(15) // total imports
      prismaMock.service.count
        .mockResolvedValueOnce(3) // pending services
        .mockResolvedValueOnce(30) // total services
        .mockResolvedValueOnce(25) // approved services
      prismaMock.category.count.mockResolvedValueOnce(10)
      prismaMock.serviceImport.findMany.mockResolvedValueOnce(mockRecentActivity)

      const result = await caller.admin.getDashboard()

      expect(result).toEqual({
        pendingImports: 5,
        pendingServices: 3,
        recentActivity: mockRecentActivity,
        systemStats: {
          totalServices: 30,
          totalImports: 15,
          totalCategories: 10,
          approvedServices: 25
        }
      })
    })
  })

  describe('Import Management', () => {
    const mockImport = {
      id: 1,
      name: `test-import-${testSuffix}`,
      sourceUrl: 'docker.io/test/import',
      description: 'Test import description',
      status: 'pending' as const,
      categoryId: 1,
      extractedMetadata: {
        exposedPorts: [{ containerPort: 8080, protocol: 'tcp' }],
        environmentVariables: [{ name: 'PORT', description: 'App port', defaultValue: '8080', required: false, type: 'string' }],
        volumes: ['/data']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedAt: null,
      reviewNotes: null,
      serviceId: null,
      category: {
        id: 1,
        name: 'Web Servers',
        slug: 'web-servers'
      }
    }

    it('should list imports with filtering and pagination', async () => {
      prismaMock.serviceImport.findMany.mockResolvedValueOnce([mockImport])

      const result = await caller.admin.listImports({
        limit: 20,
        status: 'pending',
        search: 'test'
      })

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]).toMatchObject({
        id: 1,
        name: `test-import-${testSuffix}`,
        status: 'pending'
      })
      expect(result.hasMore).toBe(false)
    })

    it('should get detailed import information for review', async () => {
      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(mockImport)
      
      // Mock metadata validator and extractor
      const mockExtractedMetadata = {
        name: 'test-service',
        namespace: 'testuser',
        description: 'Test service description',
        tags: ['latest'],
        pullCount: 1000,
        starCount: 50,
        isOfficial: false,
        lastUpdated: new Date(),
        exposedPorts: [{ containerPort: 8080, protocol: 'tcp' }],
        environmentVariables: [],
        volumes: [],
        cmd: [],
        workingDirectory: '/app',
        user: 'appuser',
        baseImage: 'alpine:latest',
        resourceRequirements: {}
      }

      const mockValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        conflicts: [],
        suggestions: []
      }

      const mockExtractor = new MockDockerHubExtractor()
      mockExtractor.extractMetadata.mockResolvedValueOnce(mockExtractedMetadata)
      
      const mockValidator = new MockMetadataValidator(prismaMock as any)
      mockValidator.validateMetadata.mockResolvedValueOnce(mockValidationResult)

      MockDockerHubExtractor.mockImplementation(() => mockExtractor)
      MockMetadataValidator.mockImplementation(() => mockValidator)

      const result = await caller.admin.getImportDetails({ importId: 1 })

      expect(result.import).toMatchObject({
        id: 1,
        name: `test-import-${testSuffix}`
      })
      expect(result.extractedMetadata).toEqual(mockExtractedMetadata)
      expect(result.validationResult).toEqual(mockValidationResult)
    })

    it('should handle import not found', async () => {
      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(null)

      await expect(caller.admin.getImportDetails({ importId: 999 }))
        .rejects.toThrow('Import not found')
    })
  })

  describe('Import Review Process', () => {
    const mockCategory = {
      id: 1,
      name: 'Web Servers',
      slug: 'web-servers',
      description: 'Web server applications'
    }

    const mockImportForReview = {
      id: 1,
      name: `test-import-${testSuffix}`,
      sourceUrl: 'docker.io/test/import',
      description: 'Test import description',
      status: 'pending' as const,
      categoryId: 1,
      extractedMetadata: {
        exposedPorts: [{ containerPort: 8080, protocol: 'tcp' }],
        environmentVariables: [{ name: 'PORT', description: 'App port', defaultValue: '8080', required: false, type: 'string' }],
        volumes: ['/data']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedAt: null,
      reviewNotes: null,
      serviceId: null,
      category: mockCategory
    }

    it('should approve an import and create a service', async () => {
      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(mockImportForReview)
      prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory)
      prismaMock.service.findUnique.mockResolvedValue(null) // No existing service with slug
      
      const createdService = {
        id: 1,
        name: `test-import-${testSuffix}`,
        slug: `test-import-${testSuffix}`,
        description: 'Test import description',
        dockerImage: 'docker.io/test/import',
        categoryId: 1,
        status: 'approved' as const,
        ports: JSON.stringify({ ports: [{ containerPort: 8080, protocol: 'tcp' }] }),
        environmentVariables: JSON.stringify({ variables: [{ name: 'PORT', description: 'App port', defaultValue: '8080', required: false, type: 'string' }] }),
        volumes: JSON.stringify({ volumes: ['/data'] }),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prismaMock.service.create.mockResolvedValueOnce(createdService)
      prismaMock.serviceImport.update.mockResolvedValueOnce({
        ...mockImportForReview,
        status: 'approved',
        reviewedAt: new Date(),
        serviceId: 1
      })

      const result = await caller.admin.reviewImport({
        importId: 1,
        action: 'approve',
        reviewNotes: 'Approved after review'
      })

      expect(result.success).toBe(true)
      expect(result.serviceId).toBe(1)
      expect(prismaMock.service.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: `test-import-${testSuffix}`,
          dockerImage: 'docker.io/test/import',
          status: 'approved'
        })
      })
    })

    it('should reject an import', async () => {
      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(mockImportForReview)
      prismaMock.serviceImport.update.mockResolvedValueOnce({
        ...mockImportForReview,
        status: 'rejected',
        reviewedAt: new Date()
      })

      const result = await caller.admin.reviewImport({
        importId: 1,
        action: 'reject',
        reviewNotes: 'Rejected due to security concerns'
      })

      expect(result.success).toBe(true)
      expect(prismaMock.serviceImport.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'rejected',
          reviewNotes: 'Rejected due to security concerns',
          reviewedAt: expect.any(Date)
        }
      })
    })

    it('should handle admin overrides during approval', async () => {
      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(mockImportForReview)
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: 2, name: 'Databases', slug: 'databases' })
      prismaMock.service.findUnique.mockResolvedValue(null)
      prismaMock.service.create.mockResolvedValueOnce({
        id: 1,
        name: 'Custom Service Name',
        slug: 'custom-service-name',
        description: 'Custom description',
        dockerImage: 'docker.io/test/import',
        categoryId: 2,
        status: 'pending' as const,
        ports: null,
        environmentVariables: null,
        volumes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      prismaMock.serviceImport.update.mockResolvedValueOnce(mockImportForReview)

      const result = await caller.admin.reviewImport({
        importId: 1,
        action: 'approve',
        adminOverrides: {
          name: 'Custom Service Name',
          description: 'Custom description',
          categoryId: 2,
          status: 'pending'
        }
      })

      expect(result.success).toBe(true)
      expect(prismaMock.service.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Custom Service Name',
          description: 'Custom description',
          categoryId: 2,
          status: 'pending'
        })
      })
    })

    it('should prevent reviewing already processed imports', async () => {
      const processedImport = { ...mockImportForReview, status: 'approved' as const }
      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(processedImport)

      await expect(caller.admin.reviewImport({
        importId: 1,
        action: 'approve'
      })).rejects.toThrow('Import has already been reviewed')
    })
  })

  describe('Bulk Operations', () => {
    it('should bulk approve multiple imports', async () => {
      const mockImports = [
        {
          id: 1,
          name: `import-1-${testSuffix}`,
          sourceUrl: 'docker.io/test/import1',
          description: 'Import 1',
          status: 'pending' as const,
          categoryId: 1,
          extractedMetadata: { exposedPorts: [], environmentVariables: [], volumes: [] }
        },
        {
          id: 2,
          name: `import-2-${testSuffix}`,
          sourceUrl: 'docker.io/test/import2',
          description: 'Import 2',
          status: 'pending' as const,
          categoryId: 1,
          extractedMetadata: { exposedPorts: [], environmentVariables: [], volumes: [] }
        }
      ]

      const mockCategory = {
        id: 1,
        name: 'General',
        slug: 'general'
      }

      prismaMock.serviceImport.findMany.mockResolvedValueOnce(mockImports)
      prismaMock.category.findFirst.mockResolvedValue(mockCategory)
      prismaMock.service.findUnique.mockResolvedValue(null) // No existing services with these slugs
      
      // Mock service creation
      prismaMock.service.create
        .mockResolvedValueOnce({ id: 1, name: mockImports[0].name, slug: `import-1-${testSuffix}`, description: mockImports[0].description, dockerImage: mockImports[0].sourceUrl, categoryId: 1, status: 'approved', ports: null, environmentVariables: null, volumes: null, createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ id: 2, name: mockImports[1].name, slug: `import-2-${testSuffix}`, description: mockImports[1].description, dockerImage: mockImports[1].sourceUrl, categoryId: 1, status: 'approved', ports: null, environmentVariables: null, volumes: null, createdAt: new Date(), updatedAt: new Date() })
      
      prismaMock.serviceImport.update.mockResolvedValue(mockImports[0])

      const result = await caller.admin.bulkReviewImports({
        importIds: [1, 2],
        action: 'approve',
        reviewNotes: 'Bulk approved'
      })

      expect(result.results).toHaveLength(2)
      expect(result.results[0].success).toBe(true)
      expect(result.results[1].success).toBe(true)
      expect(prismaMock.service.create).toHaveBeenCalledTimes(2)
    })

    it('should bulk reject multiple imports', async () => {
      const mockImports = [
        { id: 1, name: 'import-1', status: 'pending' as const },
        { id: 2, name: 'import-2', status: 'pending' as const }
      ]

      prismaMock.serviceImport.findMany.mockResolvedValueOnce(mockImports)
      prismaMock.serviceImport.update.mockResolvedValue(mockImports[0])

      const result = await caller.admin.bulkReviewImports({
        importIds: [1, 2],
        action: 'reject',
        reviewNotes: 'Bulk rejected'
      })

      expect(result.results).toHaveLength(2)
      expect(result.results[0].success).toBe(true)
      expect(result.results[1].success).toBe(true)
      expect(prismaMock.serviceImport.update).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures in bulk operations', async () => {
      const mockImports = [
        { id: 1, name: 'import-1', status: 'pending' as const, categoryId: 1, extractedMetadata: {} },
        { id: 2, name: 'import-2', status: 'pending' as const, categoryId: null, extractedMetadata: {} }
      ]

      prismaMock.serviceImport.findMany.mockResolvedValueOnce(mockImports)
      prismaMock.category.findFirst.mockResolvedValueOnce(null) // No default category found

      const result = await caller.admin.bulkReviewImports({
        importIds: [1, 2],
        action: 'approve'
      })

      expect(result.results).toHaveLength(2)
      expect(result.results[0].success).toBe(false)
      expect(result.results[1].success).toBe(false)
      expect(result.results[0].error).toContain('Default category not found')
    })
  })

  describe('Service Management', () => {
    it('should list services with admin filtering', async () => {
      const mockServices = [
        {
          id: 1,
          name: `service-1-${testSuffix}`,
          slug: `service-1-${testSuffix}`,
          description: 'Service 1',
          dockerImage: 'docker.io/test/service1',
          categoryId: 1,
          status: 'approved' as const,
          ports: null,
          environmentVariables: null,
          volumes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 1,
            name: 'Web Servers',
            slug: 'web-servers'
          }
        }
      ]

      prismaMock.service.findMany.mockResolvedValueOnce(mockServices)

      const result = await caller.admin.listServices({
        limit: 20,
        status: 'approved',
        search: 'service'
      })

      expect(result.services).toHaveLength(1)
      expect(result.services[0]).toMatchObject({
        name: `service-1-${testSuffix}`,
        status: 'approved'
      })
    })

    it('should update service status', async () => {
      const mockService = {
        id: 1,
        name: 'Test Service',
        slug: 'test-service',
        description: 'Test service description',
        dockerImage: 'docker.io/test/service',
        categoryId: 1,
        status: 'pending' as const,
        ports: null,
        environmentVariables: null,
        volumes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const updatedService = {
        ...mockService,
        status: 'approved' as const,
        category: {
          id: 1,
          name: 'Web Servers',
          slug: 'web-servers'
        }
      }

      prismaMock.service.findUnique.mockResolvedValueOnce(mockService)
      prismaMock.service.update.mockResolvedValueOnce(updatedService)

      const result = await caller.admin.updateServiceStatus({
        serviceId: 1,
        status: 'approved',
        adminNotes: 'Approved by admin'
      })

      expect(result.status).toBe('approved')
      expect(prismaMock.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'approved',
          updatedAt: expect.any(Date)
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })
    })
  })

  describe('System Statistics', () => {
    it('should return comprehensive system stats', async () => {
      const mockCategoryStats = [
        {
          id: 1,
          name: 'Web Servers',
          slug: 'web-servers',
          description: 'Web servers',
          _count: { services: 10 }
        }
      ]

      prismaMock.service.count
        .mockResolvedValueOnce(100) // total services
        .mockResolvedValueOnce(5) // pending services
        .mockResolvedValueOnce(85) // approved services
        .mockResolvedValueOnce(10) // rejected services
        .mockResolvedValueOnce(15) // recent services
      prismaMock.serviceImport.count
        .mockResolvedValueOnce(50) // total imports
        .mockResolvedValueOnce(8) // pending imports
        .mockResolvedValueOnce(20) // recent imports
      prismaMock.category.count.mockResolvedValueOnce(12)
      prismaMock.category.findMany.mockResolvedValueOnce(mockCategoryStats)

      const result = await caller.admin.getSystemStats({ period: 'week' })

      expect(result.overview).toEqual({
        totalServices: 100,
        totalImports: 50,
        totalCategories: 12,
        pendingImports: 8,
        pendingServices: 5,
        approvedServices: 85,
        rejectedServices: 10
      })
      expect(result.recentActivity).toEqual({
        period: 'week',
        recentImports: 20,
        recentServices: 15
      })
      expect(result.topCategories).toEqual([
        {
          id: 1,
          name: 'Web Servers',
          slug: 'web-servers',
          serviceCount: 10
        }
      ])
    })
  })

  describe('Delete Operations', () => {
    it('should delete pending import', async () => {
      const mockImport = {
        id: 1,
        status: 'pending' as const,
        serviceId: null
      }

      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(mockImport)
      prismaMock.serviceImport.delete.mockResolvedValueOnce(mockImport)

      const result = await caller.admin.deleteImport({ importId: 1 })

      expect(result.success).toBe(true)
      expect(prismaMock.serviceImport.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      })
    })

    it('should prevent deleting approved imports that created services', async () => {
      const mockImport = {
        id: 1,
        status: 'approved' as const,
        serviceId: 1
      }

      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(mockImport)

      await expect(caller.admin.deleteImport({ importId: 1 }))
        .rejects.toThrow('Cannot delete approved import that created a service')
    })

    it('should delete service', async () => {
      const mockService = {
        id: 1,
        name: 'Test Service'
      }

      prismaMock.service.findUnique.mockResolvedValueOnce(mockService)
      prismaMock.service.delete.mockResolvedValueOnce(mockService)

      const result = await caller.admin.deleteService({ serviceId: 1 })

      expect(result.success).toBe(true)
      expect(prismaMock.service.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent imports gracefully', async () => {
      prismaMock.serviceImport.findUnique.mockResolvedValueOnce(null)

      await expect(caller.admin.reviewImport({ importId: 999, action: 'approve' }))
        .rejects.toThrow('Import not found')
    })

    it('should handle non-existent services gracefully', async () => {
      prismaMock.service.findUnique.mockResolvedValueOnce(null)

      await expect(caller.admin.updateServiceStatus({ serviceId: 999, status: 'approved' }))
        .rejects.toThrow('Service not found')
    })

    it('should handle database errors gracefully', async () => {
      prismaMock.serviceImport.count.mockRejectedValueOnce(new Error('Database connection failed'))

      await expect(caller.admin.getDashboard()).rejects.toThrow('Database connection failed')
    })
  })

  describe('Input Validation', () => {
    it('should validate import review input', async () => {
      await expect(caller.admin.reviewImport({
        importId: -1, // Invalid ID
        action: 'approve'
      })).rejects.toThrow()
    })

    it('should validate bulk review limits', async () => {
      const manyIds = Array.from({ length: 51 }, (_, i) => i + 1) // 51 items (over limit)

      await expect(caller.admin.bulkReviewImports({
        importIds: manyIds,
        action: 'approve'
      })).rejects.toThrow()
    })

    it('should validate system stats period', async () => {
      // Mock required database calls for valid period
      prismaMock.service.count.mockResolvedValue(0)
      prismaMock.serviceImport.count.mockResolvedValue(0)
      prismaMock.category.count.mockResolvedValue(0)
      prismaMock.category.findMany.mockResolvedValue([])

      const result = await caller.admin.getSystemStats({ period: 'month' })
      expect(result.recentActivity.period).toBe('month')
    })
  })
})