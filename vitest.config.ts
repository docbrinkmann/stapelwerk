import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()] as any,
  // Avoid PostCSS config resolution during tests to prevent EISDIR errors
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globalSetup: ['./src/__tests__/global-setup.ts'],
    // Test environment configuration
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'e2e',
      'e2e-tests',
      'e2e/**',
      'playwright-tests',
      'playwright-tests/**',
      'security/*.spec.ts',
      'security/**/*.spec.ts',
      'coverage',
      'build',
      '**/*.e2e.{test,spec}.{ts,tsx}',
      '**/*.playwright.{test,spec}.{ts,tsx}',
      'vite.config.test.ts',
      // Playwright specs (run via test:accessibility / test:performance / test:visual)
      'src/__tests__/accessibility/**',
      'src/__tests__/performance/**',
      'src/__tests__/visual/**'
    ],
    globals: true,
    
    // Test execution configuration
    // Increased timeout for integration tests (UI with userEvent, collaboration, performance)
    // 7 failing test files needed >30s due to dynamic imports and complex async operations
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 10000,
    
    // Parallel execution (use forks to avoid native segfaults during DB-heavy tests)
    pool: 'forks',
    // Per-file isolation: without it, vi.mock factories for the same module
    // bleed across files and random files fail depending on execution order.
    // fileParallelism stays off so DB-heavy tests keep running sequentially.
    isolate: true,
    fileParallelism: false,
    maxConcurrency: 1, // Run tests sequentially for DB tests
    
    // Environment variables for tests
    env: {
      DATABASE_URL: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_test?schema=public',
      DATABASE_TEST_URL: process.env.DATABASE_TEST_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_test?schema=public',
      NODE_ENV: 'test',
      VITEST: 'true',
      TRIVY_SKIP_DB_UPDATE: 'true',
      TRIVY_SKIP_CLI: 'true',
    } as Record<string, string>,
    
    // Reporters
    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './coverage/test-results.json',
      html: './coverage/test-results.html',
    },
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'src/__tests__/**',
        'e2e-tests/**',
        'playwright-tests/**',
        'coverage/**',
        'dist/**',
        '.next/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/types.ts',
        'src/app/globals.css',
        'src/app/layout.tsx', // Often just boilerplate
      ],
      include: [
        'src/**/*.{js,ts,jsx,tsx}',
      ],
      // Coverage thresholds
thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        // More lenient for specific directories
        'src/app/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
    
    // Test isolation and cleanup
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // File watching
    watch: false,
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '~': resolve(__dirname, './'),
      '@/tests': resolve(__dirname, './src/__tests__'),
      '@prisma/client': resolve(__dirname, './src/__tests__/harness/prisma-client-proxy.ts'),
    },
  },
})
