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
// 2. Request Interfaces
//----------------------------------------------------
export interface PublicQuizBrowseRequest {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  difficulty?: DifficultyLevel;
  sort?: 'updated_desc' | 'created_desc' | 'plays_desc' | 'questions_desc' | 'title_asc';
  tags?: string[];
}

export interface MyLibraryRequest {
  status?: 'all' | 'drafts' | 'published';
  category?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface LibraryFilters {
  category: string;
  difficulty: string;
  sortBy: 'updated_desc' | 'created_desc' | 'plays_desc' | 'questions_desc' | 'title_asc';
  tags: string[];
  dateRange?: 'week' | 'month' | 'year' | 'all';
  questionCount?: 'few' | 'medium' | 'many' | 'all';
  playCount?: 'low' | 'medium' | 'high' | 'all';
}

//----------------------------------------------------
// 3. Response Interfaces
//----------------------------------------------------
export interface PublicQuizResponse extends QuizSetResponse {
  author: {
    id: string;
    display_name?: string;
    username?: string;
  };
  popularity_score?: number;
  recent_plays?: number;
}

export interface CloneQuizResponse {
  clonedQuiz: QuizSetResponse;
  message: string;
  originalQuiz: {
    id: string;
    title: string;
    author: string;
  };
}

export interface LibraryError {
  error: string;
  message: string;
  code?: string;
}

//----------------------------------------------------
// 4. Validation Schemas
//----------------------------------------------------
export const PublicQuizBrowseSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  sort: z
    .enum(['updated_desc', 'created_desc', 'plays_desc', 'questions_desc', 'title_asc'])
    .default('updated_desc'),
  tags: z.array(z.string()).optional(),
});

export const MyLibrarySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['all', 'drafts', 'published']).default('all'),
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z
    .enum(['updated_desc', 'created_desc', 'plays_desc', 'questions_desc', 'title_asc'])
    .default('updated_desc'),
});

export const CloneQuizSchema = z.object({
  quizId: z.string().uuid(),
});

//----------------------------------------------------
// 5. Type Exports
//----------------------------------------------------
export type PublicQuizBrowseInput = z.infer<typeof PublicQuizBrowseSchema>;
export type MyLibraryInput = z.infer<typeof MyLibrarySchema>;
export type CloneQuizInput = z.infer<typeof CloneQuizSchema>;

//----------------------------------------------------
// 6. Constants
//----------------------------------------------------
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

export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];

export const SORT_OPTIONS = {
  updated_desc: { label: '更新が新しい', field: 'updated_at', order: 'desc' },
  created_desc: { label: '作成が新しい', field: 'created_at', order: 'desc' },
  plays_desc: { label: 'プレイ回数(多い順)', field: 'times_played', order: 'desc' },
  questions_desc: { label: '問題数(多い順)', field: 'total_questions', order: 'desc' },
  title_asc: { label: 'タイトル(A→Z)', field: 'title', order: 'asc' },
} as const;

export const DIFFICULTY_OPTIONS = {
  easy: { label: '簡単', color: 'green' },
  medium: { label: '普通', color: 'yellow' },
  hard: { label: '難しい', color: 'orange' },
  expert: { label: '上級', color: 'red' },
} as const;
