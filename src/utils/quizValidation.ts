// ====================================================
// File Name   : quizValidation.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2026-01-03

// Description:
// - Comprehensive validation utilities for quiz CRUD operations
// - Zod-based middleware for request and query parameter validation
// - Domain-specific validators for quiz, question, and answer data

// Notes:
// - Validates quiz codes (6-digit numbers: 100000-999999)
// - Enforces answer limits (2-4 answers per question)
// - Points range: 1-300 per question
// - Max players: 1-200 per quiz
// - Prevents object injection in error formatting
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';

import { AuthenticatedRequest } from '../types/auth';
import { QuizError } from '../types/quiz';
import { logger } from './logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const ANSWER_MIN_COUNT = 2;
const ANSWER_MAX_COUNT = 4;
const TRUE_FALSE_ANSWER_COUNT = 2;
const REQUIRED_CORRECT_ANSWERS = 1;

const QUIZ_CODE_MIN = 100000;
const QUIZ_CODE_MAX = 999999;

const TAG_MAX_COUNT = 10;
const TAG_MIN_LENGTH = 1;
const TAG_MAX_LENGTH = 30;

const CATEGORY_MIN_LENGTH = 1;
const CATEGORY_MAX_LENGTH = 50;

const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 100;

const DESCRIPTION_MIN_LENGTH = 1;
const DESCRIPTION_MAX_LENGTH = 500;

const QUESTION_TEXT_MIN_LENGTH = 1;
const QUESTION_TEXT_MAX_LENGTH = 500;

const SHOW_QUESTION_TIME_MIN = 1;
const SHOW_QUESTION_TIME_MAX = 60;

const ANSWERING_TIME_MIN = 1;
const ANSWERING_TIME_MAX = 300;

const SHOW_EXPLANATION_TIME_MIN = 1;
const SHOW_EXPLANATION_TIME_MAX = 60;

const POINTS_MIN = 1;
const POINTS_MAX = 300;

const ANSWER_TEXT_MIN_LENGTH = 1;
const ANSWER_TEXT_MAX_LENGTH = 200;

const MAX_PLAYERS_MIN = 1;
const MAX_PLAYERS_MAX = 200;

const ORDER_INDEX_MIN = 0;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERROR_CODES = {
  VALIDATION_ERROR: 'validation_error',
  INTERNAL_ERROR: 'internal_error',
} as const;

const ERROR_MESSAGES = {
  INVALID_REQUEST_DATA: 'Invalid request data',
  INVALID_QUERY_PARAMETERS: 'Invalid query parameters',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  TITLE_LENGTH: `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters`,
  DESCRIPTION_LENGTH: `Description must be between ${DESCRIPTION_MIN_LENGTH} and ${DESCRIPTION_MAX_LENGTH} characters`,
  CATEGORY_LENGTH: `Category must be between ${CATEGORY_MIN_LENGTH} and ${CATEGORY_MAX_LENGTH} characters`,
  TAGS_VALIDATION: `Tags must be between ${TAG_MIN_LENGTH} and ${TAG_MAX_COUNT} items, each ${TAG_MIN_LENGTH}-${TAG_MAX_LENGTH} characters`,
  INVALID_THUMBNAIL_URL: 'Invalid thumbnail URL format',
  QUIZ_CODE_FORMAT: 'Quiz code must be a 6-digit number',
  MAX_PLAYERS_RANGE: `Max players must be between ${MAX_PLAYERS_MIN} and ${MAX_PLAYERS_MAX}`,
  QUESTION_TEXT_LENGTH: `Question text must be between ${QUESTION_TEXT_MIN_LENGTH} and ${QUESTION_TEXT_MAX_LENGTH} characters`,
  SHOW_QUESTION_TIME_RANGE: `Show question time must be between ${SHOW_QUESTION_TIME_MIN} and ${SHOW_QUESTION_TIME_MAX} seconds`,
  ANSWERING_TIME_RANGE: `Answering time must be between ${ANSWERING_TIME_MIN} and ${ANSWERING_TIME_MAX} seconds`,
  SHOW_EXPLANATION_TIME_RANGE: `Show explanation time must be between ${SHOW_EXPLANATION_TIME_MIN} and ${SHOW_EXPLANATION_TIME_MAX} seconds`,
  POINTS_RANGE: `Points must be between ${POINTS_MIN} and ${POINTS_MAX}`,
  ANSWER_COUNT_RANGE: `Must have between ${ANSWER_MIN_COUNT} and ${ANSWER_MAX_COUNT} answers`,
  EXACTLY_ONE_CORRECT_ANSWER: 'Must have exactly one correct answer',
  ANSWER_TEXT_LENGTH: (index: number) =>
    `Answer ${index + 1} text must be between ${ANSWER_TEXT_MIN_LENGTH} and ${ANSWER_TEXT_MAX_LENGTH} characters`,
  ANSWER_IMAGE_URL: (index: number) => `Answer ${index + 1} has invalid image URL format`,
  INVALID_QUESTION_IMAGE_URL: 'Invalid question image URL format',
  INVALID_EXPLANATION_IMAGE_URL: 'Invalid explanation image URL format',
  ANSWER_TEXT_LENGTH_STANDALONE: `Answer text must be between ${ANSWER_TEXT_MIN_LENGTH} and ${ANSWER_TEXT_MAX_LENGTH} characters`,
  INVALID_ANSWER_IMAGE_URL: 'Invalid answer image URL format',
  ORDER_INDEX_NON_NEGATIVE: 'Order index must be non-negative',
  QUESTION_IDS_MUST_BE_ARRAY: 'questionIds must be an array',
  QUESTION_IDS_NOT_EMPTY: 'questionIds must not be empty',
  QUESTION_ID_INVALID_UUID: (index: number) => `questionIds[${index}] must be a valid UUID`,
} as const;

