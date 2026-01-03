// ====================================================
// File Name   : quiz.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2026-01-03

// Description:
// - Comprehensive quiz type definitions and validation schemas
// - Supports multiple choice and true/false question types
// - Includes CRUD interfaces and Zod validation

// Notes:
// - Quiz codes: 6-digit numbers (100000-999999)
// - Max players: 1-200 per quiz
// - Difficulty levels: easy, medium, hard, expert
// - Question types: multiple_choice, true_false
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const QUIZ_CODE_MIN = 100000;
const QUIZ_CODE_MAX = 999999;

const MAX_PLAYERS_MIN = 1;
const MAX_PLAYERS_MAX = 200;

const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 100;

const DESCRIPTION_MIN_LENGTH = 1;
const DESCRIPTION_MAX_LENGTH = 500;

const CATEGORY_MIN_LENGTH = 1;
const CATEGORY_MAX_LENGTH = 50;

const TAG_MIN_LENGTH = 1;
const TAG_MAX_LENGTH = 30;
const TAG_MAX_COUNT = 10;

const QUESTION_TEXT_MIN_LENGTH = 1;
const QUESTION_TEXT_MAX_LENGTH = 500;

const ANSWER_TEXT_MIN_LENGTH = 1;
const ANSWER_TEXT_MAX_LENGTH = 200;

const EXPLANATION_TITLE_MIN_LENGTH = 1;
const EXPLANATION_TITLE_MAX_LENGTH = 100;

const EXPLANATION_TEXT_MIN_LENGTH = 1;
const EXPLANATION_TEXT_MAX_LENGTH = 1000;

const SHOW_QUESTION_TIME_MIN = 1;
const SHOW_QUESTION_TIME_MAX = 60;

const ANSWERING_TIME_MIN = 1;
const ANSWERING_TIME_MAX = 300;

const POINTS_MIN = 1;
const POINTS_MAX = 300;

const SHOW_EXPLANATION_TIME_MIN = 1;
const SHOW_EXPLANATION_TIME_MAX = 60;

const ANSWER_MIN_COUNT = 2;
const ANSWER_MAX_COUNT = 4;

const ORDER_INDEX_MIN = 0;

const PAGINATION_PAGE_MIN = 1;
const PAGINATION_PAGE_DEFAULT = 1;

const PAGINATION_LIMIT_MIN = 1;
const PAGINATION_LIMIT_MAX = 100;
const PAGINATION_LIMIT_DEFAULT = 10;

const SORT_FIELD_CREATED_AT = 'created_at';
const SORT_FIELD_UPDATED_AT = 'updated_at';
const SORT_FIELD_TIMES_PLAYED = 'times_played';
const SORT_FIELD_TITLE = 'title';

const SORT_ORDER_ASC = 'asc';
const SORT_ORDER_DESC = 'desc';

const IS_PUBLIC_TRUE = 'true';
const IS_PUBLIC_FALSE = 'false';

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Enum: DifficultyLevel
 * Description:
 * - Represents the difficulty level of a quiz
 * - Used for categorization and filtering quizzes
 */
export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert',
}

/**
 * Enum: QuizStatus
 * Description:
 * - Represents the publication status of a quiz
 * - Controls quiz visibility and availability
 */
export enum QuizStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/**
 * Enum: QuestionType
 * Description:
 * - Represents the type of question
 * - Determines answer format and validation rules
 */
export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
}

/**
 * Interface: QuizSet
 * Description:
 * - Core quiz set data structure
 * - Represents a complete quiz with metadata and play settings
 * - Tracks usage statistics and publication status
 */
export interface QuizSet {
  id: string;
  user_id: string;
  title: string;
  description: string;
  thumbnail_url?: string;
  is_public: boolean;
  difficulty_level: DifficultyLevel;
  category: string;
  total_questions: number;
  times_played: number;
  created_at: string;
  updated_at: string;
  status: QuizStatus;
  tags: string[];
  last_played_at?: string;
  play_settings: QuizPlaySettings;
  cloned_from?: string;
}

/**
 * Interface: Question
 * Description:
 * - Represents a single question within a quiz set
 * - Includes timing, scoring, and explanation data
 * - Supports multiple question types and media
 */
