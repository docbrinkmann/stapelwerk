import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, publicProcedure, adminProcedure } from '../trpc'
import { cacheService } from '@/lib/cache/cache-service'
import {
  CategoryCreateSchema,
  CategoryUpdateSchema,
  CategoryGetByIdSchema,
  CategoryGetBySlugSchema,
  CategoryListSchema,
  CategoryDeleteSchema,
  CategoryServicesSchema
} from '@/lib/validation/category-schemas'
import { ValidationErrorHandler } from '@/lib/validation/error-handling'

// Response schemas
const CategoryListResponseSchema = z.object({
  categories: z.array(z.any()),
  nextCursor: z.number().nullable(),
  hasMore: z.boolean(),
  total: z.number()
})

const CategoryResponseSchema = z.any()

const DeleteResponseSchema = z.object({
  success: z.boolean()
})

const CategoryStatisticsResponseSchema = z.object({
  totalCategories: z.number(),
  totalServices: z.number(),
  categoriesWithServiceCounts: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    serviceCount: z.number()
  }))
})

export const categoriesRouter = createTRPCRouter({
  // List categories with pagination, search, and service count aggregation
  list: publicProcedure
    .input(CategoryListSchema)
    .output(CategoryListResponseSchema)
    .query(async ({ input, ctx }): Promise<{ categories: any[]; nextCursor: number | null; hasMore: boolean; total: number; }> => {
      try {
        const {
          cursor,
          limit,
          search,
          withServiceCount
        } = input

        // Generate cache key for this specific query
        const cacheKey = cacheService.generateCategoryListKey(
          { search, withServiceCount },
          { limit, cursor }
        )

        // Try to get from cache first
        const cachedResult = await cacheService.get(cacheKey)
        if (cachedResult) {
          return cachedResult as { categories: any[]; nextCursor: number | null; hasMore: boolean; total: number; }
        }

        // Build search conditions
        let searchConditions = {}
        if (search) {
          searchConditions = {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } }
            ]
          }
        }

        // Parse cursor for pagination
        let cursorCondition = {}
        if (cursor) {
          cursorCondition = { id: { gt: cursor } }
        }

        // Fetch categories with pagination
        const categories = await ctx.prisma.categories.findMany({
          where: {
            ...searchConditions,
            ...cursorCondition
          },
          orderBy: [
            { sortOrder: 'asc' },
            { id: 'asc' }
          ],
          take: limit + 1 // Fetch one extra to check if there are more
        })

        // Add service count aggregation if requested
        let categoriesWithCounts = []
        if (withServiceCount) {
          const categoriesSlice = categories.slice(0, limit)
          const categoryIds = categoriesSlice.map(cat => cat.id)
          
          // Get service counts for all categories in one query
          const serviceCounts = await ctx.prisma.services.groupBy({
            by: ['categoryId'],
            where: {
              categoryId: { in: categoryIds },
              status: 'approved' // Only count approved services
            },
            _count: {
              id: true
            }
          })

          // Create a map of category ID to service count
          const countMap = new Map(
            serviceCounts.map(item => [item.categoryId, item._count.id])
          )

          categoriesWithCounts = categoriesSlice.map(category => ({
            ...category,
            serviceCount: countMap.get(category.id) || 0
          }))
        } else {
          categoriesWithCounts = categories.slice(0, limit).map(category => ({
            ...category,
            serviceCount: 0
          }))
        }

        // Determine pagination info
        const hasMore = categories.length > limit
        const nextCursor = hasMore ? categories[limit - 1].id : null

        // Get total count for this query
        const total = await ctx.prisma.categories.count({
          where: searchConditions
        })

        const result = {
          categories: categoriesWithCounts,
          nextCursor,
          hasMore,
          total
        }

        // Cache the result
        await cacheService.set(cacheKey, result)

        return result
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error listing categories:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch categories'
        })
      }
    }),

  // Get single category by ID with service count
  get: publicProcedure
    .input(CategoryGetByIdSchema)
    .output(CategoryResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const category = await ctx.prisma.categories.findUnique({
          where: { id: input.id }
        })
        
        if (!category) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Get service count for this category
        const serviceCount = await ctx.prisma.services.count({
          where: {
            categoryId: category.id,
            status: 'approved'
          }
        })

        return {
          ...category,
          serviceCount
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error fetching category:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch category'
        })
      }
    }),

  // Get single category by slug with service count
  getBySlug: publicProcedure
    .input(CategoryGetBySlugSchema)
    .output(CategoryResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const category = await ctx.prisma.categories.findUnique({
          where: { slug: input.slug }
        })
        
        if (!category) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Get service count for this category
        const serviceCount = await ctx.prisma.services.count({
          where: {
            categoryId: category.id,
            status: 'approved'
          }
        })

        return {
          ...category,
          serviceCount
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error fetching category by slug:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch category'
        })
      }
    }),

  // Create new category
  create: adminProcedure
    .input(CategoryCreateSchema)
    .output(CategoryResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const category = await ctx.prisma.categories.create({
          data: {
            ...input,
            updatedAt: new Date()
          }
        })

        return {
          ...category,
          serviceCount: 0 // New category has no services
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        // Handle Prisma constraint violations
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          const field = error.message.includes('name') ? 'name' : 'slug'
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Category with this ${field} already exists`
          })
        }

        // Handle validation errors
        const validationResult = ValidationErrorHandler.validateSafely(
          CategoryCreateSchema,
          input
        )
        
        if (!validationResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid category data',
            cause: validationResult.error
          })
        }
        
        console.error('Error creating category:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create category'
        })
      }
    }),

  // Update existing category
  update: adminProcedure
    .input(CategoryUpdateSchema)
    .output(CategoryResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, ...updateData } = input

        // Check if category exists
        const existingCategory = await ctx.prisma.categories.findUnique({
          where: { id }
        })

        if (!existingCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Update category
        const updatedCategory = await ctx.prisma.categories.update({
          where: { id },
          data: { ...updateData, updatedAt: new Date() }
        })

        // Get service count for updated category
        const serviceCount = await ctx.prisma.services.count({
          where: {
            categoryId: updatedCategory.id,
            status: 'approved'
          }
        })

        return {
          ...updatedCategory,
          serviceCount
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        // Handle Prisma constraint violations
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Category with this name already exists'
          })
        }

        // Handle validation errors
        const validationResult = ValidationErrorHandler.validateSafely(
          CategoryUpdateSchema,
          input
        )
        
        if (!validationResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid update data',
            cause: validationResult.error
          })
        }
        
        console.error('Error updating category:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update category'
        })
      }
    }),

  // Soft delete category (only if no services are associated)
  delete: adminProcedure
    .input(CategoryDeleteSchema)
    .output(DeleteResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Check if category exists
        const existingCategory = await ctx.prisma.categories.findUnique({
          where: { id: input.id }
        })

        if (!existingCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Check if category has associated services
        const serviceCount = await ctx.prisma.services.count({
          where: { categoryId: input.id }
        })

        if (serviceCount > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot delete category with associated services. Please move or delete services first.'
          })
        }

        // Delete category (hard delete for now, can be changed to soft delete later)
        await ctx.prisma.categories.delete({
          where: { id: input.id }
        })

        return { success: true }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error deleting category:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete category'
        })
      }
    }),

  // Get category statistics with service counts
  statistics: publicProcedure
    .output(CategoryStatisticsResponseSchema)
    .query(async ({ ctx }) => {
      try {
        // Get total category count
        const totalCategories = await ctx.prisma.categories.count()

        // Get total approved service count
        const totalServices = await ctx.prisma.services.count({
          where: { status: 'approved' }
        })

        // Get categories with their service counts
        const categories = await ctx.prisma.categories.findMany({
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' }
          ]
        })

        // Get service counts for all categories
        const serviceCounts = await ctx.prisma.services.groupBy({
          by: ['categoryId'],
          where: {
            status: 'approved'
          },
          _count: {
            id: true
          }
        })

        // Create a map of category ID to service count
        const countMap = new Map(
          serviceCounts.map(item => [item.categoryId, item._count.id])
        )

        const categoriesWithServiceCounts = categories.map(category => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          serviceCount: countMap.get(category.id) || 0
        }))

        return {
          totalCategories,
          totalServices,
          categoriesWithServiceCounts
        }
      } catch (error) {
        console.error('Error fetching category statistics:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch category statistics'
        })
      }
    }),

  // List services in a specific category
  services: publicProcedure
    .input(CategoryServicesSchema)
    .output(z.object({
      services: z.array(z.any()),
      nextCursor: z.string().nullable(),
      hasMore: z.boolean(),
      total: z.number()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const {
          categoryId,
          cursor,
          limit,
          status,
          search
        } = input

        // Check if category exists
        const categoryExists = await ctx.prisma.categories.findUnique({
          where: { id: categoryId }
        })

        if (!categoryExists) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Build filter conditions
        const filters: any = {
          categoryId
        }
        
        if (status) {
          filters.status = status
        } else {
          // Default to only show approved services for public endpoint
          filters.status = 'approved'
        }

        // Handle search
        let searchConditions = {}
        if (search) {
          searchConditions = {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } }
            ]
          }
        }

        // Parse cursor for pagination
        let cursorCondition = {}
        if (cursor) {
          cursorCondition = { id: { lt: cursor } }
        }

        // Fetch services with pagination
        const services = await ctx.prisma.services.findMany({
          where: {
            ...filters,
            ...searchConditions,
            ...cursorCondition
          },
          include: {
            categories: true
          },
          orderBy: {
            id: 'desc'
          },
          take: limit + 1 // Fetch one extra to check if there are more
        })

        // Parse JSON fields
        const parsedServices = services.slice(0, limit).map(service => ({
          ...service,
          ports: typeof service.ports === 'string' ? JSON.parse(service.ports) : service.ports,
          environmentVariables: typeof service.environmentVariables === 'string' 
            ? JSON.parse(service.environmentVariables) 
            : service.environmentVariables,
          resourceRequirements: typeof service.resourceRequirements === 'string'
            ? JSON.parse(service.resourceRequirements)
            : service.resourceRequirements,
          compatibilityInfo: typeof service.compatibilityInfo === 'string'
            ? JSON.parse(service.compatibilityInfo)
            : service.compatibilityInfo
        }))

        // Determine pagination info
        const hasMore = services.length > limit
        const nextCursor = hasMore ? services[limit - 1].id.toString() : null

        // Get total count for this query
        const total = await ctx.prisma.services.count({
          where: {
            ...filters,
            ...searchConditions
          }
        })

        return {
          services: parsedServices,
          nextCursor,
          hasMore,
          total
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error listing category services:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch category services'
        })
      }
    })
})