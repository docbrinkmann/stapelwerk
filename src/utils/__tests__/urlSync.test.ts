import { describe, it, expect } from 'vitest'
import {
  encodeFiltersToURL,
  decodeFiltersFromURL,
  generateShareableURL,
  generateFilterTitle,
  validateURLParams,
  filtersChanged
} from '../urlSync'
import type { ServiceBrowserFilters } from '@/types/service-browser'

describe('URL Synchronization Utilities', () => {
  const mockFilters: ServiceBrowserFilters = {
    categories: ['development', 'analytics'],
    subcategories: ['web-development', 'data-analysis'],
    tags: ['javascript', 'python'],
    pricingTypes: ['free', 'freemium'],
    features: ['api', 'dashboard'],
    integrations: ['slack', 'github'],
    companySize: ['startup', 'small'],
    minPopularity: 4.5,
    hasFreeTier: true
  }

  describe('encodeFiltersToURL', () => {
    it('should encode search query correctly', () => {
      const params = encodeFiltersToURL('docker containers', {} as ServiceBrowserFilters, 'popularity')
      expect(params.get('q')).toBe('docker containers')
    })

    it('should encode all filter types correctly', () => {
      const params = encodeFiltersToURL('', mockFilters, 'alphabetical', 'list')

      expect(params.get('categories')).toBe('development,analytics')
      expect(params.get('subcategories')).toBe('web-development,data-analysis')
      expect(params.get('tags')).toBe('javascript,python')
      expect(params.get('pricing')).toBe('free,freemium')
      expect(params.get('features')).toBe('api,dashboard')
      expect(params.get('integrations')).toBe('slack,github')
      expect(params.get('company')).toBe('startup,small')
      expect(params.get('minRating')).toBe('4.5')
      expect(params.get('freeTier')).toBe('true')
      expect(params.get('sort')).toBe('alphabetical')
      expect(params.get('view')).toBe('list')
    })

    it('should not include default values', () => {
      const emptyFilters: ServiceBrowserFilters = {
        categories: [],
        subcategories: [],
        tags: [],
        pricingTypes: [],
        features: [],
        integrations: [],
        companySize: [],
        minPopularity: null,
        hasFreeTier: null
      }

      const params = encodeFiltersToURL('', emptyFilters, 'popularity', 'grid')

      expect(params.get('q')).toBeNull()
      expect(params.get('categories')).toBeNull()
      expect(params.get('sort')).toBeNull() // default value
      expect(params.get('view')).toBeNull() // default value
    })

    it('should handle edge cases', () => {
      const params = encodeFiltersToURL('  trimmed  ', mockFilters, 'popularity')
      expect(params.get('q')).toBe('trimmed')

      const params2 = encodeFiltersToURL('', {
        ...mockFilters,
        minPopularity: 0
      }, 'popularity')
      expect(params2.get('minRating')).toBeNull()
    })
  })

  describe('decodeFiltersFromURL', () => {
    it('should decode all filter types correctly', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('q', 'database tools')
      searchParams.set('categories', 'development,infrastructure')
      searchParams.set('pricing', 'paid,enterprise')
      searchParams.set('minRating', '3.5')
      searchParams.set('freeTier', 'false')
      searchParams.set('sort', 'rating')
      searchParams.set('view', 'compact')

      const result = decodeFiltersFromURL(searchParams)

      expect(result.searchQuery).toBe('database tools')
      expect(result.filters.categories).toEqual(['development', 'infrastructure'])
      expect(result.filters.pricingTypes).toEqual(['paid', 'enterprise'])
      expect(result.filters.minPopularity).toBe(3.5)
      expect(result.filters.hasFreeTier).toBe(false)
      expect(result.sortBy).toBe('rating')
      expect(result.viewMode).toBe('compact')
    })

    it('should handle empty parameters', () => {
      const searchParams = new URLSearchParams()
      const result = decodeFiltersFromURL(searchParams)

      expect(result.searchQuery).toBe('')
      expect(result.filters.categories).toEqual([])
      expect(result.filters.minPopularity).toBeNull()
      expect(result.filters.hasFreeTier).toBeNull()
      expect(result.sortBy).toBe('popularity')
      expect(result.viewMode).toBe('grid')
    })

    it('should handle malformed parameters gracefully', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('categories', ',development,,analytics,')
      searchParams.set('minRating', 'invalid')
      searchParams.set('freeTier', 'maybe')

      const result = decodeFiltersFromURL(searchParams)

      expect(result.filters.categories).toEqual(['development', 'analytics'])
      expect(result.filters.minPopularity).toBeNull()
      expect(result.filters.hasFreeTier).toBeNull()
    })
  })

  describe('generateShareableURL', () => {
    it('should generate correct shareable URLs', () => {
      const baseURL = 'https://example.com/services'
      const url = generateShareableURL(baseURL, 'docker', mockFilters, 'alphabetical')

      expect(url).toContain('https://example.com/services?')
      expect(url).toContain('q=docker')
      expect(url).toContain('categories=development%2Canalytics')
      expect(url).toContain('sort=alphabetical')
    })

    it('should return base URL when no filters', () => {
      const baseURL = 'https://example.com/services'
      const emptyFilters: ServiceBrowserFilters = {
        categories: [],
        subcategories: [],
        tags: [],
        pricingTypes: [],
        features: [],
        integrations: [],
        companySize: [],
        minPopularity: null,
        hasFreeTier: null
      }

      const url = generateShareableURL(baseURL, '', emptyFilters, 'popularity')
      expect(url).toBe(baseURL)
    })
  })

  describe('generateFilterTitle', () => {
    it('should generate comprehensive filter titles', () => {
      const title = generateFilterTitle('docker', mockFilters, 'alphabetical')

      expect(title).toContain('Search: "docker"')
      expect(title).toContain('Categories: development, analytics')
      expect(title).toContain('Pricing: Free, Freemium')
      expect(title).toContain('Rating: 4.5+ stars')
      expect(title).toContain('Has free tier')
      expect(title).toContain('Sorted by: A-Z')
    })

    it('should handle empty filters', () => {
      const emptyFilters: ServiceBrowserFilters = {
        categories: [],
        subcategories: [],
        tags: [],
        pricingTypes: [],
        features: [],
        integrations: [],
        companySize: [],
        minPopularity: null,
        hasFreeTier: null
      }

      const title = generateFilterTitle('', emptyFilters, 'popularity')
      expect(title).toBe('All Services')
    })

    it('should handle different sort options', () => {
      const title1 = generateFilterTitle('', mockFilters, 'recently_added')
      expect(title1).toContain('Sorted by: Recently added')

      const title2 = generateFilterTitle('', mockFilters, 'rating')
      expect(title2).toContain('Sorted by: Highest rated')
    })
  })

  describe('validateURLParams', () => {
    it('should validate correct parameters', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('categories', 'development,analytics')
      searchParams.set('pricing', 'free,paid')
      searchParams.set('minRating', '4.0')
      searchParams.set('sort', 'alphabetical')
      searchParams.set('freeTier', 'true')

      const result = validateURLParams(searchParams)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch invalid categories', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('categories', 'development,invalid-category')

      const result = validateURLParams(searchParams)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid categories: invalid-category')
    })

    it('should catch invalid pricing types', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('pricing', 'free,super-premium')

      const result = validateURLParams(searchParams)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid pricing types: super-premium')
    })

    it('should catch invalid ratings', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('minRating', '10')

      const result = validateURLParams(searchParams)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid minimum rating: must be between 0 and 5')
    })

    it('should catch invalid sort options', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('sort', 'trending')

      const result = validateURLParams(searchParams)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid sort option: trending')
    })

    it('should catch invalid boolean parameters', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('freeTier', 'maybe')

      const result = validateURLParams(searchParams)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid freeTier parameter: must be true or false')
    })
  })

  describe('filtersChanged', () => {
    const baseState = {
      searchQuery: 'docker',
      filters: mockFilters,
      sortBy: 'popularity'
    }

    it('should detect search query changes', () => {
      const newState = { ...baseState, searchQuery: 'kubernetes' }
      expect(filtersChanged(newState, baseState)).toBe(true)
    })

    it('should detect sort changes', () => {
      const newState = { ...baseState, sortBy: 'alphabetical' }
      expect(filtersChanged(newState, baseState)).toBe(true)
    })

    it('should detect filter array changes', () => {
      const newState = {
        ...baseState,
        filters: {
          ...mockFilters,
          categories: ['development', 'security'] // different from original
        }
      }
      expect(filtersChanged(newState, baseState)).toBe(true)
    })

    it('should detect filter value changes', () => {
      const newState = {
        ...baseState,
        filters: {
          ...mockFilters,
          minPopularity: 3.0 // different from original 4.5
        }
      }
      expect(filtersChanged(newState, baseState)).toBe(true)
    })

    it('should return false for identical states', () => {
      const identicalState = {
        searchQuery: baseState.searchQuery,
        filters: { ...baseState.filters },
        sortBy: baseState.sortBy
      }
      expect(filtersChanged(identicalState, baseState)).toBe(false)
    })

    it('should handle array order differences correctly', () => {
      const reorderedState = {
        ...baseState,
        filters: {
          ...mockFilters,
          categories: ['analytics', 'development'] // same items, different order
        }
      }
      expect(filtersChanged(reorderedState, baseState)).toBe(false)
    })
  })

  describe('Edge Cases and Performance', () => {
    it('should handle very long search queries', () => {
      const longQuery = 'a'.repeat(1000)
      const params = encodeFiltersToURL(longQuery, mockFilters, 'popularity')
      expect(params.get('q')).toBe(longQuery)

      const searchParams = new URLSearchParams()
      searchParams.set('q', longQuery)
      const decoded = decodeFiltersFromURL(searchParams)
      expect(decoded.searchQuery).toBe(longQuery)
    })

    it('should handle special characters in search queries', () => {
      const specialQuery = 'docker & kubernetes + containers (2024)'
      const params = encodeFiltersToURL(specialQuery, mockFilters, 'popularity')
      const decoded = decodeFiltersFromURL(params)
      expect(decoded.searchQuery).toBe(specialQuery)
    })

    it('should handle empty strings and null values consistently', () => {
      const params1 = encodeFiltersToURL('', mockFilters, 'popularity')
      const params2 = encodeFiltersToURL('  ', mockFilters, 'popularity')

      expect(params1.get('q')).toBeNull()
      expect(params2.get('q')).toBeNull()
    })

    it('should validate performance with large filter sets', () => {
      const largeFilters: ServiceBrowserFilters = {
        categories: Array.from({ length: 50 }, (_, i) => `category-${i}`),
        subcategories: Array.from({ length: 100 }, (_, i) => `sub-${i}`),
        tags: Array.from({ length: 200 }, (_, i) => `tag-${i}`),
        pricingTypes: ['free', 'freemium', 'paid', 'enterprise'],
        features: Array.from({ length: 150 }, (_, i) => `feature-${i}`),
        integrations: Array.from({ length: 100 }, (_, i) => `integration-${i}`),
        companySize: ['startup', 'small', 'medium', 'large', 'enterprise'],
        minPopularity: 4.0,
        hasFreeTier: true
      }

      const start = performance.now()
      const params = encodeFiltersToURL('performance test', largeFilters, 'alphabetical')
      const encoded = params.toString()
      const decoded = decodeFiltersFromURL(params)
      const end = performance.now()

      expect(end - start).toBeLessThan(50) // Should complete within 50ms
      expect(decoded.filters.categories).toHaveLength(50)
      expect(decoded.filters.tags).toHaveLength(200)
      expect(encoded.length).toBeGreaterThan(1000) // Verify data is present
    })
  })
})