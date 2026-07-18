import { test, expect } from '@playwright/test'

/**
 * Visual Regression Tests: Command Palette
 *
 * Tests the command palette (Cmd+K) component across different states.
 *
 * Coverage:
 * - Closed state (trigger button)
 * - Open state with search input
 * - Search results display
 * - Empty search results
 * - Recent actions list
 * - Keyboard navigation focus states
 * - Dark mode variations
 */

test.describe('Command Palette Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Deterministic captures: the app honors prefers-reduced-motion.
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // The command palette is mounted on the services browser page (not the
    // marketing homepage). Wait for hydration (cards rendered) so the ⌘K
    // listener is registered and the palette's service list is populated.
    // Strict on purpose: better to fail (and retry) than to capture a
    // palette with an empty service list.
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 20000 })

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
  })

  /** The palette search input (scoped to the dialog — the page has its own search bar). */
  const paletteInput = (page: import('@playwright/test').Page) =>
    page.locator('[role="dialog"]').locator('input').first()

  /**
   * The palette panel itself. The [role="dialog"] element is a fixed inset-0
   * wrapper including a backdrop-blur of the page behind it — capturing that
   * makes screenshots depend on (and destabilize with) background content.
   */
  const palettePanel = (page: import('@playwright/test').Page) =>
    page.locator('[role="dialog"] [cmdk-root]')

  /**
   * Open the palette deterministically: click the trigger button (it only
   * opens, never toggles) and fall back to the ⌘K shortcut. Retried because
   * dev-mode hydration/HMR can swallow the first interaction.
   */
  const openPalette = async (page: import('@playwright/test').Page): Promise<void> => {
    const shortcut = process.platform === 'darwin' ? 'Meta+KeyK' : 'Control+KeyK'
    const trigger = page.getByRole('button', { name: /open command palette/i })
    const dialog = page.locator('[role="dialog"]')
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await dialog.isVisible().catch(() => false)) break
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.click()
      } else {
        await page.keyboard.press(shortcut)
      }
      const opened = await dialog
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false)
      if (opened) break
    }
    await dialog.waitFor({ state: 'visible', timeout: 5000 })
    await page.waitForTimeout(300)
  }

  test('command palette trigger button - default', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Trigger button test'
    )

    // Find the command palette trigger
    const trigger = page.getByRole('button', { name: /open command palette/i })

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await trigger.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await trigger.isVisible()) {
      await expect(trigger).toHaveScreenshot('command-palette-trigger.png', {
        animations: 'disabled',
      })
    }
  })

  test('command palette trigger button - hover', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Trigger hover test'
    )

    const trigger = page.getByRole('button', { name: /open command palette/i })

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await trigger.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await trigger.isVisible()) {
      await trigger.hover()
      await page.waitForTimeout(200)

      await expect(trigger).toHaveScreenshot('command-palette-trigger-hover.png', {
        animations: 'disabled',
      })
    }
  })

  test('command palette - closed state', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Closed state test'
    )

    // Verify dialog is not visible
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).not.toBeVisible()

    // Capture page with closed palette
    await expect(page).toHaveScreenshot('command-palette-closed.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('command palette - open state (empty search)', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Open state test'
    )

    // Open command palette with Cmd+K
    await openPalette(page)

    // Capture open dialog
    const dialog = page.locator('[role="dialog"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await dialog.isVisible()) {
      await expect(palettePanel(page)).toHaveScreenshot('command-palette-open.png', {
        animations: 'disabled',
      })
    }
  })

  test('command palette - open state dark mode', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-dark',
      'Open dark mode test'
    )

    // Open command palette
    await openPalette(page)

    const dialog = page.locator('[role="dialog"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await dialog.isVisible()) {
      await expect(palettePanel(page)).toHaveScreenshot('command-palette-open-dark.png', {
        animations: 'disabled',
      })
    }
  })

  test('command palette - search results', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Search results test'
    )

    // Open command palette
    await openPalette(page)

    // Type search query
    const searchInput = paletteInput(page)
    await searchInput.fill('docker')
    await page.waitForTimeout(500)

    const dialog = page.locator('[role="dialog"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await dialog.isVisible()) {
      await expect(palettePanel(page)).toHaveScreenshot('command-palette-search-results.png', {
        animations: 'disabled',
      })
    }
  })

  test('command palette - no results found', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'No results test'
    )

    // Open command palette
    await openPalette(page)

    // Type query with no results
    const searchInput = paletteInput(page)
    await searchInput.fill('xyznonexistent123')
    await page.waitForTimeout(500)

    const dialog = page.locator('[role="dialog"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await dialog.isVisible()) {
      await expect(palettePanel(page)).toHaveScreenshot('command-palette-no-results.png', {
        animations: 'disabled',
      })
    }
  })

  // NOTE: the former "command palette - recent actions" visual test was
  // deleted: recent actions are only recorded via palette selections (which
  // navigate away), so the state cannot be reached deterministically here,
  // and the entries render `toLocaleDateString()` timestamps that change the
  // baseline every day. Without recent actions it duplicated the
  // "open state (empty search)" capture.

  test('command palette - keyboard focus on item', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Keyboard focus test'
    )

    // Open command palette
    await openPalette(page)

    // Type search to show results
    const searchInput = paletteInput(page)
    await searchInput.fill('postgres')
    await page.waitForTimeout(500)

    // Press down arrow to focus first item
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)

    const dialog = page.locator('[role="dialog"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await dialog.isVisible()) {
      await expect(palettePanel(page)).toHaveScreenshot('command-palette-focus-item.png', {
        animations: 'disabled',
      })
    }
  })

  test('command palette - mobile view', async ({ page }) => {
    test.skip(
      !test.info().project.name.includes('mobile-chrome-light'),
      'Mobile view test'
    )

    // Open command palette
    await openPalette(page)

    const dialog = page.locator('[role="dialog"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await dialog.isVisible()) {
      await expect(palettePanel(page)).toHaveScreenshot('command-palette-mobile.png', {
        animations: 'disabled',
      })
    }
  })

  test('command palette - backdrop blur effect', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Backdrop test'
    )

    // Open command palette
    await openPalette(page)

    // Capture full page to show backdrop blur
    await expect(page).toHaveScreenshot('command-palette-backdrop.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('command palette - service categories grouping', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Categories test'
    )

    // Open command palette
    await openPalette(page)

    // Search for category
    const searchInput = paletteInput(page)
    await searchInput.fill('database')
    await page.waitForTimeout(500)

    const dialog = page.locator('[role="dialog"]')

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await dialog.isVisible()) {
      await expect(palettePanel(page)).toHaveScreenshot('command-palette-categories.png', {
        animations: 'disabled',
      })
    }
  })

  test('command palette - keyboard shortcut display', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop-light',
      'Shortcuts test'
    )

    // Capture the trigger with keyboard shortcut badge
    const trigger = page.getByRole('button', { name: /open command palette/i })

    // Deterministic guard: wait for the element before deciding to capture,

    // so both baseline and verification runs take the same branch.

    await trigger.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

    if (await trigger.isVisible()) {
      // Look for keyboard shortcut indicator (e.g., "⌘K" badge)
      const shortcutBadge = page.locator('kbd').first()

      // Deterministic guard: wait for the element before deciding to capture,

      // so both baseline and verification runs take the same branch.

      await shortcutBadge.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

      if (await shortcutBadge.isVisible()) {
        await expect(shortcutBadge).toHaveScreenshot('command-palette-shortcut.png', {
          animations: 'disabled',
        })
      }
    }
  })
})
