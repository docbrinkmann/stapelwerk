/**
 * tRPC Performance Monitoring Middleware
 * 
 * Middleware that automatically tracks response times and performance metrics
 * for all tRPC endpoints. Integrates with the PerformanceMonitor service.
 */

import { TRPCError, type ProcedureType } from '@trpc/server'
import { type Context } from '../../server/trpc'
import { performanceMonitor, type PerformanceMetrics } from './performance-monitor'

export interface PerformanceMiddlewareContext {
  performanceStartTime: number
  performanceEndpointPath: string
}

/**
 * Performance monitoring middleware for tRPC procedures
 */
export function createPerformanceMiddleware() {
  return async function performanceMiddleware(opts: {
    ctx: Context
    next: () => Promise<any>
    path: string
    type: ProcedureType
    rawInput?: unknown
  }) {
    const startTime = performance.now()
    const { ctx, next, path, type } = opts

    // Add performance tracking to context
    // Enhanced context is available implicitly through closure

    let responseTime = 0
    let statusCode = 200
    let error: TRPCError | Error | null = null

    try {
      // Execute the procedure
      const result = await next()
      
      // Calculate response time
      responseTime = performance.now() - startTime
      
      // Record successful request metric
      const metric: PerformanceMetrics = {
        endpoint: path,
        method: type.toUpperCase(),
        responseTime: Math.round(responseTime),
        timestamp: new Date(),
        statusCode,
        // Optional context data if available
        userId: ctx.userId,
        userAgent: typeof ctx.req?.headers?.get === 'function' ? ctx.req.headers.get('user-agent') || undefined : undefined,
        ip: ctx.req?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() || ctx.req?.headers?.get?.('x-real-ip') || (ctx.req as any)?.socket?.remoteAddress
      }

      performanceMonitor.recordMetric(metric)

      // Validate response time against requirements
      const validation = performanceMonitor.validateResponseTime(responseTime)
      if (!validation.isValid) {
        console.error(`❌ Performance Requirement Violation: ${validation.message}`, {
          endpoint: path,
          method: type,
          responseTime: Math.round(responseTime),
          validation
        })
      }

      return result
    } catch (err) {
      // Calculate response time even for errors
      responseTime = performance.now() - startTime
      
      // Determine status code from error
      if (err instanceof TRPCError) {
        error = err
        switch (err.code) {
          case 'BAD_REQUEST':
            statusCode = 400
            break
          case 'UNAUTHORIZED':
            statusCode = 401
            break
          case 'FORBIDDEN':
            statusCode = 403
            break
          case 'NOT_FOUND':
            statusCode = 404
            break
          case 'CONFLICT':
            statusCode = 409
            break
          case 'PRECONDITION_FAILED':
            statusCode = 412
            break
          case 'PAYLOAD_TOO_LARGE':
            statusCode = 413
            break
          case 'UNPROCESSABLE_CONTENT':
            statusCode = 422
            break
          case 'TOO_MANY_REQUESTS':
            statusCode = 429
            break
          case 'CLIENT_CLOSED_REQUEST':
            statusCode = 499
            break
          case 'INTERNAL_SERVER_ERROR':
            statusCode = 500
            break
          case 'NOT_IMPLEMENTED':
            statusCode = 501
            break
          case 'SERVICE_UNAVAILABLE':
            statusCode = 503
            break
          case 'TIMEOUT':
            statusCode = 504
            break
          default:
            statusCode = 500
        }
      } else {
        error = err as Error
        statusCode = 500
      }

      // Record error metric
      const metric: PerformanceMetrics = {
        endpoint: path,
        method: type.toUpperCase(),
        responseTime: Math.round(responseTime),
        timestamp: new Date(),
        statusCode,
        userId: ctx.userId,
        userAgent: typeof ctx.req?.headers?.get === 'function' ? ctx.req.headers.get('user-agent') || undefined : undefined,
        ip: ctx.req?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() || ctx.req?.headers?.get?.('x-real-ip') || (ctx.req as any)?.socket?.remoteAddress
      }

      performanceMonitor.recordMetric(metric)

      // Log performance info for errors too
      if (responseTime > 200) {
        console.warn(`⚠️ Slow Error Response: ${path} took ${Math.round(responseTime)}ms before failing`, {
          endpoint: path,
          method: type,
          responseTime: Math.round(responseTime),
          error: error.message,
          statusCode
        })
      }

      // Re-throw the error to maintain tRPC behavior
      throw err
    }
  }
}

/**
 * Helper function to extract performance data from context
 */
export function getPerformanceContext(ctx: Context & Partial<PerformanceMiddlewareContext>) {
  return {
    startTime: ctx.performanceStartTime || 0,
    endpointPath: ctx.performanceEndpointPath || 'unknown',
    currentResponseTime: ctx.performanceStartTime ? performance.now() - ctx.performanceStartTime : 0
  }
}

/**
 * Decorator function for individual procedures to add performance monitoring
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  procedure: T,
  endpointName: string
): T {
  return ((...args: any[]) => {
    const startTime = performance.now()
    
    try {
      const result = procedure(...args)
      
      // Handle both sync and async procedures
      if (result && typeof result.then === 'function') {
        return result
          .then((res: any) => {
            const responseTime = performance.now() - startTime
            
            const metric: PerformanceMetrics = {
              endpoint: endpointName,
              method: 'PROCEDURE',
              responseTime: Math.round(responseTime),
              timestamp: new Date(),
              statusCode: 200
            }
            
            performanceMonitor.recordMetric(metric)
            return res
          })
          .catch((err: any) => {
            const responseTime = performance.now() - startTime
            
            const metric: PerformanceMetrics = {
              endpoint: endpointName,
              method: 'PROCEDURE',
              responseTime: Math.round(responseTime),
              timestamp: new Date(),
              statusCode: 500
            }
            
            performanceMonitor.recordMetric(metric)
            throw err
          })
      } else {
        // Sync procedure
        const responseTime = performance.now() - startTime
        
        const metric: PerformanceMetrics = {
          endpoint: endpointName,
          method: 'PROCEDURE',
          responseTime: Math.round(responseTime),
          timestamp: new Date(),
          statusCode: 200
        }
        
        performanceMonitor.recordMetric(metric)
        return result
      }
    } catch (err) {
      const responseTime = performance.now() - startTime
      
      const metric: PerformanceMetrics = {
        endpoint: endpointName,
        method: 'PROCEDURE',
        responseTime: Math.round(responseTime),
        timestamp: new Date(),
        statusCode: 500
      }
      
      performanceMonitor.recordMetric(metric)
      throw err
    }
  }) as T
}