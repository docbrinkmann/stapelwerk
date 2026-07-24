import { chromium, type FullConfig } from '@playwright/test'

/**
 * Global E2E setup: warm up the dev server.
 *
 * The app under test runs via `next dev` (webpack). First-compile of a route
 * can take many seconds, and compiling many routes at once (fullyParallel
 * test start) has proven unstable. Warming the main routes serially before
 * the test run:
 *  - avoids parallel first-compile storms,
 *  - compiles the client chunks + tRPC endpoints (plain fetch only compiles
 *    the server HTML, so we load /services in a real browser),
 *  - triggers E2E_SEED_ON_EMPTY so the catalog is populated,
 *  - makes load-time/perf assertions measure the app, not the compiler.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    'http://localhost:3100'

  console.log(`Warming up ${baseURL} ...`)

  // 1) Serial HTML warm-up of the main routes (compiles server bundles).
  //    `/__pw-warmup-404` warms /_not-found: its cold compile takes ~30s and
  //    stalls every other request in the dev server while it runs.
  for (const route of [
    '/api/health',
    '/',
    '/services',
    '/dashboard',
    '/stack-builder',
    '/stacks',
    '/__pw-warmup-404',
  ]) {
    const started = Date.now()
    try {
      const res = await fetch(`${baseURL}${route}`)
      console.log(`  ${route} -> ${res.status} (${Date.now() - started}ms)`)
    } catch (error) {
      console.warn(`  ${route} warm-up failed:`, error instanceof Error ? error.message : error)
    }
  }

  // 2) Browser warm-up: loads client chunks, hits the tRPC services/categories
  //    endpoints, triggers the E2E self-seed AND lets `next/font` finish its
  //    dev-mode font resolution. The first browser visits cause webpack
  //    hot-updates (font modules resolving) that can interrupt hydration of
  //    pages loaded at the same time — absorb that here, before the tests.
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()

    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle', timeout: 90_000 })

    await page.goto(`${baseURL}/services`, { waitUntil: 'networkidle', timeout: 90_000 })
    await page
      .waitForSelector('[data-testid="service-card"]', { timeout: 60_000 })
      .then(() => console.log('  /services -> service cards rendered'))
      .catch(() => console.warn('  /services warm-up: no service cards appeared'))

    // Second visit after fonts/hot-updates settled — should be quiet now.
    await page.waitForTimeout(2_000)
    await page.reload({ waitUntil: 'networkidle' })
    await page
      .waitForSelector('[data-testid="service-card"]', { timeout: 30_000 })
      .catch(() => console.warn('  /services warm-up reload: no service cards appeared'))
  } finally {
    await browser.close()
  }
}

export default globalSetup
