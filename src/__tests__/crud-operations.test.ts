import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { generateSlug, createCategoryData } from './utils/slug-generator'

const prisma = new PrismaClient()

describe('Database CRUD Operations', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.serviceImport.deleteMany()
    await prisma.service.deleteMany()
    await prisma.category.deleteMany()
  })

  describe('Create Operations', () => {
    it('should create a new category record', async () => {
      const category = await prisma.category.create({
        data: createCategoryData('Test Category', undefined, undefined, 3)
      })
      
      expect(category.id).toBeDefined()
      expect(category.name).toBe('Test Category')
      expect(category.slug).toBe('test-category')
      expect(category.createdAt).toBeDefined()
      expect(category.updatedAt).toBeDefined()
    })

    it('should create multiple category records', async () => {
      const categories = await prisma.category.createMany({
        data: [
          { name: 'Category 1', slug: 'category-1', sortOrder: 1
    },
          { name: 'Category 2', slug: 'category-2', sortOrder: 2
    },
          { name: 'Category 3', slug: 'category-3', sortOrder: 3
    }
        ]
      })
      
      expect(categories.count).toBe(3)
    })
  })

  describe('Read Operations', () => {
    it('should find all categories', async () => {
      // First, create some categories
      await prisma.category.createMany({
        data: [
          { name: 'Category A', slug: 'category-a', sortOrder: 1
    },
          { name: 'Category B', slug: 'category-b', sortOrder: 2
    },
          { name: 'Category C', slug: 'category-c', sortOrder: 3
    }
        ]
      })
      
      const allCategories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' }
      })
      
      expect(allCategories).toHaveLength(3)
      expect(allCategories.map(c => c.name)).toContain('Category A')
      expect(allCategories.map(c => c.name)).toContain('Category B')
      expect(allCategories.map(c => c.name)).toContain('Category C')
    })

    it('should find a specific category by ID', async () => {
      const created = await prisma.category.create({
        data: { name: 'Findable Category', slug: 'findable-category', sortOrder: 1
    }
      })
      
      const found = await prisma.category.findUnique({
        where: { id: created.id }
      })
      
      expect(found).not.toBeNull()
      expect(found?.name).toBe('Findable Category')
      expect(found?.slug).toBe('findable-category')
    })

    it('should find categories with filtering', async () => {
      await prisma.category.createMany({
        data: [
          { name: 'Database Category', slug: 'database-category', sortOrder: 1
    },
          { name: 'Web Category', slug: 'web-category', sortOrder: 2
    },
          { name: 'Database Tools', slug: 'database-tools', sortOrder: 3
    }
        ]
      })
      
      const databaseCategories = await prisma.category.findMany({
        where: {
          name: {
            contains: 'Database'
          }
        }
      })
      
      expect(databaseCategories).toHaveLength(2)
      expect(databaseCategories.every(c => c.name.includes('Database'))).toBe(true)
    })
  })

  describe('Update Operations', () => {
    it('should update an existing category', async () => {
      const created = await prisma.category.create({
        data: createCategoryData('Original Name', null, null, 1)
      })

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      const updated = await prisma.category.update({
        where: { id: created.id },
        data: { name: 'Updated Name' }
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.createdAt.getTime())
    })

    it('should update many categories', async () => {
      await prisma.category.createMany({
        data: [
          { name: 'Test 1', slug: 'test-1', sortOrder: 1
    },
          { name: 'Test 2', slug: 'test-2', sortOrder: 2
    },
          { name: 'Other 1', slug: 'other-1', sortOrder: 3
    }
        ]
      })

      const result = await prisma.category.updateMany({
        where: {
          name: {
            contains: 'Test'
          }
        },
        data: {
          description: 'Updated description'
        }
      })

      expect(result.count).toBe(2)

      const updatedCategories = await prisma.category.findMany({
        where: {
          description: 'Updated description'
        }
      })
      expect(updatedCategories).toHaveLength(2)
    })
  })

  describe('Delete Operations', () => {
    it('should delete a specific category', async () => {
      const created = await prisma.category.create({
        data: createCategoryData('To Be Deleted', null, null, 1)
      })

      await prisma.category.delete({
        where: { id: created.id }
      })

      const found = await prisma.category.findUnique({
        where: { id: created.id }
      })

      expect(found).toBeNull()
    })

    it('should delete many categories', async () => {
      await prisma.category.createMany({
        data: [
          { name: 'Delete 1', slug: 'delete-1', sortOrder: 1
    },
          { name: 'Delete 2', slug: 'delete-2', sortOrder: 2
    },
          { name: 'Keep 1', slug: 'keep-1', sortOrder: 3
    }
        ]
      })

      const result = await prisma.category.deleteMany({
        where: {
          name: {
            contains: 'Delete'
          }
        }
      })

      expect(result.count).toBe(2)

      const remaining = await prisma.category.findMany()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].name).toBe('Keep 1')
    })
  })
})