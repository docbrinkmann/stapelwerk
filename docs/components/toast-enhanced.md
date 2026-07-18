# Toast (Enhanced)

## Overview

The `Toast` component provides an enhanced notification system with multiple semantic variants (success, warning, info, default, destructive), progress indicators showing time remaining, hover-to-pause functionality, action buttons, and automatic stacking. Built on Radix UI primitives for accessibility and respects reduced motion preferences.

## Import

```typescript
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
```

## Basic Usage

```tsx
import { useToast } from '@/components/ui/use-toast'

export function Example() {
  const { toast } = useToast()

  return (
    <button onClick={() => {
      toast({
        title: 'Success!',
        description: 'Your changes have been saved.',
        variant: 'success'
      })
    }}>
      Show Toast
    </button>
  )
}
```

## Setup

Add the Toaster component to your app layout:

```tsx
// app/layout.tsx
import { Toaster } from '@/components/ui/toaster'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

## Props API

### toast() Function Options

| Option | Type | Default | Required | Description |
|--------|------|---------|----------|-------------|
| `title` | `string \| ReactNode` | - | No | Toast title/heading |
| `description` | `string \| ReactNode` | - | No | Toast body content |
| `variant` | `'default' \| 'success' \| 'warning' \| 'info' \| 'destructive'` | `'default'` | No | Visual variant/semantic meaning |
| `duration` | `number` | `5000` | No | Auto-dismiss duration in ms (0 = no auto-dismiss) |
| `showProgress` | `boolean` | `false` | No | Show progress bar indicating time remaining |
| `action` | `ToastActionElement` | - | No | Action button element |

### Toast Component Props

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `variant` | `'default' \| 'success' \| 'warning' \| 'info' \| 'destructive'` | `'default'` | No | Visual variant |
| `showProgress` | `boolean` | `false` | No | Show progress indicator |
| `duration` | `number` | - | No | Duration for progress calculation |
| ...rest | `ToastPrimitives.RootProps` | - | No | Radix UI Toast props |

## Variants/Examples

### Success Toast

For successful operations:

```tsx
import { useToast } from '@/components/ui/use-toast'
import { CheckCircle } from 'lucide-react'

toast({
  title: 'Success!',
  description: 'Your stack has been created successfully.',
  variant: 'success',
  duration: 5000,
  showProgress: true
})
```

### Warning Toast

For cautionary messages:

```tsx
toast({
  title: 'Warning',
  description: 'This action cannot be undone.',
  variant: 'warning',
  duration: 7000,
  showProgress: true
})
```

### Info Toast

For informational messages:

```tsx
toast({
  title: 'New feature available',
  description: 'Check out our new Docker Compose generator!',
  variant: 'info',
  duration: 5000
})
```

### Destructive Toast

For errors and critical messages:

```tsx
toast({
  title: 'Error',
  description: 'Failed to save your changes. Please try again.',
  variant: 'destructive',
  duration: 0, // Don't auto-dismiss errors
})
```

### Default Toast

General notifications:

```tsx
toast({
  title: 'Notification',
  description: 'You have 3 new messages.',
  variant: 'default'
})
```

### With Action Button

Include actionable buttons:

```tsx
import { ToastAction } from '@/components/ui/toast'

