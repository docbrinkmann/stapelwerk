import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, publicProcedure, adminProcedure } from '../trpc'
import {
  ServiceCreateSchema,
  ServiceUpdateSchema,
  ServiceStatus
} from '@/lib/validation/service-catalog-schemas'
import { cacheService } from '@/lib/cache/cache-service'
import { checkImageUpdates } from '@/lib/updates/image-updates'

// Input schemas for service endpoints
const ServiceListInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  categoryId: z.coerce.number().optional(),
  categories: z.array(z.string()).optional(), // Support multiple categories
  status: z.nativeEnum(ServiceStatus).optional(),
  search: z.string().optional(),
  featuredOnly: z.boolean().optional().default(false),
  sortBy: z.enum(['popularity', 'name', 'createdAt', 'updatedAt']).optional() // Support sorting
})

const ServiceGetInputSchema = z.object({
  id: z.coerce.number()
})

const ServiceGetBySlugInputSchema = z.object({
  slug: z.string()
})

const ServiceDeleteInputSchema = z.object({
  id: z.coerce.number()
})

const ServiceApproveInputSchema = z.object({
  id: z.coerce.number(),
  reviewNotes: z.string().optional()
})

const ServiceRejectInputSchema = z.object({
  id: z.coerce.number(),
  reviewNotes: z.string()
})

const ServicePendingInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20)
})

// Advisory image-update check: given the images a stack pins, report whether a
// newer comparable tag exists on Docker Hub. Capped to keep network fan-out sane.
const ServiceImageUpdatesInputSchema = z.object({
  dockerImages: z.array(z.string().min(1)).min(1).max(50)
})

// Response schemas
const ServiceListResponseSchema = z.object({
  services: z.array(z.any()),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.number()
})

const ServiceResponseSchema = z.any()

const DeleteResponseSchema = z.object({
  success: z.boolean()
})

