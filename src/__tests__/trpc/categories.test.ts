import { beforeEach, describe, expect, it } from 'vitest'
import { appRouter } from '../../server/root'
import { categoriesRouter } from '../../server/routers/categories'
import { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { TestDataFactory } from '@/__tests__/helpers/test-data-factory'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
}) as any

// The in-memory harness only emulates the unique-slug constraint. Emulate the
// DB-level unique-name constraint too (categories.name is @unique in
// prisma/schema.prisma) so the constraint tests behave like production.
const rawCategoriesCreate = prisma.categories.create.bind(prisma.categories)
prisma.categories.create = async (args: any) => {
  if (args?.data?.name) {
    const dup = await prisma.categories.findFirst({ where: { name: args.data.name } })
    if (dup) throw new Error('Unique constraint failed on the fields: (`name`)')
  }
  return rawCategoriesCreate(args)
}
const rawCategoriesUpdate = prisma.categories.update.bind(prisma.categories)
prisma.categories.update = async (args: any) => {
  if (args?.data?.name) {
    const dup = await prisma.categories.findFirst({ where: { name: args.data.name } })
    if (dup && dup.id !== args?.where?.id) throw new Error('Unique constraint failed on the fields: (`name`)')
  }
  return rawCategoriesUpdate(args)
}

// Mock context for testing
// Category create/update/delete are admin-gated; these are behavior tests.
const createMockContext = () => ({
  prisma,
  req: {} as any,
  user: { id: 'test-user', role: 'admin' },
  userId: 'test-user'
})

