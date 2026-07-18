# MagneticButton

## Overview

The `MagneticButton` component provides an interactive button with a magnetic cursor effect that creates haptic-like visual feedback. The button subtly follows the cursor within a configurable range, creating an engaging micro-interaction that enhances user experience. It automatically respects user's reduced motion preferences for accessibility.

## Import

```typescript
import { MagneticButton } from '@/components/ui/magnetic-button'
```

## Basic Usage

```tsx
<MagneticButton magneticStrength={20}>
  Click me
</MagneticButton>
```

## Props API

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `children` | `React.ReactNode` | - | Yes | Button content |
| `className` | `string` | `''` | No | Additional CSS classes |
| `magneticStrength` | `number` | `20` | No | Controls how strongly the button follows the cursor (0-100). Higher values = stronger effect |
| `forceReducedMotion` | `boolean` | `false` | No | Override reduced motion detection for testing |
| ...rest | `HTMLMotionProps<'button'>` | - | No | All standard button and Framer Motion props |

## Variants/Examples

### Basic Example

Simple magnetic button with default settings:

```tsx
import { MagneticButton } from '@/components/ui/magnetic-button'

export function BasicExample() {
  return (
    <MagneticButton className="px-6 py-3 bg-primary text-primary-foreground rounded-lg">
      Get Started
    </MagneticButton>
  )
}
```

### Adjusting Magnetic Strength

Control the intensity of the magnetic effect:

```tsx
// Subtle effect
<MagneticButton magneticStrength={10}>
  Subtle Effect
</MagneticButton>

// Default (medium effect)
<MagneticButton magneticStrength={20}>
  Default Effect
</MagneticButton>

// Strong effect
<MagneticButton magneticStrength={40}>
  Strong Effect
</MagneticButton>
```

### With Icons

Combine with icons from lucide-react:

```tsx
import { MagneticButton } from '@/components/ui/magnetic-button'
import { ArrowRight, Download, ExternalLink } from 'lucide-react'

export function WithIcons() {
  return (
    <div className="flex gap-4">
      <MagneticButton className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg">
        <span>Get Started</span>
        <ArrowRight className="w-5 h-5" />
      </MagneticButton>

      <MagneticButton className="inline-flex items-center gap-2 px-6 py-3 border-2 border-border rounded-lg">
        <Download className="w-5 h-5" />
        <span>Download</span>
      </MagneticButton>
    </div>
  )
}
```

### Integration with Hero Section

Real-world usage in BuildMyStack hero section:

```tsx
import { MagneticButton } from '@/components/ui/magnetic-button'
import { ArrowRight } from 'lucide-react'

export function HeroCTA() {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Primary CTA */}
      <MagneticButton
        magneticStrength={20}
        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
      >
        <span>Get Started</span>
        <ArrowRight className="w-5 h-5" />
      </MagneticButton>

      {/* Secondary CTA */}
      <MagneticButton
        magneticStrength={15}
        className="inline-flex items-center justify-center px-8 py-4 bg-background/50 backdrop-blur-sm border-2 border-border hover:border-primary/50 rounded-xl font-semibold"
      >
        <span>View Examples</span>
      </MagneticButton>
    </div>
  )
}
```

### With Event Handlers

The component preserves all standard button event handlers:

```tsx
<MagneticButton
  onClick={() => console.log('Clicked!')}
  onMouseMove={(e) => console.log('Custom mouse handler')}
  onMouseLeave={(e) => console.log('Mouse left')}
  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg"
>
  Track Events
</MagneticButton>
```

## Accessibility

### ARIA Attributes

The component forwards all ARIA attributes to the underlying button:

```tsx
<MagneticButton
  aria-label="Start building your Docker stack"
  aria-describedby="cta-description"
>
  Get Started
</MagneticButton>
```

### Keyboard Interactions

- **Space/Enter**: Activates the button (standard button behavior)
- **Tab**: Focuses the button (standard focus management)

All keyboard interactions work identically to standard HTML buttons.

### Screen Reader Behavior

- Component uses semantic `<button>` element
- All content is accessible to screen readers
- Magnetic effect is purely visual - no impact on screen reader UX
- ARIA labels and descriptions are fully supported

### WCAG Compliance

- **WCAG 2.2 Focus Appearance**: Component inherits global focus styles (2px outline, 4.5:1 contrast)
- **Target Size**: Ensure button dimensions meet 24x24px minimum (developer responsibility)
- **Reduced Motion**: Automatically disables magnetic effect when user prefers reduced motion
- **Color Contrast**: Uses design tokens that maintain WCAG AA contrast ratios

### Reduced Motion Support

The component automatically detects and respects `prefers-reduced-motion`:

