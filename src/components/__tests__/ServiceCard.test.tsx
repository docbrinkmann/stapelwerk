import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, type MockedFunction } from 'vitest'
import { ServiceCard } from '../ServiceCard'
import { useServiceBrowserStore } from '@/store/service-browser'
import type { Service } from '@/types/service-browser'

// Mock the store
vi.mock('@/store/service-browser')

// Mock service data matching Service interface
const mockService: Service = {
  id: 'service-1',
  name: 'Test Service',
  description: 'A comprehensive test service for developers',
  category: 'development',
  subcategory: 'backend',
  tags: ['api', 'rest', 'testing'],
  pricing: {
    type: 'freemium',
    paidPlans: [
      { name: 'Pro', price: '$29/month', features: ['Feature 1', 'Feature 2'] }
    ],
  },
  features: ['REST API', 'Authentication', 'Rate Limiting'],
  integrations: ['GitHub', 'Slack', 'Discord'],
  documentation: {
    quickStart: 'https://docs.example.com/quickstart',
    apiReference: 'https://docs.example.com/api',
    examples: ['https://github.com/example/samples'],
  },
  company: {
    name: 'Test Company Inc.',
    founded: 2020,
    headquarters: 'San Francisco, CA',
    website: 'https://testcompany.com',
  },
  metrics: {
    popularity: 4.5,
    reliability: 99.9,
    performance: 4.2,
    documentation: 4.0,
    support: 4.3,
  },
  status: 'active',
  lastUpdated: '2024-01-15T10:30:00Z',
  createdAt: '2024-01-01T00:00:00Z',
}

const mockFreeService: Service = {
  ...mockService,
  id: 'service-2',
  name: 'Free Service',
  pricing: {
    type: 'free',
  },
}

const mockEnterpriseService: Service = {
  ...mockService,
  id: 'service-3',
  name: 'Enterprise Service',
  pricing: {
    type: 'enterprise',
  },
}

