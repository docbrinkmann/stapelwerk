import { describe, it, expect } from 'vitest'
import { parse as yamlParse } from 'yaml'
import {
  generateComposeWithSecrets,
  stackPersistence,
  SECRET_PLACEHOLDER,
  type PersistedStack,
} from '../stack-persistence'
import { dbStackServicesToPersisted } from '@/lib/deploy/persisted-stack'
import type { Service } from '@/types/service'
import type { StackService } from '@/types/stack'

// Minimal catalog rows mirroring the seeded metadata for nginx + postgresql.
const postgresService: Service = {
  id: 1,
  name: 'PostgreSQL',
  slug: 'postgresql',
  description: 'PostgreSQL database',
  dockerImage: 'postgres:18-alpine',
  version: '18',
  category: { id: 1, name: 'Databases', slug: 'databases' },
  ports: [5432],
  environmentVariables: {},
  env: [
    { name: 'POSTGRES_PASSWORD', description: 'Superuser password', required: true, secret: true },
    { name: 'POSTGRES_USER', description: 'Superuser name', required: false, secret: false, default: 'postgres' },
    { name: 'POSTGRES_DB', description: 'Default database', required: false, secret: false, default: 'app' },
  ],
  volumes: [{ containerPath: '/var/lib/postgresql/data', description: 'Data dir', named: true }],
  resourceRequirements: { cpu: '0.5', memory: '512' },
}

const nginxService: Service = {
  id: 2,
  name: 'NGINX',
  slug: 'nginx',
  description: 'NGINX web server',
  dockerImage: 'nginx:1.25-alpine',
  version: '1.25',
  category: { id: 2, name: 'Web Servers', slug: 'web-servers' },
  ports: [80],
  environmentVariables: {},
  env: [],
  volumes: [{ containerPath: '/etc/nginx/conf.d', description: 'Config', named: false }],
  resourceRequirements: { cpu: '0.25', memory: '128' },
}

function buildStack(): PersistedStack {
  const services: StackService[] = [
    {
      id: 'ss-pg',
      serviceId: postgresService.id,
      order: 1,
      service: postgresService,
      configuration: {
        environmentVariables: {},
        portMappings: [{ containerPort: 5432, hostPort: 5432 }],
        volumeMounts: [],
        dependsOn: [],
      },
    },
    {
      id: 'ss-nginx',
      serviceId: nginxService.id,
      order: 2,
      service: nginxService,
      configuration: {
        environmentVariables: {},
        portMappings: [{ containerPort: 80, hostPort: 8080 }],
        volumeMounts: [],
        // Depends on postgres (referenced by serviceId) to exercise resolution.
        dependsOn: [{ serviceId: postgresService.id, condition: 'service_healthy' }],
      },
    },
  ]
  return { name: 'nginx + postgres', description: '', isPublic: false, services }
}

