import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  
  // Release tracking for better error correlation
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || 'development',
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  debug: process.env.NODE_ENV === 'development',

  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,

  // Advanced configuration
  maxBreadcrumbs: 100,
  maxValueLength: 1024,
  normalizeDepth: 5,

  integrations: [
    new Sentry.Replay({
      maskAllText: process.env.NODE_ENV === 'production',
      blockAllMedia: true,
      maskAllInputs: true,
      sessionSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
      errorSampleRate: 1.0,
    }),
    Sentry.browserTracingIntegration({
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[^/]*stapelwerk[^/]*\.vercel\.app/,
        /^https:\/\/api\.stapelwerk\./,
      ],
    }),
    Sentry.browserProfilingIntegration(),
  ],

  // Custom tags for better filtering
  initialScope: {
    tags: {
      component: 'client',
      feature: 'ai-powered-recommendations',
      version: process.env.npm_package_version || '1.0.0',
    },
    contexts: {
      runtime: {
        name: 'browser',
        version: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      },
    },
  },

  // Enhanced error filtering and processing
  beforeSend(event, hint) {
    // Don't send console errors in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🔍 Sentry Event (Development)')
      console.log('Event:', event)
      console.log('Hint:', hint)
      console.groupEnd()
      
      // Only send errors and exceptions in development, not warnings/info
      if (event.level !== 'error' && !event.exception) {
        return null
      }
    }

    // Filter out known non-critical errors
    if (event.exception) {
      const error = event.exception.values?.[0]
      if (error?.type === 'ChunkLoadError' || 
          error?.type === 'ResizeObserver loop limit exceeded' ||
          (error?.value && error.value.includes('Non-Error promise rejection'))) {
        return null
      }
    }

    // Add custom context
    event.contexts = {
      ...event.contexts,
      buildInfo: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        deployment: process.env.VERCEL_ENV || 'local',
      },
    }

    return event
  },

  // Performance monitoring configuration
  tracesSampler(samplingContext) {
    // Higher sampling for recommendation-related operations
    if (samplingContext.name?.includes('recommendation') ||
        samplingContext.request?.url?.includes('/api/trpc/recommendation')) {
      return process.env.NODE_ENV === 'production' ? 0.5 : 1.0
    }

    // Lower sampling for static assets
    if (samplingContext.request?.url?.includes('/_next/static')) {
      return 0.01
    }

    // Default sampling rate
    return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
  },
})
