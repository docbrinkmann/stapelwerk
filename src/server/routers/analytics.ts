import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { computeStorageBytes, countUpStacks, upStackIds } from '@/lib/analytics-metrics';

/**
 * Bucket deployment_jobs groupBy rows into the dashboard's stat shape.
 * Jobs are written with status 'succeeded'/'queued' (deployments router);
 * 'completed'/'pending' are kept for legacy rows.
 */
export function bucketDeploymentStats(
  rows: Array<{ status: string; _count?: { status?: number } | null }>,
): { total: number; running: number; completed: number; failed: number; pending: number } {
  const stats = { total: 0, running: 0, completed: 0, failed: 0, pending: 0 };
  for (const row of rows) {
    const count = row._count?.status || 0;
    stats.total += count;
    if (row.status === 'running') stats.running += count;
    else if (row.status === 'succeeded' || row.status === 'completed') stats.completed += count;
    else if (row.status === 'failed') stats.failed += count;
    else if (row.status === 'queued' || row.status === 'pending') stats.pending += count;
  }
  return stats;
}

export const analyticsRouter = createTRPCRouter({
  // Get analytics for user's stacks
  getAnalytics: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const userId = ctx.userId!;

        // Get user's stacks
        const stacks = await ctx.prisma.stacks.findMany({
          where: { userId },
          include: {
            stack_services: {
              select: {
                serviceId: true
              }
            }
          }
        });

        // Count total stacks
        const totalStacks = stacks.length;

        // Count total unique services across all stacks
        const allServiceIds = new Set<number>();
        stacks.forEach(stack => {
          stack.stack_services.forEach(ss => {
            allServiceIds.add(ss.serviceId);
          });
        });
        const totalServices = allServiceIds.size;

        // Count stacks that are currently up (latest lifecycle job is a
        // succeeded apply) — the same rule the monitoring panel uses.
        const lifecycleJobs = await ctx.prisma.deployment_jobs.findMany({
          where: {
            stacks: { userId },
            mode: { in: ['apply', 'destroy'] }
          },
          select: { stackId: true, mode: true, status: true, createdAt: true }
        });
        const runningStacks = countUpStacks(lifecycleJobs);

        // Get last activity timestamp
        const lastStack = stacks.length > 0
          ? stacks.reduce((latest, stack) =>
              stack.updatedAt > latest.updatedAt ? stack : latest
            )
          : null;

        // Real storage: the actual byte size of stored stack config.
        const storageUsed = computeStorageBytes(stacks as any);

        return {
          totalStacks,
          runningStacks,
          totalServices,
          storageUsed,
          lastActivity: lastStack?.updatedAt || null
          // recentActivity removed — analytics.getRecentActivity is the real source.
        };
      } catch (error) {
        console.error('Error fetching analytics:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch analytics'
        });
      }
    }),

  // Get recent activity for user
  // Which of the user's stacks are currently deployed (running) — the dashboard
  // cards use this instead of a static 'stopped' label.
  getRunningStackIds: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!;
      const jobs = await ctx.prisma.deployment_jobs.findMany({
        where: {
          stacks: { userId },
          mode: { in: ['apply', 'destroy'] }
        },
        select: { stackId: true, mode: true, status: true, createdAt: true }
      });
      return { runningStackIds: [...upStackIds(jobs)] };
    }),

  getRecentActivity: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { limit } = input;

        // Get recent stack updates
        const recentStacks = await ctx.prisma.stacks.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          select: {
            id: true,
            name: true,
            updatedAt: true,
            createdAt: true,
            status: true
          }
        });

        // Transform into activity log format
        const activities = recentStacks.map(stack => ({
          id: stack.id,
          type: 'stack_updated' as const,
          title: `Updated stack: ${stack.name}`,
          description: `Stack "${stack.name}" was modified`,
          timestamp: stack.updatedAt,
          metadata: {
            stackId: stack.id,
            stackName: stack.name,
            status: stack.status
          }
        }));

        // Get recent deployments
        const recentDeployments = await ctx.prisma.deployment_jobs.findMany({
          where: {
            stacks: {
              userId
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          include: {
            stacks: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        // Add deployment activities
        const deploymentActivities = recentDeployments.map(deployment => ({
          id: deployment.id,
          type: 'deployment' as const,
          title: `Deployment ${deployment.status}: ${deployment.stacks?.name || 'Unknown'}`,
          description: `Stack "${deployment.stacks?.name || 'Unknown'}" deployment ${deployment.status}`,
          timestamp: deployment.createdAt,
          metadata: {
            deploymentId: deployment.id,
            stackId: deployment.stackId,
            stackName: deployment.stacks?.name || 'Unknown',
            status: deployment.status
          }
        }));

        // Combine and sort all activities
        const allActivities = [...activities, ...deploymentActivities]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, limit);

        return allActivities;
      } catch (error) {
        console.error('Error fetching recent activity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recent activity'
        });
      }
    }),

  // Get deployment statistics
  getDeploymentStats: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const userId = ctx.userId!;

        // Count deployments by status
        const deploymentStats = await ctx.prisma.deployment_jobs.groupBy({
          by: ['status'],
          where: {
            stacks: {
              userId
            }
          },
          _count: {
            status: true
          }
        });

        return bucketDeploymentStats(deploymentStats);
      } catch (error) {
        console.error('Error fetching deployment stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch deployment statistics'
        });
      }
    }),

  // Get recommendation analytics data
  getRecommendationAnalytics: protectedProcedure
    .input(z.object({
      recommendationId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { recommendationId } = input;

        // Get recommendation basic data
        const recommendation = await ctx.prisma.recommendations.findUnique({
          where: { id: recommendationId },
          include: {
            services: {
              select: {
                name: true
              }
            }
          }
        });

        if (!recommendation) {
          // Return zeros for non-existent recommendations
          return {
            name: `Recommendation ${recommendationId}`,
            category: 'Unknown',
            views: 0,
            clicks: 0,
            applications: 0,
            uniqueUsers: 0,
            averagePosition: 0,
            averageConfidence: 0,
            feedback: {
              positive: 0,
              negative: 0,
              neutral: 0
            },
            positiveFeedback: 0,
            negativeFeedback: 0
          };
        }

        // Get feedback aggregated by action
        const feedbackStats = await ctx.prisma.recommendation_feedback.groupBy({
          by: ['action'],
          where: { recommendationId },
          _count: {
            action: true
          }
        });

        // Count feedback by rating
        const feedbackByRating = await ctx.prisma.recommendation_feedback.groupBy({
          by: ['rating'],
          where: { recommendationId },
          _count: {
            rating: true
          }
        });

        // Count unique users who provided feedback
        const uniqueUsersCount = await ctx.prisma.recommendation_feedback.findMany({
          where: { recommendationId },
          distinct: ['userId'],
          select: { userId: true }
        });

        // Aggregate feedback into positive/negative/neutral
        const positiveFeedback = feedbackByRating
          .filter(f => f.rating && f.rating >= 4)
          .reduce((sum, f) => sum + (f._count?.rating || 0), 0);

        const negativeFeedback = feedbackByRating
          .filter(f => f.rating && f.rating <= 2)
          .reduce((sum, f) => sum + (f._count?.rating || 0), 0);

        const neutralFeedback = feedbackByRating
          .filter(f => f.rating && f.rating === 3)
          .reduce((sum, f) => sum + (f._count?.rating || 0), 0);

        // Count clicks and applications from feedback actions
        const clickCount = feedbackStats
          .filter(f => f.action === 'clicked')
          .reduce((sum, f) => sum + (f._count?.action || 0), 0);

        const applicationCount = feedbackStats
          .filter(f => f.action === 'applied')
          .reduce((sum, f) => sum + (f._count?.action || 0), 0);

        return {
          name: recommendation.services?.name || `Recommendation ${recommendationId}`,
          category: recommendation.category || 'Unknown',
          views: recommendation.viewCount || 0,
          clicks: clickCount,
          applications: applicationCount,
          uniqueUsers: uniqueUsersCount.length,
          averagePosition: 0, // Not tracked in current schema
          averageConfidence: recommendation.score || 0,
          feedback: {
            positive: positiveFeedback,
            negative: negativeFeedback,
            neutral: neutralFeedback
          },
          positiveFeedback,
          negativeFeedback
        };
      } catch (error) {
        console.error('Error fetching recommendation analytics:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recommendation analytics'
        });
      }
    }),

  // Get recommendation interaction data
  getRecommendationInteractions: protectedProcedure
    .input(z.object({
      recommendationId: z.string()
    }))
    .query(async ({ input }) => {
      // Note: Hover and view time tracking not currently implemented in database schema
      // This is production-ready behavior (transparent about limitations)
      // Future enhancement: Add analytics_events table with hover/view_time tracking
      return {
        hovers: 0,      // Requires analytics_events table with hover tracking
        averageViewTime: 0  // Requires analytics_events table with time tracking
      };
    }),

  // Get recommendation trend data
  getRecommendationTrend: protectedProcedure
    .input(z.object({
      recommendationId: z.string(),
      days: z.number().min(1).max(90).default(30)
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { recommendationId, days } = input;

        // Get current recommendation data
        const current = await ctx.prisma.recommendations.findUnique({
          where: { id: recommendationId },
          select: {
            viewCount: true,
            adoptionCount: true
          }
        });

        if (!current) {
          return {
            direction: 'stable' as const,
            magnitude: 0
          };
        }

        // Get feedback count from recent period
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const recentFeedback = await ctx.prisma.recommendation_feedback.count({
          where: {
            recommendationId,
            createdAt: { gte: startDate }
          }
        });

        // Calculate simple trend based on adoption rate and recent feedback
        // If adoptionCount > viewCount * 0.1, trending up
        // If adoptionCount < viewCount * 0.05, trending down
        // Otherwise stable
        const adoptionRate = current.viewCount > 0
          ? (current.adoptionCount || 0) / current.viewCount
          : 0;

        let direction: 'up' | 'down' | 'stable' = 'stable';
        let magnitude = 0;

        if (adoptionRate > 0.1) {
          direction = 'up';
          magnitude = Math.min(0.2, adoptionRate); // Cap at 20%
        } else if (adoptionRate < 0.05 && current.viewCount > 10) {
          direction = 'down';
          magnitude = -Math.min(0.1, 0.1 - adoptionRate); // Cap at -10%
        }

        // Adjust based on recent feedback activity
        if (recentFeedback > 5) {
          if (direction === 'down') direction = 'stable';
          if (direction === 'stable' && magnitude === 0) {
            direction = 'up';
            magnitude = 0.05;
          }
        }

        return {
          direction,
          magnitude
        };
      } catch (error) {
        console.error('Error fetching recommendation trend:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recommendation trend'
        });
      }
    })
});
