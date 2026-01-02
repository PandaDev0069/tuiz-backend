// ====================================================
// File Name   : vitest.ci.config.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2026-01-10

// Description:
// - Vitest configuration optimized for CI/CD environments
// - Single-fork execution for enhanced stability
// - JUnit reporting for CI integration
// - Retry logic for handling flaky tests

// Notes:
// - Parallel execution disabled (singleFork: true) for CI stability
// - Extended timeouts (30s test, 15s hook) for CI environments
// - JUnit output: ./test-results/junit.xml
// - Retry count: 2 attempts for flaky tests
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { defineConfig } from 'vitest/config';

//----------------------------------------------------
// 2. Configuration
//----------------------------------------------------
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30000,
    hookTimeout: 15000,
    setupFiles: ['tests/setup.ts'],
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    env: {
      NODE_ENV: 'test',
      CI: 'true',
      DOTENV_CONFIG_QUIET: 'true',
      TEST_RETRY_COUNT: '3',
      TEST_RETRY_DELAY: '1000',
    },
    maxConcurrency: 1,
    isolate: true,
    bail: 0,
    retry: 2,
  },
});
