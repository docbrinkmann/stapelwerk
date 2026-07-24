import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import { createTestData } from '../helpers/test-data-factory'
import {
  generateSigningKeypair,
  verifyReportSignature,
  publicKeyFromPrivate,
} from '@/lib/deploy/verified-deploy-report'

const keypair = generateSigningKeypair()

async function createCaller(userId?: string) {
  const ctx = await createTRPCContext({ userId })
  return appRouter.createCaller(ctx)
}

async function seedStack(caller: Awaited<ReturnType<typeof createCaller>>) {
  const suffix = Math.random().toString(36).slice(2, 8)
  const category = await createTestData.category({ name: `Cat ${suffix}`, slug: `cat-${suffix}` })
  const service = await createTestData.service({
    name: `Web ${suffix}`,
    slug: `web-${suffix}`,
    categoryId: category.id,
    dockerImage: 'nginx',
    version: 'alpine',
  })
  return caller.stacks.create({ name: `VD Stack ${suffix}`, services: [{ serviceId: service.id }] })
}

describe('verifiedDeploy router — self-host (billing off)', () => {
  beforeEach(() => {
    process.env.VERIFIED_DEPLOY_SIGNING_KEY = keypair.privateKeyPem
    delete process.env.BILLING_ENABLED
  })
  afterEach(() => {
    delete process.env.VERIFIED_DEPLOY_SIGNING_KEY
  })

  it('checkout: price 29, no hosted URL on self-host', async () => {
    const caller = await createCaller('vd-user-1')
    const c = await caller.verifiedDeploy.checkout()
    expect(c.price).toBe(29)
    expect(c.billingEnabled).toBe(false)
    expect(c.url).toBeNull()
  })

  it('entitlement: free (credits null) on self-host', async () => {
    const caller = await createCaller('vd-user-1')
    expect(await caller.verifiedDeploy.entitlement()).toEqual({ billingEnabled: false, credits: null })
  })

  it('generates a signed, verifiable report for the owner, and get returns it', async () => {
    const caller = await createCaller('vd-user-1')
    const stack = await seedStack(caller)

    const res = await caller.verifiedDeploy.generate({ stackId: stack.id })
    expect(res.signed).toBe(true)
    expect(res.report.stackId).toBe(stack.id)
    expect(res.report.status).toBe('no-download-client') // plain nginx stack — nothing to confine
    expect(
      verifyReportSignature(res.report, res.signature!, publicKeyFromPrivate(keypair.privateKeyPem)),
    ).toBe(true)

    const fetched = await caller.verifiedDeploy.get({ id: res.report.reportId })
    expect(fetched.signed).toBe(true)
    expect(fetched.report.stackId).toBe(stack.id)
    expect(verifyReportSignature(fetched.report, fetched.signature!, keypair.publicKeyPem)).toBe(true)
  })

  it('owner-gates generate: another user cannot generate for the stack', async () => {
    const owner = await createCaller('vd-owner')
    const stack = await seedStack(owner)
    const intruder = await createCaller('vd-intruder')
    await expect(intruder.verifiedDeploy.generate({ stackId: stack.id })).rejects.toThrow(/Access denied/i)
  })

  it('produces an unsigned draft when no signing key is configured', async () => {
    delete process.env.VERIFIED_DEPLOY_SIGNING_KEY
    const caller = await createCaller('vd-user-1')
    const stack = await seedStack(caller)
    const res = await caller.verifiedDeploy.generate({ stackId: stack.id })
    expect(res.signed).toBe(false)
    expect(res.signature).toBeNull()
  })
})

describe('verifiedDeploy router — hosted (billing on)', () => {
  beforeEach(() => {
    process.env.BILLING_ENABLED = 'true'
    process.env.VERIFIED_DEPLOY_SIGNING_KEY = keypair.privateKeyPem
  })
  afterEach(() => {
    delete process.env.BILLING_ENABLED
    delete process.env.VERIFIED_DEPLOY_SIGNING_KEY
  })

  it('blocks generate without a paid credit and points to purchase', async () => {
    const caller = await createCaller('vd-hosted-1')
    const stack = await seedStack(caller)
    await expect(caller.verifiedDeploy.generate({ stackId: stack.id })).rejects.toThrow(
      /No verified-deploy credit/i,
    )
  })
})
