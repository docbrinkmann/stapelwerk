import { describe, it, expect, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'

const prisma: any = new PrismaClient()

const userCaller = async (userId: string) =>
  appRouter.createCaller(await createTRPCContext({ userId, req: {} as any, res: {} as any }))
const adminCaller = async () =>
  appRouter.createCaller(
    await createTRPCContext({ user: { id: 'admin-1', role: 'admin' }, req: {} as any, res: {} as any }),
  )

// A valid v4 UUID for GetByIdSchema-gated procedures.
const JOB_ID = '3385f27f-6928-4f77-9cb8-a68b109481e3'

describe('authorization hardening', () => {
  beforeEach(async () => {
    await prisma.deployment_jobs.deleteMany({})
    await prisma.stacks.deleteMany({})
    await prisma.categories.deleteMany({})
  })

  it('logs.list rejects a non-owner (was an IDOR by stackId)', async () => {
    await prisma.stacks.create({ data: { id: 's1', name: 'S', slug: 's1', userId: 'owner', status: 'draft', updatedAt: new Date() } })
    const intruder = await userCaller('intruder')
    await expect(intruder.logs.list({ stackId: 's1' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('deployments.getJobLogs rejects a non-owner (was an IDOR by job UUID)', async () => {
    await prisma.stacks.create({ data: { id: 's2', name: 'S', slug: 's2', userId: 'owner', status: 'draft', updatedAt: new Date() } })
    await prisma.deployment_jobs.create({ data: { id: JOB_ID, mode: 'apply', status: 'succeeded', logs: '[]', stackId: 's2', updatedAt: new Date() } })
    const intruder = await userCaller('intruder')
    await expect(intruder.deployments.getJobLogs({ id: JOB_ID })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('catalog/category mutations require an admin (were publicProcedure)', async () => {
    const user = await userCaller('u1')
    await expect(user.categories.create({ name: 'X', slug: 'x', description: 'd' } as any)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(user.services.update({ id: 1, dockerImage: 'evil/x:latest' } as any)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(user.templates.delete({ id: 't1' } as any)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(user.imports.approve({ id: 'i1' } as any)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('an admin passes the gate (not FORBIDDEN)', async () => {
    const admin = await adminCaller()
    let code: string | undefined
    try {
      await admin.categories.create({ name: 'Cat', slug: 'cat', description: 'd' } as any)
    } catch (e: any) {
      code = e?.code
    }
    // May fail later on harness/output-schema specifics, but never on the gate.
    expect(code).not.toBe('FORBIDDEN')
  })
})
