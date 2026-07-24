import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RecommendationService } from '@/server/services/recommendation-service'

// Mirrors src/__tests__/recommendations/recommendation-service.test.ts — the
// service only needs a prisma stub for these pure scoring checks.
vi.mock('@prisma/client')

describe('RecommendationService — incompatibleWith scoring', () => {
  let service: RecommendationService

  beforeEach(() => {
    const mockPrisma = {
      service: { findMany: vi.fn(), findUnique: vi.fn() },
      stackService: { count: vi.fn().mockResolvedValue(0) },
    } as any
    service = new RecommendationService(mockPrisma)
  })

  it('scores an incompatible reverse-proxy pair below a compatible pair', () => {
    const stack = [{ serviceId: 1, service: { slug: 'nginx' } }] as any

    const incompatible = service.calculateCompatibilityScore(
      { id: 2, slug: 'caddy' } as any,
      stack
    )
    const compatible = service.calculateCompatibilityScore(
      { id: 3, slug: 'grafana' } as any,
      stack
    )

    // caddy vs nginx is declared incompatible -> negative contribution -> 0.
    expect(incompatible).toBe(0)
    // grafana is in nginx.compatibleWith -> full compatibility.
    expect(compatible).toBeGreaterThan(incompatible)
  })

  it('is bidirectional: the negative applies whether the entry is on the candidate or the stack service', () => {
    // traefik has its own incompatibleWith entry listing nginx.
    const stackWithNginx = [{ serviceId: 1, service: { slug: 'nginx' } }] as any
    const traefikVsNginx = service.calculateCompatibilityScore(
      { id: 4, slug: 'traefik' } as any,
      stackWithNginx
    )
    expect(traefikVsNginx).toBe(0)
  })
})
