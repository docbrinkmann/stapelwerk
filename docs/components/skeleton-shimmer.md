# SkeletonShimmer

## Overview

The `SkeletonShimmer` component provides an enhanced loading skeleton with a gradient shimmer animation that creates better perceived performance compared to simple pulse animations. It shows directional movement that simulates content loading, automatically falls back to pulse animation for users who prefer reduced motion, and includes pre-configured variants for common use cases.

## Import

```typescript
import { SkeletonShimmer, ServiceCardSkeleton } from '@/components/ui/skeleton-shimmer'
```

## Basic Usage

```tsx
// Basic text placeholder
<SkeletonShimmer variant="text" width="60%" height={20} />

// Card placeholder
<SkeletonShimmer variant="card" />

// Circular avatar placeholder
<SkeletonShimmer variant="circular" width={40} height={40} />
```

## Props API

### SkeletonShimmer

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `variant` | `'text' \| 'circular' \| 'rectangular' \| 'card'` | `'rectangular'` | No | Visual variant of the skeleton |
| `width` | `string \| number` | `'100%'` | No | Width of the skeleton (CSS value or number in px) |
| `height` | `string \| number` | varies by variant | No | Height of the skeleton (CSS value or number in px) |
| `className` | `string` | - | No | Additional CSS classes |
| `forceReducedMotion` | `boolean` | `false` | No | Override reduced motion detection for testing |
| ...rest | `HTMLAttributes<HTMLDivElement>` | - | No | All standard div attributes |

### Default Heights by Variant

| Variant | Default Height | Use Case |
|---------|----------------|----------|
| `text` | 16px | Single line text |
| `circular` | 40px | Avatar or icon |
| `rectangular` | 100px | Block content |
| `card` | 200px | Full card structure |

### ServiceCardSkeleton

Pre-configured skeleton that matches `ServiceCard` layout exactly to prevent CLS.

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `className` | `string` | - | No | Additional CSS classes |
| ...rest | `HTMLAttributes<HTMLDivElement>` | - | No | All standard div attributes |

## Variants/Examples

### Text Skeleton

Single or multiple line text placeholders:

```tsx
import { SkeletonShimmer } from '@/components/ui/skeleton-shimmer'

export function TextSkeleton() {
  return (
    <div className="space-y-2">
      {/* Heading */}
      <SkeletonShimmer variant="text" width="40%" height={32} />

      {/* Paragraph (3 lines) */}
      <SkeletonShimmer variant="text" width="100%" height={16} />
      <SkeletonShimmer variant="text" width="95%" height={16} />
      <SkeletonShimmer variant="text" width="80%" height={16} />

      {/* Small text */}
      <SkeletonShimmer variant="text" width="30%" height={14} />
    </div>
  )
}
```

### Circular Skeleton

Avatar or icon placeholders:

```tsx
// Avatar
<SkeletonShimmer variant="circular" width={64} height={64} />

// Small icon
<SkeletonShimmer variant="circular" width={24} height={24} />

// Profile picture with name
<div className="flex items-center gap-3">
  <SkeletonShimmer variant="circular" width={40} height={40} />
  <div className="flex-1 space-y-2">
    <SkeletonShimmer variant="text" width="60%" height={16} />
    <SkeletonShimmer variant="text" width="40%" height={14} />
  </div>
</div>
```

### Rectangular Skeleton

General content blocks:

```tsx
// Image placeholder
<SkeletonShimmer
  variant="rectangular"
  width="100%"
  height={200}
  className="rounded-lg"
/>

// Video thumbnail
<SkeletonShimmer
  variant="rectangular"
  width={320}
  height={180}
  className="rounded-md aspect-video"
/>

// Button placeholder
<SkeletonShimmer
  variant="rectangular"
  width={120}
  height={44}
  className="rounded-lg"
/>
```

### Card Skeleton

Pre-built card structure with multiple elements:

```tsx
// Automatic card layout
<SkeletonShimmer variant="card" />

// Custom card height
<SkeletonShimmer variant="card" height={300} />

// Multiple cards in grid
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {Array.from({ length: 6 }).map((_, i) => (
    <SkeletonShimmer key={i} variant="card" />
  ))}
</div>
```

### ServiceCardSkeleton

Matches exact layout of ServiceCard component:

```tsx
import { ServiceCardSkeleton } from '@/components/ui/skeleton-shimmer'

export function ServiceGrid() {
  const { services, isLoading } = useServices()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <ServiceCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map(service => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </div>
  )
}
```

