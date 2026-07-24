/**
 * Terminal executor — selection (docker/ssh) and auth gate.
 * Mocks http.request / child_process.spawn / next-auth decode with PLAIN
 * functions: global mockReset (vitest.config) wipes vi.fn() implementations
 * per test, and jose's real crypto rejects jsdom's cross-realm Uint8Array.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WebSocket } from 'ws'

const httpRequests: Array<Record<string, unknown>> = []
vi.mock('http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('http')>()
  // Plain function, not vi.fn(): survives global mockReset
  const request = function request(options: Record<string, unknown>): unknown {
    httpRequests.push(options)
    return { on() {}, write() {}, end() {}, destroy() {} }
  }
  return { ...actual, default: { ...actual, request }, request }
})

const spawnCalls: Array<{ cmd: string; args: string[] }> = []
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  const spawn = function spawn(cmd: string, args: string[]): unknown {
    spawnCalls.push({ cmd, args })
    return {
      stdout: { on() {} },
      stderr: { on() {} },
      stdin: { write() {} },
      on() {},
      kill() {},
    }
  }
  return { ...actual, default: { ...actual, spawn }, spawn }
})

vi.mock('next-auth/jwt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth/jwt')>()
  const decode = async function decode({ token, secret }: { token?: string | null; secret: string }): Promise<{ sub: string } | null> {
    if (token === 'valid-token' && secret === 'test-secret') return { sub: 'user-1' }
    // Mirrors real next-auth behavior: a token crafted against the empty
    // secret decodes "successfully" when verified with secret ''.
    if (token === 'empty-secret-token' && secret === '') return { sub: 'forged-user' }
    if (token) throw new Error('decryption failed')
    return null
  }
  return { ...actual, decode }
})

import { attachTerminalExecutor, authenticateUpgrade } from '~/server/terminal-executor'
import { terminalEmitter, createTerminalSession, closeTerminalSession } from '@/server/ws'

function fakeClient(): { ws: WebSocket; messages: () => Array<{ type: string; payload: Record<string, unknown> }> } {
  const sent: string[] = []
  const ws = { send: (data: string) => { sent.push(data) }, readyState: 1 } as unknown as WebSocket
  return { ws, messages: () => sent.map((raw) => JSON.parse(raw)) }
}

const ENV_KEYS = [
  'TERMINAL_EXECUTOR',
  'TERMINAL_CONTAINER_PREFIX',
  'TERMINAL_DEFAULT_CONTAINER',
  'TERMINAL_SSH_TARGET',
  'NEXTAUTH_SECRET',
] as const
const savedEnv: Record<string, string | undefined> = {}
const createdSessions: string[] = []

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
  httpRequests.length = 0
  spawnCalls.length = 0
})

afterEach(() => {
  for (const id of createdSessions.splice(0)) closeTerminalSession(id)
  terminalEmitter.removeAllListeners()
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

describe('terminal executor', () => {
  it('authenticateUpgrade accepts a valid next-auth JWT and rejects invalid/missing tokens', async () => {
    process.env.NEXTAUTH_SECRET = 'test-secret'

    await expect(authenticateUpgrade('other=1; next-auth.session-token=valid-token')).resolves.toBe('user-1')
    await expect(authenticateUpgrade('next-auth.session-token=garbage')).resolves.toBeUndefined()
    await expect(authenticateUpgrade(undefined)).resolves.toBeUndefined()
  })

  it('authenticateUpgrade fails closed when NEXTAUTH_SECRET is unset — empty-secret tokens must not verify', async () => {
    delete process.env.NEXTAUTH_SECRET

    await expect(authenticateUpgrade('next-auth.session-token=empty-secret-token')).resolves.toBeUndefined()
  })

  // Docker mode is gated on ownership: the WS user must own the stack, and
  // the container must belong to the stack's own compose project.
  const seedStack = async (stackId: string, ownerId: string, slug = 'nextcloud') => {
    const { PrismaClient } = await import('@prisma/client')
    const prisma: any = new PrismaClient()
    await prisma.stacks.create({
      data: { id: stackId, name: stackId, slug: stackId, userId: ownerId, updatedAt: new Date() },
    })
    const service = await prisma.services.create({
      data: { name: slug, slug, dockerImage: `${slug}:latest`, description: '', categoryId: 1, updatedAt: new Date() },
    })
    await prisma.stack_services.create({
      data: { id: `${stackId}-ss`, stackId, serviceId: service.id, order: 0, updatedAt: new Date() },
    })
    return async () => {
      await prisma.stack_services.deleteMany({ where: { stackId } })
      await prisma.services.deleteMany({ where: { id: service.id } })
      await prisma.stacks.deleteMany({ where: { id: stackId } })
    }
  }

  it("docker mode execs into the stack's first service container (owner)", async () => {
    process.env.TERMINAL_EXECUTOR = 'docker'
    const cleanup = await seedStack('s1', 'u1')
    attachTerminalExecutor()

    const { ws } = fakeClient()
    createdSessions.push(await createTerminalSession(ws, 'u1', { stackId: 's1' }))
    await new Promise((r) => setTimeout(r, 10)) // authorize is async

    expect(httpRequests).toHaveLength(1)
    expect(httpRequests[0].socketPath).toBe('/var/run/docker.sock')
    expect(httpRequests[0].path).toBe('/containers/bms-s1-nextcloud-1/exec')
    expect(spawnCalls).toHaveLength(0)
    await cleanup()
  })

  it("docker mode refuses another user's stack", async () => {
    process.env.TERMINAL_EXECUTOR = 'docker'
    const cleanup = await seedStack('s2', 'owner-2')
    attachTerminalExecutor()

    const { ws, messages } = fakeClient()
    const sessionId = await createTerminalSession(ws, 'intruder', { stackId: 's2' })
    await new Promise((r) => setTimeout(r, 10))

    expect(httpRequests).toHaveLength(0)
    const close = messages().find((m) => m.type === 'terminal' && m.payload.action === 'close')
    expect(close?.payload).toMatchObject({ sessionId, exitCode: 1 })
    await cleanup()
  })

  it("docker mode refuses containers outside the stack's compose project", async () => {
    process.env.TERMINAL_EXECUTOR = 'docker'
    const cleanup = await seedStack('s3', 'u1')
    attachTerminalExecutor()

    const { ws, messages } = fakeClient()
    // Owner, but trying to reach the app's own infra container.
    const sessionId = await createTerminalSession(ws, 'u1', { stackId: 's3', containerId: 'stapelwerk_postgres' })
    await new Promise((r) => setTimeout(r, 10))

    expect(httpRequests).toHaveLength(0)
    const close = messages().find((m) => m.type === 'terminal' && m.payload.action === 'close')
    expect(close?.payload).toMatchObject({ sessionId, exitCode: 1 })
    await cleanup()
  })

  it('ssh mode spawns ssh -tt against TERMINAL_SSH_TARGET', async () => {
    process.env.TERMINAL_EXECUTOR = 'ssh'
    process.env.TERMINAL_SSH_TARGET = 'serveradmin@192.168.178.13'
    attachTerminalExecutor()

    const { ws } = fakeClient()
    createdSessions.push(await createTerminalSession(ws, 'u1', { stackId: 's1' }))

    expect(spawnCalls).toEqual([
      { cmd: 'ssh', args: ['-tt', '-o', 'BatchMode=yes', 'serveradmin@192.168.178.13'] },
    ])
    expect(httpRequests).toHaveLength(0)
  })
})
