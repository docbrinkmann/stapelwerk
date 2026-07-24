import { describe, it, expect, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'

const prisma: any = new PrismaClient()

const createCaller = async (userId?: string) => {
  const ctx = await createTRPCContext({ userId, req: {} as any, res: {} as any })
  return appRouter.createCaller(ctx)
}

const publicStack = (id: string, userId: string, importCount = 0) => ({
  id, name: id, slug: id, status: 'public', isPublic: true, userId, importCount, updatedAt: new Date(),
})

describe('community import tracking', () => {
  beforeEach(async () => {
    await prisma.stacks.deleteMany({})
  })

  it('increments importCount on each trackImport', async () => {
    const caller = await createCaller()
    await prisma.stacks.create({ data: publicStack('s1', 'u1') })
    await caller.community.trackImport({ stackId: 's1' })
    await caller.community.trackImport({ stackId: 's1' })
    const s = await prisma.stacks.findUnique({ where: { id: 's1' } })
    expect(s?.importCount).toBe(2)
  })

  it('reports total downloads as the real sum of importCount over public stacks', async () => {
    const caller = await createCaller()
    await prisma.stacks.create({ data: publicStack('a', 'u1', 3) })
    await prisma.stacks.create({ data: publicStack('b', 'u2', 4) })
    // Private stack must NOT count toward marketplace downloads.
    await prisma.stacks.create({
      data: { id: 'c', name: 'c', slug: 'c', status: 'draft', isPublic: false, userId: 'u1', importCount: 99, updatedAt: new Date() },
    })
    const stats = await caller.community.getMarketplaceStats()
    expect(stats.totalDownloads).toBe(7)
  })
})
