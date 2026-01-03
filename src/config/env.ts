// ====================================================
// File Name   : env.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2025-12-29

// Description:
// - Environment variable configuration and validation
// - Uses Zod for type-safe environment variable parsing
// - Handles CI/test environment fallbacks
// - Provides CORS origin configuration
// - Loads dotenv only in non-production environments

// Notes:
// - Environment variables are validated on module load
// - CI/test environments use dummy credentials
// - Production defaults are applied when appropriate
// - Local network patterns are allowed in development
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import dotenv from 'dotenv';
import { z } from 'zod';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const ENV_PRODUCTION = 'production';
const ENV_TEST = 'test';
const ENV_DEVELOPMENT = 'development';

const CI_ENV_VALUE = 'true';
const GITHUB_ACTIONS_ENV_VALUE = 'true';

const DUMMY_SUPABASE_URL = 'https://dummy.supabase.co';
const DUMMY_ANON_KEY = 'dummy-anon-key-for-ci';
const DUMMY_SERVICE_ROLE_KEY = 'dummy-service-role-key-for-ci';

const DEFAULT_PORT = 8080;
const DEFAULT_CLIENT_ORIGINS = 'http://localhost:3000';
const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_SOCKET_PATH = '/socket.io';

const DEFAULT_PRODUCTION_ORIGINS =
  'https://tuiz-info-king.vercel.app,http://localhost:3000,http://localhost:5173,*.vercel.app,*.onrender.com,https://tuiz-info-king.vercel.app';

const LOCALHOST_ORIGIN = 'http://localhost:3000';
const LOCALHOST_IP_ORIGIN = 'http://127.0.0.1:3000';

const ORIGIN_SEPARATOR = ',';
const VERCEL_APP_DOMAIN = 'vercel.app';

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;

const ERROR_MESSAGES = {
  SUPABASE_URL_INVALID: 'SUPABASE_URL must be a valid URL',
  SUPABASE_ANON_KEY_REQUIRED: 'SUPABASE_ANON_KEY is required',
  SUPABASE_SERVICE_ROLE_KEY_REQUIRED: 'SUPABASE_SERVICE_ROLE_KEY is required',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using Zod schema types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
// Load dotenv only in development/test environments
// In production, environment variables should be set by the platform
if (process.env.NODE_ENV !== ENV_PRODUCTION) {
  dotenv.config();
}

// Check if we're in a CI environment without Supabase credentials
const isCI =
  process.env.CI === CI_ENV_VALUE || process.env.GITHUB_ACTIONS === GITHUB_ACTIONS_ENV_VALUE;
const isTest = process.env.NODE_ENV === ENV_TEST;

// Provide fallback values for CI/test environments
const supabaseUrl = isCI && isTest ? DUMMY_SUPABASE_URL : process.env.SUPABASE_URL;
const supabaseAnonKey = isCI && isTest ? DUMMY_ANON_KEY : process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  isCI && isTest ? DUMMY_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;

const Env = z.object({
  PORT: z.coerce.number().default(DEFAULT_PORT),
  NODE_ENV: z.enum(NODE_ENV_VALUES).default(ENV_DEVELOPMENT),
  CLIENT_ORIGINS: z.string().default(DEFAULT_CLIENT_ORIGINS),
  LOG_LEVEL: z.enum(LOG_LEVELS).default(DEFAULT_LOG_LEVEL),

  SUPABASE_URL: z.string().url(ERROR_MESSAGES.SUPABASE_URL_INVALID),
  SUPABASE_ANON_KEY: z.string().min(1, ERROR_MESSAGES.SUPABASE_ANON_KEY_REQUIRED),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, ERROR_MESSAGES.SUPABASE_SERVICE_ROLE_KEY_REQUIRED),
  SUPABASE_JWT_SECRET: z.string().optional(),

  SOCKET_PATH: z.string().default(DEFAULT_SOCKET_PATH),
});

export const env = Env.parse({
  ...process.env,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
});

export const isProd = env.NODE_ENV === ENV_PRODUCTION;
export const isTestWithDummyCredentials = isCI && isTest;

/**
 * Function: getAllowedOrigins
 * Description:
 * - Get allowed CORS origins based on environment
 * - Applies production defaults when appropriate
 * - Adds local network patterns in development
 * - Handles Vercel domain detection
 *
 * Returns:
 * - string[]: Array of allowed origin strings
 */
export function getAllowedOrigins(): string[] {
  let origins = env.CLIENT_ORIGINS;

  const isProductionLike = isProd || process.env.CLIENT_ORIGINS?.includes(VERCEL_APP_DOMAIN);

  if (isProductionLike && (origins === LOCALHOST_ORIGIN || !process.env.CLIENT_ORIGINS)) {
    origins = DEFAULT_PRODUCTION_ORIGINS;
  }

  const allowed = origins
    .split(ORIGIN_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!isProd) {
    const localNetworkPatterns = [
      LOCALHOST_ORIGIN,
      LOCALHOST_IP_ORIGIN,
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}:3000$/,
    ];

    localNetworkPatterns.forEach((pattern) => {
      if (typeof pattern === 'string' && !allowed.includes(pattern)) {
        allowed.push(pattern);
      }
    });
  }

  return allowed;
}

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
// No additional helper functions - all logic in Core Logic section

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
// All exports are in Core Logic section
