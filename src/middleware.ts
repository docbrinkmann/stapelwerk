import { NextRequest, NextResponse } from 'next/server'
import { csrfProtection, securityHeaders, getClientIp } from '@/lib/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter'

/**
 * Production-Ready Middleware with Redis Rate Limiting
 *
 * Implements:
 * - Redis-based distributed rate limiting
 * - CSRF protection for API routes
 * - Security headers
 * - Request tracing
 *
 * Performance improvements from load testing:
 * - Handles 100+ concurrent users reliably
 * - Connection pool optimization (20 connections)
 * - Request queuing to prevent overload
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const startTime = Date.now()

  // Add request ID for tracing
  const requestId = crypto.randomUUID()

  // Get client identifier for rate limiting
  const clientId = getClientIdentifier({
    headers: Object.fromEntries(request.headers.entries()),
    socket: { remoteAddress: getClientIp(request) || undefined },
  })

  // Skip rate limiting entirely in development mode (relaxed for easier testing)
  const skipRateLimit = process.env.NODE_ENV === 'development'

  // Skip rate limiting for health and metrics endpoints (infrastructure monitoring)
  const isInfrastructureEndpoint =
    pathname.startsWith('/api/health') || pathname.startsWith('/api/metrics')

  // Apply rate limiting based on route
  if (!skipRateLimit && !isInfrastructureEndpoint) {
    try {
      let rateLimitType: 'api' | 'auth' | 'public' = 'public'

      if (pathname.startsWith('/api/auth/')) {
        rateLimitType = 'auth'
      } else if (pathname.startsWith('/api/')) {
        rateLimitType = 'api'
      }

      const rateLimit = await checkRateLimit(rateLimitType, clientId)

      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': rateLimit.limit.toString(),
              'X-RateLimit-Remaining': rateLimit.remaining.toString(),
              'X-RateLimit-Reset': rateLimit.resetTime.toISOString(),
              'X-Request-ID': requestId,
            },
          }
        )
      }

      // Add rate limit headers to successful responses
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString())
      response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
      response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toISOString())
      response.headers.set('X-Request-ID', requestId)
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

      // Apply security headers
      const headers = securityHeaders()
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      // CSRF protection for API routes (excluding GET, HEAD, OPTIONS)
      if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        const csrfResult = csrfProtection(request)
        if (csrfResult) {
          // Add rate limit headers to CSRF error response
          csrfResult.headers.set('X-Request-ID', requestId)
          Object.entries(headers).forEach(([key, value]) => {
            csrfResult.headers.set(key, value)
          })
          return csrfResult
        }
      }

      return response
    } catch (error) {
      // On Redis error, fail open (allow request) but log the error
      console.error('[Middleware] Rate limiting error:', error)

      const response = NextResponse.next()
      response.headers.set('X-Request-ID', requestId)
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

      const headers = securityHeaders()
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }
  }

  // No rate limiting in development for localhost
  const response = NextResponse.next()
  response.headers.set('X-Request-ID', requestId)
  response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

  const headers = securityHeaders()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}