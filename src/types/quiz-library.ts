// src/types/quiz-library.ts
import { z } from 'zod';
import { QuizSetResponse, DifficultyLevel } from './quiz';

// ============================================================================
// QUIZ LIBRARY SPECIFIC TYPES
// ============================================================================

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

export interface CloneQuizResponse {
  clonedQuiz: QuizSetResponse;
  message: string;
  originalQuiz: {
    id: string;
    title: string;
    author: string;
  };
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

// Enhanced quiz response with author information for public browsing
export interface PublicQuizResponse extends QuizSetResponse {
  author: {
    id: string;
    display_name?: string;
    username?: string;
  };
  popularity_score?: number;
  recent_plays?: number;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Public quiz browse validation
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

// My library request validation
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

// Clone quiz validation (just quiz ID in params)
export const CloneQuizSchema = z.object({
  quizId: z.string().uuid(),
});

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface LibraryError {
  error: string;
  message: string;
  code?: string;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PublicQuizBrowseInput = z.infer<typeof PublicQuizBrowseSchema>;
export type MyLibraryInput = z.infer<typeof MyLibrarySchema>;
export type CloneQuizInput = z.infer<typeof CloneQuizSchema>;

// ============================================================================
// QUIZ DISCOVERY CATEGORIES
// ============================================================================

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

// ============================================================================
// SORT OPTIONS WITH JAPANESE LABELS
// ============================================================================

export const SORT_OPTIONS = {
  updated_desc: { label: '更新が新しい', field: 'updated_at', order: 'desc' },
  created_desc: { label: '作成が新しい', field: 'created_at', order: 'desc' },
  plays_desc: { label: 'プレイ回数(多い順)', field: 'times_played', order: 'desc' },
  questions_desc: { label: '問題数(多い順)', field: 'total_questions', order: 'desc' },
  title_asc: { label: 'タイトル(A→Z)', field: 'title', order: 'asc' },
} as const;

// ============================================================================
// DIFFICULTY OPTIONS WITH JAPANESE LABELS
// ============================================================================

export const DIFFICULTY_OPTIONS = {
  easy: { label: '簡単', color: 'green' },
  medium: { label: '普通', color: 'yellow' },
  hard: { label: '難しい', color: 'orange' },
  expert: { label: '上級', color: 'red' },
} as const;
