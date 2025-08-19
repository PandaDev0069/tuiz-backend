import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    env: {
      NODE_ENV: 'test',
      DOTENV_CONFIG_QUIET: 'true', // Suppress dotenv informational messages
    },
  },
});
