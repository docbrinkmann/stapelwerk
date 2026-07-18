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

function raspberryPiGuide(stack: PersistedStack): DeploymentGuide {
  const amd64Only = findAmd64OnlyServices(stack);
  const archStep: GuideStep =
    amd64Only.length > 0
      ? {
          title: 'Check CPU architecture (arm64)',
          body:
            `A Raspberry Pi (3/4/5, 64-bit OS) runs the arm64 architecture. ` +
            `These services in your stack look amd64-only and may fail to start on a Pi: ${amd64Only.join(', ')}. ` +
            `Find an arm64-compatible image/tag for them before deploying.`,
        }
      : {
          title: 'Check CPU architecture (arm64)',
          body:
            'A Raspberry Pi (3/4/5, 64-bit OS) runs the arm64 architecture. Most popular ' +
            'images publish arm64 variants, but verify each image supports arm64 (or arm32 ' +
            'on 32-bit OS) before deploying — an amd64-only image will fail to start.',
          code: 'docker run --rm mplatform/mquery <image>:<tag>   # list an image’s architectures',
        };

  const portHints = renderPortHints(stack);

  return {
    env: 'raspberry-pi',
    title: 'Deploy to a Raspberry Pi',
    intro:
      'Run your stack on a Raspberry Pi at home. Mind the arm64 architecture, ' +
      'run everything off an SSD if you can, and back the SD card up.',
    steps: [
      archStep,
      {
        title: 'Install / verify Docker',
        body: 'Install Docker Engine and add your user to the docker group, then verify it runs.',
        code: 'curl -fsSL https://get.docker.com | sh\nsudo usermod -aG docker $USER   # log out/in after this\ndocker compose version',
      },
      {
        title: 'Place the compose files',
        body: 'Copy docker-compose.yml and .env into a folder on the Pi (e.g. ~/stacks/mystack).',
        code: 'mkdir -p ~/stacks/mystack && cd ~/stacks/mystack\n# copy docker-compose.yml and .env here',
      },
      {
        title: 'Start the stack',
        body: 'Bring it up in the background and confirm the containers are healthy.',
        code: 'docker compose up -d\ndocker compose ps',
      },
      {
        title: 'Reach your services / add TLS',
        body:
          (portHints
            ? `On your LAN the services will be at:\n${portHints}\n\n`
            : '') +
          'For clean hostnames and HTTPS, put a reverse proxy in front (Caddy or ' +
          'Nginx Proxy Manager). Caddy gives you automatic HTTPS with a one-line config.',
      },
    ],
    notes: [
      'Prefer booting from an SSD/USB drive — SD cards wear out under database write load.',
      'Back up your SD card / data volumes regularly (e.g. `dd` image, or copy the volume folders).',
    ],
  };
}

function homeServerGuide(stack: PersistedStack): DeploymentGuide {
  const portHints = renderPortHints(stack);
  return {
    env: 'home-server',
    title: 'Deploy to a Home Server',
    intro:
      'Run your stack on an always-on machine on your LAN (NUC, old desktop, NAS). ' +
      'Give it a stable address, put a reverse proxy in front, and back up your volumes.',
    steps: [
      {
        title: 'Install Docker',
        body: 'Install Docker Engine + the compose plugin for your distro.',
        code: 'curl -fsSL https://get.docker.com | sh\ndocker compose version',
      },
      {
        title: 'Give the server a stable address',
        body:
          'Assign a static IP (or a DHCP reservation on your router) and a hostname so ' +
          'links keep working after reboots.',
      },
      {
        title: 'Place the compose files and start',
        body: 'Copy docker-compose.yml and .env onto the server, then start the stack.',
        code: 'docker compose up -d\ndocker compose ps',
      },
      {
        title: 'Reverse proxy + TLS on the LAN',
        body:
          'Front the stack with Caddy or Nginx Proxy Manager for tidy hostnames like ' +
          'https://app.home.lan. For trusted certificates on a LAN, use a real domain with ' +
          'DNS-01 (Let’s Encrypt) so you don’t depend on public port 80/443.' +
          (portHints ? `\n\nDirect (no proxy) the services are at:\n${portHints}` : ''),
      },
      {
        title: 'Volumes & backups',
        body:
          'Your data lives in the named volumes / bind mounts from the compose. Snapshot or ' +
          'copy them on a schedule (and test a restore). Databases: back up with a dump, not a ' +
          'live file copy.',
      },
    ],
    notes: [
      'Keep the host and images updated: `docker compose pull && docker compose up -d`.',
      'Don’t expose the server directly to the internet unless you mean to — keep it LAN-only or behind a VPN.',
    ],
  };
}

function vpsGuide(stack: PersistedStack): DeploymentGuide {
  const portHints = renderPortHints(stack);
  return {
    env: 'vps',
    title: 'Deploy to a VPS',
    intro:
      'Run your stack on a public cloud VPS (Hetzner, DigitalOcean, …). Lock down the ' +
      'firewall, terminate TLS at a reverse proxy, and never expose your database.',
    steps: [
      {
        title: 'Install Docker & harden the firewall',
        body:
          'Install Docker, then allow only SSH + HTTP/HTTPS with ufw. Everything else stays closed; ' +
          'containers talk to each other on the internal compose network.',
        code: 'curl -fsSL https://get.docker.com | sh\nufw default deny incoming\nufw allow 22/tcp\nufw allow 80/tcp\nufw allow 443/tcp\nufw enable',
      },
      {
        title: 'Place the compose files and start',
        body: 'Copy docker-compose.yml and .env to the server, then start the stack.',
        code: 'docker compose up -d\ndocker compose ps',
      },
      {
        title: 'Reverse proxy + Let’s Encrypt (auto-HTTPS)',
        body:
          'Point your domain’s DNS at the VPS, then put Caddy in front — it fetches and renews ' +
          'Let’s Encrypt certificates automatically. Only Caddy binds 80/443; your app stays internal.',
        code:
          '# Caddyfile\napp.example.com {\n  reverse_proxy app:PORT\n}' +
          (portHints ? `\n\n# your services (proxy to these container ports):\n# ${servicePortHints(stack).map(h => `${h.name}:${h.hostPort}`).join('  ')}` : ''),
      },
      {
        title: 'Do NOT expose your database',
        body:
          'Remove any published host port for databases/caches (Postgres 5432, Redis 6379, …) — ' +
          'they only need to be reachable by other containers on the compose network, not the public ' +
          'internet. Publish only the web/reverse-proxy port.',
      },
      {
        title: 'Keep it updated',
        body: 'Apply OS security updates and refresh images regularly.',
        code: 'sudo apt update && sudo apt upgrade -y\ndocker compose pull && docker compose up -d',
      },
    ],
    notes: [
      'Use SSH keys (not passwords) and consider disabling root SSH login.',
      'A leaked database port is the most common self-hosting breach — double-check nothing but 22/80/443 is open.',
    ],
  };
}

/**
 * Return the structured guide for a target environment, with steps that
 * reference the stack's actual services/ports where useful.
 */
export function getDeploymentGuide(env: DeploymentEnv, stack: PersistedStack): DeploymentGuide {
  switch (env) {
    case 'raspberry-pi':
      return raspberryPiGuide(stack);
    case 'home-server':
      return homeServerGuide(stack);
    case 'vps':
      return vpsGuide(stack);
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
