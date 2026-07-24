# Adoption Metrics Framework

## Overview

This framework helps you track the adoption and impact of Stapelwerk's UI/UX modernization across 3 key dimensions: **Component Adoption**, **Performance Impact**, and **User Experience**.

## Metrics Dashboard

### Component Adoption Rate

Track which new components and patterns are being used across the codebase.

#### Tracking Method

```typescript
// src/lib/analytics/adoption-metrics.ts
export const componentUsage = {
  // Phase 1: Design Tokens
  fluidTypography: {
    instances: 0,
    totalOpportunities: 0,
    adoptionRate: 0
  },
  fluidSpacing: {
    instances: 0,
    totalOpportunities: 0,
    adoptionRate: 0
  },
  semanticColors: {
    instances: 0,
    totalOpportunities: 0,
    adoptionRate: 0
  },

  // Phase 2: Components
  magneticButton: {
    instances: 0,
    totalOpportunities: 0,
    adoptionRate: 0
  },
  skeletonShimmer: {
    instances: 0,
    totalOpportunities: 0,
    adoptionRate: 0
  },
  serviceCardContainerQuery: {
    instances: 0,
    totalOpportunities: 0,
    adoptionRate: 0
  },
  enhancedToast: {
    instances: 0,
    totalOpportunities: 0,
    adoptionRate: 0
  },

  // Phase 3: Patterns
  commandPalette: {
    integrated: false,
    usageCount: 0
  },
  microInteractions: {
    instances: 0,
    totalOpportunities: 0,
    adoptionRate: 0
  }
}

// Calculate adoption rate
export function calculateAdoptionRate() {
  let totalInstances = 0
  let totalOpportunities = 0

  Object.entries(componentUsage).forEach(([key, value]) => {
    if ('instances' in value && 'totalOpportunities' in value) {
      totalInstances += value.instances
      totalOpportunities += value.totalOpportunities
    }
  })

  return totalOpportunities > 0
    ? (totalInstances / totalOpportunities) * 100
    : 0
}
```

#### Measurement Script

