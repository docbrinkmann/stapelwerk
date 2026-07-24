import { chromium, type FullConfig } from '@playwright/test'

/**
 * Global setup for visual regression tests: warm up the dev server.
 *
 * The app under test runs via `next dev` (webpack). First-compile of a route
 * can take many seconds and dev-mode font resolution triggers webpack
 * hot-updates on the first browser visits — both destabilize screenshot
 * capture. Warm the routes serially (server bundles) and once in a real
 * browser (client chunks, tRPC endpoints, E2E catalog self-seed, fonts)
 * before any screenshots are taken.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    'http://localhost:3000'

  console.log(`Warming up ${baseURL} ...`)
  for (const route of ['/', '/services']) {
    const started = Date.now()
    try {
      const res = await fetch(`${baseURL}${route}`)
      console.log(`  ${route} -> ${res.status} (${Date.now() - started}ms)`)
    } catch (error) {
      console.warn(`  ${route} warm-up failed:`, error instanceof Error ? error.message : error)
    }
  }

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle', timeout: 90_000 })
    await page.goto(`${baseURL}/services`, { waitUntil: 'networkidle', timeout: 90_000 })
    await page
      .waitForSelector('[data-testid="service-card"]', { timeout: 60_000 })
      .then(() => console.log('  /services -> service cards rendered'))
      .catch(() => console.warn('  /services warm-up: no service cards appeared'))
    // Warm the lazy chunks the tests exercise: the service preview modal
    // (dynamic import) and the command palette. Their first open triggers a
    // dev-mode compile/hot-update that destabilizes screenshots.
    await page
      .locator('[data-testid="service-card"]')
      .first()
      .click({ timeout: 5_000 })
      .catch(() => {})
    await page.waitForTimeout(1_000)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Meta+KeyK')
    await page.waitForTimeout(1_000)
    await page.keyboard.press('Escape')

    // Let dev-mode font hot-updates settle, then confirm a quiet reload.
    await page.waitForTimeout(2_000)
    await page.reload({ waitUntil: 'networkidle' })
  } finally {
    await browser.close()
  }
}

export default globalSetup
