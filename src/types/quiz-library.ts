// ====================================================
// File Name   : quiz-library.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-17
// Last Update : 2025-09-17

// Description:
// - Quiz library and discovery type definitions
// - Public quiz browsing and filtering interfaces
// - Japanese-localized sort and difficulty options

// Notes:
// - Max 50 items per page for library queries
// - Includes clone quiz functionality
// - Sort options: updated_desc, created_desc, plays_desc, questions_desc, title_asc
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

import { QuizSetResponse, DifficultyLevel } from './quiz';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const PAGINATION_PAGE_MIN = 1;
const PAGINATION_PAGE_DEFAULT = 1;

const PAGINATION_LIMIT_MIN = 1;
const PAGINATION_LIMIT_MAX = 50;
const PAGINATION_LIMIT_DEFAULT = 20;

const SORT_OPTION_UPDATED_DESC = 'updated_desc';
const SORT_OPTION_CREATED_DESC = 'created_desc';
const SORT_OPTION_PLAYS_DESC = 'plays_desc';
const SORT_OPTION_QUESTIONS_DESC = 'questions_desc';
const SORT_OPTION_TITLE_ASC = 'title_asc';

const STATUS_ALL = 'all';
const STATUS_DRAFTS = 'drafts';
const STATUS_PUBLISHED = 'published';

export const DATE_RANGE_WEEK = 'week';
export const DATE_RANGE_MONTH = 'month';
export const DATE_RANGE_YEAR = 'year';
export const DATE_RANGE_ALL = 'all';

export const QUESTION_COUNT_FEW = 'few';
export const QUESTION_COUNT_MEDIUM = 'medium';
export const QUESTION_COUNT_MANY = 'many';
export const QUESTION_COUNT_ALL = 'all';

export const PLAY_COUNT_LOW = 'low';
export const PLAY_COUNT_MEDIUM = 'medium';
export const PLAY_COUNT_HIGH = 'high';
export const PLAY_COUNT_ALL = 'all';

const SORT_ORDER_DESC = 'desc';
const SORT_ORDER_ASC = 'asc';

const COLOR_GREEN = 'green';
const COLOR_YELLOW = 'yellow';
const COLOR_ORANGE = 'orange';
const COLOR_RED = 'red';

export const QUIZ_CATEGORIES = [
  'general',
  'science',
  'history',
  'geography',
  'sports',
  'entertainment',
  'technology',
  'literature',
  'math',
  'language',
  'art',
  'music',
  'food',
  'travel',
  'business',
  'health',
  'nature',
  'culture',
  'anime',
  'games',
] as const;

export const SORT_OPTIONS = {
  updated_desc: { label: '更新が新しい', field: 'updated_at', order: SORT_ORDER_DESC },
  created_desc: { label: '作成が新しい', field: 'created_at', order: SORT_ORDER_DESC },
  plays_desc: { label: 'プレイ回数(多い順)', field: 'times_played', order: SORT_ORDER_DESC },
  questions_desc: { label: '問題数(多い順)', field: 'total_questions', order: SORT_ORDER_DESC },
  title_asc: { label: 'タイトル(A→Z)', field: 'title', order: SORT_ORDER_ASC },
} as const;

export const DIFFICULTY_OPTIONS = {
  easy: { label: '簡単', color: COLOR_GREEN },
  medium: { label: '普通', color: COLOR_YELLOW },
  hard: { label: '難しい', color: COLOR_ORANGE },
  expert: { label: '上級', color: COLOR_RED },
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Type: QuizCategory
 * Description:
 * - Represents a valid quiz category
 * - Inferred from QUIZ_CATEGORIES constant array
 */
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];

/**
 * Interface: PublicQuizBrowseRequest
 * Description:
 * - Request parameters for browsing public quizzes
 * - Supports pagination, search, filtering, and sorting
 */
export interface PublicQuizBrowseRequest {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  difficulty?: DifficultyLevel;
  sort?:
    | typeof SORT_OPTION_UPDATED_DESC
    | typeof SORT_OPTION_CREATED_DESC
    | typeof SORT_OPTION_PLAYS_DESC
    | typeof SORT_OPTION_QUESTIONS_DESC
    | typeof SORT_OPTION_TITLE_ASC;
  tags?: string[];
}

/**
 * Interface: MyLibraryRequest
 * Description:
 * - Request parameters for browsing user's own quiz library
 * - Supports filtering by status, category, search, and sorting
 */
