import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { initTRPC } from '@trpc/server'
import type { Context } from './trpc'

// Initialize tRPC for middleware
const t = initTRPC.context<Context>().create()

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting configuration from environment variables
// RATE_LIMIT_WINDOW is in seconds (default: 60 seconds = 1 minute)
// RATE_LIMIT_MAX is max requests per window (default: 1000 requests)
const RATE_LIMIT_WINDOW = (parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10) * 1000) // Convert seconds to milliseconds
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '1000', 10)

/**
 * Rate limiting middleware
 * Implements a simple in-memory rate limiter
 * In production, this should use Redis or similar distributed storage
 */
export const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    return next()
  }

  // Skip rate limiting for localhost during development/testing
  if (process.env.SKIP_RATE_LIMIT === 'true') {
    return next()
  }

  // Get client IP from request
  let clientIP = 'unknown'
  
  if (ctx.req) {
    // Try different headers to get real IP
    clientIP = 
      ctx.req.headers.get('x-forwarded-for')?.split(',')[0] ||
      ctx.req.headers.get('x-real-ip') ||
      ctx.req.headers.get('cf-connecting-ip') ||
      ctx.req.headers.get('host') ||
      'unknown'
  }

  // Skip localhost requests during development
  if (clientIP === 'localhost' || clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.startsWith('localhost:')) {
    return next()
  }

  const now = Date.now()
  const key = `rate_limit:${clientIP}`
  
  // Get current rate limit data
  const rateLimitData = rateLimitStore.get(key)
  
  if (!rateLimitData || now > rateLimitData.resetTime) {
    // Reset rate limit window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    })
  } else {
    // Check if rate limit exceeded
    if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
      const timeUntilReset = Math.ceil((rateLimitData.resetTime - now) / 1000)
      
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Please try again in ${timeUntilReset} seconds.`
      })
    }
    
    // Increment request count
    rateLimitData.count += 1
    rateLimitStore.set(key, rateLimitData)
  }

  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    const cutoff = now - RATE_LIMIT_WINDOW
    for (const [key, data] of rateLimitStore.entries()) {
      if (data.resetTime < cutoff) {
        rateLimitStore.delete(key)
      }
    }
  }

  return next()
})

/**
 * Error handling middleware
 * Provides comprehensive error logging and standardized error responses
 */
export const errorHandlingMiddleware = t.middleware(async ({ ctx, next }) => {
  const start = Date.now()
  
  try {
    const result = await next()
    
    // Log successful requests in development
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - start
      console.log(`✅ tRPC success - ${duration}ms`)
    }
    
    return result
  } catch (error) {
    const duration = Date.now() - start
    
    // Log error details
    if (error instanceof TRPCError) {
      // Log tRPC errors
      console.error(`❌ tRPC error [${error.code}] - ${duration}ms:`, {
        code: error.code,
        message: error.message,
        cause: error.cause,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    } else if (error instanceof z.ZodError) {
      // Handle Zod validation errors
      console.error(`❌ Validation error - ${duration}ms:`, error.issues)
      
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        cause: error
      })
    } else if (error instanceof Error) {
      // Log unexpected errors
      console.error(`❌ Unexpected error - ${duration}ms:`, {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
      
      // Don't expose internal error details in production
      if (process.env.NODE_ENV === 'production') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        })
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
        cause: error
      })
    } else {
      // Handle non-Error objects
      console.error(`❌ Unknown error - ${duration}ms:`, error)
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unknown error occurred'
      })
    }
    
    throw error
  }
})

/**
 * Performance monitoring middleware
 * Logs slow queries and provides performance insights
 */
export const performanceMiddleware = t.middleware(async ({ path, next }) => {
  const start = Date.now()
  
  try {
    const result = await next()
    const duration = Date.now() - start
    
    // Log slow queries (>500ms as per requirements)
    if (duration > 500) {
      console.warn(`🐌 Slow query detected - ${path}: ${duration}ms`)
    }
    
    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.log(`⏱️  ${path}: ${duration}ms`)
    }
    
    return result
  } catch (error) {
    const duration = Date.now() - start
    console.error(`💥 Failed query - ${path}: ${duration}ms`)
    throw error
  }
})

/**
 * Input sanitization middleware
 * Sanitizes string inputs to prevent XSS and injection attacks
 * Removes ALL HTML tags and dangerous content, keeping only safe text
 */
export const inputSanitizationMiddleware = t.middleware(async ({ input, next }) => {
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
 * Create a protected procedure with all middleware applied
 */
export const rateLimitedProcedure = t.procedure
  .use(rateLimitMiddleware)
  .use(errorHandlingMiddleware)
  .use(performanceMiddleware)
  .use(inputSanitizationMiddleware)

/**
 * Create a procedure with error handling but no rate limiting (for internal use)
 */
export const protectedProcedure = t.procedure
  .use(errorHandlingMiddleware)
  .use(performanceMiddleware)
  .use(inputSanitizationMiddleware)

/**
 * Utility functions for error handling
 */
export const ErrorUtils = {
  /**
   * Create a standardized validation error
   */
  validationError: (message: string, field?: string) => {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message,
      cause: field ? { field } : undefined
    })
  },

  /**
   * Create a standardized not found error
   */
  notFoundError: (resource: string = 'Resource') => {
    return new TRPCError({
      code: 'NOT_FOUND',
      message: `${resource} not found`
    })
  },

  /**
   * Create a standardized conflict error
   */
  conflictError: (message: string) => {
    return new TRPCError({
      code: 'CONFLICT',
      message
    })
  },

  /**
   * Create a standardized unauthorized error
   */
  unauthorizedError: (message: string = 'Unauthorized') => {
    return new TRPCError({
      code: 'UNAUTHORIZED',
      message
    })
  },

  /**
   * Create a standardized forbidden error
   */
  forbiddenError: (message: string = 'Forbidden') => {
    return new TRPCError({
      code: 'FORBIDDEN',
      message
    })
  },

  /**
   * Handle Prisma errors and convert to tRPC errors
   */
  handlePrismaError: (error: any) => {
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field'
      return new TRPCError({
        code: 'CONFLICT',
        message: `A record with this ${field} already exists`
      })
    }
    
    if (error.code === 'P2003') {
      // Foreign key constraint violation
      return new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid reference to related record'
      })
    }
    
    if (error.code === 'P2025') {
      // Record not found
      return new TRPCError({
        code: 'NOT_FOUND',
        message: 'Record not found'
      })
    }
    
    // Default to internal server error
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database error occurred'
    })
  }
}

/**
 * Rate limit configuration utilities
 */
export const RateLimitUtils = {
  /**
   * Clear rate limit for a specific IP (useful for testing)
   */
  clearRateLimit: (ip: string) => {
    rateLimitStore.delete(`rate_limit:${ip}`)
  },

  /**
   * Clear all rate limit data
   */
  clearAllRateLimits: () => {
    rateLimitStore.clear()
  },

  /**
   * Get current rate limit info for an IP
   */
  getRateLimitInfo: (ip: string) => {
    const data = rateLimitStore.get(`rate_limit:${ip}`)
    if (!data) {
      return { count: 0, remaining: RATE_LIMIT_MAX_REQUESTS, resetTime: null }
    }
    
    return {
      count: data.count,
      remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - data.count),
      resetTime: new Date(data.resetTime)
    }
  }
}