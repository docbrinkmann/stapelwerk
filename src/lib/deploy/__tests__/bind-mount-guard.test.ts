import { describe, it, expect } from 'vitest'
import { findDangerousBindMount, assertSafeBindMounts } from '../bind-mount-guard'

describe('findDangerousBindMount', () => {
  it('flags the Docker socket', () => {
    expect(findDangerousBindMount([{ hostPath: '/var/run/docker.sock', containerPath: '/x' }]))
      .toBe('/var/run/docker.sock')
  })

  it('flags the host root and sensitive dirs', () => {
    expect(findDangerousBindMount([{ hostPath: '/', containerPath: '/host' }])).toBe('/')
    expect(findDangerousBindMount([{ hostPath: '/etc/shadow', containerPath: '/x' }])).toBe('/etc/shadow')
    expect(findDangerousBindMount([{ hostPath: '/root/.ssh', containerPath: '/x' }])).toBe('/root/.ssh')
    expect(findDangerousBindMount([{ hostPath: '/var/lib/docker', containerPath: '/x' }])).toBe('/var/lib/docker')
  })

  it('normalizes trailing/duplicate slashes before matching', () => {
    expect(findDangerousBindMount([{ hostPath: '/var/run//', containerPath: '/x' }])).toBe('/var/run//')
    expect(findDangerousBindMount([{ hostPath: '/etc/', containerPath: '/x' }])).toBe('/etc/')
  })

  it('allows a normal app data path and named/relative volumes', () => {
    expect(findDangerousBindMount([{ hostPath: '/opt/appdata/nextcloud', containerPath: '/data' }])).toBeNull()
    expect(findDangerousBindMount([{ hostPath: '/srv/media', containerPath: '/media' }])).toBeNull()
    expect(findDangerousBindMount([{ hostPath: 'named-vol', containerPath: '/data' }])).toBeNull()
    expect(findDangerousBindMount([{ hostPath: './rel', containerPath: '/data' }])).toBeNull()
    expect(findDangerousBindMount(undefined)).toBeNull()
  })

  it('does not confuse a sibling prefix (/etcetera) with /etc', () => {
    expect(findDangerousBindMount([{ hostPath: '/etcetera/data', containerPath: '/x' }])).toBeNull()
  })
})

describe('assertSafeBindMounts', () => {
  it('throws on a dangerous mount and names the path', () => {
    expect(() =>
      assertSafeBindMounts([
        { configuration: { volumeMounts: [{ hostPath: '/var/run/docker.sock', containerPath: '/s' }] } },
      ]),
    ).toThrow(/docker\.sock/)
  })

  it('passes a stack with only safe mounts', () => {
    expect(() =>
      assertSafeBindMounts([
        { configuration: { volumeMounts: [{ hostPath: '/opt/data', containerPath: '/data' }] } },
        { configuration: {} },
        {},
      ]),
    ).not.toThrow()
  })
})
