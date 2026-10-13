import { randomUUID } from 'crypto'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { hashPassword } from '@/lib/password'
import { checkRateLimit } from '@/lib/rate-limiter'
import { isSignupEnabled, sendMail } from '@/lib/mail'
import { authMail, type MailLocale } from '@/lib/auth-mails'
import { consumeAuthToken, issueAuthToken } from '@/lib/auth-tokens'
import { getAppUrl } from '@/lib/env'

/**
 * Self-service accounts. Sign-up only takes an address: the password is set
 * after the mailed link proves the mailbox, so nobody can pre-register a
 * stranger's address with a password of their own. Every request answers the
 * same whether or not the address has an account (no enumeration).
 */
const email = z.string().trim().toLowerCase().email().max(254)
const locale = z.enum(['en', 'de']).default('en')
const password = z.string().min(10).max(200)

function clientIp(req: unknown): string {
  const h = (req as { headers?: Headers | Record<string, string | undefined> } | undefined)?.headers
  const get = (k: string): string | undefined =>
    h && typeof (h as Headers).get === 'function' ? (h as Headers).get(k) ?? undefined : (h as Record<string, string | undefined> | undefined)?.[k]
  return get('x-forwarded-for')?.split(',')[0]?.trim() || get('x-real-ip') || 'unknown'
}

async function limit(kind: 'signup' | 'mail', key: string): Promise<void> {
  if (!(await checkRateLimit(kind, key)).allowed) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please try again later.' })
  }
}

const link = (token: string): string => `${getAppUrl().replace(/\/+$/, '')}/auth/set-password?token=${token}`

export const authRouter = createTRPCRouter({
  config: publicProcedure.query(() => ({ signupEnabled: isSignupEnabled() })),

  register: publicProcedure
    .input(z.object({ email, name: z.string().trim().max(100).optional(), locale }))
    .mutation(async ({ ctx, input }) => {
      if (!isSignupEnabled()) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Sign-up is not enabled on this instance.' })
      }
      await limit('signup', clientIp(ctx.req))
      await limit('mail', input.email)
      const lang = input.locale as MailLocale

      // Unconfirmed sign-ups hold only an address; drop those older than 7 days
      // (privacy policy 7.2). Activated and admin-created accounts are verified.
      await ctx.prisma.users.deleteMany({
        where: { emailVerified: null, passwordHash: null, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      })

      const existing = await ctx.prisma.users.findUnique({ where: { email: input.email } })
      if (existing?.emailVerified) {
        await sendMail(authMail('already_registered', lang, input.email, `${getAppUrl().replace(/\/+$/, '')}/auth/forgot-password`))
        return { ok: true }
      }
      const user =
        existing ??
        (await ctx.prisma.users.create({
          data: {
            id: randomUUID(),
            email: input.email,
            name: input.name || null,
            passwordHash: null,
            emailVerified: null,
            updatedAt: new Date(),
          },
        }))
      const token = await issueAuthToken(ctx.prisma, user.id, 'verify_email')
      await sendMail(authMail('confirm', lang, input.email, link(token)))
      return { ok: true }
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email, locale }))
    .mutation(async ({ ctx, input }) => {
      await limit('signup', clientIp(ctx.req))
      await limit('mail', input.email)
      const lang = input.locale as MailLocale
      const user = await ctx.prisma.users.findUnique({ where: { email: input.email } })
      if (user) {
        // An unconfirmed account gets its confirmation link again instead.
        const type = user.emailVerified ? 'reset_password' : 'verify_email'
        const token = await issueAuthToken(ctx.prisma, user.id, type)
        await sendMail(authMail(type === 'reset_password' ? 'reset' : 'confirm', lang, input.email, link(token)))
      }
      return { ok: true }
    }),

  // One endpoint for both links: confirming sign-up and resetting a password
  // each end in "choose a password".
  setPassword: publicProcedure
    .input(z.object({ token: z.string().min(20).max(200), password }))
    .mutation(async ({ ctx, input }) => {
      const redeemed = await consumeAuthToken(ctx.prisma, input.token, ['verify_email', 'reset_password'])
      if (!redeemed) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This link is invalid or has expired.' })
      }
      const now = new Date()
      const user = await ctx.prisma.users.findUnique({ where: { id: redeemed.userId } })
      if (!user) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This link is invalid or has expired.' })
      await ctx.prisma.users.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(input.password), emailVerified: user.emailVerified ?? now, updatedAt: now },
      })
      // The address may now sign in; any other outstanding link is void.
      await ctx.prisma.auth_tokens.deleteMany({ where: { userId: user.id, usedAt: null } })
      return { ok: true, email: user.email }
    }),
})
