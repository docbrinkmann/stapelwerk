import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { generateComposeWithSecrets } from '@/lib/stack-persistence';
import { auditCompose } from '@/lib/deploy/safety-audit';
import { auditToBuilderChecks } from '@/lib/validation/stack-builder-checks';
import type { PersistedStack } from '@/lib/stack-persistence';
import type { Service } from '@/types/service';
import type { StackService } from '@/types/stack';

/**
 * End-to-end seam test for the Deploy Safety Audit — the exact client-side path
 * the stack-builder's checks panel runs, WITHOUT a browser: a builder stack →
 * the real compose generator → parse → auditCompose → auditToBuilderChecks.
 *
 * This is the integration the live UI exercises (`StackChecksPanel` assembles
 * compose client-side and runs the same functions). The browser click-through
 * was blocked by the dev server's persistent WS connections preventing the page
 * `load` event from settling; this test verifies the same code path
 * deterministically and stays as a regression check.
 */

const postgres: Service = {
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
  ],
  volumes: [{ containerPath: '/var/lib/postgresql/data', description: 'Data dir', named: true }],
};

function stackWith(portMappings: { containerPort: number; hostPort: number }[]): PersistedStack {
  const services: StackService[] = [
    {
      id: 'ss-pg',
      serviceId: postgres.id,
      order: 1,
      service: postgres,
      configuration: { environmentVariables: {}, portMappings, volumeMounts: [], dependsOn: [] },
    },
  ];
  return { name: 'db stack', description: '', isPublic: false, services };
}

/** The seam the builder runs: PersistedStack → real compose → audit → builder checks. */
function auditBuilder(stack: PersistedStack) {
  const { yaml } = generateComposeWithSecrets(stack);
  const audit = auditCompose(parseYaml(yaml));
  return { audit, checks: auditToBuilderChecks(audit) };
}

describe('safety audit — builder seam (real compose generator)', () => {
  it('a datastore published to the host surfaces an exposed-port error in the builder', () => {
    const { audit, checks } = auditBuilder(stackWith([{ containerPort: 5432, hostPort: 5432 }]));
    expect(audit.status).toBe('fail');
    expect(audit.properties.find((p) => p.id === 'exposed-datastore-port')?.status).toBe('fail');
    const portErr = checks.find((c) => c.kind === 'port');
    expect(portErr).toBeDefined();
    expect(portErr!.severity).toBe('error');
    expect(portErr!.message).toMatch(/postgresql/);
  });

  it('the same stack WITHOUT a published port is deploy-safe (no builder errors)', () => {
    const { audit, checks } = auditBuilder(stackWith([]));
    // Volume comes from catalog metadata; the required secret is auto-generated
    // (strong); image is pinned; no port published → nothing to flag.
    expect(audit.status).toBe('pass');
    expect(audit.properties.find((p) => p.id === 'exposed-datastore-port')?.status).toBe('pass');
    expect(audit.properties.find((p) => p.id === 'stateful-no-volume')?.status).toBe('pass');
    expect(audit.properties.find((p) => p.id === 'weak-secret')?.status).toBe('pass');
    expect(checks).toEqual([]);
  });
});
