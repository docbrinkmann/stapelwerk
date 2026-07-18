import { test, expect } from '@playwright/test'

test.describe('ServicePreviewModal Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
  })

  test('should open modal when clicking on service card', async ({ page }) => {
    // Wait for service cards to load
    const serviceCards = page.locator('[data-testid="service-card"]')
    await expect(serviceCards.first()).toBeVisible({ timeout: 10000 })

    // Get the first service card's name before clicking
    const firstCard = serviceCards.first()
    const serviceName = await firstCard.locator('[data-testid="service-name"]').textContent()

    // Click on the first service card
    await firstCard.click()

    // Wait for modal to appear
    const modal = page.locator('[data-testid="service-preview-modal"]')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Verify modal displays the correct service
    const modalServiceName = await modal.locator('[data-testid="modal-service-name"]').textContent()
    expect(modalServiceName).toBe(serviceName)

    // Verify modal has essential elements
    await expect(modal.locator('[data-testid="modal-service-description"]')).toBeVisible()
    await expect(modal.locator('[data-testid="service-info-section"]')).toBeVisible()
    await expect(modal.locator('[data-testid="service-actions"]')).toBeVisible()
  })

  test('should close modal with Escape key', async ({ page }) => {
    // Open modal
    const serviceCards = page.locator('[data-testid="service-card"]')
    await serviceCards.first().click()

    const modal = page.locator('[data-testid="service-preview-modal"]')
    await expect(modal).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')

    // Verify modal is closed
    await expect(modal).not.toBeVisible({ timeout: 2000 })
  })

  test('should close modal when clicking backdrop', async ({ page }) => {
    // Open modal
    const serviceCards = page.locator('[data-testid="service-card"]')
    await serviceCards.first().click()

    const modal = page.locator('[data-testid="service-preview-modal"]')
    await expect(modal).toBeVisible()

    // Click on backdrop (overlay)
    const backdrop = page.locator('[data-testid="modal-backdrop"]')
    await backdrop.click({ position: { x: 10, y: 10 } }) // Click in top-left corner away from modal

    // Verify modal is closed
    await expect(modal).not.toBeVisible({ timeout: 2000 })
  })

  test('should display complete service information', async ({ page }) => {
    // Open modal for first service
    const serviceCards = page.locator('[data-testid="service-card"]')
    await serviceCards.first().click()

    const modal = page.locator('[data-testid="service-preview-modal"]')
    await expect(modal).toBeVisible()

    // Check for key information sections
    const infoSection = modal.locator('[data-testid="service-info-section"]')
    
    // These fields should be present in the modal
    await expect(infoSection.locator('[data-testid="modal-service-name"]')).toBeVisible()
    await expect(infoSection.locator('[data-testid="modal-service-description"]')).toBeVisible()
    await expect(infoSection.locator('[data-testid="service-category"]')).toBeVisible()

    // Action buttons should be visible
    await expect(modal.locator('[data-testid="modal-add-to-stack"]')).toBeVisible()
  })

  test('should handle rapid clicks without errors', async ({ page }) => {
    const serviceCards = page.locator('[data-testid="service-card"]')
    await expect(serviceCards.first()).toBeVisible({ timeout: 10000 })

    // The E2E self-seed only guarantees 2 services — cycle over what exists
    const cardCount = await serviceCards.count()
    const modal = page.locator('[data-testid="service-preview-modal"]')

    for (const index of [0, 1, 0]) {
      const card = serviceCards.nth(Math.min(index, cardCount - 1))
      await card.click()
      await expect(modal).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(modal).not.toBeVisible()
    }

    // No errors should be thrown during rapid interaction
    const errors = await page.evaluate(() => {
      return (window as any).errors || []
    })
    expect(errors.length).toBe(0)
  })
})
