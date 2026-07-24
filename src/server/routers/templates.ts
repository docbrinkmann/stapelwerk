import { z } from 'zod'
import { createTRPCRouter, publicProcedure, adminProcedure } from '@/server/trpc'
import { TemplateEngine } from '@/server/services/template-engine'
import type { 
  TemplateCategory, 
  TemplateDifficulty, 
  CreateTemplateInput, 
  UpdateTemplateInput,
  TemplateFilters,
  TemplateSearchOptions
} from '@/types/templates'

// Input validation schemas
const templateCategorySchema = z.enum([
  'media', 'development', 'business', 'monitoring', 
  'security', 'networking', 'productivity', 'communication', 
  'storage', 'mixed'
])

const templateDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced'])

const getAllTemplatesSchema = z.object({
  category: templateCategorySchema.optional(),
  difficulty: templateDifficultySchema.optional(),
  featured: z.boolean().optional(),
  includeInactive: z.boolean().default(false),
  minUsageCount: z.number().min(0).optional(),
  createdBy: z.string().optional(),
  dateRange: z.object({
    from: z.date(),
    to: z.date()
  }).optional()
})

const createTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Template name is required').max(100, 'Name too long'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description too long'),
  category: templateCategorySchema,
  difficulty: templateDifficultySchema,
  estimatedSetupTime: z.string().min(1, 'Setup time is required'),
  serviceIds: z.array(z.number().positive()).min(1, 'At least one service is required'),
  metadata: z.object({
    requiredResources: z.object({
      ram: z.string().optional(),
      storage: z.string().optional(),
      cpu: z.string().optional(),
      network: z.string().optional()
    }).optional(),
    tags: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    prerequisites: z.array(z.string()).optional(),
    postSetupSteps: z.array(z.string()).optional(),
    configurationNotes: z.array(z.string()).optional(),
    documentationUrl: z.string().url().optional(),
    tutorialUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    iconUrl: z.string().url().optional(),
    screenshotUrls: z.array(z.string().url()).optional(),
    compatiblePlatforms: z.array(z.enum(['linux', 'windows', 'macos'])).optional(),
    minimumDockerVersion: z.string().optional(),
    networkRequirements: z.object({
      ports: z.array(z.number().positive()).optional(),
      domainRequired: z.boolean().optional(),
      sslRequired: z.boolean().optional()
    }).optional(),
    authorName: z.string().optional(),
    authorUrl: z.string().url().optional(),
    licenseType: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    lastTested: z.date().optional(),
    supportStatus: z.enum(['active', 'maintenance', 'deprecated']).optional(),
    knownIssues: z.array(z.string()).optional(),
    changelog: z.array(z.string()).optional()
  }).optional(),
  createdBy: z.string().optional(),
  featured: z.boolean().default(false)
})

const updateTemplateSchema = z.object({
  id: z.string().min(1, 'Template ID is required'),
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(10).max(1000).optional(),
  category: templateCategorySchema.optional(),
  difficulty: templateDifficultySchema.optional(),
  estimatedSetupTime: z.string().optional(),
  serviceIds: z.array(z.number().positive()).optional(),
  metadata: createTemplateSchema.shape.metadata.optional(),
  featured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  breakingChange: z.boolean().default(false)
})

const searchTemplatesSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  category: templateCategorySchema.optional(),
  difficulty: templateDifficultySchema.optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['popularity', 'rating', 'newest', 'name', 'usage']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

const applyTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  stackId: z.string().min(1, 'Stack ID is required'),
  userId: z.string().optional()
})

const rateTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().max(500, 'Comment too long').optional()
})

const validateTemplateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  serviceIds: z.array(z.number().positive()).optional(),
  category: templateCategorySchema.optional(),
  difficulty: templateDifficultySchema.optional()
})

const getTemplateStatsSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required')
})

