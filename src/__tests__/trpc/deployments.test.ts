import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { createTRPCContext } from '@/server/trpc'
import { appRouter } from '@/server/root'
import { cleanupTestData, createTestData } from '../helpers/test-data-factory'

const createCaller = async (userId?: string) => {
  const ctx = await createTRPCContext({
    userId,
    req: {} as any,
    res: {} as any,
  })
  return appRouter.createCaller(ctx)
}

describe('tRPC Deployments Router', () => {
  beforeEach(async () => {
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('targets CRUD', () => {
    it('should require authentication', async () => {
      const caller = await createCaller() // no user
      await expect(
        caller.deployments.createTarget({ name: 'Local K3s', type: 'kubernetes', provider: 'self-managed' })
      ).rejects.toThrow('Unauthorized')
    })

    it('should create, list, get, update, and delete a deployment target', async () => {
      const caller = await createCaller('user-1')

      const created = await caller.deployments.createTarget({
        name: 'Local K3s',
        type: 'kubernetes',
        provider: 'self-managed',
        config: { kubecontext: 'default' },
      })

      expect(created).toMatchObject({
        name: 'Local K3s',
        type: 'kubernetes',
        provider: 'self-managed',
        userId: 'user-1',
      })
      expect(created.id).toBeTruthy()

      const list = await caller.deployments.listTargets({})
      expect(list.targets.length).toBe(1)

      const got = await caller.deployments.getTarget({ id: created.id })
      expect(got.name).toBe('Local K3s')

      const updated = await caller.deployments.updateTarget({ id: created.id, name: 'Local K3s (Home)' })
      expect(updated.name).toBe('Local K3s (Home)')

      const deleted = await caller.deployments.deleteTarget({ id: created.id })
      expect(deleted.success).toBe(true)

      const listAfter = await caller.deployments.listTargets({})
      expect(listAfter.targets.length).toBe(0)
    })

    it('rejects a remote SSH target without the liability acknowledgment', async () => {
      const caller = await createCaller('user-1')
      await expect(
        caller.deployments.createTarget({
          name: 'HomeLab',
          type: 'docker',
          provider: 'ssh',
          location: 'remote',
          host: '192.168.1.20',
          sshUser: 'deploy',
        }),
      ).rejects.toThrow(/acknowledge the deploy-key liability/i)
    })

    it('accepts a remote SSH target once the liability is acknowledged, and records the timestamp', async () => {
      const caller = await createCaller('user-1')
      const created = await caller.deployments.createTarget({
        name: 'HomeLab',
        type: 'docker',
        provider: 'ssh',
        location: 'remote',
        host: '192.168.1.20',
        sshUser: 'deploy',
        riskAcknowledged: true,
      })
      expect(created.location).toBe('remote')
      expect((created as { riskAcknowledgedAt?: Date | null }).riskAcknowledgedAt).toBeTruthy()
    })
  })

  describe('overrides upsert/list', () => {
    it('should upsert and list overrides for a target and service', async () => {
      const caller = await createCaller('user-1')

      // Create supporting data
      const category = await createTestData.category({ name: 'K8s', slug: 'k8s', description: 'k8s' } as any)
      const service = await createTestData.service({ name: 'Nginx', slug: 'nginx', categoryId: category.id } as any)

      const target = await caller.deployments.createTarget({
        name: 'Local K3s',
        type: 'kubernetes',
        provider: 'self-managed',
      })

      const upserted = await caller.deployments.upsertOverride({
        targetId: target.id,
        serviceId: service.id,
        overrides: {
          resources: { requests: { cpu: '100m', memory: '128Mi' } },
          ingress: { enabled: true, host: 'app.local' },
        },
      })

      expect(upserted.targetId).toBe(target.id)
      expect(upserted.serviceId).toBe(service.id)

      const overrides = await caller.deployments.listOverrides({ targetId: target.id })
      expect(overrides.items.length).toBe(1)
    })
  })

  describe('artifacts create/list', () => {
    it('should create artifact and list by stack', async () => {
      const caller = await createCaller('user-1')

      // Create a simple stack so we have a stackId
      const stack = await caller.stacks.create({ name: 'My Stack' })

      const target = await caller.deployments.createTarget({
        name: 'Local K3s',
        type: 'kubernetes',
        provider: 'self-managed',
      })

      const artifact = await caller.deployments.createArtifact({
        stackId: stack.id,
        targetId: target.id,
        type: 'yaml',
        checksum: 'abc123',
        location: '/tmp/artifacts/my-stack.yaml',
        metadata: { note: 'test' },
      })

      expect(artifact.type).toBe('yaml')

      const list = await caller.deployments.listArtifacts({ stackId: stack.id })
      expect(list.items.length).toBe(1)
    })
  })

  describe('jobs create/get/logs', () => {
    it('should create export job and get status/logs', async () => {
      const caller = await createCaller('user-1')

      const stack = await caller.stacks.create({ name: 'My Stack' })
      const target = await caller.deployments.createTarget({ name: 'Local K3s', type: 'kubernetes', provider: 'self-managed' })

      const job = await caller.deployments.createJob({
        mode: 'export',
        stackId: stack.id,
        targetId: target.id,
      })

      expect(job.mode).toBe('export')
      expect(job.status).toBe('queued')

      const got = await caller.deployments.getJob({ id: job.id })
      expect(got.id).toBe(job.id)

      const logs = await caller.deployments.getJobLogs({ id: job.id })
      expect(Array.isArray(logs.entries)).toBe(true)
      expect(logs.entries.length).toBe(0)
    })
  })
})
