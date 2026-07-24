import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RecommendationService } from '@/server/services/recommendation-service'
import { PrismaClient } from '@prisma/client'
import { createMockContext } from '../helpers/test-utils'

// Mock Prisma
vi.mock('@prisma/client')

describe('RecommendationService', () => {
  let service: RecommendationService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      service: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      },
      stackService: {
        count: vi.fn().mockResolvedValue(5)
      },
      recommendation: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn()
      },
      recommendationPattern: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn()
      },
      recommendationFeedback: {
        create: vi.fn(),
        findMany: vi.fn()
      }
    }
    service = new RecommendationService(mockPrisma)
  })

  describe('getRecommendationsForStack', () => {
    it('should return contextual service recommendations for a given stack', async () => {
      const stackServices = [
        { serviceId: 1, service: { name: 'PostgreSQL', slug: 'postgresql', categoryId: 1 } },
        { serviceId: 2, service: { name: 'Redis', slug: 'redis', categoryId: 2 } }
      ]

      mockPrisma.service.findMany.mockResolvedValue([
        { id: 3, name: 'pgAdmin', slug: 'pgadmin', categoryId: 1, compatibilityInfo: '{"databases":["postgresql"]}' },
        { id: 4, name: 'Nginx', slug: 'nginx', categoryId: 3, compatibilityInfo: '{"load_balancer":true}' }
      ])

      mockPrisma.recommendationPattern.findMany.mockResolvedValue([
        { serviceIds: '[1,3]', frequency: 50, successRate: 0.85 }
      ])

      const result = await service.getRecommendationsForStack(stackServices, { limit: 5 })

      // Compatibility is bidirectional: nginx has its own matrix entry, and
      // pgAdmin (no entry of its own) is listed in postgresql's
      // compatibleWith, so both clear the 0.3 minimum score threshold.
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        serviceId: 4,
        score: expect.any(Number),
        rationale: expect.any(String),
        category: 'complementary'
      })
      expect(result.map(r => r.serviceId)).toContain(3)
    })

    it('should recommend companion tools listed only by existing services (pgadmin next to postgresql)', async () => {
      const stackServices = [
        { serviceId: 1, service: { name: 'PostgreSQL', slug: 'postgresql', categoryId: 1 } }
      ]

      // pgAdmin has no COMPATIBILITY_MATRIX entry of its own; only
      // postgresql's compatibleWith references it
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 3, name: 'pgAdmin', slug: 'pgadmin', categoryId: 1, compatibilityInfo: '{"databases":["postgresql"]}' }
      ])

      const result = await service.getRecommendationsForStack(stackServices)

      expect(result).toHaveLength(1)
      expect(result[0].serviceId).toBe(3)
      expect(result[0].score).toBeGreaterThanOrEqual(0.3)
    })

    it('should include compatibility scores in recommendations', async () => {
      const stackServices = [
        { serviceId: 1, service: { name: 'PostgreSQL', slug: 'postgresql', categoryId: 1 } }
      ]

      // nginx lists postgresql as compatible in its matrix entry
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 4, name: 'Nginx', slug: 'nginx', categoryId: 3, compatibilityInfo: '{"load_balancer":true}' }
      ])

      const result = await service.getRecommendationsForStack(stackServices)

      expect(result).toHaveLength(1)
      expect(result[0].score).toBeGreaterThan(0)
      expect(result[0].score).toBeLessThanOrEqual(1)
    })

    it('should filter out services already in the stack', async () => {
      const stackServices = [
        { serviceId: 1, service: { name: 'PostgreSQL', slug: 'postgresql', categoryId: 1 } },
        { serviceId: 3, service: { name: 'pgAdmin', slug: 'pgadmin', categoryId: 1 } }
      ]

      mockPrisma.service.findMany.mockResolvedValue([
        { id: 1, name: 'PostgreSQL', slug: 'postgresql', categoryId: 1 },
        { id: 3, name: 'pgAdmin', slug: 'pgadmin', categoryId: 1 },
        { id: 4, name: 'Nginx', slug: 'nginx', categoryId: 3 }
      ])

      const result = await service.getRecommendationsForStack(stackServices)

      expect(result.every(r => r.serviceId !== 1 && r.serviceId !== 3)).toBe(true)
    })
  })

  describe('analyzePatterns', () => {
    it('should identify popular service combinations from community data', async () => {
      // Patterns need a minimum frequency of 3 to be reported, so the
      // [1, 3] combination must appear in at least three stacks
      const stackData = [
        { services: [1, 2, 3] },
        { services: [1, 3, 4] },
        { services: [1, 3] },
        { services: [1, 2] },
        { services: [2, 3] }
      ]

      const result = await service.analyzePatterns(stackData)

      expect(result).toContainEqual(expect.objectContaining({
        serviceIds: expect.arrayContaining([1, 3]),
        frequency: expect.any(Number)
      }))
    })

    it('should calculate pattern success rates', async () => {
      const stackData = [
        { services: [1, 2], deploymentSuccess: true },
        { services: [1, 2], deploymentSuccess: true },
        { services: [1, 2], deploymentSuccess: false }
      ]

      const result = await service.analyzePatterns(stackData)

      const pattern = result.find(p => p.serviceIds.includes(1) && p.serviceIds.includes(2))
      expect(pattern?.successRate).toBeCloseTo(0.67, 2)
    })
  })

  describe('getUseCaseRecommendations', () => {
    it('should return pre-configured stack recommendations for use cases', async () => {
      const useCase = 'media-server'

      mockPrisma.service.findMany.mockResolvedValue([
        { id: 5, name: 'Plex', slug: 'plex', categoryId: 4 },
        { id: 6, name: 'Tautulli', slug: 'tautulli', categoryId: 4 },
        { id: 7, name: 'Overseerr', slug: 'overseerr', categoryId: 4 }
      ])

      const result = await service.getUseCaseRecommendations(useCase)

      expect(result).toHaveProperty('useCase', 'media-server')
      expect(result).toHaveProperty('services')
      expect(result.services).toHaveLength(3)
      expect(result).toHaveProperty('description')
    })

    it('should return empty recommendations for unknown use case', async () => {
      const result = await service.getUseCaseRecommendations('unknown-use-case')

      expect(result.services).toHaveLength(0)
    })
  })

  describe('recordFeedback', () => {
    it('should store recommendation feedback for learning', async () => {
      const feedback = {
        recommendationId: 'rec-123',
        userId: 'user-456',
        rating: 5,
        action: 'adopted' as const,
        comment: 'Great suggestion!'
      }

      mockPrisma.recommendationFeedback.create.mockResolvedValue({
        id: 'feedback-789',
        ...feedback,
        createdAt: new Date()
      })

      const result = await service.recordFeedback(feedback)

      expect(mockPrisma.recommendationFeedback.create).toHaveBeenCalledWith({
        data: {
          recommendationId: 'rec-123',
          userId: 'user-456',
          rating: 5,
          action: 'adopted',
          comment: 'Great suggestion!',
          contextData: '{}'
        }
      })
      expect(result.id).toBe('feedback-789')
    })
  })

  describe('calculateCompatibilityScore', () => {
    it('should calculate high compatibility for database and admin tools', () => {
      const testService = { id: 3, slug: 'pgadmin', compatibilityInfo: '{"databases":["postgresql","mysql"]}' }
      const stackServices = [
        { serviceId: 1, service: { slug: 'postgresql' } }
      ]

      const score = service.calculateCompatibilityScore(testService, stackServices)

      // postgresql lists pgadmin as compatible; the reverse direction counts
      expect(score).toBe(1.0)
    })

    it('should calculate low compatibility for unrelated services', () => {
      const testService = { id: 5, slug: 'plex', compatibilityInfo: '{"media":["plex"]}' }
      const stackServices = [
        { serviceId: 1, service: { slug: 'postgresql' } }
      ]

      const score = service.calculateCompatibilityScore(testService, stackServices)

      expect(score).toBeLessThan(1.0)
    })
  })
})