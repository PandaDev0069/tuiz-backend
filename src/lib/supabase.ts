// ====================================================
// File Name   : supabase.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-22
// Last Update : 2025-11-24

// Description:
// - Enhanced Supabase Client Library for Quiz API
// - Provides comprehensive interface to Supabase
// - Includes typed clients, utility functions, and helper methods
// - Features: Typed Supabase clients, mock client for testing,
//   quiz-specific helpers, storage operations, auth utilities, error handling

// Notes:
// - Mock client used in test environments
// - Admin client uses service role key for admin operations
// - Regular client uses anon key for user operations
// - All clients have autoRefreshToken and persistSession disabled
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
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

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const ERROR_MESSAGES = {
  MISSING_SUPABASE_URL: 'Missing SUPABASE_URL environment variable',
  MISSING_SERVICE_ROLE_KEY: 'Missing SUPABASE_SERVICE_ROLE_KEY environment variable',
  FAILED_TO_GENERATE_QUIZ_CODE: 'Failed to generate quiz code',
  FAILED_TO_UPDATE_QUESTION_COUNT: 'Failed to update quiz question count',
  FAILED_TO_INCREMENT_PLAY_COUNT: 'Failed to increment quiz play count',
  UNEXPECTED_DATABASE_ERROR: 'An unexpected database error occurred',
  RESOURCE_NOT_FOUND: 'The requested resource was not found',
  DUPLICATE_VALUE: 'A record with this value already exists',
  FOREIGN_KEY_VIOLATION: 'Cannot perform this action due to related data',
  INSUFFICIENT_PRIVILEGES: 'You do not have permission to perform this action',
  DATABASE_ERROR: 'A database error occurred',
} as const;

const ERROR_CODES = {
  NOT_FOUND: 'not_found',
  DUPLICATE_VALUE: 'duplicate_value',
  FOREIGN_KEY_VIOLATION: 'foreign_key_violation',
  INSUFFICIENT_PRIVILEGES: 'insufficient_privileges',
  DATABASE_ERROR: 'database_error',
} as const;

const SUPABASE_ERROR_CODES = {
  NOT_FOUND: 'PGRST116',
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  INSUFFICIENT_PRIVILEGES: '42501',
} as const;

const TABLE_PROFILES = 'profiles';
const BUCKET_QUIZ_IMAGES = 'quiz-images';

const SELECT_PROFILE_FIELDS =
  'id, username, display_name, email, role, avatar_url, created_at, updated_at';
const SELECT_ROLE_FIELD = 'role';

const MOCK_VALUES = {
  USER_ID: 'mock-user-id',
  EMAIL: 'mock@example.com',
  USERNAME: 'mockuser',
  DISPLAY_NAME: 'Mock User',
  TOKEN: 'mock-token',
  REFRESH_TOKEN: 'mock-refresh-token',
  INVALID_TOKEN: 'invalid-token',
  MIN_TOKEN_LENGTH: 10,
  WRONG_PASSWORD: 'wrongpassword123',
} as const;

const LOG_MESSAGES = {
  TOKEN_VERIFICATION_FAILED: 'Token verification failed',
  UNEXPECTED_ERROR_TOKEN_VERIFICATION: 'Unexpected error during token verification',
  ERROR_FETCHING_USER_PROFILE: 'Error fetching user profile',
  UNEXPECTED_ERROR_FETCHING_PROFILE: 'Unexpected error fetching user profile',
  ERROR_CHECKING_ADMIN_STATUS: 'Error checking admin status',
  CLEANUP_CALLED_OUTSIDE_TEST: 'cleanupTestUsers called outside test environment',
  ERROR_CLEANING_UP_TEST_USERS: 'Error cleaning up test users',
  ERROR_GENERATING_QUIZ_CODE: 'Error generating quiz code',
  UNEXPECTED_ERROR_GENERATING_CODE: 'Unexpected error generating quiz code',
  ERROR_UPDATING_QUESTION_COUNT: 'Error updating quiz question count',
  UNEXPECTED_ERROR_UPDATING_COUNT: 'Unexpected error updating quiz question count',
  ERROR_INCREMENTING_PLAY_COUNT: 'Error incrementing quiz play count',
  UNEXPECTED_ERROR_INCREMENTING_COUNT: 'Unexpected error incrementing quiz play count',
  ERROR_VALIDATING_QUIZ: 'Error validating quiz for publishing',
  UNEXPECTED_ERROR_VALIDATING: 'Unexpected error validating quiz for publishing',
  ERROR_GETTING_QUIZ_FOR_PLAY: 'Error getting quiz for play',
  UNEXPECTED_ERROR_GETTING_QUIZ: 'Unexpected error getting quiz for play',
  ERROR_UPLOADING_QUIZ_IMAGE: 'Error uploading quiz image',
  UNEXPECTED_ERROR_UPLOADING_IMAGE: 'Unexpected error uploading quiz image',
  ERROR_DELETING_QUIZ_IMAGE: 'Error deleting quiz image',
  UNEXPECTED_ERROR_DELETING_IMAGE: 'Unexpected error deleting quiz image',
} as const;

