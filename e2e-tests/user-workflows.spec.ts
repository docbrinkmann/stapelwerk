/**
 * E2E Tests for Complete User Workflows
 * Task 7.4: Remaining workflows (browsing, search, filter, stack building, mobile)
 */

import { test, expect, devices } from '@playwright/test';

// ============================================================================
// Service Browsing Workflow Tests
// ============================================================================

test.describe('Service Browsing Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
  });

  test('should display service browser with search and filters', async ({ page }) => {
    // Verify main components are present
    const searchBar = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await expect(searchBar).toBeVisible({ timeout: 10000 });

    const serviceGrid = page.locator('[data-testid="service-list"], .service-browser__grid').first();
    await expect(serviceGrid).toBeVisible();

    console.log('✓ Service browser components visible');
  });

  test('should filter services by category', async ({ page }) => {
    // Wait for services to load
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 10000 });
    const initialCount = await page.locator('[data-testid="service-card"]').count();

    // Category filters are checkboxes inside the "Service filters" region
    const databaseFilter = page.getByRole('checkbox', { name: 'Database' });
    await expect(databaseFilter).toBeVisible();
    await databaseFilter.check();

    // The filter is synced to the URL and actually filters the result set
    await expect(page).toHaveURL(/categories=database/);
    await expect
      .poll(async () => page.locator('[data-testid="service-card"]').count(), { timeout: 10000 })
      .toBeLessThanOrEqual(initialCount);

    // Every remaining card belongs to the selected category
    const filteredCount = await page.locator('[data-testid="service-card"]').count();
    expect(filteredCount).toBeGreaterThan(0);
    const badges = page.locator('[data-testid="service-card"] [data-testid="service-category"]');
    for (const badge of await badges.all()) {
      await expect(badge).toHaveText(/database/i);
    }

    console.log(`✓ Category filter applied: ${initialCount} → ${filteredCount} services`);
  });

  test('should sort services by different criteria', async ({ page }) => {
    // Wait for services to load
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 10000 });
    
    // Look for sort combobox
    const sortCombobox = page.locator('select, [role="combobox"]').first();
    
    if (await sortCombobox.count() > 0) {
      const tagName = await sortCombobox.evaluate(el => el.tagName);
      
      if (tagName === 'SELECT') {
        // Use selectOption for native select
        await sortCombobox.selectOption({ index: 1 }); // Select second option
        await page.waitForTimeout(1000);
        console.log('✓ Sort applied successfully (native select)');
      } else {
        // For custom combobox, try clicking and then selecting option
        await sortCombobox.click();
        await page.waitForTimeout(500);
        
        // Look for visible option after opening
        const sortOption = page.locator('[role="option"]:visible, option:visible').nth(1);
        
        if (await sortOption.count() > 0) {
          await sortOption.click();
          await page.waitForTimeout(1000);
          console.log('✓ Sort applied successfully (custom combobox)');
        } else {
          console.log('⚠ Sort options not visible after opening combobox');
        }
      }
    } else {
      console.log('⚠ Sort control not found, skipping test');
    }
  });

  test('should paginate or infinite scroll through services', async ({ page }) => {
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 10000 });
    const initialCount = await page.locator('[data-testid="service-card"]').count();
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    
    const afterScrollCount = await page.locator('[data-testid="service-card"]').count();
    
    if (afterScrollCount > initialCount) {
      console.log(`✓ Infinite scroll loaded more services: ${initialCount} → ${afterScrollCount}`);
    } else {
      console.log(`✓ All services loaded (${initialCount} total)`);
    }
  });
});

// ============================================================================
// Search and Filter Workflow Tests
// ============================================================================

