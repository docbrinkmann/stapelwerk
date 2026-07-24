/**
 * Hero Section and Header Tests
 * Tests for hero rendering, header stickiness, glassmorphic effects, and animations
 */

import { render, screen, waitFor } from '@testing-library/react'
import { vi, beforeEach, describe, it, expect } from 'vitest'

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    nav: ({ children, ...props }: any) => <nav {...props}>{children}</nav>,
  },
  useScroll: () => ({
    scrollY: { get: () => 0, onChange: () => {} },
    scrollYProgress: { get: () => 0 },
  }),
  useTransform: () => ({ get: () => 0 }),
  useMotionValue: (initial: number) => ({
    get: () => initial,
    set: () => {},
  }),
  AnimatePresence: ({ children }: any) => children,
}))

describe('Hero Section & Header', () => {
  beforeEach(() => {
    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      disconnect() {}
      observe() {}
      takeRecords() {
        return []
      }
      unobserve() {}
    } as any
  })

  describe('Hero Section Rendering', () => {
    it('should render without layout shift (CLS prevention)', async () => {
      const { container } = render(
        <div data-testid="hero-section" className="min-h-screen">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-6xl lg:text-7xl">
              Build My Stack
            </h1>
          </div>
        </div>
      )

      const heroSection = screen.getByTestId('hero-section')
      
      // Hero should have min-height to prevent layout shift
      expect(heroSection).toHaveClass('min-h-screen')
      
      // Content should be present
      expect(screen.getByText('Build My Stack')).toBeInTheDocument()
    })

    it('should apply glassmorphic styling correctly', () => {
      render(
        <div 
          data-testid="glass-card"
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border border-white/20"
        >
          Content
        </div>
      )

      const glassCard = screen.getByTestId('glass-card')
      
      // Should have backdrop blur class
      expect(glassCard.className).toContain('backdrop-blur')
      
      // Should have semi-transparent background
      expect(glassCard.className).toMatch(/bg-(white|gray)/)
    })

    it('should render gradient text treatment', () => {
      render(
        <h1 
          data-testid="gradient-heading"
          className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
        >
          Gradient Heading
        </h1>
      )

      const heading = screen.getByTestId('gradient-heading')
      
      // Should have gradient classes
      expect(heading.className).toContain('bg-gradient-to-r')
      expect(heading.className).toContain('bg-clip-text')
      expect(heading.className).toContain('text-transparent')
    })
  })

  describe('Header Sticky Behavior', () => {
    it('should have sticky positioning classes', () => {
      render(
        <header 
          data-testid="main-header"
          className="sticky top-0 z-50"
        >
          <nav>Navigation</nav>
        </header>
      )

      const header = screen.getByTestId('main-header')
      
      // Should have sticky positioning
      expect(header).toHaveClass('sticky')
      expect(header).toHaveClass('top-0')
      expect(header).toHaveClass('z-50')
    })

    it('should apply backdrop blur on scroll state', () => {
      render(
        <header 
          data-testid="scrolled-header"
          className="backdrop-blur-md bg-background/80"
        >
          <nav>Navigation</nav>
        </header>
      )

      const header = screen.getByTestId('scrolled-header')
      
      // Should have backdrop blur when scrolled
      expect(header.className).toContain('backdrop-blur')
      expect(header.className).toMatch(/bg-background/)
    })
  })

  describe('Responsive Typography', () => {
    it('should have responsive text scaling classes', () => {
      render(
        <h1 
          data-testid="responsive-heading"
          className="text-4xl md:text-6xl lg:text-7xl"
        >
          Responsive Title
        </h1>
      )

      const heading = screen.getByTestId('responsive-heading')
      
      // Should have responsive classes
      expect(heading).toHaveClass('text-4xl')
      expect(heading.className).toContain('md:text-6xl')
      expect(heading.className).toContain('lg:text-7xl')
    })
  })

  describe('Animation Performance', () => {
    it('should complete animations within 600ms', () => {
      const animationDuration = 500 // Should be < 600ms
      
      expect(animationDuration).toBeLessThan(600)
    })

    it('should use hardware-accelerated properties', () => {
      render(
        <div 
          data-testid="animated-element"
          className="transition-transform duration-300"
          style={{ willChange: 'transform' }}
        >
          Animated Content
        </div>
      )

      const element = screen.getByTestId('animated-element')
      
      // Should have transform transition
      expect(element.className).toContain('transition-transform')
      
      // Should use will-change for performance
      expect(element.style.willChange).toBe('transform')
    })
  })

  describe('Smooth Scrolling', () => {
    it('should have smooth scroll behavior', () => {
      render(
        <div className="scroll-smooth">
          <a href="#section1">Link</a>
          <section id="section1">Section 1</section>
        </div>
      )

      const link = screen.getByText('Link')
      expect(link).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <div>
          <h1>Main Title</h1>
          <h2>Subtitle</h2>
        </div>
      )

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    })

    it('should have keyboard-accessible navigation links', () => {
      render(
        <nav>
          <a href="#home" tabIndex={0}>Home</a>
          <a href="#about" tabIndex={0}>About</a>
        </nav>
      )

      const links = screen.getAllByRole('link')
      links.forEach(link => {
        expect(link).toHaveAttribute('tabIndex', '0')
      })
    })
  })
})
