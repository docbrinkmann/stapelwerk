import { describe, it, expect } from 'vitest'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'

/**
 * The app is public (no Pangolin SSO in front): every mutation must take the
 * caller's identity from the session, never from the request body.
 */
const caller = async (user?: { id: string; role: string }) =>
  appRouter.createCaller(await createTRPCContext({ user, req: {} as any, res: {} as any }))

describe('formerly public template mutations need a session', () => {
  it('anonymous callers are rejected before any write', async () => {
    const anon = await caller()
    await expect(anon.templates.applyToStack({ templateId: 't', stackId: 's' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(anon.templates.rate({ templateId: 't', rating: 5 })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(anon.templates.rateAdvanced({ templateId: 't', rating: 5 })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(anon.templates.markRatingHelpful({ ratingId: 'r' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(anon.templates.getPersonalizedRecommendations({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('forking into the curated catalog is admin-only', async () => {
    const user = await caller({ id: 'regular-user', role: 'user' })
    await expect(user.templates.fork({ sourceTemplateId: 't', newName: 'mine' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
