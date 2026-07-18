# CommandPalette

## Overview

The `CommandPalette` component is a global search and navigation interface inspired by modern development tools (VS Code, Linear, Raycast). It provides instant access to services and actions via keyboard shortcut (Cmd/Ctrl+K), fuzzy search with Fuse.js, and recent actions tracking. The component features comprehensive keyboard navigation, glassmorphism design, and full WCAG 2.2 AA compliance.

## Import

```typescript
import { CommandPalette, CommandPaletteTrigger } from '@/components/command-palette'
```

## Basic Usage

```tsx
import { CommandPalette } from '@/components/command-palette'
import { useState } from 'react'

export function App() {
  const [services, setServices] = useState([...])

  const handleServiceSelect = (service, action) => {
    if (action === 'add') {
      // Add service to stack
    } else {
      // Navigate to service detail
    }
  }

  return (
    <CommandPalette
      services={services}
      onServiceSelect={handleServiceSelect}
    />
  )
}
```

## Props API

### CommandPalette

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `services` | `Service[]` | - | Yes | Array of services to search through |
| `onServiceSelect` | `(service: Service, action: 'view' \| 'add') => void` | - | No | Callback when a service is selected |
| `className` | `string` | - | No | Optional custom className for the container |

### CommandPaletteTrigger

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `onClick` | `() => void` | - | Yes | Function to call when trigger is clicked |
| `className` | `string` | - | No | Optional custom className for the button |

## Variants/Examples

### Basic Implementation

Complete implementation with state management:

```tsx
import { CommandPalette, CommandPaletteTrigger } from '@/components/command-palette'
import { useCommandPaletteStore } from '@/stores/command-palette'

export function SearchExample() {
  const { setIsOpen } = useCommandPaletteStore()
  const services = [...] // Your services array

  return (
    <>
      <CommandPaletteTrigger onClick={() => setIsOpen(true)} />
      <CommandPalette
        services={services}
        onServiceSelect={(service, action) => {
          console.log(`${action} service:`, service.name)
        }}
      />
    </>
  )
}
```

### With Custom Trigger

Create your own trigger button:

```tsx
import { Search } from 'lucide-react'
import { useCommandPaletteStore } from '@/stores/command-palette'

export function CustomTrigger() {
  const { setIsOpen } = useCommandPaletteStore()

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent"
    >
      <Search className="w-4 h-4" />
      <span>Search services...</span>
      <kbd className="hidden sm:inline-flex h-5 px-1.5 border rounded font-mono text-xs">
        ⌘K
      </kbd>
    </button>
  )
}
```

### Service Selection Handling

Handle different action types:

```tsx
import { CommandPalette } from '@/components/command-palette'
import { useRouter } from 'next/navigation'
import { useStackStore } from '@/stores/stack'

export function WithActions() {
  const router = useRouter()
  const { addService } = useStackStore()

  const handleServiceSelect = (service, action) => {
    if (action === 'add') {
      // Add to stack
      addService(service)
      toast({
        title: 'Service added',
        description: `${service.name} was added to your stack`,
        variant: 'success'
      })
    } else {
      // Navigate to detail page
      router.push(`/services/${service.slug}`)
    }
  }

  return (
    <CommandPalette
      services={services}
      onServiceSelect={handleServiceSelect}
    />
  )
}
```

### Integration with Header

Common usage pattern in app header:

```tsx
import { CommandPaletteTrigger } from '@/components/command-palette'
import { useCommandPaletteStore } from '@/stores/command-palette'

export function Header() {
  const { setIsOpen } = useCommandPaletteStore()

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Logo />

          <div className="flex-1 max-w-md mx-4">
            <CommandPaletteTrigger onClick={() => setIsOpen(true)} />
          </div>

          <Navigation />
        </div>
      </div>
    </header>
  )
}
```

### Custom Fuzzy Search Configuration

Advanced Fuse.js configuration:

```tsx
// The component uses these defaults:
const fuse = new Fuse(services, {
  keys: [
    { name: 'name', weight: 0.4 },           // Primary match
    { name: 'description', weight: 0.3 },    // Secondary match
    { name: 'category.name', weight: 0.2 },  // Category match
    { name: 'tags', weight: 0.1 }            // Tag match
  ],
  threshold: 0.3,           // Stricter matching (0.0 = exact, 1.0 = anything)
  includeScore: true,       // Include match quality score
  minMatchCharLength: 2,    // Minimum 2 characters to search
  ignoreLocation: true      // Search anywhere in string
})
```

