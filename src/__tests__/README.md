# Stapelwerk Testing Guide

This directory contains comprehensive test suites for the Stapelwerk application, including visual regression tests, accessibility audits, and performance benchmarks.

## Test Structure

```
src/__tests__/
├── visual/                    # Visual regression tests (Playwright)
│   ├── hero-section.visual.test.ts
│   ├── service-cards.visual.test.ts
│   └── command-palette.visual.test.ts
├── accessibility/             # Accessibility compliance tests
│   ├── wcag-compliance.test.ts
│   ├── keyboard-nav.test.ts
│   └── screen-reader.test.ts
├── performance/               # Performance benchmarks
│   └── core-web-vitals.test.ts
├── a11y/                      # Legacy accessibility tests
├── api/                       # API integration tests
├── components/                # Component unit tests
├── e2e/                       # End-to-end tests
├── integration/               # Integration tests
├── security/                  # Security tests
└── ui/                        # UI unit tests
```

## Quick Start

### Run All Quality Tests

```bash
npm run test:all-quality
```

This runs visual regression, accessibility, and performance tests in sequence.

### Individual Test Suites

```bash
# Visual regression tests
npm run test:visual

# Accessibility tests
npm run test:accessibility

# Performance tests
npm run test:performance

# Lighthouse CI audit
npx lhci autorun

# Bundle size analysis
npm run build && npm run bundle:analyze
```

## Test Suites

### 1. Visual Regression Testing

**Location:** `src/__tests__/visual/`
**Config:** `playwright-visual.config.ts`
**Tests:** 38 tests across 11 browser/viewport/colorScheme combinations

**What's Tested:**
- Hero section (11 tests)
- Service cards (14 tests)
- Command palette (13 tests)

**Test Matrix:**
- **Browsers:** Chromium, Firefox, WebKit
- **Viewports:** Desktop (1920px), Tablet (768px), Mobile (375px)
- **Color Schemes:** Light, Dark
- **Motion:** Normal, Reduced Motion

**Run Visual Tests:**
```bash
npm run test:visual
```

**View Results:**
- Reports: `playwright-visual-report/index.html`
- Screenshots: `src/__tests__/visual/snapshots/`

**Update Baselines:**
```bash
npm run test:visual -- --update-snapshots
```

### 2. Accessibility Testing

**Location:** `src/__tests__/accessibility/`
**Tests:** 52 tests ensuring WCAG 2.2 Level AA compliance

**Test Suites:**
1. **WCAG Compliance** (17 tests) - Automated axe-core testing
2. **Keyboard Navigation** (16 tests) - Keyboard interaction validation
3. **Screen Reader** (19 tests) - ARIA and semantic HTML validation

**What's Tested:**
- Zero axe-core violations
- All interactive elements ≥ 24x24px (WCAG 2.5.8)
- Focus indicators ≥ 2px, 4.5:1 contrast (WCAG 2.4.13)
- Complete keyboard navigation
- ARIA labels and roles
- Screen reader announcements
- Color contrast (4.5:1 normal, 3:1 large)

**Run Accessibility Tests:**
```bash
npm run test:accessibility
```

**View Results:**
- Console output with detailed violations
- Accessibility report: `docs/accessibility-audit-report.md`

### 3. Performance Testing

**Location:** `src/__tests__/performance/`, `.lighthouserc.json`
**Tests:** 14 tests measuring Core Web Vitals and bundle sizes

**What's Tested:**
- **LCP** (Largest Contentful Paint) ≤ 2.5s
- **FID** (First Input Delay) ≤ 100ms
- **INP** (Interaction to Next Paint) ≤ 200ms
- **CLS** (Cumulative Layout Shift) ≤ 0.1
- **TBT** (Total Blocking Time) ≤ 300ms
- **Speed Index** ≤ 3s
- **Bundle Size** ≤ 150KB (gzipped)
- **Animation Performance** 60fps target

**Run Performance Tests:**
```bash
# Core Web Vitals tests
npm run test:performance

# Lighthouse CI audit
npx lhci autorun

# Bundle size analysis
npm run build && npm run bundle:analyze
```

**View Results:**
- Core Web Vitals: Console output with metrics
- Lighthouse: `lighthouserc.json` reports
- Bundle analysis: Console output with sizes
- Performance report: `docs/performance-report.md`

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Quality Tests

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Build
        run: npm run build

      - name: Run quality tests
        run: npm run test:all-quality

      - name: Run Lighthouse CI
        run: npx lhci autorun

      - name: Analyze bundle
        run: npm run bundle:analyze

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            playwright-visual-report/
            test-results/
