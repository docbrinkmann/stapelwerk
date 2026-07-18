import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '../../src/server/root'
import { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'

const prisma = new PrismaClient()

describe('User Workflows - Integration Tests', () => {
  let adminCaller: ReturnType<typeof appRouter.createCaller>
  let userCaller: ReturnType<typeof appRouter.createCaller>
  
  const testSuffix = Date.now().toString()
  
  // Mock users
  const adminUser = {
    id: 'admin-user-id',
    email: 'admin@example.com',
    role: 'admin',
    name: 'Admin User'
  }

  const regularUser = {
    id: 'regular-user-id',
    email: 'user@example.com',
    role: 'user',
    name: 'Regular User'
  }

  beforeEach(async () => {
    // Create callers with different user contexts
    adminCaller = appRouter.createCaller({
      prisma,
      user: adminUser,
      req: {} as any,
      res: {} as any
    })
    
    userCaller = appRouter.createCaller({
      prisma,
      user: regularUser,
      req: {} as any,
      res: {} as any
    })

    // Clean up test data
    await prisma.serviceImport.deleteMany({
      where: { name: { contains: testSuffix } }
    })
    await prisma.service.deleteMany({
      where: { name: { contains: testSuffix } }
    })
    await prisma.category.deleteMany({
      where: { name: { contains: testSuffix } }
    })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.serviceImport.deleteMany({
      where: { name: { contains: testSuffix } }
    })
    await prisma.service.deleteMany({
      where: { name: { contains: testSuffix } }
    })
    await prisma.category.deleteMany({
      where: { name: { contains: testSuffix } }
    })
  })

  describe('Service Discovery Workflow', () => {
    it('should allow users to browse categories and discover services', async () => {
      // Setup: Create test category and services
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${testSuffix}`,
          slug: `test-category-${testSuffix}`,
          description: 'Test category for integration test'
        }
      })

      await prisma.service.createMany({
        data: [
          {
            name: `Web Server ${testSuffix}`,
            slug: `web-server-${testSuffix}`,
            description: 'A test web server service',
            dockerImage: 'nginx:alpine',
            categoryId: category.id,
            status: 'approved'
          },
          {
            name: `Database ${testSuffix}`,
            slug: `database-${testSuffix}`,
            description: 'A test database service',
            dockerImage: 'postgres:14',
            categoryId: category.id,
            status: 'approved'
          }
        ]
      })

      // Workflow: User discovers services
      
      // Step 1: Browse categories
      const categories = await userCaller.categories.list({})
      expect(categories.categories).toContainEqual(
        expect.objectContaining({
          name: `Test Category ${testSuffix}`,
          serviceCount: 2
        })
      )

      // Step 2: Get category details
      const categoryDetails = await userCaller.categories.get({ id: category.id })
      expect(categoryDetails).toMatchObject({
        name: `Test Category ${testSuffix}`,
        serviceCount: 2
      })

      // Step 3: Browse services in category
      const servicesInCategory = await userCaller.categories.services({
        categoryId: category.id,
        limit: 10
      })
      
      expect(servicesInCategory.services).toHaveLength(2)
      expect(servicesInCategory.services).toContainEqual(
        expect.objectContaining({
          name: `Web Server ${testSuffix}`,
          status: 'approved'
        })
      )

      // Step 4: Get service details
      const service = servicesInCategory.services[0]
      const serviceDetails = await userCaller.services.get({ id: service.id })
      expect(serviceDetails).toMatchObject({
        name: service.name,
        dockerImage: service.dockerImage,
        category: expect.objectContaining({
          name: `Test Category ${testSuffix}`
        })
      })

      // Step 5: Search services
      const searchResults = await userCaller.services.list({
        search: 'Web Server'
      })
      expect(searchResults.services).toContainEqual(
        expect.objectContaining({
          name: `Web Server ${testSuffix}`
        })
      )
    })

    it('should handle empty states gracefully', async () => {
      // Test category with no services
      const emptyCategory = await prisma.category.create({
        data: {
          name: `Empty Category ${testSuffix}`,
          slug: `empty-category-${testSuffix}`,
          description: 'Empty category for testing'
        }
      })

      const servicesInEmptyCategory = await userCaller.categories.services({
        categoryId: emptyCategory.id,
        limit: 10
      })

      expect(servicesInEmptyCategory.services).toHaveLength(0)
      expect(servicesInEmptyCategory.hasMore).toBe(false)
    })
  })

  describe('External Service Import Workflow', () => {
    it('should handle complete external service import and approval workflow', async () => {
      // Setup: Create test category
      const category = await prisma.category.create({
        data: {
          name: `Import Category ${testSuffix}`,
          slug: `import-category-${testSuffix}`,
          description: 'Category for import testing'
        }
      })

      // Workflow: External service import process

      // Step 1: User initiates import
      const importResult = await userCaller.imports.create({
        sourceUrl: 'docker.io/nginx:alpine',
        categoryId: category.id,
        name: `Imported Service ${testSuffix}`,
        description: 'A service imported for testing'
      })

      expect(importResult).toMatchObject({
        sourceUrl: 'docker.io/nginx:alpine',
        status: 'pending',
        name: `Imported Service ${testSuffix}`
      })

      // Step 2: Admin views pending imports
      const pendingImports = await adminCaller.admin.listImports({
        status: 'pending',
        limit: 10
      })

      const ourImport = pendingImports.imports.find(imp => 
        imp.name === `Imported Service ${testSuffix}`
      )
      expect(ourImport).toBeDefined()

      // Step 3: Admin reviews import details
      const importDetails = await adminCaller.admin.getImportDetails({
        importId: ourImport!.id
      })

      expect(importDetails.import).toMatchObject({
        name: `Imported Service ${testSuffix}`,
        status: 'pending'
      })

      // Step 4: Admin approves import
      const approvalResult = await adminCaller.admin.reviewImport({
        importId: ourImport!.id,
        action: 'approve',
        reviewNotes: 'Approved after review'
      })

      expect(approvalResult.success).toBe(true)
      expect(approvalResult.serviceId).toBeDefined()

      // Step 5: Verify service was created
      const createdService = await userCaller.services.get({
        id: approvalResult.serviceId!
      })

      expect(createdService).toMatchObject({
        name: `Imported Service ${testSuffix}`,
        status: 'approved',
        dockerImage: 'docker.io/nginx:alpine'
      })

      // Step 6: Service appears in category listings
      const servicesInCategory = await userCaller.categories.services({
        categoryId: category.id,
        limit: 10
      })

      expect(servicesInCategory.services).toContainEqual(
        expect.objectContaining({
          name: `Imported Service ${testSuffix}`,
          status: 'approved'
        })
      )
    })

    it('should handle import rejection workflow', async () => {
      // Setup
      const category = await prisma.category.create({
        data: {
          name: `Reject Category ${testSuffix}`,
          slug: `reject-category-${testSuffix}`,
          description: 'Category for rejection testing'
        }
      })

      // Step 1: Create import to be rejected
      const importResult = await userCaller.imports.create({
        sourceUrl: 'docker.io/malicious:image',
        categoryId: category.id,
        name: `Rejected Service ${testSuffix}`,
        description: 'A service to be rejected'
      })

      // Step 2: Admin rejects import
      const rejectionResult = await adminCaller.admin.reviewImport({
        importId: importResult.id,
        action: 'reject',
        reviewNotes: 'Rejected due to security concerns'
      })

      expect(rejectionResult.success).toBe(true)

      // Step 3: Verify import status updated
      const rejectedImport = await adminCaller.admin.getImportDetails({
        importId: importResult.id
      })

      expect(rejectedImport.import.status).toBe('rejected')

      // Step 4: Verify no service was created
      const servicesInCategory = await userCaller.categories.services({
        categoryId: category.id,
        limit: 10
      })

      expect(servicesInCategory.services).not.toContainEqual(
        expect.objectContaining({
          name: `Rejected Service ${testSuffix}`
        })
      )
    })
  })

  describe('Admin Review Workflow', () => {
    it('should handle bulk import review operations', async () => {
      // Setup: Create multiple imports
      const category = await prisma.category.create({
        data: {
          name: `Bulk Category ${testSuffix}`,
          slug: `bulk-category-${testSuffix}`,
          description: 'Category for bulk testing'
        }
      })

      const imports = await Promise.all([
        userCaller.imports.create({
          sourceUrl: 'docker.io/redis:alpine',
          categoryId: category.id,
          name: `Bulk Import 1 ${testSuffix}`,
          description: 'First bulk import'
        }),
        userCaller.imports.create({
          sourceUrl: 'docker.io/postgres:14',
          categoryId: category.id,
          name: `Bulk Import 2 ${testSuffix}`,
          description: 'Second bulk import'
        })
      ])

      // Workflow: Bulk approval
      const bulkApprovalResult = await adminCaller.admin.bulkReviewImports({
        importIds: imports.map(imp => imp.id),
        action: 'approve',
        reviewNotes: 'Bulk approved for testing'
      })

      expect(bulkApprovalResult.results).toHaveLength(2)
      expect(bulkApprovalResult.results.every(r => r.success)).toBe(true)

      // Verify services were created
      const servicesInCategory = await userCaller.categories.services({
        categoryId: category.id,
        limit: 10
      })

      expect(servicesInCategory.services).toHaveLength(2)
      expect(servicesInCategory.services).toContainEqual(
        expect.objectContaining({
          name: `Bulk Import 1 ${testSuffix}`,
          status: 'approved'
        })
      )
    })

    it('should provide comprehensive admin dashboard data', async () => {
      // Setup: Create test data for dashboard
      const category = await prisma.category.create({
        data: {
          name: `Dashboard Category ${testSuffix}`,
          slug: `dashboard-category-${testSuffix}`,
          description: 'Category for dashboard testing'
        }
      })

      // Create some imports and services
      await userCaller.imports.create({
        sourceUrl: 'docker.io/nginx:latest',
        categoryId: category.id,
        name: `Dashboard Import ${testSuffix}`,
        description: 'Import for dashboard testing'
      })

      await prisma.service.create({
        data: {
          name: `Dashboard Service ${testSuffix}`,
          slug: `dashboard-service-${testSuffix}`,
          description: 'Service for dashboard testing',
          dockerImage: 'nginx:alpine',
          categoryId: category.id,
          status: 'approved'
        }
      })

      // Test admin dashboard
      const dashboardData = await adminCaller.admin.getDashboard()

      expect(dashboardData).toMatchObject({
        pendingImports: expect.any(Number),
        pendingServices: expect.any(Number),
        systemStats: {
          totalServices: expect.any(Number),
          totalImports: expect.any(Number),
          totalCategories: expect.any(Number),
          approvedServices: expect.any(Number)
        },
        recentActivity: expect.any(Array)
      })

      // Test system statistics
      const systemStats = await adminCaller.admin.getSystemStats({
        period: 'week'
      })

      expect(systemStats).toMatchObject({
        overview: {
          totalServices: expect.any(Number),
          totalImports: expect.any(Number),
          totalCategories: expect.any(Number)
        },
        topCategories: expect.any(Array)
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent resource requests gracefully', async () => {
      // Test non-existent category
      await expect(
        userCaller.categories.get({ id: 999999 })
      ).rejects.toThrow('Category not found')

      // Test non-existent service
      await expect(
        userCaller.services.get({ id: 999999 })
      ).rejects.toThrow('Service not found')

      // Test non-existent import
      await expect(
        adminCaller.admin.getImportDetails({ importId: 999999 })
      ).rejects.toThrow('Import not found')
    })

    it('should enforce authorization correctly', async () => {
      // Regular users should not access admin endpoints
      await expect(
        userCaller.admin.getDashboard()
      ).rejects.toThrow('Admin access required')

      await expect(
        userCaller.admin.listImports({})
      ).rejects.toThrow('Admin access required')
    })

    it('should handle concurrent operations correctly', async () => {
      // Create category for concurrent testing
      const category = await prisma.category.create({
        data: {
          name: `Concurrent Category ${testSuffix}`,
          slug: `concurrent-category-${testSuffix}`,
          description: 'Category for concurrent testing'
        }
      })

      // Simulate concurrent import creation
      const concurrentImports = await Promise.allSettled([
        userCaller.imports.create({
          sourceUrl: 'docker.io/redis:1',
          categoryId: category.id,
          name: `Concurrent Import 1 ${testSuffix}`,
          description: 'First concurrent import'
        }),
        userCaller.imports.create({
          sourceUrl: 'docker.io/redis:2',
          categoryId: category.id,
          name: `Concurrent Import 2 ${testSuffix}`,
          description: 'Second concurrent import'
        }),
        userCaller.imports.create({
          sourceUrl: 'docker.io/redis:3',
          categoryId: category.id,
          name: `Concurrent Import 3 ${testSuffix}`,
          description: 'Third concurrent import'
        })
      ])

      // All operations should succeed
      expect(concurrentImports.every(result => result.status === 'fulfilled')).toBe(true)
    })
  })

  describe('Performance and Pagination', () => {
    it('should handle large datasets with proper pagination', async () => {
      // Setup: Create category and many services
      const category = await prisma.category.create({
        data: {
          name: `Large Category ${testSuffix}`,
          slug: `large-category-${testSuffix}`,
          description: 'Category for pagination testing'
        }
      })

      // Create many services for pagination testing
      const serviceData = Array.from({ length: 25 }, (_, i) => ({
        name: `Service ${i} ${testSuffix}`,
        slug: `service-${i}-${testSuffix}`,
        description: `Test service ${i}`,
        dockerImage: `nginx:${i}`,
        categoryId: category.id,
        status: 'approved' as const
      }))

      await prisma.service.createMany({ data: serviceData })

      // Test pagination
      const firstPage = await userCaller.categories.services({
        categoryId: category.id,
        limit: 10
      })

      expect(firstPage.services).toHaveLength(10)
      expect(firstPage.hasMore).toBe(true)
      expect(firstPage.nextCursor).toBeDefined()

      // Test second page
      const secondPage = await userCaller.categories.services({
        categoryId: category.id,
        limit: 10,
        cursor: firstPage.nextCursor!
      })

      expect(secondPage.services).toHaveLength(10)
      expect(secondPage.hasMore).toBe(true)
      
      // Ensure no overlap between pages
      const firstPageIds = firstPage.services.map(s => s.id)
      const secondPageIds = secondPage.services.map(s => s.id)
      const overlap = firstPageIds.filter(id => secondPageIds.includes(id))
      expect(overlap).toHaveLength(0)
    })

    it('should perform basic response time validation', async () => {
      // Create test data
      const category = await prisma.category.create({
        data: {
          name: `Performance Category ${testSuffix}`,
          slug: `performance-category-${testSuffix}`,
          description: 'Category for performance testing'
        }
      })

      // Measure category listing performance
      const startTime = performance.now()
      const categories = await userCaller.categories.list({})
      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(500) // Under 500ms requirement
      expect(categories.categories).toContainEqual(
        expect.objectContaining({
          name: `Performance Category ${testSuffix}`
        })
      )
    })
  })
})