### Complex Layouts

Build custom skeleton layouts:

```tsx
export function ArticleSkeleton() {
  return (
    <article className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <SkeletonShimmer variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <SkeletonShimmer variant="text" width="40%" height={20} />
          <SkeletonShimmer variant="text" width="30%" height={16} />
        </div>
      </div>

      {/* Title */}
      <SkeletonShimmer variant="text" width="90%" height={36} />
      <SkeletonShimmer variant="text" width="70%" height={36} />

      {/* Featured image */}
      <SkeletonShimmer variant="rectangular" width="100%" height={400} />

      {/* Content */}
      <div className="space-y-3">
        <SkeletonShimmer variant="text" width="100%" height={16} />
        <SkeletonShimmer variant="text" width="98%" height={16} />
        <SkeletonShimmer variant="text" width="95%" height={16} />
        <SkeletonShimmer variant="text" width="100%" height={16} />
        <SkeletonShimmer variant="text" width="85%" height={16} />
      </div>

      {/* Tags */}
      <div className="flex gap-2">
        <SkeletonShimmer variant="rectangular" width={60} height={28} />
        <SkeletonShimmer variant="rectangular" width={80} height={28} />
        <SkeletonShimmer variant="rectangular" width={70} height={28} />
      </div>
    </article>
  )
}
```

### Integration with Data Fetching

Real-world usage patterns:

```tsx
import { ServiceCardSkeleton } from '@/components/ui/skeleton-shimmer'
import { ServiceCard } from '@/components/ServiceCard'

export function ServiceList() {
  const { data: services, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices
  })

  if (error) {
    return <ErrorMessage error={error} />
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <ServiceCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {services.map(service => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </div>
  )
}
```

## Accessibility

### ARIA Attributes

All skeletons include proper accessibility attributes:

```tsx
<div
  role="status"
  aria-label="Loading..."
  aria-live="polite"
>
  <SkeletonShimmer variant="card" />
</div>
```

### Screen Reader Behavior

- **role="status"**: Announces loading state to screen readers
- **aria-live="polite"**: Updates announced when content changes
- **aria-label="Loading..."**: Clear description of loading state
- When content loads, skeleton is replaced and screen readers announce new content

### Reduced Motion Support

Component automatically detects and respects `prefers-reduced-motion`:

```tsx
// With motion enabled (default):
// - Shimmer gradient sweeps across skeleton
// - Smooth directional animation (2s loop)

// With reduced motion enabled:
// - Falls back to simple pulse animation
// - No gradient movement
// - Opacity-based animation only
```

### WCAG Compliance

- ✅ **Color Contrast**: Uses `bg-muted` token with sufficient contrast
- ✅ **Reduced Motion**: Automatic fallback to pulse animation
- ✅ **Screen Reader**: Proper ARIA attributes for loading state
- ✅ **Focus Management**: No interactive elements (non-focusable)

## Performance

### Bundle Impact

- **Component Size**: ~1KB gzipped
- **No Dependencies**: Pure React + CSS
- **Total Impact**: Minimal (uses existing design tokens)

### Animation Performance

- **GPU Acceleration**: Uses CSS `transform: translateX()` for 60fps
- **Minimal Repaints**: Animation contained within pseudo-element
- **No Layout Shifts**: Dimensions match target content exactly
- **Composite Layers**: Shimmer animation on separate layer

### Rendering Optimization

```tsx
// ✅ Good: Matches exact dimensions of target content
<SkeletonShimmer variant="rectangular" width={320} height={180} />
<Image src={url} width={320} height={180} />

// ❌ Avoid: Mismatched dimensions cause CLS
<SkeletonShimmer variant="rectangular" width="100%" height={100} />
<Image src={url} width={320} height={180} />
```

### CSS Animation

The shimmer effect uses CSS animations for optimal performance:

```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
```

### Best Practices

```tsx
// ✅ Good: Reuse for multiple items
const skeletons = Array.from({ length: 10 }, (_, i) => (
  <SkeletonShimmer key={i} variant="card" />
))

// ✅ Good: Match layout exactly
<SkeletonShimmer
  variant="rectangular"
  width="100%"
  height={200}
  className="rounded-xl" // Same border-radius as real content
/>

// ❌ Avoid: Too many different skeleton sizes (causes CLS)
<SkeletonShimmer width="80%" />
<RealContent width="100%" />
```

## TypeScript

