// ====================================================
// File Name   : auth.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-22
// Last Update : 2025-08-22

// Description:
// - Express router for authentication endpoints
// - Handles user registration, login, and logout
// - Manages Supabase Auth integration
// - Provides user profile data with authentication responses

// Notes:
// - All endpoints are public (no auth middleware required)
// - Uses Zod schemas for request validation
// - Updates user last_active timestamp on login
// - Handles session management via Supabase Auth
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase';
import type { AuthResponse, AuthError } from '../types/auth';
import { logger } from '../utils/logger';
import { RegisterSchema, LoginSchema } from '../utils/validation';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const DEFAULT_SESSION_EXPIRY_SECONDS = 3600;
const MILLISECONDS_TO_SECONDS = 1000;
const AUTH_HEADER_PREFIX = 'Bearer ';
const AUTH_HEADER_PREFIX_LENGTH = AUTH_HEADER_PREFIX.length;

const TABLE_PROFILES = 'profiles';
const SELECT_PROFILE_FIELDS = 'username, display_name, role';
const RPC_UPDATE_LAST_ACTIVE = 'update_last_active';

const ENV_TEST = 'test';
const ERROR_NAME_AUTH_SESSION_MISSING = 'AuthSessionMissingError';
const ERROR_MESSAGE_ALREADY_REGISTERED = 'already registered';

const ERROR_CODES = {
  INVALID_PAYLOAD: 'invalid_payload',
  DUPLICATE_EMAIL: 'duplicate_email',
  REGISTRATION_FAILED: 'registration_failed',
  INVALID_CREDENTIALS: 'invalid_credentials',
  UNAUTHORIZED: 'unauthorized',
  INTERNAL_ERROR: 'internal_error',
} as const;

const ERROR_MESSAGES = {
  INVALID_REQUEST_DATA: 'Invalid request data',
  ACCOUNT_ALREADY_EXISTS: 'An account with this email already exists',
  REGISTRATION_FAILED: 'Registration failed',
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password',
  NO_VALID_SESSION_TOKEN: 'No valid session token provided',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

const SUCCESS_MESSAGES = {
  LOGGED_OUT_SUCCESSFULLY: 'Logged out successfully',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_USER_PROFILE: 'Error fetching user profile',
  SUPABASE_REGISTRATION_ERROR: 'Supabase registration error',
  REGISTRATION_ERROR: 'Registration error',
  ERROR_UPDATING_LAST_ACTIVE: 'Error updating last_active',
  LOGIN_ERROR: 'Login error',
  SESSION_ALREADY_INVALIDATED: 'Session already invalidated or missing during logout',
  LOGOUT_ERROR: 'Logout error',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = express.Router();

/**
 * Route: POST /register
 * Description:
 * - Register a new user account
 * - Creates user in Supabase Auth and profile in database
 * - Returns user data and session tokens
 *
 * Body:
 * - email (string): User email address
 * - password (string): User password
 * - username (string, optional): Username
 * - displayName (string, optional): Display name
 *
 * Returns:
 * - 201: User registered successfully with session data
 * - 400: Invalid request data or registration failed
 * - 409: Email already registered
 * - 500: Server error
 */
router.post('/register', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;

  try {
    const validation = RegisterSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.INVALID_REQUEST_DATA,
        requestId,
      } as AuthError);
    }

    const { email, password, username, displayName } = validation.data;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || null,
          display_name: displayName || username || null,
        },
      },
    });

    if (authError) {
      if (process.env.NODE_ENV !== ENV_TEST) {
        logger.error(
          { error: authError, requestId },
          `${LOG_MESSAGES.SUPABASE_REGISTRATION_ERROR}: ${authError.message}`,
        );
      }

      if (authError.message.includes(ERROR_MESSAGE_ALREADY_REGISTERED)) {
        return res.status(HTTP_STATUS_CONFLICT).json({
          error: ERROR_CODES.DUPLICATE_EMAIL,
          message: ERROR_MESSAGES.ACCOUNT_ALREADY_EXISTS,
          requestId,
        } as AuthError);
      }

      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.REGISTRATION_FAILED,
        message: ERROR_MESSAGES.REGISTRATION_FAILED,
        requestId,
      } as AuthError);
    }

    if (!authData.user || !authData.session) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.REGISTRATION_FAILED,
        message: ERROR_MESSAGES.REGISTRATION_FAILED,
        requestId,
      } as AuthError);
    }

    const profile = await getUserProfile(authData.user.id);

    const response: AuthResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        username: profile?.username || authData.user.user_metadata?.username || null,
        displayName: profile?.display_name || authData.user.user_metadata?.display_name || null,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in || DEFAULT_SESSION_EXPIRY_SECONDS,
        expires_at:
          authData.session.expires_at ||
          Date.now() / MILLISECONDS_TO_SECONDS + DEFAULT_SESSION_EXPIRY_SECONDS,
      },
    };

    return res.status(HTTP_STATUS_CREATED).json(response);
  } catch (error) {
    logger.error({ error, requestId }, LOG_MESSAGES.REGISTRATION_ERROR);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    } as AuthError);
  }
});

