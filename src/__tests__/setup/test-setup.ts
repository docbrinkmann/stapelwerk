/**
 * Test Setup and Utilities
 * Configuration and utility functions for security dashboard tests
 */

import { beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Mock system date for consistent testing
const mockDate = new Date('2025-09-26T12:00:00Z');

beforeAll(() => {
  // Mock Date constructor globally for consistent timestamps
  global.Date = class extends Date {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(mockDate);
      } else {
        super(...args);
      }
    }
    
    static now() {
      return mockDate.getTime();
    }
  } as any;
  
  // Mock ResizeObserver for chart components
  global.ResizeObserver = class ResizeObserver {
    observe() {
      // Mock implementation
    }
    unobserve() {
      // Mock implementation
    }
    disconnect() {
      // Mock implementation
    }
  };

  // Mock matchMedia for responsive components
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  // Mock IntersectionObserver for lazy loading
  global.IntersectionObserver = class IntersectionObserver {
    observe() {
      // Mock implementation
    }
    unobserve() {
      // Mock implementation
    }
    disconnect() {
      // Mock implementation
    }
  } as any;

  // Mock console methods to reduce test noise
  global.console = {
    ...console,
    warn: () => {}, // Suppress warnings in tests
    error: () => {}, // Suppress errors unless needed for assertions
  };
});

afterEach(() => {
  cleanup(); // Clean up DOM after each test
});

// Test data factories
export const createMockSecurityScan = (overrides: any = {}) => ({
  id: 'mock-scan-id',
  target: 'mock-image:latest',
  type: 'container',
  status: 'completed',
  vulnerabilities_found: 0,
  started_at: '2025-09-26T10:00:00Z',
  completed_at: '2025-09-26T10:05:00Z',
  ...overrides
});

export const createMockVulnerability = (overrides: any = {}) => ({
  id: 'mock-vuln-id',
  cve: 'CVE-2025-0000',
  title: 'Mock Vulnerability',
  description: 'This is a mock vulnerability for testing',
  severity: 'medium',
  cvss_score: 5.5,
  package: {
    name: 'test-package',
    version: '1.0.0',
    fixed_version: '1.0.1'
  },
  references: [],
  ...overrides
});

export const createMockSecurityAlert = (overrides: any = {}) => ({
  id: 'mock-alert-id',
  type: 'medium',
  category: 'vulnerability',
  title: 'Mock Security Alert',
  description: 'This is a mock security alert for testing',
  affected_targets: ['test-target'],
  created_at: '2025-09-26T11:00:00Z',
  is_read: false,
  is_dismissed: false,
  ...overrides
});

export const createMockTrendData = (overrides: any = {}) => ({
  vulnerability_history: [
    { date: '2025-09-19', total: 25, critical: 2, high: 5, medium: 10, low: 8 },
    { date: '2025-09-20', total: 23, critical: 1, high: 5, medium: 9, low: 8 },
    { date: '2025-09-21', total: 20, critical: 1, high: 4, medium: 8, low: 7 },
    { date: '2025-09-22', total: 18, critical: 0, high: 4, medium: 7, low: 7 }
  ],
  security_score_history: [
    { date: '2025-09-19', score: 7.2 },
    { date: '2025-09-20', score: 7.4 },
    { date: '2025-09-21', score: 7.8 },
    { date: '2025-09-22', score: 8.1 }
  ],
  ...overrides
});

// Test utilities
export const waitForApiCall = async (mockFn: any, timeout = 1000) => {
  const startTime = Date.now();
  while (!mockFn.mock.calls.length && Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (!mockFn.mock.calls.length) {
    throw new Error(`API call not made within ${timeout}ms`);
  }
};

export const mockApiResponse = (data: any, delay = 0) => {
  return new Promise(resolve => {
    setTimeout(() => resolve(data), delay);
  });
};

// Custom render function with providers (if needed)
export const renderWithProviders = (component: React.ReactElement) => {
  // Add any providers here (Router, Theme, etc.)
  return component;
};

// Test assertion helpers
export const expectElementsToBeInDocument = (...textContent: string[]) => {
  textContent.forEach(text => {
    const element = document.querySelector(`[data-testid*="${text}"], *:contains("${text}")`);
    expect(element).toBeInTheDocument();
  });
};

export const expectButtonsToBeClickable = (...buttonNames: string[]) => {
  buttonNames.forEach(name => {
    const button = document.querySelector(`button[aria-label*="${name}"], button:contains("${name}")`);
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
};