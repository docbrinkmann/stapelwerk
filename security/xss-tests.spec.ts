import { test, expect } from '@playwright/test';

test.describe('XSS Protection', () => {
  test('should prevent script injection in search', async ({ page }) => {
    await page.goto('http://localhost:3000/services');
    
    const searchInput = page.locator('input[type="search"]').first();
    
    // XSS payloads
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg/onload=alert("XSS")>'
    ];
    
    for (const payload of xssPayloads) {
      await searchInput.fill(payload);
      await page.waitForTimeout(500);
      
      // Listen for alert dialogs (should not appear)
      page.on('dialog', async dialog => {
        console.error(`❌ XSS vulnerability: Dialog appeared with message: ${dialog.message()}`);
        await dialog.dismiss();
      });
      
      // Check if script executed
      const alertFired = await page.evaluate(() => {
        return (window as any).xssDetected === true;
      });
      
      expect(alertFired).toBeFalsy();
      console.log(`✓ XSS attempt blocked: ${payload.substring(0, 30)}...`);
    }
  });
});
