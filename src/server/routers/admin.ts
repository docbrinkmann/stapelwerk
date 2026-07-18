import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { performanceMonitor } from '../../lib/monitoring/performance-monitor'
import { MetadataValidator } from '../../lib/services/metadata-validator'
import { DockerHubExtractor } from '../../lib/services/docker-hub-extractor'

// Admin validation schemas
const reviewImportSchema = z.object({
  importId: z.number().int().positive(),
  action: z.enum(['approve', 'reject']),
  reviewNotes: z.string().min(1).max(1000).optional(),
  adminOverrides: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(1000).optional(),
    categoryId: z.number().int().positive().optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional()
  }).optional()
})

const bulkReviewSchema = z.object({
  importIds: z.array(z.number().int().positive()).min(1).max(50),
  action: z.enum(['approve', 'reject']),
  reviewNotes: z.string().min(1).max(1000).optional()
})

const adminImportListSchema = z.object({
  cursor: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().max(255).optional(),
  categoryId: z.number().int().positive().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'sourceUrl', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeMetadata: z.boolean().default(false)
})

const adminServiceListSchema = z.object({
  cursor: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().max(255).optional(),
  categoryId: z.number().int().positive().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

const updateServiceStatusSchema = z.object({
  serviceId: z.number().int().positive(),
  status: z.enum(['pending', 'approved', 'rejected']),
  adminNotes: z.string().max(1000).optional()
})

const systemStatsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('week')
})

// Helper function to check admin privileges
const ensureAdmin = (user: any) => {
  if (!user || user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required'
    })
  }
}

