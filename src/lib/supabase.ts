// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { env, isTestWithDummyCredentials } from '../config/env';

if (!env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Create a mock client for CI environments without real Supabase credentials
function createMockSupabaseClient() {
  return {
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
        getUserById: async () => ({ data: null, error: { message: 'User not found in mock' } }),
        deleteUser: async () => ({ data: null, error: null }),
        signOut: async () => ({ data: null, error: null }),
      },
      getUser: async () => ({ data: { user: null }, error: { message: 'Mock auth disabled' } }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Mock auth disabled' } }),
      signOut: async () => ({ data: null, error: null }),
      signUp: async () => ({ data: null, error: { message: 'Mock auth disabled' } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: { message: 'No data in mock' } }),
        }),
      }),
      upsert: async () => ({ data: null, error: null }),
      update: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
  };
}

// Server-side Supabase client with service role key for admin operations
export const supabaseAdmin = isTestWithDummyCredentials
  ? createMockSupabaseClient()
  : createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

// Regular client for user operations (using anon key)
export const supabase = isTestWithDummyCredentials
  ? createMockSupabaseClient()
  : createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY || '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
