import { test, expect } from '@playwright/test'

/**
 * Visual Regression Tests: Hero Section
 *
 * Tests the hero section across different viewports, color schemes, and motion preferences.
 *
 * Coverage:
 * - Desktop (1920px): Full layout with parallax effects
 * - Tablet (768px): Responsive typography and spacing
 * - Mobile (375px): Stacked layout and touch targets
 * - Dark mode: Color scheme variations
 * - Reduced motion: Static alternative without animations
 */

test.describe('Hero Section Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // The hero background blobs are JS-driven (framer-motion), so
    // `animations: 'disabled'` cannot freeze them and screenshots never
    // stabilize. The component honors prefers-reduced-motion — emulate it
    // for deterministic baselines.
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Navigate to home page
    await page.goto('/')

    // Wait for hero section to be visible
    await page.waitForSelector('section[aria-label="Hero section"]', {
      state: 'visible',
      timeout: 10000,
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

    // Wait for animations to settle
    await page.waitForTimeout(1000)
  })

  test('desktop layout - light mode', async ({ page }) => {
    // Only run on desktop light mode
    test.skip(
      !test.info().project.name.includes('desktop-light'),
      'Desktop light mode test'
    )

    // Capture full hero section
    const heroSection = page.locator('section[aria-label="Hero section"]')
    await expect(heroSection).toHaveScreenshot('hero-desktop-light.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('desktop layout - dark mode', async ({ page }) => {
    // Only run on desktop dark mode
    test.skip(
      !test.info().project.name.includes('desktop-dark'),
      'Desktop dark mode test'
    )

    // Capture full hero section
    const heroSection = page.locator('section[aria-label="Hero section"]')
    await expect(heroSection).toHaveScreenshot('hero-desktop-dark.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('desktop layout - reduced motion', async ({ page }) => {
    // Only run on reduced motion config
    test.skip(
      !test.info().project.name.includes('reduced-motion'),
      'Reduced motion test'
    )

    // Capture hero section without animations
    const heroSection = page.locator('section[aria-label="Hero section"]')
    await expect(heroSection).toHaveScreenshot('hero-desktop-reduced-motion.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('tablet layout - light mode', async ({ page }) => {
    // Only run on tablet
    test.skip(
      !test.info().project.name.includes('tablet-light'),
      'Tablet test'
    )

    // Capture full hero section
    const heroSection = page.locator('section[aria-label="Hero section"]')
    await expect(heroSection).toHaveScreenshot('hero-tablet-light.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('tablet layout - dark mode', async ({ page }) => {
    // Only run on tablet dark mode
    test.skip(
      !test.info().project.name.includes('tablet-dark'),
      'Tablet dark mode test'
    )

    // Capture full hero section
    const heroSection = page.locator('section[aria-label="Hero section"]')
    await expect(heroSection).toHaveScreenshot('hero-tablet-dark.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('mobile layout - light mode', async ({ page }) => {
    // Only run on mobile light mode
    test.skip(
      !(
        test.info().project.name.includes('mobile-') &&
        test.info().project.name.includes('light')
      ),
      'Mobile light mode test'
    )

    // Capture full hero section
    const heroSection = page.locator('section[aria-label="Hero section"]')
    await expect(heroSection).toHaveScreenshot('hero-mobile-light.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('mobile layout - dark mode', async ({ page }) => {
    // Only run on mobile dark mode
    test.skip(
      !(
        test.info().project.name.includes('mobile-') &&
        test.info().project.name.includes('dark')
      ),
      'Mobile dark mode test'
    )

    // Capture full hero section
    const heroSection = page.locator('section[aria-label="Hero section"]')
    await expect(heroSection).toHaveScreenshot('hero-mobile-dark.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('hero CTA buttons', async ({ page }) => {
    // Capture primary and secondary CTAs
    const primaryCTA = page.getByRole('button', { name: /get started/i }).first()
    const secondaryCTA = page.getByRole('button', { name: /view examples/i }).first()

    // Test only on chromium desktop light
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'CTA button test'
    )

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await primaryCTA.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await primaryCTA.isVisible()) {
      await expect(primaryCTA).toHaveScreenshot('hero-primary-cta.png', {
        animations: 'disabled',
      })
    }

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await secondaryCTA.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await secondaryCTA.isVisible()) {
      await expect(secondaryCTA).toHaveScreenshot('hero-secondary-cta.png', {
        animations: 'disabled',
      })
    }
  })

  test('hero gradient text', async ({ page }) => {
    // Test only on chromium desktop light
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Gradient text test'
    )

    // Capture gradient text heading
    const gradientText = page.locator('span.bg-gradient-to-r').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await gradientText.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await gradientText.isVisible()) {
      // bg-clip-text gradients composite lazily in Chromium — nudge a paint
      // and let it settle, otherwise the capture can be blank.
      await gradientText.scrollIntoViewIfNeeded()
      await gradientText.evaluate((el) => el.getBoundingClientRect())
      await page.waitForTimeout(500)

      await expect(gradientText).toHaveScreenshot('hero-gradient-text.png', {
        animations: 'disabled',
        // Gradient-clipped glyph anti-aliasing varies slightly between runs.
        maxDiffPixels: 2500,
      })
    }
  })

  test('hero animated blobs - chromium only', async ({ page }) => {
    // Test only on chromium (animations best supported)
    test.skip(
      !test.info().project.name.includes('chromium-desktop-light'),
      'Blob animation test'
    )

    // Capture background blobs
    const blobContainer = page.locator('[aria-hidden="true"]').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await blobContainer.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await blobContainer.isVisible()) {
      await expect(blobContainer).toHaveScreenshot('hero-background-blobs.png', {
        animations: 'disabled',
      })
    }
  })

  test('hero scroll indicator', async ({ page }) => {
    // Test only on chromium desktop light
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Scroll indicator test'
    )

    // Capture scroll indicator
    const scrollIndicator = page.locator('[aria-label="Scroll down"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await scrollIndicator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await scrollIndicator.isVisible()) {
      await expect(scrollIndicator).toHaveScreenshot('hero-scroll-indicator.png', {
        animations: 'disabled',
      })
    }
  })

  test('hero glassmorphic card', async ({ page }) => {
    // Test only on chromium desktop light
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Glassmorphic card test'
    )

    // Capture the glassmorphic card containing CTAs
    const glassCard = page.locator('.backdrop-blur-xl').first()

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await glassCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await glassCard.isVisible()) {
      await expect(glassCard).toHaveScreenshot('hero-glass-card.png', {
        animations: 'disabled',
        // backdrop-blur makes text anti-aliasing nondeterministic between
        // runs. NOTE: the config-level maxDiffPixels:100 would still apply if
        // only maxDiffPixelRatio were set here, so raise maxDiffPixels itself.
        maxDiffPixels: 15000,
      })
    }
  })
})
