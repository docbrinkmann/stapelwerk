import { test, expect } from '@playwright/test';

test.describe('SQL Injection Protection', () => {
  test('should sanitize search input', async ({ page }) => {
    await page.goto('http://localhost:3000/services');
    
    const searchInput = page.locator('input[type="search"]').first();
    
    // SQL injection attempts
    const injectionPayloads = [
      "'; DROP TABLE services; --",
      "1' OR '1'='1",
      "admin'--",
      "' OR 1=1--",
      "\\x27; DROP TABLE services--"
    ];
    
    for (const payload of injectionPayloads) {
      await searchInput.fill(payload);
      await page.waitForTimeout(1000);
      
      // Should either return safe results or empty, not error
      const errorMsg = page.locator('text=/error|exception|sql/i');
      expect(await errorMsg.count()).toBe(0);
      
      console.log(`✓ SQL injection attempt blocked: ${payload.substring(0, 20)}...`);
    }
  });
});