export interface Question {
  id: string;
  question_set_id: string;
  question_text: string;
  question_type: QuestionType;
  image_url?: string;
  show_question_time: number;
  answering_time: number;
  points: number;
  difficulty: DifficultyLevel;
  order_index: number;
  created_at: string;
  updated_at: string;
  explanation_title?: string;
  explanation_text?: string;
  explanation_image_url?: string;
  show_explanation_time: number;
}

/**
 * Interface: Answer
 * Description:
 * - Represents an answer option for a question
 * - Supports text and image answers
 * - Tracks correctness and display order
 */
export interface Answer {
  id: string;
  question_id: string;
  answer_text: string;
  image_url?: string;
  is_correct: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * Interface: QuizPlaySettings
 * Description:
 * - Configuration for quiz gameplay
 * - Includes quiz code, player limits, and display options
 * - Controls bonus features and answer visibility
 */
export interface QuizPlaySettings {
  code: number;
  show_question_only: boolean;
  show_explanation: boolean;
  time_bonus: boolean;
  streak_bonus: boolean;
  show_correct_answer: boolean;
  max_players: number;
}

/**
 * Interface: QuizSetWithQuestions
 * Description:
 * - Quiz set extended with question list
 * - Used for displaying quiz with all questions
 */
export interface QuizSetWithQuestions extends QuizSet {
  questions: Question[];
}

/**
 * Interface: QuestionWithAnswers
 * Description:
 * - Question extended with answer options
 * - Used for displaying question with all possible answers
 */
export interface QuestionWithAnswers extends Question {
  answers: Answer[];
}

/**
 * Interface: QuizSetComplete
 * Description:
 * - Complete quiz set with all questions and answers
 * - Used for full quiz data retrieval and editing
 */
export interface QuizSetComplete extends QuizSet {
  questions: QuestionWithAnswers[];
}

/**
 * Interface: CreateQuizSetRequest
 * Description:
 * - Request payload for creating a new quiz set
 * - All fields required except optional thumbnail_url
 */
export interface CreateQuizSetRequest {
  title: string;
  description: string;
  thumbnail_url?: string;
  is_public: boolean;
  difficulty_level: DifficultyLevel;
  category: string;
  tags: string[];
  play_settings: Partial<QuizPlaySettings>;
}

/**
 * Interface: UpdateQuizSetRequest
 * Description:
 * - Request payload for updating an existing quiz set
 * - All fields optional except id
 */
export interface UpdateQuizSetRequest extends Partial<CreateQuizSetRequest> {
  id: string;
  status?: QuizStatus;
}

/**
 * Interface: CreateQuestionRequest
 * Description:
 * - Request payload for creating a new question
 * - Includes question data and answer options
 */
export interface CreateQuestionRequest {
  question_text: string;
  question_type: QuestionType;
  image_url?: string;
  show_question_time: number;
  answering_time: number;
  points: number;
  difficulty: DifficultyLevel;
  order_index: number;
  explanation_title?: string;
  explanation_text?: string;
  explanation_image_url?: string;
  show_explanation_time: number;
  answers: CreateAnswerRequest[];
}

/**
 * Interface: CreateAnswerRequest
 * Description:
 * - Request payload for creating an answer option
 * - Used within CreateQuestionRequest
 */
export interface CreateAnswerRequest {
  answer_text: string;
  image_url?: string;
  is_correct: boolean;
  order_index: number;
}

/**
 * Type: UpdateQuestionRequest
 * Description:
 * - Request payload for updating an existing question
 * - All fields optional
 */
export type UpdateQuestionRequest = Partial<CreateQuestionRequest>;

/**
 * Interface: QuizSetResponse
 * Description:
 * - Response structure for quiz set data
 * - Matches QuizSet interface structure
 */
export interface QuizSetResponse {
  id: string;
  user_id: string;
  title: string;
  description: string;
  thumbnail_url?: string;
  is_public: boolean;
  difficulty_level: DifficultyLevel;
  category: string;
  total_questions: number;
  times_played: number;
  created_at: string;
  updated_at: string;
  status: QuizStatus;
  tags: string[];
  last_played_at?: string;
  play_settings: QuizPlaySettings;
  cloned_from?: string;
}

/**
 * Interface: QuestionResponse
 * Description:
 * - Response structure for question data
 * - Matches Question interface structure
 */
export interface QuestionResponse {
  id: string;
  question_set_id: string;
  question_text: string;
  question_type: QuestionType;
  image_url?: string;
  show_question_time: number;
  answering_time: number;
  points: number;
  difficulty: DifficultyLevel;
  order_index: number;
  created_at: string;
  updated_at: string;
  explanation_title?: string;
  explanation_text?: string;
  explanation_image_url?: string;
  show_explanation_time: number;
}

/**
 * Interface: AnswerResponse
 * Description:
 * - Response structure for answer data
 * - Matches Answer interface structure
 */
export interface AnswerResponse {
  id: string;
  question_id: string;
  answer_text: string;
  image_url?: string;
  is_correct: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * Interface: QuizError
 * Description:
 * - Standard error response structure for quiz operations
 * - Includes error code, message, and optional error code
 */
export interface QuizError {
  error: string;
  message: string;
  code?: string;
}

/**
 * Schema: DifficultyLevelSchema
 * Description:
 * - Validation schema for DifficultyLevel enum
 */
export const DifficultyLevelSchema = z.nativeEnum(DifficultyLevel);

/**
 * Schema: QuizStatusSchema
 * Description:
 * - Validation schema for QuizStatus enum
 */
export const QuizStatusSchema = z.nativeEnum(QuizStatus);

/**
 * Schema: QuestionTypeSchema
 * Description:
 * - Validation schema for QuestionType enum
 */
export const QuestionTypeSchema = z.nativeEnum(QuestionType);

/**
 * Schema: QuizPlaySettingsSchema
 * Description:
 * - Validation schema for quiz play settings
 * - Validates quiz code (6-digit), max players (1-200), and boolean flags
 */
export const QuizPlaySettingsSchema = z.object({
  code: z.number().int().min(QUIZ_CODE_MIN).max(QUIZ_CODE_MAX),
  show_question_only: z.boolean(),
  show_explanation: z.boolean(),
  time_bonus: z.boolean(),
  streak_bonus: z.boolean(),
  show_correct_answer: z.boolean(),
  max_players: z.number().int().min(MAX_PLAYERS_MIN).max(MAX_PLAYERS_MAX),
});

/**
 * Schema: CreateQuizSetSchema
 * Description:
 * - Validation schema for creating a quiz set
 * - Validates title (1-100 chars), description (1-500 chars), category (1-50 chars)
 * - Validates tags (max 10, each 1-30 chars) and optional thumbnail URL
 */
export const CreateQuizSetSchema = z.object({
  title: z.string().min(TITLE_MIN_LENGTH).max(TITLE_MAX_LENGTH),
  description: z.string().min(DESCRIPTION_MIN_LENGTH).max(DESCRIPTION_MAX_LENGTH),
  thumbnail_url: z.string().url().optional(),
  is_public: z.boolean(),
  difficulty_level: DifficultyLevelSchema,
  category: z.string().min(CATEGORY_MIN_LENGTH).max(CATEGORY_MAX_LENGTH),
  tags: z.array(z.string().min(TAG_MIN_LENGTH).max(TAG_MAX_LENGTH)).max(TAG_MAX_COUNT),
  play_settings: QuizPlaySettingsSchema.partial(),
});

/**
 * Schema: UpdateQuizSetSchema
 * Description:
 * - Validation schema for updating a quiz set
 * - All fields optional with same validation rules as CreateQuizSetSchema
 */
export const UpdateQuizSetSchema = z.object({
  title: z.string().min(TITLE_MIN_LENGTH).max(TITLE_MAX_LENGTH).optional(),
  description: z.string().min(DESCRIPTION_MIN_LENGTH).max(DESCRIPTION_MAX_LENGTH).optional(),
  thumbnail_url: z.string().url().optional(),
  is_public: z.boolean().optional(),
  difficulty_level: DifficultyLevelSchema.optional(),
  category: z.string().min(CATEGORY_MIN_LENGTH).max(CATEGORY_MAX_LENGTH).optional(),
  tags: z.array(z.string().min(TAG_MIN_LENGTH).max(TAG_MAX_LENGTH)).max(TAG_MAX_COUNT).optional(),
  play_settings: QuizPlaySettingsSchema.partial().optional(),
  status: QuizStatusSchema.optional(),
});

/**
 * Schema: CreateAnswerSchema
 * Description:
 * - Validation schema for creating an answer option
 * - Validates answer text (1-200 chars) and optional image URL
 */
export const CreateAnswerSchema = z.object({
  answer_text: z.string().min(ANSWER_TEXT_MIN_LENGTH).max(ANSWER_TEXT_MAX_LENGTH),
  image_url: z.string().url().nullable().optional(),
  is_correct: z.boolean(),
  order_index: z.number().int().min(ORDER_INDEX_MIN),
});

/**
 * Schema: CreateQuestionSchema
 * Description:
 * - Validation schema for creating a question
 * - Validates question text (1-500 chars), timing (1-60s for show, 1-300s for answering)
 * - Validates points (1-300), explanation fields, and answer count (2-4)
 */
export const CreateQuestionSchema = z.object({
  question_text: z.string().min(QUESTION_TEXT_MIN_LENGTH).max(QUESTION_TEXT_MAX_LENGTH),
  question_type: QuestionTypeSchema,
  image_url: z.string().url().nullable().optional(),
  show_question_time: z.number().int().min(SHOW_QUESTION_TIME_MIN).max(SHOW_QUESTION_TIME_MAX),
  answering_time: z.number().int().min(ANSWERING_TIME_MIN).max(ANSWERING_TIME_MAX),
  points: z.number().int().min(POINTS_MIN).max(POINTS_MAX),
  difficulty: DifficultyLevelSchema,
  order_index: z.number().int().min(ORDER_INDEX_MIN),
  explanation_title: z
    .string()
    .min(EXPLANATION_TITLE_MIN_LENGTH)
    .max(EXPLANATION_TITLE_MAX_LENGTH)
    .nullable()
    .optional(),
  explanation_text: z
    .string()
    .min(EXPLANATION_TEXT_MIN_LENGTH)
    .max(EXPLANATION_TEXT_MAX_LENGTH)
    .nullable()
    .optional(),
  explanation_image_url: z.string().url().nullable().optional(),
  show_explanation_time: z
    .number()
    .int()
    .min(SHOW_EXPLANATION_TIME_MIN)
    .max(SHOW_EXPLANATION_TIME_MAX),
  answers: z.array(CreateAnswerSchema).min(ANSWER_MIN_COUNT).max(ANSWER_MAX_COUNT),
});

/**
 * Schema: UpdateQuestionSchema
 * Description:
 * - Validation schema for updating a question
 * - All fields optional with same validation rules as CreateQuestionSchema
 */
export const UpdateQuestionSchema = z.object({
  question_text: z.string().min(QUESTION_TEXT_MIN_LENGTH).max(QUESTION_TEXT_MAX_LENGTH).optional(),
  question_type: QuestionTypeSchema.optional(),
  image_url: z.string().url().nullable().optional(),
  show_question_time: z
    .number()
    .int()
    .min(SHOW_QUESTION_TIME_MIN)
    .max(SHOW_QUESTION_TIME_MAX)
    .optional(),
  answering_time: z.number().int().min(ANSWERING_TIME_MIN).max(ANSWERING_TIME_MAX).optional(),
  points: z.number().int().min(POINTS_MIN).max(POINTS_MAX).optional(),
  difficulty: DifficultyLevelSchema.optional(),
  order_index: z.number().int().min(ORDER_INDEX_MIN).optional(),
  explanation_title: z
    .string()
    .min(EXPLANATION_TITLE_MIN_LENGTH)
    .max(EXPLANATION_TITLE_MAX_LENGTH)
    .nullable()
    .optional(),
  explanation_text: z
    .string()
    .min(EXPLANATION_TEXT_MIN_LENGTH)
    .max(EXPLANATION_TEXT_MAX_LENGTH)
    .nullable()
    .optional(),
  explanation_image_url: z.string().url().nullable().optional(),
  show_explanation_time: z
    .number()
    .int()
    .min(SHOW_EXPLANATION_TIME_MIN)
    .max(SHOW_EXPLANATION_TIME_MAX)
    .optional(),
  answers: z.array(CreateAnswerSchema).min(ANSWER_MIN_COUNT).max(ANSWER_MAX_COUNT).optional(),
});

/**
 * Schema: UpdateAnswerSchema
 * Description:
 * - Validation schema for updating an answer option
 * - Same validation rules as CreateAnswerSchema
 */
export const UpdateAnswerSchema = z.object({
  answer_text: z.string().min(ANSWER_TEXT_MIN_LENGTH).max(ANSWER_TEXT_MAX_LENGTH),
  image_url: z.string().url().nullable().optional(),
  is_correct: z.boolean(),
  order_index: z.number().int().min(ORDER_INDEX_MIN),
});

/**
 * Schema: ReorderQuestionsSchema
 * Description:
 * - Validation schema for reordering questions
 * - Requires non-empty array of question UUIDs
 */
export const ReorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

/**
 * Schema: QuizValidationResponseSchema
 * Description:
 * - Validation schema for quiz validation response
 * - Contains validation status, errors, and warnings arrays
 */
export const QuizValidationResponseSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

/**
 * Schema: QuizSetResponseSchema
 * Description:
 * - Validation schema for quiz set response
 * - Validates complete quiz set structure
 */
export const QuizSetResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  thumbnail_url: z.string().nullable(),
  is_public: z.boolean(),
  difficulty_level: DifficultyLevelSchema,
  category: z.string(),
  total_questions: z.number().int().min(0),
  times_played: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string(),
  status: QuizStatusSchema,
  tags: z.array(z.string()),
  last_played_at: z.string().nullable(),
  play_settings: QuizPlaySettingsSchema,
  cloned_from: z.string().nullable(),
});

