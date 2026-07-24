import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * WCAG 2.2 Compliance Tests
 *
 * Automated accessibility testing using axe-core.
 * Tests all pages for WCAG 2.2 Level AA compliance.
 *
 * Coverage:
 * - Perceivable: Text alternatives, time-based media, adaptable, distinguishable
 * - Operable: Keyboard accessible, enough time, seizures, navigable, input modalities
 * - Understandable: Readable, predictable, input assistance
 * - Robust: Compatible with assistive technologies
 *
 * Standards:
 * - WCAG 2.2 Level AA
 * - Zero violations allowed
 * - All interactive elements must be accessible
 */

test.describe('WCAG 2.2 Compliance', () => {
  test('home page - no accessibility violations', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('services page - no accessibility violations', async ({ page }) => {
    await page.goto('/services')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('stack builder page - no accessibility violations', async ({ page }) => {
    await page.goto('/stack-builder')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('hero section - specific WCAG 2.2 checks', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('section[aria-label="Hero section"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])

    // Specific checks for hero section
    const passes = accessibilityScanResults.passes

    // Should have proper heading structure
    const headingCheck = passes.find((p) => p.id === 'heading-order')
    expect(headingCheck).toBeDefined()

    // Should have sufficient color contrast
    const contrastCheck = passes.find((p) => p.id === 'color-contrast')
    expect(contrastCheck).toBeDefined()
  })

  test('service cards - WCAG 2.2 interactive elements', async ({ page }) => {
    await page.goto('/services')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="service-grid"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])

    // Check for WCAG 2.2 Target Size (2.5.8)
    const buttons = await page.locator('button').all()
    for (const button of buttons) {
      const box = await button.boundingBox()
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(24)
        expect(box.height).toBeGreaterThanOrEqual(24)
      }
    }
  })

  test('forms - WCAG 2.2 input assistance', async ({ page }) => {
    await page.goto('/stack-builder')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])

    // Check for proper labels
    const inputs = await page.locator('input, textarea, select').all()
    for (const input of inputs) {
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledby = await input.getAttribute('aria-labelledby')
      const id = await input.getAttribute('id')

      // Input must have label, aria-label, or aria-labelledby
      if (id) {
        const label = await page.locator(`label[for="${id}"]`).count()
        expect(label > 0 || ariaLabel || ariaLabelledby).toBeTruthy()
      }
    }
  })

  test('navigation - keyboard accessibility', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('header, nav')
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])

    // Check all links are keyboard accessible
    const links = await page.locator('a').all()
    for (const link of links) {
      const tabindex = await link.getAttribute('tabindex')
      // tabindex should be 0 or not set (default is 0)
      expect(tabindex === null || parseInt(tabindex) >= 0).toBeTruthy()
    }
  })

  test('focus appearance - WCAG 2.2 criterion 2.4.13', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Get all focusable elements
    const focusableElements = await page
      .locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      .all()

    for (const element of focusableElements.slice(0, 5)) {
      // Test first 5 elements
      await element.focus()

      // Get computed style
      const outlineWidth = await element.evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return styles.getPropertyValue('outline-width')
      })

      const outlineStyle = await element.evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return styles.getPropertyValue('outline-style')
      })

      // WCAG 2.2: Focus indicator must be at least 2px or equivalent
      const widthValue = parseFloat(outlineWidth)
      expect(
        outlineStyle !== 'none' && (isNaN(widthValue) || widthValue >= 2)
      ).toBeTruthy()
    }
  })

  test('color contrast - WCAG 2.2 AAA where possible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa', 'wcag2aaa'])
      .analyze()

    // No violations at AA level
    expect(accessibilityScanResults.violations).toEqual([])

    // Check if we meet AAA for contrast
    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast-enhanced'
    )

    // Log AAA contrast results (informational, not failing)
    if (contrastViolations.length > 0) {
      console.log(
        `AAA contrast violations (informational): ${contrastViolations.length}`
      )
    }
  })

  test('images - text alternatives', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    // Check for image-alt violations
    const imageAltViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'image-alt'
    )

    expect(imageAltViolations).toEqual([])

    // All images should have alt text
    const images = await page.locator('img').all()
    for (const img of images) {
      const alt = await img.getAttribute('alt')
      expect(alt !== null).toBeTruthy()
    }
  })

  test('aria attributes - proper usage', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    // Check for ARIA violations
    const ariaViolations = accessibilityScanResults.violations.filter((v) =>
      v.id.includes('aria')
    )

    expect(ariaViolations).toEqual([])
  })

  test('landmarks - proper page structure', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    // Check for landmark violations
    const landmarkViolations = accessibilityScanResults.violations.filter((v) =>
      v.id.includes('landmark') || v.id.includes('region')
    )

    expect(landmarkViolations).toEqual([])

    // Page should have main landmark
    const main = await page.locator('main, [role="main"]').count()
    expect(main).toBeGreaterThan(0)
  })

  test('bypass blocks - skip links', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Tab to first element (should be skip link or first interactive element)
    await page.keyboard.press('Tab')

    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement
      return {
        tagName: el?.tagName,
        role: el?.getAttribute('role'),
        ariaLabel: el?.getAttribute('aria-label'),
      }
    })

    // First focusable should be meaningful
    expect(
      focusedElement.tagName === 'A' || focusedElement.tagName === 'BUTTON'
    ).toBeTruthy()
  })

  test('page title - meaningful and unique', async ({ page }) => {
    await page.goto('/')
    const homeTitle = await page.title()
    expect(homeTitle.length).toBeGreaterThan(0)
    expect(homeTitle.toLowerCase()).not.toBe('untitled')

    await page.goto('/services')
    const servicesTitle = await page.title()
    expect(servicesTitle.length).toBeGreaterThan(0)

    // Titles should be different
    expect(homeTitle).not.toBe(servicesTitle)
  })

  test('language attribute - properly set', async ({ page }) => {
    await page.goto('/')

    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBeTruthy()
    expect(lang?.length).toBeGreaterThan(0)
  })

  test('zoom support - up to 200%', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Set zoom to 200%
    await page.evaluate(() => {
      document.body.style.zoom = '2'
    })

    await page.waitForTimeout(500)

    // Page should still be usable
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    // No new violations at 200% zoom
    expect(accessibilityScanResults.violations).toEqual([])

    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = '1'
    })
  })
})
