import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db-utils'
import { verifyWebhookSignature, webhookEventId, mapEventToPlan, isVerifiedDeployOrder } from '@/lib/billing'

/**
 * Lemon Squeezy subscription webhook.
 *
 * Security: HMAC signature verified before anything touches the DB (401 on
 * mismatch). Idempotent: keyed on sha256(rawBody) in `billing_events` so a
 * replayed delivery is a 200 no-op — the plan changes at most once per event.
 * The raw payload is stored for audit. An unknown user is logged and 200'd
 * (never a 500 that triggers a provider retry storm).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()
  const signature = req.headers.get('X-Signature')
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const eventId = webhookEventId(rawBody)

  // Idempotency: a delivery we've already recorded is a no-op.
  const seen = await prisma.billing_events.findUnique({ where: { eventId } })
  if (seen) {
    return NextResponse.json({ status: 'duplicate' }, { status: 200 })
  }

  let payload: {
    meta?: { event_name?: string; custom_data?: { user_id?: string } }
    data?: { attributes?: Record<string, unknown> }
  }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = payload.meta?.event_name ?? 'unknown'
  const userId = payload.meta?.custom_data?.user_id
  const attrs = (payload.data?.attributes ?? {}) as Parameters<typeof mapEventToPlan>[1]

  // Ledger first (audit + idempotency anchor), then apply the state change.
  await prisma.billing_events.create({
    data: {
      id: crypto.randomUUID(),
      provider: 'lemonsqueezy',
      eventId,
      type: eventName,
      userId: userId ?? null,
      payload: rawBody,
      processedAt: new Date(),
    },
  })

  const mutation = mapEventToPlan(eventName, attrs)
  if (mutation && userId) {
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } })
    if (user) {
      await prisma.users.update({
        where: { id: userId },
        data: { plan: mutation.plan, planValidUntil: mutation.planValidUntil, updatedAt: new Date() },
      })
    } else {
      // Unknown user: keep the ledger entry for debugging, don't error.
      console.warn(`[lemonsqueezy] webhook ${eventName} for unknown user ${userId}`)
    }
  }

  // One-time verified-deploy purchase: grant a paid credit the user redeems into
  // a signed report. Idempotent via the unique LS order id (belt-and-suspenders
  // with the billing_events guard). No plan change.
  const orderAttrs = attrs as { first_order_item?: { variant_id?: string | number }; identifier?: string }
  const variantId = orderAttrs.first_order_item?.variant_id
  if (isVerifiedDeployOrder(eventName, variantId) && userId) {
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } })
    if (user) {
      const orderId = orderAttrs.identifier ?? String((payload.data as { id?: unknown })?.id ?? eventId)
      await prisma.verified_deploy_reports.upsert({
        where: { lemonsqueezyOrderId: orderId },
        update: {},
        create: { userId, lemonsqueezyOrderId: orderId, status: 'paid', updatedAt: new Date() },
      })
    } else {
      console.warn(`[lemonsqueezy] verified-deploy order for unknown user ${userId}`)
    }
  }

  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
