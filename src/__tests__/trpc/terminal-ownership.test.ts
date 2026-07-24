import { describe, it, expect, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'

const prisma: any = new PrismaClient()

const createCaller = async (userId?: string) =>
  appRouter.createCaller(await createTRPCContext({ userId, req: {} as any, res: {} as any }))

describe('terminal.create ownership', () => {
  beforeEach(async () => {
    await prisma.terminal_sessions.deleteMany({})
    await prisma.stacks.deleteMany({})
  })

  it('lets the stack owner open a terminal session', async () => {
    await prisma.stacks.create({ data: { id: 's1', name: 'S', slug: 's1', userId: 'u1', status: 'draft', updatedAt: new Date() } })
    const caller = await createCaller('u1')
    const session = await caller.terminal.create({ stackId: 's1' })
    expect(session.stackId).toBe('s1')
  })

  it('rejects a non-owner with FORBIDDEN', async () => {
    await prisma.stacks.create({ data: { id: 's2', name: 'S', slug: 's2', userId: 'u1', status: 'draft', updatedAt: new Date() } })
    const intruder = await createCaller('u2')
    await expect(intruder.terminal.create({ stackId: 's2' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
