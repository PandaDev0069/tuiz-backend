/* eslint-disable import/no-unresolved, n/no-unpublished-import */
// @ts-expect-error - vitest config import for CI
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Disable parallel execution for CI stability
      },
    },
    testTimeout: 15000, // Reduced timeout for CI
    hookTimeout: 10000, // Reduced hook timeout for CI
    reporter: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    env: {
      NODE_ENV: 'test',
      CI: 'true',
      DOTENV_CONFIG_QUIET: 'true',
    },
    // Optimize for CI
    maxConcurrency: 1,
    minThreads: 1,
    maxThreads: 1,
    // Reduce memory usage
    isolate: true,
    // Fail fast on first error
    bail: 1,
  },
});