toast({
  title: 'Stack deleted',
  description: 'Your Docker Compose stack has been deleted.',
  variant: 'destructive',
  action: (
    <ToastAction
      altText="Undo deletion"
      onClick={() => {
        // Restore stack
        restoreStack()
      }}
    >
      Undo
    </ToastAction>
  )
})
```

### With Progress Indicator

Show time remaining with progress bar:

```tsx
toast({
  title: 'Processing...',
  description: 'Your build will complete shortly.',
  variant: 'info',
  duration: 10000,
  showProgress: true // Shows animated progress bar
})
```

### Long-lived Toast

Persistent toast (no auto-dismiss):

```tsx
toast({
  title: 'Important',
  description: 'Please read this carefully.',
  variant: 'warning',
  duration: 0 // Must be manually closed
})
```

### With Custom Content

Use React components for rich content:

```tsx
toast({
  title: <div className="flex items-center gap-2">
    <Upload className="w-4 h-4" />
    <span>Upload Complete</span>
  </div>,
  description: (
    <div className="mt-2 space-y-1">
      <p>3 files uploaded successfully</p>
      <ul className="list-disc list-inside text-sm">
        <li>docker-compose.yml</li>
        <li>.env.example</li>
        <li>README.md</li>
      </ul>
    </div>
  ),
  variant: 'success'
})
```

### Multiple Toasts (Stacking)

Toasts automatically stack with proper spacing:

```tsx
// Show multiple toasts in sequence
toast({ title: 'First', variant: 'info' })
toast({ title: 'Second', variant: 'success' })
toast({ title: 'Third', variant: 'warning' })
```

### Hover to Pause

Toasts automatically pause auto-dismiss on hover:

```tsx
// Auto-dismiss pauses when user hovers
// Progress bar also pauses
// Resumes when mouse leaves
toast({
  title: 'Hover me to pause',
  description: 'Auto-dismiss will pause while you hover.',
  duration: 5000,
  showProgress: true
})
```

## Accessibility

### ARIA Attributes

All toasts include proper accessibility attributes:

```tsx
// Toast viewport
<ToastViewport
  className="fixed top-0 z-[100]..."
  aria-label="Notifications"
/>

// Individual toast
<Toast
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  <ToastTitle>Success</ToastTitle>
  <ToastDescription>Operation completed</ToastDescription>
</Toast>

// Progress bar
<div
  role="progressbar"
  aria-label="Time remaining"
  aria-valuenow={75}
  aria-valuemin={0}
  aria-valuemax={100}
/>
```

### Keyboard Interactions

| Key | Action |
|-----|--------|
| `Tab` | Focus close button or action button |
| `Enter/Space` | Activate focused button |
| `Escape` | Close toast (when focused) |

### Screen Reader Behavior

- **Success/Warning/Info**: Announced with `aria-live="polite"` (non-disruptive)
- **Destructive**: Announced with `aria-live="assertive"` (immediate)
- **Title**: Announced first
- **Description**: Announced second
- **Actions**: Action button labels announced
- **Dismissal**: "Toast dismissed" announced on close

### WCAG 2.2 Compliance

- ✅ **Focus Appearance**: Close button has visible 2px outline
- ✅ **Target Size**: Close and action buttons meet 24x24px minimum
- ✅ **Color Contrast**: All variants meet WCAG AA contrast (4.5:1)
- ✅ **Timing**: Can be paused on hover
- ✅ **Keyboard Access**: Fully keyboard accessible
- ✅ **Screen Reader**: Comprehensive ARIA support

### Reduced Motion Support

```tsx
// With reduced motion:
// - No slide-in animation
// - No progress bar animation
// - Instant appearance/dismissal
// - Fade transitions only

// Automatic detection via useReducedMotion() hook
```

## Performance

### Bundle Impact

- **Toast System**: ~3KB gzipped
- **Radix UI Toast**: ~8KB gzipped
- **Icons**: ~1KB gzipped (lucide-react)
- **Total**: ~12KB gzipped

### Rendering Performance

- **Portal Rendering**: Toasts render in separate portal (no re-render parent)
- **Stacking**: Optimized CSS transforms for smooth positioning
- **Progress Animation**: `requestAnimationFrame` for 60fps progress bar
- **Cleanup**: Automatic unmount after dismiss animation

### Animation Performance

```css
/* GPU-accelerated animations */
.toast {
  transform: translateX(var(--radix-toast-swipe-move-x));
  /* Uses translate3d internally for GPU acceleration */
}

/* Progress bar */
.progress-bar {
  transition: width 100ms linear;
  /* Minimal repaints */
}
```

### Best Practices

```tsx
// ✅ Good: Use semantic variants
toast({ title: 'Saved', variant: 'success' })

// ✅ Good: Appropriate durations
toast({ title: 'Error', duration: 0, variant: 'destructive' }) // No auto-dismiss for errors
toast({ title: 'Info', duration: 3000, variant: 'info' }) // Quick dismiss for info

// ❌ Avoid: Too many simultaneous toasts
for (let i = 0; i < 10; i++) {
  toast({ title: `Toast ${i}` }) // Creates visual noise
}

// ✅ Good: Batch notifications
toast({
  title: '10 operations completed',
  description: 'All services have been updated.'
})
```

## TypeScript

### Type Definitions

```typescript
import type { ToastActionElement } from '@/components/ui/toast'

