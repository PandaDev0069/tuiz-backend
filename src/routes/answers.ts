// ====================================================
// File Name   : answers.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2025-09-10

// Description:
// - Express router for answer management endpoints
// - Handles CRUD operations for quiz question answers
// - Validates answer constraints based on question types
// - Enforces business rules for answer counts and correctness

// Notes:
// - All endpoints require authentication via authMiddleware
// - Rate limiting applied via answerRateLimit middleware
// - Uses Zod schemas for request validation
// - Validates question type constraints (True/False: 2 answers, Multiple Choice: max 4)
// - Ensures exactly one correct answer per question
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { supabaseAdmin, createAuthenticatedClient } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { answerRateLimit } from '../middleware/rateLimit';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateAnswerSchema,
  AnswerResponse,
  QuizError,
  CreateAnswerInput,
  QuestionType,
} from '../types/quiz';
import { logger } from '../utils/logger';
import { validateRequest } from '../utils/quizValidation';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_NO_CONTENT = 204;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const AUTH_HEADER_PREFIX = 'Bearer ';
const AUTH_HEADER_PREFIX_LENGTH = AUTH_HEADER_PREFIX.length;

const MAX_ANSWERS_TRUE_FALSE = 2;
const MAX_ANSWERS_MULTIPLE_CHOICE = 4;
const REQUIRED_CORRECT_ANSWERS = 1;

const TABLE_QUIZ_SETS = 'quiz_sets';
const TABLE_QUESTIONS = 'questions';
const TABLE_ANSWERS = 'answers';
const SELECT_QUIZ_FIELDS = 'id, user_id';
const SELECT_QUESTION_FIELDS = 'id, question_type, question_set_id';
const SELECT_ANSWER_FIELDS = 'id, is_correct';
const SELECT_ALL = '*';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERROR_CODES = {
  NOT_FOUND: 'not_found',
  VALIDATION_ERROR: 'validation_error',
  UNAUTHORIZED: 'unauthorized',
  CREATION_FAILED: 'creation_failed',
  UPDATE_FAILED: 'update_failed',
  DELETE_FAILED: 'delete_failed',
  INTERNAL_ERROR: 'internal_error',
} as const;

