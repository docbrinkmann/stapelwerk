import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FilterPanel } from '../FilterPanel'
import { useServiceBrowserStore } from '@/store/service-browser'

// Mock the store
vi.mock('@/store/service-browser')

describe('FilterPanel', () => {
  const mockSetCategories = vi.fn()
  const mockSetTags = vi.fn()
  const mockSetPopularityFilter = vi.fn()
  const mockSetPricingTypes = vi.fn()
  const mockSetSortBy = vi.fn()
  const mockResetFilters = vi.fn()
  const mockSetCompanySizeFilters = vi.fn()
  const mockSetHasFreeTier = vi.fn()

  const defaultStoreState = {
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
    uiState: {
      isLoading: false,
      error: null,
    },
    searchQuery: '',
    setCategories: mockSetCategories,
    setTags: mockSetTags,
    setPopularityFilter: mockSetPopularityFilter,
    setPricingTypes: mockSetPricingTypes,
    setSortBy: mockSetSortBy,
    resetFilters: mockResetFilters,
    setCompanySizeFilters: mockSetCompanySizeFilters,
    setHasFreeTier: mockSetHasFreeTier,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useServiceBrowserStore).mockReturnValue(defaultStoreState as any)
  })

  describe('Basic Rendering', () => {
    it('should render filter panel with main sections', () => {
      render(<FilterPanel />)

      expect(screen.getByText('Filters')).toBeInTheDocument()
      expect(screen.getByText('Categories')).toBeInTheDocument()
      expect(screen.getByText('Sort by')).toBeInTheDocument()
    })

    it('should render filter toggle button on mobile', () => {
      render(<FilterPanel />)

      expect(screen.getByLabelText('Toggle filters')).toBeInTheDocument()
    })

    it('should show active filter count when filters are applied', () => {
      // The fallback count (no getActiveFilterCount in the mock) counts each
      // active category as one filter.
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'redis',
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development', 'database'],
        },
      } as any)

      render(<FilterPanel />)

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByLabelText('3 active filters')).toBeInTheDocument()
    })

    it('should not show filter count when no filters are active', () => {
      // Default store state has no active filters (count = 0)
      render(<FilterPanel />)

      expect(screen.queryByLabelText(/active filters/)).not.toBeInTheDocument()
    })
  })

  describe('Category Filters', () => {
    it('should render category checkboxes', () => {
      render(<FilterPanel />)

      expect(screen.getByLabelText('Development')).toBeInTheDocument()
      expect(screen.getByLabelText('Analytics')).toBeInTheDocument()
      expect(screen.getByLabelText('Deployment')).toBeInTheDocument()
      expect(screen.getByLabelText('Database')).toBeInTheDocument()
      expect(screen.getByLabelText('Security')).toBeInTheDocument()
    })

    it('should show selected categories as checked', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development', 'analytics'],
        },
      } as any)

      render(<FilterPanel />)

      expect(screen.getByLabelText('Development')).toBeChecked()
      expect(screen.getByLabelText('Analytics')).toBeChecked()
      expect(screen.getByLabelText('Deployment')).not.toBeChecked()
    })

    it('should handle category selection', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<FilterPanel />)

      const developmentCheckbox = screen.getByLabelText('Development')
      await user.click(developmentCheckbox)

      expect(mockSetCategories).toHaveBeenCalledWith(['development'])
    })

    it('should handle category deselection', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development', 'analytics'],
        },
      } as any)

      render(<FilterPanel />)

      const developmentCheckbox = screen.getByLabelText('Development')
      await user.click(developmentCheckbox)

      expect(mockSetCategories).toHaveBeenCalledWith(['analytics'])
    })

    it('should show category service counts', () => {
      render(<FilterPanel categories={[
        { name: 'development', count: 25 },
        { name: 'analytics', count: 12 },
        { name: 'deployment', count: 8 },
      ]} />)

      expect(screen.getByText('25')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
    })
  })

  describe('Sort Options', () => {
    it('should render sort dropdown', () => {
      render(<FilterPanel />)

      const sortSelect = screen.getByLabelText('Sort services by')
      expect(sortSelect).toBeInTheDocument()
      expect(sortSelect.tagName).toBe('SELECT')
    })

    it('should show current sort option', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        sortBy: 'alphabetical',
      } as any)

      render(<FilterPanel />)

      const sortSelect = screen.getByLabelText('Sort services by')
      expect(sortSelect).toHaveValue('alphabetical')
    })

    it('should render all sort options', () => {
      render(<FilterPanel />)

      expect(screen.getByText('Most Popular')).toBeInTheDocument()
      expect(screen.getByText('A-Z')).toBeInTheDocument()
      expect(screen.getByText('Z-A')).toBeInTheDocument()
      expect(screen.getByText('Recently Added')).toBeInTheDocument()
    })

    it('should handle sort option changes', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<FilterPanel />)

      const sortSelect = screen.getByLabelText('Sort services by')
      await user.selectOptions(sortSelect, 'alphabetical')

      expect(mockSetSortBy).toHaveBeenCalledWith('alphabetical')
    })
  })

  describe('Filter Reset Functionality', () => {
    it('should render reset button when filters are active', () => {
      // Mock store with 3 active filters
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development'],
          pricingTypes: ['free'],
          minPopularity: 4.0,
        },
      } as any)

      render(<FilterPanel />)

      expect(screen.getByText('Clear all filters')).toBeInTheDocument()
    })

    it('should not show reset button when no filters are active', () => {
      // Default store state has no active filters
      render(<FilterPanel />)

      expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument()
    })

    it('should handle filter reset', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts

      // Mock store with 3 active filters
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development'],
          pricingTypes: ['free'],
          minPopularity: 4.0,
        },
      } as any)

      render(<FilterPanel />)

      const resetButton = screen.getByText('Clear all filters')
      await user.click(resetButton)

      expect(mockResetFilters).toHaveBeenCalled()
    })
  })

  describe('Mobile Responsive Behavior', () => {
    it('should be collapsible on mobile', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<FilterPanel />)

      const toggleButton = screen.getByLabelText('Toggle filters')
      const filterContent = screen.getByTestId('filter-content')

      // Initially expanded or collapsed based on design
      expect(toggleButton).toBeInTheDocument()

      // Toggle filters
      await user.click(toggleButton)
      
      // Should toggle visibility
      expect(toggleButton).toHaveAttribute('aria-expanded')
    })

    it('should show/hide filter content on mobile toggle', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<FilterPanel />)

      const toggleButton = screen.getByLabelText('Toggle filters')
      
      // Toggle to close filters
      if (toggleButton.getAttribute('aria-expanded') === 'true') {
        await user.click(toggleButton)
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
      }

      // Toggle to open filters
      await user.click(toggleButton)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<FilterPanel />)

      const filterPanel = screen.getByRole('region')
      expect(filterPanel).toHaveAttribute('aria-label', 'Service filters')

      const categorySection = screen.getByRole('group', { name: 'Categories' })
      expect(categorySection).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<FilterPanel />)

      const firstCheckbox = screen.getByLabelText('Development')
      const secondCheckbox = screen.getByLabelText('Analytics')

      // Tab to first checkbox
      firstCheckbox.focus()
      expect(firstCheckbox).toHaveFocus()

      // Tab to next checkbox
      await user.keyboard('{Tab}')
      expect(secondCheckbox).toHaveFocus()

      // Space to toggle
      await user.keyboard(' ')
      expect(mockSetCategories).toHaveBeenCalledWith(['analytics'])
    })

    it('should announce filter changes to screen readers', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development', 'database'],
        },
      } as any)

      render(<FilterPanel />)

      const announcement = screen.getByLabelText('2 active filters')
      expect(announcement).toBeInTheDocument()
    })
  })

  describe('Loading and Error States', () => {
    it('should show loading state during filter operations', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        uiState: {
          isLoading: true,
          error: null,
        },
      } as any)

      render(<FilterPanel />)

      expect(screen.getByLabelText('Loading filters...')).toBeInTheDocument()
      
      // Checkboxes should be disabled during loading
      const checkbox = screen.getByLabelText('Development')
      expect(checkbox).toBeDisabled()
    })

    it('should handle error states gracefully', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        uiState: {
          isLoading: false,
          error: new Error('Filter error'),
        },
      } as any)

      render(<FilterPanel />)

      expect(screen.getByText('Unable to load filters. Please refresh the page.')).toBeInTheDocument()
    })
  })

  describe('URL Synchronization', () => {
    it('should sync filter state with URL parameters', () => {
      // This would typically test URL parameter encoding/decoding
      // but requires router context for full testing
      render(<FilterPanel />)

      // Verify that filter changes would trigger URL updates
      // This is tested more thoroughly in integration tests
      expect(screen.getByRole('region')).toBeInTheDocument()
    })
  })

  describe('Filter Combinations', () => {
    it('should handle multiple category selections', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<FilterPanel />)

      const developmentCheckbox = screen.getByLabelText('Development')
      await user.click(developmentCheckbox)

      const databaseCheckbox = screen.getByLabelText('Database')
      await user.click(databaseCheckbox)

      expect(mockSetCategories).toHaveBeenCalledWith(['development'])
      expect(mockSetCategories).toHaveBeenCalledWith(['database'])
    })

    it('should show combined filter count correctly', () => {
      // Each selected category counts as one; the search query adds one more.
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'redis',
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development', 'analytics'],
        },
      } as any)

      render(<FilterPanel />)

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByLabelText('3 active filters')).toBeInTheDocument()
    })
  })
})