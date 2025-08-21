// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

if (!env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Server-side Supabase client with service role key for admin operations
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Regular client for user operations (using anon key)
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
