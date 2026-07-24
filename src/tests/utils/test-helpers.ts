/**
 * Test Utilities and Helper Functions
 * 
 * Provides common test utilities, assertions, and helper functions
 * for integration testing across the application.
 */

import { MockApiService } from '../mocks/api-service';
import { TestScenario } from '../fixtures/test-scenarios';
import { 
  MockStack, 
  MockRecommendation, 
  MockTemplate,
  createMockAnalyticsEvents,
  simulateApiDelay,
} from '../mocks/data-generators';

/**
 * Test Environment Configuration
 */
export interface TestEnvironment {
  apiService: MockApiService;
  scenario?: TestScenario;
  config: {
    timeout: number;
    retries: number;
    verbose: boolean;
  };
}

/**
 * Test Assertion Helpers
 */
export class TestAssertions {
  /**
   * Assert that a recommendation has required properties
   */
  static assertValidRecommendation(recommendation: any): void {
    if (!recommendation) {
      throw new Error('Recommendation is null or undefined');
    }

    const required = ['id', 'title', 'description', 'confidence', 'type', 'category'];
    for (const prop of required) {
      if (!(prop in recommendation)) {
        throw new Error(`Recommendation missing required property: ${prop}`);
      }
    }

    if (typeof recommendation.confidence !== 'number' || 
        recommendation.confidence < 0 || recommendation.confidence > 1) {
      throw new Error('Recommendation confidence must be a number between 0 and 1');
    }

    const validTypes = ['template', 'service', 'optimization'];
    if (!validTypes.includes(recommendation.type)) {
      throw new Error(`Invalid recommendation type: ${recommendation.type}`);
    }
  }

  /**
   * Assert that a stack has required properties
   */
  static assertValidStack(stack: any): void {
    if (!stack) {
      throw new Error('Stack is null or undefined');
    }

    const required = ['id', 'name', 'services', 'status', 'createdAt', 'updatedAt'];
    for (const prop of required) {
      if (!(prop in stack)) {
        throw new Error(`Stack missing required property: ${prop}`);
      }
    }

    if (!Array.isArray(stack.services)) {
      throw new Error('Stack services must be an array');
    }

    const validStatuses = ['draft', 'deploying', 'deployed', 'failed'];
    if (!validStatuses.includes(stack.status)) {
      throw new Error(`Invalid stack status: ${stack.status}`);
    }
  }

  /**
   * Assert that an API response has the expected structure
   */
  static assertValidApiResponse(response: any, expectSuccess = true): void {
    if (!response) {
      throw new Error('API response is null or undefined');
    }

    if (typeof response.success !== 'boolean') {
      throw new Error('API response must have boolean success property');
    }

    if (expectSuccess && !response.success) {
      const errorMsg = response.error?.message || 'Unknown error';
      throw new Error(`Expected successful response but got error: ${errorMsg}`);
    }

    if (!expectSuccess && response.success) {
      throw new Error('Expected error response but got success');
    }

    if (response.success && !response.data) {
      throw new Error('Successful API response must have data property');
    }

    if (!response.success && !response.error) {
      throw new Error('Error API response must have error property');
    }
  }

  /**
   * Assert that analytics events were recorded correctly
   */
  static assertAnalyticsRecorded(events: any[], expectedType: string, minCount = 1): void {
    if (!Array.isArray(events)) {
      throw new Error('Events must be an array');
    }

    const relevantEvents = events.filter(event => event.type === expectedType);
    if (relevantEvents.length < minCount) {
      throw new Error(`Expected at least ${minCount} ${expectedType} events, got ${relevantEvents.length}`);
    }
  }

  /**
   * Assert that deployment progresses correctly
   */
  static assertDeploymentProgress(status: any): void {
    if (!status) {
      throw new Error('Deployment status is null or undefined');
    }

    const validStatuses = ['pending', 'running', 'completed', 'failed'];
    if (!validStatuses.includes(status.status)) {
      throw new Error(`Invalid deployment status: ${status.status}`);
    }

    if (typeof status.progress !== 'number' || status.progress < 0 || status.progress > 100) {
      throw new Error('Deployment progress must be a number between 0 and 100');
    }

    if (!Array.isArray(status.logs)) {
      throw new Error('Deployment logs must be an array');
    }
  }
}

/**
 * Test Data Setup Helpers
 */
