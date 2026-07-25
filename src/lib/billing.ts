/**
 * Polar (Merchant of Record) helpers — pure logic, no SDK.
 *
 * Webhook verification implements the Standard Webhooks spec Polar follows
 * (HMAC-SHA256 over `id.timestamp.body`, base64, secret base64-decoded) with
 * Node stdlib only (coding-craft: stdlib > new dep). Checkout sessions are a
 * single authenticated POST to /v1/checkouts/. The webhook route (see
 * app/api/webhooks/polar/route.ts) is the only DB-touching glue.
 */
import { createHmac, createHash, timingSafeEqual } from 'crypto'
import type { PlanId } from '@/lib/plans'

export const POLAR_API_BASE = (): string =>
  (process.env.POLAR_API_BASE ?? 'https://api.polar.sh').replace(/\/+$/, '')

/** Standard-Webhooks headers as delivered by Polar. */
export interface WebhookHeaders {
  id: string | null | undefined // webhook-id
  timestamp: string | null | undefined // webhook-timestamp (unix seconds)
  signature: string | null | undefined // webhook-signature ("v1,<base64>" space-separated list)
}

/** Tolerated clock skew for webhook timestamps (Standard Webhooks default). */
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

/**
 * Verify a Polar webhook per the Standard Webhooks spec: the signature is
 * base64(HMAC-SHA256(`${id}.${timestamp}.${rawBody}`)) keyed with the
 * base64-decoded secret (optional `whsec_` prefix stripped). The header may
 * carry several space-separated `v1,<sig>` candidates. Constant-time compare;
 * false on any missing input or a timestamp outside the tolerance window.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature || !secret) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > WEBHOOK_TOLERANCE_SECONDS) return false

  let key: Buffer
  try {
    key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  } catch {
    return false
  }
  if (key.length === 0) return false

  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`, 'utf8')
    .digest('base64')
  const expectedBuf = Buffer.from(expected, 'utf8')

  for (const candidate of signature.split(' ')) {
    const [version, sig] = candidate.split(',', 2)
    if (version !== 'v1' || !sig) continue
    const sigBuf = Buffer.from(sig, 'utf8')
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) return true
  }
  return false
}

/** Deterministic idempotency key for a delivery: identical body ⇒ identical key. */
export function webhookEventId(rawBody: string): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex')
}

/** Map a Polar product id to a plan, using the configured env ids. */
export function planForProduct(productId: string | undefined): PlanId | null {
  if (!productId) return null
  if (productId === process.env.POLAR_PRODUCT_PRO) return 'pro'
  if (productId === process.env.POLAR_PRODUCT_FLEET) return 'fleet'
  return null
}

export interface PolarSubscription {
  status?: string
  product_id?: string
  current_period_end?: string | null
  ends_at?: string | null
}

export interface PlanMutation {
  plan: PlanId | 'free'
  planValidUntil: Date | null
}

/**
 * Translate a subscription webhook into the plan state to persist:
 *   - created/active/updated/uncanceled ⇒ the product's plan, valid until
 *     `current_period_end` (Polar cancels at period end, so a canceled-but-
 *     running sub keeps access through the paid period)
 *   - canceled ⇒ keep the plan until `ends_at` ?? `current_period_end`
 *   - revoked ⇒ back to free immediately
 * Returns null when the event isn't a subscription lifecycle event we handle.
 */
export function mapEventToPlan(
  eventType: string,
  sub: PolarSubscription,
): PlanMutation | null {
  switch (eventType) {
    case 'subscription.created':
    case 'subscription.active':
    case 'subscription.updated':
    case 'subscription.uncanceled': {
      const plan = planForProduct(sub.product_id)
      if (!plan) return null
      const until = sub.status === 'canceled' ? (sub.ends_at ?? sub.current_period_end) : sub.current_period_end
      return { plan, planValidUntil: until ? new Date(until) : null }
    }
    case 'subscription.canceled': {
      const plan = planForProduct(sub.product_id)
      if (!plan) return null
      const until = sub.ends_at ?? sub.current_period_end
      return { plan, planValidUntil: until ? new Date(until) : null }
    }
    case 'subscription.revoked':
      return { plan: 'free', planValidUntil: null }
    default:
      return null
  }
}

/**
 * Is this webhook a PAID one-time order for the verified-deploy product?
 * Polar fires `order.paid` once the payment settled; match our configured
 * product id.
 */
export function isVerifiedDeployOrder(
  eventType: string,
  productId: string | undefined,
): boolean {
  if (eventType !== 'order.paid') return false
  const configured = process.env.POLAR_PRODUCT_VERIFIED_DEPLOY
  return !!configured && productId === configured
}

/**
 * Request body for a Polar checkout session, carrying the user id as metadata
 * (read back from the webhook's `data.metadata.user_id`) and as
 * `external_customer_id` so the order links to the customer. Null when the
 * product isn't configured. Pure — the fetch lives in createCheckout().
 */
export function checkoutBody(plan: PlanId | 'verified-deploy', userId: string): Record<string, unknown> | null {
  const productId =
    plan === 'verified-deploy'
      ? process.env.POLAR_PRODUCT_VERIFIED_DEPLOY
      : plan === 'pro'
        ? process.env.POLAR_PRODUCT_PRO
        : plan === 'fleet'
          ? process.env.POLAR_PRODUCT_FLEET
          : undefined
  if (!productId) return null
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  return {
    products: [productId],
    metadata: { user_id: userId },
    external_customer_id: userId,
    ...(appUrl ? { success_url: `${appUrl}/settings/billing?checkout_id={CHECKOUT_ID}` } : {}),
  }
}

/**
 * Create a hosted checkout session via POST /v1/checkouts/ and return its URL.
 * Null when billing isn't configured (no token / no product) or Polar errors —
 * callers already treat null as "checkout unavailable".
 */
export async function createCheckout(
  plan: PlanId | 'verified-deploy',
  userId: string,
): Promise<string | null> {
  const token = process.env.POLAR_ACCESS_TOKEN
  const body = checkoutBody(plan, userId)
  if (!token || !body) return null
  try {
    const res = await fetch(`${POLAR_API_BASE()}/v1/checkouts/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error(`[polar] checkout create failed: ${res.status} ${await res.text()}`)
      return null
    }
    const checkout = (await res.json()) as { url?: string }
    return checkout.url ?? null
  } catch (err) {
    console.error('[polar] checkout create failed', err)
    return null
  }
}

/** Hosted checkout for the one-time verified-deploy purchase (€29). */
export async function verifiedDeployCheckoutUrl(userId: string): Promise<string | null> {
  return createCheckout('verified-deploy', userId)
}

/**
 * Customer-portal URL for "Manage subscription": Polar portals are opened via
 * a short-lived customer session (POST /v1/customer-sessions) keyed by our
 * user id (`external_customer_id` set at checkout). Null when unconfigured,
 * the customer doesn't exist on Polar yet, or Polar errors.
 */
export async function customerPortalUrl(userId: string): Promise<string | null> {
  const token = process.env.POLAR_ACCESS_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`${POLAR_API_BASE()}/v1/customer-sessions/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ external_customer_id: userId }),
    })
    if (!res.ok) return null
    const session = (await res.json()) as { customer_portal_url?: string }
    return session.customer_portal_url ?? null
  } catch {
    return null
  }
}