export const servicesRouter = createTRPCRouter({
  // List services with filtering, pagination, and search
  list: publicProcedure
    .input(ServiceListInputSchema.optional().default({ limit: 20, featuredOnly: false }))
    .output(ServiceListResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const {
          cursor,
          limit,
          categoryId,
          categories,
          status,
          search,
          featuredOnly,
          sortBy
        } = input

        // Generate cache key for this specific query
        const cacheKey = cacheService.generateServiceListKey(
          { categoryId, categories, status, search, featuredOnly, sortBy },
          { limit, cursor }
        )

        // Try to get from cache first
        const cachedResult = await cacheService.get(cacheKey)
        if (cachedResult) {
          return cachedResult as { services: any[]; nextCursor: string | null; hasMore: boolean; total: number; }
        }

        // Build filter conditions
        const filters: any = {}

        // Handle category filtering (support both single and multiple)
        if (categories && categories.length > 0) {
          // Multiple categories - need to join with categories table
          filters.categories = {
            slug: { in: categories }
          }
        } else if (categoryId) {
          filters.categoryId = categoryId
        }

        if (status) {
          filters.status = status
        } else {
          // Default to only show approved services for public endpoint
          filters.status = ServiceStatus.APPROVED
        }

        if (featuredOnly) {
          filters.featured = true
        }

        // Handle search
        let searchConditions = {}
        if (search) {
          searchConditions = {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } }
            ]
          }
        }

        // Parse cursor for pagination
        let cursorCondition = {}
        if (cursor) {
          try {
            const cursorId = parseInt(cursor)
            cursorCondition = { id: { lt: cursorId } }
          } catch {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid cursor format'
            })
          }
        }

        // Optionally seed minimal data for E2E when database is empty
        if (process.env.E2E_SEED_ON_EMPTY === '1') {
          const existingCount = await ctx.prisma.services.count()
          if (existingCount === 0) {
            // Ensure categories exist
            const container = await ctx.prisma.categories.upsert({
              where: { slug: 'container' },
              update: {},
              create: { name: 'Container', slug: 'container', description: 'Container services', sortOrder: 1, updatedAt: new Date() },
            })
            const database = await ctx.prisma.categories.upsert({
              where: { slug: 'database' },
              update: {},
              create: { name: 'Database', slug: 'database', description: 'Database services', sortOrder: 2, updatedAt: new Date() },
            })
            await ctx.prisma.services.createMany({
              data: [
                {
                  name: 'Docker', slug: 'docker', description: 'Container platform', dockerImage: 'docker:latest',
                  version: 'latest', categoryId: container.id, ports: '[]', environmentVariables: '[]',
                  resourceRequirements: '{}', compatibilityInfo: '{}', featured: true, status: 'approved', updatedAt: new Date()
                },
                {
                  name: 'PostgreSQL', slug: 'postgresql', description: 'SQL database', dockerImage: 'postgres:16',
                  version: '16', categoryId: database.id, ports: '[]', environmentVariables: '[]',
                  resourceRequirements: '{}', compatibilityInfo: '{}', featured: false, status: 'approved', updatedAt: new Date()
                },
              ]
            })
          }
        }

        // Build orderBy clause based on sortBy parameter
        let orderBy: any = { id: 'desc' } // Default sorting
        if (sortBy) {
          switch (sortBy) {
            case 'popularity':
              // Sort by featured first, then by ID
              orderBy = [{ featured: 'desc' }, { id: 'desc' }]
              break
            case 'name':
              orderBy = { name: 'asc' }
              break
            case 'createdAt':
              orderBy = { createdAt: 'desc' }
              break
            case 'updatedAt':
              orderBy = { updatedAt: 'desc' }
              break
          }
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
          orderBy,
          take: limit + 1 // Fetch one extra to check if there are more
        })

        // Parse JSON fields and transform category object to string
        const parsedServices = services.slice(0, limit).map(service => ({
          ...service,
          category: (service as any).categories?.name || 'Uncategorized',
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

        const result = {
          services: parsedServices,
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
        
        console.error('Error listing services:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch services'
        })
      }
    }),

  // Get single service by ID
  get: publicProcedure
    .input(ServiceGetInputSchema)
    .output(ServiceResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Generate cache key
        const cacheKey = cacheService.generateServiceKey(input.id)

        // Try to get from cache first
        const cachedService = await cacheService.get(cacheKey)
        if (cachedService) {
          return cachedService
        }

        const service = await ctx.prisma.services.findUnique({
          where: { id: input.id },
          include: { categories: true }
        })
        
        if (!service) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found'
          })
        }

        // Parse JSON fields and transform category object to string
        const result = {
          ...service,
          category: (service as any).categories?.name || 'Uncategorized',
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
        }

        // Cache the result
        await cacheService.set(cacheKey, result)

        return result
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error fetching service:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch service'
        })
      }
    }),

  // Get single service by slug
  getBySlug: publicProcedure
    .input(ServiceGetBySlugInputSchema)
    .output(ServiceResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const service = await ctx.prisma.services.findUnique({
          where: { slug: input.slug },
          include: { categories: true }
        })
        
        if (!service) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found'
          })
        }

        // Parse JSON fields and transform category object to string
        return {
          ...service,
          category: (service as any).categories?.name || 'Uncategorized',
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
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error fetching service by slug:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch service'
        })
      }
    }),

  // Create new service
  create: adminProcedure
    .input(ServiceCreateSchema)
    .output(ServiceResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate that category exists
        const categoryExists = await ctx.prisma.categories.findUnique({
          where: { id: input.categoryId }
        })

        if (!categoryExists) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Generate slug from name
        const baseSlug = input.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
        
        // Ensure unique slug
        let slug = baseSlug
        let counter = 1
        while (await ctx.prisma.services.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`
          counter++
        }

        // Create service directly with Prisma
        const service = await ctx.prisma.services.create({
          data: {
            ...input,
            slug,
            status: ServiceStatus.PENDING_REVIEW, // New services start as pending
            // Convert arrays to JSON strings for storage
            ports: input.ports ? JSON.stringify(input.ports) : '[]',
            environmentVariables: input.environmentVariables ? JSON.stringify(input.environmentVariables) : '[]',
            resourceRequirements: input.resourceRequirements ? JSON.stringify(input.resourceRequirements) : '{}',
            compatibilityInfo: input.compatibilityInfo ? JSON.stringify(input.compatibilityInfo) : '{}',
            updatedAt: new Date(),
          },
          include: {
            categories: true
          }
        })

        // Invalidate related caches
        await cacheService.invalidateServiceCaches()
        
        // Parse JSON fields and transform category object to string
        const result = {
          ...service,
          category: (service as any).categories?.name || 'Uncategorized',
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
        }
        
        return result
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        // Handle Prisma constraint violations
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Service with this name already exists'
          })
        }

        // Handle validation errors
        const validationResult = ServiceCreateSchema.safeParse(input)
        
        if (!validationResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid service data',
            cause: validationResult.error
          })
        }
        
        console.error('Error creating service:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create service'
        })
      }
    }),

  // Update existing service
  update: adminProcedure
    .input(ServiceUpdateSchema.extend({ id: z.number() }))
    .output(ServiceResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, ...updateData } = input

        // Check if service exists
        const existingService = await ctx.prisma.services.findUnique({
          where: { id }
        })

        if (!existingService) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found'
          })
        }

        // Convert arrays to JSON strings for storage
        const processedUpdateData: Record<string, any> = {
          ...updateData
        }
        
        if (updateData.ports) {
          processedUpdateData.ports = JSON.stringify(updateData.ports)
        }
        if (updateData.environmentVariables) {
          processedUpdateData.environmentVariables = JSON.stringify(updateData.environmentVariables)
        }
        if (updateData.resourceRequirements) {
          processedUpdateData.resourceRequirements = JSON.stringify(updateData.resourceRequirements)
        }
        if (updateData.compatibilityInfo) {
          processedUpdateData.compatibilityInfo = JSON.stringify(updateData.compatibilityInfo)
        }

        // Update service directly with Prisma
        const updatedService = await ctx.prisma.services.update({
          where: { id },
          data: processedUpdateData,
          include: {
            categories: true
          }
        })

        // Invalidate related caches
        await cacheService.invalidateService(id)
        
        // Parse JSON fields and transform category object to string
        const result = {
          ...updatedService,
          category: (updatedService as any).categories?.name || 'Uncategorized',
          ports: typeof updatedService.ports === 'string' ? JSON.parse(updatedService.ports) : updatedService.ports,
          environmentVariables: typeof updatedService.environmentVariables === 'string' 
            ? JSON.parse(updatedService.environmentVariables) 
            : updatedService.environmentVariables,
          resourceRequirements: typeof updatedService.resourceRequirements === 'string'
            ? JSON.parse(updatedService.resourceRequirements)
            : updatedService.resourceRequirements,
          compatibilityInfo: typeof updatedService.compatibilityInfo === 'string'
            ? JSON.parse(updatedService.compatibilityInfo)
            : updatedService.compatibilityInfo
        }
        
        return result
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        // Handle validation errors
        const validationResult = ServiceUpdateSchema.extend({ id: z.number() }).safeParse(input)
        
        if (!validationResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid update data',
            cause: validationResult.error
          })
        }
        
        console.error('Error updating service:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update service'
        })
      }
    }),

  // Soft delete service (deprecate)
  delete: adminProcedure
    .input(ServiceDeleteInputSchema)
    .output(DeleteResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Check if service exists
        const existingService = await ctx.prisma.services.findUnique({
          where: { id: input.id }
        })

        if (!existingService) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found'
          })
        }

        // Soft delete by updating status to deprecated
        await ctx.prisma.services.update({
          where: { id: input.id },
          data: { status: ServiceStatus.DEPRECATED }
        })

        // Invalidate related caches
        await cacheService.invalidateService(input.id)

        return { success: true }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error deleting service:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete service'
        })
      }
    }),

  // Approve pending service (admin endpoint)
  approve: adminProcedure
    .input(ServiceApproveInputSchema)
    .output(ServiceResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, reviewNotes } = input

        // Check if service exists and is in pending state
        const existingService = await ctx.prisma.services.findUnique({
          where: { id }
        })

        if (!existingService) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found'
          })
        }

        if (existingService.status !== ServiceStatus.PENDING_REVIEW) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Service is not in pending review status'
          })
        }

        // Update service to approved status
        const approvedService = await ctx.prisma.services.update({
          where: { id },
          data: {
            status: ServiceStatus.APPROVED,
            updatedAt: new Date()
          },
          include: {
            categories: true
          }
        })

        // Parse JSON fields and transform category object to string
        return {
          ...approvedService,
          category: (approvedService as any).categories?.name || 'Uncategorized',
          ports: typeof approvedService.ports === 'string' 
            ? JSON.parse(approvedService.ports) 
            : approvedService.ports,
          environmentVariables: typeof approvedService.environmentVariables === 'string'
            ? JSON.parse(approvedService.environmentVariables)
            : approvedService.environmentVariables,
          resourceRequirements: typeof approvedService.resourceRequirements === 'string'
            ? JSON.parse(approvedService.resourceRequirements)
            : approvedService.resourceRequirements,
          compatibilityInfo: typeof approvedService.compatibilityInfo === 'string'
            ? JSON.parse(approvedService.compatibilityInfo)
            : approvedService.compatibilityInfo
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error approving service:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to approve service'
        })
      }
    }),

  // Reject pending service (admin endpoint)
  reject: adminProcedure
    .input(ServiceRejectInputSchema)
    .output(ServiceResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, reviewNotes } = input

        // Check if service exists and is in pending state
        const existingService = await ctx.prisma.services.findUnique({
          where: { id }
        })

        if (!existingService) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found'
          })
        }

        if (existingService.status !== ServiceStatus.PENDING_REVIEW) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Service is not in pending review status'
          })
        }

        // Update service to rejected status
        const rejectedService = await ctx.prisma.services.update({
          where: { id },
          data: {
            status: ServiceStatus.REJECTED,
            updatedAt: new Date()
          },
          include: {
            categories: true
          }
        })

        // Parse JSON fields and transform category object to string
        return {
          ...rejectedService,
          category: (rejectedService as any).categories?.name || 'Uncategorized',
          ports: typeof rejectedService.ports === 'string'
            ? JSON.parse(rejectedService.ports)
            : rejectedService.ports,
          environmentVariables: typeof rejectedService.environmentVariables === 'string'
            ? JSON.parse(rejectedService.environmentVariables)
            : rejectedService.environmentVariables,
          resourceRequirements: typeof rejectedService.resourceRequirements === 'string'
            ? JSON.parse(rejectedService.resourceRequirements)
            : rejectedService.resourceRequirements,
          compatibilityInfo: typeof rejectedService.compatibilityInfo === 'string'
            ? JSON.parse(rejectedService.compatibilityInfo)
            : rejectedService.compatibilityInfo
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error rejecting service:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reject service'
        })
      }
    }),

  // List services pending admin review
  pending: publicProcedure
    .input(ServicePendingInputSchema)
    .output(ServiceListResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { cursor, limit } = input

        // Parse cursor for pagination
        let cursorCondition = {}
        if (cursor) {
          try {
            const cursorId = parseInt(cursor)
            cursorCondition = { id: { lt: cursorId } }
          } catch {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid cursor format'
            })
          }
        }

        // Fetch pending services
        const services = await ctx.prisma.services.findMany({
          where: {
            status: ServiceStatus.PENDING_REVIEW,
            ...cursorCondition
          },
          include: {
            categories: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit + 1 // Fetch one extra to check if there are more
        })

        // Parse JSON fields and transform category object to string
        const parsedServices = services.slice(0, limit).map(service => ({
          ...service,
          category: (service as any).categories?.name || 'Uncategorized',
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

        // Get total count
        const total = await ctx.prisma.services.count({
          where: { status: ServiceStatus.PENDING_REVIEW }
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
        
        console.error('Error fetching pending services:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch pending services'
        })
      }
    }),

  // Advisory: check pinned images for a newer comparable tag on Docker Hub.
  // Runs server-side; resilient by design — a failed lookup yields an
  // "unknown" note per image rather than an error, so it never blocks the UI.
  checkImageUpdates: publicProcedure
    .input(ServiceImageUpdatesInputSchema)
    .query(async ({ input }) => {
      try {
        const results = await checkImageUpdates(input.dockerImages)
        return { results }
      } catch (error) {
        // Whole-batch failure is still non-fatal: the builder treats an empty
        // result set as "update status unavailable".
        console.error('Error checking image updates:', error)
        return { results: [] }
      }
    })
})