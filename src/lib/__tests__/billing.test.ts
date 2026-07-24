import { describe, it, expect, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import {
  verifyWebhookSignature,
  webhookEventId,
  planForVariant,
  mapEventToPlan,
  checkoutUrl,
  verifiedDeployCheckoutUrl,
  isVerifiedDeployOrder,
} from '../billing'

const SECRET = 'whsec_test'
const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body, 'utf8').digest('hex')

const savedEnv = { ...process.env }
afterEach(() => {
  process.env = { ...savedEnv }
})

describe('verifyWebhookSignature', () => {
  it('accepts a valid HMAC and rejects a wrong/missing one', () => {
    const body = '{"a":1}'
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true)
    expect(verifyWebhookSignature(body, sign(body, 'other'), SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, sign('different'), SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, sign(body), undefined)).toBe(false)
  })
})

describe('webhookEventId', () => {
  it('is deterministic per body (replay-safe) and differs per body', () => {
    expect(webhookEventId('{"a":1}')).toBe(webhookEventId('{"a":1}'))
    expect(webhookEventId('{"a":1}')).not.toBe(webhookEventId('{"a":2}'))
  })
})

describe('planForVariant', () => {
  it('maps configured variant ids to plans', () => {
    process.env.LEMONSQUEEZY_VARIANT_PRO = '111'
    process.env.LEMONSQUEEZY_VARIANT_FLEET = '222'
    expect(planForVariant('111')).toBe('pro')
    expect(planForVariant(222)).toBe('fleet')
    expect(planForVariant('999')).toBeNull()
    expect(planForVariant(undefined)).toBeNull()
  })
})

describe('mapEventToPlan', () => {
  const renews = '2026-09-01T00:00:00Z'
  const ends = '2026-08-15T00:00:00Z'

  it('created/updated ⇒ variant plan valid until renews_at', () => {
    process.env.LEMONSQUEEZY_VARIANT_PRO = '111'
    const m = mapEventToPlan('subscription_created', { status: 'active', variant_id: '111', renews_at: renews })
    expect(m).toEqual({ plan: 'pro', planValidUntil: new Date(renews) })
  })

  it('cancelled ⇒ keep plan until ends_at', () => {
    process.env.LEMONSQUEEZY_VARIANT_FLEET = '222'
    const m = mapEventToPlan('subscription_cancelled', { status: 'cancelled', variant_id: '222', ends_at: ends })
    expect(m).toEqual({ plan: 'fleet', planValidUntil: new Date(ends) })
  })

  it('expired ⇒ free', () => {
    expect(mapEventToPlan('subscription_expired', {})).toEqual({ plan: 'free', planValidUntil: null })
  })

  it('unknown variant or event ⇒ null (no state change)', () => {
    process.env.LEMONSQUEEZY_VARIANT_PRO = '111'
    expect(mapEventToPlan('subscription_created', { variant_id: '999', renews_at: renews })).toBeNull()
    expect(mapEventToPlan('order_created', { variant_id: '111' })).toBeNull()
  })
})

describe('checkoutUrl', () => {
  it('builds a store buy URL with the user id as custom data', () => {
    process.env.LEMONSQUEEZY_STORE_URL = 'https://x.lemonsqueezy.com'
    process.env.LEMONSQUEEZY_VARIANT_PRO = '111'
    const url = checkoutUrl('pro', 'user-42')
    expect(url).toContain('https://x.lemonsqueezy.com/buy/111')
    expect(url).toContain('user_id')
    expect(url).toContain('user-42')
  })

  it('returns null when store/variant is not configured', () => {
    delete process.env.LEMONSQUEEZY_STORE_URL
    expect(checkoutUrl('pro', 'u')).toBeNull()
  })
})

describe('verifiedDeployCheckoutUrl', () => {
  it('builds a one-time /buy URL carrying the user id when configured', () => {
    process.env.LEMONSQUEEZY_STORE_URL = 'https://x.lemonsqueezy.com'
    process.env.LEMONSQUEEZY_VARIANT_VERIFIED_DEPLOY = '999'
    const url = verifiedDeployCheckoutUrl('user-7')
    expect(url).toContain('/buy/999')
    expect(url).toContain('user-7')
  })

  it('returns null when the variant is not configured', () => {
    process.env.LEMONSQUEEZY_STORE_URL = 'https://x.lemonsqueezy.com'
    delete process.env.LEMONSQUEEZY_VARIANT_VERIFIED_DEPLOY
    expect(verifiedDeployCheckoutUrl('u')).toBeNull()
  })
})

describe('isVerifiedDeployOrder', () => {
  it('matches order_created for the configured verified-deploy variant only', () => {
    process.env.LEMONSQUEEZY_VARIANT_VERIFIED_DEPLOY = '999'
    expect(isVerifiedDeployOrder('order_created', '999')).toBe(true)
    expect(isVerifiedDeployOrder('order_created', 999)).toBe(true)
    expect(isVerifiedDeployOrder('order_created', '111')).toBe(false)
    expect(isVerifiedDeployOrder('subscription_created', '999')).toBe(false)
  })

  it('is false when the variant is not configured', () => {
    delete process.env.LEMONSQUEEZY_VARIANT_VERIFIED_DEPLOY
    expect(isVerifiedDeployOrder('order_created', '999')).toBe(false)
  })
})