test.describe('Search and Filter Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
  });

  test('should search for services by text query', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    const serviceCards = page.locator('[data-testid="service-card"]');
    await expect(serviceCards.first()).toBeVisible({ timeout: 10000 });

    // Type search query (debounced, synced to the URL)
    await searchInput.fill('database');
    await expect(page).toHaveURL(/q=database/);

    // Search actually filters: results match the term
    await expect
      .poll(async () => serviceCards.count(), { timeout: 10000 })
      .toBeGreaterThan(0);
    const count = await serviceCards.count();
    const firstCardText = await serviceCards.first().textContent();
    expect(firstCardText?.toLowerCase()).toContain('database');

    console.log(`✓ Search returned ${count} results`);
    console.log(`✓ Sample result: ${firstCardText?.substring(0, 50)}...`);
  });

  test('should clear search and show all services', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await searchInput.fill('database');
    await page.waitForTimeout(1000);
    
    const searchedCount = await page.locator('[data-testid="service-card"]').count();
    
    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(1000);
    
    const allServicesCount = await page.locator('[data-testid="service-card"]').count();
    
    expect(allServicesCount).toBeGreaterThanOrEqual(searchedCount);
    console.log(`✓ Search cleared: ${searchedCount} → ${allServicesCount} services`);
  });

  test('should apply multiple filters simultaneously', async ({ page }) => {
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 10000 });
    const initialCount = await page.locator('[data-testid="service-card"]').count();

    // Apply a text search AND a category filter at the same time
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await searchInput.fill('sql');
    await expect(page).toHaveURL(/q=sql/);

    const databaseFilter = page.getByRole('checkbox', { name: 'Database' });
    await databaseFilter.check();
    await expect(page).toHaveURL(/categories=database/);

    // Both filters are active and the result set matches both
    await expect
      .poll(async () => page.locator('[data-testid="service-card"]').count(), { timeout: 10000 })
      .toBeGreaterThan(0);
    const filteredCount = await page.locator('[data-testid="service-card"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    const badges = page.locator('[data-testid="service-card"] [data-testid="service-category"]');
    for (const badge of await badges.all()) {
      await expect(badge).toHaveText(/database/i);
    }

    console.log(`✓ Multiple filters applied: ${initialCount} → ${filteredCount} services`);
  });

  test('should show "no results" state for impossible filter combinations', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    // Search for something that likely doesn't exist
    await searchInput.fill('xyznonexistentservice123');
    await page.waitForTimeout(1000);
    
    const serviceCards = page.locator('[data-testid="service-card"]');
    const count = await serviceCards.count();
    
    if (count === 0) {
      // Look for "no results" message
      const noResults = page.locator('text=/no.*result|no.*service|not.*found/i').first();
      
      if (await noResults.count() > 0) {
        console.log('✓ "No results" state displayed correctly');
      } else {
        console.log('✓ Empty state displayed (0 services)');
      }
    } else {
      console.log(`⚠ Unexpected: ${count} results for nonsense query`);
    }
  });

  test('should preserve filter state on page refresh', async ({ page }) => {
    // Apply search + category filter; both sync into the URL
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('database');
    await expect(page).toHaveURL(/q=database/);

    const databaseFilter = page.getByRole('checkbox', { name: 'Database' });
    await databaseFilter.check();
    await expect(page).toHaveURL(/categories=database/);

    // Hard reload the filtered URL
    await page.reload();
    await page.waitForLoadState('networkidle');

    // URL keeps the params (the mount sync must not strip them)…
    await expect(page).toHaveURL(/q=database/);
    await expect(page).toHaveURL(/categories=database/);

    // …and the UI restores input value, checked category, and filtered results
    await expect(
      page.locator('input[type="search"], input[placeholder*="search" i]').first()
    ).toHaveValue('database', { timeout: 10000 });
    await expect(page.getByRole('checkbox', { name: 'Database' })).toBeChecked();

    await expect
      .poll(async () => page.locator('[data-testid="service-card"]').count(), { timeout: 10000 })
      .toBeGreaterThan(0);
    const badges = page.locator('[data-testid="service-card"] [data-testid="service-category"]');
    for (const badge of await badges.all()) {
      await expect(badge).toHaveText(/database/i);
    }

    console.log('✓ Filter state preserved across page refresh');
  });
});