/**
 * Schema: PublishingResponseSchema
 * Description:
 * - Validation schema for quiz publishing response
 * - Includes message and optional quiz/validation data
 */
export const PublishingResponseSchema = z.object({
  message: z.string(),
  quiz: QuizSetResponseSchema.optional(),
  validation: QuizValidationResponseSchema.optional(),
});

/**
 * Schema: CodeGenerationResponseSchema
 * Description:
 * - Validation schema for quiz code generation response
 * - Includes generated code (6-digit) and quiz reference
 */
export const CodeGenerationResponseSchema = z.object({
  message: z.string(),
  code: z.number().int().min(QUIZ_CODE_MIN).max(QUIZ_CODE_MAX),
  quiz: z.object({
    id: z.string().uuid(),
    play_settings: QuizPlaySettingsSchema,
  }),
});

/**
 * Schema: CodeCheckResponseSchema
 * Description:
 * - Validation schema for quiz code availability check response
 * - Includes code, availability status, and optional quiz ID
 */
export const CodeCheckResponseSchema = z.object({
  code: z.number().int().min(QUIZ_CODE_MIN).max(QUIZ_CODE_MAX),
  isAvailable: z.boolean(),
  quizId: z.string().uuid().nullable(),
  message: z.string(),
});

/**
 * Schema: QuizCodeResponseSchema
 * Description:
 * - Validation schema for quiz code retrieval response
 * - Includes quiz ID, optional code, and code existence flag
 */
