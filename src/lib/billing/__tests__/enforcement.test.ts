import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  effectivePlan,
  assertStackLimit,
  assertRemoteTargetLimit,
  assertDeployCapability,
  isPlanLimitError,
  planLimitError,
} from '../enforcement'
import { SELF_HOST_LIMITS, PLAN_LIMITS } from '@/lib/plans'

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000)

function fakePrisma(user: { plan?: string; planValidUntil?: Date } | null) {
  return { users: { findUnique: vi.fn(async () => user) } }
}

const savedEnv = process.env.BILLING_ENABLED
afterEach(() => {
  if (savedEnv === undefined) delete process.env.BILLING_ENABLED
  else process.env.BILLING_ENABLED = savedEnv
  vi.restoreAllMocks()
})

describe('effectivePlan', () => {
  it('returns unlimited self-host limits and never reads the DB when billing is disabled', async () => {
    delete process.env.BILLING_ENABLED
    const prisma = fakePrisma({ plan: 'free' })
    const ep = await effectivePlan(prisma, 'u1')
    expect(ep.limits).toBe(SELF_HOST_LIMITS)
    expect(ep.plan).toBeNull()
    expect(prisma.users.findUnique).not.toHaveBeenCalled() // no billing read on self-host
  })

  it('resolves the DB plan when billing is enabled', async () => {
    process.env.BILLING_ENABLED = 'true'
    const ep = await effectivePlan(fakePrisma({ plan: 'pro', planValidUntil: FUTURE }), 'u1')
    expect(ep.plan).toBe('pro')
    expect(ep.limits).toEqual(PLAN_LIMITS.pro)
  })
})

describe('assertStackLimit', () => {
  it('throws PLAN_LIMIT at the limit, passes under it', () => {
    const ep = { plan: 'free' as const, limits: PLAN_LIMITS.free }
    expect(() => assertStackLimit(ep, 1)).not.toThrow()
    let caught: unknown
    try { assertStackLimit(ep, 2) } catch (e) { caught = e }
    expect(isPlanLimitError(caught)).toBe(true)
    expect((caught as { cause: { limit: number } }).cause.limit).toBe(2)
  })

  it('never throws for unlimited (null) stacks', () => {
    const ep = { plan: null, limits: SELF_HOST_LIMITS }
    expect(() => assertStackLimit(ep, 9999)).not.toThrow()
  })
})

describe('assertRemoteTargetLimit', () => {
  it('free (0 targets) throws immediately', () => {
    let caught: unknown
    try { assertRemoteTargetLimit({ plan: 'free', limits: PLAN_LIMITS.free }, 0) } catch (e) { caught = e }
    expect(isPlanLimitError(caught)).toBe(true)
  })

  it('pro allows up to 2', () => {
    const ep = { plan: 'pro' as const, limits: PLAN_LIMITS.pro }
    expect(() => assertRemoteTargetLimit(ep, 1)).not.toThrow()
    expect(() => assertRemoteTargetLimit(ep, 2)).toThrow()
  })

  it('self-host (Infinity) never throws', () => {
    expect(() => assertRemoteTargetLimit({ plan: null, limits: SELF_HOST_LIMITS }, 1000)).not.toThrow()
  })
})

describe('assertDeployCapability', () => {
  it('free cannot deploy, pro can, self-host can', () => {
    expect(() => assertDeployCapability({ plan: 'free', limits: PLAN_LIMITS.free })).toThrow()
    expect(() => assertDeployCapability({ plan: 'pro', limits: PLAN_LIMITS.pro })).not.toThrow()
    expect(() => assertDeployCapability({ plan: null, limits: SELF_HOST_LIMITS })).not.toThrow()
  })
})

describe('planLimitError shape', () => {
  it('is a FORBIDDEN TRPCError carrying the PLAN_LIMIT cause', () => {
    const err = planLimitError({ plan: 'free', limit: 2, message: 'nope' })
    expect(err.code).toBe('FORBIDDEN')
    expect(isPlanLimitError(err)).toBe(true)
    expect((err.cause as { plan: string }).plan).toBe('free')
  })
})
