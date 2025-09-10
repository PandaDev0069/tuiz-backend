// src/lib/supabase.ts
/**
 * Enhanced Supabase Client Library for Quiz API
 *
 * This module provides a comprehensive interface to Supabase for the quiz application,
 * including typed clients, utility functions, and helper methods.
 *
 * Features:
 * - Typed Supabase clients with full Database schema
 * - Mock client for testing environments
 * - Quiz-specific helper functions
 * - Storage operations for quiz images
 * - Authentication utilities
 * - Error handling and formatting
 *
 * @example
 * import { supabaseAdmin, generateQuizCode, verifyAuthToken } from './supabase';
 *
 * // Generate unique quiz code
 * const code = await generateQuizCode();
 *
 * // Verify user authentication
 * const { user, error } = await verifyAuthToken(token);
 *
 * // Get quiz for playing
 * const quiz = await getQuizForPlay(quizId);
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, isTestWithDummyCredentials } from '../config/env';
import type {
  QuizSet,
  Question,
  Answer,
  QuizSetComplete,
  DifficultyLevel,
  QuizStatus,
  QuestionType,
} from '../types/quiz';
import { logger } from '../utils/logger';

// ============================================================================
// VALIDATION
// ============================================================================

if (!env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          email: string;
          role: 'user' | 'admin';
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          email: string;
          role?: 'user' | 'admin';
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          email?: string;
          role?: 'user' | 'admin';
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      quiz_sets: {
        Row: QuizSet;
        Insert: Omit<
          QuizSet,
          'id' | 'created_at' | 'updated_at' | 'total_questions' | 'times_played'
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          total_questions?: number;
          times_played?: number;
        };
        Update: Partial<Omit<QuizSet, 'id' | 'user_id' | 'created_at'>> & {
          updated_at?: string;
        };
      };
      questions: {
        Row: Question;
        Insert: Omit<Question, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Question, 'id' | 'question_set_id' | 'created_at'>> & {
          updated_at?: string;
        };
      };
      answers: {
        Row: Answer;
        Insert: Omit<Answer, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Answer, 'id' | 'question_id' | 'created_at'>> & {
          updated_at?: string;
        };
      };
    };
    Functions: {
      generate_quiz_code: {
        Args: Record<string, never>;
        Returns: number;
      };
      update_quiz_question_count: {
        Args: { quiz_id: string };
        Returns: void;
      };
      increment_quiz_play_count: {
        Args: { quiz_id: string };
        Returns: void;
      };
      validate_quiz_for_publishing: {
        Args: { quiz_id: string };
        Returns: boolean;
      };
      get_quiz_for_play: {
        Args: { input_quiz_id: string };
        Returns: {
          quiz_id: string;
          quiz_title: string;
          quiz_description: string;
          quiz_settings: Record<string, unknown>;
          questions: Record<string, unknown>;
        }[];
      };
    };
    Enums: {
      difficulty_level: DifficultyLevel;
      quiz_status: QuizStatus;
      question_type: QuestionType;
    };
  };
}

export type TypedSupabaseClient = SupabaseClient<Database>;

// ============================================================================
// MOCK CLIENT FOR TESTING
// ============================================================================

function createMockSupabaseClient(): TypedSupabaseClient {
  const mockResponse = { data: null, error: null };

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
    from: (_table: string) => ({
      select: (_columns?: string) => ({
        eq: (_column: string, _value: unknown) => ({
          maybeSingle: async () => mockResponse,
          single: async () => ({ data: null, error: { message: 'No data in mock' } }),
          order: () => ({
            range: async () => ({ data: [], error: null, count: 0 }),
          }),
        }),
        or: (_filter: string) => ({
          order: () => ({
            range: async () => ({ data: [], error: null, count: 0 }),
          }),
        }),
        order: (_column: string, _options?: unknown) => ({
          range: async () => ({ data: [], error: null, count: 0 }),
        }),
        range: async () => ({ data: [], error: null, count: 0 }),
        is: (_column: string, _value: unknown) => ({
          maybeSingle: async () => mockResponse,
        }),
      }),
      insert: (_data: unknown) => ({
        select: (_columns?: string) => ({
          single: async () => mockResponse,
        }),
      }),
      update: (_data: unknown) => ({
        eq: (_column: string, _value: unknown) => ({
          select: (_columns?: string) => ({
            single: async () => mockResponse,
          }),
        }),
      }),
      delete: () => ({
        eq: (_column: string, _value: unknown) => mockResponse,
      }),
      upsert: async () => mockResponse,
    }),
    rpc: async () => mockResponse,
    storage: {
      from: (_bucket: string) => ({
        upload: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  } as unknown as TypedSupabaseClient;
}

// ============================================================================
// CLIENT INSTANCES
// ============================================================================

// Server-side Supabase client with service role key for admin operations
export const supabaseAdmin: TypedSupabaseClient = isTestWithDummyCredentials
  ? createMockSupabaseClient()
  : createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

// Regular client for user operations (using anon key)
export const supabase: TypedSupabaseClient = isTestWithDummyCredentials
  ? createMockSupabaseClient()
  : createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY || '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an authenticated Supabase client with user token
 */
export function createAuthenticatedClient(token: string): TypedSupabaseClient {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY || '', {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Verify JWT token and get user information
 */
export async function verifyAuthToken(
  token: string,
): Promise<{ user: unknown | null; error: unknown }> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      logger.warn({ error: error.message }, 'Token verification failed');
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (err) {
    logger.error({ err }, 'Unexpected error during token verification');
    return { user: null, error: err };
  }
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string) {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, email, role, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      logger.error({ error, userId }, 'Error fetching user profile');
      return null;
    }

    return profile;
  } catch (err) {
    logger.error({ err, userId }, 'Unexpected error fetching user profile');
    return null;
  }
}

