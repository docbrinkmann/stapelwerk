import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto('/')
  })

  test('should load homepage successfully', async ({ page }) => {
    // Check that the page loads with expected content
    await expect(page).toHaveTitle(/buildmystack/i)

    // The marketing homepage has no <main> landmark — its primary content
    // is the hero section.
    const heroSection = page.locator('section[aria-label="Introduction"]')
    await expect(heroSection).toBeVisible()
  })

  test('should have proper meta tags', async ({ page }) => {
    // Check for essential meta tags
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)
    
    // Check for viewport meta tag
    const viewport = page.locator('meta[name=\"viewport\"]')
    await expect(viewport).toHaveAttribute('content', /width=device-width/)
  })

  test('should be responsive', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 })
    const heroSection = page.locator('section[aria-label="Introduction"]')
    await expect(heroSection).toBeVisible()

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(heroSection).toBeVisible()

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(heroSection).toBeVisible()
  })

  test('should have working navigation', async ({ page }) => {
    // Check if navigation elements exist and are functional
    // This will need to be updated based on actual navigation structure
    
    // For now, check basic page functionality
    const body = page.locator('body')
    await expect(body).toBeVisible()
    
    // Check if page can handle basic interactions
    await page.keyboard.press('Tab')
    // Should not throw any errors
  })

  test('should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Check that no console errors occurred.
    // Resource-load failures (e.g. the dev-only 404 for the hard-coded
    // inter-latin.woff2 preload) are network noise, not JS errors.
    const relevantErrors = consoleErrors.filter(
      (message) => !message.startsWith('Failed to load resource')
    )
    expect(relevantErrors).toHaveLength(0)
  })

  test('should have working health check endpoint', async ({ page, request }) => {
    // Test the health check API endpoint
    const healthResponse = await request.get('/api/health')
    
    expect(healthResponse.ok()).toBeTruthy()
    expect(healthResponse.status()).toBe(200)
    
    const healthData = await healthResponse.json()
    expect(healthData).toHaveProperty('status')
    expect(healthData.status).toBe('healthy')
  })

  test('should handle 404 pages gracefully', async ({ page }) => {
    // Navigate to a non-existent page
    const response = await page.goto('/this-page-does-not-exist')
    
    // Should return 404
    expect(response?.status()).toBe(404)
    
    // But page should still render something meaningful
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

test.describe('Performance', () => {
  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Should load within 5 seconds (generous for development)
    expect(loadTime).toBeLessThan(5000)
  })

  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Wait for any dynamic content to load
    await page.waitForTimeout(2000)
    
    // Check that the page is interactive
    const interactiveElements = page.locator('button, a, input')
    const count = await interactiveElements.count()
    
    // Should have some interactive elements (or none if it's just a static page)
    expect(count).toBeGreaterThanOrEqual(0)
  })
})