### Type Definitions

```typescript
import { HTMLAttributes } from 'react'

export interface SkeletonShimmerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visual variant of the skeleton
   * @default 'rectangular'
   */
  variant?: 'text' | 'circular' | 'rectangular' | 'card'

  /**
   * Width of the skeleton (CSS value)
   * @default '100%'
   */
  width?: string | number

  /**
   * Height of the skeleton (CSS value)
   * @default varies by variant
   */
  height?: string | number

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Override reduced motion detection for testing
   * @default false
   */
  forceReducedMotion?: boolean
}
```

### Usage with TypeScript

```tsx
import { SkeletonShimmer, SkeletonShimmerProps } from '@/components/ui/skeleton-shimmer'

// With explicit props
const skeletonProps: Partial<SkeletonShimmerProps> = {
  variant: 'text',
  width: '60%',
  height: 20,
  className: 'mb-2'
}

<SkeletonShimmer {...skeletonProps} />

// Type-safe variant
type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'card'

const variant: SkeletonVariant = 'card'
<SkeletonShimmer variant={variant} />
```

## Related Components

- **[ServiceCard](/src/components/ServiceCard.tsx)** - Uses ServiceCardSkeleton for loading state
- **[Loading States](/docs/design-system.md#loading-states)** - Design system guidelines

## Migration Guide

### From Basic Skeleton

Upgrade from shadcn/ui Skeleton component:

```tsx
// Before: Basic skeleton
import { Skeleton } from '@/components/ui/skeleton'

<Skeleton className="h-12 w-12 rounded-full" />
<Skeleton className="h-4 w-[250px]" />
<Skeleton className="h-4 w-[200px]" />

// After: SkeletonShimmer (with shimmer effect)
import { SkeletonShimmer } from '@/components/ui/skeleton-shimmer'

<SkeletonShimmer variant="circular" width={48} height={48} />
<SkeletonShimmer variant="text" width={250} height={16} />
<SkeletonShimmer variant="text" width={200} height={16} />
```

### From Custom Loading Spinner

Replace spinners with content-shaped skeletons:

```tsx
// Before: Generic spinner
{isLoading && <Spinner />}
{data && <ServiceCard service={data} />}

// After: Content-shaped skeleton
{isLoading && <ServiceCardSkeleton />}
{data && <ServiceCard service={data} />}
```

## Best Practices

### When to Use

✅ **Use SkeletonShimmer for:**
- Content that's actively loading
- Delayed data fetching (>200ms)
- Image placeholders
- List/grid loading states

❌ **Don't use SkeletonShimmer for:**
- Very fast operations (<100ms) - show content directly
- Form validation feedback - use error messages
- Infinite scrolling - use "Loading more..." text
- Initial page load - consider SSR instead

### Design Tips

1. **Match Layout Exactly**: Skeleton dimensions should match real content
2. **Use Realistic Counts**: Show expected number of items, not arbitrary count
3. **Progressive Disclosure**: Show skeletons for visible viewport only
4. **Avoid CLS**: Ensure skeleton and content have identical dimensions

### Common Patterns

```tsx
// Pattern 1: Grid of cards
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {isLoading ? (
    Array.from({ length: 9 }).map((_, i) => (
      <ServiceCardSkeleton key={i} />
    ))
  ) : (
    services.map(service => (
      <ServiceCard key={service.id} service={service} />
    ))
  )}
</div>

// Pattern 2: Gradual content reveal
<div>
  <SkeletonShimmer variant="text" width="60%" height={32} />
  {data ? (
    <p>{data.description}</p>
  ) : (
    <div className="space-y-2">
      <SkeletonShimmer variant="text" width="100%" />
      <SkeletonShimmer variant="text" width="95%" />
      <SkeletonShimmer variant="text" width="80%" />
    </div>
  )}
</div>

// Pattern 3: Suspense integration
<Suspense fallback={<ServiceCardSkeleton />}>
  <ServiceCard service={service} />
</Suspense>
```

### Performance Tips

1. **Reuse Components**: Don't create new skeleton variants unnecessarily
2. **Match Dimensions**: Prevent CLS by matching content dimensions exactly
3. **Limit Animations**: Shimmer is already performant, don't add extra animations
4. **Virtualization**: For long lists, virtualize skeletons too

---

**Component Version**: 1.0.0
**Last Updated**: 2025-11-13
**Dependencies**: useReducedMotion hook
**Bundle Size**: ~1KB gzipped