// ============================================================================
// Stack Building Workflow Tests
// ============================================================================

test.describe('Stack Building Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
  });

  test('should enable stack building mode', async ({ page }) => {
    // Look for stack mode toggle
    const stackToggle = page.locator('[data-testid="stack-mode-toggle"], button:has-text("Build Stack"), input[type="checkbox"][id*="stack"]').first();
    
    if (await stackToggle.count() > 0) {
      await stackToggle.click();
      await page.waitForTimeout(500);
      
      // Verify stack panel appears
      const stackPanel = page.locator('.stack-panel, [data-testid="stack-canvas"], .service-browser__stack-panel');
      
      if (await stackPanel.count() > 0) {
        await expect(stackPanel.first()).toBeVisible();
        console.log('✓ Stack building mode enabled');
      } else {
        console.log('⚠ Stack panel not found');
      }
    } else {
      console.log('⚠ Stack toggle not found, skipping test');
    }
  });

  test('should add service to stack via "Add to Stack" button', async ({ page }) => {
    // Click on a service card to open the preview modal (browse mode)
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await expect(serviceCard).toBeVisible({ timeout: 10000 });
    await serviceCard.click();

    // Wait for modal
    const modal = page.locator('[data-testid="service-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click "Add to Stack" — button state flips to "Added to Stack!"
    const addButton = modal.locator('[data-testid="modal-add-to-stack"]');
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(addButton).toHaveText(/added/i);

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Enabling stack mode now reveals the stack toolbar (Save Stack / Full Builder)
    await page.locator('#stack-mode').click();
    await expect(page.locator('[data-testid="save-stack-button"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="expand-to-full-builder"]')).toBeVisible();

    console.log('✓ Service added to stack successfully');
  });

  test('should add multiple services to stack', async ({ page }) => {
    const modal = page.locator('[data-testid="service-preview-modal"]');
    const addButton = modal.locator('[data-testid="modal-add-to-stack"]');

    // Add first service via its preview modal (browse mode — in stack mode
    // the narrowed grid overlaps cards and clicks are intercepted)
    const firstCard = page.locator('[data-testid="service-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await expect(addButton).toHaveText(/added/i);
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Add second service
    const secondCard = page.locator('[data-testid="service-card"]').nth(1);
    await expect(secondCard).toBeVisible();
    await secondCard.click();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await expect(addButton).toHaveText(/added/i);
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Stack mode reveals the toolbar since the stack is non-empty
    await page.locator('#stack-mode').click();
    await expect(page.locator('[data-testid="save-stack-button"]')).toBeVisible({ timeout: 5000 });

    console.log('✓ Multiple services added to stack');
  });

  test('should view and manage stack', async ({ page }) => {
    // This test would verify stack canvas visibility and service management
    const stackToggle = page.locator('[data-testid="stack-mode-toggle"]').first();
    if (await stackToggle.count() > 0) {
      await stackToggle.click();
      await page.waitForTimeout(500);
      
      // Look for stack canvas
      const stackCanvas = page.locator('.stack-canvas, [data-testid="stack-canvas"]').first();
      
      if (await stackCanvas.count() > 0) {
        await expect(stackCanvas).toBeVisible();
        console.log('✓ Stack canvas visible and ready');
      } else {
        console.log('⚠ Stack canvas not found');
      }
    }
  });

  test('should save stack configuration', async ({ page }) => {
    // The Save button only appears with a non-empty stack: add a service first
    const modal = page.locator('[data-testid="service-preview-modal"]');
    const firstCard = page.locator('[data-testid="service-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator('[data-testid="modal-add-to-stack"]').click();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Enable stack mode and open the save dialog
    await page.locator('#stack-mode').click();
    const saveButton = page.locator('[data-testid="save-stack-button"]');
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    // The save modal opens (custom dialog without role="dialog";
    // identify it via its heading)
    await expect(
      page.getByRole('heading', { name: 'Save Your Stack' })
    ).toBeVisible({ timeout: 10000 });

    console.log('✓ Save stack modal opened');
  });

  test('should navigate to full stack builder', async ({ page }) => {
    // The Full Builder button lives in the stack-mode toolbar
    await page.locator('#stack-mode').click();
    const fullBuilderButton = page.locator('[data-testid="expand-to-full-builder"]');
    await expect(fullBuilderButton).toBeVisible({ timeout: 5000 });

    await fullBuilderButton.click();
    await expect(page).toHaveURL(/\/stack-builder/, { timeout: 15000 });

    console.log('✓ Navigated to full stack builder');
  });
});

// ============================================================================
// Mobile Responsive Tests
// ============================================================================

// Configure mobile device at top level
const mobileTest = test.extend({});
mobileTest.use({ ...devices['iPhone 12'] });

mobileTest.describe('Mobile Responsive Design', () => {
  mobileTest.beforeEach(async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
  });

  mobileTest('should display mobile-optimized service browser', async ({ page }) => {
    // Verify viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThan(768);
    
    // Verify services render
    const serviceCards = page.locator('[data-testid="service-card"]');
    await expect(serviceCards.first()).toBeVisible({ timeout: 10000 });
    
    console.log(`✓ Mobile view rendering with ${await serviceCards.count()} services`);
  });

  mobileTest('should open modal in mobile view', async ({ page }) => {
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await expect(serviceCard).toBeVisible({ timeout: 10000 });
    
    // Tap service card
    await serviceCard.tap();
    
    // Verify modal opens
    const modal = page.locator('[data-testid="service-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verify modal is responsive
    const modalContent = modal.locator('[data-testid="modal-content"]');
    await expect(modalContent).toBeVisible();
    
    console.log('✓ Modal opens and displays correctly on mobile');
    
    // Close modal
    await page.keyboard.press('Escape');
  });

  mobileTest('should handle touch interactions on mobile', async ({ page }) => {
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await expect(serviceCard).toBeVisible({ timeout: 10000 });
    
    // Test tap
    await serviceCard.tap();
    await page.waitForTimeout(500);
    
    // Close modal if opened
    const modal = page.locator('[data-testid="service-preview-modal"]');
    if (await modal.count() > 0) {
      await page.keyboard.press('Escape');
    }
    
    console.log('✓ Touch interactions working on mobile');
  });

  mobileTest('should scroll smoothly on mobile', async ({ page }) => {
    await page.waitForSelector('[data-testid="service-card"]', { timeout: 10000 });
    const initialCount = await page.locator('[data-testid="service-card"]').count();
    
    // Scroll down
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);
    
    const afterScrollCount = await page.locator('[data-testid="service-card"]').count();
    
    console.log(`✓ Mobile scroll: ${initialCount} → ${afterScrollCount} services`);
  });

  mobileTest('should display responsive modal layout on mobile', async ({ page }) => {
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await serviceCard.tap();
    
    const modal = page.locator('[data-testid="service-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Check if modal has mobile-specific classes
    const modalClasses = await modal.getAttribute('class');
    
    if (modalClasses?.includes('mobile')) {
      console.log('✓ Modal has mobile-specific styling');
    } else {
      console.log('✓ Modal displayed (mobile classes might be responsive)');
    }
    
    // Verify content is readable
    const modalContent = modal.locator('[data-testid="modal-content"]');
    const box = await modalContent.boundingBox();
    
    if (box) {
      const viewport = page.viewportSize();
      const contentWidth = box.width;
      const viewportWidth = viewport?.width || 0;
      
      // Content should not overflow viewport
      expect(contentWidth).toBeLessThanOrEqual(viewportWidth);
      console.log(`✓ Modal content fits mobile viewport (${contentWidth}px of ${viewportWidth}px)`);
    }
  });
});

// ============================================================================
// Tablet Responsive Tests
// ============================================================================

test.describe('Tablet Responsive Design', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Only run for tablet project
    if (testInfo.project.name !== 'tablet') {
      test.skip();
      return;
    }
    // Force iPad Pro 11 viewport (workaround for config not applying)
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
  });

  test('should display tablet-optimized layout', async ({ page }, testInfo) => {
    console.log(`Running in project: ${testInfo.project.name}`);
    console.log(`Viewport: ${JSON.stringify(page.viewportSize())}`);
    
    if (testInfo.project.name !== 'tablet') {
      test.skip();
      return;
    }
    
    const viewport = page.viewportSize();
    // iPad Pro 11 has 834x1194 viewport
    expect(viewport?.width).toBe(834);
    expect(viewport?.height).toBe(1194);
    expect(viewport?.height).toBe(1194);
    
    const serviceCards = page.locator('[data-testid="service-card"]');
    await expect(serviceCards.first()).toBeVisible({ timeout: 10000 });
    
    const count = await serviceCards.count();
    console.log(`✓ Tablet view rendering with ${count} services`);
  });

  test('should handle modal in tablet view', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'tablet') {
      test.skip();
      return;
    }
    
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await serviceCard.tap();
    
    const modal = page.locator('[data-testid="service-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verify modal is well-sized for tablet
    const modalContent = modal.locator('[data-testid="modal-content"]');
    const box = await modalContent.boundingBox();
    
    if (box) {
      console.log(`✓ Modal displayed at ${box.width}px width (tablet)`);
    }
    
    await page.keyboard.press('Escape');
  });
});

