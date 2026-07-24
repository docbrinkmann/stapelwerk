import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTestData, cleanupTestData } from '../helpers/test-data-factory';

// Create a separate test database instance
const prisma = new PrismaClient();

describe('Stack Models', () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  describe('Stack Model', () => {
    it('should create a stack with required fields', async () => {
      const testCategory = await createTestData.category({
        name: 'Test Category',
        slug: 'test-category'
      });

      const testService = await createTestData.service({
        name: 'Test Service',
        slug: 'test-service',
        categoryId: testCategory.id
      });

      const stackData = {
        name: 'Test Stack',
        description: 'A test stack for testing',
        slug: 'test-stack',
        userId: null, // Anonymous stack
        isPublic: false,
        isTemplate: false,
        status: 'draft' as const
      };

      const stack = await prisma.stack.create({
        data: stackData
      });

      expect(stack).toBeDefined();
      expect(stack.name).toBe('Test Stack');
      expect(stack.slug).toBe('test-stack');
      expect(stack.status).toBe('draft');
      expect(stack.isPublic).toBe(false);
      expect(stack.isTemplate).toBe(false);
      expect(stack.createdAt).toBeInstanceOf(Date);
      expect(stack.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a stack with user association', async () => {
      const stackData = {
        name: 'User Stack',
        description: 'A user-owned stack',
        slug: 'user-stack',
        userId: 'user-123',
        isPublic: true,
        isTemplate: false,
        status: 'private' as const
      };

      const stack = await prisma.stack.create({
        data: stackData
      });

      expect(stack.userId).toBe('user-123');
      expect(stack.isPublic).toBe(true);
    });

    it('should enforce unique slug constraint', async () => {
      const stackData = {
        name: 'First Stack',
        slug: 'duplicate-slug',
        status: 'draft' as const
      };

      await prisma.stack.create({ data: stackData });

      const duplicateStackData = {
        name: 'Second Stack',
        slug: 'duplicate-slug',
        status: 'draft' as const
      };

      await expect(
        prisma.stack.create({ data: duplicateStackData })
      ).rejects.toThrow();
    });

    it('should support all valid status values', async () => {
      const statuses = ['draft', 'private', 'public', 'pending_approval'] as const;

      for (const status of statuses) {
        const stackData = {
          name: `${status} Stack`,
          slug: `${status}-stack`,
          status
        };

        const stack = await prisma.stack.create({ data: stackData });
        expect(stack.status).toBe(status);
      }
    });

    it('should cascade delete related StackService records', async () => {
      const testCategory = await createTestData.category({
        name: 'Test Category',
        slug: 'test-category'
      });

      const testService = await createTestData.service({
        name: 'Test Service',
        slug: 'test-service',
        categoryId: testCategory.id
      });

      const stack = await prisma.stack.create({
        data: {
          name: 'Test Stack',
          slug: 'test-stack',
          status: 'draft'
        }
      });

      // Add service to stack
      const stackService = await prisma.stackService.create({
        data: {
          stackId: stack.id,
          serviceId: testService.id,
          order: 1
        }
      });

      // Delete the stack
      await prisma.stack.delete({ where: { id: stack.id } });

      // Verify stackService was cascade deleted
      const remainingStackServices = await prisma.stackService.findMany({
        where: { stackId: stack.id }
      });
      expect(remainingStackServices).toHaveLength(0);
    });
  });

  describe('StackService Model', () => {
    let testStack: any;
    let testService: any;

    beforeEach(async () => {
      const testCategory = await createTestData.category({
        name: 'Test Category',
        slug: 'test-category'
      });

      testService = await createTestData.service({
        name: 'Test Service',
        slug: 'test-service',
        categoryId: testCategory.id
      });

      testStack = await prisma.stack.create({
        data: {
          name: 'Test Stack',
          slug: 'test-stack',
          status: 'draft'
        }
      });
    });

    it('should create a StackService relationship', async () => {
      const stackServiceData = {
        stackId: testStack.id,
        serviceId: testService.id,
        order: 1
      };

      const stackService = await prisma.stackService.create({
        data: stackServiceData,
        include: {
          stack: true,
          service: true
        }
      });

      expect(stackService).toBeDefined();
      expect(stackService.stackId).toBe(testStack.id);
      expect(stackService.serviceId).toBe(testService.id);
      expect(stackService.order).toBe(1);
      expect(stackService.stack.name).toBe('Test Stack');
      expect(stackService.service.name).toBe('Test Service');
      expect(stackService.createdAt).toBeInstanceOf(Date);
    });

    it('should support multiple services in a stack with ordering', async () => {
      const testCategory = await createTestData.category({
        name: 'Test Category 2',
        slug: 'test-category-2'
      });

      const testService2 = await createTestData.service({
        name: 'Test Service 2',
        slug: 'test-service-2',
        categoryId: testCategory.id
      });

      // Add first service
      const stackService1 = await prisma.stackService.create({
        data: {
          stackId: testStack.id,
          serviceId: testService.id,
          order: 1
        }
      });

      // Add second service
      const stackService2 = await prisma.stackService.create({
        data: {
          stackId: testStack.id,
          serviceId: testService2.id,
          order: 2
        }
      });

      // Verify both services are in the stack
      const stackServices = await prisma.stackService.findMany({
        where: { stackId: testStack.id },
        orderBy: { order: 'asc' },
        include: { service: true }
      });

      expect(stackServices).toHaveLength(2);
      expect(stackServices[0].service.name).toBe('Test Service');
      expect(stackServices[0].order).toBe(1);
      expect(stackServices[1].service.name).toBe('Test Service 2');
      expect(stackServices[1].order).toBe(2);
    });

    it('should prevent duplicate service in same stack', async () => {
      // Add service to stack
      await prisma.stackService.create({
        data: {
          stackId: testStack.id,
          serviceId: testService.id,
          order: 1
        }
      });

      // Try to add same service again
      await expect(
        prisma.stackService.create({
          data: {
            stackId: testStack.id,
            serviceId: testService.id,
            order: 2
          }
        })
      ).rejects.toThrow();
    });

    it('should cascade delete when stack is deleted', async () => {
      const stackService = await prisma.stackService.create({
        data: {
          stackId: testStack.id,
          serviceId: testService.id,
          order: 1
        }
      });

      // Delete the stack
      await prisma.stack.delete({ where: { id: testStack.id } });

      // Verify stackService was deleted
      const remainingStackService = await prisma.stackService.findUnique({
        where: { id: stackService.id }
      });
      expect(remainingStackService).toBeNull();
    });

    it('should cascade delete when service is deleted', async () => {
      const stackService = await prisma.stackService.create({
        data: {
          stackId: testStack.id,
          serviceId: testService.id,
          order: 1
        }
      });

      // Delete the service
      await prisma.service.delete({ where: { id: testService.id } });

      // Verify stackService was deleted
      const remainingStackService = await prisma.stackService.findUnique({
        where: { id: stackService.id }
      });
      expect(remainingStackService).toBeNull();
    });
  });

  describe('StackServiceConfiguration Model', () => {
    let testStack: any;
    let testService: any;
    let testStackService: any;

    beforeEach(async () => {
      const testCategory = await createTestData.category({
        name: 'Test Category',
        slug: 'test-category'
      });

      testService = await createTestData.service({
        name: 'Test Service',
        slug: 'test-service',
        categoryId: testCategory.id
      });

      testStack = await prisma.stack.create({
        data: {
          name: 'Test Stack',
          slug: 'test-stack',
          status: 'draft'
        }
      });

      testStackService = await prisma.stackService.create({
        data: {
          stackId: testStack.id,
          serviceId: testService.id,
          order: 1
        }
      });
    });

    it('should create service configuration with environment variables', async () => {
      const configData = {
        stackServiceId: testStackService.id,
        environmentVariables: JSON.stringify({
          NODE_ENV: 'production',
          API_KEY: 'secret-key',
          PORT: '3000'
        }),
        portMappings: JSON.stringify({}),
        volumeMounts: JSON.stringify({}),
        dependsOn: JSON.stringify([])
      };

      const config = await prisma.stackServiceConfiguration.create({
        data: configData,
        include: {
          stackService: {
            include: {
              service: true,
              stack: true
            }
          }
        }
      });

      expect(config).toBeDefined();
      expect(config.stackServiceId).toBe(testStackService.id);
      
      const envVars = JSON.parse(config.environmentVariables);
      expect(envVars.NODE_ENV).toBe('production');
      expect(envVars.API_KEY).toBe('secret-key');
      expect(envVars.PORT).toBe('3000');
      
      expect(config.stackService.service.name).toBe('Test Service');
      expect(config.createdAt).toBeInstanceOf(Date);
      expect(config.updatedAt).toBeInstanceOf(Date);
    });

    it('should create service configuration with port mappings', async () => {
      const configData = {
        stackServiceId: testStackService.id,
        environmentVariables: JSON.stringify({}),
        portMappings: JSON.stringify({
          '3000': '8080',
          '80': '3001'
        }),
        volumeMounts: JSON.stringify({}),
        dependsOn: JSON.stringify([])
      };

      const config = await prisma.stackServiceConfiguration.create({
        data: configData
      });

      const portMappings = JSON.parse(config.portMappings);
      expect(portMappings['3000']).toBe('8080');
      expect(portMappings['80']).toBe('3001');
    });

    it('should create service configuration with volume mounts', async () => {
      const configData = {
        stackServiceId: testStackService.id,
        environmentVariables: JSON.stringify({}),
        portMappings: JSON.stringify({}),
        volumeMounts: JSON.stringify({
          '/app/data': '/host/data',
          '/app/logs': '/var/logs/app'
        }),
        dependsOn: JSON.stringify([])
      };

      const config = await prisma.stackServiceConfiguration.create({
        data: configData
      });

      const volumeMounts = JSON.parse(config.volumeMounts);
      expect(volumeMounts['/app/data']).toBe('/host/data');
      expect(volumeMounts['/app/logs']).toBe('/var/logs/app');
    });

    it('should create service configuration with dependencies', async () => {
      const configData = {
        stackServiceId: testStackService.id,
        environmentVariables: JSON.stringify({}),
        portMappings: JSON.stringify({}),
        volumeMounts: JSON.stringify({}),
        dependsOn: JSON.stringify(['database', 'redis'])
      };

      const config = await prisma.stackServiceConfiguration.create({
        data: configData
      });

      const dependencies = JSON.parse(config.dependsOn);
      expect(dependencies).toEqual(['database', 'redis']);
    });

    it('should handle complex configuration with all fields', async () => {
      const configData = {
        stackServiceId: testStackService.id,
        environmentVariables: JSON.stringify({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          REDIS_URL: 'redis://localhost:6379'
        }),
        portMappings: JSON.stringify({
          '3000': '8080',
          '5432': '5433'
        }),
        volumeMounts: JSON.stringify({
          '/app/uploads': '/host/uploads',
          '/app/config': '/host/config'
        }),
        dependsOn: JSON.stringify(['postgres', 'redis'])
      };

      const config = await prisma.stackServiceConfiguration.create({
        data: configData
      });

      // Verify all configuration fields
      const envVars = JSON.parse(config.environmentVariables);
      const ports = JSON.parse(config.portMappings);
      const volumes = JSON.parse(config.volumeMounts);
      const deps = JSON.parse(config.dependsOn);

      expect(Object.keys(envVars)).toHaveLength(3);
      expect(Object.keys(ports)).toHaveLength(2);
      expect(Object.keys(volumes)).toHaveLength(2);
      expect(deps).toHaveLength(2);
    });

    it('should cascade delete when stackService is deleted', async () => {
      const config = await prisma.stackServiceConfiguration.create({
        data: {
          stackServiceId: testStackService.id,
          environmentVariables: JSON.stringify({}),
          portMappings: JSON.stringify({}),
          volumeMounts: JSON.stringify({}),
          dependsOn: JSON.stringify([])
        }
      });

      // Delete the stackService
      await prisma.stackService.delete({ where: { id: testStackService.id } });

      // Verify configuration was deleted
      const remainingConfig = await prisma.stackServiceConfiguration.findUnique({
        where: { id: config.id }
      });
      expect(remainingConfig).toBeNull();
    });

    it('should update configuration timestamps on modification', async () => {
      const config = await prisma.stackServiceConfiguration.create({
        data: {
          stackServiceId: testStackService.id,
          environmentVariables: JSON.stringify({ TEST: 'initial' }),
          portMappings: JSON.stringify({}),
          volumeMounts: JSON.stringify({}),
          dependsOn: JSON.stringify([])
        }
      });

      const initialUpdatedAt = config.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update the configuration
      const updatedConfig = await prisma.stackServiceConfiguration.update({
        where: { id: config.id },
        data: {
          environmentVariables: JSON.stringify({ TEST: 'updated' })
        }
      });

      expect(updatedConfig.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
      
      const envVars = JSON.parse(updatedConfig.environmentVariables);
      expect(envVars.TEST).toBe('updated');
    });
  });

  describe('Stack Model Integration', () => {
    it('should create a complete stack with services and configurations', async () => {
      // Create test data
      const testCategory = await createTestData.category({
        name: 'Web Servers',
        slug: 'web-servers'
      });

      const nginxService = await createTestData.service({
        name: 'Nginx',
        slug: 'nginx',
        categoryId: testCategory.id
      });

      const postgresService = await createTestData.service({
        name: 'PostgreSQL',
        slug: 'postgresql',
        categoryId: testCategory.id
      });

      // Create stack
      const stack = await prisma.stack.create({
        data: {
          name: 'Web Application Stack',
          description: 'A complete web application with database',
          slug: 'web-app-stack',
          userId: 'user-123',
          isPublic: false,
          isTemplate: false,
          status: 'private'
        }
      });

      // Add services to stack
      const nginxStackService = await prisma.stackService.create({
        data: {
          stackId: stack.id,
          serviceId: nginxService.id,
          order: 1
        }
      });

      const postgresStackService = await prisma.stackService.create({
        data: {
          stackId: stack.id,
          serviceId: postgresService.id,
          order: 2
        }
      });

      // Add configurations
      await prisma.stackServiceConfiguration.create({
        data: {
          stackServiceId: nginxStackService.id,
          environmentVariables: JSON.stringify({
            NGINX_HOST: 'localhost',
            NGINX_PORT: '80'
          }),
          portMappings: JSON.stringify({
            '80': '8080'
          }),
          volumeMounts: JSON.stringify({
            '/usr/share/nginx/html': '/app/public'
          }),
          dependsOn: JSON.stringify(['postgres'])
        }
      });

      await prisma.stackServiceConfiguration.create({
        data: {
          stackServiceId: postgresStackService.id,
          environmentVariables: JSON.stringify({
            POSTGRES_DB: 'webapp',
            POSTGRES_USER: 'admin',
            POSTGRES_PASSWORD: 'secret'
          }),
          portMappings: JSON.stringify({
            '5432': '5432'
          }),
          volumeMounts: JSON.stringify({
            '/var/lib/postgresql/data': '/data/postgres'
          }),
          dependsOn: JSON.stringify([])
        }
      });

      // Verify the complete stack
      const completeStack = await prisma.stack.findUnique({
        where: { id: stack.id },
        include: {
          stackServices: {
            orderBy: { order: 'asc' },
            include: {
              service: true,
              configurations: true
            }
          }
        }
      });

      expect(completeStack).toBeDefined();
      expect(completeStack!.stackServices).toHaveLength(2);
      
      // Verify Nginx service
      const nginxStackSvc = completeStack!.stackServices[0];
      expect(nginxStackSvc.service.name).toBe('Nginx');
      expect(nginxStackSvc.configurations).toHaveLength(1);
      
      const nginxConfig = JSON.parse(nginxStackSvc.configurations[0].environmentVariables);
      expect(nginxConfig.NGINX_HOST).toBe('localhost');
      
      // Verify PostgreSQL service
      const postgresStackSvc = completeStack!.stackServices[1];
      expect(postgresStackSvc.service.name).toBe('PostgreSQL');
      expect(postgresStackSvc.configurations).toHaveLength(1);
      
      const postgresConfig = JSON.parse(postgresStackSvc.configurations[0].environmentVariables);
      expect(postgresConfig.POSTGRES_DB).toBe('webapp');
    });
  });
});