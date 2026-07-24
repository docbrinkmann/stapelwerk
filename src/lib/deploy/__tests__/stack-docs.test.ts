import { describe, it, expect } from 'vitest';
import { buildStackDocs } from '../stack-docs';
import type { PersistedStack } from '@/lib/stack-persistence';
import type { Service } from '@/types/service';
import type { StackService } from '@/types/stack';

const postgres: Service = {
  id: 1,
  name: 'PostgreSQL',
  slug: 'postgresql',
  description: 'Relational database',
  dockerImage: 'postgres:18-alpine',
  version: '18',
  category: { id: 1, name: 'Databases', slug: 'databases' },
  ports: [5432],
  environmentVariables: {},
  env: [{ name: 'POSTGRES_PASSWORD', required: true, secret: true }],
  volumes: [{ containerPath: '/var/lib/postgresql/data', description: 'Database files', named: true }],
};

const web: Service = {
  id: 2,
  name: 'Nextcloud',
  slug: 'nextcloud',
  description: 'File sync and share',
  dockerImage: 'lscr.io/linuxserver/nextcloud:latest',
  version: 'latest',
  category: { id: 2, name: 'Apps', slug: 'apps' },
  ports: [443],
  environmentVariables: {},
};

function stackService(service: Service, hostPort: number, containerPort: number): StackService {
  return {
    id: `ss-${service.id}`,
    serviceId: service.id,
    order: service.id,
    service,
    configuration: {
      environmentVariables: {},
      portMappings: [{ containerPort, hostPort }],
      volumeMounts: [],
      dependsOn: [],
    },
  };
}

function buildStack(): PersistedStack {
  return {
    name: 'Home Cloud',
    description: 'A small self-hosted cloud.',
    isPublic: false,
    services: [stackService(postgres, 5432, 5432), stackService(web, 8443, 443)],
  };
}

describe('buildStackDocs', () => {
  const doc = buildStackDocs(buildStack(), {
    secrets: { 'postgresql.POSTGRES_PASSWORD': 'generated-value' },
  });

  it('leads with the stack name and overview', () => {
    expect(doc.startsWith('# Home Cloud')).toBe(true);
    expect(doc).toContain('## Overview');
    expect(doc).toContain('A small self-hosted cloud.');
  });

  it('lists every service with its resolved image and a purpose', () => {
    expect(doc).toContain('## Services');
    expect(doc).toContain('PostgreSQL');
    expect(doc).toContain('`postgres:18-alpine`');
    expect(doc).toContain('Nextcloud');
    expect(doc).toContain('Relational database');
  });

  it('renders a ports table with browser URLs and host→container mapping', () => {
    expect(doc).toContain('## Ports');
    expect(doc).toContain('http://localhost:8443');
    expect(doc).toContain('8443 → 443');
  });

  it('documents the persistent volumes and a backup note', () => {
    expect(doc).toContain('## Volumes & data');
    expect(doc).toContain('/var/lib/postgresql/data');
    expect(doc.toLowerCase()).toContain('back');
  });

  it('explains where the generated secrets live and to keep them safe', () => {
    expect(doc).toContain('## Generated secrets');
    expect(doc).toContain('.env');
    expect(doc.toLowerCase()).toContain('safe');
    expect(doc).toContain('1 secret');
  });

  it('provides start and stop commands', () => {
    expect(doc).toContain('## Start & stop');
    expect(doc).toContain('docker compose up -d');
    expect(doc).toContain('docker compose down');
  });

  it('includes a troubleshooting section covering the required cases', () => {
    expect(doc).toContain('## Troubleshooting');
    expect(doc).toContain('Port already in use');
    expect(doc).toContain('unhealthy');
    // PUID/PGID guidance is tailored because a LinuxServer.io image is present.
    expect(doc).toContain('PUID');
    expect(doc).toContain('Nextcloud');
    // Database-specific guidance references the real DB service.
    expect(doc).toContain('Database will not start');
    expect(doc).toContain('PostgreSQL');
    expect(doc).toContain('docker compose logs');
  });

  it('tolerates volumes stored as a JSON string (catalog runtime shape)', () => {
    // The seeded catalog delivers `volumes` as a JSON string, not an array.
    // A naive for..of would iterate the string char-by-char → garbage rows.
    const raw = {
      ...postgres,
      volumes: JSON.stringify([
        { containerPath: '/var/lib/postgresql/data', description: 'DB files', named: true },
      ]) as unknown as Service['volumes'],
    };
    const out = buildStackDocs({
      name: 'S',
      description: '',
      isPublic: false,
      services: [stackService(raw, 5432, 5432)],
    });
    expect(out).toContain('/var/lib/postgresql/data');
    expect(out).not.toContain('undefined');
    // Exactly one volume line, not one-per-character.
    expect(out.match(/\(named volume\)/g)?.length).toBe(1);
  });

  it('appends an environment guide when provided', () => {
    const withGuide = buildStackDocs(buildStack(), { guideMarkdown: '## Deploy to a VPS\n\nSteps.' });
    expect(withGuide).toContain('## Deploy to a VPS');
  });

  it('handles a stack with no ports or volumes gracefully', () => {
    const bare: PersistedStack = {
      name: 'Bare',
      description: '',
      isPublic: false,
      services: [
        {
          id: 'ss-x',
          serviceId: 9,
          order: 1,
          service: {
            id: 9,
            name: 'Worker',
            slug: 'worker',
            description: 'Background worker',
            dockerImage: 'busybox:1.36',
            version: '1.36',
            category: { id: 3, name: 'Tools', slug: 'tools' },
            ports: [],
            environmentVariables: {},
          },
          configuration: { environmentVariables: {}, portMappings: [], volumeMounts: [], dependsOn: [] },
        },
      ],
    };
    const out = buildStackDocs(bare);
    expect(out).toContain('No host ports are published');
    expect(out).toContain('no persistent volumes');
    expect(out).toContain('## Troubleshooting');
  });
});