```bash
#!/bin/bash
# scripts/measure-adoption.sh

echo "Measuring UI/UX Modernization Adoption..."
echo ""

# Phase 1: Design Tokens
echo "Phase 1: Design Tokens"
echo "======================"

# Fluid Typography
FLUID_TYPO=$(grep -r "text-fluid-" src/ --include="*.tsx" --include="*.ts" | wc -l)
LEGACY_TYPO=$(grep -r "text-.*md:text-" src/ --include="*.tsx" --include="*.ts" | wc -l)
TOTAL_TYPO=$((FLUID_TYPO + LEGACY_TYPO))
if [ $TOTAL_TYPO -gt 0 ]; then
  TYPO_RATE=$((FLUID_TYPO * 100 / TOTAL_TYPO))
else
  TYPO_RATE=0
fi
echo "Fluid Typography: $FLUID_TYPO / $TOTAL_TYPO instances ($TYPO_RATE%)"

# Fluid Spacing
FLUID_SPACE=$(grep -r "fluid-" src/ --include="*.tsx" --include="*.ts" | wc -l)
LEGACY_SPACE=$(grep -r "p-[0-9].*md:p-" src/ --include="*.tsx" --include="*.ts" | wc -l)
TOTAL_SPACE=$((FLUID_SPACE + LEGACY_SPACE))
if [ $TOTAL_SPACE -gt 0 ]; then
  SPACE_RATE=$((FLUID_SPACE * 100 / TOTAL_SPACE))
else
  SPACE_RATE=0
fi
echo "Fluid Spacing: $FLUID_SPACE / $TOTAL_SPACE instances ($SPACE_RATE%)"

# Semantic Colors
SEMANTIC_COLORS=$(grep -rE "(bg-success|bg-warning|bg-info|bg-destructive)" src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "Semantic Colors: $SEMANTIC_COLORS instances"

echo ""

# Phase 2: Components
echo "Phase 2: Components"
echo "==================="

MAGNETIC_BTN=$(grep -r "MagneticButton" src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "MagneticButton: $MAGNETIC_BTN instances"

SKELETON_SHIMMER=$(grep -r "SkeletonShimmer" src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "SkeletonShimmer: $SKELETON_SHIMMER instances"

CONTAINER_QUERY=$(grep -r "@container" src/ --include="*.tsx" --include="*.ts" --include="*.css" | wc -l)
echo "Container Queries: $CONTAINER_QUERY instances"

ENHANCED_TOAST=$(grep -rE "variant.*success|warning|info" src/ --include="*.tsx" --include="*.ts" | grep -i toast | wc -l)
echo "Enhanced Toast: $ENHANCED_TOAST instances"

echo ""

# Phase 3: Patterns
echo "Phase 3: Patterns"
echo "================="

CMD_PALETTE=$(grep -r "CommandPalette" src/ --include="*.tsx" --include="*.ts" | wc -l)
if [ $CMD_PALETTE -gt 0 ]; then
  echo "Command Palette: ✅ Integrated"
else
  echo "Command Palette: ❌ Not integrated"
fi

MICRO_INTERACTIONS=$(grep -rE "(animate-ripple|magnetic|haptic)" src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "Micro-interactions: $MICRO_INTERACTIONS instances"

echo ""

# Overall Adoption Rate
TOTAL_NEW=$((FLUID_TYPO + FLUID_SPACE + SEMANTIC_COLORS + MAGNETIC_BTN + SKELETON_SHIMMER + CONTAINER_QUERY + ENHANCED_TOAST + CMD_PALETTE + MICRO_INTERACTIONS))
echo "Total New Pattern Usage: $TOTAL_NEW instances"

# Calculate overall progress
PHASE1_PROGRESS=$(((TYPO_RATE + SPACE_RATE) / 2))
PHASE2_PROGRESS=$((MAGNETIC_BTN + SKELETON_SHIMMER + CONTAINER_QUERY + ENHANCED_TOAST))
PHASE3_PROGRESS=$((CMD_PALETTE + MICRO_INTERACTIONS))

echo ""
echo "Phase Progress:"
echo "Phase 1 (Design Tokens): $PHASE1_PROGRESS%"
echo "Phase 2 (Components): $PHASE2_PROGRESS instances"
echo "Phase 3 (Patterns): $PHASE3_PROGRESS instances"
```

#### Target Milestones

| Phase | Milestone | Target Adoption | Timeline |
|-------|-----------|----------------|----------|
| **Phase 1** | Design tokens adopted | ≥80% | Week 2 |
| **Phase 2** | Core components migrated | ≥60% | Week 4 |
| **Phase 3** | Patterns integrated | 100% | Week 6 |
| **Complete** | Full modernization | ≥90% | Week 7 |

---

## Performance Impact Metrics

### Core Web Vitals

Track before/after performance metrics:

#### Measurement

```typescript
// src/lib/analytics/performance-metrics.ts
import { onCLS, onFID, onLCP, onINP } from 'web-vitals'

export function measureCoreWebVitals() {
  onLCP((metric) => {
    console.log('LCP:', metric.value)
    // Send to analytics
  })

  onFID((metric) => {
    console.log('FID:', metric.value)
    // Send to analytics
  })

  onCLS((metric) => {
    console.log('CLS:', metric.value)
    // Send to analytics
  })

  onINP((metric) => {
    console.log('INP:', metric.value)
    // Send to analytics
  })
}
```

#### Target Metrics

| Metric | Before | Target | Actual | Status |
|--------|--------|--------|--------|--------|
| **LCP** (Largest Contentful Paint) | 2.3s | ≤2.1s | _measure_ | 🟡 |
| **FID** (First Input Delay) | 85ms | ≤75ms | _measure_ | 🟡 |
| **CLS** (Cumulative Layout Shift) | 0.08 | ≤0.02 | _measure_ | 🟡 |
| **INP** (Interaction to Next Paint) | 150ms | ≤100ms | _measure_ | 🟡 |
| **TTI** (Time to Interactive) | 3.2s | ≤3.0s | _measure_ | 🟡 |

