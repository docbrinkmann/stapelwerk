// Import Sentry configuration
import { withSentryConfig } from '@sentry/nextjs'
import withBundleAnalyzer from '@next/bundle-analyzer'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 top-level options (moved from experimental)
  typedRoutes: true,
  serverExternalPackages: [
    '@prisma/client',
    'node-gyp',
    '@opentelemetry/instrumentation',
    '@opentelemetry/sdk-node',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-http',
    '@opentelemetry/instrumentation-http',
    '@opentelemetry/instrumentation-fetch',
    'import-in-the-middle',
    'require-in-the-middle',
  ],
  
  // Next.js experimental features
  experimental: {
    // Enable optimizations
    optimizeCss: true,
  },
  
  // Turbopack configuration (required when webpack config present)
  turbopack: {
    // Rules for handling specific file types if needed
  },
  
  typescript: {
    // Strict TypeScript checking; in tests, allow build despite type errors
    ignoreBuildErrors: process.env.NODE_ENV === 'test',
  },
  
  // Security headers
  poweredByHeader: false,
  
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' wss: ws:",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "manifest-src 'self'"
            ].join('; ')
          },
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'magnetometer=()',
              'accelerometer=()',
              'gyroscope=()'
            ].join(', ')
          }
        ],
      },
      {
        // API routes get additional security headers
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' ? '*' : process.env.ALLOWED_ORIGINS || 'https://yourdomain.com'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex'
          }
        ],
      },
    ]
  },
  
  // Webpack configuration for development
  webpack: (config, { dev, isServer }) => {
    // Suppress warnings about critical dependencies
    if (isServer) {
      config.ignoreWarnings = [/^Critical dependency:/]
    }
    
    // Development-specific webpack configurations
    if (dev) {
      // Enable hot reloading for Docker environments
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.next/**', '**/.git/**'],
      }

      // Configure polling for file changes in Docker
      if (process.env.WATCHPACK_POLLING === 'true') {
        config.watchOptions.poll = 1000
      }

      // Force webpack to ignore Prisma Client in cache for Docker
      // This prevents the "undefined" error in hot-reload
      config.snapshot = {
        ...config.snapshot,
        managedPaths: [],
      }

      // Optimize module resolution for Docker
      config.resolve = {
        ...config.resolve,
        symlinks: false,
      }
    }

    return config
  },

  // Output configuration for containerized environments
  output: 'standalone',

  // Enable compression
  compress: true,

  // Development server configuration
  ...(process.env.NODE_ENV === 'development' && {
    // Enable hot reload for all file types
    onDemandEntries: {
      // Period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 25 * 1000,
      // Number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 2,
    },
  }),

  // Environment variables validation
  env: {
  },
}

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin
  silent: true, // Suppresses source map uploading logs during build
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
}

// Wrap with bundle analyzer
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// Export the configuration with Sentry integration and bundle analyzer
const configWithAnalyzer = withAnalyzer(nextConfig)

export default process.env.SENTRY_DSN 
  ? withSentryConfig(configWithAnalyzer, sentryWebpackPluginOptions)
  : configWithAnalyzer