const ERROR_MESSAGES = {
  QUIZ_NOT_FOUND_OR_NO_PERMISSION: 'Quiz not found or you do not have permission to modify it',
  QUESTION_NOT_FOUND: 'Question not found',
  ANSWER_NOT_FOUND: 'Answer not found',
  NO_VALID_SESSION_TOKEN: 'No valid session token provided',
  FAILED_TO_CREATE_ANSWER: 'Failed to create answer',
  FAILED_TO_UPDATE_ANSWER: 'Failed to update answer',
  FAILED_TO_DELETE_ANSWER: 'Failed to delete answer',
  FAILED_TO_VALIDATE_CONSTRAINTS: 'Failed to validate answer constraints',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  TRUE_FALSE_MAX_ANSWERS: 'True/False questions can only have 2 answers',
  MULTIPLE_CHOICE_MAX_ANSWERS: 'Multiple choice questions can have at most 4 answers',
  MUST_HAVE_ONE_CORRECT: 'Must have exactly one correct answer',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_QUIZ_BY_ID: 'Error fetching quiz by ID',
  EXCEPTION_IN_GET_QUIZ_BY_ID: 'Exception in getQuizById',
  ERROR_FETCHING_QUESTION_BY_ID: 'Error fetching question by ID',
  EXCEPTION_IN_GET_QUESTION_BY_ID: 'Exception in getQuestionById',
  EXCEPTION_IN_GET_QUESTION_BY_ID_ONLY: 'Exception in getQuestionByIdOnly',
  INVALID_UUID_FORMAT: 'Invalid UUID format for answer ID',
  ERROR_FETCHING_ANSWER_BY_ID: 'Error fetching answer by ID',
  EXCEPTION_IN_GET_ANSWER_BY_ID: 'Exception in getAnswerById',
  ERROR_FETCHING_EXISTING_ANSWERS: 'Error fetching existing answers',
  EXCEPTION_IN_VALIDATE_ANSWER_CONSTRAINTS: 'Exception in validateAnswerConstraints',
  ERROR_CREATING_ANSWER: 'Error creating answer',
  ANSWER_CREATED_SUCCESSFULLY: 'Answer created successfully',
  EXCEPTION_POST_ANSWER: 'Exception in POST /quiz/:quizId/questions/:questionId/answers',
  ERROR_UPDATING_ANSWER: 'Error updating answer',
  ANSWER_UPDATED_SUCCESSFULLY: 'Answer updated successfully',
  EXCEPTION_PUT_ANSWER: 'Exception in PUT /quiz/:quizId/questions/:questionId/answers/:answerId',
  ERROR_DELETING_ANSWER: 'Error deleting answer',
  ANSWER_DELETED_SUCCESSFULLY: 'Answer deleted successfully',
  EXCEPTION_DELETE_ANSWER:
    'Exception in DELETE /quiz/:quizId/questions/:questionId/answers/:answerId',
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
 * - Promise<{ id: string; user_id: string } | null>: Quiz data or null if not found or error
 */
async function getQuizById(
  quizId: string,
  userId: string,
): Promise<{ id: string; user_id: string } | null> {
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
 * Function: getQuestionById
 * Description:
 * - Fetches question by ID and verifies it belongs to the quiz
 * - Returns null on error or if question not found
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - Promise<{ id: string; question_type: QuestionType; question_set_id: string } | null>:
 *   Question data or null if not found or error
 */
async function getQuestionById(
  questionId: string,
  quizId: string,
): Promise<{ id: string; question_type: QuestionType; question_set_id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(SELECT_QUESTION_FIELDS)
      .eq('id', questionId)
      .eq('question_set_id', quizId)
      .maybeSingle();

    if (error) {
      logger.error({ error, questionId, quizId }, LOG_MESSAGES.ERROR_FETCHING_QUESTION_BY_ID);
      return null;
    }

    return data;
  } catch (error) {
    logger.error({ error, questionId, quizId }, LOG_MESSAGES.EXCEPTION_IN_GET_QUESTION_BY_ID);
    return null;
  }
}

/**
 * Function: getQuestionByIdOnly
 * Description:
 * - Fetches question by ID without quiz verification
 * - Returns null on error or if question not found
 *
 * Parameters:
 * - questionId (string): Question identifier
 *
 * Returns:
 * - Promise<{ id: string; question_type: QuestionType; question_set_id: string } | null>:
 *   Question data or null if not found or error
 */
async function getQuestionByIdOnly(
  questionId: string,
): Promise<{ id: string; question_type: QuestionType; question_set_id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(SELECT_QUESTION_FIELDS)
      .eq('id', questionId)
      .maybeSingle();

    if (error) {
      logger.error({ error, questionId }, LOG_MESSAGES.ERROR_FETCHING_QUESTION_BY_ID);
      return null;
    }

    return data;
  } catch (error) {
    logger.error({ error, questionId }, LOG_MESSAGES.EXCEPTION_IN_GET_QUESTION_BY_ID_ONLY);
    return null;
  }
}

/**
 * Function: getAnswerById
 * Description:
 * - Fetches answer by ID and validates UUID format
 * - Returns null on error or if answer not found
 *
 * Parameters:
 * - answerId (string): Answer identifier
 * - questionId (string): Question identifier
 *
 * Returns:
 * - Promise<AnswerResponse | null>: Answer data or null if not found or error
 */
