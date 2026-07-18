import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'
import { TRPCError } from '@trpc/server'

// Mock Prisma client
vi.mock('@/lib/db-utils', () => ({
  prisma: {
    deployment_logs: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    terminal_sessions: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    stacks: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db-utils'

describe('Logs Router Integration Tests', () => {
  let caller: ReturnType<typeof appRouter.createCaller>
  
  beforeEach(async () => {
    vi.clearAllMocks()
    
    const ctx = await createTRPCContext({
      req: undefined,
      userId: 'test-user-id',
    })
    caller = appRouter.createCaller(ctx)

    // logs.*/terminal.* now verify stack ownership; default the caller as owner
    // (per-test mocks override this for the not-found / unauthorized cases).
    ;(prisma.stacks.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'test-user-id' })
  })

  describe('logs.list', () => {
    it('returns paginated logs for a stack', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          stackId: 'stack-123',
          deploymentId: null,
          level: 'info',
          source: 'system',
          message: 'Test log message',
          metadata: null,
          timestamp: new Date(),
        },
      ]
      
      ;(prisma.deployment_logs.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs)
      
      const result = await caller.logs.list({
        stackId: 'stack-123',
        limit: 10,
      })
      
      expect(result.logs).toHaveLength(1)
      expect(result.logs[0].message).toBe('Test log message')
    })

    it('filters logs by level', async () => {
      ;(prisma.deployment_logs.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      
      await caller.logs.list({
        stackId: 'stack-123',
        level: ['error', 'warn'],
        limit: 10,
      })
      
      expect(prisma.deployment_logs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            level: { in: ['error', 'warn'] },
          }),
        })
      )
    })

    it('supports cursor-based pagination', async () => {
      const mockLogs = Array.from({ length: 11 }, (_, i) => ({
        id: `log-${i}`,
        stackId: 'stack-123',
        deploymentId: null,
        level: 'info',
        source: 'system',
        message: `Log ${i}`,
        metadata: null,
        timestamp: new Date(),
      }))
      
      ;(prisma.deployment_logs.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs)
      
      const result = await caller.logs.list({
        stackId: 'stack-123',
        limit: 10,
      })
      
      expect(result.nextCursor).toBeDefined()
    })
  })

  describe('logs.stats', () => {
    it('returns log statistics', async () => {
      ;(prisma.deployment_logs.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20)  // debug
        .mockResolvedValueOnce(50)  // info
        .mockResolvedValueOnce(20)  // warn
        .mockResolvedValueOnce(10)  // error
      
      const result = await caller.logs.stats({
        stackId: 'stack-123',
        timeRange: '24h',
      })
      
      expect(result.total).toBe(100)
      expect(result.byLevel.info).toBe(50)
      expect(result.byLevel.error).toBe(10)
    })
  })

  describe('logs.streamInfo', () => {
    it('returns WebSocket connection info', async () => {
      const result = await caller.logs.streamInfo()
      
      expect(result.wsUrl).toContain('ws://')
      expect(result.protocol).toBe('logs')
      expect(result.subscribeMessage).toBeDefined()
    })
  })

  describe('logs.clear', () => {
    it('deletes logs for a stack', async () => {
      ;(prisma.deployment_logs.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 50 })
      
      const result = await caller.logs.clear({
        stackId: 'stack-123',
      })
      
      expect(result.deleted).toBe(50)
    })
  })
})

describe('Terminal Router Integration Tests', () => {
  let caller: ReturnType<typeof appRouter.createCaller>
  
  beforeEach(async () => {
    vi.clearAllMocks()
    
    const ctx = await createTRPCContext({
      req: undefined,
      userId: 'test-user-id',
    })
    caller = appRouter.createCaller(ctx)

    // logs.*/terminal.* now verify stack ownership; default the caller as owner
    // (per-test mocks override this for the not-found / unauthorized cases).
    ;(prisma.stacks.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'test-user-id' })
  })

  describe('terminal.create', () => {
    it('creates a new terminal session', async () => {
      ;(prisma.stacks.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'stack-123',
        userId: 'test-user-id',
      })
      
      const mockSession = {
        id: 'session-123',
        stackId: 'stack-123',
        userId: 'test-user-id',
        containerId: null,
        status: 'active',
        command: '/bin/sh',
        startedAt: new Date(),
        lastActivity: new Date(),
      }
      
      ;(prisma.terminal_sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      
      const result = await caller.terminal.create({
        stackId: 'stack-123',
      })
      
      expect(result.id).toBe('session-123')
      expect(result.status).toBe('active')
      expect(result.wsUrl).toBeDefined()
    })

    it('throws error for non-existent stack', async () => {
      ;(prisma.stacks.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      
      await expect(
        caller.terminal.create({ stackId: 'non-existent' })
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('terminal.get', () => {
    it('returns session by ID', async () => {
      const mockSession = {
        id: 'session-123',
        stackId: 'stack-123',
        userId: 'test-user-id',
        containerId: null,
        status: 'active',
        command: '/bin/sh',
        exitCode: null,
        startedAt: new Date(),
        endedAt: null,
        lastActivity: new Date(),
      }
      
      ;(prisma.terminal_sessions.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      
      const result = await caller.terminal.get({ sessionId: 'session-123' })
      
      expect(result.id).toBe('session-123')
    })

    it('throws error for unauthorized access', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'other-user-id', // Different user
        // ...
      }
      
      ;(prisma.terminal_sessions.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      
      await expect(
        caller.terminal.get({ sessionId: 'session-123' })
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('terminal.list', () => {
    it('returns sessions for a stack', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          stackId: 'stack-123',
          userId: 'test-user-id',
          status: 'active',
          command: '/bin/sh',
          startedAt: new Date(),
          lastActivity: new Date(),
        },
      ]
      
      ;(prisma.terminal_sessions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockSessions)
      
      const result = await caller.terminal.list({
        stackId: 'stack-123',
      })
      
      expect(result).toHaveLength(1)
    })
  })

  describe('terminal.close', () => {
    it('closes an active session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'test-user-id',
        status: 'active',
      }
      
      ;(prisma.terminal_sessions.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      ;(prisma.terminal_sessions.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSession,
        status: 'closed',
        exitCode: 0,
        endedAt: new Date(),
      })
      
      const result = await caller.terminal.close({
        sessionId: 'session-123',
        exitCode: 0,
      })
      
      expect(result.status).toBe('closed')
    })
  })

  describe('terminal.connectionInfo', () => {
    it('returns WebSocket connection info', async () => {
      const result = await caller.terminal.connectionInfo()
      
      expect(result.wsUrl).toContain('ws://')
      expect(result.protocol).toBe('terminal')
      expect(result.actions).toBeDefined()
      expect(result.messageFormats).toBeDefined()
    })
  })
})