const DEFAULT_QUIZ_VALUES = {
  USER_ID: '',
  DIFFICULTY_LEVEL: 'easy' as DifficultyLevel,
  CATEGORY: '',
  TOTAL_QUESTIONS: 0,
  TIMES_PLAYED: 0,
  CREATED_AT: '',
  UPDATED_AT: '',
  STATUS: 'published' as QuizStatus,
  IS_PUBLIC: true,
  TAGS: [],
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// Validation - must be before type definitions
if (!env.SUPABASE_URL) {
  throw new Error(ERROR_MESSAGES.MISSING_SUPABASE_URL);
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(ERROR_MESSAGES.MISSING_SERVICE_ROLE_KEY);
}

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
      websocket_connections: {
        Row: {
          id: string;
          device_id: string;
          user_id: string | null;
          socket_id: string;
          status: 'active' | 'disconnected' | 'timeout';
          connected_at: string;
          disconnected_at: string | null;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          device_id: string;
          user_id?: string | null;
          socket_id: string;
          status?: 'active' | 'disconnected' | 'timeout';
          connected_at?: string;
          disconnected_at?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: {
          status?: 'active' | 'disconnected' | 'timeout';
          disconnected_at?: string | null;
          metadata?: Record<string, unknown>;
        };
      };
      device_sessions: {
        Row: {
          id: string;
          device_id: string;
          user_id: string | null;
          last_socket_id: string | null;
          first_seen: string;
          last_seen: string;
          reconnect_count: number;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          device_id: string;
          user_id?: string | null;
          last_socket_id?: string | null;
          first_seen?: string;
          last_seen?: string;
          reconnect_count?: number;
          metadata?: Record<string, unknown>;
        };
        Update: {
          user_id?: string | null;
          last_socket_id?: string | null;
          last_seen?: string;
          reconnect_count?: number;
          metadata?: Record<string, unknown>;
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
      update_device_session: {
        Args: {
          p_device_id: string;
          p_user_id: string | null;
          p_socket_id: string;
          p_metadata: Record<string, unknown>;
        };
        Returns: string;
      };
      get_device_reconnect_count: {
        Args: { p_device_id: string };
        Returns: number;
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

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Function: createMockSupabaseClient
 * Description:
 * - Creates a mock Supabase client for testing environments
 * - Provides mock implementations of all Supabase methods
 * - Returns valid mock data for properly formatted tokens
 *
 * Returns:
 * - TypedSupabaseClient: Mock Supabase client instance
 */
function createMockSupabaseClient(): TypedSupabaseClient {
  const mockResponse = { data: null, error: null };

  return {
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
        getUserById: async () => ({ data: null, error: { message: 'User not found in mock' } }),
        createUser: async () => ({ data: { user: { id: MOCK_VALUES.USER_ID } }, error: null }),
        deleteUser: async () => ({ data: null, error: null }),
        getUser: async (token: string) => {
          if (
            token === MOCK_VALUES.INVALID_TOKEN ||
            !token ||
            token.length < MOCK_VALUES.MIN_TOKEN_LENGTH
          ) {
            return { data: { user: null }, error: { message: 'Invalid token' } };
          }
          return {
            data: {
              user: {
                id: MOCK_VALUES.USER_ID,
                email: MOCK_VALUES.EMAIL,
                user_metadata: {
                  username: MOCK_VALUES.USERNAME,
                  display_name: MOCK_VALUES.DISPLAY_NAME,
                },
              },
            },
            error: null,
          };
        },
        signOut: async () => ({ data: null, error: null }),
      },
      getUser: async (token: string) => {
        if (
          token === MOCK_VALUES.INVALID_TOKEN ||
          !token ||
          token.length < MOCK_VALUES.MIN_TOKEN_LENGTH
        ) {
          return { data: { user: null }, error: { message: 'Invalid token' } };
        }
        return {
          data: {
            user: {
              id: MOCK_VALUES.USER_ID,
              email: MOCK_VALUES.EMAIL,
              user_metadata: {
                username: MOCK_VALUES.USERNAME,
                display_name: MOCK_VALUES.DISPLAY_NAME,
              },
            },
          },
          error: null,
        };
      },
      signInWithPassword: async (credentials: { email: string; password: string }) => {
        if (
          credentials.password === MOCK_VALUES.WRONG_PASSWORD ||
          !credentials.email.includes('@')
        ) {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials' },
          };
        }
        return {
          data: {
            user: { id: MOCK_VALUES.USER_ID },
            session: {
              access_token: MOCK_VALUES.TOKEN,
              refresh_token: MOCK_VALUES.REFRESH_TOKEN,
            },
          },
          error: null,
        };
      },
      signOut: async () => ({ data: null, error: null }),
      signUp: async () => ({
        data: {
          user: { id: MOCK_VALUES.USER_ID },
          session: {
            access_token: MOCK_VALUES.TOKEN,
            refresh_token: MOCK_VALUES.REFRESH_TOKEN,
          },
        },
        error: null,
      }),
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

/**
 * Client: supabaseAdmin
 * Description:
 * - Server-side Supabase client with service role key
 * - Used for admin operations that bypass RLS
 * - Uses mock client in test environments
 */
export const supabaseAdmin: TypedSupabaseClient = isTestWithDummyCredentials
  ? createMockSupabaseClient()
  : createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

/**
 * Client: supabase
 * Description:
 * - Regular Supabase client for user operations
 * - Uses anon key and respects RLS policies
 * - Uses mock client in test environments
 */
export const supabase: TypedSupabaseClient = isTestWithDummyCredentials
  ? createMockSupabaseClient()
  : createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY || '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------

/**
 * Function: createAuthenticatedClient
 * Description:
 * - Create an authenticated Supabase client with user token
 * - Uses anon key with Bearer token in headers
 * - Respects RLS policies based on user token
 *
 * Parameters:
 * - token (string): JWT authentication token
 *
 * Returns:
 * - TypedSupabaseClient: Authenticated Supabase client instance
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
 * Function: verifyAuthToken
 * Description:
 * - Verify JWT token and get user information
 * - Uses admin client for token verification
 *
 * Parameters:
 * - token (string): JWT token to verify
 *
 * Returns:
 * - Promise<{ user: unknown | null; error: unknown }>: User data or error
 */
export async function verifyAuthToken(
  token: string,
): Promise<{ user: unknown | null; error: unknown }> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      logger.warn({ error: error.message }, LOG_MESSAGES.TOKEN_VERIFICATION_FAILED);
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (err) {
    logger.error({ err }, LOG_MESSAGES.UNEXPECTED_ERROR_TOKEN_VERIFICATION);
    return { user: null, error: err };
  }
}

/**
 * Function: getUserProfile
 * Description:
 * - Get user profile by ID
 * - Excludes soft-deleted profiles
 *
 * Parameters:
 * - userId (string): User identifier
 *
 * Returns:
 * - Promise<Profile | null>: User profile or null if not found or error
 */
export async function getUserProfile(userId: string) {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .select(SELECT_PROFILE_FIELDS)
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      logger.error({ error, userId }, LOG_MESSAGES.ERROR_FETCHING_USER_PROFILE);
      return null;
    }

    return profile;
  } catch (err) {
    logger.error({ err, userId }, LOG_MESSAGES.UNEXPECTED_ERROR_FETCHING_PROFILE);
    return null;
  }
}

/**
 * Function: isUserAdmin
 * Description:
 * - Check if user has admin role
 * - Excludes soft-deleted profiles
 *
 * Parameters:
 * - userId (string): User identifier
 *
 * Returns:
 * - Promise<boolean>: True if user is admin, false otherwise
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .select(SELECT_ROLE_FIELD)
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !profile) {
      return false;
    }

    return profile.role === 'admin';
  } catch (err) {
    logger.error({ err, userId }, LOG_MESSAGES.ERROR_CHECKING_ADMIN_STATUS);
    return false;
  }
}

/**
 * Function: cleanupTestUsers
 * Description:
 * - Clean up test data (for testing purposes only)
 * - Deletes users from auth and soft-deletes profiles
 * - Only works in test environment
 *
 * Parameters:
 * - userIds (string[]): Array of user IDs to clean up
 *
 * Returns:
 * - Promise<void>: No return value
 */
export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  if (env.NODE_ENV !== 'test') {
    logger.warn(LOG_MESSAGES.CLEANUP_CALLED_OUTSIDE_TEST);
    return;
  }

  try {
    for (const userId of userIds) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      await supabaseAdmin
        .from(TABLE_PROFILES)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', userId);
    }
  } catch (err) {
    logger.error({ err, userIds }, LOG_MESSAGES.ERROR_CLEANING_UP_TEST_USERS);
  }
}

