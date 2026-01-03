// ====================================================
// File Name   : publishing.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2025-09-10

// Description:
// - Express routes for quiz publishing operations
// - Handles quiz publishing, unpublishing, and validation
// - Validates quiz metadata, questions, and answers before publishing

// Notes:
// - All routes require authentication via authMiddleware
// - Quiz validation includes metadata, questions, and answers
// - Only quiz owners can publish/unpublish their quizzes
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';

import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { QuizStatus, QuizError, QuizSetResponse } from '../types/quiz';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_QUIZ_SETS = 'quiz_sets';
const TABLE_QUESTIONS = 'questions';
const TABLE_ANSWERS = 'answers';

const COLUMN_ID = 'id';
const COLUMN_USER_ID = 'user_id';
const COLUMN_QUESTION_SET_ID = 'question_set_id';
const COLUMN_QUESTION_ID = 'question_id';

const SELECT_ALL = '*';
const SELECT_QUESTION_FIELDS = 'id, question_text';
const SELECT_IS_CORRECT = 'is_correct';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const MIN_QUESTION_COUNT = 1;
const MIN_ANSWER_COUNT = 1;
const REQUIRED_CORRECT_ANSWERS_MIN = 1;
const REQUIRED_CORRECT_ANSWERS_MAX = 1;
const EMPTY_ARRAY_LENGTH = 0;
const EMPTY_STRING_LENGTH = 0;

const ERROR_CODES = {
  NOT_FOUND: 'not_found',
  VALIDATION_FAILED: 'validation_failed',
  PUBLISH_FAILED: 'publish_failed',
  INTERNAL_ERROR: 'internal_error',
  INVALID_STATUS: 'invalid_status',
  UNPUBLISH_FAILED: 'unpublish_failed',
} as const;

const ERROR_MESSAGES = {
  QUIZ_NOT_FOUND_OR_NO_PERMISSION: 'Quiz not found or you do not have permission to modify it',
  QUIZ_NOT_FOUND_OR_NO_PERMISSION_VIEW: 'Quiz not found or you do not have permission to view it',
  QUIZ_CANNOT_BE_PUBLISHED: 'Quiz cannot be published due to validation errors',
  FAILED_TO_PUBLISH_QUIZ: 'Failed to publish quiz',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  QUIZ_NOT_CURRENTLY_PUBLISHED: 'Quiz is not currently published',
  FAILED_TO_UNPUBLISH_QUIZ: 'Failed to unpublish quiz',
  QUIZ_NOT_FOUND: 'Quiz not found',
  FAILED_TO_COUNT_QUESTIONS: 'Failed to count questions',
  QUIZ_MUST_HAVE_AT_LEAST_ONE_QUESTION: 'Quiz must have at least one question',
  FAILED_TO_FETCH_QUESTIONS: 'Failed to fetch questions',
  FAILED_TO_VALIDATE_QUESTIONS: 'Failed to validate questions',
  FAILED_TO_COUNT_ANSWERS: 'Failed to count answers for question:',
  QUESTION_MUST_HAVE_AT_LEAST_ONE_ANSWER: 'Question "',
  QUESTION_MUST_HAVE_ANSWER_SUFFIX: '" must have at least one answer',
  FAILED_TO_FETCH_ANSWERS: 'Failed to fetch answers for question:',
  QUESTION_MUST_HAVE_AT_LEAST_ONE_CORRECT: 'Question "',
  QUESTION_MUST_HAVE_CORRECT_SUFFIX: '" must have at least one correct answer',
  QUESTION_MUST_HAVE_EXACTLY_ONE_CORRECT: 'Question "',
  QUESTION_MUST_HAVE_EXACTLY_ONE_CORRECT_SUFFIX: '" must have exactly one correct answer',
  FAILED_TO_VALIDATE_ANSWERS: 'Failed to validate answers for question:',
  QUIZ_TITLE_REQUIRED: 'Quiz title is required',
  QUIZ_DESCRIPTION_REQUIRED: 'Quiz description is required',
  QUIZ_CATEGORY_REQUIRED: 'Quiz category is required',
  VALIDATION_FAILED_DUE_TO_INTERNAL_ERROR: 'Validation failed due to internal error',
} as const;

const WARNING_MESSAGES = {
  CONSIDER_ADDING_TAGS: 'Consider adding tags to help users find your quiz',
  QUIZ_ALREADY_PUBLISHED: 'Quiz is already published',
} as const;

