/**
 * WebSocket Server
 * Main WebSocket server setup with authentication and message routing
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { 
  WSMessage, 
  SubscribePayload, 
  UnsubscribePayload, 
  TerminalCreatePayload,
  TerminalInputPayload,
  TerminalResizePayload,
  ClientState,
  ErrorPayload,
  AckPayload,
} from './types';

// Import handlers
import {
  subscribeToLogs,
  unsubscribeFromLogs,
  cleanupClientLogs,
  getBufferStats,
} from './handlers/logs';

import {
  createSession,
  handleInput,
  handleResize,
  closeSession,
  cleanupClientTerminals,
  startSessionCleanup,
  stopSessionCleanup,
  getSessionStats,
} from './handlers/terminal';

import {
  subscribeToStatus,
  unsubscribeFromStatus,
  cleanupClientStatus,
  getSubscriptionStats,
} from './handlers/status';

// Client state management
const clients = new Map<WebSocket, ClientState>();

// Heartbeat interval
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 35000;

let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Initialize WebSocket server
 */
export function createWSServer(options?: { port?: number }): WebSocketServer {
  const wss = new WebSocketServer({ 
    noServer: true,
    clientTracking: true,
  });

  wss.on('connection', handleConnection);
  wss.on('error', (error) => {
    console.error('[WS] Server error:', error);
  });

  // Start heartbeat and cleanup intervals
  startHeartbeat(wss);
  startSessionCleanup();

  console.log('[WS] WebSocket server initialized');
  
  return wss;
}

/**
 * Handle WebSocket upgrade request
 */
export function handleUpgrade(
  wss: WebSocketServer,
  request: IncomingMessage,
  socket: unknown,
  head: Buffer,
  userId?: string
): void {
  // Verify authentication
  if (!userId) {
    console.warn('[WS] Unauthorized connection attempt');
    (socket as unknown as { destroy: () => void }).destroy();
    return;
  }

  wss.handleUpgrade(request, socket as never, head, (ws) => {
    // Initialize client state
    const state: ClientState = {
      userId,
      authenticated: true,
      subscriptions: new Set(),
      lastActivity: new Date(),
    };
    clients.set(ws, state);
    
    wss.emit('connection', ws, request);
  });
}

/**
 * Handle new WebSocket connection
 */
function handleConnection(ws: WebSocket, _request: IncomingMessage): void {
  console.log('[WS] Client connected');

  ws.on('message', (data) => handleMessage(ws, data));
  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', (error) => {
    console.error('[WS] Client error:', error);
  });
  ws.on('pong', () => {
    const state = clients.get(ws);
    if (state) {
      state.lastActivity = new Date();
    }
  });

  // Send welcome message
  sendMessage(ws, {
    type: 'ack',
    payload: {
      requestId: 'connect',
      success: true,
      message: 'Connected to WebSocket server',
    },
    timestamp: Date.now(),
  });
}

/**
 * Handle incoming WebSocket message
 */
function handleMessage(ws: WebSocket, data: unknown): void {
  const state = clients.get(ws);
  if (!state) {
    sendError(ws, 'NOT_CONNECTED', 'Client state not found');
    return;
  }

  state.lastActivity = new Date();

  let message: WSMessage;
  try {
    const dataStr = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString() : String(data);
    message = JSON.parse(dataStr);
  } catch {
    sendError(ws, 'INVALID_JSON', 'Invalid JSON message');
    return;
  }

  // Route message to appropriate handler
  switch (message.type) {
    case 'ping':
      handlePing(ws, message);
      break;

    case 'subscribe':
      handleSubscribe(ws, state, message.payload as SubscribePayload, message.requestId);
      break;

    case 'unsubscribe':
      handleUnsubscribe(ws, state, message.payload as UnsubscribePayload, message.requestId);
      break;

    case 'terminal':
      handleTerminalMessage(ws, state, message.payload as unknown);
      break;

    default:
      sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
  }
}

/**
 * Handle ping message
 */
function handlePing(ws: WebSocket, message: WSMessage): void {
  sendMessage(ws, {
    type: 'pong',
    payload: {},
    timestamp: Date.now(),
    requestId: message.requestId,
  });
}

/**
 * Handle subscribe message
 */
function handleSubscribe(
  ws: WebSocket,
  state: ClientState,
  payload: SubscribePayload,
  requestId?: string
): void {
  const { channel, stackId, deploymentId, sessionId } = payload;

  if (!stackId && channel !== 'terminal') {
    sendError(ws, 'MISSING_STACK_ID', 'Stack ID required for subscription');
    return;
  }

  switch (channel) {
    case 'logs':
      subscribeToLogs(ws, stackId!, deploymentId);
      state.subscriptions.add(`logs:${stackId}`);
      break;

    case 'status':
      subscribeToStatus(ws, stackId!);
      state.subscriptions.add(`status:${stackId}`);
      break;

    case 'terminal':
      // Terminal subscriptions are handled via terminal messages
      break;

    default:
      sendError(ws, 'UNKNOWN_CHANNEL', `Unknown channel: ${channel}`);
      return;
  }

  sendAck(ws, requestId, true, `Subscribed to ${channel}`);
}

