import { describe, it, expect } from 'vitest'
import { effectiveImageRef } from '@/lib/updates/effective-image'

const svc = (dockerImage: string, imageTag?: string): any => ({
  service: { dockerImage },
  configuration: { imageTag },
})

describe('effectiveImageRef — override-aware image ref (so applied updates clear)', () => {
  it('returns the catalog image when there is no override', () => {
    expect(effectiveImageRef(svc('postgres:18-alpine'))).toBe('postgres:18-alpine')
  })

  it('swaps the tag when an override is set', () => {
    expect(effectiveImageRef(svc('postgres:18-alpine', '18.4-alpine'))).toBe('postgres:18.4-alpine')
  })

  it('keeps a registry with a port, only replacing the tag', () => {
    expect(effectiveImageRef(svc('registry:5000/app:1.0', '1.1'))).toBe('registry:5000/app:1.1')
  })

  it('drops a digest when applying the override tag', () => {
    expect(effectiveImageRef(svc('nginx@sha256:abc', '1.27'))).toBe('nginx:1.27')
  })

  it('returns undefined without a dockerImage', () => {
    expect(effectiveImageRef({ service: {} as any, configuration: {} as any })).toBeUndefined()
  })
})
