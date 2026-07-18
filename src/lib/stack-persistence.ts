import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import { trpc } from '@/utils/trpc';
import type { StackService, StackServiceConfiguration, ServiceDependency } from '@/types/stack';
import type { Service, ServiceEnvVar, ServiceVolume } from '@/types/service';

export interface PersistedStack {
  // DB ids are string UUIDs; legacy local drafts used numeric ids
  id?: string | number;
  name: string;
  description: string;
  isPublic: boolean;
  services: StackService[];
  createdAt?: Date;
  updatedAt?: Date;
  authorId?: string;
  /** DB lifecycle status ('draft', 'public', …); unsaved local drafts are 'draft'. */
  status?: string;
}

export interface AutoSaveOptions {
  enabled: boolean;
  intervalMs: number;
  maxAutoSaves: number;
}

export interface StackPersistenceConfig {
  autoSave: AutoSaveOptions;
  localStorageKey: string;
  maxLocalStacks: number;
}

const DEFAULT_CONFIG: StackPersistenceConfig = {
  autoSave: {
    enabled: true,
    intervalMs: 30000, // 30 seconds
    maxAutoSaves: 10,
  },
  localStorageKey: 'buildMyStack_localStacks',
  maxLocalStacks: 50,
};

// ==================== DOCKER COMPOSE GENERATION ====================

/** Result of the compose generator: the YAML plus any auto-generated secrets. */
export interface GeneratedCompose {
  yaml: string;
  // Keyed as `${serviceSlug}.${ENV_VAR_NAME}` → generated value.
  secrets: Record<string, string>;
}

/** Options for {@link generateComposeWithSecrets}. */
export interface GenerateComposeOptions {
  /**
   * Replace every secret env value with a placeholder instead of a real value.
   * Used for PUBLIC views (shared-stack pages) so passwords are never exposed.
   * No secrets are generated or returned when this is on.
   */
  maskSecrets?: boolean;
}

/** Placeholder written in place of a secret value when {@link GenerateComposeOptions.maskSecrets} is set. */
export const SECRET_PLACEHOLDER = '<secret>';

/**
 * Backstop for masking user-added env vars the catalog doesn't flag as secret.
 * Catalog `secret: true` is the authoritative signal; this name heuristic only
 * catches custom vars. Over-masking a public view is safe; under-masking isn't.
 */
function isSecretName(name: string): boolean {
  return /password|secret|token|api[_-]?key|credential|private[_-]?key/i.test(name);
}

/**
 * Generate a strong, URL-safe random secret. Works in both the browser and
 * Node via the Web Crypto API (globalThis.crypto), avoiding a hard dependency
 * on Node's `crypto` module in client bundles.
 */
function generateSecret(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  let binary = '';
  for (const byte of arr) binary += String.fromCharCode(byte);
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(arr).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Read env metadata from a service (supports the API shape too). */
function readEnvMeta(service: Service): ServiceEnvVar[] {
  const raw: unknown = service.env ?? service.environmentVariables;
  if (Array.isArray(raw)) {
    return raw.filter(
      (e): e is ServiceEnvVar =>
        !!e && typeof e === 'object' && typeof (e as ServiceEnvVar).name === 'string'
    );
  }
  return [];
}

/** Read volume metadata from a service (tolerates a raw JSON string). */
function readVolumeMeta(service: Service): ServiceVolume[] {
  let raw: unknown = service.volumes;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter(
      (v): v is ServiceVolume =>
        !!v && typeof v === 'object' && typeof (v as ServiceVolume).containerPath === 'string'
    );
  }
  return [];
}

