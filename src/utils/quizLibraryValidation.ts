// src/utils/quizLibraryValidation.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LibraryError } from '../types/quiz-library';
import { logger } from './logger';

// Extend Request interface to include validated query
interface RequestWithValidatedQuery extends Request {
  validatedQuery?: Record<string, unknown>;
}

// ============================================================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================================================

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

      // Attach validated data to request
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

// ============================================================================
// SPECIFIC VALIDATION FUNCTIONS
// ============================================================================

export function validateCloneQuizParams(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Validate UUID format
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

// ============================================================================
// QUERY SANITIZATION
// ============================================================================

export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';

  // Remove SQL injection attempts and clean the query
  return query
    .replace(/['"\\;]/g, '') // Remove quotes and semicolons
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 100); // Limit length
}

export function sanitizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];

  const tagArray = Array.isArray(tags) ? tags : [tags];

  return tagArray
    .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
    .map((tag) => tag.trim().toLowerCase())
    .slice(0, 10); // Limit to 10 tags
}

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

export function validatePagination(
  page: number,
  limit: number,
): { page: number; limit: number; offset: number } {
  const validatedPage = Math.max(1, Math.floor(page));
  const validatedLimit = Math.min(50, Math.max(1, Math.floor(limit))); // Max 50 items per page
  const offset = (validatedPage - 1) * validatedLimit;

  return {
    page: validatedPage,
    limit: validatedLimit,
    offset,
  };
}

// ============================================================================
// SORT VALIDATION
// ============================================================================

const VALID_SORT_FIELDS = [
  'updated_at',
  'created_at',
  'times_played',
  'total_questions',
  'title',
] as const;
const VALID_SORT_ORDERS = ['asc', 'desc'] as const;

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
