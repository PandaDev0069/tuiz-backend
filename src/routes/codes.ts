// ====================================================
// File Name   : codes.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-10-09
// Last Update  : 2025-10-09

// Description:
// - Express router for quiz code management endpoints
// - Handles generation, validation, and removal of quiz codes
// - Provides endpoints for checking code availability
// - Manages unique 6-digit code generation for quiz sets

// Notes:
// - Code generation endpoints require authentication via authMiddleware
// - Code availability check is public (no auth required)
// - Uses retry logic to ensure unique code generation
// - Codes are stored in quiz_sets.play_settings JSON field
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { supabaseAdmin, generateQuizCode } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { QuizError } from '../types/quiz';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const DEFAULT_MAX_CODE_GENERATION_ATTEMPTS = 10;
const MIN_CODE_VALUE = 100000;
const MAX_CODE_VALUE = 999999;
const CODE_RADIX = 10;

const TABLE_QUIZ_SETS = 'quiz_sets';
const SELECT_QUIZ_FIELDS = 'id, user_id, play_settings';
const SELECT_PLAY_SETTINGS = 'play_settings';

const ERROR_CODES = {
  NOT_FOUND: 'not_found',
  UPDATE_FAILED: 'update_failed',
  INTERNAL_ERROR: 'internal_error',
  INVALID_CODE: 'invalid_code',
} as const;

const ERROR_MESSAGES = {
  QUIZ_NOT_FOUND_OR_NO_PERMISSION_MODIFY:
    'Quiz not found or you do not have permission to modify it',
  QUIZ_NOT_FOUND_OR_NO_PERMISSION_VIEW: 'Quiz not found or you do not have permission to view it',
  FAILED_TO_UPDATE_QUIZ_WITH_CODE: 'Failed to update quiz with new code',
  FAILED_TO_REMOVE_QUIZ_CODE: 'Failed to remove quiz code',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  CODE_MUST_BE_6_DIGIT: 'Code must be a 6-digit number',
  FAILED_TO_GENERATE_UNIQUE_CODE: 'Failed to generate unique code after maximum attempts',
} as const;

const SUCCESS_MESSAGES = {
  QUIZ_CODE_GENERATED: 'Quiz code generated successfully',
  QUIZ_CODE_REMOVED: 'Quiz code removed successfully',
  QUIZ_CODE_RETRIEVED: 'Quiz code retrieved successfully',
  QUIZ_HAS_NO_CODE: 'Quiz has no code assigned',
  CODE_IS_AVAILABLE: 'Code is available',
  CODE_IS_IN_USE: 'Code is already in use',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_QUIZ_BY_ID: 'Error fetching quiz by ID',
  EXCEPTION_IN_GET_QUIZ_BY_ID: 'Exception in getQuizById',
  ERROR_CHECKING_CODE_AVAILABILITY: 'Error checking code availability',
  EXCEPTION_IN_CHECK_CODE_AVAILABILITY: 'Exception in checkCodeAvailability',
  GENERATED_CODE_EXISTS_RETRYING: 'Generated code already exists, retrying',
  ERROR_GENERATING_CODE_RETRYING: 'Error generating code, retrying',
  ERROR_UPDATING_QUIZ_WITH_NEW_CODE: 'Error updating quiz with new code',
  QUIZ_CODE_GENERATED_SUCCESSFULLY: 'Quiz code generated successfully',
  EXCEPTION_POST_GENERATE_CODE: 'Exception in POST /quiz/:id/generate-code',
  EXCEPTION_GET_CODE_CHECK: 'Exception in GET /quiz/code/check/:code',
  EXCEPTION_GET_QUIZ_CODE: 'Exception in GET /quiz/:id/code',
  ERROR_REMOVING_QUIZ_CODE: 'Error removing quiz code',
  QUIZ_CODE_REMOVED_SUCCESSFULLY: 'Quiz code removed successfully',
  EXCEPTION_DELETE_QUIZ_CODE: 'Exception in DELETE /quiz/:id/code',
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
 * Route: POST /:id/generate-code
 * Description:
 * - Generate unique code for quiz
 * - Requires authentication via authMiddleware
 * - Verifies user owns the quiz before generating code
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Generated code with quiz information
 * - 404: Quiz not found or no permission
 * - 500: Server error
 */
router.post('/:id/generate-code', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION_MODIFY,
        requestId,
      } as QuizError);
    }

    const newCode = await generateUniqueCode();

    const { data: updatedQuiz, error: updateError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({
        play_settings: {
          ...quiz.play_settings,
          code: newCode,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(SELECT_PLAY_SETTINGS)
      .single();

    if (updateError) {
      logger.error(
        { error: updateError, quizId: id, userId, newCode, requestId },
        LOG_MESSAGES.ERROR_UPDATING_QUIZ_WITH_NEW_CODE,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UPDATE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_UPDATE_QUIZ_WITH_CODE,
        requestId,
      } as QuizError);
    }

    logger.info(
      { quizId: id, userId, newCode, requestId },
      LOG_MESSAGES.QUIZ_CODE_GENERATED_SUCCESSFULLY,
    );

    return res.status(HTTP_STATUS_OK).json({
      message: SUCCESS_MESSAGES.QUIZ_CODE_GENERATED,
      code: newCode,
      quiz: {
        id,
        play_settings: updatedQuiz.play_settings,
      },
    });
  } catch (error) {
    logger.error({ error, quizId: id, requestId }, LOG_MESSAGES.EXCEPTION_POST_GENERATE_CODE);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    } as QuizError);
  }
});

