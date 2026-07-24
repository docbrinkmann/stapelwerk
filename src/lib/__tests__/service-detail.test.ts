import { describe, it, expect } from 'vitest'
import { asArray, portLabel, volumeLabel } from '../service-detail'

describe('asArray', () => {
  it('passes through arrays (services.get pre-parses ports/env)', () => {
    expect(asArray([{ a: 1 }])).toEqual([{ a: 1 }])
  })
  it('parses JSON strings (volumes stay strings)', () => {
    expect(asArray('[{"containerPath":"/data"}]')).toEqual([{ containerPath: '/data' }])
  })
  it('is empty for junk / non-arrays', () => {
    expect(asArray('nope')).toEqual([])
    expect(asArray('{"a":1}')).toEqual([])
    expect(asArray(null)).toEqual([])
  })
})

describe('portLabel', () => {
  it('formats host:container across key conventions', () => {
    expect(portLabel({ host: 8096, container: 8096 })).toBe('8096:8096')
    expect(portLabel({ hostPort: 80, containerPort: 8080 })).toBe('80:8080')
  })
  it('shows just the container port when there is no host mapping', () => {
    expect(portLabel({ containerPort: 5432 })).toBe('5432')
  })
  it('passes through primitives', () => {
    expect(portLabel('8096:8096')).toBe('8096:8096')
  })
})

describe('volumeLabel', () => {
  it('prefers containerPath (the seed shape)', () => {
    expect(volumeLabel({ containerPath: '/var/lib/postgresql/data', named: true })).toBe('/var/lib/postgresql/data')
  })
  it('falls back across key conventions and to strings', () => {
    expect(volumeLabel({ path: '/config' })).toBe('/config')
    expect(volumeLabel('media:/media')).toBe('media:/media')
  })
})
