import { describe, it, expect, beforeEach } from 'vitest'
import { isLockedOut, recordFailure, recordSuccess, _resetThrottle } from '../auth-throttle'

describe('auth-throttle', () => {
  beforeEach(() => _resetThrottle())

  it('is not locked out before the failure threshold', () => {
    const t = 1_000_000
    for (let i = 0; i < 4; i++) recordFailure('a@b.co', t)
    expect(isLockedOut('a@b.co', t)).toBe(false)
  })

  it('locks out after 5 failures within the window', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) recordFailure('a@b.co', t)
    expect(isLockedOut('a@b.co', t)).toBe(true)
  })

  it('normalizes the email key (case/whitespace)', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) recordFailure('  A@B.co ', t)
    expect(isLockedOut('a@b.co', t)).toBe(true)
  })

  it('clears the counter on success', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) recordFailure('a@b.co', t)
    recordSuccess('a@b.co')
    expect(isLockedOut('a@b.co', t)).toBe(false)
  })

  it('expires the lockout after the window elapses since the last failure', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) recordFailure('a@b.co', t)
    expect(isLockedOut('a@b.co', t + 15 * 60 * 1000 + 1)).toBe(false)
  })
})
