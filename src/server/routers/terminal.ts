/**
 * Terminal tRPC Router
 * 
 * Provides procedures for managing terminal sessions.
 * Real-time terminal I/O is handled by the WebSocket server.
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure, adminProcedure } from '../trpc';
import { effectivePlan, assertDeployCapability } from '@/lib/billing/enforcement';
import { TRPCError } from '@trpc/server';

// Terminal session status
const TerminalStatusSchema = z.enum(['active', 'closed', 'error']);

// Terminal session schema
const TerminalSessionSchema = z.object({
  id: z.string(),
  stackId: z.string(),
  userId: z.string(),
  containerId: z.string().nullable().optional(),
  status: TerminalStatusSchema,
  command: z.string().nullable().optional(),
  exitCode: z.number().nullable().optional(),
  startedAt: z.date(),
  endedAt: z.date().nullable().optional(),
  lastActivity: z.date(),
});

export type TerminalSession = z.infer<typeof TerminalSessionSchema>;

export const terminalRouter = createTRPCRouter({
  /**
   * Create a new terminal session
   */
  create: protectedProcedure
    .input(z.object({
      stackId: z.string(),
      containerId: z.string().optional(),
      command: z.string().default('/bin/sh'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { stackId, containerId, command } = input;
      
      // Verify user has access to the stack
      const stack = await ctx.prisma.stacks.findUnique({
        where: { id: stackId },
        select: { id: true, userId: true },
      });
      
      if (!stack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Stack not found',
        });
      }

      // Only the stack owner may open a terminal session against it. (Real
      // command execution is additionally gated by the WS server, which
      // validates the next-auth JWT and restricts docker to an allowed
      // container-name prefix.)
      if (stack.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this stack',
        });
      }

      // Plan gate: the terminal is a Pro capability (self-host ⇒ allowed).
      assertDeployCapability(await effectivePlan(ctx.prisma, ctx.userId!));

      try {
        const session = await ctx.prisma.terminal_sessions.create({
          data: {
            stackId,
            userId: ctx.userId,
            containerId,
            status: 'active',
            command,
            startedAt: new Date(),
            lastActivity: new Date(),
          },
        });
        
        return {
          id: session.id,
          stackId: session.stackId,
          userId: session.userId,
          containerId: session.containerId,
          status: session.status as 'active' | 'closed' | 'error',
          command: session.command,
          startedAt: session.startedAt,
          lastActivity: session.lastActivity,
          wsUrl: process.env.WS_URL ?? 'ws://localhost:3001/ws',
          connectMessage: {
            type: 'terminal',
            payload: {
              action: 'create',
              sessionId: session.id,
              stackId,
              containerId,
              command,
            },
          },
        };
      } catch (error) {
        console.error('[Terminal] Error creating session:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create terminal session',
        });
      }
    }),
  
  /**
   * Get a terminal session by ID
   */
  get: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { sessionId } = input;
      
      try {
        const session = await ctx.prisma.terminal_sessions.findUnique({
          where: { id: sessionId },
        });
        
        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Terminal session not found',
          });
        }
        
        // Check user access
        if (session.userId !== ctx.userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Not authorized to access this session',
          });
        }
        
        return {
          id: session.id,
          stackId: session.stackId,
          userId: session.userId,
          containerId: session.containerId,
          status: session.status as 'active' | 'closed' | 'error',
          command: session.command,
          exitCode: session.exitCode,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          lastActivity: session.lastActivity,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[Terminal] Error getting session:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get terminal session',
        });
      }
    }),
  
  /**
   * List terminal sessions for a stack
   */
  list: protectedProcedure
    .input(z.object({
      stackId: z.string(),
      status: TerminalStatusSchema.optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { stackId, status, limit } = input;
      
      const where: Record<string, unknown> = {
        stackId,
        userId: ctx.userId, // Only show user's own sessions
      };
      
      if (status) {
        where.status = status;
      }
      
      try {
        const sessions = await ctx.prisma.terminal_sessions.findMany({
          where,
          take: limit,
          orderBy: { startedAt: 'desc' },
        });
        
        return sessions.map(session => ({
          id: session.id,
          stackId: session.stackId,
          userId: session.userId,
          containerId: session.containerId,
          status: session.status as 'active' | 'closed' | 'error',
          command: session.command,
          exitCode: session.exitCode,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          lastActivity: session.lastActivity,
        }));
      } catch (error) {
        console.error('[Terminal] Error listing sessions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list terminal sessions',
        });
      }
    }),
  
  /**
   * Close a terminal session
   */
  close: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      exitCode: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { sessionId, exitCode } = input;
      
      try {
        const session = await ctx.prisma.terminal_sessions.findUnique({
          where: { id: sessionId },
        });
        
        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Terminal session not found',
          });
        }
        
        if (session.userId !== ctx.userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Not authorized to close this session',
          });
        }
        
        const updated = await ctx.prisma.terminal_sessions.update({
          where: { id: sessionId },
          data: {
            status: 'closed',
            exitCode,
            endedAt: new Date(),
          },
        });
        
        return {
          id: updated.id,
          status: updated.status as 'active' | 'closed' | 'error',
          exitCode: updated.exitCode,
          endedAt: updated.endedAt,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[Terminal] Error closing session:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to close terminal session',
        });
      }
    }),
  
  /**
   * Get WebSocket connection info for terminal
   */
  connectionInfo: publicProcedure
    .query(() => {
      return {
        wsUrl: process.env.WS_URL ?? 'ws://localhost:3001/ws',
        protocol: 'terminal',
        actions: {
          create: 'Create a new terminal session',
          input: 'Send input to terminal',
          resize: 'Resize terminal dimensions',
          close: 'Close terminal session',
        },
        messageFormats: {
          create: {
            type: 'terminal',
            payload: {
              action: 'create',
              stackId: '{stackId}',
              containerId: '{containerId}', // optional
              command: '{command}', // default: /bin/sh
              cols: 80,
              rows: 24,
            },
          },
          input: {
            type: 'terminal',
            payload: {
              action: 'input',
              sessionId: '{sessionId}',
              data: '{input}',
            },
          },
          resize: {
            type: 'terminal',
            payload: {
              action: 'resize',
              sessionId: '{sessionId}',
              cols: 80,
              rows: 24,
            },
          },
          close: {
            type: 'terminal',
            payload: {
              action: 'close',
              sessionId: '{sessionId}',
            },
          },
        },
      };
    }),
  
  /**
   * Cleanup old sessions. Admin-only: this deleteMany spans ALL users'
   * terminal_sessions (no userId filter), so a plain protectedProcedure was a
   * cross-tenant destructive IDOR.
   */
  cleanup: adminProcedure
    .input(z.object({
      olderThan: z.date().optional(),
      status: TerminalStatusSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { olderThan, status } = input;
      
      const where: Record<string, unknown> = {};
      
      if (olderThan) {
        where.startedAt = { lt: olderThan };
      }
      
      if (status) {
        where.status = status;
      } else {
        // Default: clean up closed sessions
        where.status = 'closed';
      }
      
      try {
        const result = await ctx.prisma.terminal_sessions.deleteMany({ where });
        
        return {
          deleted: result.count,
        };
      } catch (error) {
        console.error('[Terminal] Error cleaning up sessions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cleanup terminal sessions',
        });
      }
    }),
});