const SUCCESS_MESSAGES = {
  QUIZ_PUBLISHED_SUCCESSFULLY: 'Quiz published successfully',
  QUIZ_UNPUBLISHED_SUCCESSFULLY: 'Quiz unpublished successfully',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_QUIZ_BY_ID: 'Error fetching quiz by ID',
  EXCEPTION_IN_GET_QUIZ_BY_ID: 'Exception in getQuizById',
  ERROR_FETCHING_QUIZ_FOR_VALIDATION: 'Error fetching quiz for validation',
  EXCEPTION_IN_FETCH_QUIZ_FOR_VALIDATION: 'Exception in fetchQuizForValidation',
  ERROR_COUNTING_QUESTIONS: 'Error counting questions',
  ERROR_FETCHING_QUESTIONS: 'Error fetching questions',
  EXCEPTION_IN_VALIDATE_QUIZ_QUESTIONS: 'Exception in validateQuizQuestions',
  ERROR_COUNTING_ANSWERS: 'Error counting answers',
  ERROR_FETCHING_ANSWERS: 'Error fetching answers',
  EXCEPTION_IN_VALIDATE_QUESTION_ANSWERS: 'Exception in validateQuestionAnswers',
  EXCEPTION_IN_VALIDATE_QUIZ_FOR_PUBLISHING: 'Exception in validateQuizForPublishing',
  ERROR_PUBLISHING_QUIZ: 'Error publishing quiz',
  QUIZ_PUBLISHED_SUCCESSFULLY: 'Quiz published successfully',
  EXCEPTION_IN_POST_PUBLISH: 'Exception in POST /quiz/:id/publish',
  ERROR_UNPUBLISHING_QUIZ: 'Error unpublishing quiz',
  QUIZ_UNPUBLISHED_SUCCESSFULLY: 'Quiz unpublished successfully',
  EXCEPTION_IN_POST_UNPUBLISH: 'Exception in POST /quiz/:id/unpublish',
  EXCEPTION_IN_GET_VALIDATE: 'Exception in GET /quiz/:id/validate',
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
 * Route: POST /:id/publish
 * Description:
 * - Publish a quiz by updating its status to PUBLISHED
 * - Validates quiz before publishing
 * - Returns validation results including errors and warnings
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with published quiz and validation results
 */
router.post('/:id/publish', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
      } as QuizError);
    }

    const validation = await validateQuizForPublishing(id);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_FAILED,
        message: ERROR_MESSAGES.QUIZ_CANNOT_BE_PUBLISHED,
        details: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
      } as QuizError);
    }

    const { data: updatedQuiz, error: updateError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({
        status: QuizStatus.PUBLISHED,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, id)
      .eq(COLUMN_USER_ID, userId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, quizId: id, userId }, LOG_MESSAGES.ERROR_PUBLISHING_QUIZ);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.PUBLISH_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_PUBLISH_QUIZ,
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, LOG_MESSAGES.QUIZ_PUBLISHED_SUCCESSFULLY);

    res.json({
      message: SUCCESS_MESSAGES.QUIZ_PUBLISHED_SUCCESSFULLY,
      quiz: updatedQuiz,
      validation: {
        errors: validation.errors,
        warnings: validation.warnings,
      },
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, LOG_MESSAGES.EXCEPTION_IN_POST_PUBLISH);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: POST /:id/unpublish
 * Description:
 * - Unpublish a quiz by updating its status to DRAFT
 * - Verifies quiz is currently published before unpublishing
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with unpublished quiz
 */
router.post('/:id/unpublish', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
      } as QuizError);
    }

    if (quiz.status !== QuizStatus.PUBLISHED) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_STATUS,
        message: ERROR_MESSAGES.QUIZ_NOT_CURRENTLY_PUBLISHED,
      } as QuizError);
    }

    const { data: updatedQuiz, error: updateError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({
        status: QuizStatus.DRAFT,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, id)
      .eq(COLUMN_USER_ID, userId)
      .select()
      .single();

    if (updateError) {
      logger.error(
        { error: updateError, quizId: id, userId },
        LOG_MESSAGES.ERROR_UNPUBLISHING_QUIZ,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UNPUBLISH_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_UNPUBLISH_QUIZ,
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, LOG_MESSAGES.QUIZ_UNPUBLISHED_SUCCESSFULLY);

    res.json({
      message: SUCCESS_MESSAGES.QUIZ_UNPUBLISHED_SUCCESSFULLY,
      quiz: updatedQuiz,
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, LOG_MESSAGES.EXCEPTION_IN_POST_UNPUBLISH);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: GET /:id/validate
 * Description:
 * - Validate a quiz for publishing readiness
 * - Returns validation results without publishing
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with quiz summary and validation results
 */
router.get('/:id/validate', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION_VIEW,
      } as QuizError);
    }

    const validation = await validateQuizForPublishing(id);

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        status: quiz.status,
        total_questions: quiz.total_questions,
      },
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, LOG_MESSAGES.EXCEPTION_IN_GET_VALIDATE);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: getQuizById
 * Description:
 * - Get quiz by ID and verify user ownership
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - userId (string): User identifier
 *
 * Returns:
 * - QuizSetResponse | null: Quiz data or null if not found
 */