describe('generateComposeWithSecrets — deployable nginx + postgres compose', () => {
  it('emits a valid compose document with env, volumes, networks and a healthcheck', () => {
    const { yaml, secrets } = generateComposeWithSecrets(buildStack())
    const doc = yamlParse(yaml)

    // Required env var is present with a generated value (not empty).
    expect(yaml).toContain('POSTGRES_PASSWORD')
    const pgPassword = doc.services.postgresql.environment.POSTGRES_PASSWORD
    expect(typeof pgPassword).toBe('string')
    expect(pgPassword.length).toBeGreaterThan(16)

    // Defaults surface for optional vars.
    expect(doc.services.postgresql.environment.POSTGRES_USER).toBe('postgres')
    expect(doc.services.postgresql.environment.POSTGRES_DB).toBe('app')

    // Top-level volumes block declares the postgres named data volume.
    expect(yaml).toMatch(/^volumes:/m)
    const volumeNames = Object.keys(doc.volumes)
    const pgVolume = volumeNames.find(v => v.includes('postgresql') && v.includes('data'))
    expect(pgVolume).toBeTruthy()
    // The service references that named volume as `name:/var/lib/postgresql/data`.
    expect(doc.services.postgresql.volumes).toContain(`${pgVolume}:/var/lib/postgresql/data`)

    // Bind mount for nginx config (not a top-level named volume).
    expect(doc.services.nginx.volumes.some((v: string) => v.startsWith('./') && v.endsWith(':/etc/nginx/conf.d'))).toBe(true)
    expect(volumeNames.some(v => v.includes('nginx'))).toBe(false)

    // Top-level bridge network + per-service attachment.
    expect(doc.networks.appnet.driver).toBe('bridge')
    expect(doc.services.postgresql.networks).toEqual(['appnet'])

    // Healthcheck for postgres uses pg_isready with the resolved user.
    expect(doc.services.postgresql.healthcheck.test).toEqual(['CMD-SHELL', 'pg_isready -U postgres'])

    // Ports, container_name, restart policy.
    expect(doc.services.nginx.ports).toContain('8080:80')
    expect(doc.services.postgresql.container_name).toBe('postgresql')
    expect(doc.services.postgresql.restart).toBe('unless-stopped')

    // depends_on resolves the serviceId reference to the container name.
    expect(doc.services.nginx.depends_on).toContain('postgresql')

    // No obsolete top-level version header.
    expect(doc.version).toBeUndefined()

    // Generated secret is returned to the caller and matches the compose value.
    expect(secrets['postgresql.POSTGRES_PASSWORD']).toBe(pgPassword)
  })

  it('keeps a backward-compatible string path via exportToDockerCompose', () => {
    const yaml = stackPersistence.exportToDockerCompose(buildStack())
    expect(typeof yaml).toBe('string')
    expect(yaml).toContain('services:')
    expect(yaml).toContain('POSTGRES_PASSWORD')
  })

  it('escapes $ in env values so compose interpolation preserves them', () => {
    // docker compose interpolates $VAR/${VAR} in file values; a literal $ must
    // be written as $$ or "pa$sword" deploys as "pa".
    const stack = buildStack()
    stack.services[0].configuration.environmentVariables = { POSTGRES_PASSWORD: 'pa$sword${x}' }
    const doc = yamlParse(generateComposeWithSecrets(stack, {}).yaml)
    expect(doc.services.postgresql.environment.POSTGRES_PASSWORD).toBe('pa$$sword$${x}')
  })

  it('uses a user-provided value instead of generating a secret', () => {
    const stack = buildStack()
    stack.services[0].configuration.environmentVariables = { POSTGRES_PASSWORD: 'my-fixed-pw' }
    const { yaml, secrets } = generateComposeWithSecrets(stack)
    const doc = yamlParse(yaml)
    expect(doc.services.postgresql.environment.POSTGRES_PASSWORD).toBe('my-fixed-pw')
    // No secret generated when the user supplied one.
    expect(secrets['postgresql.POSTGRES_PASSWORD']).toBeUndefined()
  })
})

describe('generateComposeWithSecrets — maskSecrets (public shared view)', () => {
  it('masks catalog secret vars and never generates or returns a secret', () => {
    const { yaml, secrets } = generateComposeWithSecrets(buildStack(), { maskSecrets: true })
    const doc = yamlParse(yaml)
    // Secret var is masked, not a real generated password.
    expect(doc.services.postgresql.environment.POSTGRES_PASSWORD).toBe(SECRET_PLACEHOLDER)
    // Nothing generated → nothing returned.
    expect(secrets).toEqual({})
    // Non-secret defaults still surface — the compose stays informative.
    expect(doc.services.postgresql.environment.POSTGRES_USER).toBe('postgres')
  })

  it('masks a user-supplied secret value too (never leaks the real password)', () => {
    const stack = buildStack()
    stack.services[0].configuration.environmentVariables = { POSTGRES_PASSWORD: 'super-secret-pw' }
    const { yaml } = generateComposeWithSecrets(stack, { maskSecrets: true })
    expect(yaml).not.toContain('super-secret-pw')
    expect(yamlParse(yaml).services.postgresql.environment.POSTGRES_PASSWORD).toBe(SECRET_PLACEHOLDER)
  })

  it('masks secret-looking custom env vars the catalog does not describe', () => {
    const stack = buildStack()
    stack.services[1].configuration.environmentVariables = {
      API_TOKEN: 'tok_live_123',
      LOG_LEVEL: 'info',
    }
    const doc = yamlParse(generateComposeWithSecrets(stack, { maskSecrets: true }).yaml)
    expect(doc.services.nginx.environment.API_TOKEN).toBe(SECRET_PLACEHOLDER)
    // Non-secret custom vars are left intact.
    expect(doc.services.nginx.environment.LOG_LEVEL).toBe('info')
  })
})

