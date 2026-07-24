import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'

// Mock trpc client hooks used by CommunityMarketplace
vi.mock('@/utils/trpc', () => ({
  trpc: {
    community: {
      searchStacks: { useQuery: () => ({ data: [], isLoading: false }) },
      trackImport: { useMutation: () => ({ mutate: () => {} }) },
    },
  },
}))

import CommunityMarketplace from '@/app/community/components/CommunityMarketplace'

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<any>('@tanstack/react-query')
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

const sampleStack = (overrides: Partial<any> = {}) => ({
  id: 's1',
  name: 'Nginx + Postgres',
  description: 'Web stack',
  category: 'web',
  difficulty: 'beginner',
  tags: ['web', 'db'],
  services: [{ id: 1 }, { id: 2 }],
  author: { id: 'u1', name: 'Alice' },
  stats: { views: 10, likes: 2, downloads: 3, rating: 4.2, reviewCount: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('CommunityMarketplace', () => {
  it('renders featured and popular stacks', () => {
    render(
      <CommunityMarketplace
        initialFeatured={[sampleStack({ id: 'f1', name: 'Featured' })]}
        initialPopular={[sampleStack({ id: 'p1', name: 'Popular' })]}
        categories={["web", "database"]}
        marketplaceStats={{ totalStacks: 1, totalDownloads: 3, activeContributors: 1, featuredStacks: 1 }}
      />
    )

expect(screen.getAllByText(/Featured/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Popular/i).length).toBeGreaterThan(0)
  })

  // Regression: the server passes RAW tRPC rows (stack_services + importCount,
  // no stats/tags). Rendering one used to crash on `stats.views` — the first
  // real approved community stack took down /community.
  it('renders raw tRPC rows (real DB shape) without crashing', () => {
    const rawRow = {
      id: 'r1',
      name: 'Demo: Nextcloud + Postgres',
      description: 'Self-hosted cloud',
      userId: 'u1',
      importCount: 2,
      isTemplate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      stack_services: [
        { services: { id: 1, name: 'Nextcloud', slug: 'nextcloud', categories: { name: 'Storage', slug: 'storage' } } },
        { services: { id: 2, name: 'PostgreSQL', slug: 'postgresql', categories: { name: 'Database', slug: 'database' } } },
      ],
      _count: { stack_services: 2 },
    }

    render(
      <CommunityMarketplace
        initialFeatured={[rawRow as any]}
        initialPopular={[]}
        categories={['Storage']}
        marketplaceStats={{ totalStacks: 1, totalDownloads: 2, activeContributors: 1, featuredStacks: 1 }}
      />
    )

    expect(screen.getAllByText(/Demo: Nextcloud \+ Postgres/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2 services/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2 imports/i).length).toBeGreaterThan(0)
  })
})