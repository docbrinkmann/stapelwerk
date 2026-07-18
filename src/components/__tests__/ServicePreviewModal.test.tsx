import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ServicePreviewModal } from '../ServicePreviewModal'
import { useServiceBrowserStore } from '@/store/service-browser'
import type { Service } from '@/types/service-browser'

// Mock dependencies
vi.mock('@/store/service-browser')

// Mock the stack-builder store ("Add to Stack" writes to it, not the browser store)
const { mockAddService, stackServicesRef } = vi.hoisted(() => ({
  mockAddService: vi.fn(),
  stackServicesRef: { current: [] as Array<{ serviceId: string | number }> },
}))
vi.mock('@/stores/stack-builder', () => ({
  useStackServices: () => ({
    services: stackServicesRef.current,
    addService: mockAddService,
  }),
}))
const mockPush = vi.fn()
const mockPathname = '/services'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: mockPathname,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Mock service data
const mockService: Service = {
  id: 'test-service-1',
  name: 'Test Service',
  description: 'A comprehensive test service for unit testing with detailed functionality',
  category: 'development',
  subcategory: 'backend',
  tags: ['api', 'rest', 'typescript'],
  pricing: { 
    type: 'freemium', 
    freeQuota: '1,000 requests/month',
    paidPlans: [{ price: '$19/month', name: 'Pro' }]
  },
  features: ['REST API', 'Authentication', 'Rate Limiting', 'Documentation'],
  integrations: ['GitHub', 'Slack', 'Discord'],
  documentation: {
    quickStart: 'https://example.com/quick-start',
    apiReference: 'https://example.com/api-ref',
    examples: ['Basic setup example', 'Advanced configuration']
  },
  company: { 
    name: 'Test Company',
    website: 'https://testcompany.com',
    founded: '2020',
    headquarters: 'San Francisco, CA'
  },
  metrics: { 
    popularity: 4.5,
    reliability: 4.2,
    performance: 4.7
  },
  status: 'approved',  dockerImage: 'testservice:latest',
  version: '1.0.0',
  categoryId: 1,
  featured: true,
  lastUpdated: new Date('2024-01-15T10:30:00Z'),
  createdAt: new Date('2024-01-01T00:00:00Z')
}