## Accessibility

### Keyboard Interactions

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + K` | Open/close command palette |
| `Escape` | Close command palette |
| `Arrow Up` | Navigate to previous result |
| `Arrow Down` | Navigate to next result |
| `Enter` | Select highlighted result |
| `Tab` | Move focus within palette |
| `Click backdrop` | Close palette |

### ARIA Attributes

The component includes comprehensive ARIA support:

```tsx
// Dialog attributes
role="dialog"
aria-modal="true"
aria-labelledby="command-palette-title"
aria-describedby="command-palette-description"

// Input attributes
aria-label="Search services"

// Result list attributes
role="listbox"
aria-label="Search results"

// Individual results
role="option"
aria-selected={isSelected}
```

### Screen Reader Support

- Hidden titles and descriptions for context
- Status announcements for search results count
- Clear action button labels ("Add to stack", "View details")
- Empty state guidance with suggestions
- Keyboard hint instructions in footer

### Focus Management

- **Auto-focus**: Input automatically receives focus when opened
- **Focus Trap**: Focus stays within palette until closed
- **Restore Focus**: Returns focus to trigger button on close
- **Visible Focus**: All interactive elements have clear focus indicators

### WCAG 2.2 Compliance

- ✅ **Focus Appearance (2.4.13)**: 2px outline with 4.5:1 contrast
- ✅ **Target Size (2.5.8)**: All buttons meet 24x24px minimum
- ✅ **Keyboard Navigation**: Full keyboard support
- ✅ **Color Contrast**: WCAG AA minimum on all text
- ✅ **Reduced Motion**: Respects user preferences

### Reduced Motion Support

```tsx
// Animations disabled when prefers-reduced-motion is enabled:
// - No slide-in animation
// - No backdrop blur transition
// - Instant open/close
// - Focus indicators remain visible
```

## Performance

### Bundle Impact

- **Component Size**: ~5KB gzipped
- **Fuse.js**: ~12KB gzipped (fuzzy search library)
- **Total Impact**: ~17KB gzipped
- **cmdk Library**: ~4KB gzipped (command menu primitives)

### Search Performance

- **Response Time**: < 100ms for searches (optimized with useMemo)
- **Debouncing**: Not required - Fuse.js is fast enough
- **Result Limiting**: Returns max 8 results to prevent UI lag
- **Index Caching**: Service index cached with useMemo

### Optimization

```tsx
// Performance optimizations built-in:
const fuse = useMemo(
  () => new Fuse(services, config),
  [services] // Only recreate when services change
)

const searchResults = useMemo(() => {
  if (!searchQuery || searchQuery.length < 2) {
    return services.slice(0, 8)
  }
  return fuse.search(searchQuery).slice(0, 8).map(r => r.item)
}, [searchQuery, fuse, services])
```

### Rendering Optimization

- **Lazy Rendering**: Only renders when `isOpen === true`
- **Virtual Scrolling**: Not needed (max 8 results shown)
- **Memoized Results**: Search results cached between renders
- **Event Delegation**: Single event listener on list container

### Best Practices

```tsx
// ✅ Good: Memoize services array
const services = useMemo(() => fetchServices(), [dependencies])

// ✅ Good: Limit results displayed
<CommandPalette services={services.slice(0, 100)} />

// ❌ Avoid: Creating new array every render
<CommandPalette services={allServices.filter(s => s.active)} />

// ✅ Good: Stable reference
const handleSelect = useCallback((service, action) => {
  // Handle selection
}, [dependencies])
```

## TypeScript

### Type Definitions

```typescript
import { Service } from '@/types/service'

interface CommandPaletteProps {
  /** Array of services to search through */
  services: Service[]

  /** Callback when a service is selected */
  onServiceSelect?: (service: Service, action: 'view' | 'add') => void

  /** Optional custom className */
  className?: string
}

interface CommandPaletteTriggerProps {
  /** Function to call when trigger is clicked */
  onClick: () => void

  /** Optional custom className */
  className?: string
}

// Service type (simplified)
interface Service {
  id: string
  name: string
  slug: string
  description: string
  category: {
    id: string
    name: string
  }
  tags: string[]
  // ... other fields
}
```

### Store Types

```typescript
// Zustand store types
interface CommandPaletteStore {
  isOpen: boolean
  setIsOpen: (open: boolean) => void

