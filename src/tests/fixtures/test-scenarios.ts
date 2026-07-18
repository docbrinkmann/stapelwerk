/**
 * Test Fixtures and Scenarios
 * 
 * Provides predefined test scenarios and setups for consistent
 * testing across different components and integration flows.
 */

import {
  MockStack,
  MockRecommendation,
  MockTemplate,
  createMockStack,
  createMockRecommendations,
  createMockTemplates,
  createMockServices,
  createMockUserScenarios,
  createRecommendationScenarios,
  createMockABTestScenarios,
} from '../mocks/data-generators';

export interface TestScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
  cleanup: () => Promise<void>;
  data: {
    stacks?: MockStack[];
    recommendations?: MockRecommendation[];
    templates?: MockTemplate[];
    user?: any;
  };
}

/**
 * Web Development Stack Scenario
 * Tests recommendations for a typical web development workflow
 */
export const webDevStackScenario: TestScenario = {
  name: 'Web Development Stack',
  description: 'Tests recommendation flow for web development with React, Node.js, and database',
  setup: async () => {
    // Setup will be handled by test framework
  },
  cleanup: async () => {
    // Cleanup will be handled by test framework
  },
  data: {
    stacks: [
      createMockStack({
        id: 'web-stack-test',
        name: 'React Web App',
        description: 'Modern web application with React frontend',
        services: createMockServices([
          { name: 'nginx' },
          { name: 'nodejs' },
        ]),
        status: 'draft',
      }),
    ],
    templates: createMockTemplates([
      { id: 'web-stack' },
      { id: 'microservices' },
    ]),
    recommendations: createMockRecommendations([
      {
        id: 'rec-database',
        title: 'PostgreSQL Database',
        description: 'Add PostgreSQL for data persistence',
        confidence: 0.92,
        type: 'service',
        category: 'Database',
        services: ['postgresql'],
        reasoning: 'Web applications typically need a reliable database',
      },
      {
        id: 'rec-cache',
        title: 'Redis Caching',
        description: 'Add Redis for session storage and caching',
        confidence: 0.78,
        type: 'service',
        category: 'Performance',
        services: ['redis'],
        reasoning: 'Caching improves application performance',
      },
    ]),
    user: createMockUserScenarios().webDeveloper,
  },
};

/**
 * Microservices Architecture Scenario
 * Tests complex multi-service recommendations and monitoring
 */
export const microservicesScenario: TestScenario = {
  name: 'Microservices Architecture',
  description: 'Tests recommendations for microservices with monitoring and service discovery',
  setup: async () => {},
  cleanup: async () => {},
  data: {
    stacks: [
      createMockStack({
        id: 'microservices-test',
        name: 'E-commerce Platform',
        description: 'Scalable e-commerce platform with microservices',
        services: createMockServices([
          { name: 'nginx' },
          { name: 'nodejs' },
          { name: 'postgresql' },
          { name: 'redis' },
        ]),
        status: 'deployed',
      }),
    ],
    templates: createMockTemplates([
      { id: 'monitoring' },
      { id: 'microservices' },
    ]),
    recommendations: createMockRecommendations([
      {
        id: 'rec-monitoring',
        title: 'Monitoring Stack',
        description: 'Add Prometheus and Grafana for comprehensive monitoring',
        confidence: 0.95,
        type: 'template',
        category: 'DevOps',
        services: ['prometheus', 'grafana'],
        reasoning: 'Microservices require extensive monitoring for observability',
      },
      {
        id: 'rec-load-balancer',
        title: 'Load Balancing',
        description: 'Configure nginx for load balancing between services',
        confidence: 0.87,
        type: 'optimization',
        category: 'Scalability',
        reasoning: 'Load balancing distributes traffic across service instances',
      },
    ]),
    user: createMockUserScenarios().devops,
  },
};

/**
 * Beginner Blog Scenario
 * Tests simple recommendations for non-technical users
 */
export const beginnerBlogScenario: TestScenario = {
  name: 'Beginner Blog Setup',
  description: 'Tests simple recommendations for content creators and beginners',
  setup: async () => {},
  cleanup: async () => {},
  data: {
    stacks: [
      createMockStack({
        id: 'blog-test',
        name: 'Personal Blog',
        description: 'Simple blog for content creation',
        services: [],
        status: 'draft',
      }),
    ],
    templates: createMockTemplates([
      {
        id: 'cms-blog',
        name: 'Blog Template',
        description: 'Complete blog setup with WordPress and MySQL',
        category: 'Content Management',
        services: ['wordpress', 'mysql'],
        popularity: 0.88,
        tags: ['blog', 'cms', 'beginner'],
      },
    ]),
    recommendations: createMockRecommendations([
      {
        id: 'rec-blog-template',
        title: 'Blog Template',
        description: 'Complete blog setup with content management',
        confidence: 0.98,
        type: 'template',
        category: 'Content Management',
        services: ['wordpress', 'mysql'],
        reasoning: 'Perfect template for creating blogs quickly',
      },
    ]),
    user: createMockUserScenarios().beginner,
  },
};

