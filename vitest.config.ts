import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false, // Enable parallel execution
      },
    },
    testTimeout: 30000, // Increase timeout for Supabase operations
    env: {
      NODE_ENV: 'test',
      DOTENV_CONFIG_QUIET: 'true', // Suppress dotenv informational messages
    },
  },
});