  searchQuery: string
  setSearchQuery: (query: string) => void

  recentActions: RecentAction[]
  addRecentAction: (action: RecentAction) => void
  clearRecentActions: () => void
}

interface RecentAction {
  id: string
  type: 'service-view' | 'service-add'
  label: string
  data: Service
  icon: string
  timestamp: number
}
```

### Usage with TypeScript

```tsx
import { CommandPalette } from '@/components/command-palette'
import type { Service } from '@/types/service'

interface Props {
  services: Service[]
}

export function SearchInterface({ services }: Props) {
  const handleSelect = (service: Service, action: 'view' | 'add') => {
    // Type-safe handling
    if (action === 'add') {
      addToStack(service)
    } else {
      navigateToService(service.slug)
    }
  }

  return <CommandPalette services={services} onServiceSelect={handleSelect} />
}
```

## Related Components

- **[MagneticButton](/docs/components/magnetic-button.md)** - Can be used for trigger button
- **[Toast](/docs/components/toast-enhanced.md)** - Show success messages after adding services

## Migration Guide

### From Basic Search Input

Upgrade from a simple search input to command palette:

```tsx
// Before: Basic search
<input
  type="search"
  placeholder="Search services..."
  onChange={e => setQuery(e.target.value)}
/>

// After: Command palette
<>
  <CommandPaletteTrigger onClick={() => setIsOpen(true)} />
  <CommandPalette services={services} onServiceSelect={handleSelect} />
</>
```

### Store Setup

If you haven't set up the Zustand store yet:

```bash
npm install zustand
```

```tsx
// src/stores/command-palette.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RecentAction {
  id: string
  type: 'service-view' | 'service-add'
  label: string
  data: any
  icon: string
  timestamp: number
}

interface CommandPaletteStore {
  isOpen: boolean
  setIsOpen: (open: boolean) => void

  searchQuery: string
  setSearchQuery: (query: string) => void

  recentActions: RecentAction[]
  addRecentAction: (action: Omit<RecentAction, 'id' | 'timestamp'>) => void
  clearRecentActions: () => void
}

export const useCommandPaletteStore = create<CommandPaletteStore>()(
  persist(
    (set) => ({
      isOpen: false,
      setIsOpen: (open) => set({ isOpen: open }),

      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      recentActions: [],
      addRecentAction: (action) =>
        set((state) => ({
          recentActions: [
            {
              ...action,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
            },
            ...state.recentActions.slice(0, 9), // Keep last 10
          ],
        })),
      clearRecentActions: () => set({ recentActions: [] }),
    }),
    {
      name: 'command-palette',
      partialize: (state) => ({
        recentActions: state.recentActions,
      }),
    }
  )
)
```

## Best Practices

### When to Use

✅ **Use CommandPalette for:**
- Service search and discovery
- Quick navigation shortcuts
- Power user features
- Global search functionality

❌ **Don't use CommandPalette for:**
- Form autocomplete (use Combobox instead)
- Simple filtering (use Filter component)
- Mobile-primary apps (consider bottom sheet)

### UX Tips

1. **Trigger Visibility**: Make trigger button prominent in header
2. **Keyboard Hints**: Show Cmd+K hint on trigger button
3. **Recent Actions**: Help users quickly repeat actions
4. **Empty States**: Provide helpful guidance when no results
5. **Result Limit**: Show top 8 results to avoid overwhelm

### Common Patterns

```tsx
// Pattern 1: Header integration
<Header>
  <Logo />
  <CommandPaletteTrigger onClick={() => setIsOpen(true)} />
  <UserMenu />
</Header>

// Pattern 2: Add to stack workflow
<CommandPalette
  services={services}
  onServiceSelect={(service, action) => {
    if (action === 'add') {
      addToStack(service)
      toast({ title: 'Added to stack', variant: 'success' })
    }
  }}
/>

// Pattern 3: Navigation workflow
<CommandPalette
  services={services}
  onServiceSelect={(service, action) => {
    if (action === 'view') {
      router.push(`/services/${service.slug}`)
    }
  }}
/>
```

---

**Component Version**: 1.0.0
**Last Updated**: 2025-11-13
**Dependencies**: Fuse.js, cmdk, Zustand, Framer Motion, lucide-react
