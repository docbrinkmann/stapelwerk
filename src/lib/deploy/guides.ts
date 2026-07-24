/**
 * Environment-specific deployment guides for the handoff flow.
 *
 * Where the per-target instructions (see `handoff.ts`) explain *which panel* to
 * paste the compose into, these guides explain *how to prepare the machine* —
 * a Raspberry Pi, a home server, or a VPS — and reference the stack's own
 * services/ports so the steps are concrete (e.g. "your Jellyfin will be on
 * :8096").
 */

import type { PersistedStack } from '@/lib/stack-persistence';
import { makeT, type Translate } from '@/lib/i18n/messages';

export type DeploymentEnv = 'raspberry-pi' | 'home-server' | 'vps';

/** One step of an environment guide. `code` is a shell/config snippet. */
export interface GuideStep {
  title: string;
  body: string;
  code?: string;
}

export interface DeploymentGuide {
  env: DeploymentEnv;
  title: string;
  intro: string;
  steps: GuideStep[];
  /** Short standalone callouts (warnings, backup reminders). */
  notes: string[];
}

/** A service and its exposed host port, for "X will be on :PORT" hints. */
interface ServicePortHint {
  name: string;
  hostPort: number;
}

/** Collect each service's first published host port for guide hints. */
function servicePortHints(stack: PersistedStack): ServicePortHint[] {
  const hints: ServicePortHint[] = [];
  for (const ss of stack.services) {
    const first = ss.configuration?.portMappings?.[0];
    if (first && typeof first.hostPort === 'number') {
      hints.push({ name: ss.service.name, hostPort: first.hostPort });
    }
  }
  return hints;
}

/** Render port hints as "Jellyfin → http://<host>:8096" lines. */
function renderPortHints(stack: PersistedStack): string {
  const hints = servicePortHints(stack);
  if (hints.length === 0) return '';
  return hints.map(h => `${h.name} → http://<host-ip>:${h.hostPort}`).join('\n');
}

/**
 * Read the architectures a service declares. Data is sparse — we tolerate arch
 * hints in `tags` and a JSON `compatibilityInfo` blob ({ architectures: [...] }).
 * Returns lowercased arch strings (`amd64` / `arm64` / `arm32`).
 */
function serviceArchitectures(service: PersistedStack['services'][number]['service']): string[] {
  const archs = new Set<string>();
  for (const tag of service.tags ?? []) {
    const t = tag.toLowerCase();
    if (t === 'amd64' || t === 'x86_64') archs.add('amd64');
    else if (t === 'arm64' || t === 'aarch64') archs.add('arm64');
    else if (t === 'arm32' || t === 'armv7' || t === 'arm') archs.add('arm32');
  }
  const ci: unknown = service.compatibilityInfo;
  if (typeof ci === 'string' && ci.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(ci) as { architectures?: unknown };
      if (Array.isArray(parsed.architectures)) {
        for (const a of parsed.architectures) archs.add(String(a).toLowerCase());
      }
    } catch {
      // Not JSON — ignore; fall back to the general arch note.
    }
  }
  return [...archs];
}

/**
 * Services that declare amd64 support but NO arm variant — i.e. images that
 * likely won't run on a Raspberry Pi. Only flags what's actually detectable;
 * when metadata is absent the guide falls back to a general note.
 */
export function findAmd64OnlyServices(stack: PersistedStack): string[] {
  const flagged: string[] = [];
  for (const ss of stack.services) {
    const archs = serviceArchitectures(ss.service);
    if (archs.length > 0 && archs.includes('amd64') && !archs.some(a => a.startsWith('arm'))) {
      flagged.push(ss.service.name);
    }
  }
  return flagged;
}

function raspberryPiGuide(stack: PersistedStack, t: Translate): DeploymentGuide {
  const amd64Only = findAmd64OnlyServices(stack);
  const archStep: GuideStep =
    amd64Only.length > 0
      ? {
          title: t('deploy.guide.pi.archTitle'),
          body: t('deploy.guide.pi.archFlagged', { services: amd64Only.join(', ') }),
        }
      : {
          title: t('deploy.guide.pi.archTitle'),
          body: t('deploy.guide.pi.archGeneral'),
          code: 'docker run --rm mplatform/mquery <image>:<tag>   # list an image’s architectures',
        };

  const portHints = renderPortHints(stack);

  return {
    env: 'raspberry-pi',
    title: t('deploy.guide.pi.title'),
    intro: t('deploy.guide.pi.intro'),
    steps: [
      archStep,
      {
        title: t('deploy.guide.pi.dockerTitle'),
        body: t('deploy.guide.pi.dockerBody'),
        code: 'curl -fsSL https://get.docker.com | sh\nsudo usermod -aG docker $USER   # log out/in after this\ndocker compose version',
      },
      {
        title: t('deploy.guide.pi.filesTitle'),
        body: t('deploy.guide.pi.filesBody'),
        code: 'mkdir -p ~/stacks/mystack && cd ~/stacks/mystack\n# copy docker-compose.yml and .env here\n# — or from your machine:  ./deploy.sh pi@raspberrypi.local',
      },
      {
        title: t('deploy.guide.pi.startTitle'),
        body: t('deploy.guide.pi.startBody'),
        code: 'docker compose up -d\ndocker compose ps',
      },
      {
        title: t('deploy.guide.pi.reachTitle'),
        body:
          (portHints ? `${t('deploy.guide.pi.reachPorts', { ports: portHints })}\n\n` : '') +
          t('deploy.guide.pi.reachBody'),
      },
    ],
    notes: [t('deploy.guide.pi.note1'), t('deploy.guide.pi.note2')],
  };
}

