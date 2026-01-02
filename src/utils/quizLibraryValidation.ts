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
// 2. Type Definitions
//----------------------------------------------------
interface RequestWithValidatedQuery extends Request {
  validatedQuery?: Record<string, unknown>;
}

//----------------------------------------------------
// 3. Constants / Configuration
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

//----------------------------------------------------
// 4. Validation Middleware
//----------------------------------------------------
/**
 * Function: validateLibraryRequest
 * Description:
 * - Generic Zod validation middleware factory for quiz library endpoints
 * - Validates query parameters against provided schema
 * - Attaches validated data to request object
 *
 * Parameters:
 * - schema (T): Zod schema to validate against
 *
 * Returns:
 * - Express middleware function
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
          'Quiz library validation failed',
        );

        return res.status(400).json({
          error: 'invalid_query_params',
          message: `Invalid query parameters: ${errorMessages}`,
        } as LibraryError);
      }

      (req as RequestWithValidatedQuery).validatedQuery = validation.data as Record<
        string,
        unknown
      >;
      next();
    } catch (error) {
      logger.error({ error, query: req.query }, 'Exception in quiz library validation');
      res.status(500).json({
        error: 'validation_error',
        message: 'Internal validation error',
      } as LibraryError);
    }
  };
}

//----------------------------------------------------
// 5. Specific Validation Functions
//----------------------------------------------------
/**
 * Function: validateCloneQuizParams
 * Description:
 * - Validates quiz ID parameter for clone operations
 * - Ensures UUID format compliance
 *
 * Parameters:
 * - req (Request): Express request object
 * - res (Response): Express response object
 * - next (NextFunction): Express next middleware function
 *
 * Returns:
 * - void
 */
export function validateCloneQuizParams(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'invalid_quiz_id',
        message: 'Valid quiz ID is required',
      } as LibraryError);
    }

    next();
  } catch (error) {
    logger.error({ error, params: req.params }, 'Exception in clone quiz validation');
    res.status(500).json({
      error: 'validation_error',
      message: 'Internal validation error',
    } as LibraryError);
  }
}

//----------------------------------------------------
// 6. Query Sanitization Helpers
//----------------------------------------------------
/**
 * Function: sanitizeSearchQuery
 * Description:
 * - Sanitizes user search input to prevent SQL injection
 * - Removes dangerous characters and normalizes whitespace
 *
 * Parameters:
 * - query (string): Raw search query from user input
 *
 * Returns:
 * - string: Sanitized search query (max 100 characters)
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';

  return query
    .replace(/['"\\;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, MAX_QUERY_LENGTH);
}

/**
 * Function: sanitizeTags
 * Description:
 * - Validates and normalizes tag array from user input
 * - Filters empty strings and limits to maximum count
 *
 * Parameters:
 * - tags (string[] | string | undefined): Tags from query params
 *
 * Returns:
 * - string[]: Normalized tag array (max 10 tags)
 */
export function sanitizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];

  const tagArray = Array.isArray(tags) ? tags : [tags];

  return tagArray
    .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
    .map((tag) => tag.trim().toLowerCase())
    .slice(0, MAX_TAGS);
}

//----------------------------------------------------
// 7. Pagination Helpers
//----------------------------------------------------
/**
 * Function: validatePagination
 * Description:
 * - Validates and normalizes pagination parameters
 * - Enforces limits on page size and calculates offset
 *
 * Parameters:
 * - page (number): Requested page number (1-indexed)
 * - limit (number): Requested items per page
 *
 * Returns:
 * - Object: Validated pagination params with offset
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

//----------------------------------------------------
// 8. Sort Validation Helpers
//----------------------------------------------------
/**
 * Function: validateSort
 * Description:
 * - Validates sorting field and order from user input
 * - Defaults to updated_at desc if invalid values provided
 *
 * Parameters:
 * - sortBy (string): Sort specification (format: field_order)
 *
 * Returns:
 * - Object: Validated sort field and order
 */
export function validateSort(sortBy: string): { field: string; order: 'asc' | 'desc' } {
  const [field, order] = sortBy.split('_');

  const validField = VALID_SORT_FIELDS.includes(field as (typeof VALID_SORT_FIELDS)[number])
    ? field
    : 'updated_at';
  const validOrder = VALID_SORT_ORDERS.includes(order as (typeof VALID_SORT_ORDERS)[number])
    ? (order as 'asc' | 'desc')
    : 'desc';

  return { field: validField, order: validOrder };
}
