import { describe, it, expect, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'

// Same in-memory harness the other tRPC tests use.
const prisma: any = new PrismaClient()

const createCaller = async (userId?: string) => {
  const ctx = await createTRPCContext({ userId, req: {} as any, res: {} as any })
  return appRouter.createCaller(ctx)
}

let seq = 0
async function makeStack(userId: string) {
  const id = `stk-${Date.now()}-${seq++}`
  await prisma.stacks.create({
    data: { id, name: 'S', slug: id, userId, status: 'draft', updatedAt: new Date() },
  })
  return id
}

describe('stacks env vars persistence', () => {
  beforeEach(async () => {
    await prisma.stacks.deleteMany({})
  })

  it('persists env vars set by the owner and reads them back', async () => {
    const caller = await createCaller('u1')
    const stackId = await makeStack('u1')
    await caller.stacks.setEnvVars({
      stackId,
      envVars: [
        { key: 'FOO', value: 'bar', isSecret: false },
        { key: 'TOKEN', value: 's3cr3t', isSecret: true },
      ],
    })
    const got = await caller.stacks.getEnvVars({ stackId })
    expect(got).toEqual([
      { key: 'FOO', value: 'bar', isSecret: false },
      { key: 'TOKEN', value: 's3cr3t', isSecret: true },
    ])
  })

  it('defaults to an empty list for a new stack', async () => {
    const caller = await createCaller('u1')
    const stackId = await makeStack('u1')
    expect(await caller.stacks.getEnvVars({ stackId })).toEqual([])
  })

  it('rejects a non-owner from reading or writing', async () => {
    await makeStack('u1')
    const stackId = await makeStack('u1')
    const intruder = await createCaller('u2')
    await expect(intruder.stacks.getEnvVars({ stackId })).rejects.toBeTruthy()
    await expect(
      intruder.stacks.setEnvVars({ stackId, envVars: [{ key: 'X', value: 'y', isSecret: false }] }),
    ).rejects.toBeTruthy()
  })
})
