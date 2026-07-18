import { defineConfig, devices } from '@playwright/test'

/**
 * Visual Regression Testing Configuration
 *
 * This configuration is specifically for visual regression tests.
 * Tests are located in src/__tests__/visual/
 *
 * Test matrix includes:
 * - 3 browsers: Chromium, Firefox, WebKit
 * - 3 viewports: Desktop (1920px), Tablet (768px), Mobile (375px)
 * - 2 color schemes: Light, Dark
 * - 2 motion preferences: Normal, Reduced
 */
export default defineConfig({
  // Visual regression test directory
  testDir: './src/__tests__/visual',

  // Snapshot directory
  snapshotDir: './src/__tests__/visual/snapshots',

  // Run tests in parallel for speed
  fullyParallel: true,

  // Fail on CI if test.only is present
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI; one local retry absorbs `next dev` HMR/compile
  // hiccups (they stall hydration of a loading page).
  retries: process.env.CI ? 2 : 1,

  // Use fewer workers for stability — the app under test is a `next dev`
  // server; heavy parallel SSR destabilizes it.
  workers: process.env.CI ? 2 : 4,

  // Warm up the dev server (route compiles, tRPC endpoint, catalog self-seed)
  // before capturing screenshots.
  globalSetup: './src/__tests__/visual/global-setup.ts',

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-visual-report', open: 'never' }],
    ['json', { outputFile: 'test-results/visual-test-results.json' }],
    ['list'],
  ],

  // Shared test settings
  use: {
    // Base URL
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Always capture screenshots (required for visual regression)
    screenshot: 'on',

    // No video needed for visual tests
    video: 'off',

    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // Ignore HTTPS errors in development
    ignoreHTTPSErrors: true,
  },

  // Test projects for different browser/viewport/colorScheme combinations
  projects: [
    // ============================================
    // DESKTOP TESTS (1920x1080)
    // ============================================
    {
      name: 'chromium-desktop-light',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'light',
      },
    },
    {
      name: 'chromium-desktop-dark',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark',
      },
    },
    {
      name: 'chromium-desktop-reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'light',
        // Note: prefers-reduced-motion is tested via page.emulateMedia() in tests
      },
    },
    {
      name: 'firefox-desktop-light',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'light',
      },
    },
    {
      name: 'webkit-desktop-light',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'light',
      },
    },

    // ============================================
    // TABLET TESTS (768x1024)
    // ============================================
    {
      name: 'chromium-tablet-light',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        colorScheme: 'light',
      },
    },
    {
      name: 'chromium-tablet-dark',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        colorScheme: 'dark',
      },
    },

    // ============================================
    // MOBILE TESTS (375x667)
    // ============================================
    {
      name: 'mobile-chrome-light',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 667 },
        colorScheme: 'light',
      },
    },
    {
      name: 'mobile-chrome-dark',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 667 },
        colorScheme: 'dark',
      },
    },
    {
      name: 'mobile-safari-light',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 667 },
        colorScheme: 'light',
      },
    },
  ],

  // Test artifacts directory
  outputDir: 'test-results/visual',

  // Run dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // `next dev` expects development; with NODE_ENV=test the middleware's
      // rate limiter stays active and throttles the test run.
      NODE_ENV: 'development',
      PORT: '3000',
      // Deterministic content for stable baselines: the catalog self-seeds
      // two services on an empty database, no login required.
      DATABASE_URL:
        process.env.PLAYWRIGHT_DATABASE_URL ||
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_test',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '0123456789abcdef0123456789abcdef',
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_DISABLE_AUTH: 'true',
      E2E_SEED_ON_EMPTY: '1',
    },
  },

  // Test timeout
  timeout: 30 * 1000,

  // Global timeout
  globalTimeout: 15 * 60 * 1000,

  // Expect timeout
  expect: {
    // Timeout for expect assertions
    timeout: 10000,

    // Visual comparison settings
    toHaveScreenshot: {
      // Allow 1% pixel difference (handles minor rendering differences)
      maxDiffPixels: 100,

      // Threshold for pixel color difference (0-1 scale)
      threshold: 0.2,

      // Animation stability
      animations: 'disabled',

      // CSS transitions stability
      caret: 'hide',
    },
  },
})
