import { describe, it, expect } from 'vitest'
import { normalizePorts, buildNetworkOverview, STACK_NETWORK } from '../network-overview'

describe('normalizePorts', () => {
  it('parses the generator array shape (with protocol)', () => {
    expect(normalizePorts([{ containerPort: 5432, hostPort: 5433, protocol: 'tcp' }])).toEqual([
      { hostPort: 5433, containerPort: 5432, protocol: 'tcp' },
    ])
  })

  it('parses the legacy object shape { container: host }', () => {
    expect(normalizePorts({ '80': '8080' })).toEqual([
      { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
    ])
  })

  it('parses a JSON string of either shape', () => {
    expect(normalizePorts('{"443":"8443"}')).toEqual([
      { hostPort: 8443, containerPort: 443, protocol: 'tcp' },
    ])
    expect(normalizePorts('[{"containerPort":80,"hostPort":80,"protocol":"udp"}]')).toEqual([
      { hostPort: 80, containerPort: 80, protocol: 'udp' },
    ])
  })

  it('drops entries without a finite host port, tolerates junk', () => {
    expect(normalizePorts('not json')).toEqual([])
    expect(normalizePorts(null)).toEqual([])
    expect(normalizePorts({})).toEqual([])
    expect(normalizePorts([{ containerPort: 80 }])).toEqual([]) // no hostPort
  })
})

describe('buildNetworkOverview', () => {
  const stacks = [
    {
      stackId: 's1',
      stackName: 'Media',
      services: [
        { serviceId: 1, name: 'Jellyfin', slug: 'jellyfin', portMappings: [{ containerPort: 8096, hostPort: 8096 }] },
        { serviceId: 2, name: 'PostgreSQL', slug: 'postgresql', portMappings: { '5432': '5432' } },
      ],
    },
    {
      stackId: 's2',
      stackName: 'Blog',
      // Also binds host 8096 → conflicts with Media's Jellyfin.
      services: [{ serviceId: 3, name: 'Ghost', slug: 'ghost', portMappings: [{ containerPort: 2368, hostPort: 8096 }] }],
    },
  ]

  it('lists per-stack services with published ports on the appnet network', () => {
    const o = buildNetworkOverview(stacks)
    expect(o.stacks[0].network).toBe(STACK_NETWORK)
    expect(o.stacks[0].stackName).toBe('Media')
    expect(o.stacks[0].publishedCount).toBe(2)
    const pg = o.stacks[0].services.find((s) => s.slug === 'postgresql')!
    expect(pg.internalHost).toBe('postgresql')
    expect(pg.publishedPorts).toEqual([{ hostPort: 5432, containerPort: 5432, protocol: 'tcp' }])
    expect(o.totalPublished).toBe(3)
  })

  it('detects a host-port conflict across stacks', () => {
    const o = buildNetworkOverview(stacks)
    expect(o.conflicts).toHaveLength(1)
    expect(o.conflicts[0].hostPort).toBe(8096)
    expect(o.conflicts[0].users.map((u) => u.stackName).sort()).toEqual(['Blog', 'Media'])
  })

  it('reports no conflicts when host ports are distinct', () => {
    const o = buildNetworkOverview([
      { stackId: 'a', stackName: 'A', services: [{ serviceId: 1, name: 'x', slug: 'x', portMappings: { '80': '8080' } }] },
      { stackId: 'b', stackName: 'B', services: [{ serviceId: 2, name: 'y', slug: 'y', portMappings: { '80': '8081' } }] },
    ])
    expect(o.conflicts).toEqual([])
  })

  it('derives internal endpoints from catalog ports and flags published ones', () => {
    const o = buildNetworkOverview([
      {
        stackId: 's',
        stackName: 'S',
        services: [
          {
            serviceId: 1,
            name: 'NGINX',
            slug: 'nginx',
            // Catalog: listens on 80 (published) and 443 (internal only).
            ports: [
              { containerPort: 80, protocol: 'tcp', description: 'HTTP' },
              { containerPort: 443, protocol: 'tcp' },
            ],
            portMappings: [{ containerPort: 80, hostPort: 8080 }],
          },
        ],
      },
    ])
    const nginx = o.stacks[0].services[0]
    expect(nginx.internalPorts).toEqual([
      { containerPort: 80, protocol: 'tcp', description: 'HTTP', published: true },
      { containerPort: 443, protocol: 'tcp', description: undefined, published: false },
    ])
  })

  it('shows an internal-only service (no host mapping) with its catalog port', () => {
    const o = buildNetworkOverview([
      {
        stackId: 's',
        stackName: 'S',
        services: [
          { serviceId: 1, name: 'Redis', slug: 'redis', ports: [{ containerPort: 6379 }], portMappings: null },
        ],
      },
    ])
    const redis = o.stacks[0].services[0]
    expect(redis.publishedPorts).toEqual([])
    expect(redis.internalPorts).toEqual([
      { containerPort: 6379, protocol: 'tcp', description: undefined, published: false },
    ])
  })

  it('resolves dependsOn serviceIds to same-stack names and parses volumes', () => {
    const o = buildNetworkOverview([
      {
        stackId: 's',
        stackName: 'S',
        services: [
          { serviceId: 1, name: 'PostgreSQL', slug: 'postgresql', portMappings: null },
          {
            serviceId: 2,
            name: 'App',
            slug: 'app',
            portMappings: null,
            dependsOn: [1, 999], // 999 is not in the stack → dropped
            volumes: [
              { containerPath: '/data', named: true, description: 'App data' },
              { containerPath: '/host/logs', named: false },
            ],
          },
        ],
      },
    ])
    const app = o.stacks[0].services.find((s) => s.slug === 'app')!
    expect(app.dependsOn).toEqual(['PostgreSQL'])
    expect(app.volumes).toEqual([
      { containerPath: '/data', named: true, description: 'App data' },
      { containerPath: '/host/logs', named: false, description: undefined },
    ])
  })
})
