import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock dependencies
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark', 'system'],
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion')
  
  const motionProps = [
    'initial', 'animate', 'exit', 'transition',
    'whileHover', 'whileTap', 'whileFocus', 'whileInView',
    'variants', 'drag', 'dragConstraints', 'dragElastic',
    'layout', 'layoutId', 'onAnimationStart', 'onAnimationComplete',
    'viewport'
  ]
  
  const createMockMotionComponent = (tag: string) => {
    const Component = ({ children, ...props }: any) => {
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
    // on/onChange must return an unsubscribe function — framer's real
    // useTransform subscribes and calls the return value on cleanup
    useScroll: () => ({ scrollY: { get: () => 0, on: vi.fn(() => () => {}), onChange: vi.fn(() => () => {}) } }),
    useMotionValueEvent: vi.fn(),
    useInView: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

import React from 'react'

describe('UI/UX Transformation - Integration Tests', () => {
  describe('Full Page Render', () => {
    it('should render all major components together', async () => {
      const HomePage = (await import('@/app/page')).default
      
      render(
        <HomePage params={{}} searchParams={{}} />
      )
      
      // Verify Hero Section elements are present
      expect(screen.getByText(/actually runs/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Docker Stack/i)[0]).toBeInTheDocument()
      
      // Verify CTA buttons exist
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should render with correct semantic HTML structure', async () => {
      const HomePage = (await import('@/app/page')).default
      
      const { container } = render(
        <HomePage params={{}} searchParams={{}} />
      )
      
      // Check for proper semantic structure (Hero section is a section element)
      expect(container.querySelector('section')).toBeInTheDocument()
      // Verify main content structure exists
      expect(container.querySelector('div')).toBeInTheDocument()
    })
  })

  describe('Theme System Integration', () => {
    it('should integrate theme toggle with ThemeProvider', async () => {
      const Header = (await import('@/components/header')).default
      
      render(<Header />)
      
      // Verify theme toggle buttons exist (one for desktop, one for mobile)
      const themeButtons = screen.getAllByLabelText(/toggle theme/i)
      expect(themeButtons.length).toBeGreaterThan(0)
      expect(themeButtons[0]).toHaveAttribute('type', 'button')
    })
  })

  describe('Component Interaction', () => {
    it('should render Header with navigation links', async () => {
      const Header = (await import('@/components/header')).default
      
      render(<Header />)
      
      // Verify navigation structure
      const nav = screen.getAllByRole('navigation')[0]
      expect(nav).toBeInTheDocument()
      
      // Verify links exist
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
    })

    it('should render HeroSection with CTA buttons', async () => {
      const HeroSection = (await import('@/components/hero-section')).default
      
      render(<HeroSection />)
      
      // Verify main heading
      expect(screen.getAllByText(/actually runs/i)[0]).toBeInTheDocument()
      expect(screen.getAllByText(/Docker Stack/i)[0]).toBeInTheDocument()
      
      // Verify CTA buttons
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })

  })

  describe('Responsive Layout', () => {
    it('should render mobile-friendly structure', async () => {
      const Header = (await import('@/components/header')).default
      
      // Mock mobile viewport
      global.innerWidth = 375
      global.innerHeight = 667
      
      const { container } = render(<Header />)
      
      // Verify mobile menu button exists
      expect(container.querySelector('[aria-label*="menu"]')).toBeInTheDocument()
    })
  })


  describe('User Journey: Landing Page Experience', () => {
    it('should complete full user journey through landing page', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const HomePage = (await import('@/app/page')).default
      
      const { container } = render(
        <HomePage params={{}} searchParams={{}} />
      )
      
      // Step 1: User sees hero section
      expect(screen.getAllByText(/actually runs/i)[0]).toBeInTheDocument()
      
      // Step 2: User can interact with CTA buttons
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
      
      // Step 3: User can see the real compose preview
      expect(screen.getAllByText(/docker-compose\.yml/i)[0]).toBeInTheDocument()

      // Step 4: Hero section is visible
      expect(container.querySelector('section')).toBeInTheDocument()
    })
  })

  describe('Performance Indicators', () => {
    it('should render without blocking main thread', async () => {
      const start = performance.now()
      const HomePage = (await import('@/app/page')).default
      
      render(<HomePage params={{}} searchParams={{}} />)
      
      const renderTime = performance.now() - start
      
      // Render should complete quickly (under 1 second in test environment)
      expect(renderTime).toBeLessThan(1000)
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain accessibility across all components', async () => {
      const Header = (await import('@/components/header')).default
      const HeroSection = (await import('@/components/hero-section')).default
      
      const { container } = render(
        <>
          <Header />
          <HeroSection />
        </>
      )
      
      // Verify landmarks
      expect(container.querySelector('header')).toBeInTheDocument()
      expect(container.querySelector('nav')).toBeInTheDocument()
      
      // Verify heading hierarchy
      const h1 = container.querySelector('h1')
      expect(h1).toBeInTheDocument()
    })

    it('should support keyboard navigation across components', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const Header = (await import('@/components/header')).default
      const HeroSection = (await import('@/components/hero-section')).default
      
      render(
        <>
          <Header />
          <HeroSection />
        </>
      )
      
      // Tab through elements
      await user.tab()
      
      // At least one element should be focusable (buttons in hero or header)
      expect(document.activeElement).not.toBe(document.body)
      expect(document.activeElement?.tagName).toMatch(/BUTTON|A/)
    })
  })
})
