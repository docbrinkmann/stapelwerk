/**
 * Testing Infrastructure Index
 * 
 * Centralized exports for all testing utilities, mocks, fixtures,
 * and helpers used throughout the application tests.
 */

// Mock Data Generators
export * from './mocks/data-generators';
export { MockApiService, mockApi } from './mocks/api-service';

// Test Scenarios and Fixtures
export * from './fixtures/test-scenarios';

// Test Utilities and Helpers
export type { TestEnvironment } from './utils/test-helpers';
export {
  TestAssertions,
  TestDataHelpers,
  PerformanceTestHelpers,
  UITestHelpers,
  AccessibilityTestHelpers,
  TestReportGenerator,
} from './utils/test-helpers';

// Integration Test Suites
// export * from './integration/recommendation-flows.test'; // Temporarily disabled

/**
 * Quick setup function for common test scenarios
 */
export async function quickTestSetup(scenarioName?: string) {
  const { TestDataHelpers } = await import('./utils/test-helpers');
  const { getScenario } = await import('./fixtures/test-scenarios');
  const scenario = scenarioName ? getScenario(scenarioName) : undefined;
  return TestDataHelpers.setupTestEnvironment(scenario);
}

/**
 * Commonly used test constants
 */
export const TEST_CONSTANTS = {
  DEFAULT_TIMEOUT: 5000,
  FAST_TIMEOUT: 1000,
  SLOW_TIMEOUT: 10000,
  DEFAULT_POLLING_INTERVAL: 100,
  API_LATENCY: 50, // Fast for tests
  DEPLOYMENT_TIMEOUT: 10000,
  USER_INTERACTION_DELAY: 100,
};

/**
 * Test environment configuration presets
 */
export const TEST_PRESETS = {
  FAST: {
    timeout: 1000,
    latency: 10,
    failureRate: 0,
    offline: false,
  },
  REALISTIC: {
    timeout: 5000,
    latency: 200,
    failureRate: 0.02,
    offline: false,
  },
  SLOW_NETWORK: {
    timeout: 10000,
    latency: 1000,
    failureRate: 0.1,
    offline: false,
  },
  OFFLINE: {
    timeout: 2000,
    latency: 0,
    failureRate: 1,
    offline: true,
  },
};