/**
 * Function: generateQuizCode
 * Description:
 * - Generate unique quiz code using database function
 * - Throws error if generation fails
 *
 * Returns:
 * - Promise<number>: Unique 6-digit quiz code
 *
 * Throws:
 * - Error: If code generation fails
 */
export async function generateQuizCode(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin.rpc('generate_quiz_code');

    if (error) {
      logger.error({ error }, LOG_MESSAGES.ERROR_GENERATING_QUIZ_CODE);
      throw new Error(ERROR_MESSAGES.FAILED_TO_GENERATE_QUIZ_CODE);
    }

    return data as number;
  } catch (err) {
    logger.error({ err }, LOG_MESSAGES.UNEXPECTED_ERROR_GENERATING_CODE);
    throw err;
  }
}

/**
 * Function: updateQuizQuestionCount
 * Description:
 * - Update quiz question count using database function
 * - Throws error if update fails
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - Promise<void>: No return value
 *
 * Throws:
 * - Error: If update fails
 */
export async function updateQuizQuestionCount(quizId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('update_quiz_question_count', {
      quiz_id: quizId,
    });

    if (error) {
      logger.error({ error, quizId }, LOG_MESSAGES.ERROR_UPDATING_QUESTION_COUNT);
      throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_QUESTION_COUNT);
    }
  } catch (err) {
    logger.error({ err, quizId }, LOG_MESSAGES.UNEXPECTED_ERROR_UPDATING_COUNT);
    throw err;
  }
}

