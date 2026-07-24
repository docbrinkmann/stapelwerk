/**
 * Terminal executor — answers the `terminal` channel (create/input/output/exit).
 *
 * Env:
 *   TERMINAL_EXECUTOR          echo (default) | docker | ssh
 *   TERMINAL_CONTAINER_PREFIX  docker: allowed container-name prefix, defense-in-depth
 *                              on top of the per-stack ownership check (default: bms-)
 *   TERMINAL_SSH_TARGET        ssh: target as user@host (BatchMode — key auth only)
 *   TERMINAL_MAX_SESSIONS      docker/ssh: concurrent real session cap (default: 5)
 *   NEXTAUTH_SECRET            docker/ssh: verifies the next-auth session JWT on WS upgrade
 */

import http from 'http';
import { spawn } from 'child_process';
import type { Socket } from 'net';
import { decode } from 'next-auth/jwt';
import { terminalEmitter, sendTerminalOutput, closeTerminalSession } from '../src/server/ws';
import { stackContainerName, containerBelongsToStack } from '../src/lib/deploy/terminal-containers';

export type ExecutorMode = 'echo' | 'docker' | 'ssh';

export function executorMode(): ExecutorMode {
  const mode = process.env.TERMINAL_EXECUTOR;
  return mode === 'docker' || mode === 'ssh' ? mode : 'echo';
}

/**
 * Verify the next-auth session JWT from a WS upgrade request's Cookie header.
 * Returns the user id (token.sub / email) or undefined when missing/invalid.
 */
/**
 * Extract the next-auth session token from a Cookie header, reassembling the
 * chunked form next-auth uses for large sessions
 * (`next-auth.session-token.0`, `.1`, … in order). Handles the `__Secure-`
 * prefix (HTTPS) too.
 */
export function extractSessionToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const base = /^(?:__Secure-)?next-auth\.session-token$/;
  const chunk = /^(?:__Secure-)?next-auth\.session-token\.(\d+)$/;
  const chunks: Array<{ i: number; v: string }> = [];
  let whole: string | undefined;
  for (const p of cookieHeader.split(';')) {
    const trimmed = p.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (base.test(name)) whole = value;
    const m = chunk.exec(name);
    if (m) chunks.push({ i: Number(m[1]), v: value });
  }
  if (whole) return whole;
  if (chunks.length) return chunks.sort((a, b) => a.i - b.i).map((c) => c.v).join('');
  return undefined;
}

export async function authenticateUpgrade(cookieHeader: string | undefined): Promise<string | undefined> {
  const raw = extractSessionToken(cookieHeader);
  if (!raw) return undefined;
  // Fail closed: without a configured secret every token must be rejected —
  // verifying against '' would accept attacker-forged empty-secret JWTs.
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return undefined;
  try {
    const token = await decode({ token: decodeURIComponent(raw), secret });
    return (token?.sub ?? token?.email ?? undefined) as string | undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Real sessions (docker/ssh)
// ---------------------------------------------------------------------------

interface RealSession {
  write(data: string): void;
  resize?(cols: number, rows: number): void;
  destroy(): void;
}

const realSessions = new Map<string, RealSession>();

function fail(sessionId: string, message: string): void {
  sendTerminalOutput(sessionId, `\x1b[31m${message}\x1b[0m\r\n`);
  closeTerminalSession(sessionId, 1);
}

const DOCKER_SOCKET = '/var/run/docker.sock';

/** Docker Engine API call over the unix socket; resolves with parsed JSON. */
function dockerJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        socketPath: DOCKER_SOCKET,
        method,
        path,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk; });
        res.on('end', () => {
          if ((res.statusCode ?? 500) >= 300) {
            reject(new Error(`docker ${method} ${path} -> ${res.statusCode}: ${data.trim()}`));
          } else {
            resolve((data ? JSON.parse(data) : {}) as T);
          }
        });
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

