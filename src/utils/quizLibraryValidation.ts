// ====================================================
// File Name   : quizLibraryValidation.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-17
// Last Update : 2025-09-17

// Description:
// - Validation middleware and utilities for quiz library endpoints
// - Implements Zod schema validation with Express middleware
// - Provides query sanitization, pagination, and sorting helpers

// Notes:
// - Max 50 items per page for pagination
// - Search queries limited to 100 characters
// - Tags limited to 10 per request
// - UUID validation for quiz IDs
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { LibraryError } from '../types/quiz-library';
import { logger } from './logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const VALID_SORT_FIELDS = [
  'updated_at',
  'created_at',
  'times_played',
  'total_questions',
  'title',
] as const;

const VALID_SORT_ORDERS = ['asc', 'desc'] as const;

const MAX_ITEMS_PER_PAGE = 50;
const MAX_TAGS = 10;
const MAX_QUERY_LENGTH = 100;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_SORT_FIELD = 'updated_at';
const DEFAULT_SORT_ORDER = 'desc';
const SORT_SEPARATOR = '_';

const DANGEROUS_CHARS_REGEX = /['"\\;]/g;
const WHITESPACE_REGEX = /\s+/g;

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const EMPTY_STRING = '';

const ERROR_CODES = {
  INVALID_QUERY_PARAMS: 'invalid_query_params',
  VALIDATION_ERROR: 'validation_error',
  INVALID_QUIZ_ID: 'invalid_quiz_id',
} as const;

const ERROR_MESSAGES = {
  INVALID_QUERY_PARAMS: 'Invalid query parameters:',
  INTERNAL_VALIDATION_ERROR: 'Internal validation error',
  VALID_QUIZ_ID_REQUIRED: 'Valid quiz ID is required',
} as const;

const LOG_MESSAGES = {
  VALIDATION_FAILED: 'Quiz library validation failed',
  VALIDATION_EXCEPTION: 'Exception in quiz library validation',
  CLONE_VALIDATION_EXCEPTION: 'Exception in clone quiz validation',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
interface RequestWithValidatedQuery extends Request {
  validatedQuery?: Record<string, unknown>;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Function: validateLibraryRequest
 * Description:
 * - Generic Zod validation middleware factory for quiz library endpoints
 * - Validates query parameters against provided schema
 * - Attaches validated data to request object
 * - Returns 400 status with error details if validation fails
 *
 * @param schema - Zod schema to validate against
 *
 * @returns Express middleware function that validates query parameters
 *
 * @throws {LibraryError} Returns 400 status if validation fails, 500 if internal error occurs
 */
export function validateLibraryRequest<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = schema.safeParse(req.query);

      if (!validation.success) {
        const errorMessages = validation.error.issues
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');

        logger.warn(
          {
            query: req.query,
            errors: validation.error.issues,
          },
          LOG_MESSAGES.VALIDATION_FAILED,
        );

        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_QUERY_PARAMS,
          message: `${ERROR_MESSAGES.INVALID_QUERY_PARAMS} ${errorMessages}`,
        } as LibraryError);
      }

      (req as RequestWithValidatedQuery).validatedQuery = validation.data as Record<
        string,
        unknown
      >;
      next();
    } catch (error) {
      logger.error({ error, query: req.query }, LOG_MESSAGES.VALIDATION_EXCEPTION);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.INTERNAL_VALIDATION_ERROR,
      } as LibraryError);
    }
  };
}

/**
 * Function: validateCloneQuizParams
 * Description:
 * - Validates quiz ID parameter for clone operations
 * - Ensures UUID format compliance using regex validation
 * - Returns 400 status if quiz ID is missing or invalid
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 *
 * @returns void (calls next() on success, sends error response on failure)
 *
 * @throws {LibraryError} Returns 400 status if quiz ID is invalid, 500 if internal error occurs
 */
export function validateCloneQuizParams(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_QUIZ_ID,
        message: ERROR_MESSAGES.VALID_QUIZ_ID_REQUIRED,
      } as LibraryError);
    }

    next();
  } catch (error) {
    logger.error({ error, params: req.params }, LOG_MESSAGES.CLONE_VALIDATION_EXCEPTION);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.VALIDATION_ERROR,
      message: ERROR_MESSAGES.INTERNAL_VALIDATION_ERROR,
    } as LibraryError);
  }
}

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: sanitizeSearchQuery
 * Description:
 * - Sanitizes user search input to prevent SQL injection
 * - Removes dangerous characters and normalizes whitespace
 * - Limits query length to prevent excessive input (max 100 characters)
 *
 * @param query - Raw search query from user input
 *
 * @returns Sanitized search query (max 100 characters)
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return EMPTY_STRING;

  return query
    .replace(DANGEROUS_CHARS_REGEX, EMPTY_STRING)
    .replace(WHITESPACE_REGEX, ' ')
    .trim()
    .substring(0, MAX_QUERY_LENGTH);
}

/**
 * Function: sanitizeTags
 * Description:
 * - Validates and normalizes tag array from user input
 * - Filters empty strings and limits to maximum count (max 10 tags)
 * - Converts tags to lowercase for consistency
 *
 * @param tags - Tags from query params (can be array, string, or undefined)
 *
 * @returns Normalized tag array (max 10 tags)
 */
export function sanitizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];

  const tagArray = Array.isArray(tags) ? tags : [tags];

  return tagArray
    .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
    .map((tag) => tag.trim().toLowerCase())
    .slice(0, MAX_TAGS);
}

/**
 * Function: validatePagination
 * Description:
 * - Validates and normalizes pagination parameters
 * - Enforces limits on page size and calculates offset
 * - Ensures page and limit are positive integers
 * - Page minimum is 1, limit maximum is MAX_ITEMS_PER_PAGE
 *
 * @param page - Requested page number (1-indexed)
 * @param limit - Requested items per page
 *
 * @returns Validated pagination params with offset
 */
export function validatePagination(
  page: number,
  limit: number,
): { page: number; limit: number; offset: number } {
  const validatedPage = Math.max(1, Math.floor(page));
  const validatedLimit = Math.min(MAX_ITEMS_PER_PAGE, Math.max(1, Math.floor(limit)));
  const offset = (validatedPage - 1) * validatedLimit;

  return {
    page: validatedPage,
    limit: validatedLimit,
    offset,
  };
}

/**
 * Function: validateSort
 * Description:
 * - Validates sorting field and order from user input
 * - Defaults to updated_at desc if invalid values provided
 * - Parses sort specification in format: field_order
 *
 * @param sortBy - Sort specification (format: field_order)
 *
 * @returns Validated sort field and order
 */
export function validateSort(sortBy: string): { field: string; order: 'asc' | 'desc' } {
  const [field, order] = sortBy.split(SORT_SEPARATOR);

  const validField = VALID_SORT_FIELDS.includes(field as (typeof VALID_SORT_FIELDS)[number])
    ? field
    : DEFAULT_SORT_FIELD;
  const validOrder = VALID_SORT_ORDERS.includes(order as (typeof VALID_SORT_ORDERS)[number])
    ? (order as 'asc' | 'desc')
    : DEFAULT_SORT_ORDER;

  return { field: validField, order: validOrder };
}
