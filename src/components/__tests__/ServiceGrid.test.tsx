import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, type MockedFunction } from 'vitest'
import { ServiceGrid } from '../ServiceGrid'
import { useServiceBrowserStore } from '@/store/service-browser'
import { useInfiniteServiceBrowserScroll } from '@/hooks/useInfiniteScroll'
import type { Service } from '@/types/service-browser'

// Mock the store and hooks
vi.mock('@/store/service-browser')
vi.mock('@/hooks/useInfiniteScroll')

// IntersectionObserver is mocked globally in setup.ts
// No need to override here

// Mock service data
const mockServices: Service[] = [
  {
    id: 'service-1',
    name: 'Test Service 1',
    description: 'First test service',
    category: 'development',
    subcategory: 'backend',
    tags: ['api', 'rest'],
    pricing: { type: 'free' },
    features: ['REST API'],
    integrations: ['GitHub'],
    documentation: { examples: [] },
    company: { name: 'Company 1' },
    metrics: { popularity: 4.5 },
    status: 'active',
    lastUpdated: '2024-01-15T10:30:00Z',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'service-2',
    name: 'Test Service 2',
    description: 'Second test service',
    category: 'analytics',
    subcategory: 'tracking',
    tags: ['analytics', 'tracking'],
    pricing: { type: 'freemium', startingPrice: 19 },
    features: ['Analytics'],
    integrations: ['Slack'],
    documentation: { examples: [] },
    company: { name: 'Company 2' },
    metrics: { popularity: 3.8 },
    status: 'active',
    lastUpdated: '2024-01-14T10:30:00Z',
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'service-3',
    name: 'Test Service 3',
    description: 'Third test service',
    category: 'deployment',
    subcategory: 'hosting',
    tags: ['hosting', 'cloud'],
    pricing: { type: 'enterprise' },
    features: ['Cloud Hosting'],
    integrations: ['AWS'],
    documentation: { examples: [] },
    company: { name: 'Company 3' },
    metrics: { popularity: 4.2 },
    status: 'active',
    lastUpdated: '2024-01-13T10:30:00Z',
    createdAt: '2024-01-03T00:00:00Z',
  },
]

