import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import type { Context } from '../trpc'
import { renderCiApplyTemplate } from '@/lib/deploy/ci'
import {
  runCompose,
  sanitizeProjectName,
  stripContainerNames,
  type ComposeAction,
} from '@/lib/deploy/compose-executor'
import { runComposeViaBridge, type BridgeRemoteTarget } from '@/lib/deploy/deploy-bridge'
import {
  runRemoteCompose,
  resolveDeployKeyFile,
  resolveDeployPublicKey,
  ensureDeployKeyPair,
} from '@/lib/deploy/remote-compose-executor'
// Type-only: the runtime import happens lazily in assembleStackCompose so the
// (client-flavoured) stack-persistence module isn't dragged into every request.
import type { PersistedStack } from '@/lib/stack-persistence'
import { dbStackServicesToPersisted } from '@/lib/deploy/persisted-stack'
import { isBillingEnabled } from '@/lib/plans'
import { effectivePlan, assertRemoteTargetLimit, assertDeployCapability } from '@/lib/billing/enforcement'
import {
  attestKillSwitch,
  servicesFromCompose,
  composeHasDownloadClient,
  verifyComposeKillSwitch,
  type DockerExec,
} from '@/lib/deploy/kill-switch-attestation'
import { parse as parseYaml } from 'yaml'
import { spawn } from 'child_process'
import { assertSafeBindMounts } from '@/lib/deploy/bind-mount-guard'
import crypto from 'crypto'

/** Runs `docker …` against the deploy host's socket; used for kill-switch attestation. */
const dockerExec: DockerExec = (a) =>
  new Promise((resolve) => {
    const c = spawn('docker', a, {
      env: { ...process.env, DOCKER_HOST: process.env.DOCKER_HOST ?? 'unix:///var/run/docker.sock' },
    })
    let stdout = ''
    c.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    c.stderr.on('data', () => {})
    c.on('close', (code) => resolve({ stdout, exitCode: code ?? 1 }))
    c.on('error', () => resolve({ stdout: '', exitCode: 127 }))
  })

// UUID regex (consistent with project-wide usage)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// SSH host/user allowlists — mirror remote-compose-executor's guards so a bad
// target is rejected at the API boundary (no shell metacharacters).
const SAFE_HOST = /^[A-Za-z0-9._-]+$/
const SAFE_USER = /^[A-Za-z0-9._-]+$/

// Zod schemas
export const TargetSchema = z
  .object({
    name: z.string().min(1).max(100),
    type: z.enum(['kubernetes', 'docker']),
    provider: z.string().min(1).max(100),
    config: z.record(z.string(), z.any()).optional(),
    // Direct-deploy location: "local" (this server, default) or "remote" (SSH).
    location: z.enum(['local', 'remote']).optional(),
    // Remote-only. NO password field — auth is SSH key-based (server-side key).
    host: z.string().min(1).max(255).regex(SAFE_HOST, 'Invalid host').optional(),
    sshUser: z.string().min(1).max(64).regex(SAFE_USER, 'Invalid SSH user').optional(),
    sshPort: z.number().int().min(1).max(65535).optional(),
    // Remote-only. The operator must explicitly acknowledge the SSH-key liability
    // (we hold a key that can run docker on their host) before a remote target
    // can be registered. Enforced in createTarget so the message is friendly.
    riskAcknowledged: z.boolean().optional(),
  })
  .refine((v) => v.location !== 'remote' || (!!v.host && !!v.sshUser), {
    message: 'Remote targets require host and sshUser',
    path: ['host'],
  })

export const UpdateTargetSchema = z.object({
  id: z.string().regex(UUID_REGEX),
  name: z.string().min(1).max(100).optional(),
  provider: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.any()).optional(),
  host: z.string().min(1).max(255).regex(SAFE_HOST, 'Invalid host').optional(),
  sshUser: z.string().min(1).max(64).regex(SAFE_USER, 'Invalid SSH user').optional(),
  sshPort: z.number().int().min(1).max(65535).optional(),
})

export const ListTargetsSchema = z.object({
  cursor: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(100).optional(),
}).default({})

