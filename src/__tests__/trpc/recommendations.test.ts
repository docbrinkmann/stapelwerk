import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createCallerFactory } from '@trpc/server'
import { recommendationsRouter } from '@/server/routers/recommendations'
import { createMockContext } from '../helpers/test-utils'

describe('tRPC Recommendations Router', () => {
  let caller: any
  let mockContext: any

  beforeEach(() => {
    mockContext = createMockContext()
    const createCaller = createCallerFactory(recommendationsRouter)
    caller = createCaller(mockContext)
  })

  describe('getForStack', () => {
    it('should return recommendations for a given stack', async () => {
      const mockRecommendations = [
        {
          id: 'rec-1',
          serviceId: 3,
          service: { name: 'pgAdmin', slug: 'pgadmin', description: 'PostgreSQL admin tool' },
          score: 0.92,
          rationale: 'Perfect match for managing your PostgreSQL database',
          category: 'complementary'
        },
        {
          id: 'rec-2', 
          serviceId: 4,
          service: { name: 'Redis Commander', slug: 'redis-commander', description: 'Redis management tool' },
          score: 0.78,
          rationale: 'Great for monitoring your Redis instance',
          category: 'optional'
        }
      ]

      mockContext.prisma.stackService.findMany.mockResolvedValue([
        { serviceId: 1, service: { name: 'PostgreSQL', slug: 'postgresql' } },
        { serviceId: 2, service: { name: 'Redis', slug: 'redis' } }
      ])

      mockContext.recommendationService.getRecommendationsForStack.mockResolvedValue(mockRecommendations)

      const result = await caller.getForStack({
        stackId: 'stack-123',
        limit: 5
      })

      expect(result).toEqual(mockRecommendations)
      expect(mockContext.recommendationService.getRecommendationsForStack).toHaveBeenCalledWith(
        expect.any(Array),
        { limit: 5 }
      )
    })

    it('should handle empty stacks gracefully', async () => {
      mockContext.prisma.stackService.findMany.mockResolvedValue([])
      mockContext.recommendationService.getRecommendationsForStack.mockResolvedValue([])

      const result = await caller.getForStack({
        stackId: 'empty-stack',
        limit: 3
      })

      expect(result).toEqual([])
    })

    it('should validate input parameters', async () => {
      await expect(
        caller.getForStack({
          stackId: '', // Empty stack ID should fail
          limit: 5
        })
      ).rejects.toThrow()

      await expect(
        caller.getForStack({
          stackId: 'stack-123',
          limit: 101 // Over maximum limit
        })
      ).rejects.toThrow()
    })
  })

  describe('getForServices', () => {
    it('scores an arbitrary service-id list (unsaved draft) via the same service', async () => {
      const recs = [
        { id: 'r1', serviceId: 3, service: { name: 'pgAdmin', slug: 'pgadmin' }, score: 0.9, rationale: 'Manages your PostgreSQL database', category: 'complementary' }
      ]
      mockContext.prisma.services.findMany.mockResolvedValue([
        { id: 1, name: 'PostgreSQL', slug: 'postgresql', categories: { slug: 'database' } },
        { id: 2, name: 'Redis', slug: 'redis', categories: { slug: 'cache' } }
      ])
      mockContext.recommendationService.getRecommendationsForStack.mockResolvedValue(recs)

      const result = await caller.getForServices({ serviceIds: [1, 2], limit: 6 })

      expect(result).toEqual(recs)
      const [passedStackServices] = mockContext.recommendationService.getRecommendationsForStack.mock.calls[0]
      expect(passedStackServices).toHaveLength(2)
      expect(passedStackServices[0]).toMatchObject({ serviceId: 1 })
    })

    it('returns [] for an empty service list', async () => {
      const result = await caller.getForServices({ serviceIds: [] })
      expect(result).toEqual([])
    })
  })

  describe('getUseCaseTemplates', () => {
    it('should return predefined use case templates', async () => {
      const mockTemplate = {
        useCase: 'media-server',
        name: 'Media Server Stack',
        description: 'Complete setup for home media streaming',
        services: [
          { id: 5, name: 'Plex', slug: 'plex', description: 'Media server' },
          { id: 6, name: 'Tautulli', slug: 'tautulli', description: 'Plex monitoring' },
          { id: 7, name: 'Overseerr', slug: 'overseerr', description: 'Media request management' }
        ],
        difficulty: 'intermediate',
        estimatedSetupTime: '30 minutes'
      }

      mockContext.recommendationService.getUseCaseRecommendations.mockResolvedValue(mockTemplate)

      const result = await caller.getUseCaseTemplates({
        useCase: 'media-server'
      })

      expect(result).toEqual(mockTemplate)
      expect(mockContext.recommendationService.getUseCaseRecommendations).toHaveBeenCalledWith('media-server')
    })

    it('should handle unknown use cases', async () => {
      mockContext.recommendationService.getUseCaseRecommendations.mockResolvedValue({
        useCase: 'unknown',
        services: [],
        description: 'No recommendations available'
      })

      const result = await caller.getUseCaseTemplates({
        useCase: 'unknown-use-case'
      })

      expect(result.services).toHaveLength(0)
    })
  })

  describe('submitFeedback', () => {
    it('should record positive feedback for recommendations', async () => {
      const feedbackData = {
        recommendationId: 'rec-123',
        rating: 5,
        action: 'adopted' as const,
        comment: 'Excellent suggestion!'
      }

      const mockFeedback = {
        id: 'feedback-456',
        ...feedbackData,
        userId: 'user-789',
        createdAt: new Date()
      }

      mockContext.recommendationService.recordFeedback.mockResolvedValue(mockFeedback)

      const result = await caller.submitFeedback({
        ...feedbackData,
        userId: 'user-789'
      })

      expect(result).toEqual(mockFeedback)
      expect(mockContext.recommendationService.recordFeedback).toHaveBeenCalledWith({
        ...feedbackData,
        userId: 'user-789'
      })
    })

    it('should record negative feedback with optional comment', async () => {
      const feedbackData = {
        recommendationId: 'rec-456',
        rating: 2,
        action: 'rejected' as const
      }

      mockContext.recommendationService.recordFeedback.mockResolvedValue({
        id: 'feedback-negative',
        ...feedbackData,
        createdAt: new Date()
      })

      const result = await caller.submitFeedback(feedbackData)

      expect(result.rating).toBe(2)
      expect(result.action).toBe('rejected')
    })

    it('should allow anonymous feedback', async () => {
      const anonymousFeedback = {
        recommendationId: 'rec-789',
        rating: 4,
        action: 'saved' as const,
        sessionId: 'session-123'
      }

      mockContext.recommendationService.recordFeedback.mockResolvedValue({
        id: 'feedback-anon',
        ...anonymousFeedback,
        userId: null,
        createdAt: new Date()
      })

      const result = await caller.submitFeedback(anonymousFeedback)

      expect(result.userId).toBeNull()
      expect(result.sessionId).toBe('session-123')
    })

    it('should validate feedback input', async () => {
      await expect(
        caller.submitFeedback({
          recommendationId: 'rec-123',
          rating: 6, // Invalid rating > 5
          action: 'adopted'
        })
      ).rejects.toThrow()

      await expect(
        caller.submitFeedback({
          recommendationId: '', // Empty recommendation ID
          rating: 3,
          action: 'adopted'
        })
      ).rejects.toThrow()
    })
  })

  describe('getPopularPatterns', () => {
    it('should return community usage patterns', async () => {
      const mockPatterns = [
        {
          id: 'pattern-web',
          services: [
            { id: 1, name: 'Nginx', slug: 'nginx' },
            { id: 2, name: 'PostgreSQL', slug: 'postgresql' },
            { id: 3, name: 'Redis', slug: 'redis' }
          ],
          frequency: 150,
          successRate: 0.94,
          category: 'web-development',
          description: 'Popular web application stack'
        }
      ]

      mockContext.recommendationService.getPopularPatterns.mockResolvedValue(mockPatterns)

      const result = await caller.getPopularPatterns({
        category: 'web-development',
        limit: 10
      })

      expect(result).toEqual(mockPatterns)
      expect(mockContext.recommendationService.getPopularPatterns).toHaveBeenCalledWith({
        category: 'web-development',
        limit: 10
      })
    })

    it('should support filtering by minimum frequency', async () => {
      const result = await caller.getPopularPatterns({
        minFrequency: 50,
        limit: 5
      })

      expect(mockContext.recommendationService.getPopularPatterns).toHaveBeenCalledWith({
        minFrequency: 50,
        limit: 5
      })
    })
  })

  describe('searchRecommendations', () => {
    it('should search recommendations by service name and description', async () => {
      const mockResults = [
        {
          id: 'rec-search-1',
          serviceId: 10,
          service: { name: 'Grafana', slug: 'grafana', description: 'Monitoring and observability' },
          score: 0.88,
          rationale: 'Excellent for monitoring your applications',
          category: 'monitoring'
        }
      ]

      mockContext.recommendationService.searchRecommendations.mockResolvedValue(mockResults)

      const result = await caller.searchRecommendations({
        query: 'monitoring',
        category: 'observability',
        limit: 10
      })

      expect(result).toEqual(mockResults)
      expect(mockContext.recommendationService.searchRecommendations).toHaveBeenCalledWith({
        query: 'monitoring',
        category: 'observability',
        limit: 10
      })
    })

    it('should handle empty search results', async () => {
      mockContext.recommendationService.searchRecommendations.mockResolvedValue([])

      const result = await caller.searchRecommendations({
        query: 'nonexistent-service'
      })

      expect(result).toEqual([])
    })
  })

  describe('refreshRecommendations', () => {
    it('should trigger recommendation engine refresh for a stack', async () => {
      mockContext.recommendationService.refreshRecommendationsForStack.mockResolvedValue({
        success: true,
        updatedCount: 5,
        message: 'Recommendations refreshed successfully'
      })

      const result = await caller.refreshRecommendations({
        stackId: 'stack-refresh-123'
      })

      expect(result).toMatchObject({
        success: true,
        updatedCount: 5
      })
    })

    it('should handle refresh failures gracefully', async () => {
      mockContext.recommendationService.refreshRecommendationsForStack.mockRejectedValue(
        new Error('Cache refresh failed')
      )

      await expect(
        caller.refreshRecommendations({
          stackId: 'stack-error'
        })
      ).rejects.toThrow('Cache refresh failed')
    })
  })
})