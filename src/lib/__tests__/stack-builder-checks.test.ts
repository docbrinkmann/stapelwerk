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
