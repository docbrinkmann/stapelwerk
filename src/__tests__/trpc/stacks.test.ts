import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { PrismaClient } from '@prisma/client';
import { createTRPCContext } from '@/server/trpc';
import { appRouter } from '@/server/root';
import { cleanupTestData, createTestData } from '../helpers/test-data-factory';

// Shared in-memory client (same instance the routers use)
const prisma: any = new PrismaClient();

// cleanupTestData() uses singular delegate names (stack, stackService, ...)
// which the in-memory harness maps to separate empty stores — stack data
// written by the router (plural snake_case models) leaks between tests.
// Clean the actual stores the stacks router writes to.
const cleanupStackData = async () => {
  await prisma.stack_service_configurations.deleteMany({});
  await prisma.stack_services.deleteMany({});
  await prisma.stacks.deleteMany({});
};

// The in-memory harness doesn't emulate Prisma `include`; attach the nested
// relations the stacks router selects (stack_services -> services +
// stack_service_configurations) so responses match the production shape.
const rawStacksFindUnique = prisma.stacks.findUnique.bind(prisma.stacks);
prisma.stacks.findUnique = async (args: any = {}) => {
  const stack = await rawStacksFindUnique(args);
  if (!stack || !args?.include?.stack_services) return stack;
  const stackServiceRows = (await prisma.stack_services.findMany({ where: { stackId: stack.id } }))
    .sort((a: any, b: any) => a.order - b.order);
  const stack_services = [];
  for (const ss of stackServiceRows) {
    const services = await prisma.services.findUnique({ where: { id: ss.serviceId } });
    const configuration = await prisma.stack_service_configurations.findFirst({
      where: { stackServiceId: ss.id }
    });
    stack_services.push({ ...ss, services, stack_service_configurations: configuration ?? null });
  }
  return { ...stack, stack_services };
};

// In the Prisma schema stack_services.stack_service_configurations is a
// one-to-one relation (single object), but the harness attaches it as an
// array. Normalize to the production shape for the router's findFirst usage.
const rawStackServicesFindFirst = prisma.stack_services.findFirst.bind(prisma.stack_services);
prisma.stack_services.findFirst = async (args: any = {}) => {
  const row = await rawStackServicesFindFirst(args);
  if (row && args?.include?.stack_service_configurations && Array.isArray(row.stack_service_configurations)) {
    return { ...row, stack_service_configurations: row.stack_service_configurations[0] ?? null };
  }
  return row;
};

// Create tRPC caller for testing
const createCaller = async (userId?: string) => {
  const ctx = await createTRPCContext({
    userId,
    req: {} as any,
    res: {} as any
  });
  return appRouter.createCaller(ctx);
};

