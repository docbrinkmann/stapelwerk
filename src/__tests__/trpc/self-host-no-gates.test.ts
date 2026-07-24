import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'
import {
  effectivePlan,
  assertDeployCapability,
  assertRemoteTargetLimit,
  assertStackLimit,
} from '@/lib/billing/enforcement'
import { SELF_HOST_LIMITS } from '@/lib/plans'

/**
 * The open-core promise, proven in code: with BILLING_ENABLED unset a build has
 * ZERO plan gates — unlimited stacks, deploy, remote targets, terminal — and it
 * never reads any billing state. This is the self-host guarantee the AGPL
 * release depends on.
 */
const prisma: any = new PrismaClient()

const createCaller = async (userId: string) => {
  const ctx = await createTRPCContext({ userId, req: {} as any, res: {} as any })
  return appRouter.createCaller(ctx)
}

const savedBilling = process.env.BILLING_ENABLED
beforeEach(async () => {
  delete process.env.BILLING_ENABLED // self-host: billing disabled
  await prisma.stacks.deleteMany({})
  await prisma.users.deleteMany({})
})
afterEach(async () => {
  await prisma.stacks.deleteMany({})
  await prisma.users.deleteMany({})
  if (savedBilling === undefined) delete process.env.BILLING_ENABLED
  else process.env.BILLING_ENABLED = savedBilling
})

describe('self-host: no gates when BILLING_ENABLED is unset', () => {
  it('creates well past the free stack limit (5 stacks) without a gate', async () => {
    await prisma.users.create({ data: { id: 'sh', email: 'sh@x.co', plan: 'free', updatedAt: new Date() } })
    const caller = await createCaller('sh')
    for (const n of ['One', 'Two', 'Three', 'Four', 'Five']) {
      await caller.stacks.create({ name: `Stack ${n}`, services: [], isPublic: false })
    }
    expect(await prisma.stacks.count({ where: { userId: 'sh' } })).toBe(5)
  })

  it('grants unlimited capability limits and never reads the plan', async () => {
    // A fake prisma whose users.findUnique would throw if the gate ever read it.
    const trap = {
      users: {
        findUnique: async () => {
          throw new Error('self-host must not read billing/plan state')
        },
      },
    }
    const ep = await effectivePlan(trap, 'sh')
    expect(ep.limits).toBe(SELF_HOST_LIMITS)
    expect(ep.plan).toBeNull()

    // Every gate is a no-op on self-host.
    expect(() => assertStackLimit(ep, 9999)).not.toThrow()
    expect(() => assertRemoteTargetLimit(ep, 9999)).not.toThrow()
    expect(() => assertDeployCapability(ep)).not.toThrow()
  })
})
