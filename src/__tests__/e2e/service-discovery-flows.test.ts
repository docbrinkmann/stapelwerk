import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '../../server/root'
import type { AppRouter } from '../../server/root'
import { createTestPrismaClient } from '../setup'
import { PrismaClient } from '@prisma/client'
import { TestDataFactory } from '../helpers/test-data-factory'

/**
 * End-to-End Test Suite: Service Discovery and Contribution Flows
 * 
 * Tests complete user workflows from service discovery to contribution and admin approval.
 * These tests simulate real user journeys through the Stapelwerk service catalog API.
 * 
 * Test Coverage:
 * - Service discovery workflow (browse, search, filter)
 * - External service import contribution flow
 * - Manual service contribution workflow  
 * - Admin review and approval processes
 * - Error handling across complete workflows
 */
describe('E2E: Service Discovery & Contribution Flows', () => {
  // Test context setup
  let prisma: PrismaClient
  let caller: ReturnType<typeof appRouter.createCaller>
  let adminCaller: ReturnType<typeof appRouter.createCaller>

  beforeEach(async () => {
    // Create test database client
    prisma = createTestPrismaClient()
    
    // Setup test database with clean state
    await setupTestDatabase()

    // Create tRPC caller for regular users
    caller = appRouter.createCaller({
      prisma,
      user: { id: 'user-123', role: 'user' },
      userId: 'user-123',
      req: { headers: { 'user-agent': 'test-agent' } } as any
    })

    // Create tRPC caller for admin users
    adminCaller = appRouter.createCaller({
      prisma,
      user: { id: 'admin-1', role: 'admin' },
      userId: 'admin-1',
      req: { headers: { 'user-agent': 'test-agent' } } as any
    })
  })

  afterEach(async () => {
    await cleanupTestDatabase()
    await prisma.$disconnect()
  })

  describe('Service Discovery Workflow', () => {
    it('should complete full service discovery journey', async () => {
      // Setup: Create test categories and services
      const testCategory = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Test Databases',
        description: 'Test database services'
      }))

      const testService = await caller.services.create(TestDataFactory.createService(testCategory.id, {
        name: 'Test PostgreSQL',
        description: 'PostgreSQL database for testing',
        dockerImage: 'postgres:15-alpine',
        version: '15.0.0',
        ports: [TestDataFactory.createPortConfig({
          containerPort: 5432,
          hostPort: 5432,
          protocol: 'tcp',
          description: 'PostgreSQL port'
        })],
        environmentVariables: [TestDataFactory.createEnvVarConfig({
          name: 'POSTGRES_PASSWORD',
          defaultValue: '',
          required: true,
          description: 'Database password',
          type: 'password'
        })]
      }))

      // Step 1: Browse all categories
      const categories = await caller.categories.list({ 
        limit: 10 
      })
      
      expect(categories.categories).toBeDefined()
      expect(categories.categories.length).toBeGreaterThan(0)
      expect(categories.categories[0]).toHaveProperty('serviceCount')

      // Step 2: Filter services by category
      const servicesInCategory = await caller.services.list({
        categoryId: testCategory.id,
        status: 'approved',
        limit: 10
      })

      expect(servicesInCategory.services).toBeDefined()
      expect(servicesInCategory.services.length).toBe(1)
      expect(servicesInCategory.services[0].name).toBe('Test PostgreSQL')

      // Step 3: Search services by name
      const searchResults = await caller.services.list({
        search: 'PostgreSQL',
        limit: 10
      })

      expect(searchResults.services.length).toBeGreaterThan(0)
      expect(searchResults.services[0].name).toContain('PostgreSQL')

      // Step 4: Get detailed service information
      const serviceDetails = await caller.services.get({
        id: testService.id
      })

      expect(serviceDetails).toBeDefined()
      expect(serviceDetails.name).toBe('Test PostgreSQL')
      expect(serviceDetails.category).toBeDefined()
      expect(serviceDetails.category.name).toBe('Test Databases')

      // Step 5: Verify response times are within performance requirements (<500ms)
      const startTime = Date.now()
      await caller.services.list({ limit: 10 })
      const responseTime = Date.now() - startTime
      
      expect(responseTime).toBeLessThan(500) // Performance requirement validation
    })

    it('should handle pagination in service discovery', async () => {
      // Setup: Create multiple test services
      const testCategory = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Test Web Servers',
        description: 'Web server services for testing'
      }))

      // Create 15 test services for pagination testing
      for (let i = 1; i <= 15; i++) {
        await caller.services.create(TestDataFactory.createService(testCategory.id, {
          name: `Test Nginx ${i}`,
          description: `Test nginx server ${i} for testing purposes`,
          dockerImage: `nginx:1.${i}-alpine`,
          version: `1.${i}.0`,
          ports: [TestDataFactory.createPortConfig({
            containerPort: 80,
            hostPort: 8080 + i,
            protocol: 'tcp',
            description: 'HTTP port'
          })]
        }))
      }

      // Step 1: Get first page
      const firstPage = await caller.services.list({
        categoryId: testCategory.id,
        limit: 10
      })

      expect(firstPage.services.length).toBe(10)
      expect(firstPage.hasMore).toBe(true)
      expect(firstPage.nextCursor).toBeDefined()

      // Step 2: Get second page using cursor
      const secondPage = await caller.services.list({
        categoryId: testCategory.id,
        cursor: firstPage.nextCursor!,
        limit: 10
      })

      expect(secondPage.services.length).toBe(5) // Remaining services
      expect(secondPage.hasMore).toBe(false)
      expect(secondPage.nextCursor).toBeNull()

      // Step 3: Verify no duplicate services between pages
      const firstPageIds = firstPage.services.map(s => s.id)
      const secondPageIds = secondPage.services.map(s => s.id)
      const overlap = firstPageIds.filter(id => secondPageIds.includes(id))
      
      expect(overlap.length).toBe(0)
    })
  })

  describe('External Import Contribution Flow', () => {
    it('should complete full external import workflow', async () => {

      // Step 1: Create test category first
      const category = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Test Redis Category',
        description: 'Category for Redis testing'
      }))
      
      // Step 1: User initiates import from Docker Hub URL
      const importRequest = await caller.imports.create(TestDataFactory.createServiceImport(category.id, {
        sourceUrl: 'https://hub.docker.com/r/redis/redis-stack',
        submittedBy: 'user-123'
      }))

      expect(importRequest).toBeDefined()
      expect(importRequest.status).toBe('pending')
      expect(importRequest.sourceUrl).toBe('https://hub.docker.com/r/redis/redis-stack')
      expect(importRequest.extractedMetadata).toBeDefined()

      // Step 2: Verify metadata was extracted automatically
      expect(importRequest.extractedMetadata).toHaveProperty('exposedPorts')
      expect(importRequest.extractedMetadata).toHaveProperty('environmentVariables')
      expect(importRequest.name).toBeDefined()
      expect(importRequest.description).toBeDefined()

      // Step 3: Admin reviews pending import
      const pendingImports = await adminCaller.admin.listImports({
        status: 'pending',
        limit: 10
      })

      expect(pendingImports.imports.length).toBeGreaterThan(0)
      const ourImport = pendingImports.imports.find(imp => imp.id === importRequest.id)
      expect(ourImport).toBeDefined()

      // Step 4: Admin gets detailed import information
      const importDetails = await adminCaller.admin.getImportDetails({
        importId: importRequest.id
      })

      expect(importDetails).toBeDefined()
      expect(importDetails.import.id).toBe(importRequest.id)
      expect(importDetails.extractedMetadata).toBeDefined()
      expect(importDetails.validationResult).toBeDefined()

      // Step 5: Admin approves the import
      const approvalResult = await adminCaller.admin.reviewImport({
        importId: importRequest.id,
        action: 'approve',
        reviewNotes: 'Approved after validation - Redis Stack is a reliable database service'
      })

      expect(approvalResult.success).toBe(true)
      expect(approvalResult.serviceId).toBeDefined()

      // Step 6: Verify service was created and is publicly available
      const createdService = await caller.services.get({
        id: approvalResult.serviceId!
      })

      expect(createdService).toBeDefined()
      expect(createdService.name).toContain('Redis')
      expect(createdService.status).toBe('approved')
      expect(createdService.dockerImage).toBe('redis/redis-stack')

      // Step 7: Verify import status was updated
      const updatedImport = await adminCaller.admin.getImportDetails({
        importId: importRequest.id
      })

      expect(updatedImport.import.status).toBe('approved')
      expect(updatedImport.import.serviceId).toBe(approvalResult.serviceId)
      expect(updatedImport.import.reviewNotes).toBe('Approved after validation - Redis Stack is a reliable database service')
    })

    it('should handle import rejection workflow', async () => {

      // Step 1: Create test category first
      const category = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Test Category',
        description: 'Category for testing rejection'
      }))
      
      // Step 1: User attempts to import potentially problematic service
      const importRequest = await caller.imports.create(TestDataFactory.createServiceImport(category.id, {
        sourceUrl: 'https://hub.docker.com/r/test/malicious-service',
        submittedBy: 'user-456'
      }))

      // Step 2: Admin reviews and rejects the import
      const rejectionResult = await adminCaller.admin.reviewImport({
        importId: importRequest.id,
        action: 'reject',
        reviewNotes: 'Rejected: Service appears to be potentially malicious or inappropriate for our catalog'
      })

      expect(rejectionResult.success).toBe(true)
      expect(rejectionResult.serviceId).toBeUndefined()

      // Step 3: Verify no service was created
      const allServices = await caller.services.list({
        search: 'malicious',
        limit: 10
      })

      expect(allServices.services.length).toBe(0)

      // Step 4: Verify import status shows rejection
      const rejectedImport = await adminCaller.admin.getImportDetails({
        importId: importRequest.id
      })

      expect(rejectedImport.import.status).toBe('rejected')
      expect(rejectedImport.import.serviceId).toBeNull()
      expect(rejectedImport.import.reviewNotes).toContain('Rejected')
    })
  })

  describe('Manual Service Contribution Flow', () => {
    it('should complete full manual contribution workflow', async () => {

      // Setup: Create test category
      const category = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Development Tools',
        description: 'Development and build tools'
      }))

      // Step 1: User manually submits a new service
      const serviceSubmission = await caller.services.create(TestDataFactory.createService(category.id, {
        name: 'Custom Build Tool',
        description: 'A custom build automation tool for CI/CD pipelines with advanced features for modern development workflows',
        dockerImage: 'buildtools/custom:v2.1.0',
        version: '2.1.0',
        ports: [
          TestDataFactory.createPortConfig({
            containerPort: 8080,
            hostPort: 8080,
            protocol: 'tcp',
            description: 'Web UI for build configuration'
          }),
          TestDataFactory.createPortConfig({
            containerPort: 9000,
            hostPort: 9000,
            protocol: 'tcp',
            description: 'API endpoint for build triggers'
          })
        ],
        environmentVariables: [
          TestDataFactory.createEnvVarConfig({
            name: 'BUILD_MODE',
            defaultValue: 'production',
            required: false,
            description: 'Build mode configuration',
            type: 'string'
          }),
          TestDataFactory.createEnvVarConfig({
            name: 'API_TOKEN',
            defaultValue: '',
            required: true,
            description: 'Authentication token for external services',
            type: 'string'
          })
        ],
        resourceRequirements: TestDataFactory.createResourceRequirements({
          minCpu: 0.5,
          recommendedCpu: 1.0,
          minMemory: 512,
          recommendedMemory: 1024,
          storageRequired: true,
          minimumStorage: 2048
        }),
        documentationUrl: 'https://docs.buildtools.example.com/custom'
      }))

      // Step 2: Verify service was created in pending status
      expect(serviceSubmission).toBeDefined()
      expect(serviceSubmission.name).toBe('Custom Build Tool')
      expect(serviceSubmission.status).toBe('pending')

      // Step 3: Admin reviews pending services
      const pendingServices = await adminCaller.admin.listServices({
        status: 'pending',
        limit: 10
      })

      expect(pendingServices.services.length).toBeGreaterThan(0)
      const ourService = pendingServices.services.find(s => s.id === serviceSubmission.id)
      expect(ourService).toBeDefined()

      // Step 4: Admin approves the service
      const approvalResult = await adminCaller.admin.updateServiceStatus({
        serviceId: serviceSubmission.id,
        status: 'approved',
        adminNotes: 'Approved - Well documented build tool with clear configuration'
      })

      expect(approvalResult).toBeDefined()
      expect(approvalResult.status).toBe('approved')

      // Step 5: Verify service is now publicly available
      const approvedService = await caller.services.get({
        id: serviceSubmission.id
      })

      expect(approvedService.status).toBe('approved')
      expect(approvedService.name).toBe('Custom Build Tool')

      // Step 6: Verify service appears in public listing
      const publicServices = await caller.services.list({
        categoryId: category.id,
        status: 'approved',
        limit: 10
      })

      const foundService = publicServices.services.find(s => s.id === serviceSubmission.id)
      expect(foundService).toBeDefined()
      expect(foundService?.status).toBe('approved')
    })
  })

  describe('Bulk Operations & Admin Workflow', () => {
    it('should handle bulk import approval workflow', async () => {

      // Step 1: Create test category first
      const category = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Bulk Test Category',
        description: 'Category for bulk testing'
      }))
      
      // Step 1: Create multiple pending imports
      const imports = []
      for (let i = 1; i <= 5; i++) {
        const importReq = await caller.imports.create(TestDataFactory.createServiceImport(category.id, {
          sourceUrl: `https://hub.docker.com/r/test/service-${i}`,
          submittedBy: `user-${i}`
        }))
        imports.push(importReq)
      }

      // Step 2: Admin performs bulk approval
      const bulkApprovalResult = await adminCaller.admin.bulkReviewImports({
        importIds: imports.map(imp => imp.id),
        action: 'approve',
        reviewNotes: 'Bulk approved - All services passed automated validation'
      })

      expect(bulkApprovalResult.results.length).toBe(5)
      
      // Step 3: Verify all were successfully approved
      for (const result of bulkApprovalResult.results) {
        expect(result.success).toBe(true)
        expect(result.serviceId).toBeDefined()
      }

      // Step 4: Verify all services are now available
      const approvedServices = await caller.services.list({
        status: 'approved',
        limit: 20
      })

      const createdServices = approvedServices.services.filter(service => 
        bulkApprovalResult.results.some(result => result.serviceId === service.id)
      )

      expect(createdServices.length).toBe(5)
    })
  })

  describe('Error Handling & Edge Cases', () => {
    it('should handle invalid Docker Hub URLs gracefully', async () => {
      // Create test category first
      const category = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Test Category',
        description: 'Category for URL validation testing'
      }))
      
      await expect(caller.imports.create(TestDataFactory.createServiceImport(category.id, {
        sourceUrl: 'not-a-valid-url',
        submittedBy: 'user-123'
      }))).rejects.toThrow()

      await expect(caller.imports.create(TestDataFactory.createServiceImport(category.id, {
        sourceUrl: 'https://example.com/not-docker-hub',
        submittedBy: 'user-123'
      }))).rejects.toThrow()
    })

    it('should handle non-existent service lookups', async () => {
      await expect(caller.services.get({
        id: 999999
      })).rejects.toThrow('Service not found')

      await expect(caller.services.get({
        id: 999999 // Non-existent ID
      })).rejects.toThrow('Service not found')
    })

    it('should enforce admin-only operations', async () => {

      await expect(caller.admin.getDashboard()).rejects.toThrow('Admin access required')

      await expect(caller.admin.reviewImport({
        importId: 1,
        action: 'approve',
        reviewNotes: 'Test'
      })).rejects.toThrow('Admin access required')
    })

    it('should validate service data thoroughly', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Test Category',
        description: 'For validation testing'
      }))

      // Test invalid service data
      await expect(caller.services.create({
        name: '', // Empty name
        description: 'Test description',
        dockerImage: 'test:latest',
        version: '1.0.0',
        categoryId: category.id
      })).rejects.toThrow()

      await expect(caller.services.create({
        name: 'Test Service',
        description: 'Short', // Too short description
        dockerImage: 'test:latest',
        version: '1.0.0',
        categoryId: category.id
      })).rejects.toThrow()

      await expect(caller.services.create({
        name: 'Test Service',
        description: 'Valid description for testing',
        dockerImage: 'invalid-image-format', // Invalid Docker image format
        version: '1.0.0',
        categoryId: category.id
      })).rejects.toThrow()
    })

    it('should handle concurrent operations safely', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({
        name: 'Concurrent Test',
        description: 'For concurrency testing'
      }))

      // Create multiple services concurrently with similar names
      const promises = []
      for (let i = 1; i <= 10; i++) {
        promises.push(caller.services.create({
          name: `Concurrent Service ${i}`,
          description: `Concurrent service number ${i} for testing race conditions`,
          dockerImage: `concurrent/service:v${i}`,
          version: `1.0.${i}`,
          categoryId: category.id
        }))
      }

      const results = await Promise.allSettled(promises)
      
      // All should succeed (no race conditions)
      const successful = results.filter(r => r.status === 'fulfilled')
      expect(successful.length).toBe(10)

      // Verify all services have unique slugs
      const services = await caller.services.list({
        categoryId: category.id,
        limit: 20
      })

      const slugs = services.services.map(s => s.slug)
      const uniqueSlugs = new Set(slugs)
      expect(uniqueSlugs.size).toBe(slugs.length) // No duplicate slugs
    })
  })
})

// Test helper functions
async function setupTestDatabase() {
  const prisma = createTestPrismaClient()
  // Clean all existing data
  await prisma.serviceImport.deleteMany()
  await prisma.service.deleteMany()
  await prisma.category.deleteMany()

  // Create default test categories
  await prisma.category.createMany({
    data: [
      {
        name: 'Databases',
        slug: 'databases',
        description: 'Database services',
        sortOrder: 1
      },
      {
        name: 'Web Servers',
        slug: 'web-servers',
        description: 'Web server services',
        sortOrder: 2
      },
      {
        name: 'Development Tools',
        slug: 'development-tools',
        description: 'Development and build tools',
        sortOrder: 3
      }
    ]
  })
}

async function cleanupTestDatabase() {
  const prisma = createTestPrismaClient()
  // Clean up test database after each test
  try {
    await prisma.serviceImport.deleteMany()
    await prisma.service.deleteMany() 
    await prisma.category.deleteMany()
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}