/**
 * Check if user has admin role
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !profile) {
      return false;
    }

    return profile.role === 'admin';
  } catch (err) {
    logger.error({ err, userId }, 'Error checking admin status');
    return false;
  }
}

/**
 * Clean up test data (for testing purposes only)
 */
export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  if (env.NODE_ENV !== 'test') {
    logger.warn('cleanupTestUsers called outside test environment');
    return;
  }

  try {
    for (const userId of userIds) {
      // Delete user from auth
      await supabaseAdmin.auth.admin.deleteUser(userId);

      // Soft delete profile
      await supabaseAdmin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', userId);
    }
  } catch (err) {
    logger.error({ err, userIds }, 'Error cleaning up test users');
  }
}

// ============================================================================
// QUIZ HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique quiz code
 */
export async function generateQuizCode(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin.rpc('generate_quiz_code');

    if (error) {
      logger.error({ error }, 'Error generating quiz code');
      throw new Error('Failed to generate quiz code');
    }

    return data as number;
  } catch (err) {
    logger.error({ err }, 'Unexpected error generating quiz code');
    throw err;
  }
}

/**
 * Update quiz question count
 */
export async function updateQuizQuestionCount(quizId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('update_quiz_question_count', {
      quiz_id: quizId,
    });

    if (error) {
      logger.error({ error, quizId }, 'Error updating quiz question count');
      throw new Error('Failed to update quiz question count');
    }
  } catch (err) {
    logger.error({ err, quizId }, 'Unexpected error updating quiz question count');
    throw err;
  }
}

/**
 * Increment quiz play count
 */
export async function incrementQuizPlayCount(quizId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('increment_quiz_play_count', {
      quiz_id: quizId,
    });

    if (error) {
      logger.error({ error, quizId }, 'Error incrementing quiz play count');
      throw new Error('Failed to increment quiz play count');
    }
  } catch (err) {
    logger.error({ err, quizId }, 'Unexpected error incrementing quiz play count');
    throw err;
  }
}

/**
 * Validate quiz for publishing
 */
export async function validateQuizForPublishing(quizId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('validate_quiz_for_publishing', {
      quiz_id: quizId,
    });

    if (error) {
      logger.error({ error, quizId }, 'Error validating quiz for publishing');
      return false;
    }

    return data as boolean;
  } catch (err) {
    logger.error({ err, quizId }, 'Unexpected error validating quiz for publishing');
    return false;
  }
}

/**
 * Get complete quiz data for playing
 */
export async function getQuizForPlay(quizId: string): Promise<QuizSetComplete | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_quiz_for_play', {
      input_quiz_id: quizId,
    });

    if (error) {
      logger.error({ error, quizId }, 'Error getting quiz for play');
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const quizData = data[0];
    return {
      id: quizData.quiz_id,
      user_id: '', // Not needed for playing
      title: quizData.quiz_title,
      description: quizData.quiz_description,
      thumbnail_url: undefined,
      is_public: true,
      difficulty_level: 'easy' as DifficultyLevel,
      category: '',
      total_questions: quizData.questions?.length || 0,
      times_played: 0,
      created_at: '',
      updated_at: '',
      status: 'published' as QuizStatus,
      tags: [],
      play_settings: quizData.quiz_settings,
      questions: quizData.questions || [],
    } as QuizSetComplete;
  } catch (err) {
    logger.error({ err, quizId }, 'Unexpected error getting quiz for play');
    return null;
  }
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Upload file to quiz images bucket
 */
export async function uploadQuizImage(
  userId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const filePath = `${userId}/${fileName}`;

    const { error } = await supabaseAdmin.storage.from('quiz-images').upload(filePath, file, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      logger.error({ error, filePath }, 'Error uploading quiz image');
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage.from('quiz-images').getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    logger.error({ err, userId, fileName }, 'Unexpected error uploading quiz image');
    return null;
  }
}

/**
 * Delete quiz image
 */
export async function deleteQuizImage(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.storage.from('quiz-images').remove([filePath]);

    if (error) {
      logger.error({ error, filePath }, 'Error deleting quiz image');
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, filePath }, 'Unexpected error deleting quiz image');
    return false;
  }
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

/**
 * Check if error is a Supabase error
 */
export function isSupabaseError(error: unknown): error is { code?: string; message?: string } {
  return Boolean(
    error && typeof error === 'object' && error !== null && ('message' in error || 'code' in error),
  );
}

/**
 * Format Supabase error for API response
 */
export function formatSupabaseError(error: unknown): { error: string; message: string } {
  if (!isSupabaseError(error)) {
    return {
      error: 'database_error',
      message: 'An unexpected database error occurred',
    };
  }

  const supabaseError = error as { code?: string; message?: string };

  // Map common Supabase errors to user-friendly messages
  switch (supabaseError.code) {
    case 'PGRST116':
      return {
        error: 'not_found',
        message: 'The requested resource was not found',
      };
    case '23505':
      return {
        error: 'duplicate_value',
        message: 'A record with this value already exists',
      };
    case '23503':
      return {
        error: 'foreign_key_violation',
        message: 'Cannot perform this action due to related data',
      };
    case '42501':
      return {
        error: 'insufficient_privileges',
        message: 'You do not have permission to perform this action',
      };
    default:
      return {
        error: 'database_error',
        message: supabaseError.message || 'A database error occurred',
      };
  }
}
