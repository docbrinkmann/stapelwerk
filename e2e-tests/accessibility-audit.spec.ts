import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audit (WCAG 2.1)', () => {
  test('services page should have no accessibility violations', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
    
    console.log(`✓ No accessibility violations found`);
    console.log(`✓ ${accessibilityScanResults.passes.length} checks passed`);
  });

  test('modal should be fully accessible', async ({ page }) => {
    await page.goto('/services');
    
    // Open modal
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await serviceCard.click();
    
    const modal = page.locator('[data-testid="service-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Run accessibility scan on modal
    const results = await new AxeBuilder({ page })
      .include('[data-testid="service-preview-modal"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(results.violations).toEqual([]);
    
    // Verify ARIA attributes
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    
    console.log('✓ Modal is accessible');
  });

  test('keyboard navigation should work throughout app', async ({ page }) => {
    await page.goto('/services');
    
    // Tab through elements
    await page.keyboard.press('Tab');
    
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Continue tabbing
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      console.log(`Tab ${i + 1}: Focused on ${focusedElement}`);
    }
    
    console.log('✓ Keyboard navigation functional');
  });

  test('focus indicators should be visible', async ({ page }) => {
    await page.goto('/services');
    // Wait for hydration before tabbing: pre-hydration, WebKit's first Tab
    // lands on the server-rendered search input (which suppresses the global
    // *:focus-visible outline), not on the first interactive control.
    await page.waitForLoadState('networkidle');

    // Tab to first focusable element
    await page.keyboard.press('Tab');
    
    // Check if focus outline is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Get computed style
    const outlineWidth = await focusedElement.evaluate(
      el => window.getComputedStyle(el).outlineWidth
    );
    
    // Should have visible outline
    expect(outlineWidth).not.toBe('0px');
    
    console.log(`✓ Focus indicator visible (outline: ${outlineWidth})`);
  });
});
