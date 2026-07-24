import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { readFileSync, statSync, writeFileSync, mkdtempSync } from 'fs'
import os from 'os'
import path from 'path'

// Mock child_process.spawn so we never open a real SSH connection.
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, default: { ...actual, spawn: spawnMock }, spawn: spawnMock }
})

import {
  runRemoteCompose,
  buildSshArgs,
  resolveDeployKeyFile,
  resolveDeployPublicKey,
  assertSafeHost,
  assertSafeUser,
  assertSafePort,
} from '../remote-compose-executor'

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  stdin: { end: ReturnType<typeof vi.fn> }
}

/** A child that immediately closes with `code`, optionally emitting stdout lines. */
function fakeChild(code = 0, stdout: string[] = []): FakeChild {
  const child = new EventEmitter() as FakeChild
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin = { end: vi.fn() }
  setImmediate(() => {
    for (const line of stdout) child.stdout.emit('data', Buffer.from(line))
    child.emit('close', code)
  })
  return child
}

const KEY = '/secrets/deploy_key'

describe('assertSafeHost / assertSafeUser / assertSafePort', () => {
  it('accepts plain hostnames, IPv4 and normal users/ports', () => {
    expect(() => assertSafeHost('192.168.178.13')).not.toThrow()
    expect(() => assertSafeHost('host.example.com')).not.toThrow()
    expect(() => assertSafeUser('serveradmin')).not.toThrow()
    expect(() => assertSafePort(22)).not.toThrow()
  })

  it('rejects shell metacharacters in host and user', () => {
    for (const bad of ['h;rm -rf /', 'h && x', 'h|x', 'h`id`', 'h$(id)', 'h host', 'h>x', 'a@b']) {
      expect(() => assertSafeHost(bad)).toThrow(/Invalid SSH host/)
    }
    for (const bad of ['root;id', 'r m', 'r|x', 'r$(x)', 'a/b']) {
      expect(() => assertSafeUser(bad)).toThrow(/Invalid SSH user/)
    }
  })

  it('rejects out-of-range / non-integer ports', () => {
    expect(() => assertSafePort(0)).toThrow(/Invalid SSH port/)
    expect(() => assertSafePort(70000)).toThrow(/Invalid SSH port/)
    expect(() => assertSafePort(22.5)).toThrow(/Invalid SSH port/)
  })
})

describe('buildSshArgs', () => {
  it('hardens ssh: BatchMode (key-only, no password), accept-new host key, identity, timeout', () => {
    const args = buildSshArgs({
      host: '192.168.178.13',
      sshUser: 'serveradmin',
      sshPort: 2222,
      keyFile: KEY,
      remoteCommand: 'echo hi',
    })
    // BatchMode=yes is the no-password guarantee — ssh fails instead of prompting.
    expect(args).toContain('BatchMode=yes')
    expect(args).toContain('StrictHostKeyChecking=accept-new')
    expect(args).toContain('IdentitiesOnly=yes')
    expect(args.some((a) => a.startsWith('ConnectTimeout='))).toBe(true)
    // Key + port + single user@host argv element (no shell interpolation).
    expect(args).toEqual(expect.arrayContaining(['-i', KEY, '-p', '2222', 'serveradmin@192.168.178.13']))
    expect(args[args.length - 1]).toBe('echo hi')
    // NEVER any password material.
    expect(args.join(' ')).not.toMatch(/password/i)
  })
})

