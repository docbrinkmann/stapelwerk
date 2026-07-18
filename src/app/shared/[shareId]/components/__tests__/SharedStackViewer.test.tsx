import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SharedStackViewer from '../SharedStackViewer'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/stores/stack-builder', () => ({
  useStackBuilder: () => ({ importFromJSON: vi.fn(), services: [] }),
}))

const sharedStack: any = {
  id: 's1',
  name: 'Draft Stack',
  description: 'A minimal draft',
  // A draft stack: no tags. Reading `.tags.length` used to crash the page.
  services: [{ id: 1, name: 'PostgreSQL', slug: 'postgresql', category: 'Databases', ports: [5432] }],
  author: { id: 'u1', name: 'Owner' },
  category: 'Databases',
  difficulty: 'beginner',
  isPublic: true,
  allowCloning: true,
  stats: { views: 0, likes: 0, clones: 0, comments: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
  dockerCompose: 'services: {}',
}

describe('SharedStackViewer — thin/draft data', () => {
  it('renders a draft stack with no tags and a related stack missing `services`', () => {
    // relatedStacks item WITHOUT `services` (the old getRelatedStacks shape) —
    // `stack.services.length` used to throw and take down the whole page.
    const relatedStacks: any = [{ id: 's2', name: 'Other', description: 'x', difficulty: 'beginner' }]
    expect(() =>
      render(<SharedStackViewer sharedStack={sharedStack} relatedStacks={relatedStacks} shareId="s1" />),
    ).not.toThrow()
    expect(screen.getAllByText('Draft Stack').length).toBeGreaterThan(0)
  })
})
