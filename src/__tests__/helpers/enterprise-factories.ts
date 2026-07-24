/**
 * Enterprise Test Factories
 * Factory functions for creating test data for enterprise features
 */

import { testDb } from '../test-db';
import { faker } from '@faker-js/faker';

// Create test user
export async function createTestUser(overrides: {
  email?: string;
  name?: string;
} = {}) {
  return await testDb.client.user.create({
    data: {
      email: overrides.email || faker.internet.email(),
      name: overrides.name || faker.person.fullName(),
      preferences: '{}',
      lastActivity: new Date(),
    }
  });
}

// Create test organization
export async function createTestOrganization(createdById: string, overrides: {
  name?: string;
  slug?: string;
  description?: string;
} = {}) {
  const name = overrides.name || faker.company.name();
  const slug = overrides.slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  return await testDb.client.organization.create({
    data: {
      name,
      slug,
      description: overrides.description || faker.company.catchPhrase(),
      settings: '{}',
      createdBy: createdById,
    }
  });
}

// Create test stack
export async function createTestStack(overrides: {
  name?: string;
  description?: string;
  organizationId?: string;
  createdBy?: string;
} = {}) {
  return await testDb.client.stack.create({
    data: {
      name: overrides.name || faker.lorem.words(2),
      description: overrides.description || faker.lorem.sentence(),
      configuration: '{}',
      status: 'draft',
      organizationId: overrides.organizationId,
      createdBy: overrides.createdBy,
    }
  });
}

// Create test organization member
export async function createOrganizationMember(
  organizationId: string, 
  userId: string, 
  role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'
) {
  return await testDb.client.organizationMember.create({
    data: {
      organizationId,
      userId,
      role,
      permissions: '{}',
    }
  });
}

// Create test approval workflow
export async function createApprovalWorkflow(overrides: {
  title?: string;
  description?: string;
  type?: string;
  organizationId: string;
  createdById: string;
  stackId?: string;
  status?: string;
} = {} as any) {
  return await testDb.client.approvalWorkflow.create({
    data: {
      title: overrides.title || 'Test Workflow',
      description: overrides.description,
      type: overrides.type || 'stack_change',
      organizationId: overrides.organizationId,
      createdById: overrides.createdById,
      stackId: overrides.stackId,
      status: overrides.status || 'draft',
      changes: '{}',
      metadata: '{}',
    }
  });
}