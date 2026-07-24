/**
 * Mock API Service for Integration Tests
 * 
 * Simulates API responses and provides realistic delay/failure behavior
 * for comprehensive end-to-end testing.
 */

import {
  MockStack,
  MockRecommendation,
  MockTemplate,
  createMockStack,
  createMockRecommendations,
  createMockTemplates,
  createMockServices,
  createMockAnalyticsEvents,
  simulateApiDelay,
  simulateApiFailure,
} from './data-generators';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

export class MockApiService {
  private stacks: MockStack[] = [];
  private templates: MockTemplate[] = [];
  private isOffline: boolean = false;
  private latencyMs: number = 200;
  private failureRate: number = 0.02; // 2% failure rate

  constructor() {
    this.initializeDefaultData();
  }

  /**
   * Initialize with default test data
   */
  private initializeDefaultData(): void {
    // Create default templates
    this.templates = createMockTemplates([
      { id: 'web-stack' },
      { id: 'microservices' },
      { id: 'data-pipeline' },
      { id: 'monitoring' },
      { id: 'simple-api' },
      { id: 'cms-blog' },
      { id: 'e-commerce' },
    ]);

    // Create a few default stacks
    this.stacks = [
      createMockStack({
        id: 'stack-default',
        name: 'My Web App',
        services: createMockServices([
          { name: 'nginx' },
          { name: 'nodejs' },
          { name: 'postgresql' }
        ]),
        status: 'deployed',
      }),
      createMockStack({
        id: 'stack-development',
        name: 'Development Environment',
        services: createMockServices([
          { name: 'nodejs' },
          { name: 'redis' },
        ]),
        status: 'draft',
      }),
    ];
  }

  /**
   * Configure API behavior for testing
   */
  configure(options: {
    offline?: boolean;
    latency?: number;
    failureRate?: number;
  }): void {
    if (options.offline !== undefined) this.isOffline = options.offline;
    if (options.latency !== undefined) this.latencyMs = options.latency;
    if (options.failureRate !== undefined) this.failureRate = options.failureRate;
  }

  /**
   * Simulate network conditions
   */
  private async simulateNetworkConditions(): Promise<void> {
    if (this.isOffline) {
      throw new Error('Network unavailable');
    }

    await simulateApiDelay(this.latencyMs * 0.5, this.latencyMs * 1.5);

    if (simulateApiFailure(this.failureRate)) {
      throw new Error('Internal server error');
    }
  }