/**
 * Route: GET /code/check/:code
 * Description:
 * - Check code availability
 * - Public access (no authentication required)
 * - Validates code format and checks if code is already in use
 *
 * Parameters:
 * - req.params.code: Code to check (6-digit number)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Code availability status
 * - 400: Invalid code format
 * - 500: Server error
 */
router.get('/code/check/:code', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { code } = req.params;

  try {
    const codeNumber = parseInt(code, CODE_RADIX);

    if (isNaN(codeNumber) || codeNumber < MIN_CODE_VALUE || codeNumber > MAX_CODE_VALUE) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_CODE,
        message: ERROR_MESSAGES.CODE_MUST_BE_6_DIGIT,
        requestId,
      } as QuizError);
    }

    const { isAvailable, quizId } = await checkCodeAvailability(codeNumber);

    return res.status(HTTP_STATUS_OK).json({
      code: codeNumber,
      isAvailable,
      quizId: quizId || null,
      message: isAvailable ? SUCCESS_MESSAGES.CODE_IS_AVAILABLE : SUCCESS_MESSAGES.CODE_IS_IN_USE,
    });
  } catch (error) {
    logger.error({ error, code, requestId }, LOG_MESSAGES.EXCEPTION_GET_CODE_CHECK);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    } as QuizError);
  }
});

/**
 * Route: GET /:id/code
 * Description:
 * - Get current quiz code
 * - Requires authentication via authMiddleware
 * - Verifies user owns the quiz before returning code
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Current quiz code information
 * - 404: Quiz not found or no permission
 * - 500: Server error
 */
router.get('/:id/code', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION_VIEW,
        requestId,
      } as QuizError);
    }

    const currentCode = quiz.play_settings?.code;

    return res.status(HTTP_STATUS_OK).json({
      quizId: id,
      code: currentCode || null,
      hasCode: !!currentCode,
      message: currentCode
        ? SUCCESS_MESSAGES.QUIZ_CODE_RETRIEVED
        : SUCCESS_MESSAGES.QUIZ_HAS_NO_CODE,
    });
  } catch (error) {
    logger.error({ error, quizId: id, requestId }, LOG_MESSAGES.EXCEPTION_GET_QUIZ_CODE);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    } as QuizError);
  }
});

/**
 * Route: DELETE /:id/code
 * Description:
 * - Remove quiz code
 * - Requires authentication via authMiddleware
 * - Verifies user owns the quiz before removing code
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Success message with updated quiz information
 * - 404: Quiz not found or no permission
 * - 500: Server error
 */
