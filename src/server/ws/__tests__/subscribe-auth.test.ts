import { describe, it, expect, beforeAll } from 'vitest'
import { authorizeStackSubscription } from '../index'

/**
 * Regression: logs/status WS subscriptions had NO ownership check — any
 * authenticated user could subscribe to another user's stackId and receive its
 * logs/status. authorizeStackSubscription is the gate handleSubscribe now runs.
 */
describe('authorizeStackSubscription', () => {
  const OWNER = 'user-owner'
  const OTHER = 'user-other'
  let stackId: string

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client')
    const prisma: any = new PrismaClient()
    const stack = await prisma.stacks.create({
      data: { name: 'Owned Stack', slug: 'owned-stack', userId: OWNER },
    })
    stackId = stack.id
  })

  it('allows the stack owner', async () => {
    await expect(authorizeStackSubscription(stackId, OWNER)).resolves.toBe(true)
  })

  it('denies a different user (cross-tenant IDOR)', async () => {
    await expect(authorizeStackSubscription(stackId, OTHER)).resolves.toBe(false)
  })

  it('denies a non-existent stack and blank inputs', async () => {
    await expect(authorizeStackSubscription('00000000-0000-0000-0000-000000000000', OWNER)).resolves.toBe(false)
    await expect(authorizeStackSubscription('', OWNER)).resolves.toBe(false)
    await expect(authorizeStackSubscription(stackId, '')).resolves.toBe(false)
  })
})
