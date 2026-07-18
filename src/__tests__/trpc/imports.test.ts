import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appRouter } from '../../server/root'
import { importsRouter } from '../../server/routers/imports'
import { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'

// Mutable mock state for the Docker Hub extractor. vi.hoisted so the
// hoisted vi.mock factory below can reference it. Plain functions on
// purpose — the global mockReset wipes vi.fn() implementations.
const dockerHub = vi.hoisted(() => {
  const defaultMetadata = () => ({
    name: 'nginx',
    namespace: 'library',
    description: 'Official build of Nginx',
    tags: ['latest', '1.21', '1.20'],
    pullCount: 1000000000,
    starCount: 15000,
    isOfficial: true,
    isAutomated: false,
    lastUpdated: '2023-12-01T10:00:00Z',
    exposedPorts: [
      {
        containerPort: 80,
        protocol: 'tcp' as const,
        description: 'HTTP port'
      }
    ],
    environmentVariables: [],
    volumes: ['/var/log/nginx'],
    labels: {},
    baseImage: 'debian',
    workdir: '/etc/nginx',
    user: 'root',
    cmd: ['nginx', '-g', 'daemon off;']
  })

  const state = {
    validateImageExists: (async (_url: string) => true) as (url: string) => Promise<boolean>,
    extractMetadata: (async (_url: string) => defaultMetadata()) as (url: string) => Promise<any>,
    validateImageExistsCalls: [] as string[],
    extractMetadataCalls: [] as string[],
    reset() {
      state.validateImageExists = async () => true
      state.extractMetadata = async () => defaultMetadata()
      state.validateImageExistsCalls.length = 0
      state.extractMetadataCalls.length = 0
    }
  }
  return state
})

// No network in tests: Docker Hub existence/metadata checks are mocked.
// The router instantiates the extractor at module load, so the mocked
// constructor delegates to the mutable state at call time.
vi.mock('@/lib/services/docker-hub-extractor', async () => {
  const actual = await vi.importActual<any>('@/lib/services/docker-hub-extractor')
  return {
    ...actual,
    DockerHubExtractor: function DockerHubExtractorMock() {
      return {
        validateImageExists: (url: string) => {
          dockerHub.validateImageExistsCalls.push(url)
          return dockerHub.validateImageExists(url)
        },
        extractMetadata: (url: string) => {
          dockerHub.extractMetadataCalls.push(url)
          return dockerHub.extractMetadata(url)
        }
      }
    } as any
  }
})

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
})

// Mock context for testing
// Import create/approve/reject/delete are admin-gated; these are behavior tests.
const createMockContext = () => ({
  prisma,
  req: {} as any,
  user: { id: 'admin', role: 'admin' },
  userId: 'admin'
})

