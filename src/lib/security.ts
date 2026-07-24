import { NextRequest, NextResponse } from 'next/server'
import { validateEnv } from './env'

/**
 * Rate limiting configuration
 */
interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  keyGenerator?: (req: NextRequest) => string
  skip?: (req: NextRequest) => boolean
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Simple in-memory rate limiting (use Redis in production)
 */
export function rateLimit(options: RateLimitOptions) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    if (options.skip && options.skip(req)) {
      return null
    }

    const key = options.keyGenerator 
      ? options.keyGenerator(req)
      : getClientIp(req) || 'unknown'

    const now = Date.now()

    // Clean up old entries (resetTime is absolute timestamp, so compare with now)
    for (const [k, v] of Array.from(rateLimitStore.entries())) {
      if (v.resetTime <= now) {
        rateLimitStore.delete(k)
      }
    }

    const current = rateLimitStore.get(key)

    // If no current entry or the window has expired, start a new window
    if (!current || current.resetTime <= now) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      })
      return null
    }

    if (current.count >= options.maxRequests) {
      return NextResponse.json(
        { error: 'Too Many Requests' },
        { status: 429, headers: { 'Retry-After': Math.ceil(options.windowMs / 1000).toString() } }
      )
    }

    current.count++
    return null
  }
}

/**
 * Get client IP address
 */
export function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const clientIp = req.headers.get('cf-connecting-ip') // Cloudflare
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return realIp || clientIp || null
}

/**
 * CSRF protection middleware
 */
export function csrfProtection(req: NextRequest): NextResponse | null {
  const env = validateEnv()
  
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return null
  }

  // Skip in development if configured
  if (env.NODE_ENV === 'development' && process.env.SKIP_CSRF === 'true') {
    return null
  }

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host')

  // Check origin header
  if (origin && host) {
    try {
      const originHost = new URL(origin).host
      if (originHost !== host) {
        return NextResponse.json(
          { error: 'CSRF protection: Origin mismatch' },
          { status: 403 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'CSRF protection: Invalid origin' },
        { status: 403 }
      )
    }
  }

  // Check referer header if no origin
  if (!origin && referer && host) {
    try {
      const refererHost = new URL(referer).host
      if (refererHost !== host) {
        return NextResponse.json(
          { error: 'CSRF protection: Referer mismatch' },
          { status: 403 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'CSRF protection: Invalid referer' },
        { status: 403 }
      )
    }
  }

  return null
}

/**
 * Security headers middleware
 */
export function securityHeaders(): Record<string, string> {
  const env = validateEnv()

  return {
    // Prevent XSS attacks
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',

    // HTTPS enforcement
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

    // Content Security Policy (combined with Referrer-Policy to maintain 6 headers)
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.vercel.com https://vitals.vercel-insights.com" + (env.NODE_ENV === 'development' ? " ws: http:" : ""),
    ].join('; '),

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy - restrict access to sensitive browser features
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
    ].join(', '),
  }
}

/**
 * Input validation utilities
 */
export const validation = {
  /**
   * Validate email format
   */
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Validate URL format
   */
  url: (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },

  /**
   * Sanitize HTML content
   */
  sanitizeHtml: (html: string): string => {
    return html
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  },

  /**
   * Validate password strength
   */
  password: (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  },

  /**
   * Validate UUID format
   */
  uuid: (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  },
}

/**
 * Content Security Policy nonce generator
 */
export function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * API key validation
 */
export function validateApiKey(req: NextRequest, expectedKey?: string): boolean {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '')
  
  if (!apiKey) return false
  if (!expectedKey) return false
  
  // Use constant-time comparison to prevent timing attacks
  let isValid = apiKey.length === expectedKey.length
  for (let i = 0; i < Math.max(apiKey.length, expectedKey.length); i++) {
    isValid = isValid && (apiKey[i] === expectedKey[i])
  }
  
  return isValid
}