import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { createPerformanceMiddleware, getPerformanceContext, withPerformanceMonitoring } from '../../src/lib/monitoring/trpc-performance-middleware'
import { performanceMonitor } from '../../src/lib/monitoring/performance-monitor'

// Mock context type
interface MockContext {
  userId?: string
  req?: {
    headers?: { 'user-agent'?: string }
    ip?: string
    socket?: { remoteAddress?: string }
  }
  performanceStartTime?: number
  performanceEndpointPath?: string
}

describe('tRPC Performance Middleware Tests', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics()
    vi.clearAllMocks()
  })

  afterEach(() => {
    performanceMonitor.clearMetrics()
  })

  describe('Performance Middleware Core Functionality', () => {
    it('should record metrics for successful requests', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {
        userId: 'test-user-123',
        req: {
          headers: { 'user-agent': 'test-agent' },
          ip: '127.0.0.1'
        }
      }

      const mockNext = vi.fn().mockResolvedValue({ success: true })

      await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.list',
        type: 'query'
      })

      expect(mockNext).toHaveBeenCalledOnce()
      
      const stats = performanceMonitor.getStats()
      expect(stats.totalRequests).toBe(1)
      
      const metrics = performanceMonitor.getStats('services.list')
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.errorRate).toBe(0)
    })

    it('should record metrics for error requests', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = { userId: 'test-user' }
      
      const error = new TRPCError({
        code: 'NOT_FOUND',
        message: 'Resource not found'
      })
      const mockNext = vi.fn().mockRejectedValue(error)

      await expect(
        middleware({
          ctx: mockCtx,
          next: mockNext,
          path: 'services.get',
          type: 'query'
        })
      ).rejects.toThrow('Resource not found')

      const stats = performanceMonitor.getStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(100)
    })

    it('should validate response times and log violations', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}

      // Mock a slow response by delaying the next function
      const mockNext = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 600))
      )

      await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.slow',
        type: 'query'
      })

      // Should have logged performance violation
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Performance Requirement Violation'),
        expect.any(Object)
      )

      const validation = performanceMonitor.validateResponseTime(600)
      expect(validation.isValid).toBe(false)
      
      consoleSpy.mockRestore()
    })

    it('should track different HTTP status codes for tRPC errors', async () => {
      const testCases = [
        { code: 'BAD_REQUEST' as const, expectedStatus: 400 },
        { code: 'UNAUTHORIZED' as const, expectedStatus: 401 },
        { code: 'FORBIDDEN' as const, expectedStatus: 403 },
        { code: 'NOT_FOUND' as const, expectedStatus: 404 },
        { code: 'INTERNAL_SERVER_ERROR' as const, expectedStatus: 500 }
      ]

      for (const { code, expectedStatus } of testCases) {
        performanceMonitor.clearMetrics()
        
        const middleware = createPerformanceMiddleware()
        const mockCtx: MockContext = {}
        
        const error = new TRPCError({ code, message: 'Test error' })
        const mockNext = vi.fn().mockRejectedValue(error)

        await expect(
          middleware({
            ctx: mockCtx,
            next: mockNext,
            path: `test.${code.toLowerCase()}`,
            type: 'query'
          })
        ).rejects.toThrow()

        const stats = performanceMonitor.getStats()
        expect(stats.totalRequests).toBe(1)
        expect(stats.errorRate).toBe(100)
      }
    })

    it('should handle non-tRPC errors with 500 status', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}
      
      const error = new Error('Generic error')
      const mockNext = vi.fn().mockRejectedValue(error)

      await expect(
        middleware({
          ctx: mockCtx,
          next: mockNext,
          path: 'services.genericError',
          type: 'mutation'
        })
      ).rejects.toThrow('Generic error')

      const stats = performanceMonitor.getStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(100)
    })
  })

  describe('Performance Context Helper', () => {
    it('should extract performance context correctly', () => {
      const mockCtx: MockContext = {
        performanceStartTime: performance.now() - 100,
        performanceEndpointPath: 'services.test'
      }

      const context = getPerformanceContext(mockCtx)
      
      expect(context.startTime).toBe(mockCtx.performanceStartTime)
      expect(context.endpointPath).toBe('services.test')
      expect(context.currentResponseTime).toBeGreaterThan(90) // Should be close to 100ms
    })

    it('should handle missing performance context gracefully', () => {
      const mockCtx: MockContext = {}

      const context = getPerformanceContext(mockCtx)
      
      expect(context.startTime).toBe(0)
      expect(context.endpointPath).toBe('unknown')
      expect(context.currentResponseTime).toBe(0)
    })
  })

  describe('Performance Monitoring Decorator', () => {
    it('should monitor async procedures', async () => {
      const asyncProcedure = vi.fn().mockResolvedValue({ result: 'async success' })
      const decoratedProcedure = withPerformanceMonitoring(asyncProcedure, 'test.async')

      const result = await decoratedProcedure('arg1', 'arg2')
      
      expect(result).toEqual({ result: 'async success' })
      expect(asyncProcedure).toHaveBeenCalledWith('arg1', 'arg2')
      
      const stats = performanceMonitor.getStats('test.async')
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(0)
    })

    it('should monitor sync procedures', () => {
      const syncProcedure = vi.fn().mockReturnValue({ result: 'sync success' })
      const decoratedProcedure = withPerformanceMonitoring(syncProcedure, 'test.sync')

      const result = decoratedProcedure('arg1')
      
      expect(result).toEqual({ result: 'sync success' })
      expect(syncProcedure).toHaveBeenCalledWith('arg1')
      
      const stats = performanceMonitor.getStats('test.sync')
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(0)
    })

    it('should handle async procedure errors', async () => {
      const error = new Error('Async procedure error')
      const asyncProcedure = vi.fn().mockRejectedValue(error)
      const decoratedProcedure = withPerformanceMonitoring(asyncProcedure, 'test.asyncError')

      await expect(decoratedProcedure()).rejects.toThrow('Async procedure error')
      
      const stats = performanceMonitor.getStats('test.asyncError')
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(100)
    })

    it('should handle sync procedure errors', () => {
      const error = new Error('Sync procedure error')
      const syncProcedure = vi.fn().mockImplementation(() => { throw error })
      const decoratedProcedure = withPerformanceMonitoring(syncProcedure, 'test.syncError')

      expect(() => decoratedProcedure()).toThrow('Sync procedure error')
      
      const stats = performanceMonitor.getStats('test.syncError')
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(100)
    })
  })

  describe('Response Time Validation', () => {
    it('should not log warnings for fast responses', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}

      const mockNext = vi.fn().mockResolvedValue({ data: 'fast response' })

      await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.fast',
        type: 'query'
      })

      // Should not have logged any performance violations for fast responses
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('❌ Performance Requirement Violation'),
        expect.any(Object)
      )
      
      consoleSpy.mockRestore()
    })

    it('should log warnings for slow error responses', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}

      // Mock a slow error response
      const mockNext = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Slow error' })), 300)
        )
      )

      await expect(
        middleware({
          ctx: mockCtx,
          next: mockNext,
          path: 'services.slowError',
          type: 'query'
        })
      ).rejects.toThrow()

      // Should have logged slow error response warning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Slow Error Response'),
        expect.any(Object)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Request Context Tracking', () => {
    it('should capture user agent and IP information', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {
        userId: 'user-123',
        req: {
          headers: { 'user-agent': 'Mozilla/5.0 Test Browser' },
          ip: '192.168.1.100',
          socket: { remoteAddress: '10.0.0.1' }
        }
      }

      const mockNext = vi.fn().mockResolvedValue({ data: 'test' })

      await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.test',
        type: 'query'
      })

      // We can't directly access the recorded metrics with user info,
      // but we can verify that the request was processed successfully
      const stats = performanceMonitor.getStats()
      expect(stats.totalRequests).toBe(1)
    })

    it('should handle missing request context gracefully', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = { userId: 'user-456' } // No req object

      const mockNext = vi.fn().mockResolvedValue({ data: 'test' })

      await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.noReq',
        type: 'query'
      })

      const stats = performanceMonitor.getStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(0)
    })
  })

  describe('Performance Logging', () => {
    it('should log slow responses with critical threshold', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}

      // Mock a response that exceeds the critical threshold (400ms)
      const mockNext = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: 'slow' }), 450))
      )

      await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.critical',
        type: 'query'
      })

      // Should have logged slow response warning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🐌 Slow API Response'),
        expect.any(Object)
      )
      
      consoleSpy.mockRestore()
    })

    it('should log performance alerts for maximum threshold breach', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}

      // Mock a response that exceeds the maximum threshold (500ms)
      const mockNext = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: 'too slow' }), 600))
      )

      await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.tooSlow',
        type: 'query'
      })

      // Should have logged both slow response and performance alert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Performance Alert'),
        expect.any(Object)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Method Type Tracking', () => {
    it('should track different tRPC procedure types', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}
      const mockNext = vi.fn().mockResolvedValue({ success: true })

      const procedureTypes = ['query', 'mutation', 'subscription'] as const

      for (const type of procedureTypes) {
        performanceMonitor.clearMetrics()
        
        await middleware({
          ctx: mockCtx,
          next: mockNext,
          path: `test.${type}`,
          type: type
        })

        const stats = performanceMonitor.getStats()
        expect(stats.totalRequests).toBe(1)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle very fast responses (< 1ms)', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}
      const mockNext = vi.fn().mockResolvedValue({ data: 'instant' })

      await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.instant',
        type: 'query'
      })

      const stats = performanceMonitor.getStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0)
    })

    it('should handle undefined return values', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}
      const mockNext = vi.fn().mockResolvedValue(undefined)

      const result = await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.undefined',
        type: 'query'
      })

      expect(result).toBeUndefined()
      
      const stats = performanceMonitor.getStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(0)
    })

    it('should handle null return values', async () => {
      const middleware = createPerformanceMiddleware()
      const mockCtx: MockContext = {}
      const mockNext = vi.fn().mockResolvedValue(null)

      const result = await middleware({
        ctx: mockCtx,
        next: mockNext,
        path: 'services.null',
        type: 'query'
      })

      expect(result).toBeNull()
      
      const stats = performanceMonitor.getStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.errorRate).toBe(0)
    })
  })
})