/**
 * Function: incrementQuizPlayCount
 * Description:
 * - Increment quiz play count using database function
 * - Throws error if increment fails
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - Promise<void>: No return value
 *
 * Throws:
 * - Error: If increment fails
 */
export async function incrementQuizPlayCount(quizId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('increment_quiz_play_count', {
      quiz_id: quizId,
    });

    if (error) {
      logger.error({ error, quizId }, LOG_MESSAGES.ERROR_INCREMENTING_PLAY_COUNT);
      throw new Error(ERROR_MESSAGES.FAILED_TO_INCREMENT_PLAY_COUNT);
    }
  } catch (err) {
    logger.error({ err, quizId }, LOG_MESSAGES.UNEXPECTED_ERROR_INCREMENTING_COUNT);
    throw err;
  }
}

/**
 * Function: validateQuizForPublishing
 * Description:
 * - Validate quiz for publishing using database function
 * - Returns false on error or validation failure
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - Promise<boolean>: True if quiz is valid for publishing, false otherwise
 */
export async function validateQuizForPublishing(quizId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('validate_quiz_for_publishing', {
      quiz_id: quizId,
    });

    if (error) {
      logger.error({ error, quizId }, LOG_MESSAGES.ERROR_VALIDATING_QUIZ);
      return false;
    }

    return data as boolean;
  } catch (err) {
    logger.error({ err, quizId }, LOG_MESSAGES.UNEXPECTED_ERROR_VALIDATING);
    return false;
  }
}

/**
 * Function: getQuizForPlay
 * Description:
 * - Get complete quiz data for playing
 * - Uses database function to retrieve quiz with questions
 * - Returns formatted QuizSetComplete object
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - Promise<QuizSetComplete | null>: Complete quiz data or null if not found or error
 */
export async function getQuizForPlay(quizId: string): Promise<QuizSetComplete | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_quiz_for_play', {
      input_quiz_id: quizId,
    });

    if (error) {
      logger.error({ error, quizId }, LOG_MESSAGES.ERROR_GETTING_QUIZ_FOR_PLAY);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const quizData = data[0];
    return {
      id: quizData.quiz_id,
      user_id: DEFAULT_QUIZ_VALUES.USER_ID,
      title: quizData.quiz_title,
      description: quizData.quiz_description,
      thumbnail_url: undefined,
      is_public: DEFAULT_QUIZ_VALUES.IS_PUBLIC,
      difficulty_level: DEFAULT_QUIZ_VALUES.DIFFICULTY_LEVEL,
      category: DEFAULT_QUIZ_VALUES.CATEGORY,
      total_questions: quizData.questions?.length || DEFAULT_QUIZ_VALUES.TOTAL_QUESTIONS,
      times_played: DEFAULT_QUIZ_VALUES.TIMES_PLAYED,
      created_at: DEFAULT_QUIZ_VALUES.CREATED_AT,
      updated_at: DEFAULT_QUIZ_VALUES.UPDATED_AT,
      status: DEFAULT_QUIZ_VALUES.STATUS,
      tags: [...DEFAULT_QUIZ_VALUES.TAGS],
      play_settings: quizData.quiz_settings,
      questions: quizData.questions || [],
    } as QuizSetComplete;
  } catch (err) {
    logger.error({ err, quizId }, LOG_MESSAGES.UNEXPECTED_ERROR_GETTING_QUIZ);
    return null;
  }
}

