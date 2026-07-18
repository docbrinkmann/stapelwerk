# Testing Infrastructure

This directory contains comprehensive testing infrastructure for the Build My Stack recommendation system, including mock data generators, API services, test scenarios, and utility functions.

## Overview

The testing infrastructure is designed to support:

- **Integration Testing**: End-to-end user flows and system interactions
- **Performance Testing**: Load testing and performance measurement
- **Accessibility Testing**: WCAG compliance and screen reader support
- **Error Handling**: Network failures and edge cases
- **A/B Testing**: Algorithm variants and UI layouts

## Directory Structure

```
src/tests/
├── index.ts                    # Main exports and quick setup
├── README.md                   # This documentation
├── integration/
│   └── recommendation-flows.test.ts   # Integration test suite
├── mocks/
│   ├── data-generators.ts      # Mock data generation utilities
│   └── api-service.ts          # Mock API service with realistic behavior
├── fixtures/
│   └── test-scenarios.ts       # Predefined test scenarios and cases
└── utils/
    └── test-helpers.ts         # Test utilities and helper functions
```

## Quick Start

### Basic Setup

```typescript
import { quickTestSetup, TestAssertions } from '../tests';

// Setup test environment with a specific scenario
const env = await quickTestSetup('Web Development Stack');

// Use the mock API
const response = await env.apiService.getRecommendations('stack-id');
TestAssertions.assertValidApiResponse(response);

// Cleanup when done
await TestDataHelpers.cleanupTestEnvironment(env);
```

### Using Mock Data Generators

```typescript
import { 
  createMockStack, 
  createMockRecommendations, 
  createMockServices 
} from '../tests';

// Create a mock stack with services
const stack = createMockStack({
  name: 'My Test Stack',
  services: createMockServices([
    { name: 'nginx' },
    { name: 'nodejs' },
    { name: 'postgresql' }
  ]),
  status: 'deployed'
});

// Create mock recommendations
const recommendations = createMockRecommendations([
  {
    id: 'rec-1',
    title: 'Redis Cache',
    confidence: 0.85,
    type: 'service'
  }
]);
```

## Test Scenarios

### Available Scenarios

1. **Web Development Stack**: Tests typical web app recommendations
2. **Microservices Architecture**: Tests complex multi-service setups
3. **Beginner Blog Setup**: Tests simple recommendations for beginners
4. **Data Science Workflow**: Tests data processing and ML recommendations

### Using Scenarios

```typescript
import { webDevStackScenario, TestDataHelpers } from '../tests';

describe('Web Development Recommendations', () => {
  let env;

  beforeEach(async () => {
    env = await TestDataHelpers.setupTestEnvironment(webDevStackScenario);
  });

  afterEach(async () => {
    await TestDataHelpers.cleanupTestEnvironment(env);
  });

  test('should provide database recommendations', async () => {
    const response = await env.apiService.getRecommendations('web-stack-test');
    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(2); // Database and cache recommendations
  });
});
```

## Mock API Service

The `MockApiService` simulates realistic API behavior including:

- Configurable latency and failure rates
- Progressive deployment status
- Realistic error responses
- Analytics recording

### Configuration

```typescript
import { mockApi } from '../tests';

// Configure for testing
mockApi.configure({
  latency: 100,        // Response delay in ms
  failureRate: 0.05,   // 5% failure rate
  offline: false       // Online/offline mode
});

// Add custom test data
mockApi.addTestData({
  stacks: [customStack],
  templates: [customTemplate]
});
```

## Testing Utilities

### Assertions

```typescript
import { TestAssertions } from '../tests';

// Validate data structures
TestAssertions.assertValidRecommendation(recommendation);
TestAssertions.assertValidStack(stack);
TestAssertions.assertValidApiResponse(response);

// Validate analytics
TestAssertions.assertAnalyticsRecorded(events, 'recommendation_clicked', 2);

// Validate deployment progress
TestAssertions.assertDeploymentProgress(status);
```

### Performance Testing

```typescript
import { PerformanceTestHelpers } from '../tests';

// Measure single operation
const { result, duration } = await PerformanceTestHelpers.measureResponseTime(
  () => api.getRecommendations('stack-id')
);

// Run concurrent operations
const operations = Array(50).fill(() => api.getRecommendations('stack-id'));
const results = await PerformanceTestHelpers.runConcurrentOperations(operations, 10);

// Generate performance report
const report = PerformanceTestHelpers.generatePerformanceReport(results);
console.log(`Average response time: ${report.averageResponseTime}ms`);
```

### UI Testing

```typescript
import { UITestHelpers } from '../tests';

// Wait for elements
const button = await UITestHelpers.waitForElement('[data-testid="apply-button"]');

// Simulate user interactions
await UITestHelpers.simulateClick(button);
await UITestHelpers.simulateInput(input, 'test value');

// Check element states
expect(UITestHelpers.isVisible(modal)).toBe(true);
expect(UITestHelpers.hasTextContent(message, 'Success')).toBe(true);
```

