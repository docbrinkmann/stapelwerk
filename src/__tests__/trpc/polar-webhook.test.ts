import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { POST } from '@/app/api/webhooks/polar/route'

/**
 * Webhook route: signature-verified (Standard Webhooks), idempotent, mutates
 * users.plan. A 200 is not proof — every assertion queries the DB.
 */
const prisma: any = new PrismaClient()
const SECRET = `whsec_${Buffer.from('a-test-secret-of-32-bytes-len!!').toString('base64')}`
const PRO = '11111111-1111-4111-8111-111111111111'
const VD = '99999999-9999-4999-8999-999999999999'

let msgSeq = 0
function sign(body: string, id: string, ts: string): string {
  const key = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64')
  return `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`, 'utf8').digest('base64')}`
}

/** A fake NextRequest carrying valid (or overridden) Standard-Webhooks headers. */
function req(body: string, opts: { sig?: string; id?: string } = {}): any {
  const id = opts.id ?? `msg_${++msgSeq}`
  const ts = String(Math.floor(Date.now() / 1000))
  const h: Record<string, string> = {
    'webhook-id': id,
    'webhook-timestamp': ts,
    'webhook-signature': opts.sig ?? sign(body, id, ts),
  }
  return { text: async () => body, headers: { get: (k: string) => h[k.toLowerCase()] ?? null } }
}

function subscriptionBody(opts: { event: string; userId?: string; product?: string; periodEnd?: string; status?: string }): string {
  return JSON.stringify({
    type: opts.event,
    data: {
      id: 'sub_1',
      status: opts.status ?? 'active',
      product_id: opts.product,
      current_period_end: opts.periodEnd,
      metadata: opts.userId ? { user_id: opts.userId } : {},
    },
  })
}

function orderBody(opts: { userId?: string; product?: string; orderId?: string }): string {
  return JSON.stringify({
    type: 'order.paid',
    data: {
      id: opts.orderId ?? 'ord-abc',
      product_id: opts.product,
      metadata: opts.userId ? { user_id: opts.userId } : {},
    },
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
  process.env.POLAR_WEBHOOK_SECRET = SECRET
  process.env.POLAR_PRODUCT_PRO = PRO
})
afterEach(async () => {
  await cleanup()
  process.env = { ...savedEnv }
})

describe('POST /api/webhooks/polar', () => {
  it('rejects a bad signature with 401 and writes nothing', async () => {
    const body = subscriptionBody({ event: 'subscription.active', userId: 'u1', product: PRO, periodEnd: '2026-09-01T00:00:00Z' })
    const res = await POST(req(body, { sig: 'v1,ZGVhZGJlZWY=' }))
    expect(res.status).toBe(401)
    expect(await prisma.billing_events.count()).toBe(0)
  })

  it('upgrades the user on subscription.active and is idempotent on replay', async () => {
    await prisma.users.create({ data: { id: 'u1', email: 'u1@x.co', plan: 'free', updatedAt: new Date() } })
    const body = subscriptionBody({ event: 'subscription.active', userId: 'u1', product: PRO, periodEnd: '2026-09-01T00:00:00Z' })
    const delivery = req(body) // same id+signature reused, like a provider retry

    const res1 = await POST(delivery)
    expect(res1.status).toBe(200)
    let user = await prisma.users.findUnique({ where: { id: 'u1' } })
    expect(user.plan).toBe('pro')
    expect(new Date(user.planValidUntil).toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(await prisma.billing_events.count()).toBe(1)

    // Replay the identical delivery ⇒ 200 no-op, still one ledger row, plan unchanged.
    const res2 = await POST(delivery)
    expect(res2.status).toBe(200)
    expect(await prisma.billing_events.count()).toBe(1)
    user = await prisma.users.findUnique({ where: { id: 'u1' } })
    expect(user.plan).toBe('pro')
  })

  it('subscription.revoked reverts the plan to free', async () => {
    await prisma.users.create({ data: { id: 'u2', email: 'u2@x.co', plan: 'pro', planValidUntil: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date() } })
    const body = subscriptionBody({ event: 'subscription.revoked', userId: 'u2' })
    const res = await POST(req(body))
    expect(res.status).toBe(200)
    const user = await prisma.users.findUnique({ where: { id: 'u2' } })
    expect(user.plan).toBe('free')
    expect(user.planValidUntil).toBeNull()
  })

  it('unknown user ⇒ 200 + ledger row, no crash', async () => {
    const body = subscriptionBody({ event: 'subscription.active', userId: 'ghost', product: PRO, periodEnd: '2026-09-01T00:00:00Z' })
    const res = await POST(req(body))
    expect(res.status).toBe(200)
    expect(await prisma.billing_events.count()).toBe(1)
  })

  it('order.paid for the verified-deploy product grants a paid credit (idempotent, no plan change)', async () => {
    process.env.POLAR_PRODUCT_VERIFIED_DEPLOY = VD
    await prisma.users.create({ data: { id: 'buyer', email: 'b@x.co', plan: 'free', updatedAt: new Date() } })
    const body = orderBody({ userId: 'buyer', product: VD, orderId: 'ord-1' })
    const delivery = req(body)

    const res1 = await POST(delivery)
    expect(res1.status).toBe(200)
    expect(await prisma.verified_deploy_reports.count({ where: { userId: 'buyer', status: 'paid' } })).toBe(1)
    // A one-time order does not touch the subscription plan.
    expect((await prisma.users.findUnique({ where: { id: 'buyer' } })).plan).toBe('free')

    // Replay ⇒ still exactly one credit (idempotent via ledger + unique order id).
    await POST(delivery)
    expect(await prisma.verified_deploy_reports.count({ where: { userId: 'buyer', status: 'paid' } })).toBe(1)

    // A second DISTINCT paid order (new order id) grants a second credit.
    await POST(req(orderBody({ userId: 'buyer', product: VD, orderId: 'ord-2' })))
    expect(await prisma.verified_deploy_reports.count({ where: { userId: 'buyer', status: 'paid' } })).toBe(2)
  })

  it('order.paid for a different product grants no verified-deploy credit', async () => {
    process.env.POLAR_PRODUCT_VERIFIED_DEPLOY = VD
    await prisma.users.create({ data: { id: 'buyer2', email: 'b2@x.co', plan: 'free', updatedAt: new Date() } })
    const body = orderBody({ userId: 'buyer2', product: PRO, orderId: 'ord-3' })
    const res = await POST(req(body))
    expect(res.status).toBe(200)
    expect(await prisma.verified_deploy_reports.count({ where: { userId: 'buyer2' } })).toBe(0)
  })
})