```tsx
// When reduced motion is enabled:
// - No magnetic cursor following
// - No hover scale animation
// - No tap scale animation
// - Button behaves like standard button

// Developer can override for testing:
<MagneticButton forceReducedMotion={true}>
  No Animation
</MagneticButton>
```

## Performance

### Bundle Impact

- **Bundle Size**: ~2KB gzipped (includes Framer Motion hooks)
- **Dependencies**: Framer Motion (shared with other components)
- **Runtime**: Uses `useSpring` hook for smooth animations

### Rendering Performance

- **GPU Acceleration**: Uses CSS `transform` properties (translate3d) for 60fps performance
- **Minimal Repaints**: Only transforms button position, no layout changes
- **Spring Animation**: Optimized stiffness (150) and damping (15) for natural motion
- **Efficient Calculations**: Distance/position math runs on each `mousemove` event

### Optimization Tips

1. **Limit Instances**: Use for primary CTAs only (1-3 per page)
2. **Throttle Events**: Browser automatically throttles `mousemove` events
3. **Respect Reduced Motion**: Always honor user preferences
4. **Spring Configuration**: Default values are optimized, avoid changing unless necessary

```tsx
// Good: Use for primary CTAs
<MagneticButton className="px-8 py-4 bg-primary text-primary-foreground">
  Get Started
</MagneticButton>

// Avoid: Too many magnetic buttons
<div>
  {items.map(item => (
    <MagneticButton key={item.id}>{item.name}</MagneticButton>
  ))}
</div>
```

## TypeScript

### Type Definitions

```typescript
import { HTMLMotionProps } from 'framer-motion'

export interface MagneticButtonProps extends Omit<HTMLMotionProps<'button'>, 'style'> {
  /**
   * Controls how strongly the button follows the cursor (0-100)
   * Higher values = stronger magnetic effect
   * @default 20
   */
  magneticStrength?: number

  /**
   * Button content
   */
  children: React.ReactNode

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
import { MagneticButton, MagneticButtonProps } from '@/components/ui/magnetic-button'

// With explicit props
const props: Partial<MagneticButtonProps> = {
  magneticStrength: 25,
  className: 'px-6 py-3',
  onClick: (e) => console.log('Clicked', e)
}

<MagneticButton {...props}>
  Click Me
</MagneticButton>

// With type-safe ref
const buttonRef = useRef<HTMLButtonElement>(null)

<MagneticButton ref={buttonRef}>
  With Ref
</MagneticButton>
```

## Related Components

- **[HeroSection](/docs/components/hero-section.md)** - Uses MagneticButton for primary CTAs
- **[Button](/src/components/ui/button.tsx)** - Standard button component without magnetic effect

## Migration Guide

### From Standard Button

If you're using a standard button and want to add magnetic effect:

```tsx
// Before: Standard button
<button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg">
  Get Started
</button>

// After: MagneticButton (drop-in replacement)
<MagneticButton className="px-6 py-3 bg-primary text-primary-foreground rounded-lg">
  Get Started
</MagneticButton>
```

### From shadcn/ui Button

MagneticButton wraps a `motion.button`, so you can combine with Button variants:

```tsx
import { MagneticButton } from '@/components/ui/magnetic-button'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

<MagneticButton
  className={cn(
    buttonVariants({ variant: 'default', size: 'lg' }),
    'additional-classes'
  )}
>
  Get Started
</MagneticButton>
```

## Best Practices

### When to Use

✅ **Use MagneticButton for:**
- Primary call-to-action buttons
- Hero section CTAs
- Important conversion actions
- Feature section buttons

❌ **Don't use MagneticButton for:**
- Form submit buttons (unless primary CTA)
- Navigation buttons
- Every button on the page (creates visual noise)
- Mobile-only interfaces (effect requires mouse)

### Styling Tips

```tsx
// Good: Clear focus state
<MagneticButton className="px-6 py-3 bg-primary text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring">
  Get Started
</MagneticButton>

// Good: Adequate size (meets 44x44px target size)
<MagneticButton className="min-w-[44px] min-h-[44px] px-8 py-4">
  Click Me
</MagneticButton>

// Good: Semantic color tokens
<MagneticButton className="px-6 py-3 bg-success text-success-foreground">
  Submit
</MagneticButton>
```

### Common Pitfalls

1. **Too Many Instances**: Limit to 1-3 per page for maximum impact
2. **Insufficient Contrast**: Always use semantic color tokens
3. **Small Size**: Ensure button meets minimum target size (24x24px)
4. **Missing Focus Styles**: Always include visible focus indicators

---

**Component Version**: 1.0.0
**Last Updated**: 2025-11-13
**Dependencies**: Framer Motion, useReducedMotion hook
