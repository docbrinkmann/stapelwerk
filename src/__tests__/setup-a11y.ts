import { configureAxe } from 'jest-axe'

/**
 * Configure axe-core for accessibility testing
 * 
 * Disables rules that are not relevant for component testing
 * and configures options for better test output.
 */
export const axe = configureAxe({
  rules: {
    // Disable document-level rules not relevant for component testing
    'document-title': { enabled: false },
    'html-has-lang': { enabled: false },
    'landmark-one-main': { enabled: false },
    'page-has-heading-one': { enabled: false },
    'region': { enabled: false },
  },
})

/**
 * Default axe configuration for full page testing
 */
export const axeFullPage = configureAxe({
  // Enable all rules for full page testing
})
