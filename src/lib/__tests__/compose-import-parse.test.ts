import { describe, it, expect } from 'vitest'
import { parseImageRef, parseComposePort } from '../stack-persistence'

// A naive image.split(':') / parseInt(host) mis-parses real compose files:
// registry ports, digests, and ip-qualified port bindings.
describe('parseImageRef', () => {
  it('splits image:tag', () => {
    expect(parseImageRef('nginx:1.25-alpine')).toEqual({ image: 'nginx', tag: '1.25-alpine' })
  })
  it('keeps a registry port out of the tag', () => {
    expect(parseImageRef('registry.example.com:5000/nginx')).toEqual({
      image: 'registry.example.com:5000/nginx',
      tag: 'latest',
    })
    expect(parseImageRef('registry.example.com:5000/nginx:1.2')).toEqual({
      image: 'registry.example.com:5000/nginx',
      tag: '1.2',
    })
  })
  it('drops a digest', () => {
    expect(parseImageRef('nginx@sha256:abcdef')).toEqual({ image: 'nginx', tag: 'latest' })
    expect(parseImageRef('nginx:1.2@sha256:abcdef')).toEqual({ image: 'nginx', tag: '1.2' })
  })
  it('defaults the tag', () => {
    expect(parseImageRef('postgres')).toEqual({ image: 'postgres', tag: 'latest' })
  })
})

describe('parseComposePort', () => {
  it('parses host:container', () => {
    expect(parseComposePort('8080:80')).toEqual({ host: 8080, container: 80 })
  })
  it('ignores the ip in ip:host:container (was parseInt-garbage)', () => {
    expect(parseComposePort('127.0.0.1:8080:80')).toEqual({ host: 8080, container: 80 })
  })
  it('handles a bare container port and a protocol suffix', () => {
    expect(parseComposePort('80')).toEqual({ host: 80, container: 80 })
    expect(parseComposePort('80/udp')).toEqual({ host: 80, container: 80 })
  })
  it('handles the long-form object', () => {
    expect(parseComposePort({ target: 80, published: 8080 })).toEqual({ host: 8080, container: 80 })
    expect(parseComposePort({ target: 5432 })).toEqual({ host: 5432, container: 5432 })
  })
  it('returns null for junk', () => {
    expect(parseComposePort('nonsense')).toBeNull()
    expect(parseComposePort({})).toBeNull()
  })
})
