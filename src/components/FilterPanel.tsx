import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useServiceBrowserStore } from '@/stores/service-browser'
import { api } from '@/trpc/client'
import './FilterPanel.css'

interface FilterPanelProps {
  className?: string
  isCollapsible?: boolean
  defaultExpanded?: boolean
  categories?: { name: string; count: number }[]
}

// Fallback category list used only when the live category API is unavailable
// (e.g. in unit tests). Ids must be real DB slugs so the backend filter matches.
const CATEGORIES = [
  { id: 'development', label: 'Development' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'database', label: 'Database' },
  { id: 'communication', label: 'Communication' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'security', label: 'Security' },
  { id: 'design', label: 'Design' },
]

// Sort options backed by real service data. No fake "rating" — services carry
// Docker-Hub popularity, a name, and a created-at date; nothing more to sort on.
const SORT_OPTIONS = [
  { id: 'popularity', label: 'Most Popular' },
  { id: 'alphabetical', label: 'A-Z' },
  { id: 'alphabetical_desc', label: 'Z-A' },
  { id: 'recently_added', label: 'Recently Added' },
]

export const FilterPanel: React.FC<FilterPanelProps> = ({
  className = '',
  isCollapsible = false,
  defaultExpanded = true,
  categories: categoryCounts = [],
}) => {
  const {
    activeFilters,
    sortBy,
    setCategories,
    setSortBy,
    resetFilters,
    getActiveFilterCount,
    uiState,
    searchQuery,
  } = useServiceBrowserStore()

  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Live categories from the API (ids must be real DB slugs so the backend
  // `slug in categories` filter matches). Falls back to the static list.
  const [liveCategories, setLiveCategories] = useState<{ id: string; label: string }[]>([])
  useEffect(() => {
    let alive = true
    api.categories.list
      .query({ limit: 100 })
      .then((res) => {
        if (!alive) return
        const options = (res?.categories ?? []).map((c: { slug: string; name: string }) => ({
          id: c.slug,
          label: c.name,
        }))
        if (options.length > 0) setLiveCategories(options)
      })
      .catch(() => {
        // Keep static fallback when the API is unavailable (e.g. in tests)
      })
    return () => {
      alive = false
    }
  }, [])
  const categoryList = liveCategories.length > 0 ? liveCategories : CATEGORIES

  const activeFilterCount = useMemo(() => {
    // The store owns the counting logic; the fallback covers partial/mocked stores
    if (typeof getActiveFilterCount === 'function') return getActiveFilterCount()
    let count = 0
    const f = activeFilters as any
    if (!f) return count
    if (Array.isArray(f.categories)) count += f.categories.length
    if (searchQuery && searchQuery.length) count++
    return count
  }, [activeFilters, searchQuery, getActiveFilterCount])
  const [announcement, setAnnouncement] = useState('')

  const disabled = uiState.isLoading === true
  const categoryCountMap = useMemo(() => {
    const map = new Map<string, number>()
    categoryCounts?.forEach(c => map.set(c.name, c.count))
    return map
  }, [categoryCounts])

  const handleCategoryToggle = useCallback((categoryId: string) => {
    const current = activeFilters.categories ?? []
    const newCategories = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId]
    setCategories(newCategories)
  }, [activeFilters.categories, setCategories])

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as any)
  }, [setSortBy])

  const handleResetFilters = useCallback(() => {
    resetFilters()
  }, [resetFilters])

  const toggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded)
  }, [isExpanded])

  // Announce filter updates with result count
  React.useEffect(() => {
    setAnnouncement(`Filters updated`)
  }, [activeFilters, sortBy])

  return (
    <div className={`filter-panel ${className}`} role="region" aria-label="Service filters">
      {/* Loading state */}
      {disabled && (
        <div className="filter-panel__loading" aria-label="Loading filters...">Loading filters...</div>
      )}

      {/* Error state */}
      {uiState?.error != null && (
        <div className="filter-panel__error" role="alert">
          Unable to load filters. Please refresh the page.
        </div>
      )}

      {/* Live region for announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" id="filters-announcement">
        {announcement}
      </div>

      <div className="filter-panel__header">
        <div className="filter-panel__title-section">
          <h2 className="filter-panel__title">Filters</h2>
          {activeFilterCount > 0 && (
            <span className="filter-panel__count" aria-label={`${activeFilterCount} active filters`}>
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="filter-panel__actions">
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="filter-panel__reset-button"
              onClick={handleResetFilters}
              aria-label="Clear all filters"
            >
              Clear all filters
            </button>
          )}

          {/* Unified toggle for mobile testing */}
          <button
            type="button"
            className={`filter-panel__toggle ${isExpanded ? 'filter-panel__toggle--expanded' : ''}`}
            onClick={toggleExpanded}
            aria-label="Toggle filters"
            aria-expanded={isExpanded}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`filter-panel__content ${!isExpanded ? 'filter-panel__content--collapsed' : ''}`}
        data-testid="filter-content"
      >
        {/* Sort Options */}
        <div className="filter-panel__section">
          <label htmlFor="sort-select" className="filter-panel__section-title">
            Sort by
          </label>
          <select
            id="sort-select"
            className="filter-panel__sort-select"
            value={sortBy}
            onChange={handleSortChange}
            aria-label="Sort services by"
            disabled={disabled}
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Categories */}
        <fieldset className="filter-panel__section">
          <legend id="categories-title" className="filter-panel__section-title">Categories</legend>
          <div className="filter-panel__checkbox-group" aria-labelledby="categories-title">
            {categoryList.map(category => (
              <label key={category.id} className="filter-panel__checkbox-label">
                <input
                  type="checkbox"
                  className="filter-panel__checkbox"
                  checked={(activeFilters.categories ?? []).includes(category.id)}
                  onChange={() => handleCategoryToggle(category.id)}
                  aria-describedby={`category-${category.id}-description`}
                  disabled={disabled}
                />
                <span className="filter-panel__checkbox-text">{category.label}</span>
                {categoryCountMap.has(category.id) && (
                  <span className="filter-panel__count-badge">{categoryCountMap.get(category.id)}</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

    </div>
  )
}
