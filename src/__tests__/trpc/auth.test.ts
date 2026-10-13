import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'
import { hashPassword, verifyPassword } from '@/lib/password'

const sent: Array<{ to: string; subject: string; text: string }> = []
vi.mock('@/lib/mail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/mail')>()),
  sendMail: async (m: { to: string; subject: string; text: string }) => {
    sent.push(m)
  },
}))

const prisma: any = new PrismaClient()
let ip = 0
// Fresh client IP per caller so the per-IP sign-up limit doesn't couple tests.
const anon = async () =>
  appRouter.createCaller(
    await createTRPCContext({ req: { headers: { 'x-forwarded-for': `10.0.0.${++ip}` } } as any, res: {} as any }),
  )
const tokenFrom = (text: string): string => /set-password\?token=([A-Za-z0-9_-]+)/.exec(text)![1]

beforeEach(async () => {
  sent.length = 0
  await prisma.auth_tokens.deleteMany({})
  await prisma.users.deleteMany({})
})
afterEach(() => vi.unstubAllEnvs())

describe('auth: sign-up → confirm link → set password', () => {
  it('creates a passwordless, unconfirmed account and activates it via the mailed link once', async () => {
    const caller = await anon()
    await expect(caller.auth.register({ email: ' New@Example.com ', locale: 'de' })).resolves.toEqual({ ok: true })

    const user = await prisma.users.findUnique({ where: { email: 'new@example.com' } })
    expect(user).toMatchObject({ passwordHash: null, emailVerified: null })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: 'new@example.com', subject: 'Bestätige dein Stapelwerk-Konto' })

    const token = tokenFrom(sent[0].text)
    await expect(caller.auth.setPassword({ token, password: 'correct-horse-battery' })).resolves.toEqual({
      ok: true,
      email: 'new@example.com',
    })
    const active = await prisma.users.findUnique({ where: { email: 'new@example.com' } })
    expect(new Date(active.emailVerified).getTime()).toBeGreaterThan(0)
    expect(verifyPassword('correct-horse-battery', active.passwordHash)).toBe(true)

    // Single use: the same link can't set a password twice.
    await expect(caller.auth.setPassword({ token, password: 'attacker-password-1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  it('an existing account gets a notice, not a second account, and the same answer', async () => {
    await prisma.users.create({
      data: { id: 'u1', email: 'taken@example.com', passwordHash: hashPassword('old-password-1'), emailVerified: new Date(), updatedAt: new Date() },
    })
    const caller = await anon()
    await expect(caller.auth.register({ email: 'taken@example.com' })).resolves.toEqual({ ok: true })
    expect(await prisma.users.count({ where: { email: 'taken@example.com' } })).toBe(1)
    expect(sent[0].subject).toBe('Your Stapelwerk account')
    expect(sent[0].text).not.toMatch(/token=/)
  })
})

describe('auth: password reset', () => {
  it('unknown address: same answer, no mail; known address: link that sets a new password', async () => {
    const caller = await anon()
    await expect(caller.auth.requestPasswordReset({ email: 'nobody@example.com' })).resolves.toEqual({ ok: true })
    expect(sent).toHaveLength(0)

    await prisma.users.create({
      data: { id: 'u2', email: 'me@example.com', passwordHash: hashPassword('old-password-1'), emailVerified: new Date(), updatedAt: new Date() },
    })
    await caller.auth.requestPasswordReset({ email: 'me@example.com' })
    expect(sent[0].subject).toBe('Reset your Stapelwerk password')
    await caller.auth.setPassword({ token: tokenFrom(sent[0].text), password: 'brand-new-password' })
    const user = await prisma.users.findUnique({ where: { id: 'u2' } })
    expect(verifyPassword('brand-new-password', user.passwordHash)).toBe(true)
  })
})

describe('auth: abuse limits', () => {
  it('caps mails per address (3/hour)', async () => {
    for (let i = 0; i < 3; i++) await (await anon()).auth.register({ email: 'flood@example.com' })
    await expect((await anon()).auth.register({ email: 'flood@example.com' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    })
    expect(sent).toHaveLength(3)
  })

  it('production without SMTP: no self-registration (nothing could confirm it)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SMTP_HOST', '')
    const caller = await anon()
    await expect(caller.auth.config()).resolves.toEqual({ signupEnabled: false })
    await expect(caller.auth.register({ email: 'x@example.com' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
