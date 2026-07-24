/**
 * Logs tRPC Router
 * 
 * Provides procedures for querying and filtering deployment logs.
 * Real-time log streaming is handled by the WebSocket server.
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

/**
 * Verify the caller owns the stack before reading/clearing its logs. Without
 * this every procedure filtered only by the caller-supplied stackId — an IDOR
 * that let any authenticated user read or wipe another user's deploy logs.
 */
async function requireStackOwner(prisma: any, stackId: string, userId: string | undefined): Promise<void> {
  const stack = await prisma.stacks.findUnique({ where: { id: stackId }, select: { userId: true } });
  if (!stack) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stack not found' });
  if (!userId || stack.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
}

// Log level enum
const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
const LogSourceSchema = z.enum(['stdout', 'stderr', 'system', 'deployment']);

// Log entry schema
const LogEntrySchema = z.object({
  id: z.string(),
  stackId: z.string(),
  deploymentId: z.string().nullable().optional(),
  level: LogLevelSchema,
  source: LogSourceSchema,
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  timestamp: z.date(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

export const logsRouter = createTRPCRouter({
  /**
   * List logs for a stack with pagination and filtering
   */
  list: protectedProcedure
    .input(z.object({
      stackId: z.string(),
      deploymentId: z.string().optional(),
      level: z.array(LogLevelSchema).optional(),
      source: z.array(LogSourceSchema).optional(),
      search: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().min(1).max(1000).default(100),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { stackId, deploymentId, level, source, search, startDate, endDate, limit, cursor } = input;
      await requireStackOwner(ctx.prisma, stackId, ctx.userId);
      
      // Build where clause
      const where: Record<string, unknown> = { stackId };
      
      if (deploymentId) {
        where.deploymentId = deploymentId;
      }
      
      if (level && level.length > 0) {
        where.level = { in: level };
      }
      
      if (source && source.length > 0) {
        where.source = { in: source };
      }
      
      if (search) {
        where.message = { contains: search, mode: 'insensitive' };
      }
      
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
          (where.timestamp as Record<string, Date>).gte = startDate;
        }
        if (endDate) {
          (where.timestamp as Record<string, Date>).lte = endDate;
        }
      }
      
      if (cursor) {
        where.id = { lt: cursor };
      }
      
      try {
        const logs = await ctx.prisma.deployment_logs.findMany({
          where,
          take: limit + 1,
          orderBy: { timestamp: 'desc' },
        });
        
        let nextCursor: string | undefined;
        if (logs.length > limit) {
          const lastItem = logs.pop();
          nextCursor = lastItem?.id;
        }
        
        return {
          logs: logs.map(log => ({
            id: log.id,
            stackId: log.stackId,
            deploymentId: log.deploymentId,
            level: log.level as 'debug' | 'info' | 'warn' | 'error',
            source: log.source as 'stdout' | 'stderr' | 'system' | 'deployment',
            message: log.message,
            metadata: log.metadata ? (log.metadata as unknown as Record<string, unknown>) : null,
            timestamp: log.timestamp,
          })),
          nextCursor,
        };
      } catch (error) {
        console.error('[Logs] Error fetching logs:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch logs',
        });
      }
    }),
  
  /**
   * Get log statistics for a stack
   */
  stats: protectedProcedure
    .input(z.object({
      stackId: z.string(),
      deploymentId: z.string().optional(),
      timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
    }))
    .query(async ({ ctx, input }) => {
      const { stackId, deploymentId, timeRange } = input;
      await requireStackOwner(ctx.prisma, stackId, ctx.userId);
      
      // Calculate start date based on time range
      const now = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1h':
          startDate.setHours(now.getHours() - 1);
          break;
        case '6h':
          startDate.setHours(now.getHours() - 6);
          break;
        case '24h':
          startDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
      }
      
      const where: Record<string, unknown> = {
        stackId,
        timestamp: { gte: startDate },
      };
      
      if (deploymentId) {
        where.deploymentId = deploymentId;
      }
      
      try {
        // Get counts by level
        const [total, debugCount, infoCount, warnCount, errorCount] = await Promise.all([
          ctx.prisma.deployment_logs.count({ where }),
          ctx.prisma.deployment_logs.count({ where: { ...where, level: 'debug' } }),
          ctx.prisma.deployment_logs.count({ where: { ...where, level: 'info' } }),
          ctx.prisma.deployment_logs.count({ where: { ...where, level: 'warn' } }),
          ctx.prisma.deployment_logs.count({ where: { ...where, level: 'error' } }),
        ]);
        
        return {
          total,
          byLevel: {
            debug: debugCount,
            info: infoCount,
            warn: warnCount,
            error: errorCount,
          },
          timeRange,
          startDate,
          endDate: now,
        };
      } catch (error) {
        console.error('[Logs] Error fetching log stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch log statistics',
        });
      }
    }),
  
  /**
   * Get WebSocket connection info for log streaming
   */
  streamInfo: publicProcedure
    .query(() => {
      return {
        wsUrl: process.env.WS_URL ?? 'ws://localhost:3001/ws',
        protocol: 'logs',
        subscribeMessage: {
          type: 'subscribe',
          payload: {
            channel: 'logs',
            stackId: '{stackId}',
            deploymentId: '{deploymentId}', // optional
          },
        },
        unsubscribeMessage: {
          type: 'unsubscribe',
          payload: {
            channel: 'logs',
            stackId: '{stackId}',
          },
        },
      };
    }),
  
  /**
   * Clear logs for a stack (admin only)
   */
  clear: protectedProcedure
    .input(z.object({
      stackId: z.string(),
      deploymentId: z.string().optional(),
      olderThan: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { stackId, deploymentId, olderThan } = input;
      await requireStackOwner(ctx.prisma, stackId, ctx.userId);
      
      const where: Record<string, unknown> = { stackId };
      
      if (deploymentId) {
        where.deploymentId = deploymentId;
      }
      
      if (olderThan) {
        where.timestamp = { lt: olderThan };
      }
      
      try {
        const result = await ctx.prisma.deployment_logs.deleteMany({ where });
        
        return {
          deleted: result.count,
          stackId,
          deploymentId,
        };
      } catch (error) {
        console.error('[Logs] Error clearing logs:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to clear logs',
        });
      }
    }),
});
