import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkRateLimit, getClientIdentifier } from '../rate-limiter'

describe('checkRateLimit', () => {
  afterEach(() => vi.useRealTimers())

  it('allows up to the limit, then rejects, then recovers after the window', async () => {
    vi.useFakeTimers()
    const id = `test-${Math.random()}`

    for (let i = 0; i < 100; i++) {
      const r = await checkRateLimit('strict', id)
      expect(r.allowed).toBe(true)
    }
    const rejected = await checkRateLimit('strict', id)
    expect(rejected.allowed).toBe(false)
    expect(rejected.remaining).toBe(0)

    vi.advanceTimersByTime(61_000)
    const recovered = await checkRateLimit('strict', id)
    expect(recovered.allowed).toBe(true)
  })

  it('first request is always allowed with full remaining budget', async () => {
    const r = await checkRateLimit('public', `fresh-${Math.random()}`)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(9_999)
  })
})

describe('getClientIdentifier', () => {
  it('prefers x-forwarded-for first hop', () => {
    expect(
      getClientIdentifier({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
    ).toBe('1.2.3.4')
  })

  it('falls back to remoteAddress', () => {
    expect(getClientIdentifier({ headers: {}, socket: { remoteAddress: '9.9.9.9' } })).toBe('9.9.9.9')
  })
})