function createDockerSession(sessionId: string, container: string, cols: number, rows: number): void {
  const buffered: string[] = [];
  let sock: Socket | null = null;
  let execId = '';

  realSessions.set(sessionId, {
    write: (data) => { if (sock) { sock.write(data); } else { buffered.push(data); } },
    resize: (c, r) => {
      if (execId) void dockerJson('POST', `/exec/${execId}/resize?h=${r}&w=${c}`).catch(() => undefined);
    },
    destroy: () => { sock?.destroy(); sock = null; },
  });

  void (async () => {
    const { Id } = await dockerJson<{ Id: string }>(
      'POST',
      `/containers/${encodeURIComponent(container)}/exec`,
      { AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: true, Cmd: ['/bin/sh'] }
    );

    // Hijacked duplex stream: with Tty:true the stream is raw (no multiplex framing)
    const payload = JSON.stringify({ Detach: false, Tty: true });
    const req = http.request({
      socketPath: DOCKER_SOCKET,
      method: 'POST',
      path: `/exec/${Id}/start`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Connection': 'Upgrade',
        'Upgrade': 'tcp',
      },
    });

    req.on('upgrade', (_res, socket: Socket) => {
      if (!realSessions.has(sessionId)) { socket.destroy(); return; } // closed while connecting
      execId = Id;
      sock = socket;
      socket.on('data', (chunk: Buffer) => sendTerminalOutput(sessionId, chunk.toString('utf8')));
      socket.on('close', () => closeTerminalSession(sessionId, 0));
      socket.on('error', () => closeTerminalSession(sessionId, 1));
      void dockerJson('POST', `/exec/${Id}/resize?h=${rows}&w=${cols}`).catch(() => undefined);
      for (const data of buffered.splice(0)) socket.write(data);
    });
    req.on('error', (err: Error) => fail(sessionId, `docker exec failed: ${err.message}`));
    req.end(payload);
  })().catch((err: Error) => fail(sessionId, `docker exec failed: ${err.message}`));
}

function createSshSession(sessionId: string): void {
  const target = process.env.TERMINAL_SSH_TARGET;
  if (!target) {
    fail(sessionId, 'TERMINAL_SSH_TARGET is not configured');
    return;
  }

  // -tt forces a remote PTY even without a local tty; BatchMode = key auth only
  const child = spawn('ssh', ['-tt', '-o', 'BatchMode=yes', target]);
  child.stdout.on('data', (chunk: Buffer) => sendTerminalOutput(sessionId, chunk.toString('utf8')));
  child.stderr.on('data', (chunk: Buffer) => sendTerminalOutput(sessionId, chunk.toString('utf8')));
  child.on('exit', (code) => closeTerminalSession(sessionId, code ?? 0));
  child.on('error', (err: Error) => fail(sessionId, `ssh failed: ${err.message}`));

  realSessions.set(sessionId, {
    write: (data) => { child.stdin.write(data); },
    // ponytail: no resize — ssh child has no local pty to propagate winch; use stty over the channel if it matters
    destroy: () => { child.kill(); },
  });
}

// ---------------------------------------------------------------------------
// Executor wiring
// ---------------------------------------------------------------------------

interface CreateEvent {
  sessionId: string;
  stackId: string;
  containerId?: string;
  /** Slug of the stack service to exec into (resolved to a container name). */
  serviceSlug?: string;
  /** Authenticated user from the WS upgrade — required for docker exec. */
  userId?: string;
  cols?: number;
  rows?: number;
}