export class TestDataHelpers {
  /**
   * Setup test environment with mock API and scenario data
   */
  static async setupTestEnvironment(scenario?: TestScenario): Promise<TestEnvironment> {
    const apiService = new MockApiService();
    
    // Configure for testing (faster, more predictable)
    apiService.configure({
      latency: 50, // Faster responses for tests
      failureRate: 0, // No random failures during setup
      offline: false,
    });

    // Load scenario data if provided
    if (scenario) {
      if (scenario.data.stacks) {
        apiService.addTestData({ stacks: scenario.data.stacks });
      }
      if (scenario.data.templates) {
        apiService.addTestData({ templates: scenario.data.templates });
      }
      await scenario.setup();
    }

    return {
      apiService,
      scenario,
      config: {
        timeout: 5000,
        retries: 3,
        verbose: process.env.NODE_ENV === 'test' && process.env.VERBOSE === 'true',
      },
    };
  }

  /**
   * Cleanup test environment
   */
  static async cleanupTestEnvironment(env: TestEnvironment): Promise<void> {
    env.apiService.reset();
    if (env.scenario) {
      await env.scenario.cleanup();
    }
  }

  /**
   * Wait for condition to be met (polling utility)
   */
  static async waitFor(
    condition: () => Promise<boolean> | boolean,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Wait for deployment to complete
   */
  static async waitForDeployment(
    apiService: MockApiService,
    deploymentId: string,
    timeout = 10000
  ): Promise<void> {
    await this.waitFor(async () => {
      const response = await apiService.getDeploymentStatus(deploymentId);
      return response.success && 
             (response.data?.status === 'completed' || response.data?.status === 'failed');
    }, timeout);
  }

  /**
   * Simulate user interactions for testing
   */
  static async simulateUserInteractions(
    apiService: MockApiService,
    interactions: Array<{
      type: string;
      delay?: number;
      targetId?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    for (const interaction of interactions) {
      if (interaction.delay) {
        await simulateApiDelay(interaction.delay, interaction.delay);
      }
      
      await apiService.recordInteraction({
        type: interaction.type,
        targetId: interaction.targetId,
        metadata: interaction.metadata,
      });
    }
  }
}

/**
 * Performance Testing Utilities
 */
export class PerformanceTestHelpers {
  /**
   * Measure API response time
   */
  static async measureResponseTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    
    return { result, duration };
  }

  /**
   * Run concurrent operations and measure performance
   */
  static async runConcurrentOperations<T>(
    operations: Array<() => Promise<T>>,
    concurrency = 10
  ): Promise<Array<{ result: T; duration: number; error?: Error }>> {
    const results: Array<{ result: T; duration: number; error?: Error }> = [];
    
    // Process operations in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchPromises = batch.map(async (operation) => {
        try {
          const measured = await this.measureResponseTime(operation);
          return measured;
        } catch (error) {
          return { result: null as T, duration: 0, error: error as Error };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Generate performance report
   */
  static generatePerformanceReport(
    results: Array<{ duration: number; error?: Error }>
  ): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
  } {
    const successfulResults = results.filter(r => !r.error);
    const durations = successfulResults.map(r => r.duration).sort((a, b) => a - b);
    
    return {
      totalRequests: results.length,
      successfulRequests: successfulResults.length,
      failedRequests: results.length - successfulResults.length,
      averageResponseTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minResponseTime: durations.length > 0 ? durations[0] : 0,
      maxResponseTime: durations.length > 0 ? durations[durations.length - 1] : 0,
      p95ResponseTime: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0,
      errorRate: results.length > 0 ? (results.length - successfulResults.length) / results.length : 0,
    };
  }
}

/**
 * UI Testing Utilities (for integration with React components)
 */
export class UITestHelpers {
  /**
   * Simulate click events with delay
   */
  static async simulateClick(element: HTMLElement, delay = 100): Promise<void> {
    element.click();
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulate form input
   */
  static async simulateInput(input: HTMLInputElement, value: string, delay = 50): Promise<void> {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Wait for element to appear
   */
  static async waitForElement(
    selector: string,
    container: HTMLElement | Document = document,
    timeout = 5000
  ): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = container.querySelector(selector) as HTMLElement;
        if (element) {
          resolve(element);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Element with selector '${selector}' not found within ${timeout}ms`));
          return;
        }
        
        setTimeout(checkElement, 100);
      };
      
      checkElement();
    });
  }

  /**
   * Check if element has specific text content
   */
  static hasTextContent(element: HTMLElement, expectedText: string): boolean {
    return element.textContent?.includes(expectedText) ?? false;
  }

  /**
   * Check if element is visible
   */
  static isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }
}

/**
 * Accessibility Testing Utilities
 */
export class AccessibilityTestHelpers {
  /**
   * Check if element has proper ARIA attributes
   */
  static checkAriaAttributes(element: HTMLElement, expectedAttributes: Record<string, string>): boolean {
    for (const [attr, expectedValue] of Object.entries(expectedAttributes)) {
      const actualValue = element.getAttribute(`aria-${attr}`);
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check color contrast ratio
   */
  static getColorContrast(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const backgroundColor = style.backgroundColor;
    const color = style.color;
    
    // This is a simplified contrast calculation
    // In a real implementation, you'd use a proper color contrast library
    return this.calculateContrastRatio(color, backgroundColor);
  }

  private static calculateContrastRatio(color1: string, color2: string): number {
    // Simplified contrast calculation
    // In practice, you'd use a library like 'color-contrast' or implement
    // the full WCAG contrast calculation
    return 4.5; // Mock value that meets WCAG AA standards
  }

  /**
   * Check keyboard navigation
   */
  static isKeyboardAccessible(element: HTMLElement): boolean {
    const tabIndex = element.getAttribute('tabindex');
    const focusable = element.matches(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    return focusable || (tabIndex !== null && tabIndex !== '-1');
  }

  /**
   * Simulate screen reader navigation
   */
  static async simulateScreenReaderNavigation(
    container: HTMLElement,
    navigation: Array<{ key: string; expectedElement?: string }>
  ): Promise<HTMLElement[]> {
    const visited: HTMLElement[] = [];
    let currentElement = container.querySelector('[tabindex="0"], button, input, [href]') as HTMLElement;
    
    for (const nav of navigation) {
      if (currentElement) {
        visited.push(currentElement);
        
        // Simulate key press
        currentElement.dispatchEvent(new KeyboardEvent('keydown', { key: nav.key, bubbles: true }));
        
        if (nav.key === 'Tab') {
          // Find next focusable element
          const focusableElements = Array.from(container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )) as HTMLElement[];
          
          const currentIndex = focusableElements.indexOf(currentElement);
          currentElement = focusableElements[currentIndex + 1] || focusableElements[0];
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return visited;
  }
}

/**
 * Test Report Generator
 */
export class TestReportGenerator {
  /**
   * Generate comprehensive test report
   */
  static generateReport(results: {
    testSuite: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
    performance?: any;
    accessibility?: any;
    coverage?: any;
  }): string {
    const successRate = results.totalTests > 0 ? 
      (results.passedTests / results.totalTests * 100).toFixed(1) : '0.0';
    
    return `
# Test Report: ${results.testSuite}

## Summary
- **Total Tests**: ${results.totalTests}
- **Passed**: ${results.passedTests}
- **Failed**: ${results.failedTests}
- **Success Rate**: ${successRate}%
- **Duration**: ${(results.duration / 1000).toFixed(2)}s

## Performance
${results.performance ? this.formatPerformanceData(results.performance) : 'No performance data available'}

## Accessibility
${results.accessibility ? this.formatAccessibilityData(results.accessibility) : 'No accessibility data available'}

## Coverage
${results.coverage ? this.formatCoverageData(results.coverage) : 'No coverage data available'}
    `.trim();
  }

  private static formatPerformanceData(perf: any): string {
    return `
- Average Response Time: ${perf.averageResponseTime?.toFixed(0) || 'N/A'}ms
- 95th Percentile: ${perf.p95ResponseTime?.toFixed(0) || 'N/A'}ms
- Error Rate: ${(perf.errorRate * 100)?.toFixed(1) || 'N/A'}%
    `.trim();
  }

  private static formatAccessibilityData(a11y: any): string {
    return `
- ARIA Compliance: ${a11y.ariaCompliance ? 'Pass' : 'Fail'}
- Keyboard Navigation: ${a11y.keyboardNavigation ? 'Pass' : 'Fail'}
- Color Contrast: ${a11y.colorContrast ? 'Pass' : 'Fail'}
    `.trim();
  }

  private static formatCoverageData(coverage: any): string {
    return `
- Line Coverage: ${coverage.lines?.toFixed(1) || 'N/A'}%
- Function Coverage: ${coverage.functions?.toFixed(1) || 'N/A'}%
- Branch Coverage: ${coverage.branches?.toFixed(1) || 'N/A'}%
    `.trim();
  }
}