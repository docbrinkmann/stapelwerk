import { describe, it, expect } from 'vitest'
import { analyzeStack } from '@/lib/validation/stack-builder-checks'
import type { StackService } from '@/types/stack'
import type { Service } from '@/types/service'

function makeService(id: number, slug: string, name: string): Service {
  return {
    id,
    name,
    slug,
    description: '',
    dockerImage: `${slug}:latest`,
    version: 'latest',
    category: { id: 1, name: 'Web', slug: 'web' },
    ports: [],
    environmentVariables: {},
  }
}

function makeStackService(
  id: number,
  slug: string,
  name: string,
  config: Partial<StackService['configuration']> = {}
): StackService {
  return {
    id: `ss-${id}`,
    serviceId: id,
    order: 0,
    service: makeService(id, slug, name),
    configuration: {
      environmentVariables: {},
      portMappings: [],
      volumeMounts: [],
      dependsOn: [],
      ...config,
    },
  }
}

describe('analyzeStack', () => {
  it('returns no checks for an empty stack', () => {
    expect(analyzeStack([])).toEqual([])
  })

  it('flags a host-port conflict across two services', () => {
    const stack = [
      makeStackService(1, 'nginx', 'NGINX', {
        portMappings: [{ containerPort: 80, hostPort: 80 }],
      }),
      makeStackService(2, 'caddy', 'Caddy', {
        portMappings: [{ containerPort: 80, hostPort: 80 }],
      }),
    ]
    const port = analyzeStack(stack).find(c => c.kind === 'port')
    expect(port).toBeDefined()
    expect(port?.severity).toBe('error')
    expect(port?.message).toContain('80')
  })

  it('does not flag a port conflict when host ports differ', () => {
    const stack = [
      makeStackService(1, 'nginx', 'NGINX', {
        portMappings: [{ containerPort: 80, hostPort: 8080 }],
      }),
      makeStackService(2, 'grafana', 'Grafana', {
        portMappings: [{ containerPort: 80, hostPort: 3000 }],
      }),
    ]
    expect(analyzeStack(stack).some(c => c.kind === 'port')).toBe(false)
  })

  it('flags a shared host volume path', () => {
    const stack = [
      makeStackService(1, 'a', 'A', {
        volumeMounts: [{ hostPath: '/data/shared', containerPath: '/a' }],
      }),
      makeStackService(2, 'b', 'B', {
        volumeMounts: [{ hostPath: '/data/shared', containerPath: '/b' }],
      }),
    ]
    const volume = analyzeStack(stack).find(c => c.kind === 'volume')
    expect(volume).toBeDefined()
    expect(volume?.severity).toBe('warning')
  })

  it('flags a dependency target that is not in the stack', () => {
    const stack = [
      makeStackService(1, 'app', 'App', {
        dependsOn: [{ serviceId: 999 }],
      }),
    ]
    const dep = analyzeStack(stack).find(c => c.kind === 'dependency')
    expect(dep).toBeDefined()
    expect(dep?.message).toContain('App')
  })

  it('does not flag a dependency that is present in the stack', () => {
    const stack = [
      makeStackService(1, 'app', 'App', { dependsOn: [{ serviceId: 2 }] }),
      makeStackService(2, 'postgresql', 'PostgreSQL'),
    ]
    expect(analyzeStack(stack).some(c => c.kind === 'dependency')).toBe(false)
  })

  it('adds a soft compatibility advisory for two reverse proxies', () => {
    const stack = [
      makeStackService(1, 'nginx', 'NGINX', {
        portMappings: [{ containerPort: 80, hostPort: 8081 }],
      }),
      makeStackService(2, 'traefik', 'Traefik', {
        portMappings: [{ containerPort: 80, hostPort: 8082 }],
      }),
    ]
    const compat = analyzeStack(stack).find(c => c.kind === 'compatibility')
    expect(compat).toBeDefined()
    expect(compat?.severity).toBe('warning')
    expect(compat?.message).toContain('NGINX')
    expect(compat?.message).toContain('Traefik')
  })
})

