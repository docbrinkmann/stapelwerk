/**
 * Status WebSocket handler
 * Handles real-time status updates for deployments and health monitoring
 */

import type { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type {
  StatusPayload,
  HealthStatus,
  DeploymentStatus,
  ServiceStatus,
  WSMessage,
} from '../types';

// Event emitter for status updates
export const statusEmitter = new EventEmitter();
statusEmitter.setMaxListeners(1000);

// Track active status subscriptions per client
const clientSubscriptions = new Map<WebSocket, Set<string>>();

// Cache of last known status per stack
const statusCache = new Map<string, StatusPayload>();

// Debounce timers for status updates
const updateTimers = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 250;

/**
 * Subscribe client to status updates for a stack
 */
export function subscribeToStatus(client: WebSocket, stackId: string): void {
  const key = `status:${stackId}`;
  
  // Track client subscription
  if (!clientSubscriptions.has(client)) {
    clientSubscriptions.set(client, new Set());
  }
  clientSubscriptions.get(client)!.add(key);
  
  // Set up listener for this subscription
  const listener = (payload: StatusPayload) => {
    if (payload.stackId !== stackId) return;
    sendStatus(client, payload);
  };
  
  statusEmitter.on('status', listener);
  
  // Store listener reference for cleanup
  (client as unknown as Record<string, unknown>)[`statusListener:${key}`] = listener;
  
  // Send cached status if available
  const cached = statusCache.get(stackId);
  if (cached) {
    sendStatus(client, cached);
  }
  
  console.log(`[WS:Status] Client subscribed to ${key}`);
}

/**
 * Unsubscribe client from status updates
 */
export function unsubscribeFromStatus(client: WebSocket, stackId: string): void {
  const key = `status:${stackId}`;
  
  // Remove from client subscriptions
  const subs = clientSubscriptions.get(client);
  if (subs) {
    subs.delete(key);
    if (subs.size === 0) {
      clientSubscriptions.delete(client);
    }
  }
  
  // Remove listener
  const listener = (client as unknown as Record<string, unknown>)[`statusListener:${key}`] as (payload: StatusPayload) => void;
  if (listener) {
    statusEmitter.off('status', listener);
    delete (client as unknown as Record<string, unknown>)[`statusListener:${key}`];
  }
  
  console.log(`[WS:Status] Client unsubscribed from ${key}`);
}

/**
 * Clean up all status subscriptions for a client
 */
export function cleanupClientStatus(client: WebSocket): void {
  const subs = clientSubscriptions.get(client);
  if (!subs) return;
  
  for (const key of subs) {
    const listener = (client as unknown as Record<string, unknown>)[`statusListener:${key}`] as (payload: StatusPayload) => void;
    if (listener) {
      statusEmitter.off('status', listener);
    }
  }
  
  clientSubscriptions.delete(client);
  console.log(`[WS:Status] Cleaned up all subscriptions for client`);
}

/**
 * Emit a status update (debounced)
 */
export function emitStatus(payload: StatusPayload): void {
  // Clear any existing timer
  const existingTimer = updateTimers.get(payload.stackId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Update cache immediately
  statusCache.set(payload.stackId, payload);
  
  // Debounce the actual emission
  const timer = setTimeout(() => {
    statusEmitter.emit('status', payload);
    updateTimers.delete(payload.stackId);
  }, DEBOUNCE_MS);
  
  updateTimers.set(payload.stackId, timer);
}

/**
 * Update stack health status
 */
export function updateHealthStatus(
  stackId: string,
  health: HealthStatus,
  services?: ServiceStatus[]
): void {
  const cached = statusCache.get(stackId) ?? { stackId };
  
  emitStatus({
    ...cached,
    stackId,
    health,
    services: services ?? cached.services,
  });
}

/**
 * Update deployment status
 */
export function updateDeploymentStatus(
  stackId: string,
  deploymentId: string,
  status: DeploymentStatus,
  progress?: number,
  message?: string
): void {
  const cached = statusCache.get(stackId) ?? { stackId };
  
  emitStatus({
    ...cached,
    stackId,
    deploymentId,
    deploymentStatus: status,
    progress,
    message,
  });
}

/**
 * Update service status within a stack
 */
export function updateServiceStatus(
  stackId: string,
  serviceStatus: ServiceStatus
): void {
  const cached = statusCache.get(stackId) ?? { stackId };
  const services = cached.services ?? [];
  
  // Update or add service status
  const index = services.findIndex((s) => s.serviceId === serviceStatus.serviceId);
  if (index >= 0) {
    services[index] = serviceStatus;
  } else {
    services.push(serviceStatus);
  }
  
  // Calculate overall health from services
  const health = calculateOverallHealth(services);
  
  emitStatus({
    ...cached,
    stackId,
    health,
    services,
  });
}

/**
 * Calculate overall health from service statuses
 */
function calculateOverallHealth(services: ServiceStatus[]): HealthStatus {
  if (services.length === 0) return 'unknown';
  
  const unhealthy = services.filter((s) => s.health === 'unhealthy').length;
  const pending = services.filter((s) => s.health === 'pending').length;
  const degraded = services.filter((s) => s.health === 'degraded').length;
  const healthy = services.filter((s) => s.health === 'healthy').length;
  
  if (unhealthy > 0) return 'unhealthy';
  if (pending > 0) return 'pending';
  if (degraded > 0) return 'degraded';
  if (healthy === services.length) return 'healthy';
  
  return 'unknown';
}

/**
 * Get cached status for a stack
 */
export function getCachedStatus(stackId: string): StatusPayload | undefined {
  return statusCache.get(stackId);
}

/**
 * Get subscription count for monitoring
 */
export function getSubscriptionStats(): { 
  total: number; 
  byStack: Record<string, number>;
  cacheSize: number;
} {
  const byStack: Record<string, number> = {};
  
  for (const subs of clientSubscriptions.values()) {
    for (const key of subs) {
      const stackId = key.replace('status:', '');
      byStack[stackId] = (byStack[stackId] ?? 0) + 1;
    }
  }
  
  return {
    total: Array.from(clientSubscriptions.values()).reduce((sum, set) => sum + set.size, 0),
    byStack,
    cacheSize: statusCache.size,
  };
}

/**
 * Send status message to client
 */
function sendStatus(client: WebSocket, payload: StatusPayload): void {
  const message: WSMessage<StatusPayload> = {
    type: 'status',
    payload,
    timestamp: Date.now(),
  };
  
  try {
    client.send(JSON.stringify(message));
  } catch (error) {
    console.error(`[WS:Status] Error sending status:`, error);
  }
}

/**
 * Broadcast status to all subscribed clients
 */
export function broadcastStatus(stackId: string, payload: StatusPayload): void {
  for (const [client, subs] of clientSubscriptions) {
    if (subs.has(`status:${stackId}`)) {
      sendStatus(client, payload);
    }
  }
}