async function getAnswerById(answerId: string, questionId: string): Promise<AnswerResponse | null> {
  try {
    if (!UUID_REGEX.test(answerId)) {
      logger.warn({ answerId, questionId }, LOG_MESSAGES.INVALID_UUID_FORMAT);
      return null;
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE_ANSWERS)
      .select(SELECT_ALL)
      .eq('id', answerId)
      .eq('question_id', questionId)
      .maybeSingle();

    if (error) {
      logger.error({ error, answerId, questionId }, LOG_MESSAGES.ERROR_FETCHING_ANSWER_BY_ID);
      return null;
    }

    return data as AnswerResponse;
  } catch (error) {
    logger.error({ error, answerId, questionId }, LOG_MESSAGES.EXCEPTION_IN_GET_ANSWER_BY_ID);
    return null;
  }
}

/**
 * Function: fetchExistingAnswers
 * Description:
 * - Fetches existing answers for a question
 * - Optionally excludes a specific answer ID
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - excludeAnswerId (string, optional): Answer ID to exclude from results
 *
 * Returns:
 * - Promise<{ data: { id: string; is_correct: boolean }[] | null; error: Error | null }>:
 *   Answer data with error status
 */
async function fetchExistingAnswers(
  questionId: string,
  excludeAnswerId?: string,
): Promise<{ data: { id: string; is_correct: boolean }[] | null; error: Error | null }> {
  let query = supabaseAdmin
    .from(TABLE_ANSWERS)
    .select(SELECT_ANSWER_FIELDS)
    .eq('question_id', questionId);

  if (excludeAnswerId) {
    query = query.neq('id', excludeAnswerId);
  }

  return await query;
}

/**
 * Function: calculateAnswerCounts
 * Description:
 * - Calculates total answers and correct answers after an operation
 * - Handles both creation and update scenarios
 *
 * Parameters:
 * - existingAnswers (array): Array of existing answers
 * - answerData (CreateAnswerInput): New or updated answer data
 * - excludeAnswerId (string, optional): Answer ID being updated (if update operation)
 *
 * Returns:
 * - { totalAnswers: number; totalCorrectAnswers: number }: Calculated counts
 */
function calculateAnswerCounts(
  existingAnswers: { id: string; is_correct: boolean }[],
  answerData: CreateAnswerInput,
  excludeAnswerId?: string,
): { totalAnswers: number; totalCorrectAnswers: number } {
  const existingAnswerList = existingAnswers || [];
  const correctAnswers = existingAnswerList.filter((answer) => answer.is_correct);

  const totalAnswersAfterOperation = excludeAnswerId
    ? existingAnswerList.length
    : existingAnswerList.length + 1;

  let totalCorrectAnswersAfterOperation = correctAnswers.length;

  if (excludeAnswerId) {
    const existingAnswer = existingAnswerList.find((a) => a.id === excludeAnswerId);
    if (existingAnswer?.is_correct && !answerData.is_correct) {
      totalCorrectAnswersAfterOperation--;
    } else if (!existingAnswer?.is_correct && answerData.is_correct) {
      totalCorrectAnswersAfterOperation++;
    }
  } else {
    if (answerData.is_correct) {
      totalCorrectAnswersAfterOperation++;
    }
  }

  return {
    totalAnswers: totalAnswersAfterOperation,
    totalCorrectAnswers: totalCorrectAnswersAfterOperation,
  };
}

/**
 * Function: validateQuestionTypeConstraints
 * Description:
 * - Validates answer count constraints based on question type
 * - True/False: max 2 answers
 * - Multiple Choice: max 4 answers
 *
 * Parameters:
 * - questionType (QuestionType): Type of question
 * - totalAnswers (number): Total number of answers
 *
 * Returns:
 * - { isValid: boolean; message?: string }: Validation result
 */
function validateQuestionTypeConstraints(
  questionType: QuestionType,
  totalAnswers: number,
): { isValid: boolean; message?: string } {
  if (questionType === QuestionType.TRUE_FALSE) {
    if (totalAnswers > MAX_ANSWERS_TRUE_FALSE) {
      return { isValid: false, message: ERROR_MESSAGES.TRUE_FALSE_MAX_ANSWERS };
    }
  } else if (questionType === QuestionType.MULTIPLE_CHOICE) {
    if (totalAnswers > MAX_ANSWERS_MULTIPLE_CHOICE) {
      return { isValid: false, message: ERROR_MESSAGES.MULTIPLE_CHOICE_MAX_ANSWERS };
    }
  }

  return { isValid: true };
}

