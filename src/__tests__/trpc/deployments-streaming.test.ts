import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the real docker executor so tests never touch a Docker daemon, while
// keeping the project-name / container_name helpers real.
const { runComposeMock } = vi.hoisted(() => ({ runComposeMock: vi.fn() }))
vi.mock('@/lib/deploy/compose-executor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/deploy/compose-executor')>()
  return { ...actual, runCompose: runComposeMock }
})

// Mock the remote SSH executor too, and stub the key resolver so the remote
// path never touches a real key/host in tests.
const { runRemoteComposeMock } = vi.hoisted(() => ({ runRemoteComposeMock: vi.fn() }))
vi.mock('@/lib/deploy/remote-compose-executor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/deploy/remote-compose-executor')>()
  return { ...actual, runRemoteCompose: runRemoteComposeMock, resolveDeployKeyFile: () => '/fake/deploy-key' }
})

import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import { createTestData } from '../helpers/test-data-factory'

async function createCaller(userId?: string) {
  const ctx = await createTRPCContext({ userId })
  return appRouter.createCaller(ctx)
}

async function waitForStatus(
  caller: Awaited<ReturnType<typeof createCaller>>,
  id: string,
  target: string,
  timeoutMs = 5000,
) {
  const start = Date.now()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const s = await caller.deployments.getJobStatus({ id })
    if (s.status === target) return s
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for status ${target}, got ${s.status}`)
    await new Promise((r) => setTimeout(r, 40))
  }
}

/** Seed a stack owned by `userId` with one real service so compose assembles. */
async function seedStackWithService(caller: Awaited<ReturnType<typeof createCaller>>) {
  const suffix = Math.random().toString(36).slice(2, 8)
  const category = await createTestData.category({ name: `Cat ${suffix}`, slug: `cat-${suffix}` })
  const service = await createTestData.service({
    name: `Web ${suffix}`,
    slug: `web-${suffix}`,
    categoryId: category.id,
    dockerImage: 'nginx',
    version: 'alpine',
  })
  const stack = await caller.stacks.create({
    name: `Deploy Stack ${suffix}`,
    services: [{ serviceId: service.id }],
  })
  return stack
}

describe('Deployments 3.5: Status polling and log tailing', () => {
  let caller: Awaited<ReturnType<typeof createCaller>>
  beforeEach(async () => {
    caller = await createCaller('user-1')
  })

  it('polls job status across transitions', async () => {
    const stack = await caller.stacks.create({ name: 'Status Stack' })
    const job = await caller.deployments.createJob({ mode: 'apply', stackId: stack.id })

    // initial
    let status = await caller.deployments.getJobStatus({ id: job.id })
    expect(status.status).toBe('queued')

    // start -> running
    await caller.deployments.startApply({ id: job.id })
    status = await caller.deployments.getJobStatus({ id: job.id })
    expect(status.status).toBe('running')

    // finish -> succeeded
    await caller.deployments.finishApply({ id: job.id, success: true })
    status = await caller.deployments.getJobStatus({ id: job.id })
    expect(status.status).toBe('succeeded')
  })

  it('tails logs using since timestamp', async () => {
    const stack = await caller.stacks.create({ name: 'Logs Stack' })
    const job = await caller.deployments.createJob({ mode: 'apply', stackId: stack.id })

    // No logs yet
    let tail = await caller.deployments.getJobLogTail({ id: job.id, since: 0 })
    expect(Array.isArray(tail.entries)).toBe(true)
    expect(tail.entries.length).toBe(0)

    // Start apply -> adds one log
    await caller.deployments.startApply({ id: job.id })
    tail = await caller.deployments.getJobLogTail({ id: job.id, since: 0 })
    expect(tail.entries.length).toBeGreaterThan(0)
    const marker = tail.lastTimestamp

    // Finish apply -> adds another log (pause so it lands strictly after `marker`)
    await new Promise((resolve) => setTimeout(resolve, 2))
    await caller.deployments.finishApply({ id: job.id, success: true })
    const next = await caller.deployments.getJobLogTail({ id: job.id, since: marker })
    expect(next.entries.length).toBeGreaterThan(0)
  })
})

describe('Deployments: direct deploy to this server (deployStack/stopStack)', () => {
  let caller: Awaited<ReturnType<typeof createCaller>>
  beforeEach(async () => {
    caller = await createCaller('user-1')
    runComposeMock.mockReset()
    runComposeMock.mockImplementation(async ({ project, action, onLog }: any) => {
      onLog(`$ docker compose -p ${project} ${action} -d`)
      onLog('Container web-1  Started')
      return { exitCode: 0 }
    })
  })

  it('creates a real apply job, invokes the executor with a bms- project, and streams logs', async () => {
    const stack = await seedStackWithService(caller)

    const job = await caller.deployments.deployStack({ stackId: stack.id })
    expect(job.mode).toBe('apply')
    expect(job.status).toBe('running')

    // Executor invoked with a safe bms- project + up action
    expect(runComposeMock).toHaveBeenCalledTimes(1)
    const call = runComposeMock.mock.calls[0][0]
    expect(call.project).toMatch(/^bms-/)
    expect(call.action).toBe('up')
    expect(typeof call.composeYaml).toBe('string')
    expect(call.composeYaml).toContain('nginx')

    // Background job settles to succeeded with real streamed output in the logs
    const settled = await waitForStatus(caller, job.id, 'succeeded')
    expect(settled.status).toBe('succeeded')
    const logs = await caller.deployments.getJobLogTail({ id: job.id, since: 0 })
    const text = JSON.stringify(logs.entries)
    expect(text).toMatch(/Container web-1  Started/)
    expect(text).toMatch(/Deployment succeeded/)
  })

  it('marks the job failed when the executor exits non-zero', async () => {
    runComposeMock.mockImplementation(async ({ onLog }: any) => {
      onLog('Error response from daemon: boom')
      return { exitCode: 1 }
    })
    const stack = await seedStackWithService(caller)
    const job = await caller.deployments.deployStack({ stackId: stack.id })
    const settled = await waitForStatus(caller, job.id, 'failed')
    expect(settled.status).toBe('failed')
  })

  it('rejects deploying a stack with no services', async () => {
    const stack = await caller.stacks.create({ name: `Empty ${Math.random().toString(36).slice(2, 8)}` })
    await expect(caller.deployments.deployStack({ stackId: stack.id })).rejects.toThrow(/no services/i)
    expect(runComposeMock).not.toHaveBeenCalled()
  })

  it('enforces stack ownership on deploy and stop', async () => {
    const stack = await seedStackWithService(caller)
    const other = await createCaller('user-2')
    await expect(other.deployments.deployStack({ stackId: stack.id })).rejects.toThrow(/Access denied/)
    await expect(other.deployments.stopStack({ stackId: stack.id })).rejects.toThrow(/Access denied/)
  })

  it('stopStack tears the project down via the executor', async () => {
    const stack = await seedStackWithService(caller)
    const job = await caller.deployments.stopStack({ stackId: stack.id })
    expect(job.mode).toBe('destroy')
    expect(runComposeMock).toHaveBeenCalledTimes(1)
    expect(runComposeMock.mock.calls[0][0].action).toBe('down')
    const settled = await waitForStatus(caller, job.id, 'succeeded')
    expect(settled.status).toBe('succeeded')
  })

  it('listJobs returns the stack deployment history', async () => {
    const stack = await seedStackWithService(caller)
    await caller.deployments.deployStack({ stackId: stack.id })
    const { jobs } = await caller.deployments.listJobs({ stackId: stack.id })
    expect(jobs.length).toBeGreaterThan(0)
    expect(jobs[0].mode).toBe('apply')
  })
})

// Proves the REMOTE path: a `targetId` for a remote SSH target routes deploy/stop
// through the remote executor (not the local socket one), owner-gated.
describe('Deployments: remote SSH target (deployStack/stopStack with a remote targetId)', () => {
  let caller: Awaited<ReturnType<typeof createCaller>>
  beforeEach(async () => {
    caller = await createCaller('user-1')
    runComposeMock.mockReset()
    runRemoteComposeMock.mockReset()
    runRemoteComposeMock.mockImplementation(async ({ project, action, host, sshUser, onLog }: any) => {
      onLog(`$ ssh ${sshUser}@${host} docker compose -p ${project} ${action}`)
      onLog('Container bms-remote-web-1  Started')
      return { exitCode: 0 }
    })
  })

  const createRemoteTarget = (c = caller) =>
    c.deployments.createTarget({
      name: 'HomeLab',
      type: 'docker',
      provider: 'ssh',
      location: 'remote',
      host: '192.168.178.13',
      sshUser: 'serveradmin',
      sshPort: 22,
    })

  it('routes deployStack(remote targetId) to the remote executor with the target host/user/key', async () => {
    const stack = await seedStackWithService(caller)
    const target = await createRemoteTarget()
    const job = await caller.deployments.deployStack({ stackId: stack.id, targetId: target.id })

    // Remote path only — the local socket executor is untouched.
    expect(runComposeMock).not.toHaveBeenCalled()
    expect(runRemoteComposeMock).toHaveBeenCalledTimes(1)
    const call = runRemoteComposeMock.mock.calls[0][0]
    expect(call.project).toMatch(/^bms-/)
    expect(call.action).toBe('up')
    expect(call.host).toBe('192.168.178.13')
    expect(call.sshUser).toBe('serveradmin')
    expect(call.sshPort).toBe(22)
    expect(call.keyFile).toBe('/fake/deploy-key') // server-side key, never a password

    const settled = await waitForStatus(caller, job.id, 'succeeded')
    expect(settled.status).toBe('succeeded')
    const logs = await caller.deployments.getJobLogTail({ id: job.id, since: 0 })
    expect(JSON.stringify(logs.entries)).toMatch(/Container bms-remote-web-1  Started/)
  })

  it('routes stopStack(remote targetId) to the remote executor with the down action', async () => {
    const stack = await seedStackWithService(caller)
    const target = await createRemoteTarget()
    const job = await caller.deployments.stopStack({ stackId: stack.id, targetId: target.id })
    expect(job.mode).toBe('destroy')
    expect(runComposeMock).not.toHaveBeenCalled()
    expect(runRemoteComposeMock).toHaveBeenCalledTimes(1)
    expect(runRemoteComposeMock.mock.calls[0][0].action).toBe('down')
  })

  it('a local docker target still uses the local (socket) executor', async () => {
    runComposeMock.mockImplementation(async ({ onLog }: any) => { onLog('local'); return { exitCode: 0 } })
    const stack = await seedStackWithService(caller)
    const local = await caller.deployments.createTarget({ name: 'This', type: 'docker', provider: 'socket', location: 'local' })
    await caller.deployments.deployStack({ stackId: stack.id, targetId: local.id })
    expect(runRemoteComposeMock).not.toHaveBeenCalled()
    expect(runComposeMock).toHaveBeenCalledTimes(1)
  })

  it('owner-gates the target: rejects a targetId the deploying user does not own', async () => {
    const stack = await seedStackWithService(caller) // user-1 owns the stack
    const other = await createCaller('user-2')
    const foreign = await createRemoteTarget(other) // but user-2 owns the target
    await expect(
      caller.deployments.deployStack({ stackId: stack.id, targetId: foreign.id }),
    ).rejects.toThrow(/Deployment target not found/)
    expect(runRemoteComposeMock).not.toHaveBeenCalled()
  })

  it('rejects creating a remote target with shell metacharacters in the host (no password field)', async () => {
    await expect(
      caller.deployments.createTarget({
        name: 'bad', type: 'docker', provider: 'ssh', location: 'remote',
        host: 'evil.com; rm -rf /', sshUser: 'serveradmin',
      }),
    ).rejects.toThrow()
  })

  it('rejects a remote target missing host/sshUser', async () => {
    await expect(
      caller.deployments.createTarget({ name: 'bad', type: 'docker', provider: 'ssh', location: 'remote' }),
    ).rejects.toThrow()
  })
})

// Proves the DEPLOYED-app path: with DEPLOY_BRIDGE_URL set, the router delegates
// docker exec to the ws process over HTTP (NDJSON) instead of running it in-proc.
describe('Deployments: deploy via the ws bridge (deployed-app path)', () => {
  const originalFetch = global.fetch
  let caller: Awaited<ReturnType<typeof createCaller>>

  beforeEach(async () => {
    caller = await createCaller('user-1')
    process.env.DEPLOY_BRIDGE_URL = 'http://ws.test:3001'
    process.env.DEPLOY_BRIDGE_TOKEN = 'bridge-secret'
    // The bridge helper hits global.fetch; return an NDJSON stream like the ws
    // /deploy endpoint would. runComposeMock must NOT be used on this path.
    runComposeMock.mockReset()
    global.fetch = vi.fn(async () => {
      const enc = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(enc.encode('{"log":"$ docker compose -p bms-x up -d"}\n'))
          controller.enqueue(enc.encode('{"log":"Container web-1  Started"}\n'))
          controller.enqueue(enc.encode('{"exitCode":0}\n'))
          controller.close()
        },
      })
      return { ok: true, status: 200, statusText: 'OK', body, text: async () => '' }
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.DEPLOY_BRIDGE_URL
    delete process.env.DEPLOY_BRIDGE_TOKEN
    vi.restoreAllMocks()
  })

  it('routes deployStack through the bridge and streams the ws output into the job', async () => {
    const stack = await seedStackWithService(caller)
    const job = await caller.deployments.deployStack({ stackId: stack.id })

    // Bridge path used the HTTP endpoint, not the in-process executor.
    expect(runComposeMock).not.toHaveBeenCalled()
    const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[0]).toBe('http://ws.test:3001/deploy')
    expect(fetchCall[1].headers.Authorization).toBe('Bearer bridge-secret')

    const settled = await waitForStatus(caller, job.id, 'succeeded')
    expect(settled.status).toBe('succeeded')
    const logs = await caller.deployments.getJobLogTail({ id: job.id, since: 0 })
    const text = JSON.stringify(logs.entries)
    expect(text).toMatch(/Container web-1  Started/)
    expect(text).toMatch(/Deployment succeeded/)
  })
})
