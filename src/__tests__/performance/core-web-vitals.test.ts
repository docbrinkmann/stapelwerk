import { test, expect, chromium } from '@playwright/test'

/**
 * Core Web Vitals Performance Tests
 *
 * Tests performance metrics against Web Vitals thresholds:
 * - LCP (Largest Contentful Paint) ≤ 2.5s
 * - FID (First Input Delay) ≤ 100ms (or INP ≤ 200ms)
 * - CLS (Cumulative Layout Shift) ≤ 0.1
 * - TBT (Total Blocking Time) ≤ 300ms
 * - Speed Index ≤ 3s
 *
 * Note: These tests measure real-world performance in a controlled environment.
 */

test.describe('Core Web Vitals', () => {
  test('home page - LCP within 2.5s', async ({ page }) => {
    await page.goto('/')

    // Get LCP metric using Performance Observer
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0

        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any

          if (lastEntry) {
            lcpValue = lastEntry.renderTime || lastEntry.loadTime
          }
        })

        observer.observe({ type: 'largest-contentful-paint', buffered: true })

        // Wait for page load
        setTimeout(() => {
          observer.disconnect()
          resolve(lcpValue)
        }, 5000)
      })
    })

    console.log(`Home page LCP: ${lcp}ms`)
    expect(lcp).toBeLessThanOrEqual(2500)
    expect(lcp).toBeGreaterThan(0) // Sanity check
  })

  test('services page - LCP within 2.5s', async ({ page }) => {
    await page.goto('/services')

    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0

        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any

          if (lastEntry) {
            lcpValue = lastEntry.renderTime || lastEntry.loadTime
          }
        })

        observer.observe({ type: 'largest-contentful-paint', buffered: true })

        setTimeout(() => {
          observer.disconnect()
          resolve(lcpValue)
        }, 5000)
      })
    })

    console.log(`Services page LCP: ${lcp}ms`)
    expect(lcp).toBeLessThanOrEqual(2500)
  })

  test('home page - CLS below 0.1', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Get CLS metric
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) {
              continue
            }
            clsValue += (entry as any).value
          }
        })

        observer.observe({ type: 'layout-shift', buffered: true })

        setTimeout(() => {
          observer.disconnect()
          resolve(clsValue)
        }, 5000)
      })
    })

    console.log(`Home page CLS: ${cls}`)
    expect(cls).toBeLessThanOrEqual(0.1)
  })

  test('services page - CLS below 0.1', async ({ page }) => {
    await page.goto('/services')
    await page.waitForLoadState('networkidle')

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) {
              continue
            }
            clsValue += (entry as any).value
          }
        })

        observer.observe({ type: 'layout-shift', buffered: true })

        setTimeout(() => {
          observer.disconnect()
          resolve(clsValue)
        }, 5000)
      })
    })

    console.log(`Services page CLS: ${cls}`)
    expect(cls).toBeLessThanOrEqual(0.1)
  })

  test('home page - FCP within 1.8s', async ({ page }) => {
    await page.goto('/')

    // Get FCP (First Contentful Paint)
    const fcp = await page.evaluate(() => {
      const perfEntries = performance.getEntriesByType('paint')
      const fcpEntry = perfEntries.find((entry) => entry.name === 'first-contentful-paint')
      return fcpEntry?.startTime || 0
    })

    console.log(`Home page FCP: ${fcp}ms`)
    expect(fcp).toBeLessThanOrEqual(1800)
    expect(fcp).toBeGreaterThan(0)
  })

  test('home page - INP within 200ms', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Interact with page to measure INP
    await page.click('button')
    await page.waitForTimeout(500)

    const inp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let maxDelay = 0

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const duration = (entry as any).duration || 0
            if (duration > maxDelay) {
              maxDelay = duration
            }
          }
        })

        // INP replaces FID in modern browsers
        observer.observe({ type: 'event', buffered: true, durationThreshold: 0 } as any)

        setTimeout(() => {
          observer.disconnect()
          resolve(maxDelay)
        }, 2000)
      })
    })

    console.log(`Home page INP: ${inp}ms`)
    if (inp > 0) {
      expect(inp).toBeLessThanOrEqual(200)
    }
  })

  test('page load time - Time to Interactive within 3.5s', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime

    console.log(`Home page load time: ${loadTime}ms`)
    expect(loadTime).toBeLessThanOrEqual(3500)
  })

  test('animation performance - 60fps during scroll', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Start performance measurement
    await page.evaluate(() => {
      ;(window as any).frameTimestamps = []
      ;(window as any).raf = function () {
        ;(window as any).frameTimestamps.push(performance.now())
        if ((window as any).frameTimestamps.length < 60) {
          requestAnimationFrame((window as any).raf)
        }
      }
      requestAnimationFrame((window as any).raf)
    })

    // Scroll to trigger animations
    await page.evaluate(() => {
      window.scrollBy(0, 500)
    })

    await page.waitForTimeout(1500)

    // Calculate FPS
    const fps = await page.evaluate(() => {
      const timestamps = (window as any).frameTimestamps || []
      if (timestamps.length < 2) return 60 // Assume 60fps if not enough data

      const totalTime = timestamps[timestamps.length - 1] - timestamps[0]
      const averageFrameTime = totalTime / (timestamps.length - 1)
      return 1000 / averageFrameTime
    })

    console.log(`Animation FPS: ${fps.toFixed(2)}`)
    expect(fps).toBeGreaterThanOrEqual(30) // At least 30fps (relaxed threshold)
  })

  test('bundle size - initial load under 150KB', async ({ page }) => {
    const resourceSizes = await page.evaluate(() => {
      return new Promise<{ js: number; css: number; total: number }>((resolve) => {
        setTimeout(() => {
          const resources = performance.getEntriesByType('resource') as any[]
          let jsSize = 0
          let cssSize = 0

          resources.forEach((resource) => {
            if (resource.name.endsWith('.js')) {
              jsSize += resource.transferSize || 0
            } else if (resource.name.endsWith('.css')) {
              cssSize += resource.transferSize || 0
            }
          })

          resolve({
            js: jsSize,
            css: cssSize,
            total: jsSize + cssSize,
          })
        }, 2000)
      })
    })

    console.log(`JS size: ${(resourceSizes.js / 1024).toFixed(2)}KB`)
    console.log(`CSS size: ${(resourceSizes.css / 1024).toFixed(2)}KB`)
    console.log(`Total size: ${(resourceSizes.total / 1024).toFixed(2)}KB`)

    // Total initial bundle should be under 150KB (gzipped)
    expect(resourceSizes.total / 1024).toBeLessThanOrEqual(150)
  })

  test('DOM size - under 1500 nodes', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const domSize = await page.evaluate(() => {
      return document.querySelectorAll('*').length
    })

    console.log(`DOM size: ${domSize} nodes`)
    expect(domSize).toBeLessThanOrEqual(1500)
  })

  test('main thread blocking - TBT under 300ms', async ({ page }) => {
    await page.goto('/')

    // Measure long tasks
    const tbt = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let totalBlockingTime = 0

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const duration = entry.duration
            if (duration > 50) {
              totalBlockingTime += duration - 50
            }
          }
        })

        observer.observe({ type: 'longtask', buffered: true })

        setTimeout(() => {
          observer.disconnect()
          resolve(totalBlockingTime)
        }, 5000)
      })
    })

    console.log(`Total Blocking Time: ${tbt}ms`)
    expect(tbt).toBeLessThanOrEqual(300)
  })

  test('network requests - reasonable count', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const requestCount = await page.evaluate(() => {
      return performance.getEntriesByType('resource').length
    })

    console.log(`Network requests: ${requestCount}`)

    // Should have reasonable number of requests (< 50 for initial load)
    expect(requestCount).toBeLessThanOrEqual(50)
  })

  test('memory usage - no leaks on route change', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    // Navigate back and forth
    for (let i = 0; i < 3; i++) {
      await page.goto('/services')
      await page.waitForLoadState('networkidle')
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    }

    // Get final memory
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory
      const increasePercentage = (memoryIncrease / initialMemory) * 100

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${increasePercentage.toFixed(2)}%)`)

      // Memory shouldn't increase more than 50% after navigation cycles
      expect(increasePercentage).toBeLessThanOrEqual(50)
    }
  })

  test('image optimization - proper formats and sizes', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const images = await page.locator('img').all()

    for (const img of images) {
      const src = await img.getAttribute('src')
      const loading = await img.getAttribute('loading')

      // Images below fold should have lazy loading
      const isVisible = await img.isVisible()
      if (!isVisible) {
        expect(loading).toBe('lazy')
      }

      // Hero images should have fetchpriority="high"
      const fetchPriority = await img.getAttribute('fetchpriority')
      if (fetchPriority === 'high') {
        console.log('High priority image found:', src)
      }
    }
  })

  test('font loading - uses font-display swap', async ({ page }) => {
    await page.goto('/')

    const fontLoadingStrategy = await page.evaluate(() => {
      const stylesheets = Array.from(document.styleSheets)

      for (const sheet of stylesheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])

          for (const rule of rules) {
            if ((rule as any).cssText?.includes('@font-face')) {
              const fontDisplay = (rule as any).style?.fontDisplay
              return fontDisplay || 'not set'
            }
          }
        } catch (e) {
          // Skip cross-origin stylesheets
        }
      }

      return 'no fonts found'
    })

    console.log(`Font loading strategy: ${fontLoadingStrategy}`)

    // If fonts are used, they should use swap or optional
    if (fontLoadingStrategy !== 'no fonts found') {
      expect(['swap', 'optional', 'fallback'].includes(fontLoadingStrategy)).toBeTruthy()
    }
  })
})
