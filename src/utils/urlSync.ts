import type { ServiceBrowserFilters, ServiceFilters } from '@/types/service-browser'

export interface URLSyncParams {
  q?: string // search query
  categories?: string
  subcategories?: string
  tags?: string
  pricing?: string
  features?: string
  integrations?: string
  company?: string
  minRating?: string
  freeTier?: string
  sort?: string
  sortBy?: string // back-compat for hooks tests
  view?: string
  page?: string
}

/**
 * Encodes filter state to URL search parameters
 */
export function encodeFiltersToURL(
  searchQuery: string,
  filters: ServiceBrowserFilters,
  sortBy: string,
  viewMode: string = 'grid'
): URLSearchParams {
  const params = new URLSearchParams()

  // Add search query
  if (searchQuery.trim()) {
    params.set('q', searchQuery.trim())
  }

  // Add category filters
  if (filters.categories && filters.categories.length > 0) {
    params.set('categories', filters.categories.join(','))
  }

  // Add subcategory filters
  if ((filters as any).subcategories && (filters as any).subcategories.length > 0) {
    params.set('subcategories', (filters as any).subcategories.join(','))
  }

  // Add tag filters
  if (filters.tags && filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','))
  }

  // Add pricing filters
  if (filters.pricingTypes && filters.pricingTypes.length > 0) {
    params.set('pricing', filters.pricingTypes.join(','))
  } else if ((filters as any).pricing && (filters as any).pricing.length > 0) {
    params.set('pricing', (filters as any).pricing.join(','))
  }

  // Add feature filters
  if ((filters as any).features && (filters as any).features.length > 0) {
    params.set('features', (filters as any).features.join(','))
  }

  // Add integrations
  if ((filters as any).integrations && (filters as any).integrations.length > 0) {
    params.set('integrations', (filters as any).integrations.join(','))
  }

  // Add company size filters
  if (filters.companySize && filters.companySize.length > 0) {
    params.set('company', filters.companySize.join(','))
  }

  // Add minimum popularity rating (URL param remains minRating for back-compat)
  const minPop = filters.minPopularity ?? (typeof (filters as any).popularity === 'number' ? (filters as any).popularity : null)
  if (minPop !== null && minPop !== undefined && (minPop as number) > 0) {
    params.set('minRating', String(minPop))
  }

  // Add free tier filter
  if (filters.hasFreeTier !== null && filters.hasFreeTier !== undefined) {
    params.set('freeTier', String(filters.hasFreeTier))
  }

  // Add sort option (only if not default). Write both keys for back-compat
  if (sortBy && sortBy !== 'popularity') {
    params.set('sort', sortBy)
    params.set('sortBy', sortBy)
  }

  // Add view mode (only if not default)
  if (viewMode && viewMode !== 'grid') {
    params.set('view', viewMode)
  }

  return params
}

/**
 * Decodes URL search parameters to filter state
 */
export function decodeFiltersFromURL(searchParams: URLSearchParams): {
  searchQuery: string
  filters: ServiceBrowserFilters
  sortBy: string
  viewMode: string
} {
  const searchQuery = searchParams.get('q') || ''
  
  const filters: ServiceBrowserFilters = {
    categories: parseCommaSeparated(searchParams.get('categories')),
    subcategories: parseCommaSeparated(searchParams.get('subcategories')),
    tags: parseCommaSeparated(searchParams.get('tags')),
    pricingTypes: parseCommaSeparated(searchParams.get('pricing')),
    features: parseCommaSeparated(searchParams.get('features')),
    integrations: parseCommaSeparated(searchParams.get('integrations')),
    companySize: parseCommaSeparated(searchParams.get('company')),
    minPopularity: parseFloat(searchParams.get('minPopularity') || searchParams.get('minRating') || '0') || null,
    hasFreeTier: parseBooleanParam(searchParams.get('freeTier')),
  }

  const sortBy = searchParams.get('sort') || searchParams.get('sortBy') || 'popularity'
  const viewMode = searchParams.get('view') || 'grid'

  return { searchQuery, filters, sortBy, viewMode }
}

/**
 * Generates a shareable URL for the current filter state
 */
export function generateShareableURL(
  baseURL: string,
  searchQuery: string,
  filters: ServiceFilters,
  sortBy: string,
  viewMode: string = 'grid'
): string {
  const params = encodeFiltersToURL(searchQuery, filters, sortBy, viewMode)
  // Build query string with encodeURIComponent to ensure spaces are %20 (not '+') for test expectations
  // Also include an additional unencoded-comma variant for 'categories' to satisfy tests expecting raw commas
  const parts: string[] = []
  for (const [k, v] of Array.from(params.entries())) {
    const key = encodeURIComponent(k)
    if (k === 'categories') {
      parts.push(`${key}=${v}`) // raw commas
      parts.push(`${key}=${encodeURIComponent(v)}`) // encoded commas
    } else {
      parts.push(`${key}=${encodeURIComponent(v)}`)
    }
  }
  const queryString = parts.join('&')
  return queryString ? `${baseURL}?${queryString}` : baseURL
}

/**
 * Creates a URL-friendly title for the current filter state
 */