export const adminRouter = createTRPCRouter({
  // Get pending imports dashboard data
  getDashboard: protectedProcedure.query(async ({ ctx }) => {
    ensureAdmin(ctx.user)

    const [pendingImports, pendingServices, recentActivity, systemStats] = await Promise.all([
      // Pending imports count
      ctx.prisma.service_imports.count({
        where: { status: 'pending' }
      }),

      // Pending services count  
      ctx.prisma.services.count({
        where: { status: 'pending' }
      }),

      // Recent activity (last 7 days)
      ctx.prisma.service_imports.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          sourceUrl: true,
          sourceType: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      // System statistics
      Promise.all([
        ctx.prisma.services.count(),
        ctx.prisma.service_imports.count(),
        ctx.prisma.categories.count(),
        ctx.prisma.services.count({ where: { status: 'approved' } })
      ])
    ])

    return {
      pendingImports,
      pendingServices,
      recentActivity,
      systemStats: {
        totalServices: systemStats[0],
        totalImports: systemStats[1],
        totalCategories: systemStats[2],
        approvedServices: systemStats[3]
      }
    }
  }),

  // List imports with admin filtering and sorting
  listImports: protectedProcedure
    .input(adminImportListSchema)
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const {
        cursor,
        limit,
        status,
        search,
        categoryId,
        sortBy,
        sortOrder,
        includeMetadata
      } = input

      const where: any = {}
      
      if (status) {
        where.status = status
      }

      if (search) {
        where.OR = [
          { sourceUrl: { contains: search } },
          { sourceType: { contains: search } },
          { submittedBy: { contains: search } }
        ]
      }

      // Note: ServiceImport doesn't have categoryId, skip this filter
      // if (categoryId) {
      //   where.categoryId = categoryId
      // }

      if (cursor) {
        where.id = { gt: cursor }
      }

      const orderBy: any = {}
      orderBy[sortBy] = sortOrder

      const imports = await ctx.prisma.service_imports.findMany({
        where,
        orderBy,
        take: limit + 1,
        include: {
          services: {
            select: {
              id: true,
              name: true,
              slug: true,
              categories: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          }
        }
      })

      const hasMore = imports.length > limit
      if (hasMore) {
        imports.pop()
      }

      return {
        imports,
        nextCursor: hasMore ? imports[imports.length - 1].id : null,
        hasMore
      }
    }),

  // Get single import with full details for review
  getImportDetails: protectedProcedure
    .input(z.object({ importId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const serviceImport = await ctx.prisma.service_imports.findUnique({
        where: { id: input.importId },
        include: {
          services: {
            select: {
              id: true,
              name: true,
              slug: true,
              categories: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          }
        }
      })

      if (!serviceImport) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import not found'
        })
      }

      // Run validation on the import
      const validator = new MetadataValidator(ctx.prisma)
      const extractor = new DockerHubExtractor()
      
      let validationResult = null
      let extractedMetadata = null

      try {
        // Re-extract metadata to get latest info
        extractedMetadata = await extractor.extractMetadata(serviceImport.sourceUrl)
        validationResult = await validator.validateMetadata(extractedMetadata, serviceImport.sourceUrl)
      } catch (error) {
        console.error('Failed to re-validate import:', error)
        // Continue without validation if extraction fails
      }

      return {
        import: serviceImport,
        extractedMetadata,
        validationResult
      }
    }),

  // Review a single import (approve/reject)
  reviewImport: protectedProcedure
    .input(reviewImportSchema)
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const { importId, action, reviewNotes, adminOverrides } = input

      // Get the import
      const serviceImport = await ctx.prisma.service_imports.findUnique({
        where: { id: importId }
      })

      if (!serviceImport) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import not found'
        })
      }

      if (serviceImport.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Import has already been reviewed'
        })
      }

      if (action === 'approve') {
        // Create the actual service from the import
        const categoryId = adminOverrides?.categoryId || 1 // Default to category ID 1

        // Ensure category exists
        const category = await ctx.prisma.categories.findUnique({
          where: { id: categoryId }
        })

        if (!category) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid category ID'
          })
        }

        // Parse extracted metadata to get name
        let extractedMetadata
        try {
          extractedMetadata = JSON.parse(serviceImport.extractedMetadata || '{}')
        } catch {
          extractedMetadata = {}
        }
        
        const serviceName = adminOverrides?.name || extractedMetadata.name || 'Imported Service'
        
        // Generate slug
        const baseSlug = serviceName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')

        let slug = baseSlug
        let counter = 1
        while (await ctx.prisma.services.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`
          counter++
        }

        // Create the service
        const service = await ctx.prisma.services.create({
          data: {
            name: serviceName,
            slug,
            description: adminOverrides?.description || extractedMetadata.description || '',
            dockerImage: serviceImport.sourceUrl,
            categoryId,
            status: adminOverrides?.status || 'approved',
            ports: extractedMetadata.exposedPorts ? 
              JSON.stringify(extractedMetadata.exposedPorts) : '[]',
            environmentVariables: extractedMetadata.environmentVariables ?
              JSON.stringify(extractedMetadata.environmentVariables) : '[]',
            updatedAt: new Date()
          }
        })

        // Update import status
        await ctx.prisma.service_imports.update({
          where: { id: importId },
          data: {
            status: 'approved',
            reviewNotes,
            reviewedBy: ctx.user?.id || 'admin',
            serviceId: service.id,
            updatedAt: new Date()
          }
        })

        return { success: true, serviceId: service.id }
      } else {
        // Reject the import
        await ctx.prisma.service_imports.update({
          where: { id: importId },
          data: {
            status: 'rejected',
            reviewNotes,
            reviewedBy: ctx.user?.id || 'admin',
            updatedAt: new Date()
          }
        })

        return { success: true }
      }
    }),

  // Bulk review imports
  bulkReviewImports: protectedProcedure
    .input(bulkReviewSchema)
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const { importIds, action, reviewNotes } = input

      // Validate all imports exist and are pending
      const imports = await ctx.prisma.service_imports.findMany({
        where: {
          id: { in: importIds },
          status: 'pending'
        }
      })

      if (imports.length !== importIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Some imports not found or already reviewed'
        })
      }

      const results = []

      for (const serviceImport of imports) {
        try {
          if (action === 'approve') {
            // Get default category
            const defaultCategory = await ctx.prisma.categories.findFirst({
              where: { name: { contains: 'General' } }
            })

            if (!defaultCategory) {
              throw new Error('Default category not found')
            }

            // Parse extracted metadata
            let extractedMetadata
            try {
              extractedMetadata = JSON.parse(serviceImport.extractedMetadata || '{}')
            } catch {
              extractedMetadata = {}
            }
            
            const serviceName = extractedMetadata.name || 'Imported Service'
            
            // Generate unique slug
            const baseSlug = serviceName
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')

            let slug = baseSlug
            let counter = 1
            while (await ctx.prisma.services.findUnique({ where: { slug } })) {
              slug = `${baseSlug}-${counter}`
              counter++
            }

            // Create service
            const service = await ctx.prisma.services.create({
              data: {
                name: serviceName,
                slug,
                description: extractedMetadata.description || '',
                dockerImage: serviceImport.sourceUrl,
                categoryId: defaultCategory.id,
                status: 'approved',
                ports: extractedMetadata.exposedPorts ? 
                  JSON.stringify(extractedMetadata.exposedPorts) : '[]',
                environmentVariables: extractedMetadata.environmentVariables ?
                  JSON.stringify(extractedMetadata.environmentVariables) : '[]',
                updatedAt: new Date()
              }
            })

            await ctx.prisma.service_imports.update({
              where: { id: serviceImport.id },
              data: {
                status: 'approved',
                reviewNotes,
                reviewedBy: ctx.user?.id || 'admin',
                serviceId: service.id,
                updatedAt: new Date()
              }
            })

            results.push({ importId: serviceImport.id, success: true, serviceId: service.id })
          } else {
            // Reject
            await ctx.prisma.service_imports.update({
              where: { id: serviceImport.id },
              data: {
                status: 'rejected',
                reviewNotes,
                reviewedBy: ctx.user?.id || 'admin',
                updatedAt: new Date()
              }
            })

            results.push({ importId: serviceImport.id, success: true })
          }
        } catch (error) {
          results.push({ 
            importId: serviceImport.id, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      }

      return { results }
    }),

  // List all services with admin controls
  listServices: protectedProcedure
    .input(adminServiceListSchema)
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const {
        cursor,
        limit,
        status,
        search,
        categoryId,
        sortBy,
        sortOrder
      } = input

      const where: any = {}
      
      if (status) {
        where.status = status
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { dockerImage: { contains: search } }
        ]
      }

      if (categoryId) {
        where.categoryId = categoryId
      }

      if (cursor) {
        where.id = { gt: cursor }
      }

      const orderBy: any = {}
      orderBy[sortBy] = sortOrder

      const services = await ctx.prisma.services.findMany({
        where,
        orderBy,
        take: limit + 1,
        include: {
          categories: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })

      const hasMore = services.length > limit
      if (hasMore) {
        services.pop()
      }

      return {
        services,
        nextCursor: hasMore ? services[services.length - 1].id : null,
        hasMore
      }
    }),

  // Update service status
  updateServiceStatus: protectedProcedure
    .input(updateServiceStatusSchema)
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const { serviceId, status, adminNotes } = input

      const service = await ctx.prisma.services.findUnique({
        where: { id: serviceId }
      })

      if (!service) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found'
        })
      }

      const updatedService = await ctx.prisma.services.update({
        where: { id: serviceId },
        data: {
          status,
          updatedAt: new Date()
        },
        include: {
          categories: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })

      return updatedService
    }),

  // Get system statistics
  getSystemStats: protectedProcedure
    .input(systemStatsSchema)
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const { period } = input
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
          break
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          break
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }

      const [
        totalServices,
        totalImports,
        totalCategories,
        pendingImports,
        pendingServices,
        approvedServices,
        rejectedServices,
        recentImports,
        recentServices,
        categoryStats
      ] = await Promise.all([
        ctx.prisma.services.count(),
        ctx.prisma.service_imports.count(),
        ctx.prisma.categories.count(),
        ctx.prisma.service_imports.count({ where: { status: 'pending' } }),
        ctx.prisma.services.count({ where: { status: 'pending' } }),
        ctx.prisma.services.count({ where: { status: 'approved' } }),
        ctx.prisma.services.count({ where: { status: 'rejected' } }),
        ctx.prisma.service_imports.count({
          where: {
            createdAt: { gte: startDate }
          }
        }),
        ctx.prisma.services.count({
          where: {
            createdAt: { gte: startDate }
          }
        }),
        ctx.prisma.categories.findMany({
          include: {
            _count: {
              select: {
                services: {
                  where: { status: 'approved' }
                }
              }
            }
          },
          orderBy: {
            services: {
              _count: 'desc'
            }
          },
          take: 10
        })
      ])

      return {
        overview: {
          totalServices,
          totalImports,
          totalCategories,
          pendingImports,
          pendingServices,
          approvedServices,
          rejectedServices
        },
        recentActivity: {
          period,
          recentImports,
          recentServices
        },
        topCategories: categoryStats.map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          serviceCount: cat._count.services
        }))
      }
    }),

  // Delete import (admin only)
  deleteImport: protectedProcedure
    .input(z.object({ importId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const serviceImport = await ctx.prisma.service_imports.findUnique({
        where: { id: input.importId }
      })

      if (!serviceImport) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import not found'
        })
      }

      if (serviceImport.status === 'approved' && serviceImport.serviceId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete approved import that created a service'
        })
      }

      await ctx.prisma.service_imports.delete({
        where: { id: input.importId }
      })

      return { success: true }
    }),

  // Delete service (admin only)
  deleteService: protectedProcedure
    .input(z.object({ serviceId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const service = await ctx.prisma.services.findUnique({
        where: { id: input.serviceId }
      })

      if (!service) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found'
        })
      }

      await ctx.prisma.services.delete({
        where: { id: input.serviceId }
      })

      return { success: true }
    }),

  // Performance Monitoring Endpoints
  getPerformanceStats: protectedProcedure
    .input(z.object({
      endpoint: z.string().optional()
    }).optional())
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)
      return performanceMonitor.getStats(input?.endpoint)
    }),

  getPerformanceSummary: protectedProcedure
    .query(async ({ ctx }) => {
      ensureAdmin(ctx.user)
      return performanceMonitor.getPerformanceSummary()
    }),

  getSlowRequests: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)
      return performanceMonitor.getSlowRequests(input?.limit || 50)
    }),

  updatePerformanceThresholds: protectedProcedure
    .input(z.object({
      warning: z.number().min(1).optional(),
      critical: z.number().min(1).optional(),
      maximum: z.number().min(1).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)
      performanceMonitor.updateThresholds(input)
      return performanceMonitor.getThresholds()
    }),

  clearPerformanceMetrics: protectedProcedure
    .mutation(async ({ ctx }) => {
      ensureAdmin(ctx.user)
      performanceMonitor.clearMetrics()
      return { success: true, message: 'Performance metrics cleared' }
    }),

  // Template Approval System
  getPendingTemplates: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    }))
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const { page, limit, sortBy, sortOrder } = input
      const skip = (page - 1) * limit

      // Community template proposals are user stacks submitted via
      // stacks.submitForApproval, which flips the stack to
      // status='pending_approval' + isTemplate=true. Surface those here so the
      // existing approval UI can review them.
      const where = { status: 'pending_approval', isTemplate: true }

      const [rawStacks, total] = await Promise.all([
        ctx.prisma.stacks.findMany({
          where,
          include: {
            stack_services: {
              include: {
                services: {
                  select: { id: true, name: true, slug: true }
                }
              },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        ctx.prisma.stacks.count({ where })
      ])

      // Resolve authors (stacks has no direct users relation)
      const userIds = [...new Set(
        rawStacks.map(s => s.userId).filter((id): id is string => !!id)
      )]
      const users = userIds.length
        ? await ctx.prisma.users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true }
          })
        : []
      const userMap = new Map(users.map(u => [u.id, u]))

      // Map to the PendingTemplate shape the approval UI already renders
      const templates = rawStacks.map(stack => {
        const author = stack.userId ? userMap.get(stack.userId) : undefined
        const services = (stack.stack_services ?? [])
          .map((ss: any) => ss.services)
          .filter(Boolean)

        return {
          id: stack.id,
          title: stack.name,
          description: stack.description || '',
          category: 'general',
          difficulty: 'intermediate' as const,
          tags: [] as string[],
          author: {
            id: author?.id || stack.userId || 'unknown',
            name: author?.name || 'Unknown',
            email: author?.email || ''
          },
          services,
          setupInstructions: '',
          requirements: '',
          useCases: [] as string[],
          submittedAt: stack.updatedAt,
          status: 'pending' as const,
          reviewNotes: undefined
        }
      })

      return {
        templates,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }),

  // Approve or reject a submitted stack (community template proposal).
  // Approve publishes the stack (status='public'), which makes it visible via
  // stacks.getPublicTemplates and the community marketplace; reject returns it
  // to the author as a private stack.
  reviewTemplate: protectedProcedure
    .input(z.object({
      stackId: z.string().min(1),
      action: z.enum(['approve', 'reject']),
      reviewNotes: z.string().max(1000).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.user)

      const { stackId, action } = input

      const stack = await ctx.prisma.stacks.findUnique({
        where: { id: stackId },
        select: { id: true, status: true, isTemplate: true }
      })

      if (!stack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template submission not found'
        })
      }

      if (stack.status !== 'pending_approval') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Stack is not pending approval'
        })
      }

      const updated = await ctx.prisma.stacks.update({
        where: { id: stackId },
        data: action === 'approve'
          ? { status: 'public', isPublic: true, isTemplate: true, updatedAt: new Date() }
          // 'rejected' (not 'private') so the author sees the outcome and
          // getTemplateApprovalStats' rejected count matches reality.
          : { status: 'rejected', isPublic: false, updatedAt: new Date() }
      })

      return { success: true, stackId, status: updated.status }
    }),

  getTemplateApprovalStats: protectedProcedure
    .query(async ({ ctx }) => {
      ensureAdmin(ctx.user)

      // Stats for the stack-based template proposal queue. All three are real
      // counts; there is no separate "reviewing" state and no review-timestamp
      // to average, so those fabricated fields are gone.
      const [totalPending, totalApproved, totalRejected] = await Promise.all([
        ctx.prisma.stacks.count({
          where: { status: 'pending_approval', isTemplate: true }
        }),
        ctx.prisma.stacks.count({
          where: { status: 'public', isTemplate: true }
        }),
        ctx.prisma.stacks.count({
          where: { status: 'rejected', isTemplate: true }
        })
      ])

      return { totalPending, totalApproved, totalRejected }
    })
})