describe('ServiceGrid', () => {
  const mockLoadMore = vi.fn()
  const mockRefetch = vi.fn()

  // Helper function to create default store mock
  const createStoreMock = (overrides: any = {}) => ({
    viewMode: 'grid',
    uiState: {
      isLoading: false,
      error: null,
      gridColumns: 3,
    },
    itemsPerPage: 24,
    currentPage: 1,
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
    sortBy: 'popularity',
    setGridColumns: vi.fn(),
    openServiceModal: vi.fn(),
    resetFilters: vi.fn(),
    getActiveFilterCount: vi.fn().mockReturnValue(0),
    ...overrides,
  })

  // Helper function to create default infinite scroll mock
  const createInfiniteScrollMock = (overrides: any = {}) => ({
    services: mockServices,
    isLoading: false,
    isLoadingMore: false,
    hasNextPage: true,
    loadMore: mockLoadMore,
    error: null,
    refetch: mockRefetch,
    mode: 'browse',
    isEmpty: false,
    totalCount: mockServices.length,
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default store mock
    vi.mocked(useServiceBrowserStore).mockReturnValue(createStoreMock() as any)

    // Default infinite scroll mock
    vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue(createInfiniteScrollMock())
  })

  describe('Basic Rendering', () => {
    it('should render service grid with services', () => {
      render(<ServiceGrid />)

      expect(screen.getByTestId('service-grid')).toBeInTheDocument()
      expect(screen.getByText('Test Service 1')).toBeInTheDocument()
      expect(screen.getByText('Test Service 2')).toBeInTheDocument()
      expect(screen.getByText('Test Service 3')).toBeInTheDocument()
    })

    it('should render grid with correct CSS grid classes', () => {
      render(<ServiceGrid />)

      const grid = screen.getByTestId('service-grid')
      expect(grid).toHaveClass('service-grid')
      expect(grid).toHaveClass('service-grid--3-columns')
    })

    it('should apply mobile-first responsive classes', () => {
      render(<ServiceGrid />)

      const grid = screen.getByTestId('service-grid')
      expect(grid).toHaveClass('grid-cols-1')
      expect(grid).toHaveClass('md:grid-cols-3')
    })
  })

  describe('Responsive Grid Layout', () => {
    it('should adapt columns based on store state', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue(createStoreMock({
        uiState: {
          isLoading: false,
          error: null,
          gridColumns: 4,
        }
      }) as any)

      render(<ServiceGrid />)

      const grid = screen.getByTestId('service-grid')
      expect(grid).toHaveClass('service-grid--4-columns')
      expect(grid).toHaveClass('lg:grid-cols-4')
    })

    it('should handle different column counts', () => {
      const columnTests = [1, 2, 3, 4, 5, 6]

      columnTests.forEach(columns => {
        vi.mocked(useServiceBrowserStore).mockReturnValue({
          viewMode: 'grid',
          uiState: {
            isLoading: false,
            error: null,
            gridColumns: columns,
          },
          itemsPerPage: 24,
          currentPage: 1,
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
          sortBy: 'popularity',
          setGridColumns: vi.fn(),
          openServiceModal: vi.fn(),
          resetFilters: vi.fn(),
          getActiveFilterCount: vi.fn().mockReturnValue(0),
        } as any)

        const { unmount } = render(<ServiceGrid />)
        // Use a defensive query in case prior renders were not fully cleaned
        const grids = screen.getAllByTestId('service-grid')
        const grid = grids[grids.length - 1]

        expect(grid).toHaveClass(`service-grid--${columns}-columns`)

        // Ensure we do not accumulate multiple renders in the same test
        unmount()
      })
    })

    it('should handle window resize events', async () => {
      const setGridColumns = vi.fn()
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        viewMode: 'grid',
        uiState: {
          isLoading: false,
          error: null,
          gridColumns: 3,
        },
        itemsPerPage: 24,
        currentPage: 1,
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
        sortBy: 'popularity',
        setGridColumns,
        openServiceModal: vi.fn(),
        resetFilters: vi.fn(),
        getActiveFilterCount: vi.fn().mockReturnValue(0),
      } as any)

      render(<ServiceGrid />)

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })
      
      fireEvent(window, new Event('resize'))
      
      await waitFor(() => {
        expect(setGridColumns).toHaveBeenCalled()
      })
    })
  })

  describe('View Modes', () => {
    it('should render in list view mode', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...vi.mocked(useServiceBrowserStore)(),
        viewMode: 'list',
      } as any)

      render(<ServiceGrid />)

      const grid = screen.getByTestId('service-grid')
      expect(grid).toHaveClass('service-grid--list')
      expect(grid).not.toHaveClass('service-grid--grid')
    })

    it('should render in grid view mode', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...vi.mocked(useServiceBrowserStore)(),
        viewMode: 'grid',
      } as any)

      render(<ServiceGrid />)

      const grid = screen.getByTestId('service-grid')
      expect(grid).toHaveClass('service-grid--grid')
      expect(grid).not.toHaveClass('service-grid--list')
    })

    it('should render in compact view mode', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...vi.mocked(useServiceBrowserStore)(),
        viewMode: 'compact',
      } as any)

      render(<ServiceGrid />)

      const grid = screen.getByTestId('service-grid')
      expect(grid).toHaveClass('service-grid--compact')
    })
  })

  describe('Loading States', () => {
    it('should show skeleton loading for initial load', () => {
      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        services: [],
        isLoading: true,
      })

      render(<ServiceGrid />)

      expect(screen.getAllByTestId('service-card-skeleton')).toHaveLength(24) // Default items per page
    })

    it('should show partial skeleton loading for load more', () => {
      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        services: mockServices,
        isLoadingMore: true,
      })

      render(<ServiceGrid />)

      // Should show existing services
      expect(screen.getByText('Test Service 1')).toBeInTheDocument()
      // Should show additional skeletons for loading more
      expect(screen.getAllByTestId('service-card-skeleton').length).toBeGreaterThan(0)
    })

    it('should hide loading states when data is loaded', () => {
      render(<ServiceGrid />)

      expect(screen.queryByTestId('service-card-skeleton')).not.toBeInTheDocument()
      expect(screen.getByText('Test Service 1')).toBeInTheDocument()
    })
  })

  describe('Infinite Scroll Integration', () => {
    it('should render load more trigger', () => {
      render(<ServiceGrid />)

      expect(screen.getByTestId('load-more-trigger')).toBeInTheDocument()
    })

    it('should call loadMore when trigger is intersected', async () => {
      const mockObserve = vi.fn()
      const mockCallback = vi.fn()

      // Mock IntersectionObserver to trigger callback.
      // Must be a `function` (not arrow) so `new IntersectionObserver()` works in vitest 4.
      global.IntersectionObserver = vi.fn(function (callback: IntersectionObserverCallback) {
        mockCallback.mockImplementation(callback)
        return {
          observe: mockObserve,
          disconnect: vi.fn(),
          unobserve: vi.fn(),
        }
      }) as any

      render(<ServiceGrid />)

      // Simulate intersection
      mockCallback([{ isIntersecting: true }])

      await waitFor(() => {
        expect(mockLoadMore).toHaveBeenCalled()
      })
    })

    it('should not show load more trigger when no more pages', () => {
      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        hasNextPage: false,
      })

      render(<ServiceGrid />)

      expect(screen.queryByTestId('load-more-trigger')).not.toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no services', () => {
      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        services: [],
        isEmpty: true,
        isLoading: false,
      })

      render(<ServiceGrid />)

      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByText(/no services found/i)).toBeInTheDocument()
    })

    it('should show search-specific empty state', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...vi.mocked(useServiceBrowserStore)(),
        isSearchMode: true,
        searchQuery: 'nonexistent',
      } as any)

      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        services: [],
        isEmpty: true,
        mode: 'search',
      })

      render(<ServiceGrid />)

      expect(screen.getByText(/no services found for "nonexistent"/i)).toBeInTheDocument()
    })

    it('should show filter-specific empty state', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...vi.mocked(useServiceBrowserStore)(),
        activeFilters: {
          ...vi.mocked(useServiceBrowserStore)().activeFilters,
          categories: ['nonexistent-category'],
        },
      } as any)

      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        services: [],
        isEmpty: true,
      })

      render(<ServiceGrid />)

      expect(screen.getByText(/no services match your current filters/i)).toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('should show error state when error occurs', () => {
      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        services: [],
        error: new Error('Failed to load services'),
      })

      render(<ServiceGrid />)

      expect(screen.getByTestId('error-state')).toBeInTheDocument()
      expect(screen.getByText(/failed to load services/i)).toBeInTheDocument()
    })

    it('should provide retry functionality on error', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts

      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        services: [],
        error: new Error('Network error'),
      })

      render(<ServiceGrid />)

      const retryButton = screen.getByRole('button', { name: /try again/i })
      await user.click(retryButton)

      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ServiceGrid />)

      // The grid container must NOT use role="grid": its children are
      // <button> cards, which violates aria-required-children (axe).
      const grid = screen.getByTestId('service-grid')
      expect(grid).not.toHaveAttribute('role')

      // The labelled region wrapper carries the accessible name instead.
      expect(screen.getByRole('region', { name: 'Service catalog grid' })).toBeInTheDocument()
    })

    it('should have proper landmark structure', () => {
      render(<ServiceGrid />)

      // No nested <main> — the page layout provides the main landmark.
      expect(screen.queryByRole('main')).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Service catalog grid' })).toBeInTheDocument()
    })

    it('should announce loading states for screen readers', () => {
      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        isLoading: true,
        services: [],
      })

      render(<ServiceGrid />)

      expect(screen.getByLabelText(/loading services/i)).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<ServiceGrid />)

      const firstCard = screen.getAllByRole('button')[0]
      firstCard.focus()

      expect(firstCard).toHaveFocus()

      await user.keyboard('{ArrowDown}')
      // Next card in grid should be focused
      // This would depend on the specific keyboard navigation implementation
    })
  })

  describe('Performance', () => {
    it('should handle large numbers of services efficiently', () => {
      const largeServiceList = Array.from({ length: 1000 }, (_, index) => ({
        ...mockServices[0],
        id: `service-${index}`,
        name: `Service ${index}`,
      }))

      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...vi.mocked(useInfiniteServiceBrowserScroll)(),
        services: largeServiceList,
      })

      const startTime = performance.now()
      render(<ServiceGrid />)
      const endTime = performance.now()

      // Generous bound: guards against pathological O(n²) blowups only.
      // jsdom wall-clock varies heavily under parallel suite load, so a
      // tight threshold (1s) was flaky in full-suite runs.
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('should implement virtual scrolling for large lists', () => {
      // Derive from the factory, not from calling the mock — the mock's
      // implementation may be cleared under shared-context sweep runs
      const base = createStoreMock() as any
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...base,
        uiState: {
          ...base.uiState,
          enableVirtualScrolling: true,
        },
      } as any)

      render(<ServiceGrid />)

      expect(screen.getByTestId('virtual-grid')).toBeInTheDocument()
    })
  })

  describe('Integration with Store', () => {
    it('should reflect store changes in real-time', () => {
      const { rerender } = render(<ServiceGrid />)

      expect(screen.getByTestId('service-grid')).toHaveClass('service-grid--3-columns')

      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...vi.mocked(useServiceBrowserStore)(),
        uiState: {
          ...vi.mocked(useServiceBrowserStore)().uiState,
          gridColumns: 5,
        },
      } as any)

      rerender(<ServiceGrid />)

      expect(screen.getByTestId('service-grid')).toHaveClass('service-grid--5-columns')
    })

    it('should handle store state transitions smoothly', () => {
      const { rerender } = render(<ServiceGrid />)

      // Start with grid view
      expect(screen.getByTestId('service-grid')).toHaveClass('service-grid--grid')

      // Switch to list view
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...vi.mocked(useServiceBrowserStore)(),
        viewMode: 'list',
      } as any)

      rerender(<ServiceGrid />)

      expect(screen.getByTestId('service-grid')).toHaveClass('service-grid--list')
    })
  })
})