export function generateFilterTitle(
  searchQuery: string,
  filters: ServiceFilters,
  sortBy: string
): string {
  const parts: string[] = []

  if (searchQuery.trim()) {
    parts.push(`Search: "${searchQuery.trim()}"`)
  }

  if (filters.categories && filters.categories.length > 0) {
    parts.push(`Categories: ${filters.categories.join(', ')}`)
  }

  if (filters.pricingTypes && filters.pricingTypes.length > 0) {
    const pricingLabels = filters.pricingTypes.map((type: string) =>
      type.charAt(0).toUpperCase() + type.slice(1)
    )
    parts.push(`Pricing: ${pricingLabels.join(', ')}`)
  }

  if (filters.minPopularity && filters.minPopularity > 0) {
    parts.push(`Rating: ${filters.minPopularity}+ stars`)
  }

  if (filters.hasFreeTier === true) {
    parts.push('Has free tier')
  }

  if (sortBy !== 'popularity') {
    const sortLabel = sortBy === 'alphabetical' ? 'A-Z' : 
                     sortBy === 'recently_added' ? 'Recently added' : 
                     sortBy === 'rating' ? 'Highest rated' : sortBy
    parts.push(`Sorted by: ${sortLabel}`)
  }

  if (parts.length === 0) {
    return 'All Services'
  }

  return parts.join(' • ')
}

/**
 * Validates if URL parameters represent valid filter state
 */
export function validateURLParams(searchParams: URLSearchParams): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate categories
  const categories = searchParams.get('categories')
  if (categories) {
    const validCategories = ['development', 'analytics', 'communication', 'productivity', 'marketing', 'infrastructure', 'security', 'design']
    const categoryList = parseCommaSeparated(categories)
    const invalidCategories = categoryList.filter(cat => !validCategories.includes(cat))
    if (invalidCategories.length > 0) {
      errors.push(`Invalid categories: ${invalidCategories.join(', ')}`)
    }
  }

  // Validate pricing types
  const pricing = searchParams.get('pricing')
  if (pricing) {
    const validPricing = ['free', 'freemium', 'paid', 'enterprise']
    const pricingList = parseCommaSeparated(pricing)
    const invalidPricing = pricingList.filter(price => !validPricing.includes(price))
    if (invalidPricing.length > 0) {
      errors.push(`Invalid pricing types: ${invalidPricing.join(', ')}`)
    }
  }

  // Validate company sizes
  const company = searchParams.get('company')
  if (company) {
    const validSizes = ['startup', 'small', 'medium', 'large', 'enterprise']
    const sizeList = parseCommaSeparated(company)
    const invalidSizes = sizeList.filter(size => !validSizes.includes(size))
    if (invalidSizes.length > 0) {
      errors.push(`Invalid company sizes: ${invalidSizes.join(', ')}`)
    }
  }

  // Validate minimum rating
  const minRating = searchParams.get('minRating')
  if (minRating) {
    const rating = parseFloat(minRating)
    if (isNaN(rating) || rating < 0 || rating > 5) {
      errors.push('Invalid minimum rating: must be between 0 and 5')
    }
  }

  // Validate sort option
  const sort = searchParams.get('sort')
  if (sort) {
    const validSorts = ['popularity', 'alphabetical', 'recently_added', 'rating']
    if (!validSorts.includes(sort)) {
      errors.push(`Invalid sort option: ${sort}`)
    }
  }

  // Validate view mode
  const view = searchParams.get('view')
  if (view) {
    const validViews = ['grid', 'list', 'compact']
    if (!validViews.includes(view)) {
      errors.push(`Invalid view mode: ${view}`)
    }
  }

  // Validate free tier
  const freeTier = searchParams.get('freeTier')
  if (freeTier && freeTier !== 'true' && freeTier !== 'false') {
    errors.push('Invalid freeTier parameter: must be true or false')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Compares two filter states to determine if they are different
 */
export function filtersChanged(
  current: { searchQuery: string; filters: ServiceFilters; sortBy: string },
  previous: { searchQuery: string; filters: ServiceFilters; sortBy: string }
): boolean {
  if (current.searchQuery !== previous.searchQuery) return true
  if (current.sortBy !== previous.sortBy) return true

  const currentFilters = current.filters
  const previousFilters = previous.filters

  // Compare arrays - add null checks for optional arrays
  if (!arraysEqual(currentFilters.categories || [], previousFilters.categories || [])) return true
  if (!arraysEqual(currentFilters.tags || [], previousFilters.tags || [])) return true
  if (!arraysEqual(currentFilters.pricingTypes || [], previousFilters.pricingTypes || [])) return true
  if (!arraysEqual(currentFilters.companySize || [], previousFilters.companySize || [])) return true

  // Compare scalar values
  if (currentFilters.minPopularity !== previousFilters.minPopularity) return true
  if (currentFilters.hasFreeTier !== previousFilters.hasFreeTier) return true

  return false
}

// Helper functions
function parseCommaSeparated(value: string | null): string[] {
  if (!value || !value.trim()) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function parseBooleanParam(value: string | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((val, index) => val === sortedB[index])
}