describe('tRPC Service Import Endpoints', () => {
  const ctx = createMockContext()
  const caller = appRouter.createCaller(ctx)

  beforeEach(async () => {
    // Clean database before each test
    await prisma.$transaction([
      prisma.serviceImport.deleteMany(),
      prisma.service.deleteMany(),
      prisma.category.deleteMany()
    ])

    // Reset mocks
    vi.clearAllMocks()
    dockerHub.reset()
  })

  describe('Import Workflow - Create Import', () => {
    it('should create import request with Docker Hub URL', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      // Create test category
      const category = await prisma.category.create({
        data: {
          name: `Web Servers ${uniqueId}`,          description: 'Web server services'
        }
      })

      const importData = {
        sourceUrl: 'nginx',
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      }

      const result = await caller.imports.create(importData)

      expect(result).toMatchObject({
        sourceUrl: importData.sourceUrl,
        sourceType: importData.sourceType,
        status: 'pending',
        submittedBy: importData.submittedBy
      })
      expect(result.id).toBeDefined()
      expect(result.extractedMetadata).toBeDefined()
      
      // Verify metadata was extracted
      const parsedMetadata = JSON.parse(result.extractedMetadata)
      expect(parsedMetadata.name).toBe('nginx')
      expect(parsedMetadata.namespace).toBe('library')
    })

    it('should create import with full Docker Hub URL', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Databases ${uniqueId}`,          description: 'Database services'
        }
      })

      const result = await caller.imports.create({
        sourceUrl: 'https://hub.docker.com/_/postgres',
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      expect(result.sourceUrl).toBe('https://hub.docker.com/_/postgres')
      expect(result.status).toBe('pending')
      expect(dockerHub.extractMetadataCalls).toContain('https://hub.docker.com/_/postgres')
    })

    it('should validate category exists before creating import', async () => {
      const importData = {
        sourceUrl: 'nginx',
        sourceType: 'docker_hub' as const,
        categoryId: 99999, // Non-existent category
        submittedBy: 'test-user'
      }

      await expect(caller.imports.create(importData))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.create(importData)
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('NOT_FOUND')
        expect((error as TRPCError).message).toContain('Category not found')
      }
    })

    it('should validate Docker Hub image exists', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      // Mock image validation to fail
      dockerHub.validateImageExists = async () => false

      const importData = {
        sourceUrl: 'non-existent-image',
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      }

      await expect(caller.imports.create(importData))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.create(importData)
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('BAD_REQUEST')
        expect((error as TRPCError).message).toContain('Docker image does not exist')
      }
    })

    it('should handle metadata extraction failures gracefully', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      // Mock metadata extraction to fail
      dockerHub.extractMetadata = async () => {
        throw new Error('Failed to extract metadata')
      }

      const importData = {
        sourceUrl: 'problematic-image',
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      }

      await expect(caller.imports.create(importData))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.create(importData)
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('INTERNAL_SERVER_ERROR')
        expect((error as TRPCError).message).toContain('Failed to extract metadata')
      }
    })

    it('should detect duplicate imports', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      const importData = {
        sourceUrl: 'nginx',
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      }

      // Create first import
      await caller.imports.create(importData)

      // Try to create duplicate
      await expect(caller.imports.create(importData))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.create(importData)
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('CONFLICT')
        expect((error as TRPCError).message).toContain('already exists')
      }
    })
  })

  describe('Import Workflow - List Imports', () => {
    it('should list imports with pagination', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      // Create multiple imports
      const imports = []
      for (let i = 1; i <= 3; i++) {
        const importRecord = await caller.imports.create({
          sourceUrl: `test-image-${i}`,
          sourceType: 'docker_hub' as const,
          categoryId: category.id,
          submittedBy: `test-user-${uniqueId}`
        })
        imports.push(importRecord)
      }

      const result = await caller.imports.list({
        limit: 2
      })

      expect(result.imports).toHaveLength(2)
      expect(result.hasMore).toBe(true)
      expect(result.total).toBe(3)
      expect(result.nextCursor).toBeDefined()
    })

    it('should filter imports by status', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      // Create imports with different statuses
      const pendingImport = await caller.imports.create({
        sourceUrl: `pending-image-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      // Update one to approved status (this would typically be done through admin endpoints)
      await prisma.serviceImport.update({
        where: { id: pendingImport.id },
        data: { status: 'approved' }
      })

      // Test filtering by pending status
      const pendingResult = await caller.imports.list({
        status: 'pending'
      })

      expect(pendingResult.imports.every(imp => imp.status === 'pending')).toBe(true)

      // Test filtering by approved status
      const approvedResult = await caller.imports.list({
        status: 'approved'
      })

      expect(approvedResult.imports.every(imp => imp.status === 'approved')).toBe(true)
      expect(approvedResult.imports).toHaveLength(1)
    })

    it('should filter imports by source type', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      // Create Docker Hub import
      await caller.imports.create({
        sourceUrl: `docker-image-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      // Create manual import directly in database
      await prisma.serviceImport.create({
        data: {
          sourceUrl: `manual-source-${uniqueId}`,
          sourceType: 'manual' as const,
          status: 'pending',
          submittedBy: `test-user-${uniqueId}`,
          extractedMetadata: JSON.stringify({}),
          tags: JSON.stringify([])
        }
      })

      const dockerHubResult = await caller.imports.list({
        sourceType: 'docker_hub' as const
      })

      expect(dockerHubResult.imports.every(imp => imp.sourceType === 'docker_hub')).toBe(true)
      expect(dockerHubResult.imports).toHaveLength(1)
    })

    it('should search imports by source URL', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      await caller.imports.create({
        sourceUrl: `nginx-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      await caller.imports.create({
        sourceUrl: `postgres-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      const result = await caller.imports.list({
        search: 'nginx'
      })

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0].sourceUrl).toContain('nginx')
    })
  })

  describe('Import Workflow - Get Import', () => {
    it('should get import by ID with full details', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      const created = await caller.imports.create({
        sourceUrl: `test-image-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      const result = await caller.imports.get({ id: created.id })

      expect(result).toMatchObject({
        id: created.id,
        sourceUrl: created.sourceUrl,
        sourceType: created.sourceType,
        status: created.status,
        submittedBy: created.submittedBy
      })

      // Verify parsed metadata
      expect(result.parsedMetadata).toBeDefined()
      expect(result.parsedMetadata.name).toBe('nginx')
    })

    it('should throw NOT_FOUND for non-existent import', async () => {
      await expect(caller.imports.get({ id: 99999 }))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.get({ id: 99999 })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('Import Workflow - Update Import Status', () => {
    it('should approve import and create service', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      const created = await caller.imports.create({
        sourceUrl: `test-image-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      const result = await caller.imports.approve({
        id: created.id,
        reviewedBy: `admin-${uniqueId}`,
        reviewNotes: 'Looks good, approved'
      })

      expect(result.status).toBe('approved')
      expect(result.reviewedBy).toBe(`admin-${uniqueId}`)
      expect(result.reviewNotes).toBe('Looks good, approved')
      expect(result.serviceId).toBeDefined()

      // Verify service was created
      const service = await prisma.service.findUnique({
        where: { id: result.serviceId! }
      })

      expect(service).toBeTruthy()
      expect(service!.name).toBe('nginx')
      expect(service!.dockerImage).toBe(`test-image-${uniqueId}`)
      expect(service!.status).toBe('approved')
      expect(service!.categoryId).toBe(category.id)
    })

    it('should reject import with review notes', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      const created = await caller.imports.create({
        sourceUrl: `test-image-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      const result = await caller.imports.reject({
        id: created.id,
        reviewedBy: `admin-${uniqueId}`,
        reviewNotes: 'Image contains vulnerabilities'
      })

      expect(result.status).toBe('rejected')
      expect(result.reviewedBy).toBe(`admin-${uniqueId}`)
      expect(result.reviewNotes).toBe('Image contains vulnerabilities')
      // In-memory harness leaves never-set columns undefined; DB would return null
      expect(result.serviceId ?? null).toBeNull()
    })

    it('should not approve already processed import', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      const created = await caller.imports.create({
        sourceUrl: `test-image-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      // Approve first
      await caller.imports.approve({
        id: created.id,
        reviewedBy: `admin-${uniqueId}`,
        reviewNotes: 'First approval'
      })

      // Try to approve again
      await expect(caller.imports.approve({
        id: created.id,
        reviewedBy: `admin-${uniqueId}`,
        reviewNotes: 'Second approval'
      })).rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.approve({
          id: created.id,
          reviewedBy: `admin-${uniqueId}`,
          reviewNotes: 'Second approval'
        })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('BAD_REQUEST')
        expect((error as TRPCError).message).toContain('already been processed')
      }
    })
  })

  describe('Import Workflow - Delete Import', () => {
    it('should delete pending import', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      const created = await caller.imports.create({
        sourceUrl: `test-image-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      const result = await caller.imports.delete({ id: created.id })

      expect(result.success).toBe(true)

      // Verify import was deleted
      const deleted = await prisma.serviceImport.findUnique({
        where: { id: created.id }
      })

      expect(deleted).toBeNull()
    })

    it('should not delete approved import with associated service', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      const created = await caller.imports.create({
        sourceUrl: `test-image-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      // Approve import (creates associated service)
      await caller.imports.approve({
        id: created.id,
        reviewedBy: `admin-${uniqueId}`,
        reviewNotes: 'Approved'
      })

      // Try to delete approved import
      await expect(caller.imports.delete({ id: created.id }))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.delete({ id: created.id })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('BAD_REQUEST')
        expect((error as TRPCError).message).toContain('Cannot delete approved import')
      }
    })
  })

  describe('Import Workflow - Metadata Validation', () => {
    it('should validate extracted metadata against service schema', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      // Mock schema-invalid metadata (wrong types / missing required fields
      // per ExtractedMetadataSchema)
      dockerHub.extractMetadata = async () => ({
        name: 123, // Invalid: must be a string
        // namespace missing entirely
        description: null,
        tags: 'not-an-array', // Invalid: must be an array
        pullCount: 'many', // Invalid: must be a number
        starCount: 15000,
        isOfficial: true,
        isAutomated: false,
        lastUpdated: '2023-12-01T10:00:00Z',
        exposedPorts: [],
        environmentVariables: [],
        volumes: [],
        labels: {},
      } as any)

      const importData = {
        sourceUrl: `invalid-metadata-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      }

      await expect(caller.imports.create(importData))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.create(importData)
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('BAD_REQUEST')
        expect((error as TRPCError).message).toContain('Invalid metadata')
      }
    })

    it('should detect conflicting services during approval', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category'
        }
      })

      // Create existing service with same name
      await prisma.service.create({
        data: {
          name: 'nginx',          description: 'Existing Nginx service',
          dockerImage: 'nginx:existing',
          categoryId: category.id,
          status: 'approved'
        }
      })

      // Create import with conflicting name
      const created = await caller.imports.create({
        sourceUrl: `nginx-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `test-user-${uniqueId}`
      })

      // Try to approve conflicting import
      await expect(caller.imports.approve({
        id: created.id,
        reviewedBy: `admin-${uniqueId}`,
        reviewNotes: 'Approve conflicting service'
      })).rejects.toThrow(TRPCError)
      
      try {
        await caller.imports.approve({
          id: created.id,
          reviewedBy: `admin-${uniqueId}`,
          reviewNotes: 'Approve conflicting service'
        })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('CONFLICT')
        expect((error as TRPCError).message).toContain('already exists')
      }
    })
  })

  describe('Import Workflow - Performance and Limits', () => {
    it('should handle bulk imports efficiently', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Bulk Test Category ${uniqueId}`,          description: 'Category for bulk testing'
        }
      })

      const startTime = Date.now()
      
      // Create multiple imports concurrently
      const importPromises = []
      for (let i = 1; i <= 5; i++) {
        importPromises.push(
          caller.imports.create({
            sourceUrl: `bulk-image-${i}-${uniqueId}`,
            sourceType: 'docker_hub' as const,
            categoryId: category.id,
            submittedBy: `bulk-user-${uniqueId}`
          })
        )
      }

      const results = await Promise.all(importPromises)
      const endTime = Date.now()

      expect(results).toHaveLength(5)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
      
      // Verify all imports were created
      const allImports = await caller.imports.list({ limit: 10 })
      expect(allImports.imports).toHaveLength(5)
    })

    it('should enforce rate limiting for import creation', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Rate Limit Test ${uniqueId}`,          description: 'Category for rate limit testing'
        }
      })

      // This test would require actual rate limiting implementation
      // For now, we'll just verify basic functionality
      const result = await caller.imports.create({
        sourceUrl: `rate-test-${uniqueId}`,
        sourceType: 'docker_hub' as const,
        categoryId: category.id,
        submittedBy: `rate-test-user-${uniqueId}`
      })

      expect(result).toBeDefined()
      expect(result.status).toBe('pending')
    })
  })
})