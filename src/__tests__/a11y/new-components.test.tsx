import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { axe as configuredAxe } from '../setup-a11y'

expect.extend(toHaveNoViolations)

// Mock next-themes for theme toggle
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark', 'system'],
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock framer-motion for components using animations
// Using best practices from research: filter out motion-specific props
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')

  // Props to filter out from motion components (props that aren't valid HTML attributes)
  const motionProps = [
    'initial', 'animate', 'exit', 'transition',
    'whileHover', 'whileTap', 'whileFocus', 'whileInView',
    'variants', 'drag', 'dragConstraints', 'dragElastic',
    'layout', 'layoutId', 'onAnimationStart', 'onAnimationComplete',
    'viewport'
  ]
  
  const createMockMotionComponent = (tag: string) => {
    const Component = ({ children, ...props }: any) => {
      // Filter out motion-specific props to prevent React warnings
      const filteredProps = Object.keys(props).reduce((acc, key) => {
        if (!motionProps.includes(key)) {
          acc[key] = props[key]
        }
        return acc
      }, {} as any)
      
      return React.createElement(tag, filteredProps, children)
    }
    Component.displayName = `motion.${tag}`
    return Component
  }
  
  return {
    ...actual,
    motion: {
      div: createMockMotionComponent('div'),
      header: createMockMotionComponent('header'),
      button: createMockMotionComponent('button'),
      a: createMockMotionComponent('a'),
      li: createMockMotionComponent('li'),
      section: createMockMotionComponent('section'),
      span: createMockMotionComponent('span'),
      h1: createMockMotionComponent('h1'),
      h2: createMockMotionComponent('h2'),
      h3: createMockMotionComponent('h3'),
      p: createMockMotionComponent('p'),
      article: createMockMotionComponent('article'),
    },
    // Use REAL motion values so the actual useTransform/useSpring cleanup
    // (which expects `on()` to return an unsubscribe fn) doesn't throw on unmount.
    useScroll: () => ({
      scrollY: actual.motionValue(0),
      scrollX: actual.motionValue(0),
      scrollYProgress: actual.motionValue(0),
      scrollXProgress: actual.motionValue(0),
    }),
    useMotionValueEvent: vi.fn(),
    useInView: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

// Mock hooks
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

import React from 'react'

describe('New Components Accessibility', () => {
  describe('HomePage', () => {
    it('should have no accessibility violations', async () => {
      const HomePage = (await import('@/app/page')).default
      
      const { container } = render(
        <HomePage params={{}} searchParams={{}} />
      )
      
      const results = await configuredAxe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Header', () => {
    it('should have no accessibility violations', async () => {
      const Header = (await import('@/components/header')).default
      
      const { container } = render(<Header />)
      
      const results = await configuredAxe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper navigation landmarks', async () => {
      const Header = (await import('@/components/header')).default
      
      const { container } = render(<Header />)
      
      const nav = container.querySelector('nav')
      expect(nav).toHaveAttribute('aria-label')
    })

    it('should have accessible logo link', async () => {
      const Header = (await import('@/components/header')).default
      
      const { container } = render(<Header />)
      
      const logo = container.querySelector('a[href="/"]')
      expect(logo).toBeInTheDocument()
    })
  })

  describe('HeroSection', () => {
    it('should have no accessibility violations', async () => {
      const HeroSection = (await import('@/components/hero-section')).default
      
      const { container } = render(<HeroSection />)
      
      const results = await configuredAxe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper heading hierarchy', async () => {
      const HeroSection = (await import('@/components/hero-section')).default
      
      const { container } = render(<HeroSection />)
      
      const h1 = container.querySelector('h1')
      expect(h1).toBeInTheDocument()
    })
  })

  describe('ThemeToggle', () => {
    it('should have no accessibility violations', async () => {
      const ThemeToggle = (await import('@/components/ui/theme-toggle')).default
      
      const { container } = render(<ThemeToggle />)
      
      const results = await configuredAxe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have accessible button with aria-label', async () => {
      const ThemeToggle = (await import('@/components/ui/theme-toggle')).default
      
      const { container } = render(<ThemeToggle />)
      
      const button = container.querySelector('button')
      expect(button).toBeInTheDocument()
      // Theme toggle should have aria-label or accessible text
      const hasAccessibleName = 
        button?.getAttribute('aria-label') || 
        button?.textContent ||
        button?.querySelector('[aria-label]')
      expect(hasAccessibleName).toBeTruthy()
    })
  })

})
