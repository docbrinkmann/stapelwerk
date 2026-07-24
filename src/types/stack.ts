import type { Service } from './service';

// Port mapping configuration
export interface PortMapping {
  containerPort: number;
  hostPort: number;
  protocol?: 'tcp' | 'udp';
}

// Volume mount configuration
export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readOnly?: boolean;
}

// Environment variables
export interface EnvironmentVariables {
  [key: string]: string;
}

// Service dependencies
export interface ServiceDependency {
  serviceId: number;
  condition?: 'service_started' | 'service_healthy' | 'service_completed_successfully';
}

// Complete service configuration
export interface StackServiceConfiguration {
  environmentVariables: EnvironmentVariables;
  portMappings: PortMapping[];
  volumeMounts: VolumeMount[];
  dependsOn: ServiceDependency[];
  // Optional docker `network_mode`, e.g. "service:gluetun" — routes this
  // service's traffic through another container (a VPN kill-switch). When set,
  // the compose generator publishes this service's ports on the target instead
  // and drops its own network membership. Undefined = the default app-network.
  networkMode?: string;
  /**
   * Optional per-stack image tag override (e.g. "18.4-alpine"). Honored by the
   * compose generator so what you export/deploy from the builder uses this tag
   * instead of the catalog default. Session/export-time only — not yet
   * persisted to the saved-stack library (that needs a DB column).
   */
  imageTag?: string;
}

// A service within a stack
export interface StackService {
  id: string; // Unique identifier for this stack service instance
  serviceId: number; // Reference to the original service
  order: number; // Order in the stack
  service: Service; // Full service information
  configuration: StackServiceConfiguration; // Custom configuration
}

// Complete stack definition
export interface Stack {
  id?: string;
  name: string;
  description?: string;
  slug?: string;
  userId?: string;
  isPublic: boolean;
  isTemplate?: boolean;
  status?: 'draft' | 'active' | 'inactive';
  services: StackService[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Stack creation input
export interface CreateStackInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  services?: {
    serviceId: number;
    order: number;
    configuration?: Partial<StackServiceConfiguration>;
  }[];
}

// Stack update input
export interface UpdateStackInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  services?: {
    id?: string;
    serviceId: number;
    order: number;
    configuration?: Partial<StackServiceConfiguration>;
  }[];
}

// Stack with service counts
export interface StackWithServiceCount extends Omit<Stack, 'services'> {
  serviceCount: number;
  services?: Pick<StackService, 'id' | 'serviceId' | 'order' | 'service'>[];
}

// Validation result
export interface StackValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Export utility types
export type StackStatus = 'draft' | 'active' | 'inactive';
export type ServiceCondition = 'service_started' | 'service_healthy' | 'service_completed_successfully';