export const QuizCodeResponseSchema = z.object({
  quizId: z.string().uuid(),
  code: z.number().int().min(QUIZ_CODE_MIN).max(QUIZ_CODE_MAX).nullable(),
  hasCode: z.boolean(),
  message: z.string(),
});

/**
 * Interface: QuizQueryParams
 * Description:
 * - Query parameters for filtering and paginating quiz lists
 * - Supports filtering by category, difficulty, status, and search
 */
export interface QuizQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  difficulty?: DifficultyLevel;
  status?: QuizStatus;
  search?: string;
  user_id?: string;
  is_public?: string;
  sort_by?: 'created_at' | 'updated_at' | 'times_played' | 'title';
  sort_order?: 'asc' | 'desc';
}

/**
 * Schema: QuizQuerySchema
 * Description:
 * - Validation schema for quiz query parameters
 * - Validates pagination (page min 1, limit 1-100, default 10)
 * - Validates sort fields and orders, is_public enum
 */
export const QuizQuerySchema = z.object({
  page: z.coerce.number().int().min(PAGINATION_PAGE_MIN).default(PAGINATION_PAGE_DEFAULT),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_LIMIT_MIN)
    .max(PAGINATION_LIMIT_MAX)
    .default(PAGINATION_LIMIT_DEFAULT),
  category: z.string().optional(),
  difficulty: DifficultyLevelSchema.optional(),
  status: QuizStatusSchema.optional(),
  search: z.string().optional(),
  user_id: z.string().uuid().optional(),
  is_public: z.enum([IS_PUBLIC_TRUE, IS_PUBLIC_FALSE]).optional(),
  sort_by: z
    .enum([SORT_FIELD_CREATED_AT, SORT_FIELD_UPDATED_AT, SORT_FIELD_TIMES_PLAYED, SORT_FIELD_TITLE])
    .default(SORT_FIELD_CREATED_AT),
  sort_order: z.enum([SORT_ORDER_ASC, SORT_ORDER_DESC]).default(SORT_ORDER_DESC),
});

