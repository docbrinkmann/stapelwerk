/**
 * Lemon Squeezy (Merchant of Record) helpers — pure logic, no SDK.
 *
 * Signature verification uses Node stdlib HMAC (coding-craft: stdlib > new dep);
 * checkout/portal are plain URL construction. The webhook route (see
 * app/api/webhooks/lemonsqueezy/route.ts) is the only DB-touching glue.
 */
import { createHmac, createHash, timingSafeEqual } from 'crypto'
import type { PlanId } from '@/lib/plans'

/**
 * Verify a Lemon Squeezy `X-Signature` (hex HMAC-SHA256 of the raw body with
 * the webhook secret). Constant-time; false on any missing/mismatched input.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!signature || !secret) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(signature, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Deterministic idempotency key for a delivery: identical body ⇒ identical key. */
export function webhookEventId(rawBody: string): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex')
}

/** Map a Lemon Squeezy variant id to a plan, using the configured env ids. */
export function planForVariant(variantId: string | number | undefined): PlanId | null {
  if (variantId == null) return null
  const id = String(variantId)
  if (id === process.env.LEMONSQUEEZY_VARIANT_PRO) return 'pro'
  if (id === process.env.LEMONSQUEEZY_VARIANT_FLEET) return 'fleet'
  return null
}

export interface LsSubscriptionAttributes {
  status?: string
  variant_id?: string | number
  renews_at?: string | null
  ends_at?: string | null
  urls?: { customer_portal?: string }
}

export interface PlanMutation {
  plan: PlanId | 'free'
  planValidUntil: Date | null
}

/**
 * Translate a subscription webhook into the plan state to persist:
 *   - created/updated ⇒ the variant's plan, valid until `renews_at`
 *   - cancelled ⇒ keep the plan until `ends_at` (access through period end)
 *   - expired ⇒ back to free
 * Returns null when the event isn't a subscription lifecycle event we handle.
 */
export function mapEventToPlan(
  eventName: string,
  attrs: LsSubscriptionAttributes,
): PlanMutation | null {
  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed': {
      const plan = planForVariant(attrs.variant_id)
      if (!plan) return null
      // A cancelled-but-not-yet-expired sub still updates: honor ends_at.
      const until = attrs.status === 'cancelled' ? attrs.ends_at : attrs.renews_at
      return { plan, planValidUntil: until ? new Date(until) : null }
    }
    case 'subscription_cancelled': {
      const plan = planForVariant(attrs.variant_id)
      if (!plan) return null
      // Keep access until the paid period ends.
      return { plan, planValidUntil: attrs.ends_at ? new Date(attrs.ends_at) : null }
    }
    case 'subscription_expired':
      return { plan: 'free', planValidUntil: null }
    default:
      return null
  }
}

/** Hosted checkout URL for a plan, carrying the user id as custom data. */
export function checkoutUrl(plan: PlanId, userId: string): string | null {
  const store = process.env.LEMONSQUEEZY_STORE_URL // e.g. https://buildmystack.lemonsqueezy.com
  const variant =
    plan === 'pro'
      ? process.env.LEMONSQUEEZY_VARIANT_PRO
      : plan === 'fleet'
        ? process.env.LEMONSQUEEZY_VARIANT_FLEET
        : undefined
  if (!store || !variant) return null
  const url = new URL(`${store.replace(/\/+$/, '')}/buy/${variant}`)
  // LS reads checkout[custom][user_id] back into the webhook's meta.custom_data.
  url.searchParams.set('checkout[custom][user_id]', userId)
  return url.toString()
}

/**
 * Hosted checkout URL for the one-time verified-deploy purchase (€29), carrying
 * the user id as custom data. Null when the store/variant isn't configured.
 */
export function verifiedDeployCheckoutUrl(userId: string): string | null {
  const store = process.env.LEMONSQUEEZY_STORE_URL
  const variant = process.env.LEMONSQUEEZY_VARIANT_VERIFIED_DEPLOY
  if (!store || !variant) return null
  const url = new URL(`${store.replace(/\/+$/, '')}/buy/${variant}`)
  url.searchParams.set('checkout[custom][user_id]', userId)
  return url.toString()
}

/**
 * Is this webhook a paid one-time order for the verified-deploy product? Lemon
 * Squeezy fires `order_created` for one-time purchases; match our configured
 * variant id (the caller resolves it from the order's first line item).
 */
export function isVerifiedDeployOrder(
  eventName: string,
  variantId: string | number | undefined,
): boolean {
  if (eventName !== 'order_created') return false
  const configured = process.env.LEMONSQUEEZY_VARIANT_VERIFIED_DEPLOY
  return !!configured && String(variantId) === configured
}
