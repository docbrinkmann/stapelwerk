import { defineConfig, devices } from '@playwright/test'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // Test directory
  testDir: './e2e-tests',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  
  // Retry on CI; one local retry absorbs `next dev` HMR flakiness (dev-mode
  // font/webpack hot-updates can interrupt hydration of a loading page).
  retries: process.env.CI ? 2 : 1,

  // Opt out of parallel tests on CI. Locally, cap workers: the app under test
  // is a `next dev` server and heavy parallel SSR/compile destabilizes it.
  workers: process.env.CI ? 1 : 2,
  
  // Reporter to use. See https://playwright.dev/docs/test-reporters
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['line'],
  ],
  
  // Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions.
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100',
    
    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: 'on-first-retry',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Capture video on failure
    video: 'retain-on-failure',
    
    // Global timeout for each test
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Browser context options
    // NOTE: viewport removed from global config to allow project-specific device emulation
    ignoreHTTPSErrors: true,

    // NOTE: do NOT set a global `extraHTTPHeaders.Accept` here — it is applied
    // to every request (including script/css chunks) and makes the Next.js dev
    // server respond with text/plain 404s for static assets, so the client
    // bundle never loads.
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // NOTE: no custom launchOptions — the previous
        // `--single-process --no-zygote` args crash Chromium on macOS
        // ("Target page, context or browser has been closed").
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Test against mobile viewports.
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
    },

    // Test against branded browsers.
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  // Global setup: warms up the dev server routes before the (parallel) run.
  globalSetup: './e2e-tests/global-setup.ts',

  // Folder for test artifacts such as screenshots, videos, traces, etc.
  outputDir: 'test-results/',

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // `next dev` expects development. With NODE_ENV=test the middleware's
      // Redis rate limiter stays active (it is only skipped in development)
      // and an E2E run exhausts the API budget, 429-ing tRPC calls mid-run.
      NODE_ENV: 'development',
      PORT: '3100',
      // Use test database for E2E tests; allow override for Postgres
      DATABASE_URL: process.env.PLAYWRIGHT_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_test',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '0123456789abcdef0123456789abcdef',
      NEXTAUTH_URL: 'http://localhost:3100',
      NEXT_PUBLIC_APP_DISABLE_AUTH: 'true',
      TEST_E2E_SIMPLE_HEALTH: '1',
      E2E_SEED_ON_EMPTY: '1',
    },
  },

  // Test timeout
  timeout: 30 * 1000,

  // Global timeout for the whole test suite
  globalTimeout: 10 * 60 * 1000,

  // Maximum time the test can run
  expect: {
    // Maximum time expect() should wait for the condition to be met.
    timeout: 10000,
  },
})