describe('analyzeStack — VPN kill-switch (the signature check)', () => {
  it('flags a leak when a download client is not routed through the VPN', () => {
    const stack = [
      makeStackService(1, 'gluetun', 'Gluetun'),
      makeStackService(2, 'qbittorrent', 'qBittorrent'), // NOT routed
    ]
    const vpn = analyzeStack(stack).find(c => c.kind === 'vpn')
    expect(vpn?.severity).toBe('error')
    expect(vpn?.title).toBe('VPN leak')
    expect(vpn?.message).toContain('service:gluetun')
  })

  it('passes when the download client IS routed through the VPN', () => {
    const stack = [
      makeStackService(1, 'gluetun', 'Gluetun'),
      makeStackService(2, 'qbittorrent', 'qBittorrent', { networkMode: 'service:gluetun' }),
    ]
    expect(analyzeStack(stack).some(c => c.kind === 'vpn')).toBe(false)
  })

  it('warns when a download client has no VPN in the stack at all', () => {
    const stack = [makeStackService(2, 'qbittorrent', 'qBittorrent')]
    const vpn = analyzeStack(stack).find(c => c.kind === 'vpn')
    expect(vpn?.severity).toBe('warning')
    expect(vpn?.title).toBe('No VPN')
  })

  it('does not raise a VPN check for a stack with no download client', () => {
    const stack = [
      makeStackService(1, 'jellyfin', 'Jellyfin'),
      makeStackService(3, 'sonarr', 'Sonarr'),
    ]
    expect(analyzeStack(stack).some(c => c.kind === 'vpn')).toBe(false)
  })
})

import { auditToBuilderChecks } from '@/lib/validation/stack-builder-checks'
import { auditCompose } from '@/lib/deploy/safety-audit'

describe('auditToBuilderChecks', () => {
  it('surfaces only audit FAILURES as builder errors (advisories stay in the report)', () => {
    // postgres exposed to the host + no volume (2 fails) + unpinned :latest (warn).
    const audit = auditCompose({ services: { db: { image: 'postgres:latest', ports: ['5432:5432'] } } })
    const checks = auditToBuilderChecks(audit)
    const kinds = checks.map(c => c.kind).sort()
    // exposed port (port) + no volume (volume) surface; the :latest warn does not.
    expect(kinds).toEqual(['port', 'volume'])
    expect(checks.every(c => c.severity === 'error')).toBe(true)
    expect(checks.find(c => c.kind === 'port')?.message).toMatch(/db —/)
  })

  it('returns nothing for a clean stack', () => {
    const audit = auditCompose({
      services: { db: { image: 'postgres:18-alpine', volumes: ['d:/var/lib/postgresql/data'], environment: { POSTGRES_PASSWORD: 'Xk9-mQ2pLw7Z_aB3' } } },
    })
    expect(auditToBuilderChecks(audit)).toEqual([])
  })

  it('surfaces a default/empty secret as a secret error', () => {
    const audit = auditCompose({ services: { db: { image: 'postgres:18', volumes: ['d:/x'], environment: { POSTGRES_PASSWORD: 'change_me' } } } })
    const secretCheck = auditToBuilderChecks(audit).find(c => c.kind === 'secret')
    expect(secretCheck?.severity).toBe('error')

describe('analyzeStack — jump targets (click a check → fix location)', () => {
  it('port conflict targets the first service, Ports section', () => {
    const stack = [
      makeStackService(1, 'nginx', 'NGINX', { portMappings: [{ containerPort: 80, hostPort: 80 }] }),
      makeStackService(2, 'caddy', 'Caddy', { portMappings: [{ containerPort: 80, hostPort: 80 }] }),
    ]
    expect(analyzeStack(stack).find(c => c.kind === 'port')?.target).toEqual({
      kind: 'service',
      stackServiceId: 'ss-1',
      section: 'ports',
    })
  })

  it('shared volume targets the first service, Volumes section', () => {
    const stack = [
      makeStackService(1, 'a', 'A', { volumeMounts: [{ hostPath: '/data/x', containerPath: '/a' }] }),
      makeStackService(2, 'b', 'B', { volumeMounts: [{ hostPath: '/data/x', containerPath: '/b' }] }),
    ]
    expect(analyzeStack(stack).find(c => c.kind === 'volume')?.target).toEqual({
      kind: 'service',
      stackServiceId: 'ss-1',
      section: 'volumes',
    })
  })

  it('missing dependency targets that service, Dependencies section', () => {
    const stack = [makeStackService(1, 'app', 'App', { dependsOn: [{ serviceId: 999 }] })]
    expect(analyzeStack(stack).find(c => c.kind === 'dependency')?.target).toEqual({
      kind: 'service',
      stackServiceId: 'ss-1',
      section: 'dependencies',
    })
  })

  it('compatibility advisory targets a service, Ports section', () => {
    const stack = [
      makeStackService(1, 'nginx', 'NGINX', { portMappings: [{ containerPort: 80, hostPort: 8081 }] }),
      makeStackService(2, 'traefik', 'Traefik', { portMappings: [{ containerPort: 80, hostPort: 8082 }] }),
    ]
    expect(analyzeStack(stack).find(c => c.kind === 'compatibility')?.target).toEqual({
      kind: 'service',
      stackServiceId: 'ss-1',
      section: 'ports',
    })
  })
})
