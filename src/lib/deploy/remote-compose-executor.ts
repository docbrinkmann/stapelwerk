/**
 * Remote compose deploy executor — direct-deploy to a REMOTE Docker host over
 * SSH, using system `ssh` (child_process, same pattern as server/terminal-executor.ts).
 *
 * SECURITY (this is the whole point of the module):
 *   - Key-based auth ONLY. `BatchMode=yes` guarantees ssh NEVER prompts for a
 *     password — a missing/rejected key fails fast instead of hanging or falling
 *     back to a password. There is NO password path anywhere in this file.
 *   - The private key is a SERVER-SIDE secret provided to the ws/app process via
 *     `DEPLOY_SSH_KEY_FILE` (a mounted key path) or `DEPLOY_SSH_KEY` (raw PEM,
 *     staged to a 0600 temp file). The user only registers host/user/port and is
 *     instructed to add the matching PUBLIC key to the target's authorized_keys.
 *   - `StrictHostKeyChecking=accept-new` trusts a host on first contact but
 *     refuses a CHANGED host key (MITM protection); `IdentitiesOnly=yes` uses
 *     only the provided key; `ConnectTimeout` bounds every connection.
 *   - host/user are validated against a strict allowlist (no shell
 *     metacharacters) AND passed as a single `user@host` argv element (spawn
 *     without a shell), so they can never be interpreted by a shell. The only
 *     value interpolated into the remote command is the `bms-*` project name.
 *
 * Isolation parity with the local executor: only ever `bms-*` projects, staged
 * under `~/.bms/<project>` on the target, so a remote deploy can never collide
 * with / tear down unrelated (e.g. `build-my-stack*`) containers on that host.
 */

import { spawn, execFileSync } from 'child_process'
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync, mkdirSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import type { ComposeAction, RunComposeResult } from './compose-executor'

/**
 * Strict allowlist for the SSH host and user: letters, digits, dot, hyphen and
 * underscore only. Covers hostnames + IPv4 and rejects every shell metacharacter
 * (space, `;` `&` `|` `$` backtick `(` `)` `<` `>` quotes `@` `/` `:` …). We use
 * this even though host/user are passed as a single non-shell argv element — a
 * second, independent line of defence.
 */
const SAFE_HOST = /^[A-Za-z0-9._-]+$/
const SAFE_USER = /^[A-Za-z0-9._-]+$/
/**
 * Compose project must be a `bms-*` slug of lowercase alnum + hyphen ONLY. Unlike
 * the local executor (which passes the project to `docker compose` as a non-shell
 * argv element), the remote path interpolates it into a shell command run over
 * SSH, so we validate the FULL charset here to make remote injection impossible.
 */
const SAFE_PROJECT = /^bms-[a-z0-9-]+$/

export function assertSafeHost(host: string): void {
  if (!SAFE_HOST.test(host)) {
    throw new Error(`Invalid SSH host (disallowed characters): ${host}`)
  }
}

export function assertSafeUser(user: string): void {
  if (!SAFE_USER.test(user)) {
    throw new Error(`Invalid SSH user (disallowed characters): ${user}`)
  }
}