/**
 * Data Science Scenario
 * Tests recommendations for data processing and analysis workflows
 */
export const dataScienceScenario: TestScenario = {
  name: 'Data Science Workflow',
  description: 'Tests recommendations for data analysis and machine learning projects',
  setup: async () => {},
  cleanup: async () => {},
  data: {
    stacks: [
      createMockStack({
        id: 'data-science-test',
        name: 'ML Research Project',
        description: 'Machine learning research and experimentation',
        services: createMockServices([
          { name: 'jupyter', category: 'Development', image: 'jupyter/scipy-notebook' },
          { name: 'postgresql' },
        ]),
        status: 'draft',
      }),
    ],
    templates: createMockTemplates([
      { id: 'data-pipeline' },
    ]),
    recommendations: createMockRecommendations([
      {
        id: 'rec-mongodb',
        title: 'MongoDB for Document Storage',
        description: 'Add MongoDB for flexible document storage',
        confidence: 0.75,
        type: 'service',
        category: 'Database',
        services: ['mongodb'],
        reasoning: 'Document databases work well with varied data structures',
      },
      {
        id: 'rec-data-pipeline',
        title: 'Data Processing Pipeline',
        description: 'Set up ETL pipeline for data processing',
        confidence: 0.82,
        type: 'template',
        category: 'Data Engineering',
        services: ['kafka', 'spark'],
        reasoning: 'Data science projects often need robust data pipelines',
      },
    ]),
    user: createMockUserScenarios().datascientist,
  },
};

/**
 * Error and Edge Case Scenarios
 * Tests error handling and edge cases
 */
export const errorScenarios = {
  emptyStack: {
    name: 'Empty Stack',
    stack: createMockStack({
      id: 'empty-test',
      name: 'Empty Stack',
      services: [],
      status: 'draft',
    }),
    expectedRecommendations: 'template-based', // Should recommend templates
  },
  
  fullStack: {
    name: 'Comprehensive Stack',
    stack: createMockStack({
      id: 'full-test',
      name: 'Full-Featured Stack',
      services: createMockServices([
        { name: 'nginx' },
        { name: 'nodejs' },
        { name: 'postgresql' },
        { name: 'redis' },
        { name: 'prometheus' },
        { name: 'grafana' },
      ]),
      status: 'deployed',
    }),
    expectedRecommendations: 'optimizations', // Should recommend optimizations
  },
  
  invalidStack: {
    name: 'Invalid Stack Configuration',
    stack: createMockStack({
      id: 'invalid-test',
      name: '',
      // @ts-expect-error -- Intentionally invalid for testing
      services: null,
      status: 'failed',
    }),
    expectedError: 'INVALID_STACK_CONFIG',
  },
};

/**
 * Performance Test Scenarios
 * Tests system behavior under various load conditions
 */
export const performanceScenarios = {
  highLoad: {
    name: 'High Load Test',
    description: 'Tests system behavior with many concurrent requests',
    setup: {
      concurrentUsers: 100,
      requestsPerSecond: 50,
      duration: '30s',
    },
    expectedMetrics: {
      maxResponseTime: 2000, // 2 seconds
      errorRate: 0.05, // 5%
      throughput: 45, // requests per second
    },
  },
  
  largeDataset: {
    name: 'Large Dataset Test',
    description: 'Tests recommendations with large numbers of templates and services',
    data: {
      templatesCount: 1000,
      servicesPerStack: 50,
      stacksCount: 100,
    },
    expectedMetrics: {
      recommendationTime: 500, // milliseconds
      memoryUsage: '256MB',
    },
  },
};

/**
 * A/B Testing Scenarios
 * Tests different algorithm variants and UI layouts
 */
export const abTestScenarios = createMockABTestScenarios();

/**
 * User Journey Test Cases
 * End-to-end user workflows for testing complete features
 */
