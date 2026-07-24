import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'
import { isPlanLimitError } from '@/lib/billing/enforcement'

/**
 * Group 2 enforcement wiring: the stack-count gate fires when billing is
 * enabled and is inert when it isn't (the self-host / open-core promise).
 */
const prisma: any = new PrismaClient()

const createCaller = async (userId: string) => {
  const ctx = await createTRPCContext({ userId, req: {} as any, res: {} as any })
  return appRouter.createCaller(ctx)
}

const cleanup = async () => {
  await prisma.stacks.deleteMany({})
  await prisma.users.deleteMany({})
}

const savedBilling = process.env.BILLING_ENABLED
beforeEach(cleanup)
afterEach(async () => {
  await cleanup()
  if (savedBilling === undefined) delete process.env.BILLING_ENABLED
  else process.env.BILLING_ENABLED = savedBilling
})

describe('billing gate: stacks.create', () => {
  it('billing enabled + free plan: 2 stacks ok, 3rd throws PLAN_LIMIT', async () => {
    process.env.BILLING_ENABLED = 'true'
    await prisma.users.create({ data: { id: 'u1', email: 'u1@x.co', plan: 'free', updatedAt: new Date() } })
    const caller = await createCaller('u1')

    await caller.stacks.create({ name: 'One', services: [], isPublic: false })
    await caller.stacks.create({ name: 'Two', services: [], isPublic: false })

    let caught: unknown
    try {
      await caller.stacks.create({ name: 'Three', services: [], isPublic: false })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeTruthy()
    expect(isPlanLimitError(caught)).toBe(true)
    expect((caught as { cause: { limit: number } }).cause.limit).toBe(2)
  })

  it('billing disabled: 3+ stacks succeed (self-host, gate inert)', async () => {
    delete process.env.BILLING_ENABLED
    await prisma.users.create({ data: { id: 'u2', email: 'u2@x.co', plan: 'free', updatedAt: new Date() } })
    const caller = await createCaller('u2')

    await caller.stacks.create({ name: 'Alpha', services: [], isPublic: false })
    await caller.stacks.create({ name: 'Bravo', services: [], isPublic: false })
    const third = await caller.stacks.create({ name: 'Charlie', services: [], isPublic: false })
    expect(third).toBeTruthy()
  })

  it('billing enabled + pro plan: past the free limit succeeds', async () => {
    process.env.BILLING_ENABLED = 'true'
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    await prisma.users.create({ data: { id: 'u3', email: 'u3@x.co', plan: 'pro', planValidUntil: future, updatedAt: new Date() } })
    const caller = await createCaller('u3')

    for (const n of ['1', '2', '3', '4']) {
      await caller.stacks.create({ name: `Stack ${n}`, services: [], isPublic: false })
    }
    const count = await prisma.stacks.count({ where: { userId: 'u3' } })
    expect(count).toBe(4)
  })
})