/**
 * Interface: PaginatedResponse
 * Description:
 * - Generic paginated response structure
 * - Includes data array and pagination metadata
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Type: CreateQuizSetInput
 * Description:
 * - Inferred type from CreateQuizSetSchema
 * - Represents validated input for creating a quiz set
 */
export type CreateQuizSetInput = z.infer<typeof CreateQuizSetSchema>;

/**
 * Type: UpdateQuizSetInput
 * Description:
 * - Inferred type from UpdateQuizSetSchema
 * - Represents validated input for updating a quiz set
 */
export type UpdateQuizSetInput = z.infer<typeof UpdateQuizSetSchema>;

/**
 * Type: CreateQuestionInput
 * Description:
 * - Inferred type from CreateQuestionSchema
 * - Represents validated input for creating a question
 */
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

/**
 * Type: UpdateQuestionInput
 * Description:
 * - Inferred type from UpdateQuestionSchema
 * - Represents validated input for updating a question
 */
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;

/**
 * Type: CreateAnswerInput
 * Description:
 * - Inferred type from CreateAnswerSchema
 * - Represents validated input for creating an answer
 */
export type CreateAnswerInput = z.infer<typeof CreateAnswerSchema>;

/**
 * Type: UpdateAnswerInput
 * Description:
 * - Inferred type from UpdateAnswerSchema
 * - Represents validated input for updating an answer
 */
