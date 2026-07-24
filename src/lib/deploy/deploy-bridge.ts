/**
 * Deploy bridge client — delegates `docker compose` execution to the WebSocket
 * process over an authenticated HTTP call.
 *
 * Why this exists: in the deployed app the Docker socket + docker CLI live in the
 * WebSocket container, NOT the app container where the tRPC `deployments` router
 * runs. The router still owns the DB / job tracking; it hands the actual compose
 * exec to the ws process via `POST ${DEPLOY_BRIDGE_URL}/deploy` (see the endpoint
 * in `server/ws-server.ts`). The response is an NDJSON stream of `{"log":"..."}`
 * lines followed by a final `{"exitCode":N}`, which we replay to `onLog` so the
 * caller writes the same live output into `deployment_jobs.logs` as before.
 *
 * Same shape as the in-process executor's `runCompose` (returns `{exitCode}`), so
 * the router can swap between them with a minimal diff.
 */

import type { ComposeAction, RunComposeResult } from './compose-executor'

/**
 * Remote SSH target for the bridge. When present the ws process runs the compose
 * on this host over SSH (key auth only) instead of its local Docker socket. NO
 * password: the ws process holds the private key (DEPLOY_SSH_KEY_FILE); only
 * host/user/port travel over the bridge.
 *
 * NOTE (key liability): this is the SERVER-SIDE managed path — the running
 * instance holds the SSH key. It is intended for **self-hosters driving their
 * own hosts** (their instance, their key). The hosted product's remote-deploy
 * story is instead **key-sovereign**: the export bundle's `deploy.sh`
 * (`handoff.ts` `buildDeployScript`) runs on the operator's own machine and
 * drives their server over their own SSH, so Stapelwerk never holds a
 * stranger's key. See LAUNCH-RUNBOOK Gate G.
 */
export interface BridgeRemoteTarget {
  host: string
  sshUser: string
  sshPort?: number
}

export interface RunComposeViaBridgeOptions {
  /** Compose project name — MUST be a safe `bms-*` name (validated ws-side too). */
  project: string
  /** The full docker-compose YAML document to deploy. */
  composeYaml: string
  /** `up` deploys (detached), `down` tears the project down. */
  action: ComposeAction
  /** Receives every log line streamed back from the ws process. */
  onLog: (line: string) => void
  /** Override the bridge base URL (defaults to env / prod service name). */
  baseUrl?: string
  /** Present => deploy to this remote host over SSH (ws holds the key). */
  remote?: BridgeRemoteTarget
}

/**
 * Resolve the bridge base URL: explicit `DEPLOY_BRIDGE_URL` wins, else the ws
 * service on the shared docker network in prod, else localhost for dev.
 */
export function defaultBridgeUrl(): string {
  if (process.env.DEPLOY_BRIDGE_URL) return process.env.DEPLOY_BRIDGE_URL
  return process.env.NODE_ENV === 'production'
    ? 'http://websocket:3001'
    : 'http://localhost:3001'
}

/**
 * POST the compose job to the ws `/deploy` endpoint and stream its NDJSON reply,
 * replaying each `{"log":...}` line to `onLog` and returning the reported
 * `{"exitCode":N}`. Throws on transport / auth failures (401/500/network) so the
 * caller marks the job failed.
 */
export async function runComposeViaBridge(
  opts: RunComposeViaBridgeOptions,
): Promise<RunComposeResult> {
  const base = (opts.baseUrl ?? defaultBridgeUrl()).replace(/\/+$/, '')
  const token = process.env.DEPLOY_BRIDGE_TOKEN
  if (!token) {
    throw new Error('DEPLOY_BRIDGE_TOKEN is not set; cannot reach the deploy bridge')
  }

  const res = await fetch(`${base}/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      project: opts.project,
      composeYaml: opts.composeYaml,
      action: opts.action,
      ...(opts.remote ? { remote: opts.remote } : {}),
    }),
  })

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Deploy bridge responded ${res.status}: ${detail || res.statusText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let exitCode = 1 // pessimistic default: no exitCode line == failure

  const handleLine = (line: string): void => {
    const trimmed = line.trim()
    if (!trimmed) return
    let parsed: { log?: unknown; exitCode?: unknown; error?: unknown }
    try {
      parsed = JSON.parse(trimmed) as typeof parsed
    } catch {
      // Non-JSON line — surface it verbatim rather than swallowing output.
      opts.onLog(trimmed)
      return
    }
    if (typeof parsed.log === 'string') opts.onLog(parsed.log)
    if (typeof parsed.error === 'string') opts.onLog(`error: ${parsed.error}`)
    if (typeof parsed.exitCode === 'number') exitCode = parsed.exitCode
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      handleLine(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 1)
    }
  }
  buffer += decoder.decode()
  if (buffer.length > 0) handleLine(buffer)

  return { exitCode }
}