describe('runRemoteCompose', () => {
  beforeEach(() => spawnMock.mockReset())

  it('stages the compose over stdin then runs `docker compose ... up -d` over SSH', async () => {
    const children: FakeChild[] = []
    spawnMock.mockImplementation(() => {
      const c = fakeChild(0, children.length === 1 ? ['Container bms-abc-web-1  Started\n'] : [])
      children.push(c)
      return c
    })

    const lines: string[] = []
    const result = await runRemoteCompose({
      project: 'bms-abc',
      composeYaml: 'services:\n  web:\n    image: nginx\n',
      action: 'up',
      host: '192.168.178.13',
      sshUser: 'serveradmin',
      sshPort: 22,
      keyFile: KEY,
      onLog: (l) => lines.push(l),
    })

    expect(result.exitCode).toBe(0)
    // Two ssh invocations: [0] stage (writes YAML to stdin), [1] compose up.
    expect(spawnMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[0][0]).toBe('ssh')

    const stageArgs = spawnMock.mock.calls[0][1] as string[]
    expect(stageArgs).toContain('BatchMode=yes')
    expect(stageArgs[stageArgs.length - 1]).toMatch(/mkdir -p .*\.bms\/bms-abc.* && cat > .*docker-compose\.yml/)
    // The compose YAML is piped to the stage step's stdin (not an argv/scp path).
    expect(children[0].stdin.end).toHaveBeenCalledWith('services:\n  web:\n    image: nginx\n')

    const runArgs = spawnMock.mock.calls[1][1] as string[]
    const runCmd = runArgs[runArgs.length - 1]
    expect(runCmd).toMatch(/cd .*\.bms\/bms-abc/)
    expect(runCmd).toContain('docker compose -p bms-abc up -d --remove-orphans')
    // Both steps target the same hardened user@host.
    expect(runArgs).toContain('serveradmin@192.168.178.13')

    // Streamed remote output reached onLog.
    expect(lines).toContain('Container bms-abc-web-1  Started')
  })

  it('uses `down --remove-orphans` for the teardown action', async () => {
    spawnMock.mockImplementation(() => fakeChild(0))
    const result = await runRemoteCompose({
      project: 'bms-xyz',
      composeYaml: 'services: {}\n',
      action: 'down',
      host: 'host.example.com',
      sshUser: 'deploy',
      keyFile: KEY,
      onLog: () => undefined,
    })
    expect(result.exitCode).toBe(0)
    const runArgs = spawnMock.mock.calls[1][1] as string[]
    expect(runArgs[runArgs.length - 1]).toContain('docker compose -p bms-xyz down --remove-orphans')
  })

  it('defaults the SSH port to 22 when none is given', async () => {
    spawnMock.mockImplementation(() => fakeChild(0))
    await runRemoteCompose({
      project: 'bms-abc',
      composeYaml: '',
      action: 'up',
      host: 'h.example.com',
      sshUser: 'deploy',
      keyFile: KEY,
      onLog: () => undefined,
    })
    expect(spawnMock.mock.calls[0][1]).toEqual(expect.arrayContaining(['-p', '22']))
  })

  it('returns the stage exit code and does NOT run compose if staging fails', async () => {
    spawnMock.mockImplementation(() => fakeChild(255)) // ssh auth/connect failure
    const result = await runRemoteCompose({
      project: 'bms-abc',
      composeYaml: 'x',
      action: 'up',
      host: 'h.example.com',
      sshUser: 'deploy',
      keyFile: KEY,
      onLog: () => undefined,
    })
    expect(result.exitCode).toBe(255)
    expect(spawnMock).toHaveBeenCalledTimes(1) // stage only; compose skipped
  })

  it('refuses a non-bms project (infra guard) without spawning ssh', async () => {
    await expect(
      runRemoteCompose({
        project: 'stapelwerk',
        composeYaml: '',
        action: 'up',
        host: 'h.example.com',
        sshUser: 'deploy',
        keyFile: KEY,
        onLog: () => undefined,
      }),
    ).rejects.toThrow(/non-bms/)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses a bms- project name with shell metacharacters (remote injection guard)', async () => {
    await expect(
      runRemoteCompose({
        project: 'bms-x; rm -rf /',
        composeYaml: '',
        action: 'up',
        host: 'h.example.com',
        sshUser: 'deploy',
        keyFile: KEY,
        onLog: () => undefined,
      }),
    ).rejects.toThrow(/unsafe project/)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('rejects a host with shell metacharacters without spawning ssh', async () => {
    await expect(
      runRemoteCompose({
        project: 'bms-abc',
        composeYaml: '',
        action: 'up',
        host: 'evil.com; rm -rf /',
        sshUser: 'deploy',
        keyFile: KEY,
        onLog: () => undefined,
      }),
    ).rejects.toThrow(/Invalid SSH host/)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('rejects a user with shell metacharacters without spawning ssh', async () => {
    await expect(
      runRemoteCompose({
        project: 'bms-abc',
        composeYaml: '',
        action: 'up',
        host: 'h.example.com',
        sshUser: 'root;id',
        keyFile: KEY,
        onLog: () => undefined,
      }),
    ).rejects.toThrow(/Invalid SSH user/)
    expect(spawnMock).not.toHaveBeenCalled()
  })
})

describe('resolveDeployKeyFile', () => {
  afterEach(() => {
    delete process.env.DEPLOY_SSH_KEY_FILE
    delete process.env.DEPLOY_SSH_KEY
  })

  it('stages DEPLOY_SSH_KEY_FILE contents to a private same-user copy', () => {
    // The configured key may be owned by another uid (app generates as 1001,
    // ws runs ssh as root), so the resolver re-stages a 0600 copy per call
    // instead of returning the mounted path verbatim.
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bms-test-key-'))
    const source = path.join(dir, 'id_ed25519')
    writeFileSync(source, '-----BEGIN OPENSSH PRIVATE KEY-----\nxyz\n-----END-----\n')
    process.env.DEPLOY_SSH_KEY_FILE = source

    const staged = resolveDeployKeyFile()
    expect(staged).not.toBe(source)
    expect(readFileSync(staged, 'utf-8')).toContain('BEGIN OPENSSH PRIVATE KEY')
    expect(statSync(staged).mode & 0o777).toBe(0o600)
  })

  it('throws when DEPLOY_SSH_KEY_FILE points at an unreadable path', () => {
    process.env.DEPLOY_SSH_KEY_FILE = '/nonexistent/deploy_key'
    expect(() => resolveDeployKeyFile()).toThrow(/not readable/)
  })

  it('stages DEPLOY_SSH_KEY to a private (0600) temp file', () => {
    process.env.DEPLOY_SSH_KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END-----'
    const file = resolveDeployKeyFile()
    expect(readFileSync(file, 'utf-8')).toContain('BEGIN OPENSSH PRIVATE KEY')
    // Owner-only permissions (ssh refuses world-readable keys).
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('throws when no key is configured — there is NO password fallback', () => {
    expect(() => resolveDeployKeyFile()).toThrow(/No deploy SSH key configured/)
  })
})

describe('resolveDeployPublicKey', () => {
  afterEach(() => {
    delete process.env.DEPLOY_SSH_PUBKEY
    delete process.env.DEPLOY_SSH_KEY_FILE
    delete process.env.DEPLOY_SSH_KEY
  })

  it('returns the explicit DEPLOY_SSH_PUBKEY when set (public keys are not secret)', () => {
    process.env.DEPLOY_SSH_PUBKEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1 deploy@stapelwerk'
    expect(resolveDeployPublicKey()).toEqual({
      configured: true,
      publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1 deploy@stapelwerk',
    })
  })

  it('reports not-configured when no key material exists at all', () => {
    expect(resolveDeployPublicKey()).toEqual({ configured: false })
  })
})
