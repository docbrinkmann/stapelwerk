/**
 * Terminal WebSocket handler
 * Handles WebSocket-based terminal sessions for container command execution
 */

import type { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type {
  TerminalPayload,
  TerminalCreatePayload,
  TerminalInputPayload,
  TerminalResizePayload,
  WSMessage,
} from '../types';

// Event emitter for terminal I/O
export const terminalEmitter = new EventEmitter();
terminalEmitter.setMaxListeners(500);

// Active terminal sessions
interface TerminalSession {
  sessionId: string;
  stackId: string;
  containerId?: string;
  userId: string;
  client: WebSocket;
  command: string;
  cols: number;
  rows: number;
  startedAt: Date;
  lastActivity: Date;
  status: 'active' | 'closed';
}

const activeSessions = new Map<string, TerminalSession>();
const clientSessions = new Map<WebSocket, Set<string>>();

// Session timeout (30 minutes of inactivity)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start session cleanup interval
 */
export function startSessionCleanup(): void {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions) {
      if (now - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
        console.log(`[WS:Terminal] Session ${sessionId} timed out due to inactivity`);
        closeSession(sessionId);
      }
    }
  }, 60000); // Check every minute
}

/**
 * Stop session cleanup interval
 */
export function stopSessionCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new terminal session
 */
export async function createSession(
  client: WebSocket,
  userId: string,
  payload: TerminalCreatePayload
): Promise<string> {
  const sessionId = generateSessionId();
  
  const session: TerminalSession = {
    sessionId,
    stackId: payload.stackId,
    containerId: payload.containerId,
    userId,
    client,
    command: payload.command ?? '/bin/sh',
    cols: payload.cols ?? 80,
    rows: payload.rows ?? 24,
    startedAt: new Date(),
    lastActivity: new Date(),
    status: 'active',
  };
  
  activeSessions.set(sessionId, session);
  
  // Track session for this client
  if (!clientSessions.has(client)) {
    clientSessions.set(client, new Set());
  }
  clientSessions.get(client)!.add(sessionId);
  
  // Send session created response
  sendTerminalMessage(client, {
    action: 'create',
    sessionId,
    stackId: payload.stackId,
    containerId: payload.containerId,
  });
  
  // Emit event for terminal creation (can be handled by Docker integration).
  // userId comes from the authenticated WS upgrade — the docker executor
  // gates exec on stack ownership with it.
  terminalEmitter.emit('create', {
    sessionId,
    stackId: payload.stackId,
    containerId: payload.containerId,
    serviceSlug: payload.serviceSlug,
    userId,
    command: session.command,
    cols: session.cols,
    rows: session.rows,
  });
  
  console.log(`[WS:Terminal] Created session ${sessionId} for stack ${payload.stackId}`);
  
  return sessionId;
}

/**
 * Handle terminal input from client
 */
export function handleInput(
  client: WebSocket,
  payload: TerminalInputPayload
): void {
  const session = activeSessions.get(payload.sessionId);
  
  if (!session) {
    sendError(client, 'SESSION_NOT_FOUND', `Session ${payload.sessionId} not found`);
    return;
  }
  
  if (session.client !== client) {
    sendError(client, 'UNAUTHORIZED', 'Not authorized for this session');
    return;
  }
  
  session.lastActivity = new Date();
  
  // Emit input event for processing
  terminalEmitter.emit('input', {
    sessionId: payload.sessionId,
    data: payload.data,
  });
}

/**
 * Send terminal output to client
 */
export function sendOutput(sessionId: string, data: string): void {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== 'active') return;
  
  session.lastActivity = new Date();
  
  sendTerminalMessage(session.client, {
    action: 'output',
    sessionId,
    data,
  });
}

/**
 * Handle terminal resize
 */
export function handleResize(
  client: WebSocket,
  payload: TerminalResizePayload
): void {
  const session = activeSessions.get(payload.sessionId);
  
  if (!session) {
    sendError(client, 'SESSION_NOT_FOUND', `Session ${payload.sessionId} not found`);
    return;
  }
  
  if (session.client !== client) {
    sendError(client, 'UNAUTHORIZED', 'Not authorized for this session');
    return;
  }
  
  session.cols = payload.cols;
  session.rows = payload.rows;
  session.lastActivity = new Date();
  
  // Emit resize event
  terminalEmitter.emit('resize', {
    sessionId: payload.sessionId,
    cols: payload.cols,
    rows: payload.rows,
  });
}

/**
 * Close a terminal session
 */
export function closeSession(sessionId: string, exitCode?: number): void {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  
  session.status = 'closed';
  
  // Notify client
  sendTerminalMessage(session.client, {
    action: 'close',
    sessionId,
    exitCode,
  });
  
  // Emit close event
  terminalEmitter.emit('close', { sessionId, exitCode });
  
  // Clean up
  activeSessions.delete(sessionId);
  const sessions = clientSessions.get(session.client);
  if (sessions) {
    sessions.delete(sessionId);
    if (sessions.size === 0) {
      clientSessions.delete(session.client);
    }
  }
  
  console.log(`[WS:Terminal] Closed session ${sessionId}`);
}

/**
 * Clean up all terminal sessions for a client
 */
export function cleanupClientTerminals(client: WebSocket): void {
  const sessions = clientSessions.get(client);
  if (!sessions) return;
  
  for (const sessionId of sessions) {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.status = 'closed';
      terminalEmitter.emit('close', { sessionId });
      activeSessions.delete(sessionId);
    }
  }
  
  clientSessions.delete(client);
  console.log(`[WS:Terminal] Cleaned up all sessions for client`);
}

/**
 * Get active session by ID
 */
export function getSession(sessionId: string): TerminalSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Get all active sessions for a stack
 */
export function getStackSessions(stackId: string): TerminalSession[] {
  return Array.from(activeSessions.values()).filter(
    (session) => session.stackId === stackId && session.status === 'active'
  );
}

/**
 * Get session count for monitoring
 */
export function getSessionStats(): { total: number; byStack: Record<string, number> } {
  const byStack: Record<string, number> = {};
  
  for (const session of activeSessions.values()) {
    if (session.status === 'active') {
      byStack[session.stackId] = (byStack[session.stackId] ?? 0) + 1;
    }
  }
  
  return {
    total: activeSessions.size,
    byStack,
  };
}

/**
 * Send terminal message to client
 */
function sendTerminalMessage(client: WebSocket, payload: TerminalPayload): void {
  const message: WSMessage<TerminalPayload> = {
    type: 'terminal',
    payload,
    timestamp: Date.now(),
  };
  
  try {
    client.send(JSON.stringify(message));
  } catch (error) {
    console.error(`[WS:Terminal] Error sending message:`, error);
  }
}

/**
 * Send error to client
 */
function sendError(client: WebSocket, code: string, message: string): void {
  const errorMessage: WSMessage<{ code: string; message: string }> = {
    type: 'error',
    payload: { code, message },
    timestamp: Date.now(),
  };
  
  try {
    client.send(JSON.stringify(errorMessage));
  } catch (error) {
    console.error(`[WS:Terminal] Error sending error:`, error);
  }
}