/**
 * Route: POST /login
 * Description:
 * - Authenticate user and create session
 * - Updates user last_active timestamp
 * - Returns user data and session tokens
 *
 * Body:
 * - email (string): User email address
 * - password (string): User password
 *
 * Returns:
 * - 200: User logged in successfully with session data
 * - 400: Invalid request data
 * - 401: Invalid credentials
 * - 500: Server error
 */
router.post('/login', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;

  try {
    const validation = LoginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.INVALID_REQUEST_DATA,
        requestId,
      } as AuthError);
    }

    const { email, password } = validation.data;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(HTTP_STATUS_UNAUTHORIZED).json({
        error: ERROR_CODES.INVALID_CREDENTIALS,
        message: ERROR_MESSAGES.INVALID_EMAIL_OR_PASSWORD,
        requestId,
      } as AuthError);
    }

    if (!authData.user || !authData.session) {
      return res.status(HTTP_STATUS_UNAUTHORIZED).json({
        error: ERROR_CODES.INVALID_CREDENTIALS,
        message: ERROR_MESSAGES.INVALID_EMAIL_OR_PASSWORD,
        requestId,
      } as AuthError);
    }

    const profile = await getUserProfile(authData.user.id);

    try {
      await supabaseAdmin.rpc(RPC_UPDATE_LAST_ACTIVE, { user_id: authData.user.id });
    } catch (updateError) {
      logger.error(
        { error: updateError, userId: authData.user.id, requestId },
        LOG_MESSAGES.ERROR_UPDATING_LAST_ACTIVE,
      );
    }

    const response: AuthResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        username: profile?.username || authData.user.user_metadata?.username || null,
        displayName: profile?.display_name || authData.user.user_metadata?.display_name || null,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in || DEFAULT_SESSION_EXPIRY_SECONDS,
        expires_at:
          authData.session.expires_at ||
          Date.now() / MILLISECONDS_TO_SECONDS + DEFAULT_SESSION_EXPIRY_SECONDS,
      },
    };

    return res.status(HTTP_STATUS_OK).json(response);
  } catch (error) {
    logger.error({ error, requestId }, LOG_MESSAGES.LOGIN_ERROR);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    } as AuthError);
  }
});

/**
 * Route: POST /logout
 * Description:
 * - Sign out user session
 * - Invalidates session token via Supabase Auth
 * - Does not fail if session is already invalid
 *
 * Headers:
 * - Authorization: Bearer token
 *
 * Returns:
 * - 200: Logged out successfully
 * - 401: No valid session token provided
 * - 500: Server error
 */
router.post('/logout', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const authHeader = req.headers.authorization;

  try {
    if (!authHeader || !authHeader.startsWith(AUTH_HEADER_PREFIX)) {
      return res.status(HTTP_STATUS_UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: ERROR_MESSAGES.NO_VALID_SESSION_TOKEN,
        requestId,
      } as AuthError);
    }

    const token = authHeader.substring(AUTH_HEADER_PREFIX_LENGTH).trim();

    if (!token) {
      return res.status(HTTP_STATUS_UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: ERROR_MESSAGES.NO_VALID_SESSION_TOKEN,
        requestId,
      } as AuthError);
    }

    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(token);

    if (signOutError) {
      if (signOutError.name === ERROR_NAME_AUTH_SESSION_MISSING) {
        logger.debug({ error: signOutError, requestId }, LOG_MESSAGES.SESSION_ALREADY_INVALIDATED);
      } else {
        logger.error({ error: signOutError, requestId }, LOG_MESSAGES.LOGOUT_ERROR);
      }
    }

    return res.status(HTTP_STATUS_OK).json({
      message: SUCCESS_MESSAGES.LOGGED_OUT_SUCCESSFULLY,
    });
  } catch (error) {
    logger.error({ error, requestId }, LOG_MESSAGES.LOGOUT_ERROR);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    } as AuthError);
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: getUserProfile
 * Description:
 * - Fetches user profile data from database
 * - Returns null on error or if profile not found
 *
 * Parameters:
 * - userId (string): User identifier
 *
 * Returns:
 * - Promise<{ username: string; display_name: string; role: string } | null>:
 *   User profile data or null if not found or error
 */
async function getUserProfile(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from(TABLE_PROFILES)
    .select(SELECT_PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.error({ error, userId }, LOG_MESSAGES.ERROR_FETCHING_USER_PROFILE);
    return null;
  }

  return profile;
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