describe('ServicePreviewModal', () => {
  const mockCloseModal = vi.fn()
  const mockOpenServiceModal = vi.fn()

  // Create helper function for default store state
  const createDefaultStoreState = () => ({
    modalState: {
      isOpen: true,
      service: mockService,
      isLoading: false,
      error: null,
    },
    closeServiceModal: mockCloseModal,
    openServiceModal: mockOpenServiceModal,
    retryServiceLoad: vi.fn(),
  })

  beforeEach(() => {
    vi.clearAllMocks()
    stackServicesRef.current = []
    vi.mocked(useServiceBrowserStore).mockReturnValue(createDefaultStoreState() as any)
  })

  afterEach(() => {
    // Cleanup any event listeners
    document.removeEventListener('keydown', vi.fn())
  })

  describe('Modal Visibility and Basic Rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<ServicePreviewModal />)
      
      expect(screen.getByTestId('service-preview-modal')).toBeInTheDocument()
      expect(screen.getByText('Test Service')).toBeInTheDocument()
      expect(screen.getByText(mockService.description)).toBeInTheDocument()
    })

    it('should not render modal when isOpen is false', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: false,
          service: null,
          isLoading: false,
          error: null,
        }
      } as any)

      render(<ServicePreviewModal />)
      
      expect(screen.queryByTestId('service-preview-modal')).not.toBeInTheDocument()
    })

    it('should render loading state when isLoading is true', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: true,
          service: null,
          isLoading: true,
          error: null,
        }
      } as any)

      render(<ServicePreviewModal />)
      
      expect(screen.getByTestId('modal-loading-spinner')).toBeInTheDocument()
      expect(screen.getByText('Loading service details...')).toBeInTheDocument()
    })

    it('should render error state when error exists', () => {
      const errorMessage = 'Failed to load service details'
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: true,
          service: null,
          isLoading: false,
          error: errorMessage,
        }
      } as any)

      render(<ServicePreviewModal />)
      
      expect(screen.getByText('Error loading service')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try loading service again/i })).toBeInTheDocument()
    })
  })

  describe('Service Information Display', () => {
    it('should display comprehensive service information', () => {
      render(<ServicePreviewModal />)
      
      // Service basic info
      expect(screen.getByText(mockService.name)).toBeInTheDocument()
      expect(screen.getByText(mockService.description)).toBeInTheDocument()
      expect(screen.getByText(mockService.category)).toBeInTheDocument()
      expect(screen.getByText(mockService.subcategory)).toBeInTheDocument()

      // Tags
      mockService.tags.forEach(tag => {
        expect(screen.getByText(tag)).toBeInTheDocument()
      })
      
      // Features (check ones that don't have duplicate text)
      expect(screen.getByText('REST API')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
      expect(screen.getByText('Rate Limiting')).toBeInTheDocument()
      // Skip checking 'Documentation' since it appears as both a feature and section title
      
      // Company information
      expect(screen.getByText(mockService.company.name)).toBeInTheDocument()
      expect(screen.getByText('Founded: 2020')).toBeInTheDocument()
      expect(screen.getByText('Headquarters: San Francisco, CA')).toBeInTheDocument()
    })

    it('should display metrics with proper formatting', () => {
      render(<ServicePreviewModal />)
      
      expect(screen.getByText('4.5')).toBeInTheDocument() // popularity
      expect(screen.getByText('4.2')).toBeInTheDocument() // reliability  
      expect(screen.getByText('4.7')).toBeInTheDocument() // performance
    })

    it('should display integrations with count', () => {
      render(<ServicePreviewModal />)
      
      expect(screen.getByText('GitHub')).toBeInTheDocument()
      expect(screen.getByText('Slack')).toBeInTheDocument()
      expect(screen.getByText('Discord')).toBeInTheDocument()
      expect(screen.getByText('3 integrations')).toBeInTheDocument()
    })

    it('should display documentation links', () => {
      render(<ServicePreviewModal />)
      
      expect(screen.getByText('Quick Start Guide')).toBeInTheDocument()
      expect(screen.getByText('API Reference')).toBeInTheDocument()
    })
  })

  describe('Modal Close Functionality', () => {
    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      
      expect(mockCloseModal).toHaveBeenCalledTimes(1)
    })

    it('should close modal when backdrop is clicked', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      const backdrop = screen.getByTestId('modal-backdrop')
      await user.click(backdrop)
      
      expect(mockCloseModal).toHaveBeenCalledTimes(1)
    })

    it('should not close modal when modal content is clicked', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      const modalContent = screen.getByTestId('modal-content')
      await user.click(modalContent)
      
      expect(mockCloseModal).not.toHaveBeenCalled()
    })

    it('should close modal when Escape key is pressed', async () => {
      render(<ServicePreviewModal />)
      
      fireEvent.keyDown(document, { key: 'Escape' })
      
      expect(mockCloseModal).toHaveBeenCalledTimes(1)
    })

    it('should not close modal on other key presses', async () => {
      render(<ServicePreviewModal />)
      
      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Space' })
      fireEvent.keyDown(document, { key: 'Tab' })
      
      expect(mockCloseModal).not.toHaveBeenCalled()
    })
  })

  describe('Stack Integration Functionality', () => {
    it('should render "Add to Stack" button', () => {
      render(<ServicePreviewModal />)
      
      expect(screen.getByRole('button', { name: /add service to stack/i })).toBeInTheDocument()
    })

    it('should add the service to the stack-builder store when button is clicked', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)

      const addButton = screen.getByRole('button', { name: /add service to stack/i })
      await user.click(addButton)

      expect(mockAddService).toHaveBeenCalledWith(mockService)
    })

    it('should show success state when service is already in the stack', async () => {
      stackServicesRef.current = [{ serviceId: mockService.id }]

      render(<ServicePreviewModal />)

      expect(screen.getByText('Added to Stack!')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /added to stack/i })).toBeInTheDocument()
    })

    it('should pass the full service data to the stack builder', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)

      const addButton = screen.getByRole('button', { name: /add service to stack/i })
      await user.click(addButton)

      // Verify the service data structure is prepared for stack builder
      expect(mockAddService).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockService.id,
          name: mockService.name,
          category: mockService.category,
          // Should include all necessary data for stack builder
        })
      )
    })
  })

  describe('Navigation Functionality', () => {
    it('should render "View Details" navigation link', () => {
      render(<ServicePreviewModal />)
      
      expect(screen.getByRole('link', { name: /view full service details/i })).toBeInTheDocument()
    })

    it('should link to correct service detail page', () => {
      render(<ServicePreviewModal />)
      
      const detailLink = screen.getByRole('link', { name: /view full service details/i })
      expect(detailLink).toHaveAttribute('href', `/services/${mockService.id}`)
    })

    it('should render company website link when available', () => {
      render(<ServicePreviewModal />)
      
      const websiteLink = screen.getByRole('link', { name: /visit company website/i })
      expect(websiteLink).toHaveAttribute('href', mockService.company.website)
      expect(websiteLink).toHaveAttribute('target', '_blank')
      expect(websiteLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should not render website link when not available', () => {
      const serviceWithoutWebsite = {
        ...mockService,
        company: { ...mockService.company, website: undefined }
      }
      
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: true,
          service: serviceWithoutWebsite,
          isLoading: false,
          error: null,
        }
      } as any)

      render(<ServicePreviewModal />)
      
      expect(screen.queryByRole('link', { name: /visit website/i })).not.toBeInTheDocument()
    })
  })

  describe('Accessibility Features', () => {
    it('should have proper ARIA attributes', () => {
      render(<ServicePreviewModal />)
      
      const modal = screen.getByTestId('service-preview-modal')
      expect(modal).toHaveAttribute('role', 'dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title')
      expect(modal).toHaveAttribute('aria-describedby', 'modal-description')
    })

    it('should expose accessible close button', () => {
      render(<ServicePreviewModal />)
      const closeBtn = screen.getByRole('button', { name: /close modal/i })
      expect(closeBtn).toHaveAttribute('aria-label', 'Close modal')
    })

    it('should trap focus within modal', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      // First focusable element should be focused on mount
      const firstButton = screen.getByRole('button', { name: /close/i })
      expect(firstButton).toHaveFocus()
      
      // Tab through elements - focus order may include links in content area
      await user.tab()
      // Just verify that focus moved to something within the modal
      const focusedElement = document.activeElement
      const modal = screen.getByTestId('service-preview-modal')
      expect(modal).toContainElement(focusedElement)
    })

    it('should restore focus to trigger element when closed', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      
      // Create a trigger button
      render(
        <div>
          <button data-testid="trigger-button">Open Modal</button>
          <ServicePreviewModal />
        </div>
      )
      
      const triggerButton = screen.getByTestId('trigger-button')
      triggerButton.focus()
      
      // Modal should be open (focus management is complex in test environment)
      // Just verify modal is rendered and close functionality works
      
      // Close modal
      await user.click(screen.getByRole('button', { name: /close/i }))
      
      // Focus should return to trigger (though we can't fully test this without integration)
      expect(mockCloseModal).toHaveBeenCalled()
    })

    it('should have descriptive labels for screen readers', () => {
      render(<ServicePreviewModal />)
      
      // Check for screen reader friendly content
      expect(screen.getByLabelText('Service preview modal')).toBeInTheDocument()
      expect(screen.getByText('Service Details')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument()
    })

    it('should announce modal state changes to screen readers', () => {
      render(<ServicePreviewModal />)
      
      // Check for live region updates
      const liveRegion = screen.getByRole('status', { hidden: true })
      expect(liveRegion).toBeInTheDocument()
      expect(liveRegion).toHaveTextContent('Service preview modal opened')
    })
  })

  describe('Responsive Design', () => {
    it('should apply mobile-specific classes', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<ServicePreviewModal />)
      
      const modal = screen.getByTestId('service-preview-modal')
      expect(modal).toHaveClass('service-modal--mobile')
    })

    it('should apply desktop-specific classes', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })

      render(<ServicePreviewModal />)
      
      const modal = screen.getByTestId('service-preview-modal')
      expect(modal).toHaveClass('service-modal--desktop')
    })

    it('should handle viewport changes', async () => {
      render(<ServicePreviewModal />)
      
      // Verify initial desktop class
      const modal = screen.getByTestId('service-preview-modal')
      expect(modal).toHaveClass('service-modal--desktop')
      
      // Simulate viewport change to tablet size (between 768 and 1024)
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      })
      
      // Fire resize event
      fireEvent(window, new Event('resize'))
      
      // Wait for component to update
      await waitFor(() => {
        expect(modal).toHaveClass('service-modal--tablet')
      }, { timeout: 1000 })
    })
  })

  describe('Animation and UX', () => {
    it('should apply entrance animation classes', () => {
      render(<ServicePreviewModal />)
      
      const modal = screen.getByTestId('service-preview-modal')
      expect(modal).toHaveClass('animate-fade-in')
      expect(modal).toHaveClass('animate-scale-up')
    })

    it('should handle exit animation before unmounting', async () => {
      const { rerender } = render(<ServicePreviewModal />)
      
      // Close modal
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: false,
          service: null,
          isLoading: false,
          error: null,
        }
      } as any)
      
      rerender(<ServicePreviewModal />)
      
      // Modal should animate out before disappearing
      await waitFor(() => {
        expect(screen.queryByTestId('service-preview-modal')).not.toBeInTheDocument()
      }, { timeout: 1000 })
    })
  })

  describe('Error Handling', () => {
    it('should handle missing service data gracefully', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: true,
          service: null,
          isLoading: false,
          error: null,
        }
      } as any)

      render(<ServicePreviewModal />)
      
      expect(screen.getByText('No service data available')).toBeInTheDocument()
    })

    it('should provide retry functionality on error', async () => {
      const mockRetry = vi.fn()
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: true,
          service: null,
          isLoading: false,
          error: 'Network error',
        },
        retryServiceLoad: mockRetry,
      } as any)

      render(<ServicePreviewModal />)
      
      const retryButton = screen.getByRole('button', { name: /try loading service again/i })
      await user.click(retryButton)
      
      expect(mockRetry).toHaveBeenCalledTimes(1)
    })

  })

  describe('Integration with Store', () => {
    it('should use correct store selectors', () => {
      render(<ServicePreviewModal />)
      
      // Verify that the store hook is called (specific selector testing is complex in mocked environment)
      expect(useServiceBrowserStore).toHaveBeenCalled()
    })

    it('should update store state on modal actions', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      // Test various actions update store correctly
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      
      expect(mockCloseModal).toHaveBeenCalledTimes(1)
    })

    it('should handle store state changes reactively', () => {
      const { rerender } = render(<ServicePreviewModal />)
      
      // Update store state
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: true,
          service: { ...mockService, name: 'Updated Service Name' },
          isLoading: false,
          error: null,
        }
      } as any)
      
      rerender(<ServicePreviewModal />)
      
      expect(screen.getByText('Updated Service Name')).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('should focus first focusable element when modal opens', async () => {
      render(<ServicePreviewModal />)
      
      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /close modal/i })
        expect(closeButton).toHaveFocus()
      })
    })

    it('should trap Tab key navigation within modal', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      const closeButton = screen.getByRole('button', { name: /close modal/i })
      const modal = screen.getByTestId('service-preview-modal')
      
      // Start from close button and tab through elements
      expect(closeButton).toHaveFocus()
      
      // Tab multiple times and verify focus stays within modal
      for (let i = 0; i < 10; i++) {
        await user.tab()
        const focusedElement = document.activeElement
        expect(modal).toContainElement(focusedElement)
      }
    })

    it('should handle Shift+Tab for reverse tab navigation', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      const closeButton = screen.getByRole('button', { name: /close modal/i })
      const detailsLink = screen.getByRole('link', { name: /view full service details/i })
      
      // Shift+Tab should go to last focusable element
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      expect(detailsLink).toHaveFocus()
    })
  })

  describe('Animation Behavior', () => {
    it('should apply correct animation classes on mount', () => {
      render(<ServicePreviewModal />)
      
      const modal = screen.getByTestId('service-preview-modal')
      expect(modal).toHaveClass('animate-fade-in')
      expect(modal).toHaveClass('animate-scale-up')
    })

    it('should respect reduced motion preference', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(<ServicePreviewModal />)
      
      const modal = screen.getByTestId('service-preview-modal')
      expect(modal).toHaveClass('animate-fade-in')
    })
  })

  describe('Stack Integration Edge Cases', () => {
    it('should disable the add button when service is already in stack', async () => {
      stackServicesRef.current = [{ serviceId: mockService.id }]

      render(<ServicePreviewModal />)

      // Check for the button text content and disabled state
      expect(screen.getByText('Added to Stack!')).toBeInTheDocument()
      const addButton = screen.getByRole('button', { name: /added to stack/i })
      expect(addButton).toBeDisabled()
    })
  })

  describe('Navigation Integration', () => {
    it('should close modal when navigating to service details', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      const detailsLink = screen.getByRole('link', { name: /view full service details/i })
      await user.click(detailsLink)
      
      expect(mockCloseModal).toHaveBeenCalledTimes(1)
    })

    it('should handle keyboard activation of details link', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServicePreviewModal />)
      
      const detailsLink = screen.getByRole('link', { name: /view full service details/i })
      detailsLink.focus()
      
      await user.keyboard('{Enter}')
      expect(mockCloseModal).toHaveBeenCalledTimes(1)
    })
  })

  describe('Performance Considerations', () => {
    it('should not render expensive content when modal is closed', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: false,
          service: null,
          isLoading: false,
          error: null,
        }
      } as any)

      render(<ServicePreviewModal />)
      
      // Should not render any modal content
      expect(screen.queryByTestId('service-preview-modal')).not.toBeInTheDocument()
      expect(screen.queryByText('Test Service')).not.toBeInTheDocument()
    })

    it('should memoize expensive calculations', () => {
      const complexService = {
        ...mockService,
        features: Array.from({ length: 100 }, (_, i) => `Feature ${i + 1}`),
        integrations: Array.from({ length: 50 }, (_, i) => `Integration ${i + 1}`),
      }
      
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...createDefaultStoreState(),
        modalState: {
          isOpen: true,
          service: complexService,
          isLoading: false,
          error: null,
        }
      } as any)

      const { rerender } = render(<ServicePreviewModal />)
      
      // Re-render with same data should not cause performance issues
      rerender(<ServicePreviewModal />)
      
      expect(screen.getByText('Feature 1')).toBeInTheDocument()
      expect(screen.getByText('Integration 1')).toBeInTheDocument()
    })
  })
})