// Lazy Prisma client — only the docker mode needs the DB (ownership check),
// and echo mode must keep working in environments without one.
let prismaClient: import('@prisma/client').PrismaClient | undefined;
async function getPrisma(): Promise<import('@prisma/client').PrismaClient> {
  if (!prismaClient) {
    const { PrismaClient } = await import('@prisma/client');
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

/**
 * Authorize and open a docker exec session for a stack terminal.
 * Security model (all three must hold):
 *  1. the WS upgrade was authenticated (userId present),
 *  2. the stack belongs to that user (DB check),
 *  3. the container is part of the stack's own compose project
 *     (`bms-<stackId>-…`, never the app's own infra containers).
 * Without an explicit containerId the stack's first service is used.
 */
async function authorizeDockerCreate(ev: CreateEvent): Promise<void> {
  const { sessionId, stackId, userId, cols, rows } = ev;
  if (!userId) {
    fail(sessionId, 'Terminal requires an authenticated session');
    return;
  }
  if (!stackId) {
    fail(sessionId, 'Terminal requires a stack context');
    return;
  }

  const prisma = await getPrisma();
  const stack = await prisma.stacks.findUnique({ where: { id: stackId } });
  if (!stack || stack.userId !== userId) {
    fail(sessionId, 'Not your stack');
    return;
  }

  // Resolve the container: explicit containerId wins, else the named service's
  // container, else the stack's first service.
  let container = ev.containerId;
  if (!container && ev.serviceSlug) {
    container = stackContainerName(stackId, ev.serviceSlug);
  }
  if (!container) {
    const rows = await prisma.stack_services.findMany({
      where: { stackId },
      orderBy: { order: 'asc' },
      take: 1,
    });
    const service = rows[0]
      ? await prisma.services.findUnique({ where: { id: rows[0].serviceId } })
      : null;
    if (service?.slug) container = stackContainerName(stackId, service.slug);
  }
  if (!container || !containerBelongsToStack(container, stackId)) {
    fail(sessionId, `Container not allowed: ${container ?? '(none)'}`);
    return;
  }
  const prefix = process.env.TERMINAL_CONTAINER_PREFIX ?? 'bms-';
  if (!container.startsWith(prefix)) {
    fail(sessionId, `Container not allowed: ${container}`);
    return;
  }

  createDockerSession(sessionId, container, cols ?? 80, rows ?? 24);
}

export function attachTerminalExecutor(): void {
  const mode = executorMode();

  if (mode === 'echo') {
    attachEchoExecutor();
    return;
  }

  const maxSessions = parseInt(process.env.TERMINAL_MAX_SESSIONS ?? '5', 10);

  terminalEmitter.on('create', (ev: CreateEvent) => {
    if (realSessions.size >= maxSessions) {
      fail(ev.sessionId, `Session limit reached (${maxSessions})`);
      return;
    }
    if (mode === 'docker') {
      void authorizeDockerCreate(ev).catch((err) => {
        fail(ev.sessionId, `Terminal error: ${err instanceof Error ? err.message : String(err)}`);
      });
    } else {
      createSshSession(ev.sessionId);
    }
  });

  terminalEmitter.on('input', ({ sessionId, data }: { sessionId: string; data: string }) => {
    realSessions.get(sessionId)?.write(data);
  });

  terminalEmitter.on('resize', ({ sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    realSessions.get(sessionId)?.resize?.(cols, rows);
  });

  terminalEmitter.on('close', ({ sessionId }: { sessionId: string }) => {
    const session = realSessions.get(sessionId);
    if (session) {
      realSessions.delete(sessionId);
      session.destroy();
    }
  });
}

// ---------------------------------------------------------------------------
// Echo executor (default) — no auth, no deployment target required
// ---------------------------------------------------------------------------

function attachEchoExecutor(): void {
  const lineBuffers = new Map<string, string>();

  terminalEmitter.on('create', ({ sessionId, stackId }: CreateEvent) => {
    lineBuffers.set(sessionId, '');
    sendTerminalOutput(
      sessionId,
      `\x1b[32m✓ Connected to stack ${stackId}\x1b[0m\r\n` +
      `\x1b[90mecho mode — set TERMINAL_EXECUTOR=docker|ssh for real exec\x1b[0m\r\n$ `
    );
  });

  terminalEmitter.on('input', ({ sessionId, data }: { sessionId: string; data: string }) => {
    const buf = lineBuffers.get(sessionId) ?? '';
    if (data === '\r') {
      const cmd = buf.trim();
      lineBuffers.set(sessionId, '');
      if (cmd) {
        sendTerminalOutput(sessionId, `\r\n\x1b[90mecho:\x1b[0m ${cmd}\r\n$ `);
      } else {
        sendTerminalOutput(sessionId, '\r\n$ ');
      }
    } else if (data === '\x7f') {
      if (buf.length > 0) {
        lineBuffers.set(sessionId, buf.slice(0, -1));
        sendTerminalOutput(sessionId, '\b \b');
      }
    } else {
      lineBuffers.set(sessionId, buf + data);
      sendTerminalOutput(sessionId, data);
    }
  });
}