//----------------------------------------------------
// 3. Core Logic
//----------------------------------------------------
/**
 * Function: validateRequest
 * Description:
 * - Generic Zod validation middleware for request body
 * - Replaces req.body with validated data on success
 * - Returns 400 error with validation details on failure
 *
 * @param schema - Zod schema to validate against
 *
 * @returns Express middleware function that validates request body
 *
 * @throws {QuizError} Returns validation error response if validation fails
 */
export function validateRequest<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const error = formatZodError(result.error);
        logger.debug({ error, body: req.body }, 'Validation failed');

        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.VALIDATION_ERROR,
          message: ERROR_MESSAGES.INVALID_REQUEST_DATA,
          details: error,
        } as QuizError);
      }

      req.body = result.data;
      next();
    } catch (error) {
      logger.error({ error }, 'Validation middleware error');
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as QuizError);
    }
  };
}

/**
 * Function: validateQueryParams
 * Description:
 * - Generic Zod validation middleware for query parameters
 * - Stores validated data in custom request property (validatedQuery)
 * - Returns 400 error with validation details on failure
 *
 * @param schema - Zod schema to validate against
 *
 * @returns Express middleware function that validates query parameters
 *
 * @throws {QuizError} Returns validation error response if validation fails
 */
export function validateQueryParams<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const error = formatZodError(result.error);
        logger.debug({ error, query: req.query }, 'Query validation failed');

        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.VALIDATION_ERROR,
          message: ERROR_MESSAGES.INVALID_QUERY_PARAMETERS,
          details: error,
        } as QuizError);
      }

      (req as AuthenticatedRequest).validatedQuery = result.data as Record<
        string,
        string | string[] | undefined
      >;
      next();
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          query: req.query,
        },
        'Query validation middleware error',
      );
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as QuizError);
    }
  };
}

/**
 * Function: formatZodError
 * Description:
 * - Converts Zod validation errors to flat key-value object
 * - Uses Object.assign to prevent object injection attacks
 * - Maps error paths to error messages
 *
 * @param error - Zod validation error object
 *
 * @returns Formatted error messages by field path
 */
export function formatZodError(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};

  error.issues.forEach((err) => {
    const path = err.path.join('.');
    Object.assign(formatted, { [path]: err.message });
  });

  return formatted;
}

/**
 * Function: validateQuizCode
 * Description:
 * - Validates quiz code is a 6-digit number within valid range (100000-999999)
 *
 * @param code - Quiz code to validate
 *
 * @returns true if code is valid, false otherwise
 */
export function validateQuizCode(code: number): boolean {
  return code >= QUIZ_CODE_MIN && code <= QUIZ_CODE_MAX;
}

/**
 * Function: validateImageUrl
 * Description:
 * - Validates URL format for image URLs using native URL constructor
 *
 * @param url - URL string to validate
 *
 * @returns true if URL is valid, false otherwise
 */
