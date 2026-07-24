import { describe, it, expect, afterEach } from 'vitest'
import { resolvePlan, limitsFor, isBillingEnabled, PLAN_LIMITS, SELF_HOST_LIMITS } from '../plans'

const NOW = new Date('2026-07-19T00:00:00Z')
const LATER = new Date('2026-08-19T00:00:00Z')
const EARLIER = new Date('2026-06-19T00:00:00Z')

describe('resolvePlan', () => {
  it('defaults to free for null/unknown/missing plan', () => {
    expect(resolvePlan(null, NOW)).toBe('free')
    expect(resolvePlan({}, NOW)).toBe('free')
    expect(resolvePlan({ plan: 'enterprise' }, NOW)).toBe('free')
  })

  it('keeps a paid plan while planValidUntil is in the future', () => {
    expect(resolvePlan({ plan: 'pro', planValidUntil: LATER }, NOW)).toBe('pro')
    expect(resolvePlan({ plan: 'fleet', planValidUntil: LATER }, NOW)).toBe('fleet')
  })

  it('falls back to free when the paid plan has expired', () => {
    expect(resolvePlan({ plan: 'pro', planValidUntil: EARLIER }, NOW)).toBe('free')
  })

  it('falls back to free when a paid plan has no validUntil', () => {
    expect(resolvePlan({ plan: 'pro', planValidUntil: null }, NOW)).toBe('free')
  })

  it('treats the exact expiry instant as expired (<=)', () => {
    expect(resolvePlan({ plan: 'pro', planValidUntil: NOW }, NOW)).toBe('free')
  })

  it('accepts a string planValidUntil', () => {
    expect(resolvePlan({ plan: 'pro', planValidUntil: LATER.toISOString() }, NOW)).toBe('pro')
  })
})

describe('isBillingEnabled / limitsFor', () => {
  const saved = process.env.BILLING_ENABLED
  afterEach(() => {
    if (saved === undefined) delete process.env.BILLING_ENABLED
    else process.env.BILLING_ENABLED = saved
  })

  it('is disabled unless BILLING_ENABLED === "true"', () => {
    delete process.env.BILLING_ENABLED
    expect(isBillingEnabled()).toBe(false)
    process.env.BILLING_ENABLED = 'false'
    expect(isBillingEnabled()).toBe(false)
    process.env.BILLING_ENABLED = 'true'
    expect(isBillingEnabled()).toBe(true)
  })

  it('returns unlimited self-host limits when billing is disabled (open-core promise)', () => {
    delete process.env.BILLING_ENABLED
    expect(limitsFor({ plan: 'free' }, NOW)).toBe(SELF_HOST_LIMITS)
    // even a "free" user self-hosting gets unlimited stacks + deploy
    expect(limitsFor({ plan: 'free' }, NOW).stacks).toBeNull()
    expect(limitsFor({ plan: 'free' }, NOW).deploy).toBe(true)
  })

  it('returns the resolved plan limits when billing is enabled', () => {
    process.env.BILLING_ENABLED = 'true'
    expect(limitsFor({ plan: 'free' }, NOW)).toEqual(PLAN_LIMITS.free)
    expect(limitsFor({ plan: 'pro', planValidUntil: LATER }, NOW)).toEqual(PLAN_LIMITS.pro)
    // expired pro ⇒ free limits
    expect(limitsFor({ plan: 'pro', planValidUntil: EARLIER }, NOW)).toEqual(PLAN_LIMITS.free)
  })
})
