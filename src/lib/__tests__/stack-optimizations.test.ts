import { describe, it, expect } from 'vitest'
import {
  categorySlugOf,
  generateStackOptimizations,
  SUGGESTION_LABELS,
} from '@/lib/recommendations/stack-optimizations'

const svc = (category: unknown) => ({ service: { category } })

describe('categorySlugOf — tolerant across the shapes services actually arrive in', () => {
  it('reads the relation object, a plain object, and the flattened name string', () => {
    expect(categorySlugOf({ categories: { slug: 'databases' } })).toBe('databases')
    expect(categorySlugOf({ category: { slug: 'monitoring' } })).toBe('monitoring')
    // services API flattens to the NAME — "Web Servers" must map to web-servers
    expect(categorySlugOf({ category: 'Web Servers' })).toBe('web-servers')
    expect(categorySlugOf({ category: 'Databases' })).toBe('databases')
    expect(categorySlugOf({})).toBeUndefined()
  })
})

describe('generateStackOptimizations — applicable suggestions', () => {
  it('returns nothing for an empty stack', () => {
    expect(generateStackOptimizations([])).toEqual([])
  })

  it('suggests monitoring with concrete addable services when none is present', () => {
    const opts = generateStackOptimizations([svc('Databases')])
    const monitoring = opts.find(o => o.type === 'missing-monitoring')
    expect(monitoring?.suggestedSlugs).toEqual(['prometheus', 'grafana'])
    // every suggested slug has a display label for the one-click button
    for (const slug of monitoring!.suggestedSlugs) {
      expect(SUGGESTION_LABELS[slug]).toBeTruthy()
    }
  })

  it('flags the database security gap via CATEGORY (the old name.includes never matched)', () => {
    // "PostgreSQL" does not contain "database" — the category is what matters.
    const opts = generateStackOptimizations([
      { service: { name: 'PostgreSQL', category: 'Databases' } },
    ])
    expect(opts.some(o => o.type === 'security-gap')).toBe(true)
    // with a security service present the gap disappears
    const withSecurity = generateStackOptimizations([
      { service: { category: 'Databases' } },
      { service: { category: 'Security' } },
    ])
    expect(withSecurity.some(o => o.type === 'security-gap')).toBe(false)
  })

  it('suggests a reverse proxy only for >5 services without web-servers', () => {
    const five = Array.from({ length: 5 }, () => svc('Media'))
    expect(generateStackOptimizations(five).some(o => o.type === 'reverse-proxy')).toBe(false)
    const six = Array.from({ length: 6 }, () => svc('Media'))
    expect(generateStackOptimizations(six).some(o => o.type === 'reverse-proxy')).toBe(true)
    const sixWithProxy = [...Array.from({ length: 5 }, () => svc('Media')), svc('Web Servers')]
    expect(generateStackOptimizations(sixWithProxy).some(o => o.type === 'reverse-proxy')).toBe(false)
  })
})