function homeServerGuide(stack: PersistedStack, t: Translate): DeploymentGuide {
  const portHints = renderPortHints(stack);
  return {
    env: 'home-server',
    title: t('deploy.guide.home.title'),
    intro: t('deploy.guide.home.intro'),
    steps: [
      {
        title: t('deploy.guide.home.dockerTitle'),
        body: t('deploy.guide.home.dockerBody'),
        code: 'curl -fsSL https://get.docker.com | sh\ndocker compose version',
      },
      {
        title: t('deploy.guide.home.addressTitle'),
        body: t('deploy.guide.home.addressBody'),
      },
      {
        title: t('deploy.guide.home.startTitle'),
        body: t('deploy.guide.home.startBody'),
        code: 'docker compose up -d\ndocker compose ps\n# — or from your machine:  ./deploy.sh user@home-server',
      },
      {
        title: t('deploy.guide.home.proxyTitle'),
        body:
          t('deploy.guide.home.proxyBody') +
          (portHints ? `\n\n${t('deploy.guide.home.proxyPorts', { ports: portHints })}` : ''),
      },
      {
        title: t('deploy.guide.home.backupTitle'),
        body: t('deploy.guide.home.backupBody'),
      },
    ],
    notes: [t('deploy.guide.home.note1'), t('deploy.guide.home.note2')],
  };
}

function vpsGuide(stack: PersistedStack, t: Translate): DeploymentGuide {
  const portHints = renderPortHints(stack);
  return {
    env: 'vps',
    title: t('deploy.guide.vps.title'),
    intro: t('deploy.guide.vps.intro'),
    steps: [
      {
        title: t('deploy.guide.vps.firewallTitle'),
        body: t('deploy.guide.vps.firewallBody'),
        code: 'curl -fsSL https://get.docker.com | sh\nufw default deny incoming\nufw allow 22/tcp\nufw allow 80/tcp\nufw allow 443/tcp\nufw enable',
      },
      {
        title: t('deploy.guide.vps.startTitle'),
        body: t('deploy.guide.vps.startBody'),
        code: 'docker compose up -d\ndocker compose ps\n# — or from your machine:  ./deploy.sh user@your-vps',
      },
      {
        title: t('deploy.guide.vps.proxyTitle'),
        body: t('deploy.guide.vps.proxyBody'),
        code:
          '# Caddyfile\napp.example.com {\n  reverse_proxy app:PORT\n}' +
          (portHints ? `\n\n# your services (proxy to these container ports):\n# ${servicePortHints(stack).map(h => `${h.name}:${h.hostPort}`).join('  ')}` : ''),
      },
      {
        title: t('deploy.guide.vps.dbTitle'),
        body: t('deploy.guide.vps.dbBody'),
      },
      {
        title: t('deploy.guide.vps.updateTitle'),
        body: t('deploy.guide.vps.updateBody'),
        code: 'sudo apt update && sudo apt upgrade -y\ndocker compose pull && docker compose up -d',
      },
    ],
    notes: [t('deploy.guide.vps.note1'), t('deploy.guide.vps.note2')],
  };
}

/**
 * Return the structured guide for a target environment, with steps that
 * reference the stack's actual services/ports where useful. `t` localizes the
 * guide text for on-screen display; the default (EN) is what goes into the
 * downloadable README so the artifact stays English.
 */
export function getDeploymentGuide(
  env: DeploymentEnv,
  stack: PersistedStack,
  t: Translate = makeT('en'),
): DeploymentGuide {
  switch (env) {
    case 'raspberry-pi':
      return raspberryPiGuide(stack, t);
    case 'home-server':
      return homeServerGuide(stack, t);
    case 'vps':
      return vpsGuide(stack, t);
  }
}

/** All three guides, in display order — handy for a selector. */
export const DEPLOYMENT_ENVS: { id: DeploymentEnv; label: string }[] = [
  { id: 'raspberry-pi', label: 'Raspberry Pi' },
  { id: 'home-server', label: 'Home Server' },
  { id: 'vps', label: 'VPS' },
];

/** Render a guide as markdown, for inclusion in a downloadable README. */
export function renderGuideMarkdown(guide: DeploymentGuide): string {
  const parts = [`## ${guide.title}`, '', guide.intro, ''];
  guide.steps.forEach((step, i) => {
    parts.push(`### ${i + 1}. ${step.title}`, '', step.body, '');
    if (step.code) {
      parts.push('```bash', step.code, '```', '');
    }
  });
  if (guide.notes.length > 0) {
    parts.push('### Notes', '');
    for (const note of guide.notes) parts.push(`- ${note}`);
    parts.push('');
  }
  return parts.join('\n').trimEnd();
}