/** Validate the SSH port is an integer in the TCP range. */
export function assertSafePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SSH port: ${port}`)
  }
}

export interface RunRemoteComposeOptions {
  /** Compose project name — MUST be a safe `bms-*` name (see sanitizeProjectName). */
  project: string
  /** The full docker-compose YAML document to deploy. */
  composeYaml: string
  /** `up` deploys (detached), `down` tears the project down. */
  action: ComposeAction
  /** Remote host (hostname or IP). Validated: no shell metacharacters. */
  host: string
  /** Remote SSH login user. Validated: no shell metacharacters. Key auth only. */
  sshUser: string
  /** Remote SSH port (default 22). */
  sshPort?: number
  /** Path to the private key file used for key-based auth. */
  keyFile: string
  /** Receives every stdout/stderr line as it is produced. */
  onLog: (line: string) => void
}

/**
 * Resolve the server-side private key path for remote deploys:
 *   - `DEPLOY_SSH_KEY_FILE` (a mounted key path) wins, else
 *   - `DEPLOY_SSH_KEY` (raw PEM) is staged once to a 0600 temp file.
 * Throws when neither is configured — we NEVER fall back to a password.
 */
export function resolveDeployKeyFile(): string {
  // Load the key contents from the mounted/generated file, else the raw env var.
  const file = process.env.DEPLOY_SSH_KEY_FILE
  let raw: string | undefined
  if (file) {
    try {
      raw = readFileSync(file, 'utf-8')
    } catch {
      throw new Error(`Deploy SSH key not readable at DEPLOY_SSH_KEY_FILE=${file}`)
    }
  } else {
    raw = process.env.DEPLOY_SSH_KEY
  }
  if (raw && raw.trim()) {
    // Always stage the private key to a 0600 temp file owned by THIS process's
    // user. The app generates the key as uid 1001, but the ws runs ssh as root
    // and ssh rejects a private key file owned by another non-root user
    // ("bad ownership or modes"). A same-user copy sidesteps that. Re-staged per
    // call so a regenerated key is picked up without restarting the ws.
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bms-deploy-key-'))
    const keyPath = path.join(dir, 'id')
    writeFileSync(keyPath, raw.endsWith('\n') ? raw : `${raw}\n`, { mode: 0o600 })
    chmodSync(keyPath, 0o600) // belt-and-suspenders: enforce even if umask interfered
    return keyPath
  }
  throw new Error(
    'No deploy SSH key configured (set DEPLOY_SSH_KEY_FILE to a mounted key path or DEPLOY_SSH_KEY to the key contents)',
  )
}

/** The deploy server's SSH public key, and whether one is configured at all. */
export interface DeployPublicKey {
  /** True when a public key could be resolved (a private key or explicit pubkey exists). */
  configured: boolean;
  /** The `ssh-...` public key line to add to the target host's authorized_keys. */
  publicKey?: string;
}

/**
 * Resolve the PUBLIC half of the deploy key so the UI can tell the operator what
 * to authorize on their host. A public key is not a secret. Resolution order:
 *   1. `DEPLOY_SSH_PUBKEY` (explicit — set this if you don't mount the private key),
 *   2. a sibling `<privateKey>.pub` file,
 *   3. derive it from the private key via `ssh-keygen -y`.
 * Never throws — returns `{ configured: false }` when nothing is available.
 */
export function resolveDeployPublicKey(): DeployPublicKey {
  const explicit = process.env.DEPLOY_SSH_PUBKEY?.trim();
  if (explicit) return { configured: true, publicKey: explicit };

  // Prefer the `.pub` sibling that ssh-keygen writes next to the configured key
  // (read directly — resolveDeployKeyFile() now stages a private-only temp copy).
  const configuredFile = process.env.DEPLOY_SSH_KEY_FILE;
  if (configuredFile) {
    const pubFile = `${configuredFile}.pub`;
    if (existsSync(pubFile)) {
      const contents = readFileSync(pubFile, 'utf-8').trim();
      if (contents) return { configured: true, publicKey: contents };
    }
  }

  let keyFile: string;
  try {
    keyFile = resolveDeployKeyFile();
  } catch {
    return { configured: false };
  }

  try {
    // `-P ''` supplies the (empty) passphrase so ssh-keygen never prompts — deploy
    // keys are passphraseless by design. Bounded so a stuck call can't hang a request.
    const derived = execFileSync('ssh-keygen', ['-y', '-P', '', '-f', keyFile], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    if (derived) return { configured: true, publicKey: derived };
  } catch {
    // ssh-keygen missing, or the key is unreadable/passphrase-protected.
  }
  return { configured: false };
}

/**
 * Generate a passphraseless ed25519 deploy keypair at DEPLOY_SSH_KEY_FILE (with
 * its `.pub` sibling) so remote deploys work without the operator hand-mounting
 * a key. No-op when a key already exists unless `force` is set. Returns the
 * resolved public key. Requires ssh-keygen (installed in the image) and a
 * writable DEPLOY_SSH_KEY_FILE directory (the ws chowns the shared volume).
 */
export function ensureDeployKeyPair(opts?: { force?: boolean }): DeployPublicKey {
  const file = process.env.DEPLOY_SSH_KEY_FILE;
  if (!file) {
    throw new Error('DEPLOY_SSH_KEY_FILE is not set — cannot generate a deploy key.');
  }
  const alreadyExists = existsSync(file);
  if (alreadyExists && !opts?.force) {
    return resolveDeployPublicKey();
  }
  mkdirSync(path.dirname(file), { recursive: true });
  if (alreadyExists) {
    // force: remove old key + pub so ssh-keygen doesn't prompt to overwrite.
    try { rmSync(file); } catch { /* ignore */ }
    try { rmSync(`${file}.pub`); } catch { /* ignore */ }
  }
  execFileSync(
    'ssh-keygen',
    ['-t', 'ed25519', '-N', '', '-C', 'buildmystack-deploy', '-f', file],
    { timeout: 15000, stdio: 'ignore' },
  );
  chmodSync(file, 0o600);
  return resolveDeployPublicKey();
}

/**
 * Build the hardened `ssh` argv shared by the stage + run steps. host/user/port
 * are already validated by the caller; `user@host` is a single argv element so a
 * shell can never see it.
 */
export function buildSshArgs(opts: {
  host: string
  sshUser: string
  sshPort: number
  keyFile: string
  remoteCommand: string
}): string[] {
  return [
    '-o', 'BatchMode=yes', // never prompt for a password — key auth only
    '-o', 'StrictHostKeyChecking=accept-new', // trust-on-first-use, reject changed keys
    '-o', 'IdentitiesOnly=yes', // use ONLY the provided key, not the agent's
    '-o', 'ConnectTimeout=15',
    '-i', opts.keyFile,
    '-p', String(opts.sshPort),
    `${opts.sshUser}@${opts.host}`,
    opts.remoteCommand,
  ]
}

/** Spawn one `ssh` invocation, optionally piping `input` to stdin, streaming output. */
function sshRun(args: string[], onLog: (line: string) => void, input?: string): Promise<number> {
  return new Promise<number>((resolve) => {
    const child = spawn('ssh', args)

    const emit = (chunk: Buffer): void => {
      for (const line of chunk.toString('utf-8').split(/\r?\n/)) {
        if (line.trim().length > 0) onLog(line)
      }
    }
    child.stdout.on('data', emit)
    child.stderr.on('data', emit)
    child.on('error', (err: Error) => {
      onLog(`error: ${err.message}`)
      resolve(127) // 127 == command not found (ssh missing in this process)
    })
    child.on('close', (code: number | null) => resolve(code ?? 1))

    if (input !== undefined) {
      child.stdin.end(input)
    } else {
      child.stdin.end()
    }
  })
}

/**
 * Stage the compose YAML on the remote host and run
 * `docker compose -p <project> {up -d|down}` there over SSH, streaming combined
 * stdout/stderr to `onLog`. Resolves with the process exit code (never rejects
 * on a non-zero exit — the caller decides success/failure). Throws synchronously
 * only on a validation failure (bad project / host / user / port).
 */
export async function runRemoteCompose(opts: RunRemoteComposeOptions): Promise<RunComposeResult> {
  const { project, composeYaml, action, host, sshUser, onLog, keyFile } = opts
  const sshPort = opts.sshPort ?? 22

  if (!SAFE_PROJECT.test(project)) {
    throw new Error(`Refusing to run compose for non-bms / unsafe project: ${project}`)
  }
  assertSafeHost(host)
  assertSafeUser(sshUser)
  assertSafePort(sshPort)

  // Remote staging dir; `project` is a validated bms-* slug (safe for the shell),
  // still quoted via $HOME so a spaced HOME can't break it.
  const remoteDir = `"$HOME/.bms/${project}"`
  const composeArgs =
    action === 'up' ? 'up -d --remove-orphans' : 'down --remove-orphans'

  // Step 1 — write the compose file via stdin (idempotent; also refreshes it for `down`).
  const stageCmd = `mkdir -p ${remoteDir} && cat > ${remoteDir}/docker-compose.yml`
  onLog(`$ ssh ${sshUser}@${host} (staging ~/.bms/${project}/docker-compose.yml)`)
  const stageExit = await sshRun(
    buildSshArgs({ host, sshUser, sshPort, keyFile, remoteCommand: stageCmd }),
    onLog,
    composeYaml,
  )
  if (stageExit !== 0) return { exitCode: stageExit }

  // Step 2 — run docker compose in that dir, streaming output live.
  const runCmd = `cd ${remoteDir} && docker compose -p ${project} ${composeArgs}`
  onLog(`$ ssh ${sshUser}@${host} docker compose -p ${project} ${composeArgs}`)
  const runExit = await sshRun(
    buildSshArgs({ host, sshUser, sshPort, keyFile, remoteCommand: runCmd }),
    onLog,
  )
  return { exitCode: runExit }
}
