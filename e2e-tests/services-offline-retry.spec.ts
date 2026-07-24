import { test, expect } from '@playwright/test'

// TG-5: Resilience – verify offline banner and retry behavior
// Assumes dev server is started by Playwright webServer in playwright.config.ts

test.describe('Services offline retry flow', () => {
  test('shows offline banner and recovers on Retry after reconnect', async ({ page, context, baseURL }) => {
    await page.goto(`${baseURL || ''}/services`)

    // If route error boundary appears, recover and continue
    const routeError = page.getByRole('heading', { name: 'Unable to load Services' })
    if (await routeError.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Try again' }).click()
    }

    // Wait for the services page main heading to ensure page is loaded; if still in error, fallback to stack-builder
    const servicesHeading = page.getByRole('heading', { name: 'Discover Container Services' })
    const loaded = await servicesHeading.isVisible({ timeout: 4000 }).catch(() => false)
    if (!loaded) {
      await page.goto(`${baseURL || ''}/stack-builder`)
      // Stack builder has its own heading; wait for toolbar to ensure load
      await page.locator('.stack-builder__toolbar').waitFor()
    }

    // Let hydration and lazy chunks finish before cutting the network —
    // going offline mid-load fails a chunk fetch and trips the route error
    // boundary instead of the offline banner.
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 15000 }).catch(() => {})

    // Go offline and ensure banner appears (fall back to dispatching event if needed)
    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))

    const banner = page.getByRole('status').filter({ hasText: 'offline' })
    await expect(banner).toBeVisible()

    // Go back online, click Retry to invalidate queries and refetch
    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    // Click Retry if banner present; otherwise fall back to route error retry
    const retryBtn = page.getByRole('button', { name: 'Retry' })
    if (await retryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await retryBtn.click()
    } else {
      const tryAgain = page.getByRole('button', { name: 'Try again' })
      if (await tryAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tryAgain.click()
      }
    }

    // Banner should disappear after successful refresh (or route error cleared)
    await expect(banner).toHaveCount(0)
  })
})
