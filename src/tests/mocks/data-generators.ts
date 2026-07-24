/**
 * Mock Data Generators for Tests
 * 
 * Provides realistic mock data for testing recommendation flows,
 * stack management, and template application scenarios.
 */

export interface MockStack {
  id: string;
  name: string;
  description?: string;
  services: MockService[];
  status: 'draft' | 'deploying' | 'deployed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface MockService {
  id: string;
  name: string;
  category: string;
  image: string;
  ports?: number[];
  environment?: Record<string, string>;
  volumes?: string[];
}

export interface MockRecommendation {
  id: string;
  type: 'template' | 'service' | 'optimization';
  title: string;
  description: string;
  confidence: number;
  category: string;
  services?: string[];
  reasoning?: string;
  metadata?: Record<string, any>;
}

export interface MockTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  services: string[];
  popularity: number;
  author?: string;
  tags?: string[];
  configuration?: Record<string, any>;
}

/**
 * Create a mock stack with realistic data
 */
export function createMockStack(overrides: Partial<MockStack> = {}): MockStack {
  return {
    id: `stack-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Stack',
    description: 'A test stack for development',
    services: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock services with realistic configurations
 */
export function createMockServices(services: Array<Partial<MockService> & { name: string }>): MockService[] {
  const serviceDefaults: Record<string, Partial<MockService>> = {
    nginx: {
      category: 'Web Server',
      image: 'nginx:alpine',
      ports: [80, 443],
      volumes: ['/etc/nginx/nginx.conf'],
    },
    nodejs: {
      category: 'Runtime',
      image: 'node:18-alpine',
      ports: [3000],
      environment: { NODE_ENV: 'production' },
    },
    postgresql: {
      category: 'Database',
      image: 'postgres:15',
      ports: [5432],
      environment: { 
        POSTGRES_DB: 'myapp',
        POSTGRES_USER: 'admin',
        POSTGRES_PASSWORD: 'password'
      },
      volumes: ['/var/lib/postgresql/data'],
    },
    redis: {
      category: 'Cache',
      image: 'redis:alpine',
      ports: [6379],
      volumes: ['/data'],
    },
    mongodb: {
      category: 'Database',
      image: 'mongo:6',
      ports: [27017],
      volumes: ['/data/db'],
    },
    prometheus: {
      category: 'Monitoring',
      image: 'prom/prometheus',
      ports: [9090],
      volumes: ['/etc/prometheus', '/prometheus'],
    },
    grafana: {
      category: 'Monitoring',
      image: 'grafana/grafana',
      ports: [3000],
      environment: { GF_SECURITY_ADMIN_PASSWORD: 'admin' },
      volumes: ['/var/lib/grafana'],
    },
  };

  return services.map(service => ({
    id: `service-${Math.random().toString(36).substr(2, 9)}`,
    ...serviceDefaults[service.name] || {},
    ...service,
  })) as MockService[];
}

/**
 * Create mock recommendations with realistic data
 */
export function createMockRecommendations(recommendations: Array<Partial<MockRecommendation> & { id: string }>): MockRecommendation[] {
  return recommendations.map(rec => ({
    type: 'template',
    title: `Recommendation ${rec.id}`,
    description: `A helpful recommendation for your stack`,
    confidence: Math.random() * 0.4 + 0.6, // 0.6 - 1.0
    category: 'General',
    services: [],
    reasoning: 'Based on common patterns and best practices',
    metadata: {},
    ...rec,
  }));
}

/**
 * Create mock templates with realistic configurations
 */
export function createMockTemplates(templates: Array<Partial<MockTemplate> & { id: string }>): MockTemplate[] {
  const templateDefaults: Record<string, Partial<MockTemplate>> = {
    'web-stack': {
      name: 'Modern Web Stack',
      description: 'Complete web development environment with React, Node.js, and PostgreSQL',
      category: 'Web Development',
      services: ['nginx', 'nodejs', 'postgresql', 'redis'],
      popularity: 0.92,
      tags: ['web', 'fullstack', 'database'],
    },
    'microservices': {
      name: 'Microservices Architecture',
      description: 'Scalable microservices setup with service discovery and monitoring',
      category: 'Architecture',
      services: ['nginx', 'nodejs', 'postgresql', 'redis', 'prometheus', 'grafana'],
      popularity: 0.85,
      tags: ['microservices', 'scalable', 'monitoring'],
    },
    'data-pipeline': {
      name: 'Data Processing Pipeline',
      description: 'ETL pipeline with Apache Kafka and PostgreSQL',
      category: 'Data Engineering',
      services: ['kafka', 'postgresql', 'redis'],
      popularity: 0.78,
      tags: ['data', 'etl', 'streaming'],
    },
    'monitoring': {
      name: 'Monitoring Stack',
      description: 'Complete monitoring solution with Prometheus and Grafana',
      category: 'DevOps',
      services: ['prometheus', 'grafana'],
      popularity: 0.89,
      tags: ['monitoring', 'metrics', 'alerting'],
    },
  };

  return templates.map(template => ({
    name: `Template ${template.id}`,
    description: 'A useful template for your project',
    category: 'General',
    services: [],
    popularity: Math.random() * 0.5 + 0.5, // 0.5 - 1.0
    author: 'Community',
    tags: [],
    configuration: {},
    ...templateDefaults[template.id] || {},
    ...template,
  }));
}

/**
 * Create realistic user interaction scenarios
 */
export function createMockUserScenarios() {
  return {
    webDeveloper: {
      interests: ['React', 'Node.js', 'PostgreSQL', 'nginx'],
      experience: 'intermediate',
      projectType: 'web-app',
      preferences: {
        complexity: 'moderate',
        scalability: 'high',
        cost: 'medium',
      },
    },
    datascientist: {
      interests: ['Python', 'Jupyter', 'PostgreSQL', 'MongoDB'],
      experience: 'advanced',
      projectType: 'data-analysis',
      preferences: {
        complexity: 'high',
        performance: 'high',
        storage: 'high',
      },
    },
    beginner: {
      interests: ['WordPress', 'MySQL'],
      experience: 'beginner',
      projectType: 'blog',
      preferences: {
        complexity: 'low',
        cost: 'low',
        ease_of_use: 'high',
      },
    },
    devops: {
      interests: ['Docker', 'Kubernetes', 'Prometheus', 'Grafana'],
      experience: 'expert',
      projectType: 'infrastructure',
      preferences: {
        monitoring: 'high',
        automation: 'high',
        scalability: 'high',
      },
    },
  };
}

/**
 * Generate realistic recommendation scoring scenarios
 */
export function createRecommendationScenarios() {
  return [
    {
      name: 'Perfect Match',
      currentServices: ['nginx'],
      recommendations: [
        {
          id: 'rec-perfect',
          title: 'Node.js Runtime',
          confidence: 0.95,
          reasoning: 'Nginx is commonly paired with Node.js for web applications',
          services: ['nodejs'],
        }
      ],
    },
    {
      name: 'Good Match',
      currentServices: ['postgresql'],
      recommendations: [
        {
          id: 'rec-good',
          title: 'Redis Cache',
          confidence: 0.82,
          reasoning: 'Redis provides excellent caching for PostgreSQL databases',
          services: ['redis'],
        }
      ],
    },
    {
      name: 'Moderate Match',
      currentServices: ['mongodb'],
      recommendations: [
        {
          id: 'rec-moderate',
          title: 'Express.js Framework',
          confidence: 0.68,
          reasoning: 'Express.js works well with MongoDB for API development',
          services: ['nodejs'],
        }
      ],
    },
    {
      name: 'Low Match',
      currentServices: ['nginx', 'postgresql', 'redis'],
      recommendations: [
        {
          id: 'rec-low',
          title: 'Elasticsearch',
          confidence: 0.45,
          reasoning: 'Could provide search capabilities for your application',
          services: ['elasticsearch'],
        }
      ],
    },
  ];
}

/**
 * Create deployment simulation data
 */
export function createMockDeploymentFlow() {
  return {
    phases: [
      { name: 'Validation', duration: 2000, status: 'completed' },
      { name: 'Image Pulling', duration: 15000, status: 'in_progress' },
      { name: 'Container Creation', duration: 5000, status: 'pending' },
      { name: 'Service Startup', duration: 8000, status: 'pending' },
      { name: 'Health Checks', duration: 3000, status: 'pending' },
      { name: 'Load Balancer Setup', duration: 2000, status: 'pending' },
    ],
    logs: [
      { timestamp: new Date(), level: 'info', message: 'Starting deployment...' },
      { timestamp: new Date(), level: 'info', message: 'Validating stack configuration' },
      { timestamp: new Date(), level: 'info', message: 'Configuration validated successfully' },
      { timestamp: new Date(), level: 'info', message: 'Pulling nginx:alpine image...' },
    ],
    services: [
      { name: 'nginx', status: 'healthy', port: 80, url: 'http://localhost:80' },
      { name: 'nodejs', status: 'starting', port: 3000, url: 'http://localhost:3000' },
      { name: 'postgresql', status: 'pending', port: 5432, url: null },
    ],
  };
}

/**
 * Create analytics event simulation data
 */
export function createMockAnalyticsEvents() {
  const eventTypes = [
    'recommendation_viewed',
    'recommendation_clicked',
    'template_applied',
    'service_added',
    'feedback_provided',
  ];

  const recommendations = [
    'rec-web-stack',
    'rec-database',
    'rec-monitoring',
    'rec-cache',
  ];

  return Array.from({ length: 100 }, (_, index) => ({
    id: `event-${index}`,
    type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
    recommendationId: recommendations[Math.floor(Math.random() * recommendations.length)],
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    userId: `user-${Math.floor(Math.random() * 50)}`,
    sessionId: `session-${Math.floor(Math.random() * 20)}`,
    data: {
      confidence: Math.random() * 0.5 + 0.5,
      position: Math.floor(Math.random() * 10),
      source: 'recommendation_engine',
    },
  }));
}

/**
 * Create A/B test scenarios
 */
export function createMockABTestScenarios() {
  return [
    {
      testId: 'test-algorithm-comparison',
      name: 'Algorithm Comparison',
      variants: [
        {
          id: 'control',
          name: 'Current Algorithm',
          config: { algorithm: 'collaborative_filtering', maxResults: 5 },
          isControl: true,
        },
        {
          id: 'ml-enhanced',
          name: 'ML Enhanced',
          config: { algorithm: 'ml_enhanced', maxResults: 5 },
          isControl: false,
        },
      ],
      metrics: {
        control: { ctr: 0.15, conversion: 0.08, satisfaction: 0.72 },
        'ml-enhanced': { ctr: 0.18, conversion: 0.11, satisfaction: 0.78 },
      },
    },
    {
      testId: 'test-ui-layout',
      name: 'UI Layout Test',
      variants: [
        {
          id: 'cards',
          name: 'Card Layout',
          config: { layout: 'cards', density: 'normal' },
          isControl: true,
        },
        {
          id: 'compact',
          name: 'Compact Layout',
          config: { layout: 'list', density: 'compact' },
          isControl: false,
        },
      ],
      metrics: {
        cards: { ctr: 0.16, conversion: 0.09, satisfaction: 0.75 },
        compact: { ctr: 0.14, conversion: 0.085, satisfaction: 0.71 },
      },
    },
  ];
}

/**
 * Create performance benchmark data
 */
export function createMockPerformanceData() {
  return {
    apiResponseTimes: {
      getRecommendations: { avg: 120, p95: 250, p99: 400 },
      getTemplates: { avg: 80, p95: 150, p99: 300 },
      applyTemplate: { avg: 800, p95: 1500, p99: 2500 },
      recordInteraction: { avg: 50, p95: 100, p99: 200 },
    },
    throughput: {
      recommendations: 1500, // requests per minute
      templateApplications: 200,
      userInteractions: 5000,
    },
    errorRates: {
      recommendations: 0.002, // 0.2%
      templates: 0.001,
      interactions: 0.0005,
    },
    cacheHitRates: {
      recommendations: 0.85,
      templates: 0.92,
      services: 0.88,
    },
  };
}

/**
 * Utility function to simulate API delays
 */
export function simulateApiDelay(min = 100, max = 500): Promise<void> {
  const delay = Math.random() * (max - min) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Utility function to simulate intermittent API failures
 */
export function simulateApiFailure(failureRate = 0.05): boolean {
  return Math.random() < failureRate;
}