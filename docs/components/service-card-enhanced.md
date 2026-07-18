# ServiceCard (Container Query Enhanced)

## Overview

The `ServiceCard` component displays service information in a responsive card layout using **container queries** for true component-level responsiveness. Instead of relying on viewport-based media queries, the card adapts its layout based on its container width, making it reusable in any context (sidebar, grid, modal, etc.). Features include hover effects, skeleton loading states, pricing display, tags, metrics, and comprehensive accessibility support.

## Import

```typescript
import { ServiceCard } from '@/components/ServiceCard'
import { ServiceCardSkeleton } from '@/components/ui/skeleton-shimmer'
```

## Basic Usage

```tsx
<ServiceCard service={service} />
```

## Props API

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `service` | `Service` | - | Yes | Service data object |
| `loading` | `boolean` | `false` | No | Show skeleton loading state |
| `compact` | `boolean` | `false` | No | Compact layout with less information |
| `className` | `string` | - | No | Additional CSS classes |

### Service Type

```typescript
interface Service {
  id: string
  name: string
  slug: string
  description: string
  category: string
  subcategory?: string
  tags: string[]
  features: string[]
  company: {
    name: string
    website?: string
    founded?: number
  }
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'enterprise'
    freeQuota?: string
    paidPlans?: Array<{
      name: string
      price: string
    }>
  }
  metrics: {
    popularity?: number
    reliability?: number
    performance?: number
  }
  integrations?: Array<{ id: string; name: string }>
}
```

## Variants/Examples

### Basic Card

Standard service card with all information:

```tsx
import { ServiceCard } from '@/components/ServiceCard'

export function ServiceExample() {
  const service = {
    id: '1',
    name: 'PostgreSQL',
    slug: 'postgresql',
    description: 'Open-source relational database management system',
    category: 'Database',
    subcategory: 'SQL',
    tags: ['sql', 'relational', 'acid'],
    features: ['ACID compliant', 'JSON support', 'Full-text search'],
    company: {
      name: 'PostgreSQL Global Development Group',
      website: 'https://postgresql.org',
      founded: 1996
    },
    pricing: {
      type: 'free'
    },
    metrics: {
      popularity: 9.2,
      reliability: 99.9,
      performance: 8.8
    },
    integrations: []
  }

  return <ServiceCard service={service} />
}
```

### Loading State

Show skeleton while data is loading:

```tsx
import { ServiceCard } from '@/components/ServiceCard'

export function LoadingCard() {
  const { data: service, isLoading } = useQuery({
    queryKey: ['service', id],
    queryFn: fetchService
  })

  if (isLoading) {
    return <ServiceCard loading={true} />
    // Or use ServiceCardSkeleton directly:
    // return <ServiceCardSkeleton />
  }

  return <ServiceCard service={service} />
}
```

### Compact Mode

Reduced information for tight layouts:

```tsx
<ServiceCard service={service} compact={true} />
```

### Grid Layout

Cards adapt to container width in any grid:

```tsx
export function ServiceGrid() {
  const { services } = useServices()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map(service => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </div>
  )
}
```

### Sidebar Integration

Container queries make cards work perfectly in narrow sidebars:

```tsx
export function SidebarServices() {
  const { services } = useServices()

  return (
    <aside className="w-64 p-4">
      <h3 className="text-lg font-semibold mb-4">Popular Services</h3>
      <div className="space-y-4">
        {services.slice(0, 3).map(service => (
          <ServiceCard key={service.id} service={service} compact={true} />
        ))}
      </div>
    </aside>
  )
}
```

### Modal Integration

Cards adapt seamlessly in modals without layout issues:

```tsx
export function ServiceModal({ serviceId }) {
  const { data: service } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => fetchService(serviceId)
  })

  return (
    <Dialog>
      <DialogContent className="max-w-2xl">
        <ServiceCard service={service} />
      </DialogContent>
    </Dialog>
  )
}
```

## Container Query Breakpoints

The card uses container queries to adapt layout based on available width:

| Container Width | Behavior |
|----------------|----------|
| < 280px | Minimal layout: title, category, description (2 lines) |
| 280px - 300px | + Tags visible, description (3 lines) |
| 300px - 350px | + Typography scales up, integration count visible |
| 350px+ | Full layout: features visible, description (4 lines) |

### Container Query Classes

```tsx
// Typography scales with container width
className="@container(min-width: 300px):text-fluid-lg"

// Content visibility based on container width
className="@container(min-width: 280px):block hidden"

// Line clamping adapts to container width
className="line-clamp-2 @container(min-width: 300px):line-clamp-3 @container(min-width: 400px):line-clamp-4"

// Layout changes with container width
className="@container(min-width: 280px):flex-row flex-col"
```

## Accessibility

### Semantic HTML

```tsx
// Card is a semantic button for keyboard accessibility
<button
  type="button"
  className="service-card container-inline"
  onClick={handleCardClick}
  onKeyDown={handleKeyDown}
  aria-label={`View ${service.name} details`}
  tabIndex={0}
>
  <article>
    <h3>{service.name}</h3>
    <p>{service.description}</p>
  </article>
</button>
```

### Keyboard Interactions

| Key | Action |
|-----|--------|
| `Tab` | Focus card |
| `Enter` | Open service detail modal |
| `Space` | Open service detail modal |
| `Shift + Tab` | Focus previous card |

### ARIA Attributes

```tsx
// Clear action description
aria-label="View PostgreSQL details"

// Test IDs for testing
data-testid="service-card"
data-testid="service-name"
data-testid="service-category"
```

### Screen Reader Support