### Accessibility Testing

```typescript
import { AccessibilityTestHelpers } from '../tests';

// Check ARIA attributes
const isAccessible = AccessibilityTestHelpers.checkAriaAttributes(element, {
  label: 'Apply recommendation',
  expanded: 'false'
});

// Check keyboard navigation
expect(AccessibilityTestHelpers.isKeyboardAccessible(button)).toBe(true);

// Simulate screen reader navigation
const visited = await AccessibilityTestHelpers.simulateScreenReaderNavigation(
  container,
  [{ key: 'Tab' }, { key: 'Enter' }, { key: 'Escape' }]
);
```

## Integration Testing

### Example Test Flow

```typescript
describe('Complete Recommendation Flow', () => {
  test('user can view and apply recommendations', async () => {
    const env = await quickTestSetup('Web Development Stack');
    
    // 1. Create a stack
    const stackResponse = await env.apiService.createStack({
      name: 'My New Project',
      description: 'A web application'
    });
    
    const stackId = stackResponse.data.id;
    
    // 2. Get recommendations
    const recResponse = await env.apiService.getRecommendations(stackId);
    expect(recResponse.data).toHaveLength(2);
    
    // 3. Apply first recommendation
    const firstRec = recResponse.data[0];
    const applyResponse = await env.apiService.applyTemplate(stackId, firstRec.id);
    expect(applyResponse.success).toBe(true);
    
    // 4. Verify stack was updated
    const updatedStack = await env.apiService.getStack(stackId);
    expect(updatedStack.data.services.length).toBeGreaterThan(0);
    
    // 5. Record analytics
    await env.apiService.recordInteraction({
      type: 'recommendation_applied',
      targetId: firstRec.id
    });
    
    await TestDataHelpers.cleanupTestEnvironment(env);
  });
});
```

### Error Handling Tests

```typescript
describe('Error Handling', () => {
  test('handles network failures gracefully', async () => {
    const env = await quickTestSetup();
    
    // Simulate network failure
    env.apiService.configure({ offline: true });
    
    const response = await env.apiService.getRecommendations('stack-id');
    expect(response.success).toBe(false);
    expect(response.error.message).toBe('Network unavailable');
    
    await TestDataHelpers.cleanupTestEnvironment(env);
  });
});
```

## User Journey Testing

Complex user workflows can be tested using predefined journey steps:

```typescript
import { userJourneyTests } from '../tests';

describe('User Journeys', () => {
  test('complete stack creation journey', async () => {
    const env = await quickTestSetup();
    const journey = userJourneyTests.completeStackCreation;
    
    // Execute journey steps
    for (const step of journey.steps) {
      switch (step.action) {
        case 'createStack':
          const stackResponse = await env.apiService.createStack(step.data);
          expect(stackResponse.success).toBe(true);
          break;
        
        case 'getRecommendations':
          const recResponse = await env.apiService.getRecommendations(stackId);
          expect(recResponse.data.length).toBe(step.expectedCount);
          break;
        
        // ... handle other steps
      }
    }
    
    await TestDataHelpers.cleanupTestEnvironment(env);
  });
});
```

## Performance Testing

### Load Testing

```typescript
describe('Performance', () => {
  test('handles high concurrent load', async () => {
    const env = await quickTestSetup();
    
    // Create 100 concurrent recommendation requests
    const operations = Array(100).fill(() => 
      env.apiService.getRecommendations('stack-id')
    );
    
    const results = await PerformanceTestHelpers.runConcurrentOperations(
      operations, 
      10 // 10 concurrent at a time
    );
    
    const report = PerformanceTestHelpers.generatePerformanceReport(results);
    
    expect(report.errorRate).toBeLessThan(0.05); // Less than 5% errors
    expect(report.averageResponseTime).toBeLessThan(1000); // Under 1 second
    
    await TestDataHelpers.cleanupTestEnvironment(env);
  });
});
```

## Best Practices

1. **Always cleanup**: Use `cleanupTestEnvironment` after tests
2. **Use appropriate timeouts**: Different operations need different timeouts
3. **Test error scenarios**: Include network failures and invalid data
4. **Validate data structures**: Use assertion helpers consistently
5. **Simulate realistic conditions**: Use appropriate latency and failure rates
6. **Test accessibility**: Include keyboard navigation and screen reader tests
7. **Measure performance**: Include performance benchmarks in CI/CD

## Environment Variables

- `NODE_ENV=test`: Enables test mode
- `VERBOSE=true`: Enables verbose test logging

## Integration with Jest

The testing infrastructure works seamlessly with Jest:

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  testMatch: ['**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/tests/**/*',
  ],
};
```

This infrastructure provides comprehensive testing capabilities for all aspects of the recommendation system, from basic unit tests to complex integration scenarios and performance benchmarks.