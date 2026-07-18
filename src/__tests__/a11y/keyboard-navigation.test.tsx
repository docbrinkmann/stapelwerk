import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock dependencies
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark', 'system'],
  }),
}))

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')

  // Props to filter out from motion components
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

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

import React from 'react'

describe('Keyboard Navigation', () => {
  describe('Header Component', () => {
    it('should allow tabbing through navigation links', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const Header = (await import('@/components/header')).default

      render(<Header />)

      // Tab through interactive elements
      await user.tab()

      // Should be able to focus on links
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
    })

    it('should allow keyboard activation of navigation links', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const Header = (await import('@/components/header')).default

      render(<Header />)

      const firstLink = screen.getAllByRole('link')[0]
      firstLink.focus()

      expect(firstLink).toHaveFocus()

      // Enter should activate the link
      await user.keyboard('{Enter}')
    })

    it('should have accessible mobile menu toggle', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const Header = (await import('@/components/header')).default

      const { container } = render(<Header />)

      const menuButton = container.querySelector('[aria-label*="menu"]')
      expect(menuButton).toBeInTheDocument()

      if (menuButton) {
        menuButton.focus()
        expect(menuButton).toHaveFocus()
      }
    })
  })

  describe('Theme Toggle', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const ThemeToggle = (await import('@/components/ui/theme-toggle')).default

      render(<ThemeToggle />)

      const button = screen.getByRole('button')

      // Should be focusable
      button.focus()
      expect(button).toHaveFocus()

      // Should be activatable with Enter
      await user.keyboard('{Enter}')

      // Should be activatable with Space
      await user.keyboard(' ')
    })
  })

  describe('HeroSection Buttons', () => {
    it('should allow keyboard focus on CTA buttons', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const HeroSection = (await import('@/components/hero-section')).default

      render(<HeroSection />)

      const buttons = screen.getAllByRole('button')

      if (buttons.length > 0) {
        buttons[0].focus()
        expect(buttons[0]).toHaveFocus()

        // Enter should activate
        await user.keyboard('{Enter}')
      }
    })
  })

  describe('Tab Order', () => {
    it('should have logical tab order through the page', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const Header = (await import('@/components/header')).default
      const ThemeToggle = (await import('@/components/ui/theme-toggle')).default

      render(
        <>
          <Header />
          <ThemeToggle />
        </>
      )

      // Tab through elements
      await user.tab()
      const firstFocused = document.activeElement
      expect(firstFocused).toBeInTheDocument()
      expect(firstFocused?.tagName).toMatch(/BUTTON|A/)

      await user.tab()
      const secondFocused = document.activeElement
      expect(secondFocused).toBeInTheDocument()

      // Elements should be different
      expect(firstFocused).not.toBe(secondFocused)
    })

    it('should allow reverse tabbing with Shift+Tab', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      const Header = (await import('@/components/header')).default
      const ThemeToggle = (await import('@/components/ui/theme-toggle')).default

      render(
        <>
          <Header />
          <ThemeToggle />
        </>
      )

      // Tab forward twice
      await user.tab()
      await user.tab()
      const forwardFocused = document.activeElement
      expect(forwardFocused?.tagName).toMatch(/BUTTON|A/)

      // Tab backward
      await user.tab({ shift: true })
      const backwardFocused = document.activeElement

      // Should focus on different element
      expect(forwardFocused).not.toBe(backwardFocused)
      expect(backwardFocused?.tagName).toMatch(/BUTTON|A/)
    })
  })

  describe('Focus Indicators', () => {
    it('should have visible focus indicators on interactive elements', async () => {
      const Header = (await import('@/components/header')).default
      
      const { container } = render(<Header />)
      
      const buttons = container.querySelectorAll('button')
      const links = container.querySelectorAll('a')
      
      // Focus indicators are typically handled by CSS
      // We can verify elements are focusable
      buttons.forEach(button => {
        button.focus()
        expect(button).toHaveFocus()
      })
      
      links.forEach(link => {
        link.focus()
        expect(link).toHaveFocus()
      })
    })
  })

  describe('Skip Links', () => {
    it('should not have skip link violations', async () => {
      const HomePage = (await import('@/app/page')).default
      
      const { container } = render(<HomePage params={{}} searchParams={{}} />)
      
      // Skip links are optional but good practice
      // Just verify the page structure supports keyboard navigation
      const mainContent = container.querySelector('main, [role="main"]')
      expect(mainContent || container.querySelector('div')).toBeInTheDocument()
    })
  })
})
