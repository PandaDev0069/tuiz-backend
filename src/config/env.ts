// src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod';

// Only load dotenv in development/test environments
// In production, environment variables should be set by the platform
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Check if we're in a CI environment without Supabase credentials
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isTest = process.env.NODE_ENV === 'test';

// Provide fallback values for CI/test environments
const supabaseUrl = isCI && isTest ? 'https://dummy.supabase.co' : process.env.SUPABASE_URL;
const supabaseAnonKey = isCI && isTest ? 'dummy-anon-key-for-ci' : process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  isCI && isTest ? 'dummy-service-role-key-for-ci' : process.env.SUPABASE_SERVICE_ROLE_KEY;

const Env = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGINS: z.string().default('http://localhost:3000'), // comma-separated
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Supabase configuration - required for auth to work
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_JWT_SECRET: z.string().optional(),

  SOCKET_PATH: z.string().default('/socket.io'),
});

export const env = Env.parse({
  ...process.env,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
});
export const isProd = env.NODE_ENV === 'production';
export const isTestWithDummyCredentials = isCI && isTest;

export function getAllowedOrigins(): string[] {
  return env.CLIENT_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
