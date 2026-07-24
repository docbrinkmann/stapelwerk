import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'

// Mock child_process.spawn so we never touch a real Docker daemon.
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, default: { ...actual, spawn: spawnMock }, spawn: spawnMock }
})

import { sanitizeProjectName, stripContainerNames, runCompose } from '../compose-executor'

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
}

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  return child
}

const ROOT = path.join(os.tmpdir(), 'bms-deploy-test')

describe('sanitizeProjectName', () => {
  it('always prefixes bms- and sanitizes unsafe characters', () => {
    expect(sanitizeProjectName('11111111-2222-3333-4444-555555555555')).toBe(
      'bms-11111111-2222-3333-4444-555555555555',
    )
    expect(sanitizeProjectName('My Stack!!')).toBe('bms-my-stack')
    expect(sanitizeProjectName('')).toBe('bms-stack')
  })

  it('can never collide with the stapelwerk infra project', () => {
    const name = sanitizeProjectName('stapelwerk')
    expect(name).toBe('bms-stapelwerk')
    expect(name.startsWith('bms-')).toBe(true)
    expect(name).not.toBe('stapelwerk')
  })
})

describe('stripContainerNames', () => {
  it('removes container_name from every service but keeps other keys', () => {
    const yaml = [
      'services:',
      '  web:',
      '    image: nginx',
      '    container_name: web',
      '  db:',
      '    image: postgres',
      '    container_name: db',
      'networks:',
      '  appnet:',
      '    driver: bridge',
      '',
    ].join('\n')

    const out = stripContainerNames(yaml)
    expect(out).not.toMatch(/container_name/)
    expect(out).toMatch(/image: nginx/)
    expect(out).toMatch(/image: postgres/)
    expect(out).toMatch(/driver: bridge/)
  })
})

describe('runCompose', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  it('runs `docker compose -p <project> up -d` and streams output', async () => {
    spawnMock.mockImplementation(() => {
      const child = fakeChild()
      setImmediate(() => {
        child.stdout.emit('data', Buffer.from('Container web  Started\n'))
        child.emit('close', 0)
      })
      return child
    })

    const lines: string[] = []
    const result = await runCompose({
      project: 'bms-abc',
      composeYaml: 'services:\n  web:\n    image: nginx\n',
      action: 'up',
      onLog: (l) => lines.push(l),
      rootDir: ROOT,
    })

    expect(result.exitCode).toBe(0)
    // spawn called with docker compose up -d for the bms- project
    const [cmd, args] = spawnMock.mock.calls[0]
    expect(cmd).toBe('docker')
    expect(args).toEqual(['compose', '-p', 'bms-abc', 'up', '-d', '--remove-orphans'])
    // env carries a DOCKER_HOST pointing at the socket
    expect(spawnMock.mock.calls[0][2].env.DOCKER_HOST).toMatch(/docker\.sock/)
    // the streamed line + the echoed command both reached onLog
    expect(lines).toContain('Container web  Started')
    expect(lines.some((l) => l.includes('docker compose -p bms-abc up -d'))).toBe(true)
  })

  it('runs `down` for the teardown action and returns the exit code', async () => {
    spawnMock.mockImplementation(() => {
      const child = fakeChild()
      setImmediate(() => child.emit('close', 1))
      return child
    })

    const result = await runCompose({
      project: 'bms-xyz',
      composeYaml: 'services: {}\n',
      action: 'down',
      onLog: () => undefined,
      rootDir: ROOT,
    })

    expect(result.exitCode).toBe(1)
    expect(spawnMock.mock.calls[0][1]).toEqual(['compose', '-p', 'bms-xyz', 'down', '--remove-orphans'])
  })

  it('refuses to run for a non-bms project (infra guard)', async () => {
    await expect(
      runCompose({ project: 'stapelwerk', composeYaml: '', action: 'up', onLog: () => undefined, rootDir: ROOT }),
    ).rejects.toThrow(/non-bms/)
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
