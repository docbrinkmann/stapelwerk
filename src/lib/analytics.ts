import { validateEnv } from './env'

interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
  userId?: string
}

interface PageView {
  page: string
  title?: string
  userId?: string
  properties?: Record<string, any>
}

/**
 * Initialize analytics tracking
 */
export function initializeAnalytics() {
  const env = validateEnv()
  
  // Initialize PostHog if configured
  if (typeof window !== 'undefined' && env.NEXT_PUBLIC_POSTHOG_KEY) {
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        loaded: (posthog) => {
          if (env.NODE_ENV === 'development') posthog.debug()
        }
      })
    })
  }

  // Initialize Google Analytics if configured
  if (typeof window !== 'undefined' && env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    // Load gtag script
    const script = document.createElement('script')
    script.src = `https://www.googletagmanager.com/gtag/js?id=${env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`
    script.async = true
    document.head.appendChild(script)

    // Initialize gtag
    script.onload = () => {
      (window as any).dataLayer = (window as any).dataLayer || []
      function gtag(...args: any[]) {
        ;(window as any).dataLayer.push(args)
      }
      gtag('js', new Date())
      gtag('config', env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
      })
      ;(window as any).gtag = gtag
    }
  }
}

/**
 * Track a custom event
 */
export function trackEvent({ name, properties, userId }: AnalyticsEvent) {
  try {
    // PostHog tracking
    if (typeof window !== 'undefined' && (window as any).posthog) {
      ;(window as any).posthog.capture(name, {
        ...properties,
        $user_id: userId,
      })
    }

    // Google Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('event', name, {
        custom_parameter_1: properties?.category || 'general',
        custom_parameter_2: properties?.label || '',
        value: properties?.value || 1,
        user_id: userId,
        ...properties,
      })
    }

    // Console logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', { name, properties, userId })
    }
  } catch (error) {
    console.error('Error tracking event:', error)
  }
}

/**
 * Track a page view
 */
export function trackPageView({ page, title, userId, properties }: PageView) {
  try {
    // PostHog tracking
    if (typeof window !== 'undefined' && (window as any).posthog) {
      ;(window as any).posthog.capture('$pageview', {
        $current_url: page,
        $title: title,
        $user_id: userId,
        ...properties,
      })
    }

    // Google Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        page_title: title,
        page_location: page,
        user_id: userId,
        custom_map: properties,
      })
    }

    // Console logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Page View:', { page, title, userId, properties })
    }
  } catch (error) {
    console.error('Error tracking page view:', error)
  }
}

/**
 * Identify a user
 */
export function identifyUser(userId: string, traits?: Record<string, any>) {
  try {
    // PostHog identification
    if (typeof window !== 'undefined' && (window as any).posthog) {
      ;(window as any).posthog.identify(userId, traits)
    }

    // Google Analytics user properties
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        user_id: userId,
        custom_map: traits,
      })
    }

    // Console logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics User Identified:', { userId, traits })
    }
  } catch (error) {
    console.error('Error identifying user:', error)
  }
}

/**
 * Track common application events
 */
export const analytics = {
  // User actions
  userSignUp: (userId: string, method: string) =>
    trackEvent({
      name: 'user_sign_up',
      properties: { method },
      userId,
    }),

  userSignIn: (userId: string, method: string) =>
    trackEvent({
      name: 'user_sign_in',
      properties: { method },
      userId,
    }),

  userSignOut: (userId: string) =>
    trackEvent({
      name: 'user_sign_out',
      userId,
    }),

  // App usage
  pageView: (page: string, userId?: string) =>
    trackPageView({
      page,
      title: document.title,
      userId,
    }),

  featureUsed: (feature: string, userId?: string, properties?: Record<string, any>) =>
    trackEvent({
      name: 'feature_used',
      properties: { feature, ...properties },
      userId,
    }),

  errorOccurred: (error: string, userId?: string, properties?: Record<string, any>) =>
    trackEvent({
      name: 'error_occurred',
      properties: { error, ...properties },
      userId,
    }),

  performanceMetric: (metric: string, value: number, userId?: string) =>
    trackEvent({
      name: 'performance_metric',
      properties: { metric, value },
      userId,
    }),
}