import { describe, it, expect } from 'vitest'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'

/**
 * With public sign-up, "signed in" no longer means "operator": system-wide
 * monitoring (global alerts, dashboard internals) is admin-only.
 */
const createCaller = async (user: { id: string; role: string }) => {
  const ctx = await createTRPCContext({ user, req: {} as any, res: {} as any })
  return appRouter.createCaller(ctx)
}

describe('monitoring: system-wide procedures are admin-only', () => {
  it('a regular signed-in user can neither read nor mutate global alerts', async () => {
    const caller = await createCaller({ id: 'regular-user', role: 'user' })

    await expect(caller.monitoring.getDashboardData()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(caller.monitoring.getAlerts({})).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.monitoring.createAlert({ severity: 'critical', service: 'x', message: 'spoofed' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(caller.monitoring.resolveAlert({ id: 'any' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
