import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '@/server/root'
import type { AppRouter } from '@/server/root'
import { prisma } from '@/lib/db-utils'
import { ServiceStatus, ImportStatus } from '@/lib/validation/service-catalog-schemas'

// Test data factories using direct Prisma calls
const createTestCategory = async (overrides = {}) => {
  const uniqueId = Math.random().toString(36).substring(2, 15)
  return await prisma.category.create({
    data: {
      name: `Test Category ${uniqueId}`,      description: 'Test category for service tests',
      sortOrder: Math.floor(Math.random() * 1000),
      ...overrides
    }
  })
}

const createTestService = async (categoryId: number, overrides: Record<string, any> = {}) => {
  const uniqueId = Math.random().toString(36).substring(2, 15)
  const name: string = overrides.name ?? `Test Service ${uniqueId}`
  // Same slug derivation the services router uses
  const slug: string = overrides.slug ?? name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return await prisma.service.create({
    data: {
      name,
      slug,
      description: 'A test service for API testing',
      dockerImage: 'nginx:latest',
      version: '1.0.0',
      categoryId,
      documentationUrl: 'https://example.com/docs',
      ports: JSON.stringify([{ containerPort: 80, protocol: 'tcp' as const }]),
      environmentVariables: JSON.stringify([{ name: 'NODE_ENV', defaultValue: 'production', required: true, type: 'string' }]),
      resourceRequirements: { minMemory: 512, recommendedMemory: 1024 },
      compatibilityInfo: JSON.stringify({ operatingSystem: ['linux'], architecture: ['amd64'] }),
      status: ServiceStatus.APPROVED,
      ...overrides
    }
  })
}