export const GetByIdSchema = z.object({ id: z.string().regex(UUID_REGEX) })

export const OverrideUpsertSchema = z.object({
  targetId: z.string().regex(UUID_REGEX),
  serviceId: z.number().int().positive(),
  stackId: z.string().regex(UUID_REGEX).optional(),
  overrides: z.record(z.string(), z.any()),
})

export const ListOverridesSchema = z.object({ targetId: z.string().regex(UUID_REGEX) })

export const ArtifactCreateSchema = z.object({
  type: z.enum(['yaml', 'helm', 'kustomize']),
  checksum: z.string().min(1),
  location: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  stackId: z.string().regex(UUID_REGEX),
  targetId: z.string().regex(UUID_REGEX).optional(),
})

export const ListArtifactsSchema = z.object({ stackId: z.string().regex(UUID_REGEX) })

export const JobCreateSchema = z.object({
  mode: z.enum(['export', 'apply', 'provision', 'destroy']),
  stackId: z.string().regex(UUID_REGEX).optional(),
  targetId: z.string().regex(UUID_REGEX).optional(),
  artifactId: z.string().regex(UUID_REGEX).optional(),
})

// Internal helpers
function safeParseJSON<T = any>(val: string | null | undefined, fallback: T): T {
  try { return (val ? JSON.parse(val) : fallback) as T } catch { return fallback }
}

// ---------------------------------------------------------------------------
// Direct-deploy executor wiring — OPTIONAL "Deploy to this server" feature.
// Deploys a stack's generated compose to the local Docker host via the mounted
// socket. Bounded + safe: single host, no SSH/credentials, unique bms-* project,
// container_name stripped so we can never touch the build-my-stack* infra.
// ---------------------------------------------------------------------------

type PrismaLike = Context['prisma']

/**
 * Load a stack from the DB and render its deployable compose YAML (container_name
 * stripped for project isolation). Throws if the stack has no services.
 */
export async function assembleStackCompose(
  prisma: PrismaLike,
  stackId: string,
  opts?: { blockSensitiveBindMounts?: boolean },
): Promise<string> {
  const stack = await prisma.stacks.findUnique({
    where: { id: stackId },
    include: {
      stack_services: {
        include: { services: true, stack_service_configurations: true },
        orderBy: { order: 'asc' },
      },
    },
  })
  if (!stack) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stack not found' })
  if (stack.stack_services.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Stack has no services to deploy' })
  }

  const services = dbStackServicesToPersisted(stack.stack_services)

  // Deploying to THIS server runs against the host Docker socket; a user-set
  // bind mount of a sensitive host path would escape the container. Enforce
  // here (the save-time validator only warns and never runs on this path).
  if (opts?.blockSensitiveBindMounts) {
    try {
      assertSafeBindMounts(services as ReadonlyArray<{ configuration?: { volumeMounts?: Array<{ hostPath?: unknown }> } }>)
    } catch (err) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: (err as Error).message })
    }
  }

  const persisted = {
    id: stack.id,
    name: stack.name,
    description: stack.description ?? '',
    isPublic: stack.isPublic,
    services,
  } as unknown as PersistedStack

  const { generateComposeWithSecrets } = await import('@/lib/stack-persistence')
  const { yaml } = generateComposeWithSecrets(persisted)
  return stripContainerNames(yaml)
}

/**
 * Where does `docker compose` actually run? The app container has no Docker
 * socket in the deployed setup, so by default we delegate to the ws process over
 * the authenticated bridge (`DEPLOY_BRIDGE_URL`, or the `websocket` service in
 * prod). Only when no bridge is configured (local single-process `dev:ws`, where
 * one process owns both the DB and the socket) do we run the executor in-process.
 */
function shouldUseBridge(): boolean {
  return Boolean(process.env.DEPLOY_BRIDGE_URL) || process.env.NODE_ENV === 'production'
}

