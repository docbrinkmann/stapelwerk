import * as Sentry from '@sentry/nextjs'
import { validateEnv } from './env'

/**
 * Initialize monitoring and error tracking
 */
import { alertingService } from './monitoring/alerting'
import { kpiTracker } from './monitoring/kpi-tracker'

export function initializeMonitoring() {
  const env = validateEnv()
  
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      debug: env.NODE_ENV === 'development',
      
      // Performance Monitoring
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Error filtering
      beforeSend(event, hint) {
        // Don't send client-side errors in development
        if (env.NODE_ENV === 'development' && event.level === 'error') {
          console.error('Sentry Error:', hint.originalException || hint.syntheticException)
          return null
        }
        return event
      },
      
      // integrations: [
      //   // Http integration is included by default in newer versions
      // ],
    })
  }

  // Initialize alerting service
  alertingService.initialize()
  
  // Initialize KPI tracker
  kpiTracker.initialize()
  
  console.log('🔧 Monitoring services initialized')
}

/**
 * Capture an exception with context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }
    Sentry.captureException(error)
  })
}

/**
 * Capture a custom message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }
    Sentry.captureMessage(message, level)
  })
}

/**
 * Add user context to monitoring
 */
export function setUserContext(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user)
}

/**
 * Performance monitoring wrapper
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  operation: string,
  fn: T
): T {
  return ((...args: any[]) => {
    return Sentry.withActiveSpan(null, () => {
      return Sentry.startSpan(
        {
          op: 'function',
          name: operation,
        },
        () => {
          try {
            const result = fn(...args)
            
            if (result && typeof result.then === 'function') {
              // Handle async functions
              return result
                .then((res: any) => {
                  return res
                })
                .catch((error: Error) => {
                  captureException(error, { operation })
                  throw error
                })
            }
            
            // Handle sync functions
            return result
          } catch (error) {
            captureException(error as Error, { operation })
            throw error
          }
        }
      )
    })
  }) as T
}
