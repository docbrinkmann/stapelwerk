/**
 * Compose deploy executor — OPTIONAL direct-deploy to the single Docker host
 * that BuildMyStack itself runs on, via the mounted `/var/run/docker.sock`.
 *
 * Scope guardrails (see the deployments router + Deployments UI):
 *   - Single local host only. NO SSH, NO credentials, NO remote targets.
 *   - Every stack deploys under a unique `bms-<stackId>` compose project, and
 *     any `container_name:` the compose generator emitted is stripped so compose
 *     owns naming — this keeps deployments isolated and guarantees we can NEVER
 *     collide with / tear down the `build-my-stack*` infra containers.
 *
 * This module is intentionally free of DB / tRPC / WebSocket coupling: it just
 * spawns `docker compose` and streams lines to an `onLog` callback. The caller
 * (deployments router) wires those lines into `deployment_jobs.logs`. That makes
 * the executor runnable in-process from the app OR standalone from a script
 * inside the WebSocket container (which mounts the socket + has the docker CLI).
 */

import { spawn } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

/** Where deploy compose files are staged before `docker compose` runs. */
const DEPLOY_ROOT = path.join(os.tmpdir(), 'bms-deploy')

/** Default docker endpoint — the socket mounted into the runtime container. */
const DEFAULT_DOCKER_HOST = 'unix:///var/run/docker.sock'

export type ComposeAction = 'up' | 'down'

export interface RunComposeOptions {
  /** Compose project name — MUST be a safe `bms-*` name (see sanitizeProjectName). */
  project: string
  /** The full docker-compose YAML document to deploy. */
  composeYaml: string
  /** `up` deploys (detached), `down` tears the project down. */
  action: ComposeAction
  /** Receives every stdout/stderr line as it is produced. */
  onLog: (line: string) => void
  /** Override the staging root (tests). */
  rootDir?: string
}

export interface RunComposeResult {
  exitCode: number
}

/**
 * Derive a safe, stable, collision-proof compose project name from a stack id.
 * Always prefixed `bms-` so a deployment can never share the `build-my-stack`
 * infra project namespace.
 */
export function sanitizeProjectName(stackId: string): string {
  const safe = String(stackId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `bms-${safe || 'stack'}`
}

/**
 * Remove any `container_name:` from every service. The compose generator sets
 * `container_name: <slug>`, which bypasses compose's project-scoped naming and
 * risks colliding across stacks / with infra. Stripping it lets compose name
 * containers `<project>-<service>-N`, keeping every deploy isolated.
 */
export function stripContainerNames(composeYaml: string): string {
  const doc = parseYaml(composeYaml) as unknown
  if (doc && typeof doc === 'object') {
    const services = (doc as { services?: unknown }).services
    if (services && typeof services === 'object') {
      for (const svc of Object.values(services as Record<string, unknown>)) {
        if (svc && typeof svc === 'object') {
          delete (svc as Record<string, unknown>).container_name
        }
      }
    }
  }
  return stringifyYaml(doc, { lineWidth: 0 })
}

/**
 * Stage the compose YAML and run `docker compose -p <project> {up -d|down}`,
 * streaming combined stdout/stderr to `onLog`. Resolves with the process exit
 * code (never rejects on a non-zero exit — the caller decides success/failure).
 */
export async function runCompose(opts: RunComposeOptions): Promise<RunComposeResult> {
  const { project, composeYaml, action, onLog } = opts

  if (!project.startsWith('bms-')) {
    throw new Error(`Refusing to run compose for non-bms project: ${project}`)
  }

  const dir = path.join(opts.rootDir ?? DEPLOY_ROOT, project)
  await mkdir(dir, { recursive: true })
  const composePath = path.join(dir, 'docker-compose.yml')
  await writeFile(composePath, composeYaml, 'utf-8')

  const args =
    action === 'up'
      ? ['compose', '-p', project, 'up', '-d', '--remove-orphans']
      : ['compose', '-p', project, 'down', '--remove-orphans']

  onLog(`$ docker ${args.join(' ')}`)

  return new Promise<RunComposeResult>((resolve) => {
    const child = spawn('docker', args, {
      cwd: dir,
      env: {
        ...process.env,
        DOCKER_HOST: process.env.DOCKER_HOST ?? DEFAULT_DOCKER_HOST,
      },
    })

    const emit = (chunk: Buffer): void => {
      for (const line of chunk.toString('utf-8').split(/\r?\n/)) {
        if (line.trim().length > 0) onLog(line)
      }
    }

    child.stdout.on('data', emit)
    child.stderr.on('data', emit)
    child.on('error', (err: Error) => {
      onLog(`error: ${err.message}`)
      // 127 == command not found (e.g. docker CLI/socket missing in this process)
      resolve({ exitCode: 127 })
    })
    child.on('close', (code: number | null) => resolve({ exitCode: code ?? 1 }))
  })
}