async function runComposeDispatch(opts: {
  project: string
  composeYaml: string
  action: ComposeAction
  onLog: (line: string) => void
  /** Present => deploy to a remote Docker host over SSH (key auth only). */
  remote?: BridgeRemoteTarget
}): Promise<{ exitCode: number }> {
  // Deployed app: hand the exec (local socket OR remote SSH) to the ws process,
  // which holds the Docker socket AND the DEPLOY_SSH_KEY.
  if (shouldUseBridge()) return runComposeViaBridge(opts)
  // Local single-process dev: run in-process. Remote uses the SSH executor with
  // the server-side key; local uses the mounted Docker socket.
  if (opts.remote) {
    return runRemoteCompose({
      project: opts.project,
      composeYaml: opts.composeYaml,
      action: opts.action,
      onLog: opts.onLog,
      host: opts.remote.host,
      sshUser: opts.remote.sshUser,
      sshPort: opts.remote.sshPort,
      keyFile: resolveDeployKeyFile(),
    })
  }
  return runCompose(opts)
}

/** Monotonic timestamps so getJobLogTail's `> since` filter never drops a line. */
function makeClock(): () => number {
  let last = 0
  return () => {
    const now = Date.now()
    last = now > last ? now : last + 1
    return last
  }
}

/**
 * Run a compose deploy/teardown in the background, streaming output into the
 * job's `logs` and flipping the final status. Buffered, serialized flushes keep
 * DB writes cheap and race-free while the UI polls getJobLogTail for live logs.
 */
async function runComposeJob(
  prisma: PrismaLike,
  jobId: string,
  args: { project: string; composeYaml: string; action: ComposeAction; remote?: BridgeRemoteTarget },
): Promise<void> {
  const buffer: string[] = []
  const clock = makeClock()
  let chain: Promise<void> = Promise.resolve()

  const flush = (): Promise<void> => {
    chain = chain.then(async () => {
      if (buffer.length === 0) return
      const lines = buffer.splice(0)
      const current = await prisma.deployment_jobs.findUnique({ where: { id: jobId } })
      if (!current) return
      const entries = safeParseJSON<Array<{ t: number; msg: string }>>(current.logs, [])
      for (const msg of lines) entries.push({ t: clock(), msg })
      await prisma.deployment_jobs.update({
        where: { id: jobId },
        data: { logs: JSON.stringify(entries), updatedAt: new Date() },
      })
    })
    return chain
  }

  const timer = setInterval(() => { void flush() }, 500)
  try {
    const { exitCode } = await runComposeDispatch({ ...args, onLog: (line) => { buffer.push(line) } })
    const ok = exitCode === 0
    buffer.push(
      ok
        ? (args.action === 'up' ? '✓ Deployment succeeded' : '✓ Deployment stopped')
        : `✗ docker compose exited with code ${exitCode}`,
    )

    // Verified deploy: after a successful local `up` of a stack with a download
    // client, boot-probe the running containers and attest the VPN kill-switch
    // actually holds — the thesis's runtime proof, not just a static check.
    // Best-effort: needs the deploy host's Docker socket (this-server target);
    // it degrades to a logged note when unavailable (e.g. remote/bridge deploys).
    // A confirmed runtime LEAK is a hard failure: tear the stack down so it can
    // never sit there running while leaking the real IP.
    let leaked = false
    if (ok && args.action === 'up' && !args.remote) {
      try {
        const parsed = parseYaml(args.composeYaml)
        if (composeHasDownloadClient(parsed)) {
          buffer.push('— Verifying the VPN kill-switch on the running stack…')
          await flush()
          const att = await attestKillSwitch({ project: args.project, services: servicesFromCompose(parsed), exec: dockerExec })
          buffer.push(`🛡 Kill-switch: ${att.status.toUpperCase()} — ${att.summary}`)
          for (const f of att.findings.filter((x) => x.verdict !== 'skip')) {
            buffer.push(`   • ${f.service}: ${f.detail}`)
          }
          if (att.status === 'leak') {
            leaked = true
            buffer.push('✗ Leak detected — tearing the stack down so it cannot run while leaking your IP.')
            await flush()
            try {
              await runComposeDispatch({ ...args, action: 'down', onLog: (line) => { buffer.push(line) } })
            } catch (e) {
              buffer.push(`(teardown error: ${(e as Error).message})`)
            }
          }
        }
      } catch (e) {
        buffer.push(`🛡 Kill-switch attestation skipped: ${(e as Error).message}`)
      }
    }

    clearInterval(timer)
    await flush()
    await prisma.deployment_jobs.update({
      where: { id: jobId },
      data: { status: leaked ? 'failed' : ok ? 'succeeded' : 'failed', updatedAt: new Date() },
    })
  } catch (err) {
    clearInterval(timer)
    buffer.push(`✗ ${(err as Error).message}`)
    await flush()
    await prisma.deployment_jobs
      .update({ where: { id: jobId }, data: { status: 'failed', updatedAt: new Date() } })
      .catch(() => undefined)
  }
}

