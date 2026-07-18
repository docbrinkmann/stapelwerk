/**
 * Core Service type definitions
 * Represents a containerized service that can be added to a stack
 */

export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

// Catalog metadata for a service's environment variables (seeded per service).
export interface ServiceEnvVar {
  name: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  default?: string;
}

// Catalog metadata for a service's volumes (seeded per service).
// named=true → a docker named volume; named=false → a bind mount the user maps.
export interface ServiceVolume {
  containerPath: string;
  description?: string;
  named?: boolean;
}

export interface Service {
  id: number;
  name: string;
  slug: string;
  description: string;
  dockerImage: string;
  version: string;
  category: ServiceCategory;
  ports: number[];
  environmentVariables: Record<string, string>;
  // Catalog metadata loaded from the DB service row (see prisma/seed.ts).
  env?: ServiceEnvVar[];
  volumes?: ServiceVolume[];
  resourceRequirements?: {
    cpu?: string;
    memory?: string;
    disk?: string;
  };
  compatibilityInfo?: string;
  documentationUrl?: string;
  featured?: boolean;
  status?: string;
  tags?: string[];
}

export type ServiceStatus = 'active' | 'deprecated' | 'beta';
