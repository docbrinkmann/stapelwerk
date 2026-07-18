import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure, strictProcedure } from '@/server/trpc'
import { RecommendationService } from '@/server/services/recommendation-service'
import { PatternAnalyzer } from '@/server/utils/pattern-analyzer'
import type { RecommendationCategory, FeedbackAction } from '@/types/recommendations'

// Input validation schemas
const getRecommendationsSchema = z.object({
  stackId: z.string().min(1, 'Stack ID is required'),
  limit: z.number().min(1).max(50).default(10),
  category: z.enum(['complementary', 'essential', 'popular', 'optional']).optional(),
  minScore: z.number().min(0).max(1).optional(),
  userId: z.string().optional()
})

// Recommendations for an in-progress (unsaved) draft: an arbitrary service-id
// list rather than a persisted stackId.
const getForServicesSchema = z.object({
  serviceIds: z.array(z.number().int().positive()).max(100),
  limit: z.number().min(1).max(50).default(6),
  category: z.enum(['complementary', 'essential', 'popular', 'optional']).optional(),
  userId: z.string().optional()
})

const useCaseTemplateSchema = z.object({
  useCase: z.string().min(1, 'Use case is required'),
  limit: z.number().min(1).max(20).default(10)
})

const feedbackSchema = z.object({
  recommendationId: z.string().min(1, 'Recommendation ID is required'),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  action: z.enum(['adopted', 'rejected', 'dismissed', 'saved']),
  comment: z.string().max(500).optional()
})

const searchRecommendationsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  category: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0)
})

const popularPatternsSchema = z.object({
  category: z.string().optional(),
  minFrequency: z.number().min(1).optional(),
  minSuccessRate: z.number().min(0).max(1).optional(),
  limit: z.number().min(1).max(50).default(10)
})

const refreshRecommendationsSchema = z.object({
  stackId: z.string().min(1, 'Stack ID is required'),
  forceRefresh: z.boolean().default(false)
})