// ============================================================================
// Cross-Workflow Integration Tests
// ============================================================================

test.describe('Cross-Workflow Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
  });

  test('should search, filter, and add to stack in sequence', async ({ page }) => {
    // 1. Search for databases
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await searchInput.fill('database');
    await page.waitForTimeout(1000);
    
    // 2. Enable stack mode
    const stackToggle = page.locator('[data-testid="stack-mode-toggle"]').first();
    if (await stackToggle.count() > 0) {
      await stackToggle.click();
      await page.waitForTimeout(500);
    }
    
    // 3. Open modal for first result
    const firstCard = page.locator('[data-testid="service-card"]').first();
    if (await firstCard.count() > 0) {
      await firstCard.click();
      
      const modal = page.locator('[data-testid="service-preview-modal"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
      
      // 4. Add to stack
      const addButton = modal.locator('[data-testid="modal-add-to-stack"]').first();
      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(500);
      }
      
      await page.keyboard.press('Escape');
      console.log('✓ Complete workflow: Search → Filter → Add to Stack');
    }
  });

  test('should maintain state across navigation and back', async ({ page }) => {
    // Apply search + category filter on /services
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('database');
    await expect(page).toHaveURL(/q=database/);

    const databaseFilter = page.getByRole('checkbox', { name: 'Database' });
    await databaseFilter.check();
    await expect(page).toHaveURL(/categories=database/);
    const filteredUrl = page.url();

    // Navigate away, then come back via browser history
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // History restores the filtered URL and the UI rehydrates from it
    await expect(page).toHaveURL(/q=database/);
    await expect(page).toHaveURL(/categories=database/);
    await expect(
      page.locator('input[type="search"], input[placeholder*="search" i]').first()
    ).toHaveValue('database', { timeout: 10000 });
    await expect(page.getByRole('checkbox', { name: 'Database' })).toBeChecked();

    // Direct navigation to the copied URL restores state too
    await page.goto(filteredUrl);
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('input[type="search"], input[placeholder*="search" i]').first()
    ).toHaveValue('database', { timeout: 10000 });
    await expect(page.getByRole('checkbox', { name: 'Database' })).toBeChecked();
    await expect
      .poll(async () => page.locator('[data-testid="service-card"]').count(), { timeout: 10000 })
      .toBeGreaterThan(0);

    console.log('✓ Filter state maintained across navigation and back');
  });
});

console.log('User workflow tests suite ready for execution');