describe('ServiceCard', () => {
  const mockOpenServiceModal = vi.fn()
  const mockSetSelectedService = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useServiceBrowserStore).mockReturnValue({
      openServiceModal: mockOpenServiceModal,
      setSelectedService: mockSetSelectedService,
      modalState: null,
      viewMode: 'grid',
      uiState: {
        isLoading: false,
        error: null,
        gridColumns: 3,
      },
    } as any)
  })

  describe('Basic Rendering', () => {
    it('should render service card with basic information', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByText('Test Service')).toBeInTheDocument()
      expect(screen.getByText('A comprehensive test service for developers')).toBeInTheDocument()
      expect(screen.getByText('Test Company Inc.')).toBeInTheDocument()
    })

    it('should render service category and subcategory', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByText('development')).toBeInTheDocument()
      expect(screen.getByText('backend')).toBeInTheDocument()
    })

    it('should render service tags', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByText('api')).toBeInTheDocument()
      expect(screen.getByText('rest')).toBeInTheDocument()
      expect(screen.getByText('testing')).toBeInTheDocument()
    })

    it('should render popularity rating', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByText('4.5')).toBeInTheDocument()
      expect(screen.getByLabelText(/popularity rating/i)).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should handle card click and open service modal', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServiceCard service={mockService} />)

      const card = screen.getByRole('button', { name: /view test service details/i })
      await user.click(card)

      expect(mockOpenServiceModal).toHaveBeenCalledWith(mockService)
    })

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServiceCard service={mockService} />)

      const card = screen.getByRole('button')
      card.focus()
      
      expect(card).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(mockOpenServiceModal).toHaveBeenCalledWith(mockService)
    })

    it('should handle space key activation', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServiceCard service={mockService} />)

      const card = screen.getByRole('button')
      card.focus()
      
      await user.keyboard(' ')
      expect(mockOpenServiceModal).toHaveBeenCalledWith(mockService)
    })

    it('should show hover state', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServiceCard service={mockService} />)

      const card = screen.getByRole('button')
      await user.hover(card)

      expect(card).toHaveClass('service-card--hover')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ServiceCard service={mockService} />)

      const card = screen.getByRole('button')
      expect(card).toHaveAttribute('aria-label', 'View Test Service details')
      expect(card).toHaveAttribute('tabindex', '0')
    })

    it('should have semantic HTML structure', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test Service')
      expect(screen.getByText('A comprehensive test service for developers')).toBeInTheDocument()
    })

    it('should announce loading state for screen readers', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        openServiceModal: mockOpenServiceModal,
        setSelectedService: mockSetSelectedService,
        modalState: null,
        viewMode: 'grid',
        uiState: {
          isLoading: true,
          error: null,
          gridColumns: 3,
        },
      } as any)

      render(<ServiceCard service={mockService} loading />)
      
      expect(screen.getByTestId('service-card-skeleton')).toBeInTheDocument()
    })
  })

  describe('Visual States', () => {
    it('should show selected state when service is selected', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        openServiceModal: mockOpenServiceModal,
        setSelectedService: mockSetSelectedService,
        modalState: { service: mockService, isOpen: true },
        viewMode: 'grid',
        uiState: {
          isLoading: false,
          error: null,
          gridColumns: 3,
        },
      } as any)

      render(<ServiceCard service={mockService} />)

      const card = screen.getByRole('button')
      expect(card).toHaveClass('service-card--selected')
    })

    it('should show loading skeleton when loading', () => {
      render(<ServiceCard service={mockService} loading />)

      expect(screen.getByTestId('service-card-skeleton')).toBeInTheDocument()
    })

    it('should handle compact layout', () => {
      render(<ServiceCard service={mockService} compact />)

      const card = screen.getByRole('button')
      expect(card).toHaveClass('service-card--compact')
    })
  })

  describe('Metrics Display', () => {
    it('should display reliability metric', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByText('99.9%')).toBeInTheDocument()
      expect(screen.getByLabelText(/reliability/i)).toBeInTheDocument()
    })

    it('should display performance metric', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByText('4.2')).toBeInTheDocument()
      expect(screen.getByLabelText(/performance/i)).toBeInTheDocument()
    })

    it('should handle missing metrics gracefully', () => {
      const serviceWithoutMetrics = {
        ...mockService,
        metrics: {
          popularity: 3.0,
        },
      } as Service

      render(<ServiceCard service={serviceWithoutMetrics} />)

      expect(screen.getByText('3.0')).toBeInTheDocument()
      expect(screen.queryByText('99.9%')).not.toBeInTheDocument()
    })
  })

  describe('Company Information', () => {
    it('should display company name and website link', () => {
      render(<ServiceCard service={mockService} />)

      const companyLink = screen.getByRole('link', { name: /test company inc\./i })
      expect(companyLink).toHaveAttribute('href', 'https://testcompany.com')
      expect(companyLink).toHaveAttribute('target', '_blank')
      expect(companyLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should handle missing company website', () => {
      const serviceWithoutWebsite = {
        ...mockService,
        company: {
          ...mockService.company,
          website: undefined,
        },
      }

      render(<ServiceCard service={serviceWithoutWebsite} />)

      expect(screen.getByText('Test Company Inc.')).toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('Features and Integrations', () => {
    it('should display key features', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByText('REST API')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
    })

    it('should limit number of features shown', () => {
      const serviceWithManyFeatures = {
        ...mockService,
        features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
      }

      render(<ServiceCard service={serviceWithManyFeatures} />)

      expect(screen.getByText('Feature 1')).toBeInTheDocument()
      expect(screen.getByText('Feature 2')).toBeInTheDocument()
      expect(screen.getByText('+3 more')).toBeInTheDocument()
    })

    it('should display integration count', () => {
      render(<ServiceCard service={mockService} />)

      expect(screen.getByText('3 integrations')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing service data gracefully', () => {
      const incompleteService = {
        id: 'incomplete',
        name: 'Incomplete Service',
      } as Service

      render(<ServiceCard service={incompleteService} />)

      expect(screen.getByText('Incomplete Service')).toBeInTheDocument()
      expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
    })

    it('should handle service with minimal data', () => {
      const minimalService: Service = {
        id: 'minimal',
        name: 'Minimal Service',
        description: '',
        category: 'other',
        tags: [],
        pricing: { type: 'unknown' },
        features: [],
        integrations: [],
        documentation: { examples: [] },
        company: { name: 'Unknown' },
        metrics: { popularity: 0 },
        status: 'active',
        lastUpdated: '',
        createdAt: '',
      }

      render(<ServiceCard service={minimalService} />)

      expect(screen.getByText('Minimal Service')).toBeInTheDocument()
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })
})