/** Derive a stable, unique, docker-safe volume/bind name from a container path. */
function volumeName(slug: string, containerPath: string, used: Set<string>): string {
  const segments = containerPath.split('/').filter(Boolean);
  const tail = segments.slice(-2).join('_') || 'data';
  const base = `${slug}_${tail}`.replace(/[^a-z0-9_]+/gi, '_').replace(/_+/g, '_').toLowerCase();
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base}_${i++}`;
  used.add(name);
  return name;
}

/** Known healthchecks keyed by service family. Returns undefined when unknown. */
function healthcheckFor(
  slug: string,
  image: string,
  environment: Record<string, string>
): Record<string, unknown> | undefined {
  const s = slug.toLowerCase();
  const img = image.toLowerCase();
  const base = { interval: '10s', timeout: '5s', retries: 5 };
  if (s === 'postgresql' || s === 'postgres' || /postgres/.test(img)) {
    const user = environment.POSTGRES_USER || 'postgres';
    return { test: ['CMD-SHELL', `pg_isready -U ${user}`], ...base };
  }
  if (s === 'mysql' || s === 'mariadb' || /(mysql|mariadb)/.test(img)) {
    return { test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost'], ...base };
  }
  if (s === 'redis' || /redis/.test(img)) {
    return { test: ['CMD', 'redis-cli', 'ping'], ...base };
  }
  if (s === 'mongodb' || s === 'mongo' || /mongo/.test(img)) {
    return { test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"], ...base };
  }
  return undefined;
}

const APP_NETWORK = 'appnet';

/**
 * Build a real, deployable docker-compose document from a stack and return the
 * serialized YAML plus any secrets that were auto-generated for required secret
 * env vars. Merges catalog metadata (env/volumes) with per-service user config.
 */
export function generateComposeWithSecrets(
  stack: PersistedStack,
  opts: GenerateComposeOptions = {},
): GeneratedCompose {
  const services: Record<string, unknown> = {};
  const topLevelVolumes: Record<string, unknown> = {};
  const secrets: Record<string, string> = {};
  const usedVolumeNames = new Set<string>();

  // Map serviceId → slug so depends_on can reference container names.
  const idToSlug = new Map<number, string>();
  for (const ss of stack.services) {
    if (ss.service?.slug) idToSlug.set(ss.serviceId, ss.service.slug);
  }

  for (const stackService of stack.services) {
    const service = stackService.service;
    const config = stackService.configuration ?? {
      environmentVariables: {},
      portMappings: [],
      volumeMounts: [],
      dependsOn: [],
    };
    const slug = service.slug;

    // dockerImage may already include a tag (e.g. "postgres:18-alpine").
    const imageHasTag = service.dockerImage?.split('/').pop()?.includes(':');
    const image =
      imageHasTag || !service.version
        ? service.dockerImage
        : `${service.dockerImage}:${service.version}`;

    const svc: Record<string, unknown> = {
      image,
      container_name: slug,
      restart: 'unless-stopped',
    };

    // Ports: host:container[/proto] from the user's port mappings.
    if (config.portMappings?.length) {
      svc.ports = config.portMappings.map(port => {
        const proto = port.protocol && port.protocol !== 'tcp' ? `/${port.protocol}` : '';
        return `${port.hostPort}:${port.containerPort}${proto}`;
      });
    }

    // Environment: catalog metadata merged with user overrides; generate
    // secrets for required+secret vars that have no user value.
    const environment: Record<string, string> = {};
    const userEnv = (config.environmentVariables ?? {}) as Record<string, string>;
    for (const ev of readEnvMeta(service)) {
      const userValue = userEnv[ev.name];
      if (opts.maskSecrets && (ev.secret || isSecretName(ev.name))) {
        // Public view: never expose the value, generated or user-supplied.
        environment[ev.name] = SECRET_PLACEHOLDER;
      } else if (userValue !== undefined && userValue !== '') {
        environment[ev.name] = String(userValue);
      } else if (ev.required && ev.secret) {
        const value = generateSecret();
        environment[ev.name] = value;
        secrets[`${slug}.${ev.name}`] = value;
      } else if (ev.default !== undefined) {
        environment[ev.name] = ev.default;
      }
    }
    // Preserve any extra user-provided env vars not described by the catalog.
    // Only scalar values — guard against non-string config leaking into compose.
    for (const [key, value] of Object.entries(userEnv)) {
      if (key in environment) continue;
      if (value === null || value === undefined || typeof value === 'object') continue;
      environment[key] =
        opts.maskSecrets && isSecretName(key) ? SECRET_PLACEHOLDER : String(value);
    }
    // Escape `$` → `$$` so docker compose (and Portainer/Coolify) don't
    // interpolate literal `$` in passwords etc. Generated secrets are base64url
    // (no `$`) so this is a no-op for them; the returned `secrets` map keeps the
    // raw values.
    for (const k of Object.keys(environment)) {
      if (environment[k] !== SECRET_PLACEHOLDER) {
        environment[k] = environment[k].replace(/\$/g, '$$$$');
      }
    }
    if (Object.keys(environment).length) svc.environment = environment;

    // Volumes: catalog named volumes → `name:containerPath`; catalog binds →
    // `./name:containerPath`; plus any explicit user volume mounts.
    const volumeEntries: string[] = [];
    for (const vol of readVolumeMeta(service)) {
      const name = volumeName(slug, vol.containerPath, usedVolumeNames);
      if (vol.named) {
        volumeEntries.push(`${name}:${vol.containerPath}`);
        topLevelVolumes[name] = {};
      } else {
        volumeEntries.push(`./${name}:${vol.containerPath}`);
      }
    }
    if (config.volumeMounts?.length) {
      for (const mount of config.volumeMounts) {
        volumeEntries.push(
          `${mount.hostPath}:${mount.containerPath}${mount.readOnly ? ':ro' : ''}`
        );
      }
    }
    if (volumeEntries.length) svc.volumes = volumeEntries;

    // depends_on: resolve to container names (slugs).
    const depNames: string[] = [];
    for (const dep of (config.dependsOn ?? []) as Array<unknown>) {
      if (typeof dep === 'string') {
        depNames.push(dep);
      } else if (dep && typeof dep === 'object') {
        const d = dep as { serviceId?: number; slug?: string; name?: string };
        if (typeof d.serviceId === 'number' && idToSlug.has(d.serviceId)) {
          depNames.push(idToSlug.get(d.serviceId)!);
        } else if (typeof d.slug === 'string') {
          depNames.push(d.slug);
        } else if (typeof d.name === 'string') {
          depNames.push(d.name);
        }
      }
    }
    if (depNames.length) svc.depends_on = depNames;

    // Healthcheck for well-known service families.
    const healthcheck = healthcheckFor(slug, image, environment);
    if (healthcheck) svc.healthcheck = healthcheck;

    svc.networks = [APP_NETWORK];

    services[slug] = svc;
  }

  const doc: Record<string, unknown> = { services };
  if (Object.keys(topLevelVolumes).length) doc.volumes = topLevelVolumes;
  doc.networks = { [APP_NETWORK]: { driver: 'bridge' } };

  const yaml = yamlStringify(doc, { lineWidth: 0 });
  return { yaml, secrets };
}

/**
 * Split a docker image reference into `{ image, tag }`, correctly handling a
 * registry port (`registry:5000/nginx`) and a digest (`nginx@sha256:…`).
 */
export function parseImageRef(imageStr: string): { image: string; tag: string } {
  let ref = String(imageStr).trim();
  const at = ref.indexOf('@');
  if (at >= 0) ref = ref.slice(0, at); // drop @sha256:… digest
  const lastColon = ref.lastIndexOf(':');
  const lastSlash = ref.lastIndexOf('/');
  if (lastColon > lastSlash && lastColon !== -1) {
    return { image: ref.slice(0, lastColon), tag: ref.slice(lastColon + 1) || 'latest' };
  }
  return { image: ref, tag: 'latest' };
}

/**
 * Parse one docker-compose port entry — short string `[[ip:]host:]container[/proto]`
 * or long-form `{ target, published }` — into `{ host, container }`. Returns
 * null when no numeric container port can be resolved.
 */
export function parseComposePort(
  entry: unknown,
): { host: number; container: number } | null {
  if (entry && typeof entry === 'object') {
    const o = entry as { target?: number | string; published?: number | string };
    const container = Number(o.target);
    if (!Number.isFinite(container)) return null;
    const host = Number(o.published);
    return { host: Number.isFinite(host) ? host : container, container };
  }
  const raw = String(entry).split('/')[0]; // drop /tcp,/udp
  const segs = raw.split(':').map((s) => s.trim());
  const container = Number(segs[segs.length - 1]);
  if (!Number.isFinite(container)) return null;
  const host = segs.length >= 2 ? Number(segs[segs.length - 2]) : container;
  return { host: Number.isFinite(host) ? host : container, container };
}

/** The API/DB record shape a `stacks.create`/`update` service config must use. */
export interface ApiConfigShape {
  environmentVariables: Record<string, string>;
  portMappings: Record<string, string>;
  volumeMounts: Record<string, string>;
  dependsOn: string[];
}

/**
 * Convert a builder service configuration (ARRAY shape) into the RECORD shape
 * the `stacks` router schema (`z.record`) enforces. The single source of truth
 * for this conversion — SaveStackModal and `savePermanently` both use it, so
 * the "save to database" paths can't drift and send an array the schema rejects.
 * Tolerant of already-record input (idempotent).
 */
export function stackConfigToApiShape(
  config: Partial<StackServiceConfiguration> | undefined,
): ApiConfigShape {
  const cfg = config ?? {};
  const portMappings: Record<string, string> = {};
  if (Array.isArray(cfg.portMappings)) {
    for (const pm of cfg.portMappings) {
      if (pm && typeof pm.containerPort === 'number' && typeof pm.hostPort === 'number') {
        portMappings[String(pm.containerPort)] = String(pm.hostPort);
      }
    }
  } else if (cfg.portMappings && typeof cfg.portMappings === 'object') {
    Object.assign(portMappings, cfg.portMappings as Record<string, string>);
  }

  const volumeMounts: Record<string, string> = {};
  if (Array.isArray(cfg.volumeMounts)) {
    for (const vm of cfg.volumeMounts) {
      if (vm && vm.containerPath && vm.hostPath) {
        volumeMounts[String(vm.containerPath)] = String(vm.hostPath);
      }
    }
  } else if (cfg.volumeMounts && typeof cfg.volumeMounts === 'object') {
    Object.assign(volumeMounts, cfg.volumeMounts as Record<string, string>);
  }

  const dependsOn: string[] = Array.isArray(cfg.dependsOn)
    ? cfg.dependsOn
        .map((d) => (typeof d === 'string' ? d : String((d as ServiceDependency)?.serviceId ?? '')))
        .filter(Boolean)
    : [];

  return {
    environmentVariables: (cfg.environmentVariables ?? {}) as Record<string, string>,
    portMappings,
    volumeMounts,
    dependsOn,
  };
}

export class StackPersistenceService {
  private config: StackPersistenceConfig;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private lastSavedState: string | null = null;

  constructor(config: Partial<StackPersistenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==================== TEMPORARY STORAGE (Local Storage) ====================

  /**
   * Save stack to local storage as temporary draft
   */
  async saveToLocalStorage(
    stack: PersistedStack, 
    options: { isDraft?: boolean; autoSave?: boolean } = {}
  ): Promise<void> {
    const { isDraft = false, autoSave = false } = options;

    try {
      const localStacks = this.getLocalStacks();
      const timestamp = new Date().toISOString();
      
      const stackToSave = {
        ...stack,
        id: stack.id || this.generateLocalId(),
        createdAt: stack.createdAt || new Date(timestamp),
        updatedAt: new Date(timestamp),
        metadata: {
          isDraft,
          autoSave,
          lastModified: timestamp,
        }
      };

      // Remove existing stack with same name or ID
      const filteredStacks = localStacks.filter(
        s => s.name !== stack.name && s.id !== stack.id
      );

      // Add the new/updated stack
      filteredStacks.unshift(stackToSave);

      // Keep only the most recent stacks
      const trimmedStacks = filteredStacks.slice(0, this.config.maxLocalStacks);

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          this.config.localStorageKey,
          JSON.stringify(trimmedStacks)
        );
      }

      console.log(`Stack "${stack.name}" saved to local storage`, {
        isDraft,
        autoSave,
        totalLocalStacks: trimmedStacks.length
      });
    } catch (error) {
      console.error('Failed to save stack to local storage:', error);
      throw new Error('Failed to save stack locally');
    }
  }

  /**
   * Load all stacks from local storage
   */
  getLocalStacks(): PersistedStack[] {
    try {
      if (typeof window === 'undefined') return [];
      
      const stored = localStorage.getItem(this.config.localStorageKey);
      if (!stored) return [];
      
      const stacks = JSON.parse(stored);
      return Array.isArray(stacks) ? stacks : [];
    } catch (error) {
      console.error('Failed to load local stacks:', error);
      return [];
    }
  }

  /**
   * Load specific stack from local storage
   */
  getLocalStack(stackId: number | string): PersistedStack | null {
    const localStacks = this.getLocalStacks();
    return localStacks.find(s => s.id === stackId || s.name === stackId) || null;
  }

  /**
   * Delete stack from local storage
   */
  deleteLocalStack(stackId: number | string): boolean {
    try {
      const localStacks = this.getLocalStacks();
      const filteredStacks = localStacks.filter(
        s => s.id !== stackId && s.name !== stackId
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          this.config.localStorageKey,
          JSON.stringify(filteredStacks)
        );
      }

      return filteredStacks.length !== localStacks.length;
    } catch (error) {
      console.error('Failed to delete local stack:', error);
      return false;
    }
  }

  /**
   * Clear all local stacks
   */
  clearLocalStacks(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.config.localStorageKey);
      }
    } catch (error) {
      console.error('Failed to clear local stacks:', error);
    }
  }

  // ==================== PERMANENT STORAGE (Database) ====================

  /**
   * Save stack to database permanently using vanilla tRPC client
   */
  async saveToDatabase(stack: PersistedStack): Promise<any> {
    try {
      // Import vanilla API client dynamically to avoid SSR issues
      const { api } = await import('@/utils/trpc');

      // Transform stack data to match tRPC schema
      const stackInput: any = {
        name: stack.name,
        description: stack.description || '',
        isPublic: stack.isPublic || false,
        status: 'draft' as const,
        services: stack.services.map((stackService, index) => ({
          serviceId: stackService.serviceId,
          order: index + 1,
          // Builder config is the ARRAY shape; the API schema is RECORD.
          configuration: stackConfigToApiShape(stackService.configuration)
        }))
      };

      // If stack has an ID, update it; otherwise create new
      if (stack.id && typeof stack.id === 'string') {
        const updateInput: any = {
          id: stack.id,
          name: stackInput.name,
          description: stackInput.description,
          isPublic: stackInput.isPublic,
          status: stackInput.status,
          services: stackInput.services
        };
        const updatedStack = await api.stacks.update.mutate(updateInput);
        return updatedStack;
      } else {
        const createdStack = await api.stacks.create.mutate(stackInput);
        return createdStack;
      }
    } catch (error) {
      console.error('Failed to save stack to database:', error);
      throw new Error('Failed to save stack to database');
    }
  }

  /**
   * Update existing stack in database
   */
  async updateInDatabase(stackId: string, stack: Partial<PersistedStack>): Promise<any> {
    try {
      const { api } = await import('@/utils/trpc');

      const updateData: any = {
        id: stackId
      };

      if (stack.name) updateData.name = stack.name;
      if (stack.description !== undefined) updateData.description = stack.description;
      if (stack.isPublic !== undefined) updateData.isPublic = stack.isPublic;

      if (stack.services) {
        updateData.services = stack.services.map((stackService, index) => ({
          serviceId: stackService.serviceId,
          order: index + 1,
          configuration: stackConfigToApiShape(stackService.configuration)
        }));
      }

      const updatedStack = await api.stacks.update.mutate(updateData);
      return updatedStack;
    } catch (error) {
      console.error('Failed to update stack in database:', error);
      throw new Error('Failed to update stack in database');
    }
  }

  /**
   * Delete stack from database
   */
  async deleteFromDatabase(stackId: string): Promise<boolean> {
    try {
      const { api } = await import('@/utils/trpc');
      const result = await api.stacks.delete.mutate({ id: stackId });
      return result.success;
    } catch (error) {
      console.error('Failed to delete stack from database:', error);
      throw new Error('Failed to delete stack from database');
    }
  }

  /**
   * Load user's stacks from database
   */
  async loadUserStacks(options: { limit?: number; cursor?: string } = {}): Promise<any> {
    try {
      const { api } = await import('@/utils/trpc');
      const result = await api.stacks.list.query({
        limit: options.limit || 20,
        cursor: options.cursor,
      });
      return result;
    } catch (error) {
      console.error('Failed to load user stacks:', error);
      throw new Error('Failed to load user stacks');
    }
  }

  /**
   * Load public stacks/templates from database
   */
  async loadPublicStacks(options: {
    limit?: number;
    cursor?: string;
    category?: string;
  } = {}): Promise<any> {
    try {
      const { api } = await import('@/utils/trpc');
      const result = await api.stacks.getPublicTemplates.query({
        limit: options.limit || 20,
        cursor: options.cursor,
        category: options.category
      });
      return result;
    } catch (error) {
      console.error('Failed to load public stacks:', error);
      throw new Error('Failed to load public stacks');
    }
  }

  // ==================== AUTO-SAVE FUNCTIONALITY ====================

  /**
   * Start auto-save timer
   */
  startAutoSave(getStackData: () => PersistedStack | null): void {
    if (!this.config.autoSave.enabled) return;

    this.stopAutoSave(); // Clear existing timer

    this.autoSaveTimer = setInterval(async () => {
      try {
        const currentStack = getStackData();
        if (!currentStack) return;

        // Check if state has changed
        const currentStateString = JSON.stringify(currentStack);
        if (currentStateString === this.lastSavedState) return;

        // Auto-save to local storage
        await this.saveToLocalStorage(currentStack, { 
          isDraft: true, 
          autoSave: true 
        });

        this.lastSavedState = currentStateString;
        
        console.log('Stack auto-saved to local storage');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.config.autoSave.intervalMs);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // ==================== IMPORT/EXPORT FUNCTIONALITY ====================

  /**
   * Export stack to a deployable Docker Compose YAML string.
   *
   * Backwards-compatible string path: existing callers get the YAML only.
   * Use the module-level `generateComposeWithSecrets` when you also need the
   * auto-generated secret values (e.g. to surface them in the UI).
   */
  exportToDockerCompose(stack: PersistedStack): string {
    return generateComposeWithSecrets(stack).yaml;
  }

  /**
   * Import stack from Docker Compose YAML
   * Parses docker-compose.yml and extracts service configurations
   */
  importFromDockerCompose(yamlContent: string): {
    name: string;
    description: string;
    isPublic: boolean;
    parsedServices: Array<{
      name: string;
      image: string;
      tag: string;
      ports: Array<{ host: number; container: number }>;
      environment: Record<string, string>;
      volumes: Array<{ host: string; container: string; readOnly: boolean }>;
      dependsOn: string[];
    }>;
  } {
    try {
      // Parse YAML with the declared `yaml` dep (js-yaml was never a dependency).
      const parsed = yamlParse(yamlContent) as any;

      if (!parsed || !parsed.services) {
        throw new Error('Invalid docker-compose format: missing services section');
      }

      const parsedServices: Array<{
        name: string;
        image: string;
        tag: string;
        ports: Array<{ host: number; container: number }>;
        environment: Record<string, string>;
        volumes: Array<{ host: string; container: string; readOnly: boolean }>;
        dependsOn: string[];
      }> = [];

      // Parse each service from docker-compose
      Object.entries(parsed.services).forEach(([serviceName, serviceConfig]: [string, any]) => {
        // Extract image + tag. A naive split(':') mis-parses a registry port
        // (`registry:5000/img`) and a digest (`img@sha256:…`): the tag is the
        // segment after the LAST colon, but only when no `/` follows it.
        const { image, tag } = parseImageRef(serviceConfig.image || '');

        // Parse port mappings. Docker syntax is `[[ip:]host:]container[/proto]`
        // (or the long-form object) — the container port is the LAST numeric
        // segment, the host port the one before it. A plain split mis-reads
        // `127.0.0.1:8080:80` as host=127.
        const ports: Array<{ host: number; container: number }> = [];
        if (serviceConfig.ports && Array.isArray(serviceConfig.ports)) {
          serviceConfig.ports.forEach((portMapping: unknown) => {
            const mapped = parseComposePort(portMapping);
            if (mapped) ports.push(mapped);
          });
        }

        // Parse environment variables
        const environment: Record<string, string> = {};
        if (serviceConfig.environment) {
          if (Array.isArray(serviceConfig.environment)) {
            // Environment as array: ["KEY=value", "KEY2=value2"]
            serviceConfig.environment.forEach((env: string) => {
              const [key, ...valueParts] = env.split('=');
              if (key) {
                environment[key.trim()] = valueParts.join('=').trim();
              }
            });
          } else if (typeof serviceConfig.environment === 'object') {
            // Environment as object: { KEY: "value", KEY2: "value2" }
            Object.entries(serviceConfig.environment).forEach(([key, value]) => {
              environment[key] = String(value);
            });
          }
        }

        // Parse volume mounts
        const volumes: Array<{ host: string; container: string; readOnly: boolean }> = [];
        if (serviceConfig.volumes && Array.isArray(serviceConfig.volumes)) {
          serviceConfig.volumes.forEach((volumeStr: string) => {
            if (typeof volumeStr === 'string') {
              const parts = volumeStr.split(':');
              if (parts.length >= 2) {
                const readOnly = parts[2]?.toLowerCase() === 'ro';
                volumes.push({
                  host: parts[0].trim(),
                  container: parts[1].trim(),
                  readOnly
                });
              }
            }
          });
        }

        // Parse dependencies
        const dependsOn: string[] = [];
        if (serviceConfig.depends_on) {
          if (Array.isArray(serviceConfig.depends_on)) {
            dependsOn.push(...serviceConfig.depends_on.map((dep: string) => String(dep)));
          } else if (typeof serviceConfig.depends_on === 'object') {
            // Docker Compose v3+ format: depends_on: { service: { condition: "..." } }
            dependsOn.push(...Object.keys(serviceConfig.depends_on));
          }
        }

        parsedServices.push({
          name: serviceName,
          image,
          tag,
          ports,
          environment,
          volumes,
          dependsOn
        });
      });

      return {
        name: 'Imported Stack',
        description: `Imported from Docker Compose with ${parsedServices.length} services`,
        isPublic: false,
        parsedServices
      };
    } catch (error) {
      console.error('Failed to import Docker Compose:', error);
      throw new Error(
        error instanceof Error
          ? `Failed to parse docker-compose.yml: ${error.message}`
          : 'Invalid Docker Compose format'
      );
    }
  }

  /**
   * Export stack as JSON for sharing
   */
  exportAsJSON(stack: PersistedStack): string {
    const exportData = {
      version: '1.0',
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'BuildMyStack',
      },
      stack: {
        name: stack.name,
        description: stack.description,
        services: stack.services.map(stackService => ({
          service: {
            name: stackService.service.name,
            slug: stackService.service.slug,
            dockerImage: stackService.service.dockerImage,
            version: stackService.service.version,
            category: stackService.service.category.name,
          },
          configuration: stackService.configuration,
          order: stackService.order,
        })),
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  // ==================== UTILITY METHODS ====================

  private generateLocalId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): {
    localStacks: number;
    localStorageSize: number;
    autoSaveEnabled: boolean;
  } {
    const localStacks = this.getLocalStacks();
    const localStorageSize = typeof window !== 'undefined' 
      ? JSON.stringify(localStacks).length 
      : 0;

    return {
      localStacks: localStacks.length,
      localStorageSize,
      autoSaveEnabled: this.config.autoSave.enabled,
    };
  }

  /**
   * Clean up old auto-saves
   */
  cleanupOldAutoSaves(): void {
    const localStacks = this.getLocalStacks();
    const now = new Date();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    const cleanedStacks = localStacks.filter(stack => {
      const metadata = (stack as any).metadata;
      if (!metadata?.autoSave) return true;

      const lastModified = new Date(metadata.lastModified);
      return (now.getTime() - lastModified.getTime()) < maxAge;
    });

    if (cleanedStacks.length !== localStacks.length) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          this.config.localStorageKey,
          JSON.stringify(cleanedStacks)
        );
      }
      console.log(`Cleaned up ${localStacks.length - cleanedStacks.length} old auto-saves`);
    }
  }
}

// Default instance
export const stackPersistence = new StackPersistenceService();

// Bound once at module scope so the hook returns stable function identities.
// Returning fresh `.bind()` results on every render made consumers' effects
// (which list these functions as dependencies and call setState) re-run on
// every render — an infinite "Maximum update depth exceeded" loop.
const boundStackPersistence = {
  saveToLocalStorage: stackPersistence.saveToLocalStorage.bind(stackPersistence),
  getLocalStacks: stackPersistence.getLocalStacks.bind(stackPersistence),
  getLocalStack: stackPersistence.getLocalStack.bind(stackPersistence),
  deleteLocalStack: stackPersistence.deleteLocalStack.bind(stackPersistence),
  clearLocalStacks: stackPersistence.clearLocalStacks.bind(stackPersistence),
  exportToDockerCompose: stackPersistence.exportToDockerCompose.bind(stackPersistence),
  exportAsJSON: stackPersistence.exportAsJSON.bind(stackPersistence),
  startAutoSave: stackPersistence.startAutoSave.bind(stackPersistence),
  stopAutoSave: stackPersistence.stopAutoSave.bind(stackPersistence),
  getStorageStats: stackPersistence.getStorageStats.bind(stackPersistence),
};

// Hooks for React components
export function useStackPersistence() {
  return boundStackPersistence;
}