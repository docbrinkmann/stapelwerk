import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { POST } from '@/app/api/webhooks/lemonsqueezy/route'

/**
 * Webhook route: signature-verified, idempotent, mutates users.plan.
 * A 200 is not proof — every assertion queries the DB.
 */
const prisma: any = new PrismaClient()
const SECRET = 'whsec_test'
const sign = (body: string) => createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')

function req(body: string, signature: string | null): any {
  return {
    text: async () => body,
    headers: { get: (k: string) => (k === 'X-Signature' ? signature : null) },
  }
}

function subscriptionBody(opts: { event: string; userId?: string; variant?: string; renews?: string; status?: string }): string {
  return JSON.stringify({
    meta: { event_name: opts.event, custom_data: opts.userId ? { user_id: opts.userId } : {} },
    data: { attributes: { status: opts.status ?? 'active', variant_id: opts.variant, renews_at: opts.renews, urls: { customer_portal: 'https://portal.test/x' } } },
  })
}

function orderBody(opts: { userId?: string; variant?: string; identifier?: string }): string {
  return JSON.stringify({
    meta: { event_name: 'order_created', custom_data: opts.userId ? { user_id: opts.userId } : {} },
    data: { id: '12345', attributes: { identifier: opts.identifier ?? 'ord-abc', first_order_item: { variant_id: opts.variant } } },
  })
}

const cleanup = async () => {
  await prisma.verified_deploy_reports.deleteMany({})
  await prisma.billing_events.deleteMany({})
  await prisma.users.deleteMany({})
}

const savedEnv = { ...process.env }
beforeEach(async () => {
  await cleanup()
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET
  process.env.LEMONSQUEEZY_VARIANT_PRO = '111'
})
afterEach(async () => {
  await cleanup()
  process.env = { ...savedEnv }
})

describe('POST /api/webhooks/lemonsqueezy', () => {
  it('rejects a bad signature with 401 and writes nothing', async () => {
    const body = subscriptionBody({ event: 'subscription_created', userId: 'u1', variant: '111', renews: '2026-09-01T00:00:00Z' })
    const res = await POST(req(body, 'deadbeef'))
    expect(res.status).toBe(401)
    expect(await prisma.billing_events.count()).toBe(0)
  })

  it('upgrades the user on subscription_created and is idempotent on replay', async () => {
    await prisma.users.create({ data: { id: 'u1', email: 'u1@x.co', plan: 'free', updatedAt: new Date() } })
    const body = subscriptionBody({ event: 'subscription_created', userId: 'u1', variant: '111', renews: '2026-09-01T00:00:00Z' })
    const sig = sign(body)

    const res1 = await POST(req(body, sig))
    expect(res1.status).toBe(200)
    let user = await prisma.users.findUnique({ where: { id: 'u1' } })
    expect(user.plan).toBe('pro')
    expect(new Date(user.planValidUntil).toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(await prisma.billing_events.count()).toBe(1)

    // Replay the identical delivery ⇒ 200 no-op, still one ledger row, plan unchanged.
    const res2 = await POST(req(body, sig))
    expect(res2.status).toBe(200)
    expect(await prisma.billing_events.count()).toBe(1)
    user = await prisma.users.findUnique({ where: { id: 'u1' } })
    expect(user.plan).toBe('pro')
  })

  it('subscription_expired reverts the plan to free', async () => {
    await prisma.users.create({ data: { id: 'u2', email: 'u2@x.co', plan: 'pro', planValidUntil: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date() } })
    const body = subscriptionBody({ event: 'subscription_expired', userId: 'u2' })
    const res = await POST(req(body, sign(body)))
    expect(res.status).toBe(200)
    const user = await prisma.users.findUnique({ where: { id: 'u2' } })
    expect(user.plan).toBe('free')
    expect(user.planValidUntil).toBeNull()
  })

  it('unknown user ⇒ 200 + ledger row, no crash', async () => {
    const body = subscriptionBody({ event: 'subscription_created', userId: 'ghost', variant: '111', renews: '2026-09-01T00:00:00Z' })
    const res = await POST(req(body, sign(body)))
    expect(res.status).toBe(200)
    expect(await prisma.billing_events.count()).toBe(1)
  })

  it('order_created for the verified-deploy variant grants a paid credit (idempotent, no plan change)', async () => {
    process.env.LEMONSQUEEZY_VARIANT_VERIFIED_DEPLOY = '999'
    await prisma.users.create({ data: { id: 'buyer', email: 'b@x.co', plan: 'free', updatedAt: new Date() } })
    const body = orderBody({ userId: 'buyer', variant: '999', identifier: 'ord-1' })
    const sig = sign(body)

    const res1 = await POST(req(body, sig))
    expect(res1.status).toBe(200)
    expect(await prisma.verified_deploy_reports.count({ where: { userId: 'buyer', status: 'paid' } })).toBe(1)
    // A one-time order does not touch the subscription plan.
    expect((await prisma.users.findUnique({ where: { id: 'buyer' } })).plan).toBe('free')

    // Replay ⇒ still exactly one credit (idempotent via ledger + unique order id).
    await POST(req(body, sig))
    expect(await prisma.verified_deploy_reports.count({ where: { userId: 'buyer', status: 'paid' } })).toBe(1)
  })

  it('order_created for a different variant grants no verified-deploy credit', async () => {
    process.env.LEMONSQUEEZY_VARIANT_VERIFIED_DEPLOY = '999'
    await prisma.users.create({ data: { id: 'buyer2', email: 'b2@x.co', plan: 'free', updatedAt: new Date() } })
    const body = orderBody({ userId: 'buyer2', variant: '111', identifier: 'ord-2' })
    const res = await POST(req(body, sign(body)))
    expect(res.status).toBe(200)
    expect(await prisma.verified_deploy_reports.count({ where: { userId: 'buyer2' } })).toBe(0)
  })
})
