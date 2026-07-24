/**
 * WebSocket message types and interfaces
 */

export type WSMessageType = 
  | 'subscribe'
  | 'unsubscribe'
  | 'logs'
  | 'terminal'
  | 'status'
  | 'ping'
  | 'pong'
  | 'error'
  | 'ack';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp?: number;
  requestId?: string;
}

// Subscription types
export type SubscriptionChannel = 'logs' | 'terminal' | 'status';

export interface SubscribePayload {
  channel: SubscriptionChannel;
  stackId?: string;
  deploymentId?: string;
  sessionId?: string;
}

export interface UnsubscribePayload {
  channel: SubscriptionChannel;
  stackId?: string;
  sessionId?: string;
}

// Log types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'stdout' | 'stderr' | 'system' | 'deployment';

export interface LogEntry {
  id: string;
  stackId: string;
  deploymentId?: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface LogsPayload {
  entries: LogEntry[];
  stackId: string;
  deploymentId?: string;
}

// Terminal types
export type TerminalAction = 'create' | 'input' | 'output' | 'resize' | 'close';

export interface TerminalPayload {
  action: TerminalAction;
  sessionId: string;
  stackId?: string;
  containerId?: string;
  data?: string;
  cols?: number;
  rows?: number;
  exitCode?: number;
}

export interface TerminalCreatePayload {
  stackId: string;
  containerId?: string;
  /** Slug of the stack service to exec into; the executor resolves the container. */
  serviceSlug?: string;
  command?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalInputPayload {
  sessionId: string;
  data: string;
}

export interface TerminalResizePayload {
  sessionId: string;
  cols: number;
  rows: number;
}

// Status types
export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown' | 'pending';
export type DeploymentStatus = 
  | 'pending'
  | 'queued'
  | 'building'
  | 'deploying'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'stopped';

export interface StatusPayload {
  stackId: string;
  health?: HealthStatus;
  deploymentStatus?: DeploymentStatus;
  deploymentId?: string;
  progress?: number;
  message?: string;
  services?: ServiceStatus[];
}

export interface ServiceStatus {
  serviceId: string;
  name: string;
  health: HealthStatus;
  status: string;
  replicas?: {
    ready: number;
    total: number;
  };
}

// Error payload
export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

// Ack payload
export interface AckPayload {
  requestId: string;
  success: boolean;
  message?: string;
}

// Client connection state
export interface ClientState {
  userId: string;
  authenticated: boolean;
  subscriptions: Set<string>;
  lastActivity: Date;
}
