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
    testTimeout: 30000, // Increased timeout for CI stability
    hookTimeout: 15000, // Increased hook timeout for CI
    setupFiles: ['tests/setup.ts'],
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    env: {
      NODE_ENV: 'test',
      CI: 'true',
      DOTENV_CONFIG_QUIET: 'true',
      // Add retry configuration for auth
      TEST_RETRY_COUNT: '3',
      TEST_RETRY_DELAY: '1000',
    },
    // Optimize for CI
    maxConcurrency: 1,
    // Reduce memory usage
    isolate: true,
    // Don't fail fast - let more tests run to see all issues
    bail: 0,
    // Add retry logic for flaky tests
    retry: 2,
  },
});
