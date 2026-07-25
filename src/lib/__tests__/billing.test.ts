import { describe, it, expect, afterEach, vi } from 'vitest'
import { createHmac } from 'crypto'
import {
  verifyWebhookSignature,
  webhookEventId,
  planForProduct,
  mapEventToPlan,
  checkoutBody,
  createCheckout,
  isVerifiedDeployOrder,
} from '../billing'

// Standard Webhooks: secret is base64 (optionally whsec_-prefixed); the
// signature is base64(HMAC-SHA256(`${id}.${ts}.${body}`)) with the DECODED key.
const SECRET = `whsec_${Buffer.from('a-test-secret-of-32-bytes-len!!').toString('base64')}`
const NOW = 1_800_000_000
const sign = (body: string, opts: { id?: string; ts?: number; secret?: string } = {}): string => {
  const key = Buffer.from((opts.secret ?? SECRET).replace(/^whsec_/, ''), 'base64')
  const mac = createHmac('sha256', key)
    .update(`${opts.id ?? 'msg_1'}.${opts.ts ?? NOW}.${body}`, 'utf8')
    .digest('base64')
  return `v1,${mac}`
}
const headers = (body: string, opts: { id?: string; ts?: number; secret?: string; sig?: string } = {}) => ({
  id: opts.id ?? 'msg_1',
  timestamp: String(opts.ts ?? NOW),
  signature: opts.sig ?? sign(body, opts),
})

const PRO = '11111111-1111-4111-8111-111111111111'
const FLEET = '22222222-2222-4222-8222-222222222222'
const VD = '99999999-9999-4999-8999-999999999999'

const savedEnv = { ...process.env }
afterEach(() => {
  process.env = { ...savedEnv }
  vi.unstubAllGlobals()
})

describe('verifyWebhookSignature (Standard Webhooks)', () => {
  it('accepts a valid signature and rejects wrong/missing ones', () => {
    const body = '{"a":1}'
    expect(verifyWebhookSignature(body, headers(body), SECRET, NOW)).toBe(true)
    const otherSecret = `whsec_${Buffer.from('another-secret-of-32-bytes!!!!!').toString('base64')}`
    expect(verifyWebhookSignature(body, headers(body, { secret: otherSecret }), SECRET, NOW)).toBe(false)
    expect(verifyWebhookSignature(body, headers('different'), SECRET, NOW)).toBe(false)
    expect(verifyWebhookSignature(body, { ...headers(body), signature: null }, SECRET, NOW)).toBe(false)
    expect(verifyWebhookSignature(body, headers(body), undefined, NOW)).toBe(false)
  })

  it('rejects a timestamp outside the tolerance window (replay protection)', () => {
    const body = '{"a":1}'
    const stale = NOW - 6 * 60
    expect(verifyWebhookSignature(body, headers(body, { ts: stale }), SECRET, NOW)).toBe(false)
    // …but the same delivery verifies at its own time.
    expect(verifyWebhookSignature(body, headers(body, { ts: stale }), SECRET, stale + 30)).toBe(true)
  })

  it('accepts the matching entry in a space-separated signature list', () => {
    const body = '{"a":1}'
    const sig = `v1,${Buffer.from('nonsense').toString('base64')} ${sign(body)}`
    expect(verifyWebhookSignature(body, headers(body, { sig }), SECRET, NOW)).toBe(true)
  })
})

describe('webhookEventId', () => {
  it('is deterministic per body (replay-safe) and differs per body', () => {
    expect(webhookEventId('{"a":1}')).toBe(webhookEventId('{"a":1}'))
    expect(webhookEventId('{"a":1}')).not.toBe(webhookEventId('{"a":2}'))
  })
})

describe('planForProduct', () => {
  it('maps configured product ids to plans', () => {
    process.env.POLAR_PRODUCT_PRO = PRO
    process.env.POLAR_PRODUCT_FLEET = FLEET
    expect(planForProduct(PRO)).toBe('pro')
    expect(planForProduct(FLEET)).toBe('fleet')
    expect(planForProduct('unknown')).toBeNull()
    expect(planForProduct(undefined)).toBeNull()
  })
})

