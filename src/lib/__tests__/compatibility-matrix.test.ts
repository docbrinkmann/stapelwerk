import { describe, it, expect } from 'vitest'
import { COMPATIBILITY_MATRIX, areIncompatible } from '@/lib/recommendations/compatibility-matrix'

describe('compatibility matrix', () => {
  it('declares the reverse proxies mutually incompatible (all bind host :80)', () => {
    const proxies = ['nginx', 'httpd', 'caddy', 'traefik', 'haproxy']
    for (const a of proxies) {
      for (const b of proxies) {
        if (a === b) continue
        expect(areIncompatible(a, b)).toBe(true)
      }
    }
  })

  it('treats compatible/unrelated pairs as not incompatible', () => {
    expect(areIncompatible('nginx', 'postgresql')).toBe(false)
    expect(areIncompatible('postgresql', 'redis')).toBe(false)
    expect(areIncompatible('nginx', 'nginx')).toBe(false)
    expect(areIncompatible('unknown-a', 'unknown-b')).toBe(false)
  })

  it('is symmetric even when only one side declares the pair', () => {
    // nginx lists caddy in incompatibleWith; the check must work both ways.
    expect(areIncompatible('caddy', 'nginx')).toBe(areIncompatible('nginx', 'caddy'))
  })

  it('keeps the existing recommendation relationships intact', () => {
    expect(COMPATIBILITY_MATRIX.postgresql.compatibleWith).toContain('pgadmin')
    expect(COMPATIBILITY_MATRIX.nginx.compatibleWith).toContain('postgresql')
    expect(COMPATIBILITY_MATRIX.plex.compatibleWith).toContain('sonarr')
  })
})