describe('tRPC Service CRUD Endpoints', () => {
  let testCategory: any
  let testService: any

  beforeEach(async () => {
    // Clean database and create test data
    await prisma.$transaction([
      prisma.serviceImport.deleteMany(),
      prisma.service.deleteMany(),
      prisma.category.deleteMany()
    ])

    testCategory = await createTestCategory()
  })

  afterEach(async () => {
    // Clean up after tests
    await prisma.$transaction([
      prisma.serviceImport.deleteMany(),
      prisma.service.deleteMany(),
      prisma.category.deleteMany()
    ])
  })

  describe('Service List Endpoints', () => {
    it('should list services with default pagination', async () => {
      // Create test services
      const service1 = await createTestService(testCategory.id, { name: 'Service 1' })
      const service2 = await createTestService(testCategory.id, { name: 'Service 2' })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.list({})

      expect(result).toEqual({
        services: expect.arrayContaining([
          expect.objectContaining({
            id: service1.id,
            name: 'Service 1',
            status: ServiceStatus.APPROVED
          }),
          expect.objectContaining({
            id: service2.id,
            name: 'Service 2',
            status: ServiceStatus.APPROVED
          })
        ]),
        nextCursor: null,
        hasMore: false,
        total: 2
      })
    })

    it('should filter services by category', async () => {
      // Create another category and service
      const otherCategory = await createTestCategory({
        name: 'Other Category',
        description: 'Another test category'
      })
      
      const service1 = await createTestService(testCategory.id, { name: 'Service 1' })
      await createTestService(otherCategory.id, { name: 'Service 2' })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.list({ categoryId: testCategory.id })

      expect(result.services).toHaveLength(1)
      expect(result.services[0]).toEqual(
        expect.objectContaining({
          id: service1.id,
          categoryId: testCategory.id
        })
      )
    })

    it('should filter services by status', async () => {
      const approvedService = await createTestService(testCategory.id, {
        name: 'Approved Service',
        status: ServiceStatus.APPROVED
      })
      await createTestService(testCategory.id, {
        name: 'Pending Service',
        status: ServiceStatus.PENDING_REVIEW
      })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.list({ status: ServiceStatus.APPROVED })

      expect(result.services).toHaveLength(1)
      expect(result.services[0]).toEqual(
        expect.objectContaining({
          id: approvedService.id,
          name: 'Approved Service',
          status: ServiceStatus.APPROVED
        })
      )
    })

    it('should search services by name', async () => {
      await createTestService(testCategory.id, { name: 'NGINX Web Server' })
      await createTestService(testCategory.id, { name: 'Redis Cache' })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.list({ search: 'nginx' })

      expect(result.services).toHaveLength(1)
      expect(result.services[0].name).toBe('NGINX Web Server')
    })

    it('should paginate services correctly', async () => {
      // Create 15 services
      for (let i = 1; i <= 15; i++) {
        await createTestService(testCategory.id, { name: `Service ${i}` })
      }

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      
      // Get first page
      const firstPage = await caller.services.list({ limit: 10 })
      expect(firstPage.services).toHaveLength(10)
      expect(firstPage.hasMore).toBe(true)
      expect(firstPage.nextCursor).toBeTruthy()

      // Get second page
      const secondPage = await caller.services.list({
        limit: 10,
        cursor: firstPage.nextCursor!
      })
      expect(secondPage.services).toHaveLength(5)
      expect(secondPage.hasMore).toBe(false)
      expect(secondPage.nextCursor).toBeNull()
    })

    it('should return featured services only when requested', async () => {
      const featuredService = await createTestService(testCategory.id, {
        name: 'Featured Service',
        featured: true
      })
      await createTestService(testCategory.id, {
        name: 'Regular Service',
        featured: false
      })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.list({ featuredOnly: true })

      expect(result.services).toHaveLength(1)
      expect(result.services[0]).toEqual(
        expect.objectContaining({
          id: featuredService.id,
          name: 'Featured Service',
          featured: true
        })
      )
    })
  })

  describe('Service Get Endpoint', () => {
    it('should get service by ID with full details', async () => {
      testService = await createTestService(testCategory.id, { name: 'Test Service' })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.get({ id: testService.id })

      expect(result).toEqual(
        expect.objectContaining({
          id: testService.id,
          name: 'Test Service',
          description: 'A test service for API testing',
          dockerImage: 'nginx:latest',
          version: '1.0.0',
          categoryId: testCategory.id,
          status: ServiceStatus.APPROVED,
          ports: [{ containerPort: 80, protocol: 'tcp' as const }],
          environmentVariables: [
            expect.objectContaining({
              name: 'NODE_ENV',
              defaultValue: 'production',
              required: true,
              type: 'string'
            })
          ],
          resourceRequirements: expect.objectContaining({
            minMemory: 512,
            recommendedMemory: 1024
          }),
          compatibilityInfo: expect.objectContaining({
            operatingSystem: ['linux'],
            architecture: ['amd64']
          })
        })
      )
    })

    it('should get service by slug', async () => {
      testService = await createTestService(testCategory.id, { name: 'NGINX Web Server' })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.getBySlug({ slug: testService.slug })

      expect(result).toEqual(
        expect.objectContaining({
          id: testService.id,
          name: 'NGINX Web Server'
        })
      )
    })

    it('should throw NOT_FOUND for non-existent service ID', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.get({ id: 99999 }))
        .rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('should throw NOT_FOUND for non-existent service slug', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.getBySlug({ slug: 'non-existent-slug' }))
        .rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('Service Create Endpoint', () => {
    it('should create new service with valid data', async () => {
      const serviceData = {
        name: 'New Test Service',
        description: 'A newly created test service',
        dockerImage: 'redis:7.0',
        version: '7.0.0',
        categoryId: testCategory.id,
        documentationUrl: 'https://redis.io/docs',
        ports: [{ containerPort: 6379, protocol: 'tcp' as const }],
        environmentVariables: [
          { name: 'REDIS_PASSWORD', required: false, type: 'string' as const, description: 'Redis password' }
        ],
        resourceRequirements: { minMemory: 256, recommendedMemory: 512 },
        // Schema uses plural keys (operatingSystems/architectures) and is strict
        compatibilityInfo: { operatingSystems: ['linux' as const], architectures: ['amd64' as const, 'arm64' as const] },
        featured: false
      }

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.create(serviceData)

      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'New Test Service',
          description: 'A newly created test service',
          dockerImage: 'redis:7.0',
          version: '7.0.0',
          categoryId: testCategory.id,
          status: ServiceStatus.PENDING_REVIEW,
          featured: false,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      )
    })

    it('should validate required fields', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.create({
        // Missing required fields
      } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should validate Docker image format', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.create({
        name: 'Test Service',
        description: 'Test description',
        dockerImage: 'invalid-image-format',
        version: '1.0.0',
        categoryId: testCategory.id
      })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should validate semantic version format', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.create({
        name: 'Test Service',
        description: 'Test description',
        dockerImage: 'nginx:latest',
        version: 'invalid-version',
        categoryId: testCategory.id
      })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should validate foreign key constraint for categoryId', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.create({
        name: 'Test Service',
        description: 'Test description',
        dockerImage: 'nginx:latest',
        version: '1.0.0',
        categoryId: 99999 // Non-existent category
      })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('should de-duplicate slug when service name already exists', async () => {
      // The router auto-increments slugs instead of rejecting duplicates
      await createTestService(testCategory.id, { name: 'Unique Service' })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      const result = await caller.services.create({
        name: 'Unique Service', // Would generate the same base slug
        description: 'Another service with same name',
        dockerImage: 'nginx:latest',
        version: '1.0.0',
        categoryId: testCategory.id
      })

      expect(result.slug).toBe('unique-service-1')
    })
  })

  describe('Service Update Endpoint', () => {
    beforeEach(async () => {
      testService = await createTestService(testCategory.id)
    })

    it('should update service with valid data', async () => {
      const updateData = {
        id: testService.id,
        name: 'Updated Test Service',
        description: 'Updated description',
        version: '2.0.0',
        featured: true
      }

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.update(updateData)

      expect(result).toEqual(
        expect.objectContaining({
          id: testService.id,
          name: 'Updated Test Service',
          description: 'Updated description',
          version: '2.0.0',
          featured: true,
          updatedAt: expect.any(Date)
        })
      )
    })

    it('should not allow updating categoryId', async () => {
      const otherCategory = await createTestCategory({
        name: 'Other Category',
        description: 'Another category'
      })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.update({
        id: testService.id,
        categoryId: otherCategory.id
      } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should not allow updating slug', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.update({
        id: testService.id,
        slug: 'hijacked-slug'
      } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should validate updated fields', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.update({
        id: testService.id,
        dockerImage: 'invalid-image-format'
      })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should throw NOT_FOUND for non-existent service', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.update({
        id: 99999,
        name: 'Updated Name'
      })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('Service Delete Endpoint', () => {
    beforeEach(async () => {
      testService = await createTestService(testCategory.id)
    })

    it('should soft delete service (deprecate)', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.delete({ id: testService.id })

      expect(result).toEqual({ success: true })

      // Verify service status changed to deprecated
      const updatedService = await prisma.service.findUnique({ where: { id: testService.id } })
      expect(updatedService?.status).toBe(ServiceStatus.DEPRECATED)
    })

    it('should throw NOT_FOUND for non-existent service', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.delete({ id: 99999 }))
        .rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('should not hard delete service from database', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      await caller.services.delete({ id: testService.id })

      // Service should still exist in database
      const serviceExists = await prisma.service.findUnique({
        where: { id: testService.id }
      })
      expect(serviceExists).toBeTruthy()
    })
  })

  describe('Service Approval Endpoints', () => {
    beforeEach(async () => {
      testService = await createTestService(testCategory.id, {
        status: ServiceStatus.PENDING_REVIEW
      })
    })

    it('should approve pending service', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.approve({
        id: testService.id,
        reviewNotes: 'Service looks good and has been tested'
      })

      // The router only flips the status (review notes are accepted but the
      // services model has no reviewNotes/approvedAt columns)
      expect(result).toEqual(
        expect.objectContaining({
          id: testService.id,
          status: ServiceStatus.APPROVED,
          updatedAt: expect.any(Date)
        })
      )
    })

    it('should reject pending service', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.reject({
        id: testService.id,
        reviewNotes: 'Docker image does not exist'
      })

      expect(result).toEqual(
        expect.objectContaining({
          id: testService.id,
          status: ServiceStatus.REJECTED,
          updatedAt: expect.any(Date)
        })
      )
    })

    it('should not approve already approved service', async () => {
      // Update service to approved status
      await prisma.service.update({
        where: { id: testService.id },
        data: { status: ServiceStatus.APPROVED }
      })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.approve({
        id: testService.id,
        reviewNotes: 'Trying to approve again'
      })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should not reject already rejected service', async () => {
      // Update service to rejected status
      await prisma.service.update({
        where: { id: testService.id },
        data: { status: ServiceStatus.REJECTED }
      })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.reject({
        id: testService.id,
        reviewNotes: 'Trying to reject again'
      })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should list services pending review', async () => {
      // Create additional pending services
      await createTestService(testCategory.id, {
        name: 'Pending Service 1',
        status: ServiceStatus.PENDING_REVIEW
      })
      await createTestService(testCategory.id, {
        name: 'Pending Service 2',
        status: ServiceStatus.PENDING_REVIEW
      })
      await createTestService(testCategory.id, {
        name: 'Approved Service',
        status: ServiceStatus.APPROVED
      })

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const result = await caller.services.pending({})

      expect(result.services).toHaveLength(3)
      result.services.forEach(service => {
        expect(service.status).toBe(ServiceStatus.PENDING_REVIEW)
      })
    })
  })

  describe('Error Handling', () => {
    it('should return proper error codes for validation failures', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.create({
        name: '', // Invalid empty name
        description: 'Test',
        dockerImage: 'nginx:latest',
        version: '1.0.0',
        categoryId: testCategory.id
      })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('should handle database constraint violations', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      try {
        await caller.services.create({
          name: 'Test Service',
          description: 'Test description',
          dockerImage: 'nginx:latest',
          version: '1.0.0',
          categoryId: 99999 // Non-existent category
        })
      } catch (error: any) {
        expect(error.code).toBe('NOT_FOUND')
      }
    })

    it('should include user-friendly error messages', async () => {
      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)

      await expect(caller.services.create({
        name: 'Test Service',
        description: 'Test description',
        dockerImage: 'invalid-image',
        version: '1.0.0',
        categoryId: testCategory.id
      })).rejects.toThrow(/Docker image format/)
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 500ms for list endpoint', async () => {
      // Create some test data
      for (let i = 1; i <= 10; i++) {
        await createTestService(testCategory.id, { name: `Service ${i}` })
      }

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const start = Date.now()
      
      await caller.services.list({})
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(500)
    })

    it('should respond within 500ms for get endpoint', async () => {
      testService = await createTestService(testCategory.id)

      const caller = appRouter.createCaller({ prisma, req: undefined, user: { id: 'admin', role: 'admin' }, userId: 'admin' } as any)
      const start = Date.now()
      
      await caller.services.get({ id: testService.id })
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(500)
    })
  })
})