export function validateImageUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Function: validateTags
 * Description:
 * - Validates tag array meets count and length requirements
 * - Maximum 10 tags, each 1-30 characters
 *
 * @param tags - Array of tag strings to validate
 *
 * @returns true if all tags are valid, false otherwise
 */
export function validateTags(tags: string[]): boolean {
  return (
    tags.length <= TAG_MAX_COUNT &&
    tags.every((tag) => tag.length >= TAG_MIN_LENGTH && tag.length <= TAG_MAX_LENGTH)
  );
}

/**
 * Function: validateCategory
 * Description:
 * - Validates category string length (1-50 characters)
 *
 * @param category - Category string to validate
 *
 * @returns true if category length is valid, false otherwise
 */
export function validateCategory(category: string): boolean {
  return category.length >= CATEGORY_MIN_LENGTH && category.length <= CATEGORY_MAX_LENGTH;
}

/**
 * Function: validateTitle
 * Description:
 * - Validates title string length (1-100 characters)
 *
 * @param title - Title string to validate
 *
 * @returns true if title length is valid, false otherwise
 */
export function validateTitle(title: string): boolean {
  return title.length >= TITLE_MIN_LENGTH && title.length <= TITLE_MAX_LENGTH;
}

/**
 * Function: validateDescription
 * Description:
 * - Validates description string length (1-500 characters)
 *
 * @param description - Description string to validate
 *
 * @returns true if description length is valid, false otherwise
 */
export function validateDescription(description: string): boolean {
  return (
    description.length >= DESCRIPTION_MIN_LENGTH && description.length <= DESCRIPTION_MAX_LENGTH
  );
}

/**
 * Function: validateQuestionAnswers
 * Description:
 * - Validates answer array has correct count (2-4) and exactly one correct answer
 *
 * @param answers - Array of answer objects to validate
 *
 * @returns true if answers are valid, false otherwise
 */
export function validateQuestionAnswers(answers: Array<{ is_correct: boolean }>): boolean {
  if (answers.length < ANSWER_MIN_COUNT || answers.length > ANSWER_MAX_COUNT) {
    return false;
  }

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  return correctAnswers.length === REQUIRED_CORRECT_ANSWERS;
}

/**
 * Function: validateTrueFalseAnswers
 * Description:
 * - Validates true/false question has exactly 2 answers with one correct
 *
 * @param answers - Array of answer objects to validate
 *
 * @returns true if answers are valid for true/false question, false otherwise
 */
export function validateTrueFalseAnswers(answers: Array<{ is_correct: boolean }>): boolean {
  if (answers.length !== TRUE_FALSE_ANSWER_COUNT) {
    return false;
  }

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  return correctAnswers.length === REQUIRED_CORRECT_ANSWERS;
}

/**
 * Function: validateMultipleChoiceAnswers
 * Description:
 * - Validates multiple choice question has 2-4 answers with exactly one correct
 *
 * @param answers - Array of answer objects to validate
 *
 * @returns true if answers are valid for multiple choice question, false otherwise
 */
export function validateMultipleChoiceAnswers(answers: Array<{ is_correct: boolean }>): boolean {
  if (answers.length < ANSWER_MIN_COUNT || answers.length > ANSWER_MAX_COUNT) {
    return false;
  }

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  return correctAnswers.length === REQUIRED_CORRECT_ANSWERS;
}

/**
 * Function: validateQuizSetData
 * Description:
 * - Validates complete quiz set data including metadata and play settings
 * - Checks title, description, category, tags, thumbnail, and play settings
 * - Aggregates all validation errors into a single array
 *
 * @param data - Quiz set data to validate
 *
 * @returns Object with isValid flag and array of error messages
 */
