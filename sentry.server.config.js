import * as Sentry from '@sentry/nextjs'
import { ProfilingIntegration } from '@sentry/profiling-node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  
  // Release tracking for better error correlation
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || 'development',
  
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  debug: process.env.NODE_ENV === 'development',

  // Advanced configuration
  maxBreadcrumbs: 100,
  maxValueLength: 2048,
  normalizeDepth: 5,
  attachStacktrace: true,
  sendDefaultPii: false,

  integrations: [
    // Add profiling integration for server-side performance monitoring
    new ProfilingIntegration(),
    
    // HTTP integration for tracing HTTP requests
    Sentry.httpIntegration({
      tracing: {
        ignoreIncomingRequests: (url) => {
          // Ignore health checks and static assets
          return url.includes('/api/health') || 
                 url.includes('/_next/static') ||
                 url.includes('/favicon.ico')
        },
        ignoreOutgoingRequests: (url) => {
          // Ignore requests to monitoring services themselves
          return url.includes('sentry.io') ||
                 url.includes('vercel.com/api')
        },
      },
    }),

    // Prisma integration for database monitoring
    Sentry.prismaIntegration(),
  ],

  // Custom tags for better filtering
  initialScope: {
    tags: {
      component: 'server',
      feature: 'ai-powered-recommendations',
      version: process.env.npm_package_version || '1.0.0',
      runtime: 'nodejs',
    },
    contexts: {
      runtime: {
        name: 'node',
        version: process.version,
      },
      server: {
        name: 'vercel',
        region: process.env.VERCEL_REGION || 'unknown',
      },
    },
  },

  // Enhanced error filtering and processing
  beforeSend(event, hint) {
    // Enhanced development logging
    if (process.env.NODE_ENV === 'development') {
      console.group('🔍 Sentry Server Event (Development)')
      console.log('Event:', event)
      console.log('Hint:', hint)
      console.log('Original Exception:', hint.originalException)
      console.groupEnd()
    }

    // Filter out known non-critical server errors
    if (event.exception) {
      const error = event.exception.values?.[0]
      
      // Filter out common non-actionable errors
      if (error?.type === 'AbortError' ||
          error?.value?.includes('This operation was aborted') ||
          error?.value?.includes('Connection terminated unexpectedly')) {
        return null
      }
    }

    // Add server context
    event.contexts = {
      ...event.contexts,
      server: {
        node_version: process.version,
        platform: process.platform,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime(),
        vercel_region: process.env.VERCEL_REGION,
        vercel_env: process.env.VERCEL_ENV,
        timestamp: new Date().toISOString(),
      },
    }

    // Add request context if available
    if (hint.request) {
      event.contexts.request = {
        url: hint.request.url,
        method: hint.request.method,
        headers: {
          'user-agent': hint.request.headers['user-agent'],
          'content-type': hint.request.headers['content-type'],
          'x-forwarded-for': hint.request.headers['x-forwarded-for'],
        },
      }
    }

    return event
  },

  // Performance monitoring configuration
  tracesSampler(samplingContext) {
    // Higher sampling for API routes
    if (samplingContext.request?.url?.includes('/api/')) {
      // Very high sampling for recommendation APIs
      if (samplingContext.request.url.includes('recommendation')) {
        return process.env.NODE_ENV === 'production' ? 0.8 : 1.0
      }
      
      // High sampling for other tRPC APIs
      if (samplingContext.request.url.includes('/api/trpc/')) {
        return process.env.NODE_ENV === 'production' ? 0.5 : 1.0
      }
      
      // Normal sampling for other APIs
      return process.env.NODE_ENV === 'production' ? 0.3 : 1.0
    }

    // Lower sampling for health checks and static content
    if (samplingContext.request?.url?.includes('/api/health') ||
        samplingContext.request?.url?.includes('/_next/')) {
      return 0.01
    }

    // Default sampling rate
    return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
  },

  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
})
