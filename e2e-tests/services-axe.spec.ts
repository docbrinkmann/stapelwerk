import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// TG-6 & TG-9: Axe scans focused on filters and tabs

test.describe('Services a11y (axe)', () => {
  test('filter panel has no serious/critical violations', async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ''}/services`)
    // Ensure filters are rendered
    await page.getByRole('region', { name: 'Service filters' }).waitFor()

    const results = await new AxeBuilder({ page })
      .include('[aria-label="Service filters"]')
      .analyze()

    const serious = results.violations.filter(v => (v.impact === 'serious' || v.impact === 'critical'))
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('main services content has no serious/critical violations', async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ''}/services`)
    // Wait for main services content to render
    await page.locator('.services-content').waitFor()

    const results = await new AxeBuilder({ page })
      .include('.services-content')
      .analyze()

    const serious = results.violations.filter(v => (v.impact === 'serious' || v.impact === 'critical'))
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })
})