async function getQuizById(quizId: string, userId: string): Promise<QuizSetResponse | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(SELECT_ALL)
      .eq(COLUMN_ID, quizId)
      .eq(COLUMN_USER_ID, userId)
      .maybeSingle();

    if (error) {
      logger.error({ error, quizId, userId }, LOG_MESSAGES.ERROR_FETCHING_QUIZ_BY_ID);
      return null;
    }

    return data as QuizSetResponse;
  } catch (error) {
    logger.error({ error, quizId, userId }, LOG_MESSAGES.EXCEPTION_IN_GET_QUIZ_BY_ID);
    return null;
  }
}

/**
 * Function: fetchQuizForValidation
 * Description:
 * - Fetch quiz by ID for validation purposes
 * - Does not verify user ownership
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - QuizSetResponse | null: Quiz data or null if not found
 */
async function fetchQuizForValidation(quizId: string): Promise<QuizSetResponse | null> {
  try {
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(SELECT_ALL)
      .eq(COLUMN_ID, quizId)
      .maybeSingle();

    if (quizError) {
      logger.error({ error: quizError, quizId }, LOG_MESSAGES.ERROR_FETCHING_QUIZ_FOR_VALIDATION);
      return null;
    }

    return quiz as QuizSetResponse;
  } catch (error) {
    logger.error({ error, quizId }, LOG_MESSAGES.EXCEPTION_IN_FETCH_QUIZ_FOR_VALIDATION);
    return null;
  }
}

/**
 * Function: validateQuizQuestions
 * Description:
 * - Validate that quiz has questions and all questions have valid answers
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - object: Validation result with errors and warnings arrays
 */
async function validateQuizQuestions(quizId: string): Promise<{
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const { count: questionCount, error: questionError } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(SELECT_ALL, { count: 'exact', head: true })
      .eq(COLUMN_QUESTION_SET_ID, quizId);

    if (questionError) {
      logger.error({ error: questionError, quizId }, LOG_MESSAGES.ERROR_COUNTING_QUESTIONS);
      return { errors: [ERROR_MESSAGES.FAILED_TO_COUNT_QUESTIONS], warnings: [] };
    }

    if (!questionCount || questionCount < MIN_QUESTION_COUNT) {
      errors.push(ERROR_MESSAGES.QUIZ_MUST_HAVE_AT_LEAST_ONE_QUESTION);
      return { errors, warnings };
    }

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(SELECT_QUESTION_FIELDS)
      .eq(COLUMN_QUESTION_SET_ID, quizId);

    if (questionsError) {
      logger.error({ error: questionsError, quizId }, LOG_MESSAGES.ERROR_FETCHING_QUESTIONS);
      return { errors: [ERROR_MESSAGES.FAILED_TO_FETCH_QUESTIONS], warnings: [] };
    }

    for (const question of questions || []) {
      const questionValidation = await validateQuestionAnswers(question.id, question.question_text);
      errors.push(...questionValidation.errors);
    }

    return { errors, warnings };
  } catch (error) {
    logger.error({ error, quizId }, LOG_MESSAGES.EXCEPTION_IN_VALIDATE_QUIZ_QUESTIONS);
    return { errors: [ERROR_MESSAGES.FAILED_TO_VALIDATE_QUESTIONS], warnings: [] };
  }
}

/**
 * Function: validateQuestionAnswers
 * Description:
 * - Validate that a question has answers and exactly one correct answer
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - questionText (string): Question text for error messages
 *
 * Returns:
 * - object: Validation result with errors array
 */
