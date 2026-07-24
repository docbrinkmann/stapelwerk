/**
 * Per-stack documentation generator.
 *
 * Turns a finished stack into a single, comprehensive README the user can drop
 * next to their `docker-compose.yml`: overview, service list, a ports table
 * (what to open in a browser), volumes (what persists / how to back up), where
 * the generated secrets live, start/stop commands, and a Troubleshooting
 * section grounded in the stack's own services.
 *
 * This is the SINGLE source of truth for the downloadable README — `handoff.ts`
 * `buildReadme` delegates here so there are never two competing docs.
 */

import type { PersistedStack } from '@/lib/stack-persistence';
import type { StackService } from '@/types/stack';
import type { ServiceVolume } from '@/types/service';

/** Options controlling the generated doc. */
export interface StackDocsOptions {
  /** Optional environment guide markdown appended verbatim at the end. */
  guideMarkdown?: string;
  /** Generated secret keys (values not needed) to reference concretely. */
  secrets?: Record<string, string>;
}

/** Resolve the fully-qualified image ref, mirroring the compose generator. */
function resolveImage(service: StackService['service']): string {
  const imageHasTag = service.dockerImage?.split('/').pop()?.includes(':');
  if (imageHasTag || !service.version) return service.dockerImage;
  return `${service.dockerImage}:${service.version}`;
}

/** A short "purpose" line for a service, from its metadata. */
function servicePurpose(service: StackService['service']): string {
  const desc = service.description?.trim();
  if (desc) return desc;
  const category = service.category?.name;
  return category ? `${category} service` : 'Service';
}

function markdownTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(cells => `| ${cells.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

/** Rows for the services table: name, image, purpose. */
function serviceRows(stack: PersistedStack): string[][] {
  return stack.services.map(ss => [
    ss.service.name,
    `\`${resolveImage(ss.service)}\``,
    servicePurpose(ss.service),
  ]);
}

/** Rows for the ports table, from each service's published host ports. */
function portRows(stack: PersistedStack): string[][] {
  const rows: string[][] = [];
  for (const ss of stack.services) {
    for (const mapping of ss.configuration?.portMappings ?? []) {
      if (typeof mapping.hostPort !== 'number') continue;
      rows.push([
        ss.service.name,
        `http://localhost:${mapping.hostPort}`,
        `${mapping.hostPort} → ${mapping.containerPort}`,
      ]);
    }
  }
  return rows;
}

/**
 * Read a service's catalog volume metadata. Mirrors the compose generator's
 * tolerance: the catalog stores `volumes` as a JSON string at runtime, so a
 * naive `for..of` would iterate it character-by-character.
 */
function readVolumeMeta(service: StackService['service']): ServiceVolume[] {
  let raw: unknown = service.volumes;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is ServiceVolume =>
      !!v && typeof v === 'object' && typeof (v as ServiceVolume).containerPath === 'string',
  );
}

/** Human list of what persists: named catalog volumes + user bind mounts. */
function volumeLines(stack: PersistedStack): string[] {
  const lines: string[] = [];
  for (const ss of stack.services) {
    const meta = readVolumeMeta(ss.service);
    for (const vol of meta) {
      const kind = vol.named ? 'named volume' : 'bind mount';
      const purpose = vol.description ? ` — ${vol.description}` : '';
      lines.push(`**${ss.service.name}** \`${vol.containerPath}\` (${kind})${purpose}`);
    }
    for (const mount of ss.configuration?.volumeMounts ?? []) {
      lines.push(`**${ss.service.name}** \`${mount.hostPath}\` → \`${mount.containerPath}\` (bind mount)`);
    }
  }
  return lines;
}

/** Services that are databases — used to tailor the troubleshooting section. */
function databaseServices(stack: PersistedStack): string[] {
  const names: string[] = [];
  for (const ss of stack.services) {
    const hay = `${ss.service.slug} ${ss.service.dockerImage}`.toLowerCase();
    if (/(postgres|mysql|mariadb|mongo)/.test(hay)) names.push(ss.service.name);
  }
  return names;
}

/** Services using LinuxServer.io images — they need PUID/PGID guidance. */
function linuxserverServices(stack: PersistedStack): string[] {
  return stack.services
    .filter(ss => /(linuxserver|lscr\.io)/i.test(ss.service.dockerImage ?? ''))
    .map(ss => ss.service.name);
}

