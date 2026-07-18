import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ServiceCard } from '../ServiceCard'
import { ServiceGrid } from '../ServiceGrid'
import type { Service } from '@/types/service-browser'

// Mock dependencies
vi.mock('@/store/service-browser', () => ({
  useServiceBrowserStore: vi.fn(() => ({
    openServiceModal: vi.fn(),
    selectedService: null,
    viewMode: 'grid',
    uiState: {
      isLoading: false,
      error: null,
      gridColumns: 3,
    },
    itemsPerPage: 24,
    isSearchMode: false,
    searchQuery: '',
    activeFilters: {
      categories: [],
      subcategories: [],
      tags: [],
      pricingTypes: [],
      features: [],
      integrations: [],
      companySize: [],
      minPopularity: null,
      hasFreeTier: null,
    },
    resetFilters: vi.fn(),
    getActiveFilterCount: () => 0,
    setGridColumns: vi.fn(),
  })),
}))

vi.mock('@/hooks/useInfiniteScroll', () => ({
  useInfiniteServiceBrowserScroll: vi.fn(() => ({
    services: [],
    isLoading: true,
    isLoadingMore: false,
    hasNextPage: false,
    loadMore: vi.fn(),
    error: null,
    refetch: vi.fn(),
    mode: 'browse',
    isEmpty: false,
  })),
}))

vi.mock('react-intersection-observer', () => ({
  useInView: vi.fn(() => ({
    ref: vi.fn(),
    inView: false,
  })),
}))

// Mock service data
const mockService: Service = {
  id: 'test-service',
  name: 'Test Service',
  description: 'A test service for developers',
  category: 'development',
  subcategory: 'backend',
  tags: ['api', 'rest'],
  pricing: {
    type: 'free',
  },
  features: ['REST API'],
  integrations: ['GitHub'],
  documentation: {
    examples: [],
  },
  company: {
    name: 'Test Company',
  },
  metrics: {
    popularity: 4.5,
  },
  status: 'active',
  lastUpdated: '2024-01-15T10:30:00Z',
  createdAt: '2024-01-01T00:00:00Z',
}

describe('Component Integration Tests', () => {
  describe('ServiceCard', () => {
    it('renders service card with basic information', () => {
      render(<ServiceCard service={mockService} />)
      
      expect(screen.getByText('Test Service')).toBeInTheDocument()
      expect(screen.getByText('A test service for developers')).toBeInTheDocument()
      expect(screen.getByText('Test Company')).toBeInTheDocument()
      expect(screen.getByText('development')).toBeInTheDocument()
    })

    it('renders skeleton when loading', () => {
      render(<ServiceCard service={mockService} loading />)
      
      expect(screen.getByTestId('service-card-skeleton')).toBeInTheDocument()
      expect(screen.getByLabelText('Loading service')).toBeInTheDocument()
    })

    it('renders in compact mode', () => {
      render(<ServiceCard service={mockService} compact />)
      
      const card = screen.getByRole('button')
      expect(card).toHaveClass('service-card--compact')
    })
  })

  describe('ServiceGrid', () => {
    it('renders loading skeletons initially', () => {
      render(<ServiceGrid />)
      
      // role="grid" was removed (invalid with button children, axe aria-required-children)
      expect(screen.getByTestId('service-grid')).toBeInTheDocument()
      expect(screen.getByLabelText('Loading services')).toBeInTheDocument()
      
      // Should have skeleton cards
      const skeletons = screen.getAllByTestId('service-card-skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('applies correct CSS classes based on view mode', () => {
      render(<ServiceGrid />)
      
      const grid = screen.getByTestId('service-grid')
      expect(grid).toHaveClass('service-grid')
      expect(grid).toHaveClass('service-grid--grid')
      expect(grid).toHaveClass('service-grid--3-columns')
    })
  })
})