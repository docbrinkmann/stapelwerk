import { describe, it, expect } from 'vitest';
import {
  getDeploymentGuide,
  renderGuideMarkdown,
  findAmd64OnlyServices,
  DEPLOYMENT_ENVS,
  type DeploymentEnv,
} from '../guides';
import type { PersistedStack } from '@/lib/stack-persistence';
import type { Service } from '@/types/service';
import type { StackService } from '@/types/stack';

function makeService(over: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: 'Jellyfin',
    slug: 'jellyfin',
    description: 'Media server',
    dockerImage: 'jellyfin/jellyfin',
    version: 'latest',
    category: { id: 1, name: 'Media', slug: 'media' },
    ports: [8096],
    environmentVariables: {},
    ...over,
  };
}

function buildStack(service: Service, hostPort = 8096): PersistedStack {
  const services: StackService[] = [
    {
      id: 'ss-1',
      serviceId: service.id,
      order: 1,
      service,
      configuration: {
        environmentVariables: {},
        portMappings: [{ containerPort: hostPort, hostPort }],
        volumeMounts: [],
        dependsOn: [],
      },
    },
  ];
  return { name: 'media', description: '', isPublic: false, services };
}

const ENVS: DeploymentEnv[] = ['raspberry-pi', 'home-server', 'vps'];

describe('getDeploymentGuide', () => {
  it('returns a titled guide with steps for every environment', () => {
    for (const env of ENVS) {
      const guide = getDeploymentGuide(env, buildStack(makeService()));
      expect(guide.env).toBe(env);
      expect(guide.title).toBeTruthy();
      expect(guide.steps.length).toBeGreaterThan(0);
      expect(guide.steps.every(s => s.title.length > 0 && s.body.length > 0)).toBe(true);
      expect(guide.notes.length).toBeGreaterThan(0);
    }
  });

  it('Raspberry Pi guide mentions the arm architecture', () => {
    const guide = getDeploymentGuide('raspberry-pi', buildStack(makeService()));
    const text = JSON.stringify(guide).toLowerCase();
    expect(text).toContain('arm64');
    expect(text).toMatch(/architecture/);
  });

  it('references the stack’s actual service and port', () => {
    const guide = getDeploymentGuide('raspberry-pi', buildStack(makeService(), 8096));
    const text = JSON.stringify(guide);
    expect(text).toContain('Jellyfin');
    expect(text).toContain('8096');
  });

  it('flags an amd64-only service on the Pi guide when detectable', () => {
    const amd64Only = makeService({ name: 'AmdApp', tags: ['amd64'] });
    const flagged = findAmd64OnlyServices(buildStack(amd64Only));
    expect(flagged).toContain('AmdApp');

    const guide = getDeploymentGuide('raspberry-pi', buildStack(amd64Only));
    expect(JSON.stringify(guide)).toContain('AmdApp');
  });

  it('does not flag a service that also supports arm64', () => {
    const multi = makeService({ name: 'MultiArch', tags: ['amd64', 'arm64'] });
    expect(findAmd64OnlyServices(buildStack(multi))).not.toContain('MultiArch');
  });

  it('VPS guide covers firewall and not exposing the database', () => {
    const guide = getDeploymentGuide('vps', buildStack(makeService()));
    const text = JSON.stringify(guide).toLowerCase();
    expect(text).toContain('ufw');
    expect(text).toMatch(/443/);
    expect(text).toMatch(/database|5432/);
  });
});

describe('renderGuideMarkdown', () => {
  it('renders numbered steps and code fences', () => {
    const md = renderGuideMarkdown(getDeploymentGuide('vps', buildStack(makeService())));
    expect(md).toContain('## Deploy to a VPS');
    expect(md).toMatch(/### 1\./);
    expect(md).toContain('```bash');
  });
});

describe('DEPLOYMENT_ENVS', () => {
  it('lists all three selectable environments', () => {
    expect(DEPLOYMENT_ENVS.map(e => e.id)).toEqual(['raspberry-pi', 'home-server', 'vps']);
  });
});