router.delete('/:id/code', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION_MODIFY,
        requestId,
      } as QuizError);
    }

    const { data: updatedQuiz, error: updateError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({
        play_settings: {
          ...quiz.play_settings,
          code: null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(SELECT_PLAY_SETTINGS)
      .single();

    if (updateError) {
      logger.error(
        { error: updateError, quizId: id, userId, requestId },
        LOG_MESSAGES.ERROR_REMOVING_QUIZ_CODE,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UPDATE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_REMOVE_QUIZ_CODE,
        requestId,
      } as QuizError);
    }

    logger.info({ quizId: id, userId, requestId }, LOG_MESSAGES.QUIZ_CODE_REMOVED_SUCCESSFULLY);

    return res.status(HTTP_STATUS_OK).json({
      message: SUCCESS_MESSAGES.QUIZ_CODE_REMOVED,
      quiz: {
        id,
        play_settings: updatedQuiz.play_settings,
      },
    });
  } catch (error) {
    logger.error({ error, quizId: id, requestId }, LOG_MESSAGES.EXCEPTION_DELETE_QUIZ_CODE);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    } as QuizError);
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: getQuizById
 * Description:
 * - Fetches quiz by ID and verifies user ownership
 * - Returns null on error or if quiz not found
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - userId (string): User identifier for ownership verification
 *
 * Returns:
 * - Promise<{ id: string; user_id: string; play_settings: Record<string, unknown> } | null>:
 *   Quiz data or null if not found or error
 */
async function getQuizById(
  quizId: string,
  userId: string,
): Promise<{ id: string; user_id: string; play_settings: Record<string, unknown> } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(SELECT_QUIZ_FIELDS)
      .eq('id', quizId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error({ error, quizId, userId }, LOG_MESSAGES.ERROR_FETCHING_QUIZ_BY_ID);
      return null;
    }

    return data;
  } catch (error) {
    logger.error({ error, quizId, userId }, LOG_MESSAGES.EXCEPTION_IN_GET_QUIZ_BY_ID);
    return null;
  }
}

/**
 * Function: checkCodeAvailability
 * Description:
 * - Checks if a code is available (not already in use)
 * - Returns availability status and associated quiz ID if in use
 *
 * Parameters:
 * - code (number): Code to check
 *
 * Returns:
 * - Promise<{ isAvailable: boolean; quizId?: string }>: Availability status and quiz ID if in use
 */
async function checkCodeAvailability(
  code: number,
): Promise<{ isAvailable: boolean; quizId?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select('id')
      .eq('play_settings->code', code)
      .maybeSingle();

    if (error) {
      logger.error({ error, code }, LOG_MESSAGES.ERROR_CHECKING_CODE_AVAILABILITY);
      return { isAvailable: false };
    }

    return {
      isAvailable: !data,
      quizId: data?.id,
    };
  } catch (error) {
    logger.error({ error, code }, LOG_MESSAGES.EXCEPTION_IN_CHECK_CODE_AVAILABILITY);
    return { isAvailable: false };
  }
}

/**
 * Function: generateUniqueCode
 * Description:
 * - Generates a unique quiz code with retry logic
 * - Attempts to generate an available code up to maxAttempts times
 * - Throws error if unique code cannot be generated
 *
 * Parameters:
 * - maxAttempts (number, optional): Maximum number of generation attempts (default: 10)
 *
 * Returns:
 * - Promise<number>: Unique 6-digit code
 *
 * Throws:
 * - Error: If unique code cannot be generated after maximum attempts
 */
async function generateUniqueCode(
  maxAttempts: number = DEFAULT_MAX_CODE_GENERATION_ATTEMPTS,
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const code = await generateQuizCode();
      const { isAvailable } = await checkCodeAvailability(code);

      if (isAvailable) {
        return code;
      }

      logger.warn({ code, attempt: attempt + 1 }, LOG_MESSAGES.GENERATED_CODE_EXISTS_RETRYING);
    } catch (error) {
      logger.error({ error, attempt: attempt + 1 }, LOG_MESSAGES.ERROR_GENERATING_CODE_RETRYING);
    }
  }

  throw new Error(ERROR_MESSAGES.FAILED_TO_GENERATE_UNIQUE_CODE);
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
