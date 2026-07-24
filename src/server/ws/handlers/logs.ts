/**
 * Log streaming WebSocket handler
 * Handles real-time log streaming with backpressure support
 */

import type { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { LogEntry, LogLevel, LogsPayload, WSMessage } from '../types';

// Log buffer for managing backpressure
const LOG_BUFFER_SIZE = 100;
const FLUSH_INTERVAL_MS = 100;

// Event emitter for log distribution
export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(1000); // Allow many concurrent log subscriptions

// Track active log subscriptions per client
const clientSubscriptions = new Map<WebSocket, Set<string>>();

// Log buffer per subscription key
const logBuffers = new Map<string, LogEntry[]>();
const flushTimers = new Map<string, NodeJS.Timeout>();

/**
 * Generate subscription key for logs
 */
function getSubscriptionKey(stackId: string, deploymentId?: string): string {
  return deploymentId ? `logs:${stackId}:${deploymentId}` : `logs:${stackId}`;
}

/**
 * Subscribe client to log stream
 */
export function subscribeToLogs(
  client: WebSocket,
  stackId: string,
  deploymentId?: string
): void {
  const key = getSubscriptionKey(stackId, deploymentId);
  
  // Track client subscription
  if (!clientSubscriptions.has(client)) {
    clientSubscriptions.set(client, new Set());
  }
  clientSubscriptions.get(client)!.add(key);
  
  // Initialize buffer if needed
  if (!logBuffers.has(key)) {
    logBuffers.set(key, []);
  }
  
  // Set up listener for this subscription
  const listener = (entry: LogEntry) => {
    if (entry.stackId !== stackId) return;
    if (deploymentId && entry.deploymentId !== deploymentId) return;
    
    bufferAndSend(client, key, entry);
  };
  
  logEmitter.on('log', listener);
  
  // Store listener reference for cleanup
  (client as unknown as Record<string, unknown>)[`logListener:${key}`] = listener;
  
  console.log(`[WS:Logs] Client subscribed to ${key}`);
}

/**
 * Unsubscribe client from log stream
 */
export function unsubscribeFromLogs(
  client: WebSocket,
  stackId: string,
  deploymentId?: string
): void {
  const key = getSubscriptionKey(stackId, deploymentId);
  
  // Remove from client subscriptions
  const subs = clientSubscriptions.get(client);
  if (subs) {
    subs.delete(key);
    if (subs.size === 0) {
      clientSubscriptions.delete(client);
    }
  }
  
  // Remove listener
  const listener = (client as unknown as Record<string, unknown>)[`logListener:${key}`] as (entry: LogEntry) => void;
  if (listener) {
    logEmitter.off('log', listener);
    delete (client as unknown as Record<string, unknown>)[`logListener:${key}`];
  }
  
  console.log(`[WS:Logs] Client unsubscribed from ${key}`);
}

/**
 * Clean up all log subscriptions for a client
 */
export function cleanupClientLogs(client: WebSocket): void {
  const subs = clientSubscriptions.get(client);
  if (!subs) return;
  
  for (const key of subs) {
    const listener = (client as unknown as Record<string, unknown>)[`logListener:${key}`] as (entry: LogEntry) => void;
    if (listener) {
      logEmitter.off('log', listener);
    }
  }
  
  clientSubscriptions.delete(client);
  console.log(`[WS:Logs] Cleaned up all subscriptions for client`);
}

/**
 * Buffer log entry and send when buffer is full or timer fires
 */
function bufferAndSend(client: WebSocket, key: string, entry: LogEntry): void {
  const buffer = logBuffers.get(key)!;
  buffer.push(entry);
  
  // Immediate flush if buffer is full
  if (buffer.length >= LOG_BUFFER_SIZE) {
    flushBuffer(client, key);
    return;
  }
  
  // Set up delayed flush if not already scheduled
  if (!flushTimers.has(key)) {
    const timer = setTimeout(() => {
      flushBuffer(client, key);
    }, FLUSH_INTERVAL_MS);
    flushTimers.set(key, timer);
  }
}

/**
 * Flush buffered logs to client
 */
function flushBuffer(client: WebSocket, key: string): void {
  // Clear timer
  const timer = flushTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    flushTimers.delete(key);
  }
  
  const buffer = logBuffers.get(key);
  if (!buffer || buffer.length === 0) return;
  
  // Check backpressure
  if (client.bufferedAmount > 1024 * 1024) {
    console.warn(`[WS:Logs] High backpressure for ${key}, dropping ${buffer.length} logs`);
    buffer.length = 0;
    return;
  }
  
  // Parse key to get stackId and deploymentId
  const [, stackId, deploymentId] = key.split(':');
  
  const message: WSMessage<LogsPayload> = {
    type: 'logs',
    payload: {
      entries: [...buffer],
      stackId,
      deploymentId,
    },
    timestamp: Date.now(),
  };
  
  try {
    client.send(JSON.stringify(message));
    buffer.length = 0;
  } catch (error) {
    console.error(`[WS:Logs] Error sending logs:`, error);
  }
}

/**
 * Emit a log entry to all subscribed clients
 */
export function emitLog(entry: LogEntry): void {
  logEmitter.emit('log', entry);
}

/**
 * Create and emit a log entry
 */
export function createLogEntry(
  stackId: string,
  level: LogLevel,
  message: string,
  options?: {
    deploymentId?: string;
    source?: 'stdout' | 'stderr' | 'system' | 'deployment';
    metadata?: Record<string, unknown>;
  }
): LogEntry {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    stackId,
    level,
    source: options?.source ?? 'system',
    message,
    metadata: options?.metadata,
    timestamp: new Date(),
    deploymentId: options?.deploymentId,
  };
  
  emitLog(entry);
  return entry;
}

/**
 * Get buffered log count for monitoring
 */
export function getBufferStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [key, buffer] of logBuffers) {
    stats[key] = buffer.length;
  }
  return stats;
}
