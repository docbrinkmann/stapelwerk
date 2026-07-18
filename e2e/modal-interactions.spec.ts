import { test, expect } from '@playwright/test'

// Modal interactions flow

test.describe('Service Preview Modal E2E', () => {
  test('opens and closes modal via UI interactions', async ({ page }) => {
    await page.goto('/')

    // Click the first service card if present (smoke)
    const firstCard = page.locator('[data-testid="service-card"]').first()
    if (await firstCard.count()) {
      await firstCard.click()
      await expect(page.getByTestId('service-preview-modal')).toBeVisible()

      // Close by clicking close button
      await page.getByRole('button', { name: /close/i }).click()
      await expect(page.getByTestId('service-preview-modal')).toBeHidden()
    } else {
      test.skip(true, 'No service cards present to trigger modal')
    }
  })
})