describe('dbStackServicesToPersisted — DB rows → compose input', () => {
  it('parses JSON-string catalog + config columns into the generator shape', () => {
    const persisted = dbStackServicesToPersisted([
      {
        id: 'ss-1',
        serviceId: 1,
        order: 1,
        services: {
          id: 1,
          name: 'PostgreSQL',
          slug: 'postgresql',
          description: 'db',
          dockerImage: 'postgres:18-alpine',
          version: '18',
          environmentVariables: JSON.stringify([
            { name: 'POSTGRES_PASSWORD', required: true, secret: true },
          ]),
          volumes: JSON.stringify([{ containerPath: '/var/lib/postgresql/data', named: true }]),
        },
        stack_service_configurations: {
          environmentVariables: JSON.stringify({ POSTGRES_DB: 'app' }),
          portMappings: JSON.stringify([{ containerPort: 5432, hostPort: 5432 }]),
          volumeMounts: null,
          dependsOn: null,
        },
      },
    ])
    expect(persisted).toHaveLength(1)
    // Env descriptors parsed to the array shape the generator reads via `service.env`.
    expect((persisted[0].service as { env: unknown[] }).env).toHaveLength(1)
    expect(persisted[0].configuration.environmentVariables).toEqual({ POSTGRES_DB: 'app' })
    expect(persisted[0].configuration.portMappings).toHaveLength(1)
    // Null config columns degrade to empty arrays, not crashes.
    expect(persisted[0].configuration.volumeMounts).toEqual([])
    // End-to-end: the mapped stack produces a masked compose with the secret hidden.
    const doc = yamlParse(
      generateComposeWithSecrets(
        { name: 's', description: '', isPublic: true, services: persisted },
        { maskSecrets: true },
      ).yaml,
    )
    expect(doc.services.postgresql.environment.POSTGRES_PASSWORD).toBe(SECRET_PLACEHOLDER)
    expect(doc.services.postgresql.environment.POSTGRES_DB).toBe('app')
  })

  // Regression: SaveStackModal persists the RECORD shape (portMappings
  // {"container":"host"}, volumeMounts {"container":"host"}, dependsOn
  // ["<serviceId>"]) — the shape the API schema (z.record) enforces. The read
  // path used to `parseArray` this, silently dropping every published port and
  // volume and emitting `depends_on: ["1"]` which breaks `docker compose up`.
  it('honors the record shape the UI actually stores (ports, volumes, depends_on)', () => {
    const persisted = dbStackServicesToPersisted([
      {
        id: 'ss-pg',
        serviceId: 1,
        order: 1,
        services: {
          id: 1, name: 'PostgreSQL', slug: 'postgresql', description: 'db',
          dockerImage: 'postgres:18-alpine', version: '18',
          environmentVariables: JSON.stringify([]),
          volumes: JSON.stringify([]),
        },
        stack_service_configurations: {
          environmentVariables: JSON.stringify({}),
          portMappings: JSON.stringify({ '5432': '5433' }),
          volumeMounts: null,
          dependsOn: null,
        },
      },
      {
        id: 'ss-app',
        serviceId: 2,
        order: 2,
        services: {
          id: 2, name: 'App', slug: 'app', description: 'app',
          dockerImage: 'myapp:1', version: '1',
          environmentVariables: JSON.stringify([]),
          volumes: JSON.stringify([]),
        },
        stack_service_configurations: {
          environmentVariables: JSON.stringify({}),
          portMappings: JSON.stringify({ '80': '8080' }),
          volumeMounts: JSON.stringify({ '/var/www/html': '/srv/app' }),
          dependsOn: JSON.stringify(['1']),
        },
      },
    ])

    const doc = yamlParse(
      generateComposeWithSecrets(
        { name: 's', description: '', isPublic: false, services: persisted },
        {},
      ).yaml,
    )
    // Ports survive (record {container: host} → "host:container").
    expect(doc.services.postgresql.ports).toContain('5433:5432')
    expect(doc.services.app.ports).toContain('8080:80')
    // User volume mount survives (record {container: host} → "host:container").
    expect(doc.services.app.volumes).toContain('/srv/app:/var/www/html')
    // depends_on resolves the serviceId to the service slug, not the raw id.
    expect(doc.services.app.depends_on).toEqual(['postgresql'])
  })
})
