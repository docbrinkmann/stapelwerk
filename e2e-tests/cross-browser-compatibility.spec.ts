import { test, expect } from '@playwright/test';

test.describe('Cross-Browser Compatibility', () => {
  test('modal should work across all browsers', async ({ page, browserName }) => {
    console.log(`Testing on: ${browserName}`);
    
    await page.goto('/services');
    
    // Click service card
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await expect(serviceCard).toBeVisible({ timeout: 10000 });
    await serviceCard.click();
    
    // Verify modal opens
    const modal = page.locator('[data-testid="service-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Test close
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    
    console.log(`✓ Modal works on ${browserName}`);
  });
});
