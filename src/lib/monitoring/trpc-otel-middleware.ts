/**
 * tRPC OpenTelemetry Tracing Middleware
 *
 * Middleware that automatically creates OpenTelemetry spans for all tRPC procedures,
 * enabling distributed tracing across the application.
 *
 * @see https://opentelemetry.io/docs/instrumentation/js/
 * @see https://trpc.io/docs/server/middlewares
 */

import { TRPCError, type ProcedureType } from '@trpc/server'
import { trace, SpanStatusCode, type Span } from '@opentelemetry/api'
import { type Context } from '../../server/trpc'

/**
 * Get the active OpenTelemetry tracer
 */
const tracer = trace.getTracer('build-my-stack-trpc')

/**
 * Map tRPC error codes to OpenTelemetry span status codes
 */
function getTRPCErrorSpanStatus(error: TRPCError): SpanStatusCode {
  switch (error.code) {
    case 'BAD_REQUEST':
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
    case 'NOT_FOUND':
    case 'CONFLICT':
    case 'PRECONDITION_FAILED':
    case 'PAYLOAD_TOO_LARGE':
    case 'UNPROCESSABLE_CONTENT':
    case 'TOO_MANY_REQUESTS':
    case 'CLIENT_CLOSED_REQUEST':
      // Client errors - don't mark as error in span
      return SpanStatusCode.OK

    case 'INTERNAL_SERVER_ERROR':
    case 'NOT_IMPLEMENTED':
    case 'SERVICE_UNAVAILABLE':
    case 'TIMEOUT':
    default:
      // Server errors - mark as error in span
      return SpanStatusCode.ERROR
  }
}

/**
 * Get HTTP status code from tRPC error code
 */
function getTRPCErrorStatusCode(error: TRPCError): number {
  switch (error.code) {
    case 'BAD_REQUEST':
      return 400
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'CONFLICT':
      return 409
    case 'PRECONDITION_FAILED':
      return 412
    case 'PAYLOAD_TOO_LARGE':
      return 413
    case 'UNPROCESSABLE_CONTENT':
      return 422
    case 'TOO_MANY_REQUESTS':
      return 429
    case 'CLIENT_CLOSED_REQUEST':
      return 499
    case 'INTERNAL_SERVER_ERROR':
      return 500
    case 'NOT_IMPLEMENTED':
      return 501
    case 'SERVICE_UNAVAILABLE':
      return 503
    case 'TIMEOUT':
      return 504
    default:
      return 500
  }
}

/**
 * OpenTelemetry tracing middleware for tRPC procedures
 *
 * Creates a new span for each tRPC procedure execution, capturing:
 * - Procedure path and type
 * - User context (if available)
 * - Response time
 * - Errors and status codes
 * - Custom attributes
 */
export function createOtelTracingMiddleware() {
  return async function otelTracingMiddleware(opts: {
    ctx: Context
    next: () => Promise<any>
    path: string
    type: ProcedureType
    rawInput?: unknown
  }) {
    const { ctx, next, path, type } = opts

    // Create a new span for this procedure
    return tracer.startActiveSpan(
      `trpc.${type}.${path}`,
      {
        attributes: {
          // RPC semantic conventions
          'rpc.system': 'trpc',
          'rpc.service': 'build-my-stack',
          'rpc.method': path,
          'rpc.procedure_type': type,

          // User context
          ...(ctx.userId && { 'user.id': ctx.userId }),

          // Request metadata
          ...(ctx.req?.headers && {
            'http.user_agent': typeof ctx.req.headers.get === 'function'
              ? ctx.req.headers.get('user-agent') || 'unknown'
              : 'unknown',
          }),

          // Custom attributes
          'service.name': 'build-my-stack',
          'service.version': process.env.npm_package_version || '1.0.0',
        },
      },
      async (span: Span) => {
        const startTime = performance.now()

        try {
          // Execute the procedure
          const result = await next()

          // Calculate response time
          const responseTime = performance.now() - startTime

          // Add success attributes
          span.setAttributes({
            'http.status_code': 200,
            'rpc.response_time_ms': Math.round(responseTime),
          })

          // Mark span as successful
          span.setStatus({ code: SpanStatusCode.OK })

          return result
        } catch (err) {
          // Calculate response time even for errors
          const responseTime = performance.now() - startTime

          // Handle tRPC errors
          if (err instanceof TRPCError) {
            const statusCode = getTRPCErrorStatusCode(err)
            const spanStatus = getTRPCErrorSpanStatus(err)

            span.setAttributes({
              'http.status_code': statusCode,
              'rpc.response_time_ms': Math.round(responseTime),
              'error.code': err.code,
              'error.message': err.message,
            })

            span.setStatus({
              code: spanStatus,
              message: err.message,
            })

            // Record the exception for server errors
            if (spanStatus === SpanStatusCode.ERROR) {
              span.recordException(err)
            }
          } else {
            // Handle non-tRPC errors
            const error = err as Error

            span.setAttributes({
              'http.status_code': 500,
              'rpc.response_time_ms': Math.round(responseTime),
              'error.message': error.message,
              'error.stack': error.stack || '',
            })

            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            })

            span.recordException(error)
          }

          // Re-throw the error to maintain tRPC behavior
          throw err
        } finally {
          // Always end the span
          span.end()
        }
      }
    )
  }
}

/**
 * Helper function to create custom spans within tRPC procedures
 *
 * @example
 * ```typescript
 * export const myProcedure = publicProcedure
 *   .query(async ({ ctx }) => {
 *     return await createCustomSpan('database.query', async (span) => {
 *       span.setAttribute('db.table', 'users')
 *       return ctx.prisma.user.findMany()
 *     })
 *   })
 * ```
 */
export async function createCustomSpan<T>(
  spanName: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return tracer.startActiveSpan(
    spanName,
    { attributes },
    async (span: Span) => {
      try {
        const result = await fn(span)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        })
        span.recordException(error as Error)
        throw error
      } finally {
        span.end()
      }
    }
  )
}
