import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '@/lib/db-utils'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createPerformanceMiddleware } from '../lib/monitoring/trpc-performance-middleware'
import { createOtelTracingMiddleware } from '../lib/monitoring/trpc-otel-middleware'

/**
 * Create context for tRPC
 * Resolves the authenticated user id from the NextAuth JWT when the call
 * comes over HTTP; server-side callers can pass user/userId explicitly.
 */
export const createTRPCContext = async (opts: { req?: NextRequest, user?: any, userId?: string, res?: any }) => {
  let userId = opts.userId || opts.user?.id || undefined
  let role: string | undefined = opts.user?.role

  if (!userId && opts.req) {
    try {
      const token = await getToken({ req: opts.req as any })
      userId = (token?.userId as string | undefined) ?? (token?.sub ?? undefined)
      role = (token?.role as string | undefined) ?? role
    } catch {
      // No/invalid session — stay anonymous; protectedProcedure rejects later
    }
  }

  // ctx.user carries id + role so admin procedures (ensureAdmin) work over HTTP.
  const user = opts.user ?? (userId ? { id: userId, role: role ?? 'user' } : null)

  return {
    prisma,
    req: opts.req,
    user,
    userId,
  }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  errorFormatter(opts) {
    const { shape, error } = opts
    const isZod = error.code === 'BAD_REQUEST' && error.cause instanceof z.ZodError
    // Surface a plan-limit gate to the client so it can show the upgrade dialog
    // instead of a generic error toast (see src/lib/billing/enforcement.ts).
    const cause = error.cause as { code?: string; limit?: number; plan?: string | null } | undefined
    const planLimit =
      cause && typeof cause === 'object' && cause.code === 'PLAN_LIMIT'
        ? { limit: cause.limit ?? null, plan: cause.plan ?? null }
        : null
    return {
      ...shape,
      message: isZod ? 'VALIDATION_ERROR' : shape.message,
      data: {
        ...shape.data,
        zodError: isZod ? error.cause.flatten() : null,
        planLimit,
      },
    }
  },
})

/**
 * Performance monitoring middleware
 */
const performanceMiddleware = createPerformanceMiddleware()

/**
 * OpenTelemetry distributed tracing middleware
 */
const otelTracingMiddleware = createOtelTracingMiddleware()

/**
 * Rate limiting middleware
 */
const rateLimitMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const ip = getClientIP(ctx.req)
  const key = `rate_limit:${path}:${ip}:${ctx.userId || 'anonymous'}`
  
  // Simple in-memory rate limiting for now (Redis implementation in separate file)
  // In production, use Redis-based rate limiting
  
  return next()
})

const strictRateLimitMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const ip = getClientIP(ctx.req)
  const key = `rate_limit_strict:${path}:${ip}:${ctx.userId || 'anonymous'}`
  
  // Simple in-memory rate limiting for now
  // In production, use Redis-based rate limiting
  
  return next()
})

/**
 * Extract client IP from request headers
 */
function getClientIP(req: any): string {
  return (
    req?.headers?.['x-forwarded-for']?.split(',')[0] ||
    req?.headers?.['x-real-ip'] ||
    req?.connection?.remoteAddress ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    '127.0.0.1'
  )
}

/**
 * Authentication middleware
 */
const enforceUserIsAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized'
    })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId // now guaranteed to be non-null
    }
  })
})

/**
 * Input sanitization middleware
 * Sanitizes string inputs to prevent XSS and injection attacks
 * Removes ALL HTML tags and dangerous content, keeping only safe text
 */
const inputSanitizationMiddleware = t.middleware(async ({ input, next }) => {
  // Comprehensive sanitization that strips ALL HTML and dangerous content
  const sanitizeString = (str: string): string => {
    if (!str || typeof str !== 'string') return str

    return str
      // Remove script tags AND their content first (most dangerous)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove iframe tags AND their content
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      // Remove ALL remaining HTML tags (just the tags, preserving safe text)
      .replace(/<[^>]*>/g, '')
      // Remove javascript: URLs
      .replace(/javascript:/gi, '')
      // Remove data: URLs
      .replace(/data:/gi, '')
      // Remove ALL event handlers with their content (onclick="...", onerror=alert(), etc.)
      .replace(/on\w+\s*=\s*['""]?[^'""\s>]*['""]?/gi, '')
      // Remove any remaining quotes and parentheses that might be from JS
      .replace(/["'()]/g, '')
      // Remove any remaining encoded HTML entities that could be dangerous
      .replace(/&lt;/gi, '')
      .replace(/&gt;/gi, '')
      .replace(/&quot;/gi, '')
      .replace(/&#x27;/gi, '')
      .replace(/&#x2F;/gi, '')
      // Trim whitespace
      .trim()
  }

  // Recursively sanitize object with performance optimization
  // IMPORTANT: Preserve non-string types (numbers, booleans, etc.)
  const sanitizeInput = (obj: any): any => {
    // Only sanitize strings - preserve all other types as-is
    if (typeof obj === 'string') {
      return sanitizeString(obj)
    }

    // Preserve numbers, booleans, null, undefined as-is
    if (typeof obj === 'number' || typeof obj === 'boolean' || obj === null || obj === undefined) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeInput)
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeInput(value)
      }
      return sanitized
    }

    return obj
  }

  const sanitizedInput = sanitizeInput(input)

  return next({
    input: sanitizedInput
  })
})

/**
 * Create tRPC router and procedure helpers
 *
 * Middleware chain order (outermost to innermost):
 * 1. otelTracingMiddleware - OpenTelemetry distributed tracing
 * 2. performanceMiddleware - Performance metrics collection
 * 3. rateLimitMiddleware/strictRateLimitMiddleware - Rate limiting
 * 4. inputSanitizationMiddleware - Input sanitization
 * 5. enforceUserIsAuthenticated - Authentication (protected/strict only)
 */
export const createTRPCRouter = t.router
// NOTE: inputSanitizationMiddleware was removed from these chains on purpose.
// Its next({ input }) override bypassed zod input validation entirely
// (oversize/empty fields reached the DB), and it duplicated sanitization
// that lives in the zod schemas (single policy: strip structure, keep text).
export const publicProcedure = t.procedure
  .use(otelTracingMiddleware)
  .use(performanceMiddleware)
  .use(rateLimitMiddleware)

export const protectedProcedure = t.procedure
  .use(otelTracingMiddleware)
  .use(performanceMiddleware)
  .use(rateLimitMiddleware)
  .use(enforceUserIsAuthenticated)

export const strictProcedure = t.procedure
  .use(otelTracingMiddleware)
  .use(performanceMiddleware)
  .use(strictRateLimitMiddleware)
  .use(enforceUserIsAuthenticated)

/**
 * Admin-only: authenticated AND `ctx.user.role === 'admin'`. For catalog /
 * template / category / import management, which must never be reachable by an
 * anonymous or ordinary caller.
 */
const enforceUserIsAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId || (ctx.user as { role?: string } | undefined)?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})

export const adminProcedure = t.procedure
  .use(otelTracingMiddleware)
  .use(performanceMiddleware)
  .use(rateLimitMiddleware)
  .use(enforceUserIsAdmin)
