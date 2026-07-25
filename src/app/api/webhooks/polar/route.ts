import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db-utils'
import { verifyWebhookSignature, webhookEventId, mapEventToPlan, isVerifiedDeployOrder } from '@/lib/billing'

/**
 * Polar webhook (Standard Webhooks delivery).
 *
 * Security: HMAC signature verified before anything touches the DB (401 on
 * mismatch). Idempotent: keyed on sha256(rawBody) in `billing_events` so a
 * replayed delivery is a 200 no-op — the plan changes at most once per event.
 * The raw payload is stored for audit. An unknown user is logged and 200'd
 * (never a 500 that triggers a provider retry storm).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()
  const secret = process.env.POLAR_WEBHOOK_SECRET

  const verified = verifyWebhookSignature(
    rawBody,
    {
      id: req.headers.get('webhook-id'),
      timestamp: req.headers.get('webhook-timestamp'),
      signature: req.headers.get('webhook-signature'),
    },
    secret,
  )
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const eventId = webhookEventId(rawBody)

  // Idempotency: a delivery we've already recorded is a no-op.
  const seen = await prisma.billing_events.findUnique({ where: { eventId } })
  if (seen) {
    return NextResponse.json({ status: 'duplicate' }, { status: 200 })
  }

  let payload: {
    type?: string
    data?: {
      id?: string
      product_id?: string
      status?: string
      current_period_end?: string | null
      ends_at?: string | null
      metadata?: { user_id?: string }
    }
  }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = payload.type ?? 'unknown'
  const data = payload.data ?? {}
  const userId = data.metadata?.user_id

  // Ledger first (audit + idempotency anchor), then apply the state change.
  await prisma.billing_events.create({
    data: {
      id: crypto.randomUUID(),
      provider: 'polar',
      eventId,
      type: eventType,
      userId: userId ?? null,
      payload: rawBody,
      processedAt: new Date(),
    },
  })

  const mutation = mapEventToPlan(eventType, data)
  if (mutation && userId) {
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } })
    if (user) {
      await prisma.users.update({
        where: { id: userId },
        data: { plan: mutation.plan, planValidUntil: mutation.planValidUntil, updatedAt: new Date() },
      })
    } else {
      // Unknown user: keep the ledger entry for debugging, don't error.
      console.warn(`[polar] webhook ${eventType} for unknown user ${userId}`)
    }
  }

  // One-time verified-deploy purchase: grant a paid credit the user redeems into
  // a signed report. Idempotent via the unique provider order id (belt-and-
  // suspenders with the billing_events guard). No plan change.
  if (isVerifiedDeployOrder(eventType, data.product_id) && userId) {
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } })
    if (user) {
      const orderId = data.id ?? eventId
      await prisma.verified_deploy_reports.upsert({
        where: { providerOrderId: orderId },
        update: {},
        create: { userId, providerOrderId: orderId, status: 'paid', updatedAt: new Date() },
      })
    } else {
      console.warn(`[polar] verified-deploy order for unknown user ${userId}`)
    }
  }

  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
