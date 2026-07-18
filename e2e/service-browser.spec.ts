import { test, expect } from '@playwright/test'

// Basic user flows for service browser

test.describe('Service Browser E2E', () => {
  test('loads services page and shows grid', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/BuildMyStack/i)
    await expect(page.getByTestId('service-list')).toBeVisible()
  })
})
