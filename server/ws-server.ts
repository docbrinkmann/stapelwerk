/**
 * WebSocket Server Script
 * 
 * This script runs a standalone WebSocket server for real-time features.
 * It can run alongside the Next.js app or be integrated with a custom server.
 * 
 * Usage:
 *   Development: npm run ws:dev
 *   Production:  npm run ws:start
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { parse } from 'url';
import { createWSServer, handleUpgrade, shutdownWSServer } from '../src/server/ws';
import { attachTerminalExecutor, authenticateUpgrade, executorMode } from './terminal-executor';
import { runCompose } from '../src/lib/deploy/compose-executor';
import { runRemoteCompose, resolveDeployKeyFile } from '../src/lib/deploy/remote-compose-executor';
import { bridgeTokenAuthorized } from '../src/lib/deploy/bridge-auth';

/**
 * Direct-deploy bridge: the app container has no Docker socket, so the tRPC
 * `deployments` router POSTs compose jobs here (this process mounts the socket +
 * has the docker CLI). Auth is a shared bearer token (`DEPLOY_BRIDGE_TOKEN`);
 * output streams back as NDJSON (`{"log":"..."}\n` … `{"exitCode":N}\n`).
 */
async function handleDeploy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = process.env.DEPLOY_BRIDGE_TOKEN;
  // Refuse to run unauthenticated: misconfiguration is a 500, not an open door.
  if (!token) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DEPLOY_BRIDGE_TOKEN is not configured' }));
    return;
  }
  // Constant-time bearer check — this token is the bridge's entire security
  // boundary (it can run docker compose against the host socket).
  if (!bridgeTokenAuthorized(req.headers.authorization, token)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  let raw = '';
  req.setEncoding('utf-8');
  for await (const chunk of req) raw += chunk;

  let body: {
    project?: unknown;
    composeYaml?: unknown;
    action?: unknown;
    remote?: { host?: unknown; sshUser?: unknown; sshPort?: unknown };
  };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const project = String(body.project ?? '');
  const composeYaml = String(body.composeYaml ?? '');
  const action = body.action;
  // Same infra guard as the executor: only ever touch bms-* projects.
  if (!project.startsWith('bms-')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Refusing non-bms project: ${project}` }));
    return;
  }
  if (action !== 'up' && action !== 'down') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Invalid action: ${String(action)}` }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
  const write = (obj: Record<string, unknown>): void => { res.write(JSON.stringify(obj) + '\n'); };
  try {
    // Remote target present => run compose on that host over SSH (key auth only;
    // this process holds the private key via DEPLOY_SSH_KEY_FILE/DEPLOY_SSH_KEY).
    const { exitCode } = body.remote
      ? await runRemoteCompose({
          project,
          composeYaml,
          action,
          host: String(body.remote.host ?? ''),
          sshUser: String(body.remote.sshUser ?? ''),
          sshPort: body.remote.sshPort != null ? Number(body.remote.sshPort) : undefined,
          keyFile: resolveDeployKeyFile(),
          onLog: (line) => write({ log: line }),
        })
      : await runCompose({
          project,
          composeYaml,
          action,
          onLog: (line) => write({ log: line }),
        });
    write({ exitCode });
  } catch (err) {
    write({ exitCode: 1, error: (err as Error).message });
  }
  res.end();
}

const WS_PORT = parseInt(process.env.WS_PORT ?? '3001', 10);
const WS_HOST = process.env.WS_HOST ?? '0.0.0.0';

// Create HTTP server for WebSocket upgrades
const server = createServer((req, res) => {
  const { pathname } = parse(req.url ?? '', true);
  
  // Health check endpoint
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'websocket' }));
    return;
  }
  
  // Info endpoint
  if (pathname === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'websocket',
      version: '1.0.0',
      protocols: ['logs', 'terminal', 'status'],
    }));
    return;
  }

  // Direct-deploy bridge: authenticated compose exec on behalf of the app.
  if (req.method === 'POST' && pathname === '/deploy') {
    void handleDeploy(req, res);
    return;
  }

  // Default response for non-WebSocket requests
  res.writeHead(426, { 'Content-Type': 'text/plain' });
  res.end('WebSocket upgrade required');
});

// Create WebSocket server
const wss = createWSServer();

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  void (async () => {
    const { pathname, query } = parse(request.url ?? '', true);

    // Only handle /ws path
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    // Real executors (docker/ssh) require a valid next-auth session JWT cookie;
    // echo mode stays unauthenticated (dev/test behavior).
    if (executorMode() !== 'echo') {
      const userId = await authenticateUpgrade(request.headers.cookie);
      if (!userId) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.send(JSON.stringify({
            type: 'error',
            payload: { code: 'UNAUTHORIZED', message: 'Valid next-auth session required' },
            timestamp: Date.now(),
          }));
          ws.close(4401, 'Unauthorized');
        });
        return;
      }
      handleUpgrade(wss, request, socket, head, userId);
      return;
    }

    // Extract user ID from query or headers
    const userId = (query.userId as string) ??
                   (request.headers['x-user-id'] as string) ??
                   extractUserFromAuth(request.headers.authorization);

    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    handleUpgrade(wss, request, socket, head, userId);
  })();
});

/**
 * Extract user ID from authorization header
 * In production, this would decode and validate a JWT
 */
function extractUserFromAuth(auth: string | undefined): string | undefined {
  if (!auth) return undefined;
  
  // For development, accept Bearer <userId> format
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    // In production, decode JWT here
    // For now, treat token as user ID for testing
    return token;
  }
  
  return undefined;
}

// Terminal executor: echo (default) | docker | ssh — see server/terminal-executor.ts
attachTerminalExecutor();
console.log(`[WS] Terminal executor: ${executorMode()}`);

// Start server
server.listen(WS_PORT, WS_HOST, () => {
  console.log(`[WS] WebSocket server listening on ws://${WS_HOST}:${WS_PORT}/ws`);
  console.log(`[WS] Health check: http://${WS_HOST}:${WS_PORT}/health`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('[WS] Shutting down...');
  shutdownWSServer(wss);
  server.close(() => {
    console.log('[WS] Server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[WS] Force exit');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[WS] Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('[WS] Unhandled rejection:', reason);
});