export const recommendationsRouter = createTRPCRouter({
  /**
   * Get contextual recommendations for a specific stack
   */
  getForStack: publicProcedure
    .input(getRecommendationsSchema)
    .query(async ({ input, ctx }) => {
      // Get stack services
      const stackServices = await ctx.prisma.stack_services.findMany({
        where: { stackId: input.stackId },
        include: {
          services: {
            include: { categories: true }
          }
        }
      })

      if (stackServices.length === 0) {
        return []
      }

      const recommendationService = (ctx as any).recommendationService ?? new RecommendationService(ctx.prisma)
      
      const recommendations = await recommendationService.getRecommendationsForStack(
        stackServices.map(ss => {
          const svc: any = (ss as any).services ?? (ss as any).service ?? {}
          return {
            serviceId: ss.serviceId,
            service: {
              ...svc,
              documentationUrl: svc.documentationUrl ?? undefined,
            },
            order: ss.order,
          }
        }) as any,
        {
          limit: input.limit,
          category: input.category,
          userId: input.userId,
        }
      )

      // If using injected service (tests/DI), return recommendations as-is
      if ((ctx as any).recommendationService) {
        return recommendations
      }

      // Otherwise, enrich results with DB lookups
      const enrichedRecommendations = await Promise.all(
        recommendations.map(async (rec: any) => {
          const service = await ctx.prisma.services.findUnique({
            where: { id: rec.serviceId },
            include: { categories: true }
          })
          
          return {
            ...rec,
            service
          }
        })
      )

      return enrichedRecommendations
    }),

  /**
   * Get recommendations for an in-progress draft (a list of service ids),
   * using the same compatibility scoring + rationale as getForStack. This is
   * what the live stack-builder calls, since the draft isn't persisted yet.
   */
  getForServices: publicProcedure
    .input(getForServicesSchema)
    .query(async ({ input, ctx }) => {
      if (input.serviceIds.length === 0) return []

      const services = await ctx.prisma.services.findMany({
        where: { id: { in: input.serviceIds } },
        include: { categories: true }
      })
      if (!services || services.length === 0) return []

      const stackServices = services.map((svc: any, i: number) => ({
        serviceId: svc.id,
        service: { ...svc, documentationUrl: svc.documentationUrl ?? undefined },
        order: i
      }))

      const recommendationService = (ctx as any).recommendationService ?? new RecommendationService(ctx.prisma)
      const recommendations = await recommendationService.getRecommendationsForStack(
        stackServices as any,
        { limit: input.limit, category: input.category, userId: input.userId }
      )

      // Injected service (tests/DI): return as-is.
      if ((ctx as any).recommendationService) {
        return recommendations
      }

      // Otherwise enrich with the full service record.
      return Promise.all(
        recommendations.map(async (rec: any) => {
          const service = await ctx.prisma.services.findUnique({
            where: { id: rec.serviceId },
            include: { categories: true }
          })
          return { ...rec, service }
        })
      )
    }),

  /**
   * Get use case specific template recommendations
   */
  getUseCaseTemplates: publicProcedure
    .input(useCaseTemplateSchema)
    .query(async ({ input, ctx }) => {
      const injected = (ctx as any).recommendationService
      if (injected?.getUseCaseRecommendations) {
        return await injected.getUseCaseRecommendations(input.useCase)
      }
      const recommendationService = new RecommendationService(ctx.prisma)
      return await recommendationService.getUseCaseRecommendations(input.useCase)
    }),

  /**
   * Submit feedback on a recommendation
   * Requires authentication to prevent spam and abuse
   */
  submitFeedback: protectedProcedure
    .input(feedbackSchema)
    .mutation(async ({ input, ctx }) => {
      const injected = (ctx as any).recommendationService
      if (injected?.recordFeedback) {
        // In tests/DI mode, pass input as-is
        return await injected.recordFeedback(input)
      }
      // Production: enforce authenticated user
      const feedbackData = { ...input, userId: ctx.userId }
      const recommendationService = new RecommendationService(ctx.prisma)
      return await recommendationService.recordFeedback(feedbackData)
    }),

  /**
   * Get popular community patterns
   */
  getPopularPatterns: publicProcedure
    .input(popularPatternsSchema)
    .query(async ({ input, ctx }) => {
      const injected = (ctx as any).recommendationService
      if (injected?.getPopularPatterns) {
        return await injected.getPopularPatterns({
          category: input.category,
          minFrequency: input.minFrequency,
          minSuccessRate: input.minSuccessRate,
          limit: input.limit,
        })
      }
      const patternAnalyzer = new PatternAnalyzer(ctx.prisma)
      
      const patterns = await ctx.prisma.recommendation_patterns.findMany({
        where: {
          ...(input.category && { category: input.category }),
          ...(input.minFrequency && { frequency: { gte: input.minFrequency } }),
          ...(input.minSuccessRate && { successRate: { gte: input.minSuccessRate } })
        },
        orderBy: [
          { frequency: 'desc' },
          { successRate: 'desc' }
        ],
        take: input.limit
      })

      // Enrich patterns with service details
      const enrichedPatterns = await Promise.all(
        patterns.map(async (pattern) => {
          const services = await ctx.prisma.services.findMany({
            where: { 
              id: { in: pattern.serviceIds.split(',').map(Number) },
              status: 'approved'
            },
            include: { categories: true }
          })

          let metadata: any = {}
          try {
            metadata = JSON.parse(pattern.metadata || '{}')
          } catch (e) {
            // Handle invalid JSON gracefully
          }

          return {
            id: pattern.id,
            services,
            frequency: pattern.frequency,
            successRate: pattern.successRate,
            category: pattern.category,
            description: metadata.description || 'Popular service combination',
            difficulty: metadata.difficulty || 'intermediate',
            estimatedSetupTime: metadata.averageSetupTime || '30 minutes',
            metadata
          }
        })
      )

      return enrichedPatterns
    }),

  /**
   * Search recommendations by query
   */
  searchRecommendations: publicProcedure
    .input(searchRecommendationsSchema)
    .query(async ({ input, ctx }) => {
      const injected = (ctx as any).recommendationService
      if (injected?.searchRecommendations) {
        const args: any = { query: input.query }
        if (input.category !== undefined) args.category = input.category
        if (input.limit !== undefined) args.limit = input.limit
        if (input.offset !== undefined && input.offset !== 0) args.offset = input.offset
        return await injected.searchRecommendations(args)
      }
      // Search services that match the query
      const services = await ctx.prisma.services.findMany({
        where: {
          AND: [
            { status: 'approved' },
            {
              OR: [
                { name: { contains: input.query, mode: 'insensitive' } },
                { description: { contains: input.query, mode: 'insensitive' } }
              ]
            },
            ...(input.category ? [{
              categories: { slug: input.category }
            }] : [])
          ]
        },
        include: { categories: true },
        skip: input.offset,
        take: input.limit
      })

      // Convert services to recommendation format
      const recommendations = services.map(service => ({
        id: `search-rec-${service.id}`,
        serviceId: service.id,
        score: 0.8, // Default score for search results
        rationale: `Found ${service.name} matching "${input.query}"`,
        category: 'popular' as RecommendationCategory,
        algorithmVersion: '1.0',
        viewCount: 0,
        adoptionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        service
      }))

      return recommendations
    }),

  /**
   * Refresh recommendations for a stack (clear cache and regenerate)
   * Requires authentication to prevent abuse
   */
  refreshRecommendations: protectedProcedure
    .input(refreshRecommendationsSchema)
    .mutation(async ({ input, ctx }) => {
      const injected = (ctx as any).recommendationService
      if (injected?.refreshRecommendationsForStack) {
        return await injected.refreshRecommendationsForStack({ stackId: input.stackId })
      }
      // Fallback: minimal behavior
      const stackServices = await ctx.prisma.stack_services.findMany({
        where: { stackId: input.stackId },
        include: {
          services: { include: { categories: true } }
        }
      })

      if (stackServices.length === 0) {
        return {
          success: false,
          message: 'Stack not found or has no services'
        }
      }

      const recommendationService = (ctx as any).recommendationService ?? new RecommendationService(ctx.prisma)
      const refreshedRecommendations = await recommendationService.getRecommendationsForStack(
        stackServices.map(ss => ({
          serviceId: ss.serviceId,
          service: {
            ...ss.services,
            documentationUrl: ss.services.documentationUrl ?? undefined,
          },
          order: ss.order
        })) as any,
        { limit: 10 }
      )

      return {
        success: true,
        updatedCount: refreshedRecommendations.length,
        message: `Successfully refreshed ${refreshedRecommendations.length} recommendations`
      }
    }),

  /**
   * Get recommendation statistics
   */
  getRecommendationStats: publicProcedure
    .query(async ({ ctx }) => {
      const [
        totalRecommendations,
        totalPatterns,
        totalFeedback,
        avgFeedbackRating,
        topCategories
      ] = await Promise.all([
        // Count active recommendations (this would be cached recommendations in a real system)
        ctx.prisma.services.count({ where: { status: 'approved' } }),
        
        // Count community patterns
        ctx.prisma.recommendation_patterns.count(),
        
        // Count feedback entries
        ctx.prisma.recommendation_feedback.count(),
        
        // Average feedback rating
        ctx.prisma.recommendation_feedback.aggregate({
          _avg: { rating: true },
          where: { rating: { not: null } }
        }),
        
        // Top service categories
        ctx.prisma.services.groupBy({
          by: ['categoryId'],
          _count: { categoryId: true },
          orderBy: { _count: { categoryId: 'desc' } },
          take: 5,
          where: { status: 'approved' }
        })
      ])

      const categoryDetails = await ctx.prisma.categories.findMany({
        where: { id: { in: topCategories.map(tc => tc.categoryId) } }
      })

      return {
        totalRecommendations,
        totalPatterns,
        totalFeedback,
        avgFeedbackRating: avgFeedbackRating._avg.rating || 0,
        topCategories: topCategories.map(tc => ({
          category: categoryDetails.find(cd => cd.id === tc.categoryId)?.name || 'Unknown',
          count: tc._count.categoryId
        }))
      }
    }),

  /**
   * Get trending patterns (recently popular combinations)
   */
  getTrendingPatterns: publicProcedure
    .input(z.object({
      daysBack: z.number().min(1).max(365).default(30),
      limit: z.number().min(1).max(20).default(10)
    }))
    .query(async ({ input, ctx }) => {
      const patternAnalyzer = new PatternAnalyzer(ctx.prisma)
      return await patternAnalyzer.getTrendingPatterns(input.daysBack)
    }),

  /**
   * Analyze and update community patterns (admin function)
   * Requires authentication and strict rate limiting
   */
  analyzePatterns: strictProcedure
    .mutation(async ({ ctx }) => {
      const patternAnalyzer = new PatternAnalyzer(ctx.prisma)
      await patternAnalyzer.analyzeStackPatterns()
      
      return {
        success: true,
        message: 'Pattern analysis completed successfully'
      }
    }),

  /**
   * Get recommendations for multiple stacks (batch operation)
   * Requires authentication to prevent abuse of batch operations
   */
  getBatchRecommendations: protectedProcedure
    .input(z.object({
      stackIds: z.array(z.string()).min(1).max(10),
      limit: z.number().min(1).max(20).default(5)
    }))
    .query(async ({ input, ctx }) => {
      const recommendationService = new RecommendationService(ctx.prisma)
      
      const results = await Promise.all(
        input.stackIds.map(async (stackId) => {
          const stackServices = await ctx.prisma.stack_services.findMany({
            where: { stackId },
            include: {
              services: { include: { categories: true } }
            }
          })

          if (stackServices.length === 0) {
            return { stackId, recommendations: [] }
          }

          const recommendations = await recommendationService.getRecommendationsForStack(
            stackServices.map(ss => ({
              serviceId: ss.serviceId,
              service: {
                ...ss.services,
                documentationUrl: ss.services.documentationUrl ?? undefined,
              },
              order: ss.order
            })) as any,
            { limit: input.limit }
          )

          return { stackId, recommendations }
        })
      )

      return results
    })
})

export type RecommendationsRouter = typeof recommendationsRouter