describe('tRPC Category CRUD Endpoints', () => {
  const ctx = createMockContext()
  const caller = appRouter.createCaller(ctx)

  beforeEach(async () => {
    // Clean database before each test
    await prisma.$transaction([
      prisma.serviceImport.deleteMany(),
      prisma.service.deleteMany(),
      prisma.category.deleteMany()
    ])
  })

  describe('Category List Endpoints', () => {
    it('should list categories with default pagination', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      // Create test categories
      const category1 = await prisma.category.create({
        data: {
          name: `Test Category 1 ${uniqueId}`,
          slug: TestDataFactory.generateSlug(`Test Category 1 ${uniqueId}`),          description: 'First test category',
          sortOrder: 1
    }
      })

      const category2 = await prisma.category.create({
        data: {
          name: `Test Category 2 ${uniqueId}`,
          slug: TestDataFactory.generateSlug(`Test Category 2 ${uniqueId}`),          description: 'Second test category',
          sortOrder: 2
    }
      })

      const result = await caller.categories.list({})

      expect(result).toMatchObject({
        categories: expect.arrayContaining([
          expect.objectContaining({
            id: category1.id,
            name: category1.name,            serviceCount: 0
          }),
          expect.objectContaining({
            id: category2.id,
            name: category2.name,            serviceCount: 0
          })
        ]),
        total: 2,
        hasMore: false,
        nextCursor: null
      })
    })

    it('should list categories with service count aggregation', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      // Create test category
      const category = await prisma.category.create({
        data: {
          name: `Category with Services ${uniqueId}`,
          slug: TestDataFactory.generateSlug(`Category with Services ${uniqueId}`),          description: 'Category for service count test',
          sortOrder: 1
    }
      })

      // Create services in the category
      await prisma.service.createMany({
        data: [
          {
            name: `Service 1 ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Service 1 ${uniqueId}`),            description: 'First service',
            dockerImage: 'nginx:1',
            categoryId: category.id,
            status: 'approved'
          },
          {
            name: `Service 2 ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Service 2 ${uniqueId}`),            description: 'Second service',
            dockerImage: 'nginx:2',
            categoryId: category.id,
            status: 'approved'
          },
          {
            name: `Service 3 ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Service 3 ${uniqueId}`),            description: 'Third service (draft)',
            dockerImage: 'nginx:3',
            categoryId: category.id,
            status: 'draft'
          }
        ]
      })

      const result = await caller.categories.list({})

      expect(result.categories).toHaveLength(1)
      expect(result.categories[0]).toMatchObject({
        id: category.id,
        name: category.name,
        serviceCount: 2 // Only approved services should be counted
      })
    })

    it('should filter categories by search term', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      await prisma.category.createMany({
        data: [
          {
            name: `Database Services ${uniqueId}`,            description: 'Database related services'
          },
          {
            name: `Web Servers ${uniqueId}`,            description: 'Web server services'
          }
        ]
      })

      const result = await caller.categories.list({
        search: 'Database'
      })

      expect(result.categories).toHaveLength(1)
      expect(result.categories[0].name).toContain('Database Services')
    })

    it('should paginate categories correctly', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      // Create multiple categories
      const categories = []
      for (let i = 1; i <= 5; i++) {
        const cat = await prisma.category.create({
          data: {
            name: `Category ${i} ${uniqueId}`,
          slug: TestDataFactory.generateSlug(`Category ${i} ${uniqueId}`),            description: `Test category ${i}`,
            sortOrder: i
          }
        })
        categories.push(cat)
      }

      // First page
      const firstPage = await caller.categories.list({
        limit: 2
      })

      expect(firstPage.categories).toHaveLength(2)
      expect(firstPage.hasMore).toBe(true)
      expect(firstPage.nextCursor).toBeDefined()
      expect(firstPage.total).toBe(5)

      // Second page
      const secondPage = await caller.categories.list({
        limit: 2,
        cursor: firstPage.nextCursor!
      })

      expect(secondPage.categories).toHaveLength(2)
      expect(secondPage.hasMore).toBe(true)
      expect(secondPage.categories[0].id).not.toEqual(firstPage.categories[0].id)
    })

    it('should sort categories by sort order', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      await prisma.category.createMany({
        data: [
          {
            name: `Category C ${uniqueId}`,            description: 'Third category',
            sortOrder: 30
    },
          {
            name: `Category A ${uniqueId}`,            description: 'First category',
            sortOrder: 10
    },
          {
            name: `Category B ${uniqueId}`,            description: 'Second category',
            sortOrder: 20
    }
        ]
      })

      const result = await caller.categories.list({})

      // Should be sorted by sortOrder ascending
      expect(result.categories[0].name).toContain('Category A')
      expect(result.categories[1].name).toContain('Category B')
      expect(result.categories[2].name).toContain('Category C')
    })
  })

  describe('Category Get Endpoint', () => {
    it('should get category by ID with service count', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,          description: 'Test category description',
          icon: 'database-icon',
          sortOrder: 5
    }
      })

      const result = await caller.categories.get({ id: category.id })

      expect(result).toMatchObject({
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: category.sortOrder,
        serviceCount: 0
      })
    })

    it('should get category by slug with service count', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,
          slug: `test-category-${uniqueId}`,
          description: 'Test category description'
        }
      })

      const result = await caller.categories.getBySlug({ slug: category.slug })

      expect(result).toMatchObject({
        id: category.id,
        name: category.name,
        serviceCount: 0
      })
    })

    it('should throw NOT_FOUND for non-existent category ID', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,
          slug: `test-category-${uniqueId}`,
          description: 'Test category'
        }
      })

      await expect(caller.categories.get({ id: 99999 }))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.categories.get({ id: 99999 })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })

    it('should throw NOT_FOUND for non-existent category slug', async () => {
      await expect(caller.categories.getBySlug({ slug: 'non-existent-slug' }))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.categories.getBySlug({ slug: 'non-existent-slug' })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('Category Create Endpoint', () => {
    it('should create new category with valid data', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const categoryData = {
        name: `New Category ${uniqueId}`,
        slug: `new-category-${uniqueId}`,
        description: 'A new test category',
        icon: 'new-icon',
        sortOrder: 10
    }

      const result = await caller.categories.create(categoryData)

      expect(result).toMatchObject(categoryData)
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    it('should create category with minimal required fields', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const categoryData = {
        name: `Minimal Category ${uniqueId}`,
        slug: `minimal-category-${uniqueId}`
      }

      const result = await caller.categories.create(categoryData)

      expect(result).toMatchObject(categoryData)
      // In-memory harness leaves never-set optional columns undefined; DB returns null
      expect(result.description ?? null).toBeNull()
      expect(result.icon ?? null).toBeNull()
      expect(result.sortOrder).toBe(0) // Default value
    })

    it('should validate required fields', async () => {
      await expect(caller.categories.create({
        name: '', // Empty name should fail
        slug: 'empty-name'
      })).rejects.toThrow()

      await expect(caller.categories.create({
        name: 'Test Name',
        slug: '' // Empty slug should fail
      })).rejects.toThrow()
    })

    it('should enforce unique name constraint', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const categoryData = {
        name: `Unique Test Category ${uniqueId}`,
        slug: `unique-test-category-${uniqueId}`
      }

      // Create first category
      await caller.categories.create(categoryData)

      // Try to create duplicate with same name but different slug
      await expect(caller.categories.create({
        name: categoryData.name, // Same name
        slug: `duplicate-category-${uniqueId}`
      })).rejects.toThrow()
    })

    it('should enforce unique slug constraint', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const categoryData = {
        name: `Unique Test Category ${uniqueId}`,
        slug: `unique-slug-test-category-${uniqueId}`
      }

      // Create first category
      await caller.categories.create(categoryData)

      // Try to create duplicate with same slug but different name
      await expect(caller.categories.create({
        name: `Different Name ${uniqueId}`, // Different name
        slug: categoryData.slug // Same slug
      })).rejects.toThrow()
    })

    it('should validate slug format', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      // Invalid slug formats should be rejected (only lowercase letters,
      // numbers and single hyphens are allowed)
      await expect(caller.categories.create({
        name: `Test Category ${uniqueId}`,
        slug: `Invalid Slug ${uniqueId}` // Uppercase + spaces
      })).rejects.toThrow()

      await expect(caller.categories.create({
        name: `Test Category ${uniqueId}`,
        slug: `invalid_slug_${uniqueId}` // Underscores
      })).rejects.toThrow()

      await expect(caller.categories.create({
        name: `Test Category ${uniqueId}`,
        slug: `-invalid-slug-${uniqueId}` // Leading hyphen
      })).rejects.toThrow()
    })
  })

  describe('Category Update Endpoint', () => {
    it('should update category with valid data', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Original Category ${uniqueId}`,
          slug: `original-category-${uniqueId}`,
          description: 'Original description',
          sortOrder: 5
    }
      })

      const updateData = {
        name: `Updated Category ${uniqueId}`,
        description: 'Updated description',
        icon: 'updated-icon',
        sortOrder: 15
    }

      const result = await caller.categories.update({
        id: category.id,
        ...updateData
      })

      expect(result).toMatchObject({
        id: category.id,
        slug: category.slug, // Slug should not be updated
        ...updateData
      })
      // >= because create and update can land in the same millisecond
      expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(category.updatedAt.getTime())
    })

    it('should not allow updating slug', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${uniqueId}`,
          slug: `test-category-${uniqueId}`,
          description: 'Test category'
        }
      })

      // Slug should not be in the update schema
      const result = await caller.categories.update({
        id: category.id,
        name: `Updated Name ${uniqueId}`,
        description: 'Updated description'
      })

      expect(result.slug).toBe(category.slug) // Slug unchanged
      expect(result.name).toContain('Updated Name')
    })

    it('should enforce unique name constraint on update', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      // Create two categories
      const category1 = await prisma.category.create({
        data: {
          name: `Category One ${uniqueId}`,
          slug: `category-one-${uniqueId}`
        }
      })

      const category2 = await prisma.category.create({
        data: {
          name: `Category Two ${uniqueId}`,
          slug: `category-two-${uniqueId}`
        }
      })

      // Try to update category2 to have the same name as category1
      await expect(caller.categories.update({
        id: category2.id,
        name: category1.name
      })).rejects.toThrow()
    })

    it('should throw NOT_FOUND for non-existent category', async () => {
      await expect(caller.categories.update({
        id: 99999,
        name: 'Updated Name',
        description: 'Updated description'
      })).rejects.toThrow(TRPCError)
      
      try {
        await caller.categories.update({
          id: 99999,
          name: 'Updated Name'
        })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('Category Delete Endpoint', () => {
    it('should delete category (hard delete)', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Category to Delete ${uniqueId}`,          description: 'Category for deletion test'
        }
      })

      const result = await caller.categories.delete({ id: category.id })

      expect(result.success).toBe(true)

      // Verify category is actually deleted from database (hard delete)
      const deletedCategory = await prisma.category.findUnique({
        where: { id: category.id }
      })

      expect(deletedCategory).toBeNull()
    })

    it('should not delete category with associated services', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Category with Services ${uniqueId}`,          description: 'Category with associated services'
        }
      })

      // Create a service in this category
      await prisma.service.create({
        data: {
          name: `Service in Category ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Service in Category ${uniqueId}`),          description: 'Service in category',
          dockerImage: 'nginx:alpine',
          categoryId: category.id,
          status: 'approved'
        }
      })

      // Should not be able to delete category with services
      await expect(caller.categories.delete({ id: category.id }))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.categories.delete({ id: category.id })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('BAD_REQUEST')
        expect((error as TRPCError).message).toContain('services')
      }
    })

    it('should throw NOT_FOUND for non-existent category', async () => {
      await expect(caller.categories.delete({ id: 99999 }))
        .rejects.toThrow(TRPCError)
      
      try {
        await caller.categories.delete({ id: 99999 })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('Category Statistics Endpoint', () => {
    it('should return category statistics with service counts', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      // Create categories (statistics output validates slug, so set one)
      const webCategory = await prisma.category.create({
        data: {
          name: `Web Servers ${uniqueId}`,
          slug: `web-servers-${uniqueId}`,
          description: 'Web server services'
        }
      })

      const dbCategory = await prisma.category.create({
        data: {
          name: `Databases ${uniqueId}`,
          slug: `databases-${uniqueId}`,
          description: 'Database services'
        }
      })

      // Create services
      await prisma.service.createMany({
        data: [
          {
            name: `Nginx ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Nginx ${uniqueId}`),            description: 'Web server',
            dockerImage: 'nginx:alpine',
            categoryId: webCategory.id,
            status: 'approved'
          },
          {
            name: `Apache ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Apache ${uniqueId}`),            description: 'Web server',
            dockerImage: 'httpd:alpine',
            categoryId: webCategory.id,
            status: 'approved'
          },
          {
            name: `PostgreSQL ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`PostgreSQL ${uniqueId}`),            description: 'Database',
            dockerImage: 'postgres:alpine',
            categoryId: dbCategory.id,
            status: 'approved'
          },
          {
            name: `Pending Service ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Pending Service ${uniqueId}`),            description: 'Pending service',
            dockerImage: 'test:latest',
            categoryId: webCategory.id,
            status: 'pending_review' // Should not be counted
          }
        ]
      })

      const result = await caller.categories.statistics()

      expect(result).toMatchObject({
        totalCategories: 2,
        totalServices: 3, // Only approved services
        categoriesWithServiceCounts: expect.arrayContaining([
          expect.objectContaining({
            id: webCategory.id,
            name: webCategory.name,
            serviceCount: 2
          }),
          expect.objectContaining({
            id: dbCategory.id,
            name: dbCategory.name,
            serviceCount: 1
          })
        ])
      })
    })

    it('should return empty statistics when no data', async () => {
      const result = await caller.categories.statistics()

      expect(result).toMatchObject({
        totalCategories: 0,
        totalServices: 0,
        categoriesWithServiceCounts: []
      })
    })
  })

  describe('Category Services Endpoint', () => {
    it('should list services in a category with pagination', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Category Services Test ${uniqueId}`,          description: 'Category for services listing test'
        }
      })

      // Create services in the category
      await prisma.service.createMany({
        data: [
          {
            name: `Service A ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Service A ${uniqueId}`),            description: 'First service',
            dockerImage: 'nginx:1',
            categoryId: category.id,
            status: 'approved'
          },
          {
            name: `Service B ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Service B ${uniqueId}`),            description: 'Second service',
            dockerImage: 'nginx:2',
            categoryId: category.id,
            status: 'approved'
          }
        ]
      })

      const result = await caller.categories.services({
        categoryId: category.id,
        limit: 10
      })

      expect(result.services).toHaveLength(2)
      expect(result.services).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            categoryId: category.id
          }),
          expect.objectContaining({
            categoryId: category.id
          })
        ])
      )
      expect(result.hasMore).toBe(false)
      expect(result.total).toBe(2)
    })

    it('should filter services by status in category', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15)
      
      const category = await prisma.category.create({
        data: {
          name: `Category Status Filter ${uniqueId}`,          description: 'Category for status filtering test'
        }
      })

      // Create services with different statuses
      await prisma.service.createMany({
        data: [
          {
            name: `Approved Service ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Approved Service ${uniqueId}`),            description: 'Approved service',
            dockerImage: 'nginx:approved',
            categoryId: category.id,
            status: 'approved'
          },
          {
            name: `Pending Service ${uniqueId}`,
            slug: TestDataFactory.generateSlug(`Pending Service ${uniqueId}`),            description: 'Pending service',
            dockerImage: 'nginx:pending',
            categoryId: category.id,
            status: 'pending_review'
          }
        ]
      })

      // Test filtering by approved status
      const approvedResult = await caller.categories.services({
        categoryId: category.id,
        status: 'approved'
      })

      expect(approvedResult.services).toHaveLength(1)
      expect(approvedResult.services[0].status).toBe('approved')

      // Test filtering by pending status
      const pendingResult = await caller.categories.services({
        categoryId: category.id,
        status: 'pending_review'
      })

      expect(pendingResult.services).toHaveLength(1)
      expect(pendingResult.services[0].status).toBe('pending_review')
    })

    it('should throw NOT_FOUND for non-existent category', async () => {
      await expect(caller.categories.services({
        categoryId: 99999
      })).rejects.toThrow(TRPCError)
      
      try {
        await caller.categories.services({ categoryId: 99999 })
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })
})