/**
 * Function: uploadQuizImage
 * Description:
 * - Upload file to quiz images bucket
 * - Returns public URL on success
 *
 * Parameters:
 * - userId (string): User identifier for file path
 * - file (Buffer): File buffer to upload
 * - fileName (string): Name of the file
 * - mimeType (string): MIME type of the file
 *
 * Returns:
 * - Promise<string | null>: Public URL of uploaded image or null on error
 */
export async function uploadQuizImage(
  userId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const filePath = `${userId}/${fileName}`;

    const { error } = await supabaseAdmin.storage.from(BUCKET_QUIZ_IMAGES).upload(filePath, file, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      logger.error({ error, filePath }, LOG_MESSAGES.ERROR_UPLOADING_QUIZ_IMAGE);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET_QUIZ_IMAGES).getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    logger.error({ err, userId, fileName }, LOG_MESSAGES.UNEXPECTED_ERROR_UPLOADING_IMAGE);
    return null;
  }
}

/**
 * Function: deleteQuizImage
 * Description:
 * - Delete quiz image from storage bucket
 *
 * Parameters:
 * - filePath (string): Path to the file in storage
 *
 * Returns:
 * - Promise<boolean>: True if deletion successful, false otherwise
 */
export async function deleteQuizImage(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET_QUIZ_IMAGES).remove([filePath]);

    if (error) {
      logger.error({ error, filePath }, LOG_MESSAGES.ERROR_DELETING_QUIZ_IMAGE);
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, filePath }, LOG_MESSAGES.UNEXPECTED_ERROR_DELETING_IMAGE);
    return false;
  }
}

/**
 * Function: isSupabaseError
 * Description:
 * - Check if error is a Supabase error
 * - Type guard for Supabase error objects
 *
 * Parameters:
 * - error (unknown): Error to check
 *
 * Returns:
 * - boolean: True if error is a Supabase error, false otherwise
 */
export function isSupabaseError(error: unknown): error is { code?: string; message?: string } {
  return Boolean(
    error && typeof error === 'object' && error !== null && ('message' in error || 'code' in error),
  );
}

/**
 * Function: formatSupabaseError
 * Description:
 * - Format Supabase error for API response
 * - Maps Supabase error codes to user-friendly messages
 *
 * Parameters:
 * - error (unknown): Error to format
 *
 * Returns:
 * - { error: string; message: string }: Formatted error response
 */
export function formatSupabaseError(error: unknown): { error: string; message: string } {
  if (!isSupabaseError(error)) {
    return {
      error: ERROR_CODES.DATABASE_ERROR,
      message: ERROR_MESSAGES.UNEXPECTED_DATABASE_ERROR,
    };
  }

  const supabaseError = error as { code?: string; message?: string };

  switch (supabaseError.code) {
    case SUPABASE_ERROR_CODES.NOT_FOUND:
      return {
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.RESOURCE_NOT_FOUND,
      };
    case SUPABASE_ERROR_CODES.UNIQUE_VIOLATION:
      return {
        error: ERROR_CODES.DUPLICATE_VALUE,
        message: ERROR_MESSAGES.DUPLICATE_VALUE,
      };
    case SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION:
      return {
        error: ERROR_CODES.FOREIGN_KEY_VIOLATION,
        message: ERROR_MESSAGES.FOREIGN_KEY_VIOLATION,
      };
    case SUPABASE_ERROR_CODES.INSUFFICIENT_PRIVILEGES:
      return {
        error: ERROR_CODES.INSUFFICIENT_PRIVILEGES,
        message: ERROR_MESSAGES.INSUFFICIENT_PRIVILEGES,
      };
    default:
      return {
        error: ERROR_CODES.DATABASE_ERROR,
        message: supabaseError.message || ERROR_MESSAGES.DATABASE_ERROR,
      };
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
// All exports are in Core Logic and Helper Functions sections