export function validateQuizSetData(data: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!validateTitle(data.title as string)) {
    errors.push(ERROR_MESSAGES.TITLE_LENGTH);
  }

  if (!validateDescription(data.description as string)) {
    errors.push(ERROR_MESSAGES.DESCRIPTION_LENGTH);
  }

  if (!validateCategory(data.category as string)) {
    errors.push(ERROR_MESSAGES.CATEGORY_LENGTH);
  }

  if (!validateTags(data.tags as string[])) {
    errors.push(ERROR_MESSAGES.TAGS_VALIDATION);
  }

  if (data.thumbnail_url && !validateImageUrl(data.thumbnail_url as string)) {
    errors.push(ERROR_MESSAGES.INVALID_THUMBNAIL_URL);
  }

  if (data.play_settings) {
    const playSettings = data.play_settings as Record<string, unknown>;
    if (playSettings.code && !validateQuizCode(playSettings.code as number)) {
      errors.push(ERROR_MESSAGES.QUIZ_CODE_FORMAT);
    }

    if (
      playSettings.max_players &&
      ((playSettings.max_players as number) < MAX_PLAYERS_MIN ||
        (playSettings.max_players as number) > MAX_PLAYERS_MAX)
    ) {
      errors.push(ERROR_MESSAGES.MAX_PLAYERS_RANGE);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Function: validateQuestionData
 * Description:
 * - Validates complete question data including text, timing, points, and answers
 * - Aggregates validation from multiple helper functions
 * - Validates answer correctness only if answer count is valid
 *
 * @param data - Question data to validate
 *
 * @returns Object with isValid flag and array of error messages
 */
export function validateQuestionData(data: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  errors.push(...validateQuestionText(data.question_text));
  errors.push(...validateQuestionTiming(data));
  errors.push(...validateQuestionPoints(data.points));

  const answers = data.answers as Array<Record<string, unknown>>;
  errors.push(...validateAnswerCount(answers));

  if (answers && answers.length >= ANSWER_MIN_COUNT && answers.length <= ANSWER_MAX_COUNT) {
    errors.push(...validateAnswerCorrectness(answers));
    errors.push(...validateIndividualAnswers(answers));
  }

  errors.push(...validateQuestionImageUrls(data));

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Function: validateAnswerData
 * Description:
 * - Validates answer data including text, image URL, and order index
 * - Used for standalone answer validation (not part of question validation)
 *
 * @param data - Answer data to validate
 *
 * @returns Object with isValid flag and array of error messages
 */
export function validateAnswerData(data: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (
    !data.answer_text ||
    (data.answer_text as string).length < ANSWER_TEXT_MIN_LENGTH ||
    (data.answer_text as string).length > ANSWER_TEXT_MAX_LENGTH
  ) {
    errors.push(ERROR_MESSAGES.ANSWER_TEXT_LENGTH_STANDALONE);
  }

  if (data.image_url && !validateImageUrl(data.image_url as string)) {
    errors.push(ERROR_MESSAGES.INVALID_ANSWER_IMAGE_URL);
  }

  if ((data.order_index as number) < ORDER_INDEX_MIN) {
    errors.push(ERROR_MESSAGES.ORDER_INDEX_NON_NEGATIVE);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Function: validateReorderQuestionsData
 * Description:
 * - Validates question reordering data
 * - Ensures questionIds is a non-empty array of valid UUIDs
 * - Validates UUID format for each question ID
 *
 * @param data - Reorder data containing questionIds array
 *
 * @returns Object with isValid flag and array of error messages
 */
export function validateReorderQuestionsData(data: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(data.questionIds)) {
    errors.push(ERROR_MESSAGES.QUESTION_IDS_MUST_BE_ARRAY);
  } else if (data.questionIds.length === 0) {
    errors.push(ERROR_MESSAGES.QUESTION_IDS_NOT_EMPTY);
  } else {
    data.questionIds.forEach((id: unknown, index: number) => {
      if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
        errors.push(ERROR_MESSAGES.QUESTION_ID_INVALID_UUID(index));
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

//----------------------------------------------------
// 4. Helper Functions
//----------------------------------------------------
/**
 * Function: validateQuestionText
 * Description:
 * - Validates question text length (1-500 characters)
 *
 * @param questionText - Question text to validate
 *
 * @returns Array of error messages, empty if valid
 */
function validateQuestionText(questionText: unknown): string[] {
  const errors: string[] = [];

  if (
    !questionText ||
    (questionText as string).length < QUESTION_TEXT_MIN_LENGTH ||
    (questionText as string).length > QUESTION_TEXT_MAX_LENGTH
  ) {
    errors.push(ERROR_MESSAGES.QUESTION_TEXT_LENGTH);
  }

  return errors;
}

/**
 * Function: validateQuestionTiming
 * Description:
 * - Validates question timing settings (show question, answering, explanation times)
 * - Show question time: 1-60 seconds
 * - Answering time: 1-300 seconds
 * - Show explanation time: 1-60 seconds
 *
 * @param data - Question data containing timing fields
 *
 * @returns Array of error messages, empty if valid
 */
function validateQuestionTiming(data: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (
    (data.show_question_time as number) < SHOW_QUESTION_TIME_MIN ||
    (data.show_question_time as number) > SHOW_QUESTION_TIME_MAX
  ) {
    errors.push(ERROR_MESSAGES.SHOW_QUESTION_TIME_RANGE);
  }

  if (
    (data.answering_time as number) < ANSWERING_TIME_MIN ||
    (data.answering_time as number) > ANSWERING_TIME_MAX
  ) {
    errors.push(ERROR_MESSAGES.ANSWERING_TIME_RANGE);
  }

  if (
    (data.show_explanation_time as number) < SHOW_EXPLANATION_TIME_MIN ||
    (data.show_explanation_time as number) > SHOW_EXPLANATION_TIME_MAX
  ) {
    errors.push(ERROR_MESSAGES.SHOW_EXPLANATION_TIME_RANGE);
  }

  return errors;
}

/**
 * Function: validateQuestionPoints
 * Description:
 * - Validates question points value (1-300)
 *
 * @param points - Points value to validate
 *
 * @returns Array of error messages, empty if valid
 */
function validateQuestionPoints(points: unknown): string[] {
  const errors: string[] = [];

  if ((points as number) < POINTS_MIN || (points as number) > POINTS_MAX) {
    errors.push(ERROR_MESSAGES.POINTS_RANGE);
  }

  return errors;
}

/**
 * Function: validateAnswerCount
 * Description:
 * - Validates answer array has correct count (2-4 answers)
 *
 * @param answers - Answer array to validate
 *
 * @returns Array of error messages, empty if valid
 */
function validateAnswerCount(answers: unknown): string[] {
  const errors: string[] = [];

  if (
    !answers ||
    (answers as Array<unknown>).length < ANSWER_MIN_COUNT ||
    (answers as Array<unknown>).length > ANSWER_MAX_COUNT
  ) {
    errors.push(ERROR_MESSAGES.ANSWER_COUNT_RANGE);
  }

  return errors;
}

/**
 * Function: validateAnswerCorrectness
 * Description:
 * - Validates exactly one answer is marked as correct
 * - Ensures no questions have zero or multiple correct answers
 *
 * @param answers - Array of answer objects to validate
 *
 * @returns Array of error messages, empty if valid
 */
function validateAnswerCorrectness(answers: Array<Record<string, unknown>>): string[] {
  const errors: string[] = [];

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  if (correctAnswers.length !== REQUIRED_CORRECT_ANSWERS) {
    errors.push(ERROR_MESSAGES.EXACTLY_ONE_CORRECT_ANSWER);
  }

  return errors;
}

/**
 * Function: validateIndividualAnswers
 * Description:
 * - Validates each answer in array has valid text (1-200 characters) and image URL
 * - Validates all answers in the array
 *
 * @param answers - Array of answer objects to validate
 *
 * @returns Array of error messages, empty if valid
 */
function validateIndividualAnswers(answers: Array<Record<string, unknown>>): string[] {
  const errors: string[] = [];

  answers.forEach((answer, index: number) => {
    if (
      !answer.answer_text ||
      (answer.answer_text as string).length < ANSWER_TEXT_MIN_LENGTH ||
      (answer.answer_text as string).length > ANSWER_TEXT_MAX_LENGTH
    ) {
      errors.push(ERROR_MESSAGES.ANSWER_TEXT_LENGTH(index + 1));
    }

    if (answer.image_url && !validateImageUrl(answer.image_url as string)) {
      errors.push(ERROR_MESSAGES.ANSWER_IMAGE_URL(index + 1));
    }
  });

  return errors;
}

/**
 * Function: validateQuestionImageUrls
 * Description:
 * - Validates question and explanation image URLs
 * - Both fields are optional, but if present must be valid URLs
 *
 * @param data - Question data containing image URL fields
 *
 * @returns Array of error messages, empty if valid
 */
function validateQuestionImageUrls(data: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (data.image_url && !validateImageUrl(data.image_url as string)) {
    errors.push(ERROR_MESSAGES.INVALID_QUESTION_IMAGE_URL);
  }

  if (data.explanation_image_url && !validateImageUrl(data.explanation_image_url as string)) {
    errors.push(ERROR_MESSAGES.INVALID_EXPLANATION_IMAGE_URL);
  }

  return errors;
}
