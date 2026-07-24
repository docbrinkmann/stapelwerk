import { z } from 'zod'

/**
 * Environment configuration and validation
 */
const envSchema = z.object({
  // Database - optional during build, required at runtime
  DATABASE_URL: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default('Stapelwerk'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('0.1.0'),
  
  // Next.js
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  
  // Vercel
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  VERCEL_URL: z.string().optional(),
  
  // Monitoring
  SENTRY_DSN: z.string().url().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  SENTRY_ORG: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  SENTRY_PROJECT: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  
  // Analytics
  NEXT_PUBLIC_VERCEL_ANALYTICS: z.string().default('false').transform(val => val === 'true'),
  NEXT_PUBLIC_VERCEL_ANALYTICS_ID: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  
  // Port
  PORT: z.string().default('3000').transform(Number).pipe(z.number().positive()),
  
  // Environment specific overrides
  DATABASE_URL_TEST: z.string().url().optional(),
  
  // Package version (populated by npm)
  npm_package_version: z.string().optional(),
  
  // Custom configuration
  CUSTOM_KEY: z.string().optional(),
})

// Type-safe environment variables
export type Env = z.infer<typeof envSchema>

// Validate environment variables
function validateEnvInternal(): Env {
  // Skip validation during build time
  if (process.env.SKIP_ENV_VALIDATION === 'true' || process.env.NODE_ENV === 'test') {
    return process.env as any as Env
  }
  
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(err => `${err.path.join('.')}: ${err.message}`)
      throw new Error(
        `❌ Invalid environment variables:\n${missingVars.join('\n')}\n\nPlease check your .env file and make sure all required variables are set.`
      )
    }
    throw error
  }
}

// Export validated environment variables
export const env = validateEnvInternal()

// Legacy validation function for backward compatibility
export function validateEnv(): Env {
  return validateEnvInternal()
}

// Environment utilities
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'
export const isStaging = env.NODE_ENV === 'staging'

// Database configuration
export const getDatabaseUrl = () => {
  if (isTest && env.DATABASE_URL_TEST) {
    return env.DATABASE_URL_TEST
  }
  return env.DATABASE_URL
}

// App configuration
export const getAppUrl = () => {
  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL
  }
  
  if (env.NEXT_PUBLIC_APP_URL) {
    return env.NEXT_PUBLIC_APP_URL
  }
  
  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`
  }
  
  return `http://localhost:${env.PORT}`
}

// Version information
export const getVersion = () => {
  return env.npm_package_version || env.NEXT_PUBLIC_APP_VERSION || '0.1.0'
}

// Deployment environment detection
export const getDeploymentEnvironment = () => {
  if (env.VERCEL_ENV) {
    return env.VERCEL_ENV
  }
  return env.NODE_ENV
}