**Legend**: 🟢 Good | 🟡 Needs improvement | 🔴 Poor

### Bundle Size Impact

Track JavaScript bundle size changes:

```bash
# Measure bundle size
npm run build
npx next-bundle-analyzer
```

| Asset | Before | After | Change | Impact |
|-------|--------|-------|--------|--------|
| Initial JS | 128KB | 145KB | +17KB (+13%) | Acceptable |
| Total JS | 342KB | 361KB | +19KB (+6%) | Acceptable |
| CSS | 24KB | 27KB | +3KB (+13%) | Acceptable |
| **Total** | **494KB** | **533KB** | **+39KB (+8%)** | ✅ |

**Target**: Keep total bundle increase <10% (+50KB)

### Animation Performance

Track animation frame rates:

```typescript
// src/lib/analytics/animation-metrics.ts
let frameCount = 0
let lastTime = performance.now()
let fps = 0

function measureFPS() {
  const currentTime = performance.now()
  frameCount++

  if (currentTime >= lastTime + 1000) {
    fps = Math.round((frameCount * 1000) / (currentTime - lastTime))
    frameCount = 0
    lastTime = currentTime

    console.log('FPS:', fps)

    // Track if below 60fps
    if (fps < 55) {
      console.warn('Low FPS detected:', fps)
    }
  }

  requestAnimationFrame(measureFPS)
}

// Start measuring
requestAnimationFrame(measureFPS)
```

**Target**: Maintain ≥55 FPS (90% of 60fps) during animations

---

## User Experience Metrics

### Accessibility Scores

Track WCAG compliance:

```bash
# Run Lighthouse accessibility audit
npm run lighthouse -- --only-categories=accessibility

# Run axe-core audit
npm run test:a11y
```

| Category | Before | After | Target | Status |
|----------|--------|-------|--------|--------|
| **Lighthouse Accessibility** | 85/100 | _measure_ | 100/100 | 🟡 |
| **axe-core Violations** | 12 | _measure_ | 0 | 🟡 |
| **WCAG 2.2 AA Compliance** | 78% | _measure_ | 100% | 🟡 |
| **Keyboard Navigation** | Partial | _measure_ | 100% | 🟡 |

### User Engagement

Track how users interact with new features:

#### Command Palette Usage

```typescript
// Track in analytics
const commandPaletteMetrics = {
  opens: 0,
  searches: 0,
  selections: 0,
  keyboardShortcutUsage: 0, // Cmd+K vs click
  averageSearchTime: 0 // ms
}

// Calculate conversion rate
const conversionRate = (selections / opens) * 100
```

**Targets**:
- Command Palette opens: ≥10% of page views
- Keyboard shortcut usage: ≥60% of opens
- Search-to-selection conversion: ≥40%
- Average search time: <2 seconds

#### Toast Engagement

```typescript
const toastMetrics = {
  shown: 0,
  dismissed: 0,
  actionsClicked: 0,
  hoverToPause: 0,
  averageDismissTime: 0 // ms
}

// Calculate engagement rate
const engagementRate = (actionsClicked / shown) * 100
```

**Targets**:
- Action button clicks: ≥20% of toasts with actions
- Hover-to-pause usage: ≥5% of toasts
- User dismissal (vs auto): ≤30%

#### Magnetic Button Interaction

```typescript
const magneticButtonMetrics = {
  hovers: 0,
  clicks: 0,
  hoverToClickConversion: 0,
  averageHoverTime: 0 // ms
}

// Calculate conversion rate
const conversionRate = (clicks / hovers) * 100
```

**Targets**:
- Hover-to-click conversion: ≥80%
- Average hover time: 500-1500ms (engagement indicator)

---

## Reporting

### Weekly Progress Report

