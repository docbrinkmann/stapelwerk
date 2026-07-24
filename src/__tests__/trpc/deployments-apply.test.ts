import { describe, it, expect, beforeEach } from 'vitest'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'

async function createCaller(userId?: string) {
  const ctx = await createTRPCContext({ userId })
  return appRouter.createCaller(ctx)
}

describe('Deployments Apply Orchestration', () => {
  let caller: Awaited<ReturnType<typeof createCaller>>
  beforeEach(async () => {
    caller = await createCaller('user-1')
  })

  it('creates an apply job and processes status transitions with logs', async () => {
    // Prepare a stack
    const stack = await caller.stacks.create({ name: 'Apply Stack' })
    // Create apply job
    const job = await caller.deployments.createJob({ mode: 'apply', stackId: stack.id })
    expect(job.mode).toBe('apply')
    expect(job.status).toBe('queued')

    // Start apply (simulate)
    const started = await caller.deployments.startApply({ id: job.id })
    expect(started.status).toBe('running')

    // Complete apply
    const finished = await caller.deployments.finishApply({ id: job.id, success: true })
    expect(finished.status).toBe('succeeded')

    const logs = await caller.deployments.getJobLogs({ id: job.id })
    expect(Array.isArray(logs.entries)).toBe(true)
    expect(logs.entries.length).toBeGreaterThan(0)
  })

  it('renders CI apply YAML with GitLab Agent context when configured', async () => {
    const target = await caller.deployments.createTarget({
      name: 'GitLab Agent Target',
      type: 'kubernetes',
      provider: 'gitlab',
      config: { apply: { method: 'gitlab-agent', kubeContext: 'project/agent-name' } },
    })
    const res = await caller.deployments.renderApplyCi({ targetId: target.id, manifestPath: 'out.yaml' })
    expect(res.useAgent).toBe(true)
    expect(res.kubeContext).toBe('project/agent-name')
    expect(res.yaml).toContain('export KUBE_CONTEXT=')
  })
})