/**
 * Handle unsubscribe message
 */
function handleUnsubscribe(
  ws: WebSocket,
  state: ClientState,
  payload: UnsubscribePayload,
  requestId?: string
): void {
  const { channel, stackId, sessionId } = payload;

  switch (channel) {
    case 'logs':
      if (stackId) {
        unsubscribeFromLogs(ws, stackId);
        state.subscriptions.delete(`logs:${stackId}`);
      }
      break;

    case 'status':
      if (stackId) {
        unsubscribeFromStatus(ws, stackId);
        state.subscriptions.delete(`status:${stackId}`);
      }
      break;

    case 'terminal':
      if (sessionId) {
        closeSession(sessionId);
      }
      break;

    default:
      sendError(ws, 'UNKNOWN_CHANNEL', `Unknown channel: ${channel}`);
      return;
  }

  sendAck(ws, requestId, true, `Unsubscribed from ${channel}`);
}

/**
 * Handle terminal-specific messages
 */
function handleTerminalMessage(
  ws: WebSocket,
  state: ClientState,
  payload: unknown
): void {
  const termPayload = payload as { action: string } & Record<string, unknown>;
  
  switch (termPayload.action) {
    case 'create':
      createSession(ws, state.userId, termPayload as unknown as TerminalCreatePayload);
      break;

    case 'input':
      handleInput(ws, termPayload as unknown as TerminalInputPayload);
      break;

    case 'resize':
      handleResize(ws, termPayload as unknown as TerminalResizePayload);
      break;

    case 'close':
      if (termPayload.sessionId) {
        closeSession(termPayload.sessionId as string);
      }
      break;

    default:
      sendError(ws, 'UNKNOWN_ACTION', `Unknown terminal action: ${termPayload.action}`);
  }
}

/**
 * Handle client disconnect
 */
function handleDisconnect(ws: WebSocket): void {
  console.log('[WS] Client disconnected');

  // Clean up all subscriptions
  cleanupClientLogs(ws);
  cleanupClientTerminals(ws);
  cleanupClientStatus(ws);

  // Remove client state
  clients.delete(ws);
}

/**
 * Start heartbeat interval
 */
function startHeartbeat(wss: WebSocketServer): void {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(() => {
    const now = Date.now();

    for (const ws of wss.clients) {
      const state = clients.get(ws);
      
      // Check if client is responsive
      if (state && now - state.lastActivity.getTime() > HEARTBEAT_TIMEOUT_MS) {
        console.log('[WS] Client timed out, terminating');
        ws.terminate();
        continue;
      }

      // Send ping
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat interval
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Send message to client
 */
function sendMessage(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  try {
    ws.send(JSON.stringify(message));
  } catch (error) {
    console.error('[WS] Error sending message:', error);
  }
}

/**
 * Send error to client
 */
function sendError(ws: WebSocket, code: string, message: string): void {
  const errorMessage: WSMessage<ErrorPayload> = {
    type: 'error',
    payload: { code, message },
    timestamp: Date.now(),
  };
  sendMessage(ws, errorMessage);
}

/**
 * Send acknowledgment to client
 */
function sendAck(ws: WebSocket, requestId?: string, success: boolean = true, message?: string): void {
  if (!requestId) return;

  const ackMessage: WSMessage<AckPayload> = {
    type: 'ack',
    payload: { requestId, success, message },
    timestamp: Date.now(),
  };
  sendMessage(ws, ackMessage);
}

/**
 * Get server statistics
 */
export function getServerStats(): {
  clients: number;
  logs: Record<string, number>;
  terminal: { total: number; byStack: Record<string, number> };
  status: { total: number; byStack: Record<string, number>; cacheSize: number };
} {
  return {
    clients: clients.size,
    logs: getBufferStats(),
    terminal: getSessionStats(),
    status: getSubscriptionStats(),
  };
}

/**
 * Shutdown WebSocket server
 */
export function shutdownWSServer(wss: WebSocketServer): void {
  console.log('[WS] Shutting down WebSocket server');

  // Stop intervals
  stopHeartbeat();
  stopSessionCleanup();

  // Close all connections
  for (const ws of wss.clients) {
    ws.close(1001, 'Server shutting down');
  }

  wss.close();
}

// Re-export handlers for external use
export {
  subscribeToLogs,
  unsubscribeFromLogs,
  createLogEntry,
  emitLog,
} from './handlers/logs';

export {
  createSession as createTerminalSession,
  sendOutput as sendTerminalOutput,
  closeSession as closeTerminalSession,
  terminalEmitter,
} from './handlers/terminal';

export {
  updateHealthStatus,
  updateDeploymentStatus,
  updateServiceStatus,
  broadcastStatus,
} from './handlers/status';

// Re-export types
export * from './types';
