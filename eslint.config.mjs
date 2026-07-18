import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

// Flat config (ESLint v9 / Next 16). `next lint` was removed in Next 16, so the
// npm scripts call the ESLint CLI against this file. The next configs register
// the react/react-hooks/@next plugins and sensible defaults; we only tune the
// @typescript-eslint + core severities that the old .eslintrc.json set.
export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'playwright-report/**',
      'playwright-visual-report/**',
      'test-results/**',
      'next-env.d.ts',
      '**/*.tsbuildinfo',
      '**/*.min.js',
      'server/**/*.js',
      'scripts/**',
      'prisma/migrations/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      'prefer-const': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Match the old .eslintrc severities (next defaults these to error).
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
      '@next/next/no-img-element': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      // React-Compiler-era rules (react-hooks v6) that Next 16 turns on as
      // errors. They flag pre-existing patterns that work; surface them as
      // warnings rather than blocking the whole codebase. rules-of-hooks stays
      // an error — it catches genuine hook-ordering bugs.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // ServiceCard intentionally calls a hook after an early return (known,
    // accepted in the old config).
    files: ['src/components/ServiceCard.tsx'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  {
    files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'prefer-const': 'warn',
    },
  },
]