export interface MyLibraryRequest {
  status?: typeof STATUS_ALL | typeof STATUS_DRAFTS | typeof STATUS_PUBLISHED;
  category?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

/**
 * Interface: LibraryFilters
 * Description:
 * - Advanced filtering options for quiz library
 * - Includes date range, question count, and play count filters
 */
export interface LibraryFilters {
  category: string;
  difficulty: string;
  sortBy:
    | typeof SORT_OPTION_UPDATED_DESC
    | typeof SORT_OPTION_CREATED_DESC
    | typeof SORT_OPTION_PLAYS_DESC
    | typeof SORT_OPTION_QUESTIONS_DESC
    | typeof SORT_OPTION_TITLE_ASC;
  tags: string[];
  dateRange?:
    | typeof DATE_RANGE_WEEK
    | typeof DATE_RANGE_MONTH
    | typeof DATE_RANGE_YEAR
    | typeof DATE_RANGE_ALL;
  questionCount?:
    | typeof QUESTION_COUNT_FEW
    | typeof QUESTION_COUNT_MEDIUM
    | typeof QUESTION_COUNT_MANY
    | typeof QUESTION_COUNT_ALL;
  playCount?:
    | typeof PLAY_COUNT_LOW
    | typeof PLAY_COUNT_MEDIUM
    | typeof PLAY_COUNT_HIGH
    | typeof PLAY_COUNT_ALL;
}

/**
 * Interface: PublicQuizResponse
 * Description:
 * - Extended quiz response with author information
 * - Includes popularity metrics for public quiz browsing
 */
export interface PublicQuizResponse extends QuizSetResponse {
  author: {
    id: string;
    display_name?: string;
    username?: string;
  };
  popularity_score?: number;
  recent_plays?: number;
}

/**
 * Interface: CloneQuizResponse
 * Description:
 * - Response structure for quiz cloning operation
 * - Includes cloned quiz, original quiz info, and success message
 */
export interface CloneQuizResponse {
  clonedQuiz: QuizSetResponse;
  message: string;
  originalQuiz: {
    id: string;
    title: string;
    author: string;
  };
}

/**
 * Interface: LibraryError
 * Description:
 * - Standard error response structure for library operations
 * - Includes error code, message, and optional error code
 */
export interface LibraryError {
  error: string;
  message: string;
  code?: string;
}

/**
 * Schema: PublicQuizBrowseSchema
 * Description:
 * - Validation schema for public quiz browsing
 * - Validates pagination (page min 1, limit 1-50, default 20)
 * - Validates sort options and optional filters
 */
export const PublicQuizBrowseSchema = z.object({
  page: z.coerce.number().int().min(PAGINATION_PAGE_MIN).default(PAGINATION_PAGE_DEFAULT),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_LIMIT_MIN)
    .max(PAGINATION_LIMIT_MAX)
    .default(PAGINATION_LIMIT_DEFAULT),
  search: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  sort: z
    .enum([
      SORT_OPTION_UPDATED_DESC,
      SORT_OPTION_CREATED_DESC,
      SORT_OPTION_PLAYS_DESC,
      SORT_OPTION_QUESTIONS_DESC,
      SORT_OPTION_TITLE_ASC,
    ])
    .default(SORT_OPTION_UPDATED_DESC),
  tags: z.array(z.string()).optional(),
});

/**
 * Schema: MyLibrarySchema
 * Description:
 * - Validation schema for user's library browsing
 * - Validates pagination, status filter, and sort options
 */
export const MyLibrarySchema = z.object({
  page: z.coerce.number().int().min(PAGINATION_PAGE_MIN).default(PAGINATION_PAGE_DEFAULT),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_LIMIT_MIN)
    .max(PAGINATION_LIMIT_MAX)
    .default(PAGINATION_LIMIT_DEFAULT),
  status: z.enum([STATUS_ALL, STATUS_DRAFTS, STATUS_PUBLISHED]).default(STATUS_ALL),
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z
    .enum([
      SORT_OPTION_UPDATED_DESC,
      SORT_OPTION_CREATED_DESC,
      SORT_OPTION_PLAYS_DESC,
      SORT_OPTION_QUESTIONS_DESC,
      SORT_OPTION_TITLE_ASC,
    ])
    .default(SORT_OPTION_UPDATED_DESC),
});

/**
 * Schema: CloneQuizSchema
 * Description:
 * - Validation schema for cloning a quiz
 * - Requires valid UUID for quiz ID
 */
export const CloneQuizSchema = z.object({
  quizId: z.string().uuid(),
});

/**
 * Type: PublicQuizBrowseInput
 * Description:
 * - Inferred type from PublicQuizBrowseSchema
 * - Represents validated input for public quiz browsing
 */
export type PublicQuizBrowseInput = z.infer<typeof PublicQuizBrowseSchema>;

/**
 * Type: MyLibraryInput
 * Description:
 * - Inferred type from MyLibrarySchema
 * - Represents validated input for user library browsing
 */
export type MyLibraryInput = z.infer<typeof MyLibrarySchema>;

/**
 * Type: CloneQuizInput
 * Description:
 * - Inferred type from CloneQuizSchema
 * - Represents validated input for cloning a quiz
 */
export type CloneQuizInput = z.infer<typeof CloneQuizSchema>;