async function validateQuestionAnswers(
  questionId: string,
  questionText: string,
): Promise<{
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const { count: answerCount, error: answerError } = await supabaseAdmin
      .from(TABLE_ANSWERS)
      .select(SELECT_ALL, { count: 'exact', head: true })
      .eq(COLUMN_QUESTION_ID, questionId);

    if (answerError) {
      logger.error({ error: answerError, questionId }, LOG_MESSAGES.ERROR_COUNTING_ANSWERS);
      errors.push(`${ERROR_MESSAGES.FAILED_TO_COUNT_ANSWERS} ${questionText}`);
      return { errors };
    }

    if (!answerCount || answerCount < MIN_ANSWER_COUNT) {
      errors.push(
        `${ERROR_MESSAGES.QUESTION_MUST_HAVE_AT_LEAST_ONE_ANSWER}"${questionText}"${ERROR_MESSAGES.QUESTION_MUST_HAVE_ANSWER_SUFFIX}`,
      );
      return { errors };
    }

    const { data: answers, error: answersError } = await supabaseAdmin
      .from(TABLE_ANSWERS)
      .select(SELECT_IS_CORRECT)
      .eq(COLUMN_QUESTION_ID, questionId);

    if (answersError) {
      logger.error({ error: answersError, questionId }, LOG_MESSAGES.ERROR_FETCHING_ANSWERS);
      errors.push(`${ERROR_MESSAGES.FAILED_TO_FETCH_ANSWERS} ${questionText}`);
      return { errors };
    }

    const correctAnswers = answers?.filter((answer) => answer.is_correct) || [];
    if (correctAnswers.length < REQUIRED_CORRECT_ANSWERS_MIN) {
      errors.push(
        `${ERROR_MESSAGES.QUESTION_MUST_HAVE_AT_LEAST_ONE_CORRECT}"${questionText}"${ERROR_MESSAGES.QUESTION_MUST_HAVE_CORRECT_SUFFIX}`,
      );
    } else if (correctAnswers.length > REQUIRED_CORRECT_ANSWERS_MAX) {
      errors.push(
        `${ERROR_MESSAGES.QUESTION_MUST_HAVE_EXACTLY_ONE_CORRECT}"${questionText}"${ERROR_MESSAGES.QUESTION_MUST_HAVE_EXACTLY_ONE_CORRECT_SUFFIX}`,
      );
    }

    return { errors };
  } catch (error) {
    logger.error({ error, questionId }, LOG_MESSAGES.EXCEPTION_IN_VALIDATE_QUESTION_ANSWERS);
    errors.push(`${ERROR_MESSAGES.FAILED_TO_VALIDATE_ANSWERS} ${questionText}`);
    return { errors };
  }
}

/**
 * Function: validateQuizMetadata
 * Description:
 * - Validate quiz metadata fields (title, description, category, tags)
 * - Check if quiz is already published
 *
 * Parameters:
 * - quiz (QuizSetResponse): Quiz data to validate
 *
 * Returns:
 * - object: Validation result with errors and warnings arrays
 */
function validateQuizMetadata(quiz: QuizSetResponse): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!quiz.title || quiz.title.trim().length === EMPTY_STRING_LENGTH) {
    errors.push(ERROR_MESSAGES.QUIZ_TITLE_REQUIRED);
  }

  if (!quiz.description || quiz.description.trim().length === EMPTY_STRING_LENGTH) {
    errors.push(ERROR_MESSAGES.QUIZ_DESCRIPTION_REQUIRED);
  }

  if (!quiz.category || quiz.category.trim().length === EMPTY_STRING_LENGTH) {
    errors.push(ERROR_MESSAGES.QUIZ_CATEGORY_REQUIRED);
  }

  if (!quiz.tags || quiz.tags.length === EMPTY_ARRAY_LENGTH) {
    warnings.push(WARNING_MESSAGES.CONSIDER_ADDING_TAGS);
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    warnings.push(WARNING_MESSAGES.QUIZ_ALREADY_PUBLISHED);
  }

  return { errors, warnings };
}

/**
 * Function: validateQuizForPublishing
 * Description:
 * - Comprehensive validation of quiz for publishing
 * - Validates metadata, questions, and answers
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - object: Validation result with isValid flag, errors, and warnings
 */
async function validateQuizForPublishing(quizId: string): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const quiz = await fetchQuizForValidation(quizId);
    if (!quiz) {
      return { isValid: false, errors: [ERROR_MESSAGES.QUIZ_NOT_FOUND], warnings: [] };
    }

    const metadataValidation = validateQuizMetadata(quiz);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);

    const questionsValidation = await validateQuizQuestions(quizId);
    errors.push(...questionsValidation.errors);
    warnings.push(...questionsValidation.warnings);

    return {
      isValid: errors.length === EMPTY_ARRAY_LENGTH,
      errors,
      warnings,
    };
  } catch (error) {
    logger.error({ error, quizId }, LOG_MESSAGES.EXCEPTION_IN_VALIDATE_QUIZ_FOR_PUBLISHING);
    return {
      isValid: false,
      errors: [ERROR_MESSAGES.VALIDATION_FAILED_DUE_TO_INTERNAL_ERROR],
      warnings: [],
    };
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
