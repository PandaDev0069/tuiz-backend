// src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod';

// Only load dotenv in development/test environments
// In production, environment variables should be set by the platform
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

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

export const env = Env.parse(process.env);
export const isProd = env.NODE_ENV === 'production';

export function getAllowedOrigins(): string[] {
  return env.CLIENT_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