  /**
   * Get all stacks
   */
  async getStacks(): Promise<ApiResponse<MockStack[]>> {
    try {
      await this.simulateNetworkConditions();
      
      return {
        data: this.stacks,
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'STACKS_FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch stacks',
        },
        success: false,
      };
    }
  }

  /**
   * Get stack by ID
   */
  async getStack(id: string): Promise<ApiResponse<MockStack>> {
    try {
      await this.simulateNetworkConditions();
      
      const stack = this.stacks.find(s => s.id === id);
      if (!stack) {
        return {
          error: {
            code: 'STACK_NOT_FOUND',
            message: `Stack with ID ${id} not found`,
          },
          success: false,
        };
      }

      return {
        data: stack,
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'STACK_FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch stack',
        },
        success: false,
      };
    }
  }

  /**
   * Create a new stack
   */
  async createStack(stackData: Partial<MockStack>): Promise<ApiResponse<MockStack>> {
    try {
      await this.simulateNetworkConditions();
      
      const newStack = createMockStack({
        ...stackData,
        status: 'draft',
      });

      this.stacks.push(newStack);

      return {
        data: newStack,
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'STACK_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create stack',
        },
        success: false,
      };
    }
  }

  /**
   * Update an existing stack
   */
  async updateStack(id: string, updates: Partial<MockStack>): Promise<ApiResponse<MockStack>> {
    try {
      await this.simulateNetworkConditions();
      
      const stackIndex = this.stacks.findIndex(s => s.id === id);
      if (stackIndex === -1) {
        return {
          error: {
            code: 'STACK_NOT_FOUND',
            message: `Stack with ID ${id} not found`,
          },
          success: false,
        };
      }

      this.stacks[stackIndex] = {
        ...this.stacks[stackIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      return {
        data: this.stacks[stackIndex],
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'STACK_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update stack',
        },
        success: false,
      };
    }
  }

  /**
   * Deploy a stack
   */
  async deployStack(id: string): Promise<ApiResponse<{ deploymentId: string }>> {
    try {
      await this.simulateNetworkConditions();
      
      const stack = this.stacks.find(s => s.id === id);
      if (!stack) {
        return {
          error: {
            code: 'STACK_NOT_FOUND',
            message: `Stack with ID ${id} not found`,
          },
          success: false,
        };
      }

      // Update stack status to deploying
      await this.updateStack(id, { status: 'deploying' });

      // Simulate deployment process
      const deploymentId = `deploy-${Date.now()}`;
      
      // Simulate deployment completion after a delay
      setTimeout(async () => {
        await this.updateStack(id, { status: 'deployed' });
      }, 3000);

      return {
        data: { deploymentId },
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'DEPLOYMENT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to deploy stack',
        },
        success: false,
      };
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<ApiResponse<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    logs: Array<{ timestamp: string; message: string; level: string }>;
  }>> {
    try {
      await this.simulateNetworkConditions();

      // Simulate progressive deployment status
      const startTime = parseInt(deploymentId.split('-')[1]);
      const elapsed = Date.now() - startTime;
      
      let status: 'pending' | 'running' | 'completed' | 'failed';
      let progress: number;

      if (elapsed < 1000) {
        status = 'pending';
        progress = 0;
      } else if (elapsed < 3000) {
        status = 'running';
        progress = Math.min(90, (elapsed - 1000) / 2000 * 90);
      } else {
        status = 'completed';
        progress = 100;
      }

      const logs = [
        { timestamp: new Date(startTime).toISOString(), message: 'Deployment started', level: 'info' },
        { timestamp: new Date(startTime + 500).toISOString(), message: 'Validating configuration', level: 'info' },
        { timestamp: new Date(startTime + 1000).toISOString(), message: 'Pulling container images', level: 'info' },
      ];

      if (elapsed > 2000) {
        logs.push({ timestamp: new Date(startTime + 2000).toISOString(), message: 'Starting services', level: 'info' });
      }

      if (status === 'completed') {
        logs.push({ timestamp: new Date(startTime + 3000).toISOString(), message: 'Deployment completed successfully', level: 'success' });
      }

      return {
        data: { status, progress, logs },
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'DEPLOYMENT_STATUS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get deployment status',
        },
        success: false,
      };
    }
  }

  /**
   * Get recommendations for a stack
   */
  async getRecommendations(stackId: string, options?: {
    type?: 'template' | 'service' | 'optimization';
    category?: string;
    limit?: number;
  }): Promise<ApiResponse<MockRecommendation[]>> {
    try {
      await this.simulateNetworkConditions();
      
      const stack = this.stacks.find(s => s.id === stackId);
      if (!stack) {
        return {
          error: {
            code: 'STACK_NOT_FOUND',
            message: `Stack with ID ${stackId} not found`,
          },
          success: false,
        };
      }

      // Generate recommendations based on current stack services
      const currentServiceNames = stack.services.map(s => s.name.toLowerCase());
      const recommendations = createMockRecommendations([
        {
          id: 'rec-cache',
          title: 'Redis Cache',
          description: 'Add Redis caching to improve performance',
          confidence: 0.85,
          type: 'service',
          category: 'Performance',
          services: ['redis'],
          reasoning: 'Caching can significantly improve response times',
        },
        {
          id: 'rec-monitoring',
          title: 'Monitoring Stack',
          description: 'Add comprehensive monitoring with Prometheus and Grafana',
          confidence: 0.78,
          type: 'template',
          category: 'DevOps',
          services: ['prometheus', 'grafana'],
          reasoning: 'Monitoring is essential for production applications',
        },
        {
          id: 'rec-security',
          title: 'Security Headers',
          description: 'Configure security headers in your web server',
          confidence: 0.92,
          type: 'optimization',
          category: 'Security',
          reasoning: 'Security headers protect against common vulnerabilities',
        },
      ]);

      // Filter based on options
      let filteredRecs = recommendations;
      if (options?.type) {
        filteredRecs = filteredRecs.filter(rec => rec.type === options.type);
      }
      if (options?.category) {
        filteredRecs = filteredRecs.filter(rec => rec.category === options.category);
      }
      if (options?.limit) {
        filteredRecs = filteredRecs.slice(0, options.limit);
      }

      return {
        data: filteredRecs,
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'RECOMMENDATIONS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get recommendations',
        },
        success: false,
      };
    }
  }

  /**
   * Get available templates
   */
  async getTemplates(options?: {
    category?: string;
    search?: string;
    limit?: number;
  }): Promise<ApiResponse<MockTemplate[]>> {
    try {
      await this.simulateNetworkConditions();
      
      let filteredTemplates = [...this.templates];

      if (options?.category) {
        filteredTemplates = filteredTemplates.filter(t => 
          t.category.toLowerCase().includes(options.category!.toLowerCase())
        );
      }

      if (options?.search) {
        const searchTerm = options.search.toLowerCase();
        filteredTemplates = filteredTemplates.filter(t =>
          t.name.toLowerCase().includes(searchTerm) ||
          t.description.toLowerCase().includes(searchTerm) ||
          t.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      if (options?.limit) {
        filteredTemplates = filteredTemplates.slice(0, options.limit);
      }

      // Sort by popularity
      filteredTemplates.sort((a, b) => b.popularity - a.popularity);

      return {
        data: filteredTemplates,
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'TEMPLATES_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get templates',
        },
        success: false,
      };
    }
  }

  /**
   * Apply a template to a stack
   */
  async applyTemplate(stackId: string, templateId: string): Promise<ApiResponse<MockStack>> {
    try {
      await this.simulateNetworkConditions();
      
      const stack = this.stacks.find(s => s.id === stackId);
      if (!stack) {
        return {
          error: {
            code: 'STACK_NOT_FOUND',
            message: `Stack with ID ${stackId} not found`,
          },
          success: false,
        };
      }

      const template = this.templates.find(t => t.id === templateId);
      if (!template) {
        return {
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: `Template with ID ${templateId} not found`,
          },
          success: false,
        };
      }

      // Apply template services to stack
      const templateServices = createMockServices(
        template.services.map(serviceName => ({ name: serviceName }))
      );

      const updatedStack = await this.updateStack(stackId, {
        services: [...stack.services, ...templateServices],
        description: `${stack.description || ''} (Applied: ${template.name})`.trim(),
      });

      return updatedStack;
    } catch (error) {
      return {
        error: {
          code: 'TEMPLATE_APPLY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to apply template',
        },
        success: false,
      };
    }
  }

  /**
   * Record user interaction for analytics
   */
  async recordInteraction(interaction: {
    type: string;
    targetId?: string;
    metadata?: Record<string, any>;
  }): Promise<ApiResponse<{ recorded: boolean }>> {
    try {
      await this.simulateNetworkConditions();
      
      // In a real system, this would record to analytics
      console.log('Analytics interaction recorded:', interaction);

      return {
        data: { recorded: true },
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to record interaction',
        },
        success: false,
      };
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(stackId: string, timeRange?: string): Promise<ApiResponse<{
    totalRecommendations: number;
    clickThroughRate: number;
    conversionRate: number;
    topCategories: Array<{ category: string; count: number }>;
  }>> {
    try {
      await this.simulateNetworkConditions();
      
      // Generate mock analytics data
      const summary = {
        totalRecommendations: Math.floor(Math.random() * 100) + 50,
        clickThroughRate: Math.random() * 0.3 + 0.1, // 10-40%
        conversionRate: Math.random() * 0.2 + 0.05, // 5-25%
        topCategories: [
          { category: 'Performance', count: 15 },
          { category: 'Security', count: 12 },
          { category: 'DevOps', count: 8 },
          { category: 'Database', count: 6 },
        ],
      };

      return {
        data: summary,
        success: true,
      };
    } catch (error) {
      return {
        error: {
          code: 'ANALYTICS_SUMMARY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get analytics summary',
        },
        success: false,
      };
    }
  }

  /**
   * Reset API to initial state (useful for tests)
   */
  reset(): void {
    this.stacks = [];
    this.templates = [];
    this.isOffline = false;
    this.latencyMs = 200;
    this.failureRate = 0.02;
    this.initializeDefaultData();
  }

  /**
   * Add custom test data
   */
  addTestData(data: {
    stacks?: MockStack[];
    templates?: MockTemplate[];
  }): void {
    if (data.stacks) {
      this.stacks.push(...data.stacks);
    }
    if (data.templates) {
      this.templates.push(...data.templates);
    }
  }
}

// Export singleton instance for tests
export const mockApi = new MockApiService();