/** Render the Troubleshooting section, grounded in the stack's own services. */
function troubleshooting(stack: PersistedStack): string[] {
  const dbs = databaseServices(stack);
  const lsio = linuxserverServices(stack);
  const parts: string[] = ['## Troubleshooting', ''];

  parts.push(
    '### Port already in use',
    '',
    'If a container fails with `address already in use` or `bind: address already in use`,',
    'another process already owns that host port. Find it and free it, or change the host',
    'side of the mapping in `docker-compose.yml`:',
    '',
    '```bash',
    'sudo lsof -i :<port>      # what is using the port',
    'docker compose down       # stop this stack, then edit the ports and up again',
    '```',
    '',
    '### A container is unhealthy or keeps restarting',
    '',
    'Check status and read that service\'s logs — the error is almost always there:',
    '',
    '```bash',
    'docker compose ps',
    'docker compose logs -f <service>',
    '```',
    '',
    'Services with a healthcheck (databases, caches) may show `starting` for a few seconds',
    'before `healthy`; give them a moment before assuming a failure.',
    '',
  );

  parts.push(
    '### Permissions (PUID / PGID)',
    '',
    lsio.length > 0
      ? `LinuxServer.io images in this stack (${lsio.join(', ')}) run as a configurable user. ` +
          'If you hit permission-denied errors on mounted folders, set `PUID`/`PGID` to your ' +
          'host user (find them with `id -u` / `id -g`) and make sure that user owns the ' +
          'mounted directories (`sudo chown -R <uid>:<gid> <path>`).'
      : 'If a container cannot write to a mounted folder, it is usually a UID mismatch. ' +
          'LinuxServer.io images accept `PUID`/`PGID` (set them to `id -u` / `id -g`); for ' +
          'other images, `chown` the host directory to the user the container runs as.',
    '',
  );

  parts.push(
    '### Database will not start',
    '',
    dbs.length > 0
      ? `Databases in this stack (${dbs.join(', ')}) refuse to start without a password. ` +
          'Stapelwerk generates one for each and inlines it into the compose (mirrored in ' +
          '`.env`), so this should already be set — do not blank it out. If you rotate a ' +
          'password after the first run, you must also reset the data volume or the old ' +
          'credentials will keep being enforced.'
      : 'Database images typically refuse to start until their password env var is set ' +
          '(e.g. `POSTGRES_PASSWORD`). Generated values are inlined in the compose and ' +
          'mirrored in `.env`; keep them in place.',
    '',
  );

  parts.push(
    '### Where to see logs',
    '',
    'All container output is available through Compose:',
    '',
    '```bash',
    'docker compose logs -f            # everything, followed live',
    'docker compose logs <service>     # a single service',
    '```',
  );

  return parts;
}

/**
 * Build the full per-stack README as markdown. Includes every section the
 * handoff needs and, optionally, an appended environment guide.
 */
export function buildStackDocs(stack: PersistedStack, options: StackDocsOptions = {}): string {
  const name = stack.name?.trim() || 'My Stack';
  const serviceNames = stack.services.map(s => s.service.name).join(', ') || 'no services';
  const parts: string[] = [];

  // Title + overview.
  parts.push(`# ${name}`, '');
  parts.push(`Generated by Stapelwerk. Services: ${serviceNames}.`, '');
  parts.push('## Overview', '');
  if (stack.description?.trim()) parts.push(stack.description.trim(), '');
  parts.push(
    `This stack runs ${stack.services.length} service${stack.services.length === 1 ? '' : 's'} ` +
      'via Docker Compose. The generated `docker-compose.yml` is self-contained — all values, ' +
      'including auto-generated passwords, are inlined, so it runs on its own.',
    '',
  );

  // Files.
  parts.push(
    '## Files',
    '',
    '- `docker-compose.yml` — the full stack. Generated passwords are inlined, so it runs on its own.',
    '- `.env` — a reference copy of the generated passwords (`KEY=value`). Keep it safe.',
    '',
  );

  // Services table.
  if (stack.services.length > 0) {
    parts.push('## Services', '');
    parts.push(markdownTable(['Service', 'Image', 'Purpose'], serviceRows(stack)), '');
  }

  // Ports table.
  const ports = portRows(stack);
  parts.push('## Ports', '');
  if (ports.length > 0) {
    parts.push(
      'Open these in a browser once the stack is up:',
      '',
      markdownTable(['Service', 'Open in browser', 'Host → Container'], ports),
      '',
      'On another machine, replace `localhost` with the host\'s IP or hostname.',
      '',
    );
  } else {
    parts.push('No host ports are published — services talk to each other on the internal network only.', '');
  }

  // Volumes.
  const volumes = volumeLines(stack);
  parts.push('## Volumes & data', '');
  if (volumes.length > 0) {
    parts.push('These paths hold data that must survive a container restart:', '');
    for (const line of volumes) parts.push(`- ${line}`);
    parts.push(
      '',
      'Back them up on a schedule and test a restore. For databases, take a proper dump ' +
        '(e.g. `pg_dump`) rather than copying files from a running container.',
      '',
    );
  } else {
    parts.push('This stack declares no persistent volumes — data lives only inside the containers.', '');
  }

  // Generated secrets.
  parts.push('## Generated secrets', '');
  const secretKeys = Object.keys(options.secrets ?? {});
  if (secretKeys.length > 0) {
    parts.push(
      `Stapelwerk generated ${secretKeys.length} secret${secretKeys.length === 1 ? '' : 's'} for this stack ` +
        '(e.g. database passwords). They are inlined in `docker-compose.yml` and mirrored in `.env`.',
      '',
    );
  } else {
    parts.push(
      'Any passwords Stapelwerk generated for you are inlined in `docker-compose.yml` and ' +
        'mirrored in `.env`.',
      '',
    );
  }
  parts.push(
    'Store `.env` somewhere safe (a password manager or secrets store) — you will need these ' +
      'values to access your services, and they are not recoverable if lost.',
    '',
  );

  // Start / stop.
  parts.push(
    '## Start & stop',
    '',
    '```bash',
    'docker compose up -d      # start the stack in the background',
    'docker compose ps         # check status',
    'docker compose logs -f    # follow logs',
    'docker compose stop       # stop without removing containers',
    'docker compose down       # stop and remove containers (volumes are kept)',
    '```',
    '',
  );

  // Troubleshooting.
  parts.push(...troubleshooting(stack));

  // Optional environment guide.
  if (options.guideMarkdown) {
    parts.push('', '---', '', options.guideMarkdown);
  }

  return `${parts.join('\n').trimEnd()}\n`;
}
