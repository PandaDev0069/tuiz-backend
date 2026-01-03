// ====================================================
// File Name   : auth.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2025-09-10

// Description:
// - Authentication middleware for Express routes
// - Verifies JWT tokens using Supabase Auth
// - Injects user context into request object
// - Protects routes requiring authentication

// Notes:
// - Uses Supabase's built-in JWT verification
// - Extracts Bearer token from Authorization header
// - Returns 401 for invalid or missing tokens
// - Adds user data to request.user for downstream handlers
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const AUTH_HEADER_PREFIX = 'Bearer ';
const AUTH_HEADER_PREFIX_LENGTH = AUTH_HEADER_PREFIX.length;

const ERROR_CODES = {
  UNAUTHORIZED: 'unauthorized',
  INTERNAL_ERROR: 'internal_error',
} as const;

const ERROR_MESSAGES = {
  NO_VALID_SESSION_TOKEN: 'No valid session token provided',
  INVALID_OR_EXPIRED_TOKEN: 'Invalid or expired token',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

const LOG_MESSAGES = {
  JWT_VERIFICATION_FAILED: 'JWT verification failed',
  AUTHENTICATION_MIDDLEWARE_ERROR: 'Authentication middleware error',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Middleware: authMiddleware
 * Description:
 * - Authenticates requests using JWT tokens
 * - Verifies token with Supabase Auth
 * - Injects user context into request object
 *
 * Parameters:
 * - req (AuthenticatedRequest): Express request with user property
 * - res (Response): Express response object
 * - next (NextFunction): Express next function
 *
 * Returns:
 * - void: Calls next() on success or sends error response
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith(AUTH_HEADER_PREFIX)) {
      res.status(HTTP_STATUS_UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: ERROR_MESSAGES.NO_VALID_SESSION_TOKEN,
      });
      return;
    }

    const token = authHeader.substring(AUTH_HEADER_PREFIX_LENGTH).trim();

    if (!token) {
      res.status(HTTP_STATUS_UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: ERROR_MESSAGES.NO_VALID_SESSION_TOKEN,
      });
      return;
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.debug({ error }, LOG_MESSAGES.JWT_VERIFICATION_FAILED);
      res.status(HTTP_STATUS_UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN,
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email!,
      username: user.user_metadata?.username,
      displayName: user.user_metadata?.display_name,
    };

    next();
  } catch (error) {
    logger.error({ error }, LOG_MESSAGES.AUTHENTICATION_MIDDLEWARE_ERROR);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
}

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
// No helper functions - all logic in Core Logic section

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
// Export is in Core Logic section