/** Owner-only gate for side-effecting deploy actions. */
async function requireStackOwner(prisma: PrismaLike, stackId: string, userId: string): Promise<{ name: string }> {
  const stack = await prisma.stacks.findUnique({ where: { id: stackId }, select: { userId: true, name: true } })
  if (!stack) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stack not found' })
  if (stack.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
  return { name: stack.name }
}

/**
 * Fetch a deployment job and verify the caller owns its stack. Without this the
 * job getters/mutations were an IDOR — any authenticated user could read/flip
 * another user's deploy logs by guessing a job UUID.
 */
async function requireJobOwner(prisma: PrismaLike, jobId: string, userId: string): Promise<any> {
  const job = await (prisma as any).deployment_jobs.findUnique({ where: { id: jobId } })
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deployment job not found' })
  if (!job.stackId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
  await requireStackOwner(prisma, job.stackId, userId)
  return job
}

/**
 * Resolve an optional deploy targetId into the executor's remote descriptor.
 * Owner-gates the target. Returns:
 *   - `{ remote: undefined, label }` for "this server" (no targetId, or a local
 *     docker target) — the existing mounted-socket path, and
 *   - `{ remote: { host, sshUser, sshPort }, label }` for a remote SSH target.
 * Rejects non-docker targets (kubernetes uses the artifact/CI flow, not compose).
 */
async function resolveDeployTarget(
  prisma: PrismaLike,
  targetId: string | undefined,
  userId: string,
): Promise<{ remote?: BridgeRemoteTarget; targetId?: string; label: string }> {
  if (!targetId) return { label: 'this server' }
  const target = await prisma.deployment_targets.findFirst({ where: { id: targetId, userId } })
  if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deployment target not found' })
  if (target.type !== 'docker') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only docker targets support direct deploy' })
  }
  if (target.location !== 'remote') return { targetId, label: `${target.name} (this server)` }
  if (!target.host || !target.sshUser) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Remote target is missing host/sshUser' })
  }
  return {
    remote: { host: target.host, sshUser: target.sshUser, sshPort: target.sshPort ?? 22 },
    targetId,
    label: `${target.name} (${target.sshUser}@${target.host})`,
  }
}

