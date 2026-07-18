import { render, screen } from '@testing-library/react'
import { toHaveNoViolations } from 'jest-axe'
import { axe as configuredAxe } from '../setup-a11y'
import { FilterPanel } from '@/components/FilterPanel'

expect.extend(toHaveNoViolations)

vi.mock('@/store/service-browser', async () => {
  const actual = await vi.importActual<typeof import('@/store/service-browser')>('@/store/service-browser')
  return {
    ...actual,
    useServiceBrowserStore: () => ({
      activeFilters: { categories: [], pricingTypes: [], companySize: [], minPopularity: null, hasFreeTier: null },
      sortBy: 'popularity',
      setCategories: vi.fn(),
      setPricingTypes: vi.fn(),
      setPopularityFilter: vi.fn(),
      setSortBy: vi.fn(),
      setCompanySizeFilters: vi.fn(),
      setHasFreeTier: vi.fn(),
      resetFilters: vi.fn(),
      getActiveFilterCount: () => 0,
      uiState: {},
      setResourceFilters: vi.fn(),
      totalResults: 0,
    })
  }
})

describe('FilterPanel accessibility', () => {
  it('uses fieldset/legend for grouped controls and announces updates', async () => {
    const { container } = render(<FilterPanel defaultExpanded />)

    // Legends exist
    expect(container.querySelectorAll('legend').length).toBeGreaterThan(0)

    // Live region for announcements
    const live = container.querySelector('#filters-announcement')
    expect(live).toBeInTheDocument()

    const results = await configuredAxe(container)
    expect(results).toHaveNoViolations()
  })
})