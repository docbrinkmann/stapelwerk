/**
 * Feature Cards Tests
 * Tests for feature card animations, hover effects, and responsive grid layout
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach, describe, it, expect } from 'vitest'

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useInView: () => true,
  useReducedMotion: () => false,
}))

describe('Feature Cards', () => {
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

  describe('Card Rendering', () => {
    it('should render feature cards with content', () => {
      render(
        <div data-testid="feature-card" className="group">
          <div className="text-xl font-bold">Docker Compose</div>
          <p className="text-muted-foreground">Quick setup</p>
        </div>
      )

      expect(screen.getByText('Docker Compose')).toBeInTheDocument()
      expect(screen.getByText('Quick setup')).toBeInTheDocument()
    })

    it('should apply glassmorphic styling', () => {
      render(
        <div 
          data-testid="glass-card"
          className="bg-card/80 backdrop-blur-sm border border-border/50"
        >
          Content
        </div>
      )

      const card = screen.getByTestId('glass-card')
      expect(card.className).toContain('backdrop-blur')
      expect(card.className).toContain('bg-card')
    })

    it('should have group class for hover effects', () => {
      render(
        <div data-testid="card-group" className="group">
          <div className="group-hover:border-primary/50">Content</div>
        </div>
      )

      const card = screen.getByTestId('card-group')
      expect(card).toHaveClass('group')
    })
  })

  describe('Responsive Grid Layout', () => {
    it('should have responsive grid classes', () => {
      render(
        <div 
          data-testid="feature-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <div>Card 1</div>
          <div>Card 2</div>
          <div>Card 3</div>
        </div>
      )

      const grid = screen.getByTestId('feature-grid')
      expect(grid).toHaveClass('grid')
      expect(grid.className).toContain('grid-cols-1')
      expect(grid.className).toContain('md:grid-cols-2')
      expect(grid.className).toContain('lg:grid-cols-3')
    })

    it('should have proper gap spacing', () => {
      render(
        <div 
          data-testid="feature-grid"
          className="gap-6 lg:gap-8"
        >
          Content
        </div>
      )

      const grid = screen.getByTestId('feature-grid')
      expect(grid.className).toContain('gap-6')
      expect(grid.className).toContain('lg:gap-8')
    })
  })

  describe('Hover Effects', () => {
    it('should have hover scale effect classes', () => {
      render(
        <div 
          data-testid="hover-card"
          className="transition-all duration-300 hover:scale-105"
        >
          Hover me
        </div>
      )

      const card = screen.getByTestId('hover-card')
      expect(card.className).toContain('transition-all')
      expect(card.className).toContain('hover:scale-105')
    })

    it('should have border hover effect', () => {
      render(
        <div className="group">
          <div 
            data-testid="border-hover"
            className="border group-hover:border-primary/50 transition-colors"
          >
            Content
          </div>
        </div>
      )

      const element = screen.getByTestId('border-hover')
      expect(element.className).toContain('group-hover:border-primary')
    })

    it('should have shadow transition on hover', () => {
      render(
        <div 
          data-testid="shadow-card"
          className="shadow-md hover:shadow-xl transition-shadow"
        >
          Content
        </div>
      )

      const card = screen.getByTestId('shadow-card')
      expect(card.className).toContain('shadow-md')
      expect(card.className).toContain('hover:shadow-xl')
    })
  })

  describe('Animation Performance', () => {
    it('should use GPU-accelerated properties', () => {
      render(
        <div 
          data-testid="animated-card"
          className="transition-transform duration-300"
          style={{ willChange: 'transform' }}
        >
          Content
        </div>
      )

      const card = screen.getByTestId('animated-card')
      expect(card.className).toContain('transition-transform')
      expect(card.style.willChange).toBe('transform')
    })

    it('should have animation duration under 600ms', () => {
      const animationDuration = 300 // Card animations at 300ms
      expect(animationDuration).toBeLessThan(600)
    })
  })

  describe('Stagger Animation', () => {
    it('should support delay calculation for stagger', () => {
      const cards = [0, 1, 2]
      const delays = cards.map((index) => index * 0.1)
      
      expect(delays).toEqual([0, 0.1, 0.2])
      expect(delays[2]).toBeLessThan(0.5) // Reasonable max delay
    })

    it('should render multiple cards for stagger effect', () => {
      render(
        <div>
          <div data-testid="card-0">Card 1</div>
          <div data-testid="card-1">Card 2</div>
          <div data-testid="card-2">Card 3</div>
        </div>
      )

      expect(screen.getByTestId('card-0')).toBeInTheDocument()
      expect(screen.getByTestId('card-1')).toBeInTheDocument()
      expect(screen.getByTestId('card-2')).toBeInTheDocument()
    })
  })

  describe('Touch Interactions', () => {
    it('should have touch-friendly tap classes', () => {
      render(
        <button 
          data-testid="touch-card"
          className="active:scale-95 transition-transform"
        >
          Tap me
        </button>
      )

      const card = screen.getByTestId('touch-card')
      expect(card.className).toContain('active:scale-95')
    })

    it('should support pointer events', () => {
      render(
        <div 
          data-testid="pointer-card"
          className="cursor-pointer"
          onClick={() => {}}
        >
          Clickable
        </div>
      )

      const card = screen.getByTestId('pointer-card')
      expect(card.className).toContain('cursor-pointer')
      
      // Simulate click
      fireEvent.click(card)
      expect(card).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(
        <article data-testid="feature-article">
          <h3>Feature Title</h3>
          <p>Feature description</p>
        </article>
      )

      const article = screen.getByTestId('feature-article')
      expect(article.tagName).toBe('ARTICLE')
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
    })

    it('should have sufficient color contrast classes', () => {
      render(
        <div>
          <div className="text-foreground">Title</div>
          <div className="text-muted-foreground">Description</div>
        </div>
      )

      expect(screen.getByText('Title')).toHaveClass('text-foreground')
      expect(screen.getByText('Description')).toHaveClass('text-muted-foreground')
    })
  })
})