- **Service Name**: Announced as heading (h3)
- **Category**: Announced as text
- **Description**: Announced as paragraph
- **Pricing**: Accessible pricing information
- **Metrics**: Labels like "Popularity rating: 9.2"
- **Company**: Links announced with "opens in new tab"

### Focus States

```css
/* Global focus styles applied */
.service-card:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

### WCAG 2.2 Compliance

- ✅ **Focus Appearance (2.4.13)**: 2px outline, 4.5:1 contrast
- ✅ **Target Size (2.5.8)**: Entire card is clickable (>44x44px)
- ✅ **Color Contrast**: All text meets WCAG AA minimum
- ✅ **Keyboard Navigation**: Full keyboard support
- ✅ **Screen Reader**: Complete semantic structure

### Reduced Motion Support

```tsx
// Hover effects disabled with reduced motion
const [isHovered, setIsHovered] = useState(false)

// CSS handles reduced motion
@media (prefers-reduced-motion: reduce) {
  .service-card {
    transition: none;
  }
}
```

## Performance

### Bundle Impact

- **Component Size**: ~4KB gzipped
- **CSS**: Minimal (uses design tokens)
- **No Heavy Dependencies**: Pure React

### Rendering Performance

- **Container Queries**: Native CSS feature (no JS calculations)
- **Memoized Classes**: `useMemo` for className generation
- **Event Optimization**: Single click handler per card
- **Virtual Scrolling**: Compatible with react-window

### Container Query Performance

Container queries are more performant than viewport media queries:

```tsx
// ✅ Container queries: O(1) per container
.service-card @container(min-width: 300px) {
  font-size: var(--text-fluid-lg);
}

// ❌ Viewport queries: O(n) where n = all elements
@media (min-width: 768px) {
  .service-card {
    font-size: var(--text-fluid-lg);
  }
}
```

### Best Practices

```tsx
// ✅ Good: Let container queries handle responsiveness
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <ServiceCard service={service} />
</div>

// ✅ Good: Works in any container width
<aside className="w-64">
  <ServiceCard service={service} compact={true} />
</aside>

// ❌ Avoid: Don't add viewport media queries to card
<ServiceCard className="hidden md:block" service={service} />

// ✅ Good: Add container-level control instead
<div className="hidden md:block">
  <ServiceCard service={service} />
</div>
```

## TypeScript

### Type Definitions

See Props API section above for complete Service type definition.

### Usage with TypeScript

```tsx
import { ServiceCard } from '@/components/ServiceCard'
import type { Service } from '@/types/service-browser'

interface Props {
  services: Service[]
}

export function ServiceList({ services }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {services.map((service: Service) => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </div>
  )
}
```

## Related Components

- **[SkeletonShimmer](/docs/components/skeleton-shimmer.md)** - Loading skeleton for ServiceCard
- **[CommandPalette](/docs/components/command-palette.md)** - Quick service search and selection
- **[ServiceGrid](/src/components/ServiceGrid.tsx)** - Grid container for multiple cards

## Migration Guide

### From Viewport Media Queries

Before and after comparison:

```tsx
// Before: Viewport-based responsiveness
<div className="service-card">
  <h3 className="text-base md:text-lg lg:text-xl">
    {service.name}
  </h3>
  <p className="line-clamp-2 md:line-clamp-3">
    {service.description}
  </p>
</div>

// After: Container query responsiveness
<div className="service-card container-inline">
  <h3 className="text-fluid-base @container(min-width: 300px):text-fluid-lg">
    {service.name}
  </h3>
  <p className="line-clamp-2 @container(min-width: 300px):line-clamp-3">
    {service.description}
  </p>
</div>
```

### Setup Container Queries

1. Install Tailwind plugin:

```bash
npm install @tailwindcss/container-queries
```

2. Add to `tailwind.config.ts`:

```typescript
import containerQueries from '@tailwindcss/container-queries'

export default {
  plugins: [
    containerQueries,
  ],
}
```

3. Add container type to parent:

```tsx
// Add container-inline to the card wrapper
<div className="service-card container-inline">
  {/* Card content */}
</div>
```

## Best Practices

### When to Use Container Queries

✅ **Use for:**
- Component-level responsiveness
- Reusable components in different contexts
- Cards, panels, widgets
- Sidebar content

❌ **Still use viewport queries for:**
- Page layout (header, sidebar, main)
- Grid column counts
- Global navigation
- Full-page sections

### Design Patterns

```tsx
// Pattern 1: Adaptive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
  {services.map(service => (
    // Card adapts to grid column width automatically
    <ServiceCard key={service.id} service={service} />
  ))}
</div>

// Pattern 2: Flexible sidebar
<div className="flex gap-6">
  <aside className="w-64 shrink-0">
    {/* Card adapts to narrow sidebar */}
    <ServiceCard service={service} compact={true} />
  </aside>
  <main className="flex-1">
    {/* Card adapts to wider main area */}
    <ServiceCard service={service} />
  </main>
</div>

// Pattern 3: Modal integration
<Dialog>
  <DialogContent className="max-w-2xl">
    {/* Card adapts to modal width */}
    <ServiceCard service={service} />
  </DialogContent>
</Dialog>
```

### Common Pitfalls

1. **Missing container-inline**: Card must have container type
2. **Overriding container styles**: Don't add width constraints to card itself
3. **Too many breakpoints**: Let container queries handle responsiveness
4. **Ignoring compact mode**: Use for narrow containers (<300px)

---

**Component Version**: 1.0.0
**Last Updated**: 2025-11-13
**Dependencies**: @tailwindcss/container-queries
**Browser Support**: Chrome 106+, Safari 16+, Firefox 110+