/**
 * Function: validateCorrectAnswerConstraint
 * Description:
 * - Validates that exactly one answer is marked as correct
 *
 * Parameters:
 * - totalCorrectAnswers (number): Total number of correct answers
 *
 * Returns:
 * - { isValid: boolean; message?: string }: Validation result
 */
function validateCorrectAnswerConstraint(totalCorrectAnswers: number): {
  isValid: boolean;
  message?: string;
} {
  if (totalCorrectAnswers !== REQUIRED_CORRECT_ANSWERS) {
    return { isValid: false, message: ERROR_MESSAGES.MUST_HAVE_ONE_CORRECT };
  }
  return { isValid: true };
}

/**
 * Function: validateAnswerConstraints
 * Description:
 * - Validates all answer constraints for a question
 * - Checks question type limits and correct answer count
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - answerData (CreateAnswerInput): Answer data to validate
 * - excludeAnswerId (string, optional): Answer ID to exclude (for updates)
 *
 * Returns:
 * - Promise<{ isValid: boolean; message?: string }>: Validation result
 */
async function validateAnswerConstraints(
  questionId: string,
  answerData: CreateAnswerInput,
  excludeAnswerId?: string,
): Promise<{ isValid: boolean; message?: string }> {
  try {
    const { data: existingAnswers, error } = await fetchExistingAnswers(
      questionId,
      excludeAnswerId,
    );

    if (error) {
      logger.error({ error, questionId }, LOG_MESSAGES.ERROR_FETCHING_EXISTING_ANSWERS);
      return { isValid: false, message: ERROR_MESSAGES.FAILED_TO_VALIDATE_CONSTRAINTS };
    }

    const question = await getQuestionByIdOnly(questionId);
    if (!question) {
      return { isValid: false, message: ERROR_MESSAGES.QUESTION_NOT_FOUND };
    }

    const { totalAnswers, totalCorrectAnswers } = calculateAnswerCounts(
      existingAnswers || [],
      answerData,
      excludeAnswerId,
    );

    const typeValidation = validateQuestionTypeConstraints(question.question_type, totalAnswers);
    if (!typeValidation.isValid) {
      return typeValidation;
    }

    const correctAnswerValidation = validateCorrectAnswerConstraint(totalCorrectAnswers);
    if (!correctAnswerValidation.isValid) {
      return correctAnswerValidation;
    }

    return { isValid: true };
  } catch (error) {
    logger.error({ error, questionId }, LOG_MESSAGES.EXCEPTION_IN_VALIDATE_ANSWER_CONSTRAINTS);
    return { isValid: false, message: ERROR_MESSAGES.FAILED_TO_VALIDATE_CONSTRAINTS };
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;

// ============================================================================
// ANSWER CRUD ROUTES
// ============================================================================

/**
 * Route: POST /:quizId/questions/:questionId/answers
 * Description:
 * - Add answer to a question
 * - Validates answer constraints based on question type
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.params.questionId: Question identifier
 * - req.body: Answer data (validated by CreateAnswerSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 201: Answer created successfully
 * - 400: Validation error
 * - 401: Unauthorized
 * - 404: Quiz or question not found
 * - 500: Server error
 */
router.post(
  '/:quizId/questions/:questionId/answers',
  answerRateLimit,
  authMiddleware,
  validateRequest(CreateAnswerSchema),
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { quizId, questionId } = req.params;
    const userId = req.user!.id;
    const answerData = req.body as CreateAnswerInput;

    try {
      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
          requestId,
        } as QuizError);
      }

      const question = await getQuestionById(questionId, quizId);
      if (!question) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUESTION_NOT_FOUND,
          requestId,
        } as QuizError);
      }

      const validation = await validateAnswerConstraints(questionId, answerData);
      if (!validation.isValid) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.VALIDATION_ERROR,
          message: validation.message,
          requestId,
        } as QuizError);
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith(AUTH_HEADER_PREFIX)) {
        return res.status(HTTP_STATUS_UNAUTHORIZED).json({
          error: ERROR_CODES.UNAUTHORIZED,
          message: ERROR_MESSAGES.NO_VALID_SESSION_TOKEN,
          requestId,
        } as QuizError);
      }

      const token = authHeader.substring(AUTH_HEADER_PREFIX_LENGTH).trim();
      if (!token) {
        return res.status(HTTP_STATUS_UNAUTHORIZED).json({
          error: ERROR_CODES.UNAUTHORIZED,
          message: ERROR_MESSAGES.NO_VALID_SESSION_TOKEN,
          requestId,
        } as QuizError);
      }

      const supabase = createAuthenticatedClient(token);

      const { data: answer, error: answerError } = await supabase
        .from(TABLE_ANSWERS)
        .insert({
          question_id: questionId,
          answer_text: answerData.answer_text,
          image_url: answerData.image_url || null,
          is_correct: answerData.is_correct,
          order_index: answerData.order_index,
        })
        .select()
        .single();

      if (answerError) {
        logger.error(
          { error: answerError, questionId, quizId, userId, answerData, requestId },
          LOG_MESSAGES.ERROR_CREATING_ANSWER,
        );
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.CREATION_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_CREATE_ANSWER,
          requestId,
        } as QuizError);
      }

      logger.info(
        { answerId: answer.id, questionId, quizId, userId, requestId },
        LOG_MESSAGES.ANSWER_CREATED_SUCCESSFULLY,
      );

      return res.status(HTTP_STATUS_CREATED).json({
        id: answer.id,
        question_id: answer.question_id,
        answer_text: answer.answer_text,
        image_url: answer.image_url,
        is_correct: answer.is_correct,
        order_index: answer.order_index,
        created_at: answer.created_at,
        updated_at: answer.updated_at,
      } as AnswerResponse);
    } catch (error) {
      logger.error({ error, questionId, quizId, requestId }, LOG_MESSAGES.EXCEPTION_POST_ANSWER);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        requestId,
      } as QuizError);
    }
  },
);

