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
// 2. Enums
//----------------------------------------------------
export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert',
}

export enum QuizStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
}

//----------------------------------------------------
// 3. Core Interfaces
//----------------------------------------------------
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

export interface QuizPlaySettings {
  code: number;
  show_question_only: boolean;
  show_explanation: boolean;
  time_bonus: boolean;
  streak_bonus: boolean;
  show_correct_answer: boolean;
  max_players: number;
}

//----------------------------------------------------
// 4. Extended Interfaces
//----------------------------------------------------
export interface QuizSetWithQuestions extends QuizSet {
  questions: Question[];
}

export interface QuestionWithAnswers extends Question {
  answers: Answer[];
}

export interface QuizSetComplete extends QuizSet {
  questions: QuestionWithAnswers[];
}

//----------------------------------------------------
// 5. Request Interfaces
//----------------------------------------------------
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

export interface UpdateQuizSetRequest extends Partial<CreateQuizSetRequest> {
  id: string;
  status?: QuizStatus;
}

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

export interface CreateAnswerRequest {
  answer_text: string;
  image_url?: string;
  is_correct: boolean;
  order_index: number;
}

export type UpdateQuestionRequest = Partial<CreateQuestionRequest>;

//----------------------------------------------------
// 6. Response Interfaces
//----------------------------------------------------
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

export interface QuizError {
  error: string;
  message: string;
  code?: string;
}

//----------------------------------------------------
// 7. Validation Schemas
//----------------------------------------------------
export const DifficultyLevelSchema = z.nativeEnum(DifficultyLevel);

export const QuizStatusSchema = z.nativeEnum(QuizStatus);

export const QuestionTypeSchema = z.nativeEnum(QuestionType);

export const QuizPlaySettingsSchema = z.object({
  code: z.number().int().min(100000).max(999999),
  show_question_only: z.boolean(),
  show_explanation: z.boolean(),
  time_bonus: z.boolean(),
  streak_bonus: z.boolean(),
  show_correct_answer: z.boolean(),
  max_players: z.number().int().min(1).max(200),
});

export const CreateQuizSetSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  thumbnail_url: z.string().url().optional(),
  is_public: z.boolean(),
  difficulty_level: DifficultyLevelSchema,
  category: z.string().min(1).max(50),
  tags: z.array(z.string().min(1).max(30)).max(10),
  play_settings: QuizPlaySettingsSchema.partial(),
});

export const UpdateQuizSetSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  thumbnail_url: z.string().url().optional(),
  is_public: z.boolean().optional(),
  difficulty_level: DifficultyLevelSchema.optional(),
  category: z.string().min(1).max(50).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  play_settings: QuizPlaySettingsSchema.partial().optional(),
  status: QuizStatusSchema.optional(),
});

export const CreateAnswerSchema = z.object({
  answer_text: z.string().min(1).max(200),
  image_url: z.string().url().nullable().optional(),
  is_correct: z.boolean(),
  order_index: z.number().int().min(0),
});

export const CreateQuestionSchema = z.object({
  question_text: z.string().min(1).max(500),
  question_type: QuestionTypeSchema,
  image_url: z.string().url().nullable().optional(),
  show_question_time: z.number().int().min(1).max(60),
  answering_time: z.number().int().min(1).max(300),
  points: z.number().int().min(1).max(300),
  difficulty: DifficultyLevelSchema,
  order_index: z.number().int().min(0),
  explanation_title: z.string().min(1).max(100).nullable().optional(),
  explanation_text: z.string().min(1).max(1000).nullable().optional(),
  explanation_image_url: z.string().url().nullable().optional(),
  show_explanation_time: z.number().int().min(1).max(60),
  answers: z.array(CreateAnswerSchema).min(2).max(4),
});

export const UpdateQuestionSchema = z.object({
  question_text: z.string().min(1).max(500).optional(),
  question_type: QuestionTypeSchema.optional(),
  image_url: z.string().url().nullable().optional(),
  show_question_time: z.number().int().min(1).max(60).optional(),
  answering_time: z.number().int().min(1).max(300).optional(),
  points: z.number().int().min(1).max(300).optional(),
  difficulty: DifficultyLevelSchema.optional(),
  order_index: z.number().int().min(0).optional(),
  explanation_title: z.string().min(1).max(100).nullable().optional(),
  explanation_text: z.string().min(1).max(1000).nullable().optional(),
  explanation_image_url: z.string().url().nullable().optional(),
  show_explanation_time: z.number().int().min(1).max(60).optional(),
  answers: z.array(CreateAnswerSchema).min(2).max(4).optional(),
});

export const UpdateAnswerSchema = z.object({
  answer_text: z.string().min(1).max(200),
  image_url: z.string().url().nullable().optional(),
  is_correct: z.boolean(),
  order_index: z.number().int().min(0),
});

export const ReorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

export const QuizValidationResponseSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

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

export const PublishingResponseSchema = z.object({
  message: z.string(),
  quiz: QuizSetResponseSchema.optional(),
  validation: QuizValidationResponseSchema.optional(),
});

export const CodeGenerationResponseSchema = z.object({
  message: z.string(),
  code: z.number().int().min(100000).max(999999),
  quiz: z.object({
    id: z.string().uuid(),
    play_settings: z.any(),
  }),
});

export const CodeCheckResponseSchema = z.object({
  code: z.number().int().min(100000).max(999999),
  isAvailable: z.boolean(),
  quizId: z.string().uuid().nullable(),
  message: z.string(),
});

export const QuizCodeResponseSchema = z.object({
  quizId: z.string().uuid(),
  code: z.number().int().min(100000).max(999999).nullable(),
  hasCode: z.boolean(),
  message: z.string(),
});

//----------------------------------------------------
// 8. Query Parameters
//----------------------------------------------------
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

export const QuizQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().optional(),
  difficulty: DifficultyLevelSchema.optional(),
  status: QuizStatusSchema.optional(),
  search: z.string().optional(),
  user_id: z.string().uuid().optional(),
  is_public: z.enum(['true', 'false']).optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'times_played', 'title']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

//----------------------------------------------------
// 9. Pagination
//----------------------------------------------------
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

//----------------------------------------------------
// 10. Type Exports
//----------------------------------------------------
export type CreateQuizSetInput = z.infer<typeof CreateQuizSetSchema>;
export type UpdateQuizSetInput = z.infer<typeof UpdateQuizSetSchema>;
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export type CreateAnswerInput = z.infer<typeof CreateAnswerSchema>;
export type UpdateAnswerInput = z.infer<typeof UpdateAnswerSchema>;
export type ReorderQuestionsInput = z.infer<typeof ReorderQuestionsSchema>;
export type QuizValidationResponse = z.infer<typeof QuizValidationResponseSchema>;
export type PublishingResponse = z.infer<typeof PublishingResponseSchema>;
export type CodeGenerationResponse = z.infer<typeof CodeGenerationResponseSchema>;
export type CodeCheckResponse = z.infer<typeof CodeCheckResponseSchema>;
export type QuizCodeResponse = z.infer<typeof QuizCodeResponseSchema>;