```markdown
# UI/UX Modernization - Week N Progress

## Component Adoption
- **Phase 1 (Design Tokens)**: X% complete
  - Fluid Typography: Y instances
  - Fluid Spacing: Z instances
  - Semantic Colors: W instances

- **Phase 2 (Components)**: X instances deployed
  - MagneticButton: Y instances
  - SkeletonShimmer: Z instances
  - Enhanced Toast: W instances

- **Phase 3 (Patterns)**: X% complete
  - Command Palette: [✅/❌]
  - Micro-interactions: Y instances

## Performance Impact
- **Core Web Vitals**:
  - LCP: X.Xs (target: ≤2.1s) [🟢/🟡/🔴]
  - FID: Xms (target: ≤75ms) [🟢/🟡/🔴]
  - CLS: 0.0X (target: ≤0.02) [🟢/🟡/🔴]
  - INP: Xms (target: ≤100ms) [🟢/🟡/🔴]

- **Bundle Size**: +XKB (+X%) [Within target: ✅/❌]

## Accessibility
- **Lighthouse Score**: X/100 (target: 100)
- **WCAG 2.2 AA Compliance**: X% (target: 100%)
- **axe-core Violations**: X (target: 0)

## User Engagement
- **Command Palette Usage**: X opens, Y% conversion
- **Toast Actions**: X clicks, Y% engagement
- **Magnetic Button**: X% hover-to-click conversion

## Blockers
[List any blockers or issues]

## Next Week Goals
[List upcoming milestones]
```

### Final Report Template

```markdown
# UI/UX Modernization - Final Report

## Executive Summary
- **Timeline**: X weeks (planned: 7 weeks)
- **Adoption Rate**: X% overall
- **Performance Impact**: [Positive/Neutral/Negative]
- **Accessibility Achievement**: WCAG 2.2 AA [100%/Partial]

## Detailed Metrics

### Component Adoption
[Tables with final numbers]

### Performance Improvements
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| LCP | 2.3s | X.Xs | -X% |
| FID | 85ms | Xms | -X% |
| CLS | 0.08 | 0.0X | -X% |
| Bundle | 494KB | XKB | +X% |

### Accessibility Achievements
- WCAG 2.2 AA Compliance: X%
- Lighthouse Score: X/100
- All new criteria met: [✅/❌]

### User Impact
- Improved engagement: +X%
- Command palette adoption: X%
- Reduced bounce rate: -X%

## Lessons Learned
[Document key insights]

## Recommendations
[Future improvements]
```

---

## Automated Tracking

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/ui-metrics.yml
name: UI Metrics

on:
  pull_request:
    branches: [main]

jobs:
  metrics:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Measure adoption
        run: bash scripts/measure-adoption.sh

      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
          uploadArtifacts: true
          temporaryPublicStorage: true

      - name: Bundle analysis
        run: npm run analyze

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: 'Metrics report: [results]'
            })
```

---

## Dashboard Visualization

### Recommended Tools

1. **Google Lighthouse CI**: Performance tracking
2. **Chromatic**: Visual regression testing
3. **Grafana**: Custom metric dashboards
4. **Sentry**: Error tracking with performance data
5. **Google Analytics**: User engagement metrics

### Custom Dashboard

Create a simple dashboard:

```tsx
// src/app/admin/metrics/page.tsx
export default function MetricsPage() {
  const adoption = useAdoptionMetrics()
  const performance = usePerformanceMetrics()
  const accessibility = useAccessibilityMetrics()

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">UI/UX Modernization Metrics</h1>

      <MetricCard
        title="Component Adoption"
        value={`${adoption.rate}%`}
        trend={adoption.trend}
        target={90}
      />

      <MetricCard
        title="Core Web Vitals"
        metrics={[
          { name: 'LCP', value: performance.lcp, target: 2.1 },
          { name: 'FID', value: performance.fid, target: 75 },
          { name: 'CLS', value: performance.cls, target: 0.02 }
        ]}
      />

      <MetricCard
        title="Accessibility"
        value={accessibility.lighthouseScore}
        trend={accessibility.trend}
        target={100}
      />
    </div>
  )
}
```

---

**Last Updated**: 2025-11-13
**Version**: 1.0.0
**Tracking Frequency**: Weekly
**Review Cycle**: Bi-weekly