export const deploymentsRouter = createTRPCRouter({
  // Targets
  createTarget: protectedProcedure
    .input(TargetSchema)
    .mutation(async ({ ctx, input }) => {
      const location = input.location ?? 'local'
      // Cloud profile: on the hosted instance, only admins may register a local
      // (Docker-socket-of-our-host) target — free/pro users must never schedule
      // containers on our infrastructure. Self-host (billing off) is unaffected.
      if (
        isBillingEnabled() &&
        location === 'local' &&
        (ctx.user as { role?: string } | undefined)?.role !== 'admin'
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Local (this-server) targets are not available on the hosted plan. Add a remote host instead.',
        })
      }
      // Plan gate: remote targets are the priced axis (free 0, pro 2, fleet 10).
      if (location === 'remote') {
        // Liability gate: registering a remote target hands BuildMyStack an SSH
        // key that can run docker on the operator's host. They must explicitly
        // acknowledge that before we store it — Export/handoff is the safe default.
        if (!input.riskAcknowledged) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'To add a remote SSH target you must acknowledge the deploy-key liability. Prefer Export / handoff if you would rather run the stack yourself.',
          })
        }
        const ep = await effectivePlan(ctx.prisma, ctx.userId!)
        const remoteCount = await ctx.prisma.deployment_targets.count({
          where: { userId: ctx.userId, location: 'remote' },
        })
        assertRemoteTargetLimit(ep, remoteCount)
      }
      const created = await ctx.prisma.deployment_targets.create({
        data: {
          id: crypto.randomUUID(),
          name: input.name,
          type: input.type,
          provider: input.provider,
          config: JSON.stringify(input.config || {}),
          location: input.location ?? 'local',
          host: input.location === 'remote' ? input.host : null,
          sshUser: input.location === 'remote' ? input.sshUser : null,
          sshPort: input.location === 'remote' ? input.sshPort ?? 22 : null,
          riskAcknowledgedAt: input.location === 'remote' ? new Date() : null,
          userId: ctx.userId,
          updatedAt: new Date(),
        },
      })
      return created
    }),

  // The deploy server's SSH PUBLIC key, so the UI can tell the operator what to
  // add to a remote host's authorized_keys. Public keys aren't secret; any
  // authenticated user may read it. `configured: false` when no deploy key is set.
  getDeployPublicKey: protectedProcedure.query(async () => {
    return resolveDeployPublicKey()
  }),

  // Generate the server's deploy keypair on demand (from the UI) so the operator
  // doesn't have to hand-mount a key. Writes to DEPLOY_SSH_KEY_FILE and returns
  // the public key to authorize on target hosts. `force` rotates an existing key.
  generateDeployKey: protectedProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      // The deploy key is a single server-wide secret. First-time generation is
      // idempotent and harmless, but `force` ROTATES it — invalidating the
      // public key every other user placed in their hosts' authorized_keys
      // (platform-wide deploy DoS). Restrict rotation to admins.
      if (input?.force && (ctx.user as { role?: string } | undefined)?.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Rotating the deploy key requires admin' })
      }
      try {
        return ensureDeployKeyPair({ force: input?.force })
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to generate deploy key',
        })
      }
    }),

  listTargets: protectedProcedure
    .input(ListTargetsSchema)
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50
      const targets = await ctx.prisma.deployment_targets.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return { targets }
    }),

  getTarget: protectedProcedure
    .input(GetByIdSchema)
    .query(async ({ ctx, input }) => {
      const found = await ctx.prisma.deployment_targets.findFirst({
        where: { id: input.id, userId: ctx.userId },
      })
      if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deployment target not found' })
      return found
    }),

  updateTarget: protectedProcedure
    .input(UpdateTargetSchema)
    .mutation(async ({ ctx, input }) => {
      // ensure ownership
      const existing = await ctx.prisma.deployment_targets.findFirst({ where: { id: input.id, userId: ctx.userId } })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deployment target not found' })

      const updated = await ctx.prisma.deployment_targets.update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          provider: input.provider ?? existing.provider,
          config: input.config ? JSON.stringify(input.config) : existing.config,
          host: input.host ?? existing.host,
          sshUser: input.sshUser ?? existing.sshUser,
          sshPort: input.sshPort ?? existing.sshPort,
          updatedAt: new Date(),
        },
      })
      return updated
    }),

  deleteTarget: protectedProcedure
    .input(GetByIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.deployment_targets.findFirst({ where: { id: input.id, userId: ctx.userId } })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deployment target not found' })

      await ctx.prisma.deployment_targets.delete({ where: { id: input.id } })
      return { success: true }
    }),

  // Overrides
  upsertOverride: protectedProcedure
    .input(OverrideUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      // ensure target belongs to user
      const target = await ctx.prisma.deployment_targets.findFirst({ where: { id: input.targetId, userId: ctx.userId } })
      if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })

      // Find existing override by unique key simulated via findFirst
      const existing = await ctx.prisma.deployment_target_overrides.findFirst({
        where: {
          targetId: input.targetId,
          serviceId: input.serviceId,
          stackId: input.stackId ? input.stackId : null,
        },
      })

      if (existing) {
        const updated = await ctx.prisma.deployment_target_overrides.update({
          where: { id: existing.id },
          data: { overrides: JSON.stringify(input.overrides || {}), updatedAt: new Date() },
        })
        return updated
      }

      const created = await ctx.prisma.deployment_target_overrides.create({
        data: {
          id: crypto.randomUUID(),
          targetId: input.targetId,
          serviceId: input.serviceId,
          stackId: input.stackId ?? null,
          overrides: JSON.stringify(input.overrides || {}),
          updatedAt: new Date(),
        },
      })
      return created
    }),

  listOverrides: protectedProcedure
    .input(ListOverridesSchema)
    .query(async ({ ctx, input }) => {
      const target = await ctx.prisma.deployment_targets.findFirst({ where: { id: input.targetId, userId: ctx.userId } })
      if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })

      const items = await ctx.prisma.deployment_target_overrides.findMany({
        where: { targetId: input.targetId },
        orderBy: { createdAt: 'desc' },
      })
      return { items }
    }),

  deleteOverride: protectedProcedure
    .input(z.object({ targetId: z.string().regex(UUID_REGEX), serviceId: z.number().int().positive(), stackId: z.string().regex(UUID_REGEX).optional() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.deployment_targets.findFirst({ where: { id: input.targetId, userId: ctx.userId } })
      if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })

      await ctx.prisma.deployment_target_overrides.deleteMany({
        where: {
          targetId: input.targetId,
          serviceId: input.serviceId,
          stackId: input.stackId ? input.stackId : null,
        },
      })
      return { success: true }
    }),

  // Artifacts
  createArtifact: protectedProcedure
    .input(ArtifactCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // The stack the artifact attaches to must belong to the caller (was an
      // IDOR: any user could attach artifacts to another user's stack).
      await requireStackOwner(ctx.prisma, input.stackId, ctx.userId!)
      if (input.targetId) {
        const target = await ctx.prisma.deployment_targets.findFirst({ where: { id: input.targetId, userId: ctx.userId } })
        if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      const created = await ctx.prisma.deployment_artifacts.create({
        data: {
          id: crypto.randomUUID(),
          type: input.type,
          checksum: input.checksum,
          location: input.location,
          metadata: JSON.stringify(input.metadata || {}),
          stackId: input.stackId,
          targetId: input.targetId,
        },
      })
      return created
    }),

  listArtifacts: protectedProcedure
    .input(ListArtifactsSchema)
    .query(async ({ ctx, input }) => {
      // Owner-gate the stack (was an IDOR: any user could list another user's
      // artifacts — type/checksum/location/metadata — by supplying a stackId).
      await requireStackOwner(ctx.prisma, input.stackId, ctx.userId!)
      const items = await ctx.prisma.deployment_artifacts.findMany({
        where: { stackId: input.stackId },
        orderBy: { createdAt: 'desc' },
      })
      return { items }
    }),

  getArtifact: protectedProcedure
    .input(GetByIdSchema)
    .query(async ({ ctx, input }) => {
      const found = await ctx.prisma.deployment_artifacts.findUnique({ where: { id: input.id } })
      if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deployment artifact not found' })
      // Owner-gate via the artifact's stack (was an IDOR by artifact UUID).
      // Fail closed on a stack-less artifact rather than returning it to anyone.
      if (!found.stackId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      await requireStackOwner(ctx.prisma, found.stackId, ctx.userId!)
      return found
    }),

  // CI rendering for apply
  renderApplyCi: protectedProcedure
    .input(z.object({ targetId: z.string().regex(UUID_REGEX), manifestPath: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const target = await ctx.prisma.deployment_targets.findFirst({ where: { id: input.targetId, userId: ctx.userId } })
      if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      const cfg = safeParseJSON<any>(target.config as any, {})
      const useAgent = cfg?.apply?.method === 'gitlab-agent' && typeof cfg?.apply?.kubeContext === 'string'
      const kubeContext = useAgent ? String(cfg.apply.kubeContext) : undefined
      const yaml = renderCiApplyTemplate({ manifestPath: input.manifestPath, useAgent, kubeContext })
      return { yaml, useAgent, kubeContext }
    }),

  // Jobs
  createJob: protectedProcedure
    .input(JobCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // A stack-bound job's stack must belong to the caller (was an IDOR: any
      // user could create jobs against another user's stack, polluting its
      // history). Stackless jobs have no cross-tenant target to attack.
      if (input.stackId) await requireStackOwner(ctx.prisma, input.stackId, ctx.userId!)
      if (input.targetId) {
        const target = await ctx.prisma.deployment_targets.findFirst({ where: { id: input.targetId, userId: ctx.userId } })
        if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      const created = await ctx.prisma.deployment_jobs.create({
        data: {
          id: crypto.randomUUID(),
          mode: input.mode,
          status: 'queued',
          logs: '[]',
          stackId: input.stackId,
          targetId: input.targetId,
          artifactId: input.artifactId,
          createdBy: ctx.userId,
          updatedAt: new Date(),
        },
      })
      return created
    }),

  getJob: protectedProcedure
    .input(GetByIdSchema)
    .query(async ({ ctx, input }) => {
      const found = await requireJobOwner(ctx.prisma, input.id, ctx.userId!)
      return found
    }),

  getJobLogs: protectedProcedure
    .input(GetByIdSchema)
    .query(async ({ ctx, input }) => {
      const found = await requireJobOwner(ctx.prisma, input.id, ctx.userId!)
      let entries: any[] = []
      try { entries = JSON.parse(found.logs || '[]') } catch { entries = [] }
      return { entries }
    }),

  // Job status polling (lightweight)
  getJobStatus: protectedProcedure
    .input(GetByIdSchema)
    .query(async ({ ctx, input }) => {
      const found = await requireJobOwner(ctx.prisma, input.id, ctx.userId!)
      return { id: found.id, mode: found.mode, status: found.status, updatedAt: found.updatedAt }
    }),

  // Log tailing for pseudo-streaming (client can poll with since)
  getJobLogTail: protectedProcedure
    .input(z.object({ id: z.string().regex(UUID_REGEX), since: z.number().int().nonnegative().optional() }))
    .query(async ({ ctx, input }) => {
      const found = await requireJobOwner(ctx.prisma, input.id, ctx.userId!)
      let entries: Array<{ t: number; msg: string }> = []
      try { entries = JSON.parse(found.logs || '[]') } catch { entries = [] }
      const since = input.since ?? 0
      const filtered = entries.filter(e => typeof e.t === 'number' && e.t > since)
      const lastTimestamp = filtered.length > 0 ? filtered[filtered.length - 1].t : since
      return { entries: filtered, lastTimestamp }
    }),

  // Apply orchestration (test-oriented minimal flow)
  startApply: protectedProcedure
    .input(GetByIdSchema)
    .mutation(async ({ ctx, input }) => {
      const job = await requireJobOwner(ctx.prisma, input.id, ctx.userId!)
      if (job.mode !== 'apply') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not an apply job' })
      const logs = (() => { try { return JSON.parse(job.logs || '[]') } catch { return [] } })()
      logs.push({ t: Date.now(), msg: 'Starting apply' })
      return await ctx.prisma.deployment_jobs.update({ where: { id: job.id }, data: { status: 'running', logs: JSON.stringify(logs), updatedAt: new Date() } })
    }),

  finishApply: protectedProcedure
    .input(z.object({ id: z.string().regex(UUID_REGEX), success: z.boolean().default(true), error: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const job = await requireJobOwner(ctx.prisma, input.id, ctx.userId!)
      if (job.mode !== 'apply') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not an apply job' })
      const logs = (() => { try { return JSON.parse(job.logs || '[]') } catch { return [] } })()
      if (input.success) {
        logs.push({ t: Date.now(), msg: 'Apply succeeded' })
        return await ctx.prisma.deployment_jobs.update({ where: { id: job.id }, data: { status: 'succeeded', logs: JSON.stringify(logs), updatedAt: new Date() } })
      } else {
        logs.push({ t: Date.now(), msg: `Apply failed: ${input.error || 'unknown error'}` })
        return await ctx.prisma.deployment_jobs.update({ where: { id: job.id }, data: { status: 'failed', logs: JSON.stringify(logs), updatedAt: new Date() } })
      }
    }),

  // --- Direct deploy to THIS server (local Docker host via mounted socket) ---
  // No SSH, no credentials, no remote targets. Owner-only, unique bms-* project.

  // Real deployment history for a stack (apply + stop jobs).
  listJobs: protectedProcedure
    .input(z.object({
      stackId: z.string().regex(UUID_REGEX),
      limit: z.number().int().min(1).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireStackOwner(ctx.prisma, input.stackId, ctx.userId)
      const jobs = await ctx.prisma.deployment_jobs.findMany({
        where: { stackId: input.stackId, mode: { in: ['apply', 'destroy'] } },
        orderBy: { createdAt: 'desc' },
        take: input.limit ?? 20,
      })
      return {
        jobs: jobs.map((j) => ({
          id: j.id,
          mode: j.mode,
          status: j.status,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
        })),
      }
    }),

  // Deploy the stack's compose to a Docker host (detached; the UI polls
  // getJobStatus/getJobLogTail for live logs). Default target is "this server"
  // (mounted socket); an optional remote `targetId` deploys over SSH (key auth).
  deployStack: protectedProcedure
    .input(z.object({
      stackId: z.string().regex(UUID_REGEX),
      targetId: z.string().regex(UUID_REGEX).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { name } = await requireStackOwner(ctx.prisma, input.stackId, ctx.userId)
      // Plan gate: direct deploy is a Pro capability (self-host ⇒ allowed).
      assertDeployCapability(await effectivePlan(ctx.prisma, ctx.userId!))
      const target = await resolveDeployTarget(ctx.prisma, input.targetId, ctx.userId)
      // Local socket = shared host: block sensitive host bind mounts. Remote
      // targets are the user's own host, so their bind mounts are their call.
      const composeYaml = await assembleStackCompose(ctx.prisma, input.stackId, {
        blockSensitiveBindMounts: !target.remote,
      })
      // Liability gate: never let BuildMyStack deploy a download client that
      // isn't confined to a VPN. Deterministic, pre-flight, covers local AND
      // remote (no Docker needed) — a leak-by-construction is refused before
      // anything starts, so a leaking torrent client is never brought up in
      // our name. The runtime attestation in runComposeJob is the second line.
      const structural = verifyComposeKillSwitch(parseYaml(composeYaml))
      if (structural.status === 'leak') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Deploy blocked — the VPN kill-switch would leak. ${structural.summary} Route the download client through your VPN (network_mode: service:gluetun) before deploying.`,
        })
      }
      const project = sanitizeProjectName(input.stackId)
      const now = new Date()
      const job = await ctx.prisma.deployment_jobs.create({
        data: {
          id: crypto.randomUUID(),
          mode: 'apply',
          status: 'running',
          logs: JSON.stringify([{ t: now.getTime(), msg: `Deploying "${name}" to ${target.label} (project ${project})` }]),
          stackId: input.stackId,
          targetId: target.targetId,
          createdBy: ctx.userId,
          updatedAt: now,
        },
      })
      // Fire-and-forget: DB is the source of truth, UI polls the job.
      void runComposeJob(ctx.prisma, job.id, { project, composeYaml, action: 'up', remote: target.remote })
      return job
    }),

  // Tear the stack's deployment down (docker compose -p bms-<id> down) on the
  // selected target — this server (socket) or a remote host over SSH.
  stopStack: protectedProcedure
    .input(z.object({
      stackId: z.string().regex(UUID_REGEX),
      targetId: z.string().regex(UUID_REGEX).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireStackOwner(ctx.prisma, input.stackId, ctx.userId)
      const target = await resolveDeployTarget(ctx.prisma, input.targetId, ctx.userId)
      const composeYaml = await assembleStackCompose(ctx.prisma, input.stackId)
      const project = sanitizeProjectName(input.stackId)
      const now = new Date()
      const job = await ctx.prisma.deployment_jobs.create({
        data: {
          id: crypto.randomUUID(),
          mode: 'destroy',
          status: 'running',
          logs: JSON.stringify([{ t: now.getTime(), msg: `Stopping deployment on ${target.label} (project ${project})` }]),
          stackId: input.stackId,
          targetId: target.targetId,
          createdBy: ctx.userId,
          updatedAt: now,
        },
      })
      void runComposeJob(ctx.prisma, job.id, { project, composeYaml, action: 'down', remote: target.remote })
      return job
    }),
})