export const templatesRouter = createTRPCRouter({
  /**
   * Get all templates with optional filtering
   */
  getAll: publicProcedure
    .input(getAllTemplatesSchema)
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      const filters: TemplateFilters = {
        category: input.category,
        difficulty: input.difficulty,
        featured: input.featured,
        includeInactive: input.includeInactive,
        minUsageCount: input.minUsageCount,
        createdBy: input.createdBy,
        dateRange: input.dateRange
      }

      return await templateEngine.getAllTemplates(filters)
    }),

  /**
   * Get a specific template by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().min(1, 'Template ID is required') }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      const template = await templateEngine.getTemplateById(input.id)
      if (!template) {
        throw new Error('Template not found')
      }

      // Fetch complete service details
      const services = await ctx.prisma.services.findMany({
        where: { 
          id: { in: template.serviceIds },
          status: 'approved'
        },
        include: { categories: true }
      })

      return {
        ...template,
        services
      }
    }),

  /**
   * Get featured templates
   */
  getFeatured: publicProcedure
    .input(z.object({ 
      limit: z.number().min(1).max(20).default(6) 
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      return await templateEngine.getAllTemplates({
        featured: true,
        includeInactive: false
      })
    }),

  /**
   * Get templates by category
   */
  getByCategory: publicProcedure
    .input(z.object({
      category: templateCategorySchema,
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      return await templateEngine.getAllTemplates({
        category: input.category,
        includeInactive: false
      })
    }),

  /**
   * Search templates
   */
  search: publicProcedure
    .input(searchTemplatesSchema)
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      const options: TemplateSearchOptions = {
        category: input.category,
        difficulty: input.difficulty,
        limit: input.limit,
        offset: input.offset,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder
      }

      return await templateEngine.searchTemplates(input.query, options)
    }),

  /**
   * Create a new template
   */
  create: adminProcedure
    .input(createTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      // Validate template data first
      const validation = await templateEngine.validateTemplate(input)
      if (!validation.isValid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`)
      }

      return await templateEngine.createTemplate(input as CreateTemplateInput)
    }),

  /**
   * Update an existing template
   */
  update: adminProcedure
    .input(updateTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      const { id, ...updateData } = input
      
      return await templateEngine.updateTemplate(id, updateData as UpdateTemplateInput)
    }),

  /**
   * Apply a template to a stack
   */
  applyToStack: publicProcedure
    .input(applyTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      const result = await templateEngine.applyTemplateToStack(
        input.templateId,
        input.stackId,
        input.userId
      )

      return result
    }),

  /**
   * Rate a template
   */
  rate: publicProcedure
    .input(rateTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      return await templateEngine.rateTemplate(input)
    }),

  /**
   * Get template usage statistics
   */
  getStats: publicProcedure
    .input(getTemplateStatsSchema)
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      return await templateEngine.getTemplateUsageStats(input.templateId)
    }),

  /**
   * Validate template data
   */
  validate: publicProcedure
    .input(validateTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      return await templateEngine.validateTemplate(input)
    }),

  /**
   * Initialize curated templates (admin function)
   */
  initializeCurated: adminProcedure
    .mutation(async ({ ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      try {
        await templateEngine.initializeCuratedTemplates()
        return {
          success: true,
          message: 'Curated templates initialized successfully'
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to initialize templates: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }),

  /**
   * Get popular templates based on usage
   */
  getPopular: publicProcedure
    .input(z.object({ 
      limit: z.number().min(1).max(20).default(10),
      category: templateCategorySchema.optional()
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      return await templateEngine.getAllTemplates({
        category: input.category,
        includeInactive: false,
        minUsageCount: 1
      })
    }),

  /**
   * Get template recommendations compatible with either a stackId OR a list of current service IDs
   */
  getRecommendations: publicProcedure
    .input(z.union([
      z.object({
        stackId: z.string().min(1, 'Stack ID is required'),
        limit: z.number().min(1).max(10).default(5)
      }),
      z.object({
        currentServices: z.array(z.number().positive()).min(1, 'At least one service required'),
        maxResults: z.number().min(1).max(10).default(5),
        includePersonalized: z.boolean().optional()
      })
    ]))
    .query(async ({ input, ctx }) => {
      // Resolve service IDs based on provided input shape
      let serviceIds: number[] = []
      let limit = 5

      if ('stackId' in input) {
        limit = input.limit ?? 5
        const stackServices = await ctx.prisma.stack_services.findMany({
          where: { stackId: input.stackId },
          select: { serviceId: true }
        })
        serviceIds = stackServices.map(s => s.serviceId)
      } else {
        limit = input.maxResults ?? 5
        serviceIds = input.currentServices
      }

      if (serviceIds.length === 0) return []

      const templateEngine = new TemplateEngine(ctx.prisma)
      const allTemplates = await templateEngine.getAllTemplates({ includeInactive: false })

      const recommendations = allTemplates.map(template => {
        const commonServices = template.serviceIds.filter(id => serviceIds.includes(id))
        const uniqueServices = template.serviceIds.filter(id => !serviceIds.includes(id))
        const compatibilityScore = template.serviceIds.length > 0 ? (commonServices.length / template.serviceIds.length) : 0
        const extensionValue = template.serviceIds.length > 0 ? (uniqueServices.length / template.serviceIds.length) : 0
        const overallScore = (compatibilityScore * 0.6) + (extensionValue * 0.4)
        return {
          template,
          score: overallScore,
          reason: `${commonServices.length} services in common, adds ${uniqueServices.length} new services`,
          matchingServices: commonServices,
          newServices: uniqueServices
        }
      })
      .filter(rec => rec.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

      return recommendations
    }),

  /**
   * Get template categories with counts
   */
  getCategories: publicProcedure
    .query(async ({ ctx }) => {
      const categoryStats = await ctx.prisma.use_case_templates.groupBy({
        by: ['category'],
        _count: { category: true },
        where: { isActive: true }
      })

      return categoryStats.map(stat => ({
        category: stat.category,
        count: stat._count.category
      }))
    }),

  /**
   * Get template usage history for analytics
   */
  getUsageHistory: publicProcedure
    .input(z.object({
      templateId: z.string().min(1, 'Template ID is required'),
      days: z.number().min(1).max(365).default(30)
    }))
    .query(async ({ input, ctx }) => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - input.days)

      const usage = await ctx.prisma.template_usage.findMany({
        where: {
          templateId: input.templateId,
          createdAt: { gte: cutoffDate }
        },
        orderBy: { createdAt: 'desc' }
      })

      return usage
    }),

  /**
   * Delete a template (admin function)
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().min(1, 'Template ID is required') }))
    .mutation(async ({ input, ctx }) => {
      // Soft delete by setting isActive to false
      await ctx.prisma.use_case_templates.update({
        where: { id: input.id },
        data: { isActive: false }
      })

      return {
        success: true,
        message: 'Template deleted successfully'
      }
    }),

  /**
   * Bulk operations for templates
   */
  bulkUpdate: adminProcedure
    .input(z.object({
      templateIds: z.array(z.string()).min(1, 'At least one template ID required'),
      updates: z.object({
        featured: z.boolean().optional(),
        isActive: z.boolean().optional(),
        category: templateCategorySchema.optional()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.use_case_templates.updateMany({
        where: { id: { in: input.templateIds } },
        data: input.updates
      })

      return {
        success: true,
        updatedCount: input.templateIds.length,
        message: `${input.templateIds.length} templates updated successfully`
      }
    }),

  // Version Management Endpoints

  /**
   * Get all versions of a template
   */
  getVersions: publicProcedure
    .input(z.object({ templateId: z.string().min(1, 'Template ID is required') }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.getTemplateVersions(input.templateId)
    }),

  /**
   * Get specific template version
   */
  getVersion: publicProcedure
    .input(z.object({
      templateId: z.string().min(1, 'Template ID is required'),
      version: z.string().min(1, 'Version is required')
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.getTemplateVersion(input.templateId, input.version)
    }),

  /**
   * Compare two template versions
   */
  compareVersions: publicProcedure
    .input(z.object({
      templateId: z.string().min(1, 'Template ID is required'),
      version1: z.string().min(1, 'First version is required'),
      version2: z.string().min(1, 'Second version is required')
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.compareVersions(input.templateId, input.version1, input.version2)
    }),

  /**
   * Rollback template to previous version
   */
  rollback: adminProcedure
    .input(z.object({
      templateId: z.string().min(1, 'Template ID is required'),
      targetVersion: z.string().min(1, 'Target version is required'),
      createdBy: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.rollbackTemplate(
        input.templateId,
        input.targetVersion,
        input.createdBy
      )
    }),

  /**
   * Fork/copy a template
   */
  fork: publicProcedure
    .input(z.object({
      sourceTemplateId: z.string().min(1, 'Source template ID is required'),
      newName: z.string().min(1, 'New name is required'),
      newId: z.string().optional(),
      createdBy: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.forkTemplate(
        input.sourceTemplateId,
        input.newName,
        input.newId,
        input.createdBy
      )
    }),

  /**
   * Generate migration plan between versions
   */
  generateMigrationPlan: publicProcedure
    .input(z.object({
      templateId: z.string().min(1, 'Template ID is required'),
      fromVersion: z.string().min(1, 'From version is required'),
      toVersion: z.string().min(1, 'To version is required')
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.generateMigrationPlan(
        input.templateId,
        input.fromVersion,
        input.toVersion
      )
    }),

  /**
   * Apply migration plan
   */
  applyMigration: publicProcedure
    .input(z.object({
      templateId: z.string().min(1, 'Template ID is required'),
      stackId: z.string().min(1, 'Stack ID is required'),
      migrationPlan: z.object({
        fromVersion: z.string(),
        toVersion: z.string(),
        steps: z.array(z.object({
          type: z.string(),
          serviceId: z.number().optional(),
          serviceName: z.string().optional(),
          description: z.string(),
          required: z.boolean(),
          impact: z.string()
        })),
        automatic: z.boolean(),
        estimatedTime: z.string()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.applyMigration(
        input.templateId,
        input.stackId,
        input.migrationPlan
      )
    }),

  /**
   * Get template history/changelog
   */
  getHistory: publicProcedure
    .input(z.object({
      templateId: z.string().min(1, 'Template ID is required'),
      limit: z.number().min(1).max(50).default(20)
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.getTemplateHistory(input.templateId, input.limit)
    }),

  /**
   * Check for template updates
   */
  checkForUpdates: publicProcedure
    .input(z.object({ templateId: z.string().min(1, 'Template ID is required') }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.checkForUpdates(input.templateId)
    }),

  // Popularity and Community Features

  /**
   * Get trending templates
   */
  getTrending: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(10) }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.getTrendingTemplates(input.limit)
    }),

  /**
   * Get top rated templates
   */
  getTopRated: publicProcedure
    .input(z.object({ 
      limit: z.number().min(1).max(20).default(10),
      minRatings: z.number().min(1).default(3)
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.getTopRatedTemplates(input.limit, input.minRatings)
    }),

  /**
   * Get community insights and statistics
   */
  getCommunityInsights: publicProcedure
    .query(async ({ ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.getCommunityInsights()
    }),

  /**
   * Advanced rating with helpful votes
   */
  rateAdvanced: publicProcedure
    .input(rateTemplateSchema.extend({
      helpful: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.rateTemplateAdvanced(input)
    }),

  /**
   * Mark a rating as helpful
   */
  markRatingHelpful: publicProcedure
    .input(z.object({
      ratingId: z.string().min(1, 'Rating ID is required'),
      userId: z.string().min(1, 'User ID is required')
    }))
    .mutation(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.markRatingHelpful(input.ratingId, input.userId)
    }),

  /**
   * Get detailed rating analysis
   */
  getRatingAnalysis: publicProcedure
    .input(z.object({ templateId: z.string().min(1, 'Template ID is required') }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.getTemplateRatingAnalysis(input.templateId)
    }),

  /**
   * Get personalized recommendations for user
   */
  getPersonalizedRecommendations: publicProcedure
    .input(z.object({
      userId: z.string().min(1, 'User ID is required'),
      limit: z.number().min(1).max(10).default(5)
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      return await templateEngine.getPersonalizedRecommendations(input.userId, input.limit)
    }),

  /**
   * Get template analytics dashboard data
   */
  getAnalyticsDashboard: publicProcedure
    .input(z.object({
      templateId: z.string().optional(),
      days: z.number().min(1).max(365).default(30)
    }))
    .query(async ({ input, ctx }) => {
      const templateEngine = new TemplateEngine(ctx.prisma)
      
      if (input.templateId) {
        // Get specific template analytics
        const [stats, analysis, history] = await Promise.all([
          templateEngine.getTemplateUsageStats(input.templateId),
          templateEngine.getTemplateRatingAnalysis(input.templateId),
          templateEngine.getTemplateHistory(input.templateId, 10)
        ])
        
        return {
          templateId: input.templateId,
          stats,
          ratingAnalysis: analysis,
          recentHistory: history
        }
      } else {
        // Get overall analytics
        const [insights, trending, topRated] = await Promise.all([
          templateEngine.getCommunityInsights(),
          templateEngine.getTrendingTemplates(5),
          templateEngine.getTopRatedTemplates(5)
        ])
        
        return {
          communityInsights: insights,
          trending,
          topRated
        }
      }
    }),

  /**
   * Get template performance metrics
   */
  getPerformanceMetrics: publicProcedure
    .input(z.object({
      templateIds: z.array(z.string()).optional(),
      category: templateCategorySchema.optional(),
      days: z.number().min(1).max(365).default(30)
    }))
    .query(async ({ input, ctx }) => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - input.days)
      
      const whereClause: any = {
        createdAt: { gte: cutoffDate },
        template: { isActive: true }
      }
      
      if (input.templateIds) {
        whereClause.templateId = { in: input.templateIds }
      }
      
      if (input.category) {
        whereClause.template = { 
          ...whereClause.template,
          category: input.category 
        }
      }
      
      // Get usage metrics
      const [usageStats, successRate, dailyUsage] = await Promise.all([
        ctx.prisma.template_usage.groupBy({
          by: ['templateId'],
          _count: { templateId: true },
          _avg: { servicesAdded: true },
          where: whereClause
        }),
        
        ctx.prisma.template_usage.groupBy({
          by: ['templateId'],
          _count: { successful: true },
          where: {
            ...whereClause,
            successful: true
          }
        }),
        
        ctx.prisma.template_usage.groupBy({
          by: ['createdAt'],
          _count: { templateId: true },
          where: whereClause,
          orderBy: { createdAt: 'asc' }
        })
      ])
      
      return {
        period: `${input.days} days`,
        usageStats,
        successRate,
        dailyUsage
      }
    })
})

export type TemplatesRouter = typeof templatesRouter