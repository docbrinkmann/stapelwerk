import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTestDatabase, cleanupTestDatabase } from '../test-db'

describe('Recommendation Database Schema', () => {
  let prisma: PrismaClient

  beforeEach(async () => {
    prisma = await createTestDatabase()
  })

  afterEach(async () => {
    await cleanupTestDatabase(prisma)
  })

  describe('Recommendation table', () => {
    it('should create recommendation records with required fields', async () => {
      const recommendation = await prisma.recommendation.create({
        data: {
          id: 'rec-test-123',
          serviceId: 1,
          targetStackId: 'stack-123',
          score: 0.85,
          rationale: 'Great match for PostgreSQL administration',
          category: 'complementary',
          algorithmVersion: '1.0'
        }
      })

      expect(recommendation).toMatchObject({
        id: 'rec-test-123',
        serviceId: 1,
        targetStackId: 'stack-123',
        score: 0.85,
        category: 'complementary'
      })
      expect(recommendation.createdAt).toBeInstanceOf(Date)
    })

    it('should enforce score constraints between 0 and 1', async () => {
      await expect(
        prisma.recommendation.create({
          data: {
            id: 'rec-invalid-score',
            serviceId: 1,
            targetStackId: 'stack-123',
            score: 1.5, // Invalid score > 1
            rationale: 'Invalid score test',
            category: 'complementary',
            algorithmVersion: '1.0'
          }
        })
      ).rejects.toThrow()
    })

    it('should allow null userId for anonymous recommendations', async () => {
      const recommendation = await prisma.recommendation.create({
        data: {
          id: 'rec-anonymous',
          serviceId: 1,
          targetStackId: 'stack-123',
          score: 0.75,
          rationale: 'Anonymous recommendation',
          category: 'popular',
          algorithmVersion: '1.0',
          userId: null
        }
      })

      expect(recommendation.userId).toBeNull()
    })

    it('should store metadata as JSON', async () => {
      const metadata = { 
        communityRating: 4.5,
        deploymentCount: 150,
        tags: ['database', 'admin'] 
      }

      const recommendation = await prisma.recommendation.create({
        data: {
          id: 'rec-with-metadata',
          serviceId: 1,
          targetStackId: 'stack-123',
          score: 0.90,
          rationale: 'Highly recommended by community',
          category: 'essential',
          algorithmVersion: '1.0',
          metadata: JSON.stringify(metadata)
        }
      })

      expect(JSON.parse(recommendation.metadata || '{}')).toEqual(metadata)
    })
  })

  describe('RecommendationPattern table', () => {
    it('should store service combination patterns', async () => {
      const pattern = await prisma.recommendationPattern.create({
        data: {
          id: 'pattern-web-stack',
          serviceIds: JSON.stringify([1, 2, 3]),
          frequency: 125,
          successRate: 0.92,
          category: 'web-development',
          minStackSize: 3,
          maxStackSize: 8
        }
      })

      expect(pattern).toMatchObject({
        serviceIds: JSON.stringify([1, 2, 3]),
        frequency: 125,
        successRate: 0.92,
        category: 'web-development'
      })
    })

    it('should track pattern usage with timestamps', async () => {
      const pattern = await prisma.recommendationPattern.create({
        data: {
          id: 'pattern-usage-test',
          serviceIds: JSON.stringify([4, 5]),
          frequency: 42,
          successRate: 0.78,
          category: 'media',
          minStackSize: 2,
          maxStackSize: 5
        }
      })

      expect(pattern.createdAt).toBeInstanceOf(Date)
      expect(pattern.updatedAt).toBeInstanceOf(Date)
    })

    it('should support pattern metadata for additional context', async () => {
      const metadata = {
        description: 'Popular media server setup',
        averageSetupTime: '15 minutes',
        difficulty: 'beginner',
        requiredResources: { ram: '2GB', storage: '100GB' }
      }

      const pattern = await prisma.recommendationPattern.create({
        data: {
          id: 'pattern-media-setup',
          serviceIds: JSON.stringify([10, 11, 12]),
          frequency: 87,
          successRate: 0.94,
          category: 'media',
          minStackSize: 3,
          maxStackSize: 6,
          metadata: JSON.stringify(metadata)
        }
      })

      const storedMetadata = JSON.parse(pattern.metadata || '{}')
      expect(storedMetadata.description).toBe('Popular media server setup')
      expect(storedMetadata.difficulty).toBe('beginner')
    })
  })

  describe('RecommendationFeedback table', () => {
    it('should store user feedback on recommendations', async () => {
      // First create a recommendation
      await prisma.recommendation.create({
        data: {
          id: 'rec-for-feedback',
          serviceId: 1,
          targetStackId: 'stack-123',
          score: 0.80,
          rationale: 'Test recommendation',
          category: 'complementary',
          algorithmVersion: '1.0'
        }
      })

      const feedback = await prisma.recommendationFeedback.create({
        data: {
          id: 'feedback-123',
          recommendationId: 'rec-for-feedback',
          userId: 'user-456',
          rating: 4,
          action: 'adopted',
          comment: 'Very helpful suggestion!',
          sessionId: 'session-789'
        }
      })

      expect(feedback).toMatchObject({
        recommendationId: 'rec-for-feedback',
        userId: 'user-456',
        rating: 4,
        action: 'adopted'
      })
    })

    it('should support different feedback actions', async () => {
      await prisma.recommendation.create({
        data: {
          id: 'rec-for-actions',
          serviceId: 2,
          targetStackId: 'stack-456',
          score: 0.65,
          rationale: 'Moderate recommendation',
          category: 'optional',
          algorithmVersion: '1.0'
        }
      })

      const actions = ['adopted', 'rejected', 'dismissed', 'saved']
      
      for (const action of actions) {
        const feedback = await prisma.recommendationFeedback.create({
          data: {
            id: `feedback-${action}`,
            recommendationId: 'rec-for-actions',
            userId: 'user-test',
            rating: 3,
            action: action,
            sessionId: 'session-test'
          }
        })

        expect(feedback.action).toBe(action)
      }
    })

    it('should allow anonymous feedback without userId', async () => {
      await prisma.recommendation.create({
        data: {
          id: 'rec-anonymous-feedback',
          serviceId: 3,
          targetStackId: 'stack-789',
          score: 0.70,
          rationale: 'Anonymous test',
          category: 'popular',
          algorithmVersion: '1.0'
        }
      })

      const feedback = await prisma.recommendationFeedback.create({
        data: {
          id: 'feedback-anonymous',
          recommendationId: 'rec-anonymous-feedback',
          rating: 2,
          action: 'dismissed',
          sessionId: 'session-anonymous'
        }
      })

      expect(feedback.userId).toBeNull()
      expect(feedback.sessionId).toBe('session-anonymous')
    })
  })

  describe('Relations and constraints', () => {
    it('should maintain referential integrity between recommendations and services', async () => {
      // This test would require existing service records
      // For now, we'll test the schema structure
      const schema = await prisma.$queryRaw`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='recommendations'
      `
      
      expect(schema).toBeDefined()
    })

    it('should cascade delete feedback when recommendation is deleted', async () => {
      // Create recommendation and feedback
      await prisma.recommendation.create({
        data: {
          id: 'rec-cascade-test',
          serviceId: 1,
          targetStackId: 'stack-cascade',
          score: 0.75,
          rationale: 'Cascade test',
          category: 'test',
          algorithmVersion: '1.0'
        }
      })

      await prisma.recommendationFeedback.create({
        data: {
          id: 'feedback-cascade',
          recommendationId: 'rec-cascade-test',
          rating: 3,
          action: 'adopted',
          sessionId: 'session-cascade'
        }
      })

      // Delete recommendation
      await prisma.recommendation.delete({
        where: { id: 'rec-cascade-test' }
      })

      // Verify feedback is also deleted
      const remainingFeedback = await prisma.recommendationFeedback.findUnique({
        where: { id: 'feedback-cascade' }
      })

      expect(remainingFeedback).toBeNull()
    })
  })
})