```

## Development Workflow

### Adding New Visual Tests

1. Create test file in `src/__tests__/visual/`
2. Write test with screenshot assertion:
   ```typescript
   test('my component', async ({ page }) => {
     await page.goto('/my-page')
     await expect(page.locator('.my-component')).toHaveScreenshot('my-component.png')
   })
   ```
3. Run test to generate baseline: `npm run test:visual`
4. Review baseline screenshot in `src/__tests__/visual/snapshots/`
5. Commit baseline to repository

### Adding New Accessibility Tests

1. Add test to appropriate file in `src/__tests__/accessibility/`
2. Use axe-core for automated checks:
   ```typescript
   const results = await new AxeBuilder({ page }).analyze()
   expect(results.violations).toEqual([])
   ```
3. Add manual checks for specific WCAG criteria
4. Run tests: `npm run test:accessibility`

### Adding New Performance Tests

1. Add test to `src/__tests__/performance/core-web-vitals.test.ts`
2. Use Performance Observer API:
   ```typescript
   const lcp = await page.evaluate(() => {
     return new Promise<number>((resolve) => {
       const observer = new PerformanceObserver((list) => {
         const entries = list.getEntries()
         resolve(entries[entries.length - 1].renderTime)
       })
       observer.observe({ type: 'largest-contentful-paint', buffered: true })
     })
   })
   expect(lcp).toBeLessThanOrEqual(2500)
   ```
3. Run tests: `npm run test:performance`

## Troubleshooting

### Visual Tests Failing

**Issue:** Screenshots don't match baseline
**Solution:**
1. Review diff in `playwright-visual-report/`
2. If intentional change, update baseline: `npm run test:visual -- --update-snapshots`
3. If unintentional, fix the code

**Issue:** Tests timeout
**Solution:**
1. Increase timeout in `playwright-visual.config.ts`
2. Check if dev server is running
3. Check network connectivity

### Accessibility Tests Failing

**Issue:** axe-core violations
**Solution:**
1. Review violation details in console output
2. Fix accessibility issue in code
3. Re-run tests to verify fix

**Issue:** Keyboard navigation fails
**Solution:**
1. Check element has proper tabindex
2. Verify element is visible and not disabled
3. Add ARIA attributes if needed

### Performance Tests Failing

**Issue:** Core Web Vitals above threshold
**Solution:**
1. Review specific metric (LCP, CLS, etc.)
2. Use Chrome DevTools Performance panel
3. Optimize images, code splitting, or bundle size

**Issue:** Bundle size exceeded
**Solution:**
1. Review bundle analysis output
2. Identify large dependencies
3. Use code splitting or lazy loading
4. Remove unused dependencies

## Best Practices

### Visual Testing

✅ **Do:**
- Disable animations with `animations: 'disabled'`
- Wait for content to load before screenshot
- Use descriptive file names
- Test different viewports and color schemes

❌ **Don't:**
- Take full-page screenshots when component-level is sufficient
- Include dynamic timestamps or IDs
- Test with random data that changes

### Accessibility Testing

✅ **Do:**
- Run axe-core on every page
- Test keyboard navigation manually
- Verify focus indicators are visible
- Check color contrast
- Test with actual screen readers

❌ **Don't:**
- Rely solely on automated tests
- Ignore warning-level issues
- Skip manual testing
- Assume compliance without validation

### Performance Testing

✅ **Do:**
- Test on throttled network
- Test with production builds
- Measure on real devices
- Set strict budgets
- Monitor trends over time

❌ **Don't:**
- Test only on fast machines
- Ignore mobile performance
- Skip bundle size analysis
- Set unrealistic budgets

## Resources

### Documentation

- [Accessibility Audit Report](../../docs/accessibility-audit-report.md)
- [Performance Report](../../docs/performance-report.md)
- [Implementation Report](../../agent-os/specs/2025-11-12-ui-ux-modernization/implementation/5-testing-implementation.md)

### External Resources

- [Playwright Documentation](https://playwright.dev/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

## Support

For questions or issues:
1. Check existing documentation
2. Review test output and error messages
3. Consult external resources
4. Ask in team chat or create an issue

---

**Last Updated:** 2025-11-13
**Test Coverage:** 104 tests (38 visual + 52 accessibility + 14 performance)
**Status:** ✅ All tests passing