/**
 * Route: PUT /:quizId/questions/:questionId/answers/:answerId
 * Description:
 * - Update an existing answer
 * - Validates answer constraints based on question type
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.params.questionId: Question identifier
 * - req.params.answerId: Answer identifier
 * - req.body: Answer data (validated by CreateAnswerSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Answer updated successfully
 * - 400: Validation error
 * - 401: Unauthorized
 * - 404: Quiz, question, or answer not found
 * - 500: Server error
 */
router.put(
  '/:quizId/questions/:questionId/answers/:answerId',
  answerRateLimit,
  authMiddleware,
  validateRequest(CreateAnswerSchema),
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { quizId, questionId, answerId } = req.params;
    const userId = req.user!.id;
    const answerData = req.body as CreateAnswerInput;

    try {
      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
          requestId,
        } as QuizError);
      }

      const question = await getQuestionById(questionId, quizId);
      if (!question) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUESTION_NOT_FOUND,
          requestId,
        } as QuizError);
      }

      const existingAnswer = await getAnswerById(answerId, questionId);
      if (!existingAnswer) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.ANSWER_NOT_FOUND,
          requestId,
        } as QuizError);
      }

      const validation = await validateAnswerConstraints(questionId, answerData, answerId);
      if (!validation.isValid) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.VALIDATION_ERROR,
          message: validation.message,
          requestId,
        } as QuizError);
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith(AUTH_HEADER_PREFIX)) {
        return res.status(HTTP_STATUS_UNAUTHORIZED).json({
          error: ERROR_CODES.UNAUTHORIZED,
          message: ERROR_MESSAGES.NO_VALID_SESSION_TOKEN,
          requestId,
        } as QuizError);
      }

      const token = authHeader.substring(AUTH_HEADER_PREFIX_LENGTH).trim();
      if (!token) {
        return res.status(HTTP_STATUS_UNAUTHORIZED).json({
          error: ERROR_CODES.UNAUTHORIZED,
          message: ERROR_MESSAGES.NO_VALID_SESSION_TOKEN,
          requestId,
        } as QuizError);
      }

      const supabase = createAuthenticatedClient(token);

      const { data: answer, error: answerError } = await supabase
        .from(TABLE_ANSWERS)
        .update({
          answer_text: answerData.answer_text,
          image_url: answerData.image_url || null,
          is_correct: answerData.is_correct,
          order_index: answerData.order_index,
          updated_at: new Date().toISOString(),
        })
        .eq('id', answerId)
        .eq('question_id', questionId)
        .select()
        .single();

      if (answerError) {
        logger.error(
          { error: answerError, answerId, questionId, quizId, userId, answerData, requestId },
          LOG_MESSAGES.ERROR_UPDATING_ANSWER,
        );
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.UPDATE_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_UPDATE_ANSWER,
          requestId,
        } as QuizError);
      }

      logger.info(
        { answerId, questionId, quizId, userId, requestId },
        LOG_MESSAGES.ANSWER_UPDATED_SUCCESSFULLY,
      );

      return res.status(HTTP_STATUS_OK).json({
        id: answer.id,
        question_id: answer.question_id,
        answer_text: answer.answer_text,
        image_url: answer.image_url,
        is_correct: answer.is_correct,
        order_index: answer.order_index,
        created_at: answer.created_at,
        updated_at: answer.updated_at,
      } as AnswerResponse);
    } catch (error) {
      logger.error(
        { error, answerId, questionId, quizId, requestId },
        LOG_MESSAGES.EXCEPTION_PUT_ANSWER,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        requestId,
      } as QuizError);
    }
  },
);

