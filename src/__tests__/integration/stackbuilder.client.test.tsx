import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock analytics (accesses localStorage at import time)
vi.mock('@/lib/analytics/recommendation-analytics', () => ({
  RecommendationAnalyticsService: class {
    initialize() {}
    trackEvent() {}
  },
  useRecommendationAnalytics: () => ({
    initialize: () => {},
    trackEvent: () => {},
  }),
}))

// Mocks before importing component
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<any>('@tanstack/react-query')
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

vi.mock('@/store/service-browser', () => ({
  useServiceBrowserStore: () => ({
    searchQuery: '',
    activeFilters: { categories: [], tags: [], pricingTypes: [] },
    syncFromUrl: () => {},
    viewMode: 'grid',
    setViewMode: () => {},
  })
}))
vi.mock('@/stores/stack-builder', () => ({
  useStackServices: () => ({ services: [], clearStack: () => {}, exportDockerCompose: () => '', getStackValidationErrors: () => [] }),
  useStackPersistence: () => ({ isDirty: false, hasChanges: false, lastSaved: null, autoSaveEnabled: false, saveAsDraft: () => {}, startAutoSave: () => {}, stopAutoSave: () => {}, loadStack: () => {} }),
}))

// Stub heavy children
vi.mock('@/components/ServicePreviewModal', () => ({ ServicePreviewModal: () => <div /> }))
vi.mock('@/components/stack-configuration/StackCanvas', () => ({ StackCanvas: () => <div /> }))
vi.mock('@/components/SaveStackModal', () => ({ SaveStackModal: () => <div /> }))
vi.mock('@/components/modals/ShareStackModal', () => ({ default: () => <div /> }))
vi.mock('@/components/modals/SubmitTemplateModal', () => ({ default: () => <div /> }))
vi.mock('@/components/recommendations/RecommendationEngine', () => ({ RecommendationEngine: () => <div /> }))

// Also stub non-critical UI components referenced by imports
vi.mock('@/components/SearchBar', () => ({ SearchBar: () => <div>Search services</div> }))
vi.mock('@/components/FilterPanel', () => ({ FilterPanel: (p: any) => <div role="region" aria-label="Service filters" /> }))
vi.mock('@/components/ServiceGrid', () => ({ ServiceGrid: () => <div /> }))

import { StackBuilderClient } from '@/app/stack-builder/components/StackBuilderClient'

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<any>('@tanstack/react-query')
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

vi.mock('@/store/service-browser', () => ({
  useServiceBrowserStore: () => ({
    searchQuery: '',
    activeFilters: { categories: [], tags: [], pricingTypes: [] },
    syncFromUrl: () => {},
    viewMode: 'grid',
    setViewMode: () => {},
  })
}))
vi.mock('@/stores/stack-builder', () => ({
  useStackServices: () => ({ services: [], clearStack: () => {}, exportDockerCompose: () => '', getStackValidationErrors: () => [] }),
  useStackPersistence: () => ({ isDirty: false, hasChanges: false, lastSaved: null, autoSaveEnabled: false, saveAsDraft: () => {}, startAutoSave: () => {}, stopAutoSave: () => {}, loadStack: () => {} }),
}))

// Stub heavy children
vi.mock('@/components/ServicePreviewModal', () => ({ ServicePreviewModal: () => <div /> }))
vi.mock('@/components/stack-configuration/StackCanvas', () => ({ StackCanvas: () => <div /> }))
vi.mock('@/components/SaveStackModal', () => ({ SaveStackModal: () => <div /> }))
vi.mock('@/components/modals/ShareStackModal', () => ({ default: () => <div /> }))
vi.mock('@/components/modals/SubmitTemplateModal', () => ({ default: () => <div /> }))

// Also stub non-critical UI components referenced by imports
vi.mock('@/components/SearchBar', () => ({ SearchBar: () => <div>Search services</div> }))
vi.mock('@/components/FilterPanel', () => ({ FilterPanel: (p: any) => <div role="region" aria-label="Service filters" /> }))
vi.mock('@/components/ServiceGrid', () => ({ ServiceGrid: () => <div /> }))


describe('StackBuilderClient', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) },
      key: (i: number) => Object.keys(store)[i] || null,
      length: 0,
    }
  })
it('renders filter region and search bar', () => {
    render(<StackBuilderClient />)
    expect(screen.getByText(/Search services/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Service filters/i })).toBeInTheDocument()
  })
})