export type UpdateAnswerInput = z.infer<typeof UpdateAnswerSchema>;

/**
 * Type: ReorderQuestionsInput
 * Description:
 * - Inferred type from ReorderQuestionsSchema
 * - Represents validated input for reordering questions
 */
export type ReorderQuestionsInput = z.infer<typeof ReorderQuestionsSchema>;

/**
 * Type: QuizValidationResponse
 * Description:
 * - Inferred type from QuizValidationResponseSchema
 * - Represents quiz validation result
 */
export type QuizValidationResponse = z.infer<typeof QuizValidationResponseSchema>;

/**
 * Type: PublishingResponse
 * Description:
 * - Inferred type from PublishingResponseSchema
 * - Represents quiz publishing result
 */
export type PublishingResponse = z.infer<typeof PublishingResponseSchema>;

/**
 * Type: CodeGenerationResponse
 * Description:
 * - Inferred type from CodeGenerationResponseSchema
 * - Represents quiz code generation result
 */
export type CodeGenerationResponse = z.infer<typeof CodeGenerationResponseSchema>;

/**
 * Type: CodeCheckResponse
 * Description:
 * - Inferred type from CodeCheckResponseSchema
 * - Represents quiz code availability check result
 */
export type CodeCheckResponse = z.infer<typeof CodeCheckResponseSchema>;

/**
 * Type: QuizCodeResponse
 * Description:
 * - Inferred type from QuizCodeResponseSchema
 * - Represents quiz code retrieval result
 */
export type QuizCodeResponse = z.infer<typeof QuizCodeResponseSchema>;
