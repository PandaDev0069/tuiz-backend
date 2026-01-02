// ====================================================
// File Name   : vitest.config.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-20
// Last Update : 2026-09-10

// Description:
// - Vitest configuration file for TUIZ backend project
// - Configures Node environment with parallel test execution
// - Integrates with Supabase for real integration testing

// Notes:
// - Uses forks pool for parallel test execution
// - Extended timeouts for Supabase operations (30s)
// - Test files located in tests/**/*.test.ts
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
        singleFork: false,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DOTENV_CONFIG_QUIET: 'true',
    },
  },
});
