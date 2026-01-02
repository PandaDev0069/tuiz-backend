// src/utils/quizValidation.ts
import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { AuthenticatedRequest } from '../types/auth';
import { QuizError } from '../types/quiz';
import { logger } from './logger';

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

export function validateRequest<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const error = formatZodError(result.error);
        logger.debug({ error, body: req.body }, 'Validation failed');

        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request data',
          details: error,
        } as QuizError);
      }

      // Replace req.body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      logger.error({ error }, 'Validation middleware error');
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  };
}

// ============================================================================
// QUERY PARAMETER VALIDATION
// ============================================================================

export function validateQueryParams<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const error = formatZodError(result.error);
        logger.debug({ error, query: req.query }, 'Query validation failed');

        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid query parameters',
          details: error,
        } as QuizError);
      }

      // Store validated data in a custom property
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
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  };
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

export function formatZodError(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};

  error.issues.forEach((err) => {
    const path = err.path.join('.');
    // Use Object.assign to avoid object injection
    Object.assign(formatted, { [path]: err.message });
  });

  return formatted;
}

// ============================================================================
// CUSTOM VALIDATION FUNCTIONS
// ============================================================================

export function validateQuizCode(code: number): boolean {
  return code >= 100000 && code <= 999999;
}

export function validateQuestionAnswers(answers: Array<{ is_correct: boolean }>): boolean {
  if (answers.length < 2 || answers.length > 4) {
    return false;
  }

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  return correctAnswers.length === 1; // Must have exactly one correct answer
}

export function validateTrueFalseAnswers(answers: Array<{ is_correct: boolean }>): boolean {
  if (answers.length !== 2) {
    return false;
  }

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  return correctAnswers.length === 1; // Must have exactly one correct answer
}

