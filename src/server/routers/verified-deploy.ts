import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import crypto from 'crypto'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { isBillingEnabled, VERIFIED_DEPLOY_PRICE } from '@/lib/plans'
import { verifiedDeployCheckoutUrl } from '@/lib/billing'
import { assembleStackCompose } from './deployments'
import {
  buildReport,
  signReport,
  canonicalReport,
  publicKeyFromPrivate,
  reportHasBlockingFailure,
  type VerifiedDeployReport,
} from '@/lib/deploy/verified-deploy-report'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * The one-time €29 "verified deploy": a provenance-signed report attesting the
 * stack's kill-switch holds by construction. Free on self-host (billing off);
 * a redeemable paid credit on the hosted plan. We never hold SSH keys and never
 * boot the stack on our infra — the proof is structural + signed.
 */
export const verifiedDeployRouter = createTRPCRouter({
  // Price + hosted checkout URL (null on self-host / when LS isn't configured).
  checkout: protectedProcedure.query(({ ctx }) => ({
    price: VERIFIED_DEPLOY_PRICE,
    billingEnabled: isBillingEnabled(),
    url: isBillingEnabled() ? verifiedDeployCheckoutUrl(ctx.userId!) : null,
  })),

  // The ed25519 public key that signs reports, so anyone can verify one. Public —
  // a public key is not a secret; null until the signing key is configured (Gate D).
  publicKey: publicProcedure.query(() => {
    const priv = process.env.VERIFIED_DEPLOY_SIGNING_KEY
    if (!priv) return { publicKeyPem: null as string | null }
    try {
      return { publicKeyPem: publicKeyFromPrivate(priv) }
    } catch {
      return { publicKeyPem: null as string | null }
    }
  }),

  // Paid, unredeemed credits the user holds. `credits: null` ⇒ self-host (free).
  entitlement: protectedProcedure.query(async ({ ctx }) => {
    if (!isBillingEnabled()) return { billingEnabled: false, credits: null as number | null }
    const credits = await ctx.prisma.verified_deploy_reports.count({
      where: { userId: ctx.userId, status: 'paid', stackId: null },
    })
    return { billingEnabled: true, credits }
  }),

  // Generate + sign the report for a stack. Hosted: redeems a paid credit.
  generate: protectedProcedure
    .input(z.object({ stackId: z.string().regex(UUID) }))
    .mutation(async ({ ctx, input }) => {
      const stack = await ctx.prisma.stacks.findUnique({
        where: { id: input.stackId },
        select: { userId: true, name: true },
      })
      if (!stack) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stack not found' })
      if (stack.userId !== ctx.userId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })

      // Redeem a paid credit on the hosted plan; self-host generates free.
      let creditId: string | null = null
      if (isBillingEnabled()) {
        const credit = await ctx.prisma.verified_deploy_reports.findFirst({
          where: { userId: ctx.userId, status: 'paid', stackId: null },
          orderBy: { createdAt: 'asc' },
        })
        if (!credit) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `No verified-deploy credit. Purchase one (€${VERIFIED_DEPLOY_PRICE}) to generate a signed report.`,
          })
        }
        creditId = credit.id
      }

      const composeYaml = await assembleStackCompose(ctx.prisma, input.stackId)
      const reportId = creditId ?? crypto.randomUUID()
      const report = buildReport({
        reportId,
        stackId: input.stackId,
        stackName: stack.name,
        composeYaml,
        issuedAt: new Date().toISOString(),
      })
      const reportJson = canonicalReport(report)

      // Sign with the launch ed25519 key when present; otherwise an unsigned draft
      // (never throw on a malformed key — degrade honestly).
      const signingKey = process.env.VERIFIED_DEPLOY_SIGNING_KEY
      let signature: string | null = null
      let signedAt: Date | null = null
      if (signingKey) {
        try {
          signature = signReport(report, signingKey)
          signedAt = new Date()
        } catch {
          signature = null
        }
      }

      // Hosted plan: a paid credit is only spent on a SIGNED report with no
      // BLOCKING failure. Never burn €29 on an unsigned draft (misconfig), a
      // kill-switch leak, or a failed safety-audit property — all of which the
      // user can still fix. Surface them, but don't consume the credit.
      if (isBillingEnabled() && creditId) {
        if (!signature) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Signed reports are temporarily unavailable (signing key not configured). Your credit was not used.',
          })
        }
        if (reportHasBlockingFailure(report)) {
          return { report, signature, signed: true, creditConsumed: false }
        }
      }

      const data = { stackId: input.stackId, status: report.status, reportJson, signature, signedAt, updatedAt: new Date() }
      if (creditId) {
        await ctx.prisma.verified_deploy_reports.update({ where: { id: creditId }, data })
      } else {
        await ctx.prisma.verified_deploy_reports.create({ data: { id: reportId, userId: ctx.userId!, ...data } })
      }

      return { report, signature, signed: !!signature, creditConsumed: !!creditId }
    }),

  // Fetch a generated report (owner-gated) for the view/download page.
  get: protectedProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const row = await ctx.prisma.verified_deploy_reports.findUnique({ where: { id: input.id } })
    if (!row || row.userId !== ctx.userId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' })
    if (!row.reportJson) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This credit has not been generated into a report yet.' })
    const report = JSON.parse(row.reportJson) as VerifiedDeployReport
    return { report, signature: row.signature, signed: !!row.signature, status: row.status }
  }),

  // Reports the user has generated for a stack (for the stack's deploy view).
  listForStack: protectedProcedure.input(z.object({ stackId: z.string().regex(UUID) })).query(async ({ ctx, input }) => {
    const rows = await ctx.prisma.verified_deploy_reports.findMany({
      where: { userId: ctx.userId, stackId: input.stackId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => ({ id: r.id, status: r.status, signed: !!r.signature, createdAt: r.createdAt }))
  }),
})