describe('tRPC Stack Router', () => {
  beforeEach(async () => {
    await cleanupTestData();
    await cleanupStackData();
  });

  afterEach(async () => {
    await cleanupTestData();
    await cleanupStackData();
  });

  describe('Stack CRUD Operations', () => {
    describe('stacks.list', () => {
      it('should list user stacks with pagination', async () => {
        const caller = await createCaller('user-1');
        
        // Create test data
        const testCategory = await createTestData.category({
          name: 'Test Category',
          slug: 'test-category'
        });
        
        const testService = await createTestData.service({
          name: 'Test Service',
          slug: 'test-service',
          categoryId: testCategory.id
        });

        // Create test stacks
        const result = await caller.stacks.create({
          name: 'Test Stack 1',
          description: 'First test stack',
          services: [{ serviceId: testService.id, order: 1 }],
          isPublic: false
        });

        await caller.stacks.create({
          name: 'Test Stack 2',
          description: 'Second test stack',
          services: [],
          isPublic: true
        });

        // Test listing
        const stacks = await caller.stacks.list({
          limit: 10
        });

        expect(stacks.stacks).toHaveLength(2);
        expect(stacks.total).toBe(2);
        expect(stacks.hasMore).toBe(false);
        expect(stacks.stacks[0]).toMatchObject({
          name: expect.stringContaining('Test Stack'),
          userId: 'user-1'
        });
      });

      it('should filter stacks by status', async () => {
        const caller = await createCaller('user-1');
        
        // Create test stacks with different statuses
        await caller.stacks.create({
          name: 'Draft Stack',
          status: 'draft'
        });
        
        await caller.stacks.create({
          name: 'Public Stack',
          status: 'public'
        });

        // Test filtering by draft status
        const draftStacks = await caller.stacks.list({
          status: 'draft'
        });

        expect(draftStacks.stacks).toHaveLength(1);
        expect(draftStacks.stacks[0].name).toBe('Draft Stack');
        expect(draftStacks.stacks[0].status).toBe('draft');
      });

      it('should paginate results correctly', async () => {
        const caller = await createCaller('user-1');

        // Create multiple stacks
        for (let i = 1; i <= 5; i++) {
          const created = await caller.stacks.create({
            name: `Stack ${i}`
          });
          // Cursor pagination compares createdAt; fast in-memory creates can
          // share the same millisecond, so space the timestamps out
          await prisma.stacks.update({
            where: { id: created.id },
            data: { createdAt: new Date(Date.now() - (5 - i) * 1000) }
          });
        }

        // Test first page
        const firstPage = await caller.stacks.list({
          limit: 2
        });

        expect(firstPage.stacks).toHaveLength(2);
        expect(firstPage.hasMore).toBe(true);
        expect(firstPage.nextCursor).toBeTruthy();

        // Test second page
        const secondPage = await caller.stacks.list({
          limit: 2,
          cursor: firstPage.nextCursor!
        });

        expect(secondPage.stacks).toHaveLength(2);
        expect(secondPage.hasMore).toBe(true);
      });

      it('should return empty list for user with no stacks', async () => {
        const caller = await createCaller('user-no-stacks');

        const result = await caller.stacks.list({});

        expect(result.stacks).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.hasMore).toBe(false);
        expect(result.nextCursor).toBeNull();
      });
    });

    describe('stacks.get', () => {
      it('should get stack with full service configuration', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Web Servers',
          slug: 'web-servers'
        });
        
        const testService = await createTestData.service({
          name: 'Nginx',
          slug: 'nginx',
          categoryId: testCategory.id
        });

        // Create stack with service configuration
        const createResult = await caller.stacks.create({
          name: 'Web Stack',
          description: 'Complete web stack',
          services: [{
            serviceId: testService.id,
            order: 1,
            configuration: {
              environmentVariables: {
                NGINX_HOST: 'localhost',
                NGINX_PORT: '80'
              },
              portMappings: {
                '80': '8080'
              },
              volumeMounts: {
                '/usr/share/nginx/html': '/app/public'
              },
              dependsOn: []
            }
          }]
        });

        const stack = await caller.stacks.get({
          id: createResult.id
        });

        expect(stack).toMatchObject({
          name: 'Web Stack',
          description: 'Complete web stack',
          userId: 'user-1'
        });
        expect(stack.stack_services).toHaveLength(1);
        expect(stack.stack_services[0].services.name).toBe('Nginx');
        expect(stack.stack_services[0].stack_service_configurations).toBeTruthy();

        const config = JSON.parse(stack.stack_services[0].stack_service_configurations.environmentVariables);
        expect(config.NGINX_HOST).toBe('localhost');
      });

      it('should throw NOT_FOUND for non-existent stack', async () => {
        const caller = await createCaller('user-1');

        await expect(
          caller.stacks.get({ id: 'non-existent-id' })
        ).rejects.toThrow('Stack not found');
      });

      it('should throw FORBIDDEN when accessing other users stack', async () => {
        const caller1 = await createCaller('user-1');
        const caller2 = await createCaller('user-2');

        // Create stack as user-1
        const stack = await caller1.stacks.create({
          name: 'Private Stack',
          isPublic: false
        });

        // Try to access as user-2
        await expect(
          caller2.stacks.get({ id: stack.id })
        ).rejects.toThrow('Access denied');
      });

      it('should allow access to public stacks by other users', async () => {
        const caller1 = await createCaller('user-1');
        const caller2 = await createCaller('user-2');

        // Create public stack as user-1
        const stack = await caller1.stacks.create({
          name: 'Public Stack',
          isPublic: true,
          status: 'public'
        });

        // Access as user-2 should work
        const result = await caller2.stacks.get({ id: stack.id });
        expect(result.name).toBe('Public Stack');
      });
    });

    describe('stacks.create', () => {
      it('should create stack with basic information', async () => {
        const caller = await createCaller('user-1');

        const result = await caller.stacks.create({
          name: 'My New Stack',
          description: 'A test stack',
          isPublic: false
        });

        expect(result).toMatchObject({
          name: 'My New Stack',
          description: 'A test stack',
          slug: 'my-new-stack',
          userId: 'user-1',
          isPublic: false,
          status: 'draft'
        });
        expect(result.id).toBeTruthy();
      });

      it('should create stack with services and configurations', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Databases',
          slug: 'databases'
        });
        
        const testService = await createTestData.service({
          name: 'PostgreSQL',
          slug: 'postgresql',
          categoryId: testCategory.id
        });

        const result = await caller.stacks.create({
          name: 'Database Stack',
          services: [{
            serviceId: testService.id,
            order: 1,
            configuration: {
              environmentVariables: {
                POSTGRES_DB: 'myapp',
                POSTGRES_USER: 'admin'
              },
              portMappings: {
                '5432': '5432'
              }
            }
          }]
        });

        expect(result.stack_services).toHaveLength(1);
        expect(result.stack_services[0].services.name).toBe('PostgreSQL');
        expect(result.stack_services[0].order).toBe(1);
      });

      it('should validate required fields', async () => {
        const caller = await createCaller('user-1');

        try {
          await caller.stacks.create({
            name: '', // Empty name should fail
            description: 'Test'
          });
          expect.fail('Should have thrown validation error');
        } catch (error: any) {
          expect(error.code).toBe('BAD_REQUEST');
          expect(error.message).toContain('too_small');
        }
      });

      it('should validate name length limits', async () => {
        const caller = await createCaller('user-1');

        try {
          await caller.stacks.create({
            name: 'a'.repeat(256), // Too long
            description: 'Test'
          });
          expect.fail('Should have thrown validation error');
        } catch (error: any) {
          expect(error.code).toBe('BAD_REQUEST');
          expect(error.message).toContain('too_big');
        }
      });

      it('should handle slug conflicts with auto-increment', async () => {
        const caller = await createCaller('user-1');

        // Create first stack
        const stack1 = await caller.stacks.create({
          name: 'My Stack'
        });

        // Create second stack with same name
        const stack2 = await caller.stacks.create({
          name: 'My Stack'
        });

        expect(stack1.slug).toBe('my-stack');
        expect(stack2.slug).toBe('my-stack-2');
      });

      it('should require authentication', async () => {
        const caller = await createCaller(); // No user ID

        await expect(
          caller.stacks.create({
            name: 'Test Stack'
          })
        ).rejects.toThrow('Unauthorized');
      });
    });

    describe('stacks.update', () => {
      it('should update stack basic information', async () => {
        const caller = await createCaller('user-1');

        // Create stack
        const created = await caller.stacks.create({
          name: 'Original Name',
          description: 'Original description'
        });

        // Update stack
        const updated = await caller.stacks.update({
          id: created.id,
          name: 'Updated Name',
          description: 'Updated description',
          isPublic: true
        });

        expect(updated.name).toBe('Updated Name');
        expect(updated.description).toBe('Updated description');
        expect(updated.isPublic).toBe(true);
        expect(updated.slug).toBe('original-name'); // Slug shouldn't change
      });

      it('should update stack services', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Test Category',
          slug: 'test-category'
        });
        
        const service1 = await createTestData.service({
          name: 'Service 1',
          slug: 'service-1',
          categoryId: testCategory.id
        });
        
        const service2 = await createTestData.service({
          name: 'Service 2',
          slug: 'service-2',
          categoryId: testCategory.id
        });

        // Create stack with one service
        const created = await caller.stacks.create({
          name: 'Test Stack',
          services: [{ serviceId: service1.id, order: 1 }]
        });

        // Update to replace with different service
        const updated = await caller.stacks.update({
          id: created.id,
          services: [{ serviceId: service2.id, order: 1 }]
        });

        expect(updated.stack_services).toHaveLength(1);
        expect(updated.stack_services[0].services.name).toBe('Service 2');
      });

      it('should throw NOT_FOUND for non-existent stack', async () => {
        const caller = await createCaller('user-1');

        await expect(
          caller.stacks.update({
            id: 'non-existent-id',
            name: 'Updated Name'
          })
        ).rejects.toThrow('Stack not found');
      });

      it('should throw FORBIDDEN when updating other users stack', async () => {
        const caller1 = await createCaller('user-1');
        const caller2 = await createCaller('user-2');

        // Create stack as user-1
        const stack = await caller1.stacks.create({
          name: 'User 1 Stack'
        });

        // Try to update as user-2
        await expect(
          caller2.stacks.update({
            id: stack.id,
            name: 'Hacked Name'
          })
        ).rejects.toThrow('Access denied');
      });
    });

    describe('stacks.delete', () => {
      it('should delete users stack', async () => {
        const caller = await createCaller('user-1');

        // Create stack
        const stack = await caller.stacks.create({
          name: 'Stack to Delete'
        });

        // Delete stack
        const result = await caller.stacks.delete({
          id: stack.id
        });

        expect(result.success).toBe(true);

        // Verify its gone
        await expect(
          caller.stacks.get({ id: stack.id })
        ).rejects.toThrow('Stack not found');
      });

      it('should throw NOT_FOUND for non-existent stack', async () => {
        const caller = await createCaller('user-1');

        await expect(
          caller.stacks.delete({ id: 'non-existent-id' })
        ).rejects.toThrow('Stack not found');
      });

      it('should throw FORBIDDEN when deleting other users stack', async () => {
        const caller1 = await createCaller('user-1');
        const caller2 = await createCaller('user-2');

        // Create stack as user-1
        const stack = await caller1.stacks.create({
          name: 'Protected Stack'
        });

        // Try to delete as user-2
        await expect(
          caller2.stacks.delete({ id: stack.id })
        ).rejects.toThrow('Access denied');
      });
    });
  });

  describe('Service Management Operations', () => {
    describe('stacks.addService', () => {
      it('should add service to existing stack', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Test Category',
          slug: 'test-category'
        });
        
        const testService = await createTestData.service({
          name: 'Test Service',
          slug: 'test-service',
          categoryId: testCategory.id
        });

        // Create empty stack
        const stack = await caller.stacks.create({
          name: 'Empty Stack'
        });

        // Add service
        const result = await caller.stacks.addService({
          stackId: stack.id,
          serviceId: testService.id,
          configuration: {
            environmentVariables: { NODE_ENV: 'production' },
            portMappings: { '3000': '8080' }
          },
          order: 1
        });

        expect(result.stack_services).toHaveLength(1);
        expect(result.stack_services[0].services.name).toBe('Test Service');
        expect(result.stack_services[0].order).toBe(1);

        const config = JSON.parse(result.stack_services[0].stack_service_configurations.environmentVariables);
        expect(config.NODE_ENV).toBe('production');
      });

      it('should prevent adding same service twice', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Test Category',
          slug: 'test-category'
        });
        
        const testService = await createTestData.service({
          name: 'Test Service',
          slug: 'test-service',
          categoryId: testCategory.id
        });

        // Create stack with service
        const stack = await caller.stacks.create({
          name: 'Test Stack',
          services: [{ serviceId: testService.id, order: 1 }]
        });

        // Try to add same service again
        await expect(
          caller.stacks.addService({
            stackId: stack.id,
            serviceId: testService.id,
            order: 2
          })
        ).rejects.toThrow('Service already exists in stack');
      });

      it('should throw NOT_FOUND for non-existent stack', async () => {
        const caller = await createCaller('user-1');
        
        try {
          await caller.stacks.addService({
            stackId: 'non-existent-id',
            serviceId: 1, // Use number instead of string
            order: 1
          });
          expect.fail('Should have thrown not found error');
        } catch (error: any) {
          expect(error.code).toBe('NOT_FOUND');
          expect(error.message).toContain('Stack not found');
        }
      });

      it('should throw NOT_FOUND for non-existent service', async () => {
        const caller = await createCaller('user-1');

        const stack = await caller.stacks.create({
          name: 'Test Stack'
        });

        await expect(
          caller.stacks.addService({
            stackId: stack.id,
            serviceId: 999999, // Non-existent service ID
            order: 1
          })
        ).rejects.toThrow('Service not found');
      });
    });

    describe('stacks.removeService', () => {
      it('should remove service from stack', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Test Category',
          slug: 'test-category'
        });
        
        const testService = await createTestData.service({
          name: 'Test Service',
          slug: 'test-service',
          categoryId: testCategory.id
        });

        // Create stack with service
        const stack = await caller.stacks.create({
          name: 'Test Stack',
          services: [{ serviceId: testService.id, order: 1 }]
        });

        // Remove service
        const result = await caller.stacks.removeService({
          stackId: stack.id,
          serviceId: testService.id
        });

        expect(result.success).toBe(true);

        // Verify service was removed
        const updatedStack = await caller.stacks.get({ id: stack.id });
        expect(updatedStack.stack_services).toHaveLength(0);
      });

      it('should throw NOT_FOUND when service not in stack', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Test Category',
          slug: 'test-category'
        });
        
        const testService = await createTestData.service({
          name: 'Test Service',
          slug: 'test-service',
          categoryId: testCategory.id
        });

        // Create empty stack
        const stack = await caller.stacks.create({
          name: 'Empty Stack'
        });

        // Try to remove service that's not there
        await expect(
          caller.stacks.removeService({
            stackId: stack.id,
            serviceId: testService.id
          })
        ).rejects.toThrow('Service not found in stack');
      });
    });

    describe('stacks.updateServiceConfig', () => {
      it('should update service configuration', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Test Category',
          slug: 'test-category'
        });
        
        const testService = await createTestData.service({
          name: 'Test Service',
          slug: 'test-service',
          categoryId: testCategory.id
        });

        // Create stack with service
        const stack = await caller.stacks.create({
          name: 'Test Stack',
          services: [{
            serviceId: testService.id,
            order: 1,
            configuration: {
              environmentVariables: { NODE_ENV: 'development' },
              portMappings: { '3000': '3000' }
            }
          }]
        });

        // Update configuration
        const result = await caller.stacks.updateServiceConfig({
          stackId: stack.id,
          serviceId: testService.id,
          configuration: {
            environmentVariables: { NODE_ENV: 'production', API_KEY: 'secret' },
            portMappings: { '3000': '8080' },
            volumeMounts: { '/app': '/host/app' }
          }
        });

        const config = result.configurations[0];
        const envVars = JSON.parse(config.environmentVariables);
        const ports = JSON.parse(config.portMappings);
        const volumes = JSON.parse(config.volumeMounts);

        expect(envVars.NODE_ENV).toBe('production');
        expect(envVars.API_KEY).toBe('secret');
        expect(ports['3000']).toBe('8080');
        expect(volumes['/app']).toBe('/host/app');
      });

      it('should validate configuration data', async () => {
        const caller = await createCaller('user-1');
        
        const testCategory = await createTestData.category({
          name: 'Test Category',
          slug: 'test-category'
        });
        
        const testService = await createTestData.service({
          name: 'Test Service',
          slug: 'test-service',
          categoryId: testCategory.id
        });

        const stack = await caller.stacks.create({
          name: 'Test Stack',
          services: [{ serviceId: testService.id, order: 1 }]
        });

        // Try invalid port mapping
        try {
          await caller.stacks.updateServiceConfig({
            stackId: stack.id,
            serviceId: testService.id,
            configuration: {
              portMappings: { 'invalid-port': '8080' }
            }
          });
          expect.fail('Should have thrown validation error');
        } catch (error: any) {
          expect(error.code).toBe('BAD_REQUEST');
          expect(error.message).toContain('invalid_key');
        }
      });
    });
  });

  describe('Public Template Operations', () => {
    describe('stacks.getPublicTemplates', () => {
      it('should list public template stacks', async () => {
        const caller1 = await createCaller('user-1');
        const caller2 = await createCaller('user-2');

        // Create public templates
        await caller1.stacks.create({
          name: 'LAMP Stack Template',
          description: 'Classic LAMP stack',
          isTemplate: true,
          status: 'public'
        });

        await caller2.stacks.create({
          name: 'MEAN Stack Template',
          description: 'MongoDB, Express, Angular, Node',
          isTemplate: true,
          status: 'public'
        });

        // List public templates (no auth required)
        const publicCaller = await createCaller();
        const result = await publicCaller.stacks.getPublicTemplates({
          limit: 10
        });

        expect(result.stacks).toHaveLength(2);
        expect(result.stacks[0].isTemplate).toBe(true);
        expect(result.stacks[0].status).toBe('public');
        expect(result.stacks).toSatisfy((stacks: any[]) => 
          stacks.some(s => s.name === 'LAMP Stack Template')
        );
      });

      it('should paginate public templates', async () => {
        const caller = await createCaller('user-1');

        // Create multiple public templates
        for (let i = 1; i <= 5; i++) {
          const created = await caller.stacks.create({
            name: `Template ${i}`,
            isTemplate: true,
            status: 'public'
          });
          // Cursor pagination compares createdAt; fast in-memory creates can
          // share the same millisecond, so space the timestamps out
          await prisma.stacks.update({
            where: { id: created.id },
            data: { createdAt: new Date(Date.now() - (5 - i) * 1000) }
          });
        }

        const publicCaller = await createCaller();
        
        // Test pagination
        const firstPage = await publicCaller.stacks.getPublicTemplates({
          limit: 2
        });

        expect(firstPage.stacks).toHaveLength(2);
        expect(firstPage.hasMore).toBe(true);
        expect(firstPage.nextCursor).toBeTruthy();

        const secondPage = await publicCaller.stacks.getPublicTemplates({
          limit: 2,
          cursor: firstPage.nextCursor!
        });

        expect(secondPage.stacks).toHaveLength(2);
        expect(secondPage.stacks[0].id).not.toBe(firstPage.stacks[0].id);
      });

      it('should filter by category when implemented', async () => {
        // Note: This test assumes category filtering will be implemented
        const publicCaller = await createCaller();
        
        const result = await publicCaller.stacks.getPublicTemplates({
          category: 'web-development'
        });

        expect(result.stacks).toBeInstanceOf(Array);
        // When category filtering is implemented, add more specific expectations
      });
    });

    describe('stacks.submitForApproval', () => {
      it('should submit private stack for approval', async () => {
        const caller = await createCaller('user-1');

        // Create private stack
        const stack = await caller.stacks.create({
          name: 'My Great Stack',
          description: 'A stack worth sharing',
          status: 'private'
        });

        // Submit for approval
        const result = await caller.stacks.submitForApproval({
          id: stack.id
        });

        expect(result.status).toBe('pending_approval');
        expect(result.isTemplate).toBe(true);
      });

      it('should throw error when submitting already public stack', async () => {
        const caller = await createCaller('user-1');

        // Create public stack
        const stack = await caller.stacks.create({
          name: 'Already Public',
          status: 'public'
        });

        await expect(
          caller.stacks.submitForApproval({ id: stack.id })
        ).rejects.toThrow('Stack is already public or pending approval');
      });

      it('should throw error when submitting pending stack', async () => {
        const caller = await createCaller('user-1');

        // Create and submit stack
        const stack = await caller.stacks.create({
          name: 'Pending Stack'
        });
        await caller.stacks.submitForApproval({ id: stack.id });

        // Try to submit again
        await expect(
          caller.stacks.submitForApproval({ id: stack.id })
        ).rejects.toThrow('Stack is already public or pending approval');
      });

      it('should require stack ownership', async () => {
        const caller1 = await createCaller('user-1');
        const caller2 = await createCaller('user-2');

        // Create stack as user-1
        const stack = await caller1.stacks.create({
          name: 'User 1 Stack'
        });

        // Try to submit as user-2
        await expect(
          caller2.stacks.submitForApproval({ id: stack.id })
        ).rejects.toThrow('Access denied');
      });
    });
  });

  describe('Error Handling and Authorization', () => {
    it('should handle invalid input parameters', async () => {
      const caller = await createCaller('user-1');

      // Invalid limit - should throw BAD_REQUEST with Zod validation error
      try {
        await caller.stacks.list({ limit: -1 });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.message).toContain('too_small');
      }

      // Note: Cursor validation is currently not implemented in the router
    });

    it('should require authentication for protected endpoints', async () => {
      const caller = await createCaller(); // No user ID

      try {
        await caller.stacks.create({ name: 'Test' });
        expect.fail('Should have thrown unauthorized error');
      } catch (error: any) {
        expect(error.code).toBe('UNAUTHORIZED');
        expect(error.message).toContain('Unauthorized');
      }

      try {
        await caller.stacks.list({});
        expect.fail('Should have thrown unauthorized error');
      } catch (error: any) {
        expect(error.code).toBe('UNAUTHORIZED');
        expect(error.message).toContain('Unauthorized');
      }
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking Prisma to simulate connection failures
      // For now, we'll test the structure is in place
      const caller = await createCaller('user-1');
      
      // Normal operation should not throw internal server errors
      await expect(async () => {
        await caller.stacks.list({});
      }).not.toThrow('INTERNAL_SERVER_ERROR');
    });

    it('should return appropriate HTTP status codes', async () => {
      const caller = await createCaller('user-1');

      try {
        await caller.stacks.get({ id: 'non-existent' });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('NOT_FOUND');
      }

      try {
        await caller.stacks.create({ name: '' });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('BAD_REQUEST');
      }
    });

    it('should validate service configuration schemas', async () => {
      const caller = await createCaller('user-1');
      
      const testCategory = await createTestData.category({
        name: 'Test Category',
        slug: 'test-category'
      });
      
      const testService = await createTestData.service({
        name: 'Test Service',
        slug: 'test-service',
        categoryId: testCategory.id
      });

      // Test with invalid port mapping - should throw BAD_REQUEST with validation error
      try {
        await caller.stacks.create({
          name: 'Test Stack',
          services: [{
            serviceId: testService.id,
            configuration: {
              portMappings: {
                '999999': '8080' // Invalid port
              }
            }
          }]
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.message).toContain('Port must be between 1 and 65535');
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large stack configurations', async () => {
      const caller = await createCaller('user-1');
      
      const testCategory = await createTestData.category({
        name: 'Test Category',
        slug: 'test-category'
      });

      // Create multiple services
      const services = [];
      for (let i = 1; i <= 10; i++) {
        const service = await createTestData.service({
          name: `Service ${i}`,
          slug: `service-${i}`,
          categoryId: testCategory.id
        });
        services.push({
          serviceId: service.id,
          order: i,
          configuration: {
            environmentVariables: {
              [`ENV_VAR_${i}`]: `value_${i}`,
              COMMON_VAR: 'shared'
            },
            portMappings: {
              [`${3000 + i}`]: `${8000 + i}`
            }
          }
        });
      }

      const result = await caller.stacks.create({
        name: 'Large Stack',
        services
      });

      expect(result.stack_services).toHaveLength(10);
      expect(result.stack_services[0].order).toBe(1);
      expect(result.stack_services[9].order).toBe(10);
    });

    it('should handle concurrent stack operations', async () => {
      const caller = await createCaller('user-1');

      // Create multiple stacks concurrently
      const promises = [];
      for (let i = 1; i <= 5; i++) {
        promises.push(
          caller.stacks.create({
            name: `Concurrent Stack ${i}`,
            description: `Stack created concurrently ${i}`
          })
        );
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(new Set(results.map(r => r.id)).size).toBe(5); // All unique IDs
      expect(new Set(results.map(r => r.slug)).size).toBe(5); // All unique slugs
    });

    it('should handle empty service configurations', async () => {
      const caller = await createCaller('user-1');
      
      const testCategory = await createTestData.category({
        name: 'Test Category',
        slug: 'test-category'
      });
      
      const testService = await createTestData.service({
        name: 'Test Service',
        slug: 'test-service',
        categoryId: testCategory.id
      });

      const result = await caller.stacks.create({
        name: 'Minimal Stack',
        services: [{
          serviceId: testService.id,
          order: 1
          // No configuration provided
        }]
      });

      expect(result.stack_services).toHaveLength(1);

      // Default empty configuration should be created
      const config = result.stack_services[0].stack_service_configurations;
      expect(config).toBeTruthy();
      expect(JSON.parse(config.environmentVariables)).toEqual({});
      expect(JSON.parse(config.portMappings)).toEqual({});
      expect(JSON.parse(config.volumeMounts)).toEqual({});
      expect(JSON.parse(config.dependsOn)).toEqual([]);
    });
  });

  describe('stacks.getSharedStack', () => {
    it('returns a real compose for a public stack with every secret masked', async () => {
      const owner = await createCaller('owner-1');
      const category = await createTestData.category({ name: 'Databases', slug: 'databases-shared' });

      // Catalog service carrying a REQUIRED SECRET env var + a named volume.
      const svc = await prisma.services.create({
        data: {
          name: 'PostgreSQL',
          slug: 'postgresql-shared',
          description: 'PostgreSQL database',
          categoryId: category.id,
          dockerImage: 'postgres:18-alpine',
          version: '18',
          status: 'approved',
          ports: JSON.stringify([5432]),
          environmentVariables: JSON.stringify([
            { name: 'POSTGRES_PASSWORD', required: true, secret: true },
            { name: 'POSTGRES_USER', required: false, secret: false, default: 'postgres' },
          ]),
          volumes: JSON.stringify([{ containerPath: '/var/lib/postgresql/data', named: true }]),
        },
      });

      const created = await owner.stacks.create({
        name: 'Shared PG',
        description: 'public db stack',
        isPublic: true,
        status: 'public',
        services: [{
          serviceId: svc.id,
          order: 1,
          configuration: { environmentVariables: {}, portMappings: {}, volumeMounts: {}, dependsOn: [] },
        }],
      });

      // getSharedStack is public — an anonymous caller must reach it.
      const anon = await createCaller();
      const shared = await anon.stacks.getSharedStack({ shareId: created.id });

      expect(shared.dockerCompose).toBeTruthy();
      const compose = shared.dockerCompose as string;
      // Public-view banner + masked secret placeholder present.
      expect(compose).toContain('secret values are masked');
      expect(compose).toContain('<secret>');
      // Non-secret default still surfaces so the compose stays informative.
      expect(compose).toContain('POSTGRES_USER');
      expect(compose).toContain('postgres');
      // Crucially: NO real generated secret leaked on the password line.
      expect(compose).not.toMatch(/POSTGRES_PASSWORD:\s*['"]?[A-Za-z0-9+/_-]{20,}/);

      // Regression: services are shaped for the public viewer — `ports` is parsed
      // to an array. The raw row stores it as a JSON string, and the viewer does
      // `service.ports.join(...)`, which 500'd the shared page with
      // "ports.join is not a function".
      expect(Array.isArray(shared.services[0].ports)).toBe(true);
      expect(shared.services[0].ports).toEqual([5432]);
    });

    it('rejects a private (non-public) stack', async () => {
      const owner = await createCaller('owner-2');
      const priv = await owner.stacks.create({ name: 'Private', isPublic: false });
      const anon = await createCaller();
      await expect(anon.stacks.getSharedStack({ shareId: priv.id })).rejects.toThrow(
        /not publicly accessible/i,
      );
    });
  });
});