export function validateMultipleChoiceAnswers(answers: Array<{ is_correct: boolean }>): boolean {
  if (answers.length < 2 || answers.length > 4) {
    return false;
  }

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  return correctAnswers.length === 1; // Must have exactly one correct answer
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateImageUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateTags(tags: string[]): boolean {
  return tags.length <= 10 && tags.every((tag) => tag.length >= 1 && tag.length <= 30);
}

export function validateCategory(category: string): boolean {
  return category.length >= 1 && category.length <= 50;
}

export function validateTitle(title: string): boolean {
  return title.length >= 1 && title.length <= 100;
}

export function validateDescription(description: string): boolean {
  return description.length >= 1 && description.length <= 500;
}

// ============================================================================
// COMPREHENSIVE QUIZ VALIDATION
// ============================================================================

export function validateQuizSetData(data: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate title
  if (!validateTitle(data.title as string)) {
    errors.push('Title must be between 1 and 100 characters');
  }

  // Validate description
  if (!validateDescription(data.description as string)) {
    errors.push('Description must be between 1 and 500 characters');
  }

  // Validate category
  if (!validateCategory(data.category as string)) {
    errors.push('Category must be between 1 and 50 characters');
  }

  // Validate tags
  if (!validateTags(data.tags as string[])) {
    errors.push('Tags must be between 1 and 10 items, each 1-30 characters');
  }

  // Validate thumbnail URL if provided
  if (data.thumbnail_url && !validateImageUrl(data.thumbnail_url as string)) {
    errors.push('Invalid thumbnail URL format');
  }

  // Validate play settings
  if (data.play_settings) {
    const playSettings = data.play_settings as Record<string, unknown>;
    if (playSettings.code && !validateQuizCode(playSettings.code as number)) {
      errors.push('Quiz code must be a 6-digit number');
    }

    if (
      playSettings.max_players &&
      ((playSettings.max_players as number) < 1 || (playSettings.max_players as number) > 400)
    ) {
      errors.push('Max players must be between 1 and 400');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function validateQuestionText(questionText: unknown): string[] {
  const errors: string[] = [];

  if (
    !questionText ||
    (questionText as string).length < 1 ||
    (questionText as string).length > 500
  ) {
    errors.push('Question text must be between 1 and 500 characters');
  }

  return errors;
}

function validateQuestionTiming(data: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if ((data.show_question_time as number) < 1 || (data.show_question_time as number) > 60) {
    errors.push('Show question time must be between 1 and 60 seconds');
  }

  if ((data.answering_time as number) < 1 || (data.answering_time as number) > 300) {
    errors.push('Answering time must be between 1 and 300 seconds');
  }

  if ((data.show_explanation_time as number) < 1 || (data.show_explanation_time as number) > 60) {
    errors.push('Show explanation time must be between 1 and 60 seconds');
  }

  return errors;
}

function validateQuestionPoints(points: unknown): string[] {
  const errors: string[] = [];

  if ((points as number) < 1 || (points as number) > 300) {
    errors.push('Points must be between 1 and 300');
  }

  return errors;
}

function validateAnswerCount(answers: unknown): string[] {
  const errors: string[] = [];

  if (
    !answers ||
    (answers as Array<unknown>).length < 2 ||
    (answers as Array<unknown>).length > 4
  ) {
    errors.push('Must have between 2 and 4 answers');
  }

  return errors;
}

function validateAnswerCorrectness(answers: Array<Record<string, unknown>>): string[] {
  const errors: string[] = [];

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  if (correctAnswers.length !== 1) {
    errors.push('Must have exactly one correct answer');
  }

  return errors;
}

function validateIndividualAnswers(answers: Array<Record<string, unknown>>): string[] {
  const errors: string[] = [];

  answers.forEach((answer, index: number) => {
    if (
      !answer.answer_text ||
      (answer.answer_text as string).length < 1 ||
      (answer.answer_text as string).length > 200
    ) {
      errors.push(`Answer ${index + 1} text must be between 1 and 200 characters`);
    }

    if (answer.image_url && !validateImageUrl(answer.image_url as string)) {
      errors.push(`Answer ${index + 1} has invalid image URL format`);
    }
  });

  return errors;
}

function validateQuestionImageUrls(data: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (data.image_url && !validateImageUrl(data.image_url as string)) {
    errors.push('Invalid question image URL format');
  }

  if (data.explanation_image_url && !validateImageUrl(data.explanation_image_url as string)) {
    errors.push('Invalid explanation image URL format');
  }

  return errors;
}

export function validateQuestionData(data: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate question text
  errors.push(...validateQuestionText(data.question_text));

  // Validate timing
  errors.push(...validateQuestionTiming(data));

  // Validate points
  errors.push(...validateQuestionPoints(data.points));

  // Validate answers
  const answers = data.answers as Array<Record<string, unknown>>;
  errors.push(...validateAnswerCount(answers));

  if (answers && answers.length >= 2 && answers.length <= 4) {
    errors.push(...validateAnswerCorrectness(answers));
    errors.push(...validateIndividualAnswers(answers));
  }

  // Validate image URLs
  errors.push(...validateQuestionImageUrls(data));

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateAnswerData(data: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate answer text
  if (
    !data.answer_text ||
    (data.answer_text as string).length < 1 ||
    (data.answer_text as string).length > 200
  ) {
    errors.push('Answer text must be between 1 and 200 characters');
  }

  // Validate image URL if provided
  if (data.image_url && !validateImageUrl(data.image_url as string)) {
    errors.push('Invalid answer image URL format');
  }

  // Validate order index
  if ((data.order_index as number) < 0) {
    errors.push('Order index must be non-negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateReorderQuestionsData(data: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate questionIds array
  if (!Array.isArray(data.questionIds)) {
    errors.push('questionIds must be an array');
  } else if (data.questionIds.length === 0) {
    errors.push('questionIds must not be empty');
  } else {
    // Validate each question ID is a valid UUID
    data.questionIds.forEach((id: unknown, index: number) => {
      if (
        typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ) {
        errors.push(`questionIds[${index}] must be a valid UUID`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