describe('mapEventToPlan', () => {
  const periodEnd = '2026-09-01T00:00:00Z'
  const ends = '2026-08-15T00:00:00Z'

  it('created/active ⇒ product plan valid until current_period_end', () => {
    process.env.POLAR_PRODUCT_PRO = PRO
    const m = mapEventToPlan('subscription.active', { status: 'active', product_id: PRO, current_period_end: periodEnd })
    expect(m).toEqual({ plan: 'pro', planValidUntil: new Date(periodEnd) })
  })

  it('canceled ⇒ keep plan until ends_at (access through the paid period)', () => {
    process.env.POLAR_PRODUCT_FLEET = FLEET
    const m = mapEventToPlan('subscription.canceled', { status: 'canceled', product_id: FLEET, ends_at: ends })
    expect(m).toEqual({ plan: 'fleet', planValidUntil: new Date(ends) })
  })

  it('revoked ⇒ free immediately', () => {
    expect(mapEventToPlan('subscription.revoked', {})).toEqual({ plan: 'free', planValidUntil: null })
  })

  it('unknown product or event ⇒ null (no state change)', () => {
    process.env.POLAR_PRODUCT_PRO = PRO
    expect(mapEventToPlan('subscription.active', { product_id: 'other', current_period_end: periodEnd })).toBeNull()
    expect(mapEventToPlan('order.paid', { product_id: PRO })).toBeNull()
  })
})

describe('checkoutBody', () => {
  it('carries the product, user metadata and external customer id', () => {
    process.env.POLAR_PRODUCT_PRO = PRO
    const body = checkoutBody('pro', 'user-42')
    expect(body).toMatchObject({
      products: [PRO],
      metadata: { user_id: 'user-42' },
      external_customer_id: 'user-42',
    })
  })

  it('returns null when the product is not configured', () => {
    delete process.env.POLAR_PRODUCT_PRO
    expect(checkoutBody('pro', 'u')).toBeNull()
  })
})

describe('createCheckout', () => {
  it('POSTs to /v1/checkouts/ and returns the hosted url', async () => {
    process.env.POLAR_ACCESS_TOKEN = 'polar_oat_test'
    process.env.POLAR_PRODUCT_VERIFIED_DEPLOY = VD
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'co_1', url: 'https://polar.sh/checkout/co_1' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const url = await createCheckout('verified-deploy', 'user-7')
    expect(url).toBe('https://polar.sh/checkout/co_1')
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe('https://api.polar.sh/v1/checkouts/')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer polar_oat_test')
    expect(JSON.parse(init.body as string).products).toEqual([VD])
  })

  it('returns null without a token, without a product, or on a Polar error', async () => {
    process.env.POLAR_PRODUCT_VERIFIED_DEPLOY = VD
    delete process.env.POLAR_ACCESS_TOKEN
    expect(await createCheckout('verified-deploy', 'u')).toBeNull()

    process.env.POLAR_ACCESS_TOKEN = 'polar_oat_test'
    delete process.env.POLAR_PRODUCT_VERIFIED_DEPLOY
    expect(await createCheckout('verified-deploy', 'u')).toBeNull()

    process.env.POLAR_PRODUCT_VERIFIED_DEPLOY = VD
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 422, text: async () => 'nope' })))
    expect(await createCheckout('verified-deploy', 'u')).toBeNull()
  })
})

describe('isVerifiedDeployOrder', () => {
  it('matches order.paid for the configured verified-deploy product only', () => {
    process.env.POLAR_PRODUCT_VERIFIED_DEPLOY = VD
    expect(isVerifiedDeployOrder('order.paid', VD)).toBe(true)
    expect(isVerifiedDeployOrder('order.paid', PRO)).toBe(false)
    expect(isVerifiedDeployOrder('order.created', VD)).toBe(false)
    expect(isVerifiedDeployOrder('subscription.active', VD)).toBe(false)
  })

  it('is false when the product is not configured', () => {
    delete process.env.POLAR_PRODUCT_VERIFIED_DEPLOY
    expect(isVerifiedDeployOrder('order.paid', VD)).toBe(false)
  })
})