export const userJourneyTests = {
  completeStackCreation: {
    name: 'Complete Stack Creation Journey',
    steps: [
      { action: 'createStack', data: { name: 'My New Project' } },
      { action: 'getRecommendations', expectedCount: 3 },
      { action: 'viewRecommendation', target: 'first' },
      { action: 'applyRecommendation', target: 'first' },
      { action: 'deployStack', expectedStatus: 'deploying' },
      { action: 'waitForDeployment', timeout: 5000 },
      { action: 'verifyDeployment', expectedStatus: 'deployed' },
    ],
    expectedOutcome: {
      stackStatus: 'deployed',
      servicesAdded: 1,
      analyticsEvents: 4,
    },
  },
  
  templateExploration: {
    name: 'Template Exploration and Application',
    steps: [
      { action: 'browseMockJourneyTemplates', filters: { category: 'Web Development' } },
      { action: 'searchTemplates', query: 'web' },
      { action: 'viewTemplate', target: 'web-stack' },
      { action: 'previewTemplate', expectedServices: ['nginx', 'nodejs', 'postgresql'] },
      { action: 'applyTemplate', targetStack: 'existing' },
      { action: 'customizeServices', modifications: ['add-redis', 'remove-nginx'] },
    ],
    expectedOutcome: {
      appliedTemplate: true,
      servicesModified: 2,
      userSatisfaction: 'high',
    },
  },
  
  errorRecovery: {
    name: 'Error Handling and Recovery',
    steps: [
      { action: 'attemptCreateStack', data: { name: '' }, expectedError: true },
      { action: 'showErrorMessage', expectedMessage: 'Stack name is required' },
      { action: 'retryWithValidData', data: { name: 'Valid Stack Name' } },
      { action: 'simulateNetworkError', during: 'getRecommendations' },
      { action: 'showOfflineIndicator', expectedVisible: true },
      { action: 'retryWhenOnline', expectedSuccess: true },
    ],
    expectedOutcome: {
      finalStackCreated: true,
      errorHandlingWorked: true,
      userRetainedInFlow: true,
    },
  },
};

/**
 * Accessibility Test Scenarios
 * Tests for screen readers, keyboard navigation, and WCAG compliance
 */
export const accessibilityScenarios = {
  screenReader: {
    name: 'Screen Reader Navigation',
    requirements: [
      'All interactive elements have accessible names',
      'Content hierarchy is properly structured with headings',
      'Form inputs have associated labels',
      'Status updates are announced to screen readers',
      'Complex UI has ARIA landmarks and descriptions',
    ],
    testCases: [
      { element: 'recommendation-list', expectedRole: 'list' },
      { element: 'recommendation-item', expectedRole: 'listitem' },
      { element: 'apply-button', expectedLabel: 'Apply recommendation: {name}' },
      { element: 'deployment-status', expectedLive: 'polite' },
    ],
  },
  
  keyboardNavigation: {
    name: 'Keyboard-Only Navigation',
    requirements: [
      'All interactive elements are keyboard accessible',
      'Tab order follows logical flow',
      'Keyboard shortcuts are available for common actions',
      'Focus indicators are visible and clear',
      'No keyboard traps exist',
    ],
    testSequence: [
      { key: 'Tab', expectedFocus: 'first-recommendation' },
      { key: 'Enter', expectedAction: 'open-recommendation-details' },
      { key: 'Escape', expectedAction: 'close-modal' },
      { key: 'Space', expectedAction: 'toggle-selection' },
    ],
  },
  
  visualAccessibility: {
    name: 'Visual Accessibility',
    requirements: [
      'Color contrast meets WCAG AA standards (4.5:1)',
      'Information not conveyed by color alone',
      'Text can be resized to 200% without horizontal scrolling',
      'Focus indicators have sufficient contrast',
      'UI works with high contrast mode',
    ],
    testCases: [
      { element: 'recommendation-confidence', contrastRatio: 4.5 },
      { element: 'success-indicator', alternativeText: true },
      { element: 'error-message', iconAndText: true },
    ],
  },
};

/**
 * Utility function to get scenario by name
 */
export function getScenario(name: string): TestScenario | undefined {
  const scenarios = [
    webDevStackScenario,
    microservicesScenario,
    beginnerBlogScenario,
    dataScienceScenario,
  ];
  
  return scenarios.find(scenario => scenario.name === name);
}

/**
 * Utility function to get all scenarios
 */
export function getAllScenarios(): TestScenario[] {
  return [
    webDevStackScenario,
    microservicesScenario,
    beginnerBlogScenario,
    dataScienceScenario,
  ];
}

/**
 * Generate random test scenario based on user type
 */
export function generateRandomScenario(userType: 'beginner' | 'intermediate' | 'expert'): TestScenario {
  const scenarios = {
    beginner: [beginnerBlogScenario],
    intermediate: [webDevStackScenario],
    expert: [microservicesScenario, dataScienceScenario],
  };
  
  const availableScenarios = scenarios[userType];
  return availableScenarios[Math.floor(Math.random() * availableScenarios.length)];
}