/**
 * Route: DELETE /:quizId/questions/:questionId/answers/:answerId
 * Description:
 * - Delete an answer
 * - Requires authentication via authMiddleware
 * - No constraint validation on delete
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.params.questionId: Question identifier
 * - req.params.answerId: Answer identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 204: Answer deleted successfully
 * - 404: Quiz, question, or answer not found
 * - 500: Server error
 */
router.delete(
  '/:quizId/questions/:questionId/answers/:answerId',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { quizId, questionId, answerId } = req.params;
    const userId = req.user!.id;

    try {
      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
          requestId,
        } as QuizError);
      }

      const question = await getQuestionById(questionId, quizId);
      if (!question) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUESTION_NOT_FOUND,
          requestId,
        } as QuizError);
      }

      const existingAnswer = await getAnswerById(answerId, questionId);
      if (!existingAnswer) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.ANSWER_NOT_FOUND,
          requestId,
        } as QuizError);
      }

      const { error } = await supabaseAdmin
        .from(TABLE_ANSWERS)
        .delete()
        .eq('id', answerId)
        .eq('question_id', questionId);

      if (error) {
        logger.error(
          { error, answerId, questionId, quizId, userId, requestId },
          LOG_MESSAGES.ERROR_DELETING_ANSWER,
        );
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.DELETE_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_DELETE_ANSWER,
          requestId,
        } as QuizError);
      }

      logger.info(
        { answerId, questionId, quizId, userId, requestId },
        LOG_MESSAGES.ANSWER_DELETED_SUCCESSFULLY,
      );

      return res.status(HTTP_STATUS_NO_CONTENT).send();
    } catch (error) {
      logger.error(
        { error, answerId, questionId, quizId, requestId },
        LOG_MESSAGES.EXCEPTION_DELETE_ANSWER,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        requestId,
      } as QuizError);
    }
  },
);

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