type ToastVariant = 'default' | 'success' | 'warning' | 'info' | 'destructive'

interface ToastOptions {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
  duration?: number
  showProgress?: boolean
  action?: ToastActionElement
}

interface Toast extends ToastOptions {
  id: string
  open: boolean
}

// Hook return type
interface UseToastReturn {
  toast: (options: ToastOptions) => void
  toasts: Toast[]
  dismiss: (toastId: string) => void
}
```

### Usage with TypeScript

```tsx
import { useToast } from '@/components/ui/use-toast'
import type { ToastVariant } from '@/components/ui/toast'

export function TypedExample() {
  const { toast } = useToast()

  const showToast = (variant: ToastVariant, message: string) => {
    toast({
      title: variant.charAt(0).toUpperCase() + variant.slice(1),
      description: message,
      variant,
      duration: 5000
    })
  }

  return (
    <button onClick={() => showToast('success', 'Operation completed')}>
      Show Toast
    </button>
  )
}
```

## Related Components

- **[CommandPalette](/docs/components/command-palette.md)** - Can trigger toasts after actions
- **[MagneticButton](/docs/components/magnetic-button.md)** - Can trigger toasts on click

## Migration Guide

### From shadcn/ui Basic Toast

Upgrade to enhanced variants:

```tsx
// Before: Basic toast
toast({
  title: 'Success',
  description: 'Operation completed'
})

// After: With semantic variant + progress
toast({
  title: 'Success',
  description: 'Operation completed',
  variant: 'success',
  showProgress: true
})
```

### Adding New Variants

The new variants (success, warning, info) are additive:

```tsx
// Old code still works
toast({ title: 'Default toast' })
toast({ title: 'Error', variant: 'destructive' })

// New variants available
toast({ title: 'Success', variant: 'success' })
toast({ title: 'Warning', variant: 'warning' })
toast({ title: 'Info', variant: 'info' })
```

## Best Practices

### When to Use Each Variant

| Variant | Use Case | Duration | Auto-Dismiss |
|---------|----------|----------|--------------|
| `success` | Successful operations | 3-5s | Yes |
| `warning` | Cautionary messages | 5-7s | Yes |
| `info` | Informational updates | 3-5s | Yes |
| `default` | General notifications | 3-5s | Yes |
| `destructive` | Errors, failures | 0 (permanent) | No |

### UX Guidelines

1. **Success**: Use for completed actions (saved, created, deleted)
2. **Warning**: Use for non-blocking issues (approaching limits, deprecation)
3. **Info**: Use for helpful tips, feature announcements
4. **Error**: Use for failures that require user action
5. **Default**: Use for neutral notifications

### Duration Guidelines

```tsx
// Quick info (3s)
toast({ title: 'Copied to clipboard', duration: 3000 })

// Standard message (5s)
toast({ title: 'Changes saved', duration: 5000 })

// Important warning (7s)
toast({ title: 'Approaching limit', duration: 7000 })

// Critical error (no auto-dismiss)
toast({ title: 'Failed to save', duration: 0 })
```

### Common Patterns

```tsx
// Pattern 1: Success with action
const handleDelete = async () => {
  const backup = currentData
  await deleteItem()

  toast({
    title: 'Item deleted',
    variant: 'success',
    action: <ToastAction altText="Undo" onClick={() => restore(backup)}>
      Undo
    </ToastAction>
  })
}

// Pattern 2: Progress for long operations
const handleBuild = async () => {
  toast({
    title: 'Building...',
    description: 'This may take a minute',
    variant: 'info',
    duration: 60000,
    showProgress: true
  })

  await build()

  toast({
    title: 'Build complete',
    variant: 'success'
  })
}

// Pattern 3: Error with retry
const handleSave = async () => {
  try {
    await save()
    toast({ title: 'Saved', variant: 'success' })
  } catch (error) {
    toast({
      title: 'Failed to save',
      description: error.message,
      variant: 'destructive',
      action: <ToastAction altText="Retry" onClick={handleSave}>
        Retry
      </ToastAction>
    })
  }
}
```

---

**Component Version**: 2.0.0 (Enhanced)
**Last Updated**: 2025-11-13
**Dependencies**: Radix UI Toast, lucide-react, useReducedMotion
**Browser Support**: All modern browsers
