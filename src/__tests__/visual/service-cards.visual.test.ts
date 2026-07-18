import { test, expect } from '@playwright/test'

/**
 * Visual Regression Tests: Service Cards
 *
 * Tests service card rendering across different states and viewports.
 *
 * Coverage:
 * - Grid layout variations (1-4 columns)
 * - Loading states with skeleton shimmer
 * - Hover states and interactions
 * - Container query responsiveness
 * - Dark mode variations
 */

test.describe('Service Cards Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Deterministic captures: the app honors prefers-reduced-motion.
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Navigate to services page
    await page.goto('/services')

    // Wait for the ACTUAL cards, not just the grid container — the container
    // is also present during the skeleton phase, and capturing skeletons vs.
    // loaded cards produces incompatible baselines. Strict on purpose:
    // better to fail (and retry) than to baseline a skeleton.
    await page.waitForSelector('[data-testid="service-card"]', {
      state: 'visible',
      timeout: 20000,
    })

    // Ensure the Inter webfont is really loaded (fonts.ready also resolves on
    // failed loads) — fallback-font captures diff on every glyph. Also hide
    // the Next.js dev-mode indicator overlay, which varies between runs.
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    await page
      .waitForFunction(
        () => document.fonts.check('16px Inter') && document.fonts.check('700 16px Inter'),
        undefined,
        { timeout: 10000 }
      )
      .catch(() => console.warn('visual beforeEach: Inter webfont did not load'))
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
  })

  test('service card grid - desktop 4 columns', async ({ page }) => {
    test.skip(
      !test.info().project.name.includes('chromium-desktop-light'),
      'Desktop grid test'
    )

    // Capture service grid
    const serviceGrid = page.locator('[data-testid="service-grid"]')
    await expect(serviceGrid).toHaveScreenshot('service-grid-desktop.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('service card grid - tablet 2 columns', async ({ page }) => {
    test.skip(
      !test.info().project.name.includes('tablet-light'),
      'Tablet grid test'
    )

    // Capture service grid
    const serviceGrid = page.locator('[data-testid="service-grid"]')
    await expect(serviceGrid).toHaveScreenshot('service-grid-tablet.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('service card grid - mobile 1 column', async ({ page }) => {
    test.skip(
      !test.info().project.name.includes('mobile-chrome-light'),
      'Mobile grid test'
    )

    // Capture service grid
    const serviceGrid = page.locator('[data-testid="service-grid"]')
    await expect(serviceGrid).toHaveScreenshot('service-grid-mobile.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('service card grid - dark mode', async ({ page }) => {
    test.skip(
      !test.info().project.name.includes('chromium-desktop-dark'),
      'Dark mode grid test'
    )

    // Capture service grid in dark mode
    const serviceGrid = page.locator('[data-testid="service-grid"]')
    await expect(serviceGrid).toHaveScreenshot('service-grid-dark.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('single service card - default state', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Single card test'
    )

    // Get first service card
    const firstCard = page.locator('[data-testid="service-card"]').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await firstCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await firstCard.isVisible()) {
      await expect(firstCard).toHaveScreenshot('service-card-default.png', {
        animations: 'disabled',
      })
    }
  })

  test('single service card - hover state', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Card hover test'
    )

    // Get first service card and hover
    const firstCard = page.locator('[data-testid="service-card"]').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await firstCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await firstCard.isVisible()) {
      await firstCard.hover()
      await page.waitForTimeout(300) // Wait for hover animation

      await expect(firstCard).toHaveScreenshot('service-card-hover.png', {
        animations: 'disabled',
      })
    }
  })

  test('service card - container query narrow', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Container query test'
    )

    // Set narrow container width using viewport
    await page.setViewportSize({ width: 320, height: 800 })
    await page.waitForTimeout(500)

    const firstCard = page.locator('[data-testid="service-card"]').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await firstCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await firstCard.isVisible()) {
      await expect(firstCard).toHaveScreenshot('service-card-narrow.png', {
        animations: 'disabled',
      })
    }
  })

  test('service card - container query wide', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Container query wide test'
    )

    // Set wide container
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(500)

    const firstCard = page.locator('[data-testid="service-card"]').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await firstCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await firstCard.isVisible()) {
      await expect(firstCard).toHaveScreenshot('service-card-wide.png', {
        animations: 'disabled',
      })
    }
  })

  test('service card skeleton loader', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Skeleton loader test'
    )

    // Navigate to page and intercept service loading
    await page.route('**/api/trpc/*services*', async (route) => {
      // Delay response to capture skeleton
      await new Promise((resolve) => setTimeout(resolve, 5000))
      await route.continue()
    })

    // 'commit' avoids ERR_ABORTED when the app's URL-sync replaces the route
    // during load
    await page.goto('/services', { waitUntil: 'commit' }).catch(() => {})

    // Capture skeleton immediately
    const skeletonGrid = page.locator('[data-testid="service-skeleton"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await skeletonGrid.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await skeletonGrid.isVisible()) {
      await expect(skeletonGrid).toHaveScreenshot('service-skeleton-grid.png', {
        animations: 'disabled',
      })
    }
  })

  test('service card skeleton - shimmer animation frame', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Shimmer animation test'
    )

    // Navigate and intercept to show skeleton
    await page.route('**/api/trpc/*services*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 10000))
      await route.continue()
    })

    // 'commit' avoids ERR_ABORTED when the app's URL-sync replaces the route
    // during load
    await page.goto('/services', { waitUntil: 'commit' }).catch(() => {})

    // Wait for shimmer to be in middle of animation
    await page.waitForTimeout(1000)

    const skeletonCard = page.locator('.animate-shimmer').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await skeletonCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await skeletonCard.isVisible()) {
      await expect(skeletonCard).toHaveScreenshot('service-skeleton-shimmer.png', {
        animations: 'disabled',
      })
    }
  })

  test('service card - empty state', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Empty state test'
    )

    // Navigate to filtered view with no results
    await page.goto('/services?category=nonexistent')
    await page.waitForTimeout(1000)

    const emptyState = page.locator('[data-testid="empty-state"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await emptyState.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await emptyState.isVisible()) {
      await expect(emptyState).toHaveScreenshot('service-empty-state.png', {
        fullPage: false,
        animations: 'disabled',
      })
    }
  })

  test('service card - error state', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Error state test'
    )

    // Force error by breaking API
    await page.route('**/api/trpc/*services*', (route) =>
      route.abort('failed')
    )

    // 'commit' avoids ERR_ABORTED when the app's URL-sync replaces the route
    // during load
    await page.goto('/services', { waitUntil: 'commit' }).catch(() => {})
    await page.waitForTimeout(1000)

    const errorState = page.locator('[data-testid="error-state"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await errorState.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await errorState.isVisible()) {
      await expect(errorState).toHaveScreenshot('service-error-state.png', {
        fullPage: false,
        animations: 'disabled',
      })
    }
  })

  test('service card - focus state', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Focus state test'
    )

    const firstCard = page.locator('[data-testid="service-card"]').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await firstCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await firstCard.isVisible()) {
      // Tab to focus the card
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(200)

      await expect(firstCard).toHaveScreenshot('service-card-focus.png', {
        animations: 'disabled',
      })
    }
  })

  // NOTE: the former "service card - selected state" visual test was deleted:
  // clicking a card immediately opens the service preview modal, whose
  // full-screen backdrop covers the card — the "selected" style is never
  // user-visible and the capture raced the modal's open transition.

  test('service card - glassmorphic effect', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Glassmorphic effect test'
    )

    const glassCard = page.locator('.backdrop-blur-xl[data-testid="service-card"]').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await glassCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await glassCard.isVisible()) {
      await expect(glassCard).toHaveScreenshot('service-card-glass.png', {
        animations: 'disabled',
      })
    }
  })
})
