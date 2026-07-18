import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '../../server/root'
import { createTestPrismaClient } from '../setup'
import { PrismaClient } from '@prisma/client'
import { performanceMonitor } from '../../lib/monitoring/performance-monitor'
import { TestDataFactory } from '../helpers/test-data-factory'

/**
 * End-to-End Test Suite: Performance & Security Validation
 * 
 * Tests performance requirements and security measures across complete workflows.
 * Validates that the API meets the <500ms response time requirement and 
 * properly handles security validation in real-world scenarios.
 * 
 * Test Coverage:
 * - Performance requirements validation (<500ms response times)
 * - Load testing and concurrent operations
 * - Input sanitization and injection prevention
 * - Rate limiting and abuse prevention
 * - Security validation across workflows
 */
describe('E2E: Performance & Security Validation', () => {
  let prisma: PrismaClient
  let caller: ReturnType<typeof appRouter.createCaller>
  let adminCaller: ReturnType<typeof appRouter.createCaller>

  beforeEach(async () => {
    // Create test database client
    prisma = createTestPrismaClient()
    
    // Clear performance metrics for clean testing
    performanceMonitor.clearMetrics()
    
    // Setup test database
    await setupTestDatabase()

    // Create tRPC callers
    caller = appRouter.createCaller({
      prisma,
      userId: 'user-123',
      user: { id: 'user-123', role: 'user' },
      req: { 
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1'
      } as any
    })

    adminCaller = appRouter.createCaller({
      prisma,
      userId: 'admin-1',
      user: { id: 'admin-1', role: 'admin' },
      req: { 
        headers: { 'user-agent': 'admin-test-agent' },
        ip: '127.0.0.1'
      } as any
    })
  })

  afterEach(async () => {
    await cleanupTestDatabase()
    performanceMonitor.clearMetrics()
    await prisma.$disconnect()
  })

  describe('Performance Requirements Validation', () => {
    it('should meet <500ms response time requirement for all major endpoints', async () => {
      // Setup: Create test data
      const category = await prisma.category.create({
        data: TestDataFactory.createCategory({
          name: 'Performance Test',
          description: 'Category for performance testing',
          sortOrder: 1
    })
      })

      // Create test services for performance testing
      for (let i = 1; i <= 20; i++) {
        await prisma.service.create({
          data: TestDataFactory.createService(category.id, {
            name: `Performance Test Service ${i}`,
            description: `Performance test service number ${i} with detailed description for testing`,
            dockerImage: `test/performance:v${i}`,
            version: `1.0.${i}`,
            ports: [{
              containerPort: 8080 + i,
              hostPort: 8080 + i,
              protocol: 'tcp' as const,
              description: `HTTP port for service ${i}`
            }],
            environmentVariables: [{
              name: `SERVICE_${i}_CONFIG`,
              defaultValue: `config-${i}`,
              required: false,
              description: `Configuration for service ${i}`,
              type: 'string'
            }]
          })
        })
      }

      // Test 1: Services list endpoint performance
      const startTime1 = Date.now()
      const servicesList = await caller.services.list({ 
        limit: 20,
        categoryId: category.id 
      })
      const responseTime1 = Date.now() - startTime1
      
      expect(servicesList.services).toHaveLength(20)
      expect(responseTime1).toBeLessThan(500) // Must be under 500ms

      // Test 2: Categories list endpoint performance
      const startTime2 = Date.now()
      await caller.categories.list({ limit: 10 })
      const responseTime2 = Date.now() - startTime2
      
      expect(responseTime2).toBeLessThan(500) // Must be under 500ms

      // Test 3: Individual service get performance
      const testService = servicesList.services[0]
      const startTime3 = Date.now()
      await caller.services.get({ id: testService.id })
      const responseTime3 = Date.now() - startTime3
      
      expect(responseTime3).toBeLessThan(500) // Must be under 500ms

      // Test 4: Search endpoint performance
      const startTime4 = Date.now()
      await caller.services.list({ 
        search: 'Performance', 
        limit: 10 
      })
      const responseTime4 = Date.now() - startTime4
      
      expect(responseTime4).toBeLessThan(500) // Must be under 500ms

      // Test 5: Admin dashboard performance
      const startTime5 = Date.now()
      await adminCaller.admin.getDashboard()
      const responseTime5 = Date.now() - startTime5
      
      expect(responseTime5).toBeLessThan(500) // Must be under 500ms

      // Verify performance monitoring detected all requests
      const performanceStats = performanceMonitor.getStats()
      expect(performanceStats.totalRequests).toBeGreaterThan(0)
    })

    it('should handle high load with multiple concurrent requests', async () => {
      // Setup: Create test category and services
      const category = await prisma.category.create({
        data: TestDataFactory.createCategory({
          name: 'Load Test Category',
          description: 'Category for load testing',
          sortOrder: 1
    })
      })

      // Create multiple services for load testing
      const servicePromises = []
      for (let i = 1; i <= 10; i++) {
        servicePromises.push(
          prisma.service.create({
            data: TestDataFactory.createService(category.id, {
              name: `Load Test Service ${i}`,
              description: `Load test service ${i}`,
              dockerImage: `loadtest/service:v${i}`,
              version: `1.0.${i}`
            })
          })
        )
      }
      await Promise.all(servicePromises)

      // Test concurrent requests
      const concurrentRequests = []
      for (let i = 0; i < 20; i++) {
        concurrentRequests.push(
          caller.services.list({ 
            limit: 10,
            categoryId: category.id
          })
        )
      }

      const startTime = Date.now()
      const results = await Promise.all(concurrentRequests)
      const totalTime = Date.now() - startTime

      // Verify all requests succeeded
      expect(results).toHaveLength(20)
      results.forEach(result => {
        expect(result.services).toBeDefined()
        expect(result.services.length).toBeLessThanOrEqual(10)
      })

      // Each individual request should be under 500ms
      // Total time for 20 concurrent requests should be reasonable
      expect(totalTime).toBeLessThan(2000) // Max 2 seconds for 20 concurrent requests

      // Verify performance monitoring tracked concurrent requests
      const performanceStats = performanceMonitor.getStats()
      expect(performanceStats.totalRequests).toBe(20)
    })

    it('should maintain performance under pagination stress', async () => {
      // Setup: Create large dataset for pagination testing
      const category = await prisma.category.create({
        data: {
          name: 'Pagination Test',
          slug: 'pagination-test',  
          description: 'Category for pagination stress testing',
          sortOrder: 1
    }
      })

      // Create 100 services for pagination stress testing
      const batchSize = 10
      for (let batch = 0; batch < 10; batch++) {
        const serviceData = []
        for (let i = 1; i <= batchSize; i++) {
          const serviceNum = batch * batchSize + i
          const serviceName = `Pagination Service ${serviceNum}`
          serviceData.push({
            name: serviceName,
            slug: TestDataFactory.generateSlug(serviceName),
            description: `Pagination test service number ${serviceNum}`,
            dockerImage: `pagination/test:v${serviceNum}`,
            version: `1.0.${serviceNum}`,
            categoryId: category.id,
            status: 'approved' as const
          })
        }
        await prisma.service.createMany({ data: serviceData })
      }

      // Test pagination performance across multiple pages
      let cursor: number | null = null
      const pageSize = 20
      const responseTimes: number[] = []

      for (let page = 0; page < 5; page++) {
        const startTime = Date.now()
        const result = await caller.services.list({
          categoryId: category.id,
          limit: pageSize,
          cursor: cursor?.toString() || undefined
        })
        const responseTime = Date.now() - startTime
        
        responseTimes.push(responseTime)
        expect(responseTime).toBeLessThan(500) // Each page must be under 500ms
        
        cursor = TestDataFactory.normalizeCursor(result.nextCursor)
        
        if (!result.hasMore) break
      }

      // Verify consistent performance across pages
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      expect(averageResponseTime).toBeLessThan(300) // Average should be well under limit
    })
  })

  describe('Security Validation', () => {
    it('should prevent SQL injection attacks in search queries', async () => {
      // Setup: Create test category and service
      const category = await prisma.category.create({
        data: {
          name: 'Security Test',
          slug: 'security-test',
          description: 'Category for security testing',
          sortOrder: 1
    }
      })

      await prisma.service.create({
        data: {
          name: 'Legitimate Service',
          slug: 'legitimate-service',
          description: 'A legitimate service for testing',
          dockerImage: 'legitimate/service:v1',
          version: '1.0.0',
          categoryId: category.id,
          status: 'approved'
        }
      })

      // Test various SQL injection attempts
      const maliciousQueries = [
        "'; DROP TABLE services; --",
        "1' OR '1'='1",
        "admin'--",
        "1' UNION SELECT * FROM services--",
        "'; DELETE FROM categories; --",
        "1' OR 1=1 /*"
      ]

      for (const maliciousQuery of maliciousQueries) {
        // These should not cause errors or unexpected results
        const result = await caller.services.list({
          search: maliciousQuery,
          limit: 10
        })

        // Results should be empty (no matches) or contain only legitimate results
        expect(result.services).toBeDefined()
        result.services.forEach(service => {
          expect(service.name).toBe('Legitimate Service')
        })
      }

      // Verify database integrity after injection attempts
      const allServices = await prisma.service.findMany()
      expect(allServices).toHaveLength(1)
      expect(allServices[0].name).toBe('Legitimate Service')
    })

    it('should sanitize and validate service creation input', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Input Validation',
          slug: 'input-validation',
          description: 'Category for input validation testing',
          sortOrder: 1
    }
      })

      // Test XSS prevention in service creation
      const maliciousInputs = {
        name: '<script>alert("xss")</script>Malicious Service',
        description: 'Service with <img src="x" onerror="alert(1)"> malicious content',
        dockerImage: 'test/service<script>alert()</script>:latest'
      }

      await expect(caller.services.create({
        name: maliciousInputs.name,
        description: maliciousInputs.description,
        dockerImage: maliciousInputs.dockerImage,
        version: '1.0.0',
        categoryId: category.id
      })).rejects.toThrow() // Should reject malicious input

      // Test oversized input handling
      const oversizedData = {
        name: 'A'.repeat(1000), // Way over 100 character limit
        description: 'B'.repeat(5000), // Way over 1000 character limit
      }

      await expect(caller.services.create({
        name: oversizedData.name,
        description: oversizedData.description,
        dockerImage: 'test/service:latest',
        version: '1.0.0',
        categoryId: category.id
      })).rejects.toThrow() // Should reject oversized input

      // Test invalid Docker image formats
      const invalidDockerImages = [
        'not-a-valid-image',
        'missing:tag:extra',
        '../../../etc/passwd',
        'image with spaces:latest',
        'UPPERCASE/IMAGE:LATEST'
      ]

      for (const invalidImage of invalidDockerImages) {
        await expect(caller.services.create({
          name: 'Test Service',
          description: 'Testing invalid Docker image format',
          dockerImage: invalidImage,
          version: '1.0.0',
          categoryId: category.id
        })).rejects.toThrow() // Should reject invalid Docker image formats
      }
    })

    it('should enforce role-based access control consistently', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'RBAC Test',
          slug: 'rbac-test',
          description: 'Category for role-based access control testing',
          sortOrder: 1
    }
      })

      // Create test import for admin operations
      const testImport = await prisma.serviceImport.create({
        data: {
          sourceUrl: 'https://hub.docker.com/r/test/rbac-service',
          sourceType: 'docker_hub' as const,
          categoryId: category.id,
          status: 'pending',
          submittedBy: 'user-123'
        }
      })

      // Test that regular users cannot access admin-only operations
      const adminOnlyOperations = [
        () => caller.admin.getDashboard(),
        () => caller.admin.listImports({ limit: 10 }),
        () => caller.admin.getImportDetails({ importId: testImport.id }),
        () => caller.admin.reviewImport({ 
          importId: testImport.id, 
          action: 'approve',
          reviewNotes: 'Test' 
        }),
        () => caller.admin.bulkReviewImports({ 
          importIds: [testImport.id], 
          action: 'approve',
          reviewNotes: 'Test' 
        }),
        () => caller.admin.listServices({ limit: 10 }),
        () => caller.admin.updateServiceStatus({ 
          serviceId: 1, 
          status: 'approved' 
        }),
        () => caller.admin.getSystemStats({ period: 'week' }),
        () => caller.admin.deleteImport({ importId: testImport.id }),
        () => caller.admin.deleteService({ serviceId: 1 })
      ]

      // All admin operations should fail for regular users
      for (const operation of adminOnlyOperations) {
        await expect(operation()).rejects.toThrow('Admin access required')
      }

      // Test that admins CAN access these operations
      const dashboardResult = await adminCaller.admin.getDashboard()
      expect(dashboardResult).toBeDefined()
      expect(dashboardResult.systemStats).toBeDefined()

      const importsResult = await adminCaller.admin.listImports({ limit: 10 })
      expect(importsResult.imports).toBeDefined()
      expect(importsResult.imports.length).toBeGreaterThan(0)
    })

    it('should handle malicious file path attempts in imports', async () => {
      // Test path traversal attempts in import URLs
      const maliciousUrls = [
        'file:///etc/passwd',
        '../../../sensitive-file.txt',
        'https://hub.docker.com/r/../../../etc/shadow',
        'ftp://malicious-server/payload',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>'
      ]

      for (const maliciousUrl of maliciousUrls) {
        await expect(caller.imports.createFromDockerHub({
          dockerImage: maliciousUrl,
          categoryId: 1,
          submittedBy: 'user-123'
        })).rejects.toThrow() // Should reject malicious URLs
      }

      // Verify only legitimate Docker Hub URLs are accepted
      const legitimateUrls = [
        'https://hub.docker.com/r/nginx/nginx',
        'https://hub.docker.com/r/redis/redis-stack',
        'https://hub.docker.com/r/postgres/postgres'
      ]

      // These should work (but might fail due to network/mocking - that's ok)
      for (const legitUrl of legitimateUrls) {
        // We expect either success or network-related failure, not validation error
        try {
          await caller.imports.createFromDockerHub({
            dockerImage: legitUrl,
            categoryId: 1,
            submittedBy: 'user-123'
          })
        } catch (error: any) {
          // Should not be a validation error about malicious URLs
          expect(error.message).not.toContain('malicious')
          expect(error.message).not.toContain('invalid URL format')
        }
      }
    })

    it('should prevent resource exhaustion attacks', async () => {
      // Test creating excessive amounts of data rapidly
      const category = await prisma.category.create({
        data: {
          name: 'Resource Test',
          slug: 'resource-test',
          description: 'Category for resource exhaustion testing',
          sortOrder: 1
    }
      })

      // Attempt to create many services rapidly (should be limited by validation)
      const rapidCreationPromises = []
      for (let i = 0; i < 100; i++) {
        rapidCreationPromises.push(
          caller.services.create({
            name: `Rapid Service ${i}`,
            description: `Rapidly created service number ${i} for resource testing`,
            dockerImage: `rapid/service:v${i}`,
            version: `1.0.${i}`,
            categoryId: category.id
          }).catch(error => error) // Catch to prevent promise rejection
        )
      }

      const results = await Promise.all(rapidCreationPromises)
      
      // Some should succeed, but system should handle the load gracefully
      const successful = results.filter(result => result.id !== undefined)
      const failed = results.filter(result => result instanceof Error)
      
      // System should handle rapid requests without crashing
      expect(successful.length + failed.length).toBe(100)
      
      // Verify database integrity
      const servicesCount = await prisma.service.count({
        where: { categoryId: category.id }
      })
      expect(servicesCount).toBe(successful.length)
    })
  })

  describe('Rate Limiting & Abuse Prevention', () => {
    it('should handle repeated requests gracefully', async () => {
      // Create test data
      const category = await prisma.category.create({
        data: {
          name: 'Rate Limit Test',
          slug: 'rate-limit-test',
          description: 'Category for rate limiting tests',
          sortOrder: 1
    }
      })

      // Make many repeated requests quickly
      const repeatRequests = []
      for (let i = 0; i < 50; i++) {
        repeatRequests.push(
          caller.services.list({ 
            categoryId: category.id, 
            limit: 10 
          })
        )
      }

      const startTime = Date.now()
      const results = await Promise.all(repeatRequests)
      const totalTime = Date.now() - startTime

      // All requests should complete (no rate limiting in test environment)
      expect(results).toHaveLength(50)
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.services).toBeDefined()
      })

      // Performance should remain reasonable even under load
      expect(totalTime).toBeLessThan(5000) // Max 5 seconds for 50 requests

      // Verify performance monitoring captured all requests
      const performanceStats = performanceMonitor.getStats()
      expect(performanceStats.totalRequests).toBe(50)
    })
  })
})

// Test helper functions
async function setupTestDatabase() {
  const prisma = createTestPrismaClient()
  // Clean existing data
  await prisma.serviceImport.deleteMany()
  await prisma.service.deleteMany() 
  await prisma.category.deleteMany()

  // Create default categories for testing
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
    }
    ]
  })
}

async function cleanupTestDatabase() {
  const prisma = createTestPrismaClient()
  try {
    await prisma.serviceImport.deleteMany()
    await prisma.service.deleteMany()
    await prisma.category.deleteMany()
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}