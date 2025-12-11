// src/types/gamePlayerData.ts
import { z } from 'zod';

/**
 * Answer report structure stored in jsonb
 */
export interface AnswerReport {
  total_answers: number;
  correct_answers: number;
  incorrect_answers: number;
  questions: Array<{
    question_id: string;
    question_number: number;
    answer_id: string | null;
    is_correct: boolean;
    time_taken: number; // seconds
    points_earned: number;
    answered_at: string; // ISO timestamp
  }>;
  streaks?: {
    current_streak: number;
    max_streak: number;
  };
  timing?: {
    average_response_time: number;
    fastest_response: number;
    slowest_response: number;
  };
}

/**
 * Zod schema for creating game player data
 */
export const CreateGamePlayerDataSchema = z.object({
  player_id: z.string().uuid('Invalid player ID'),
  player_device_id: z.string().min(1, 'Player device ID is required').max(100),
  game_id: z.string().uuid('Invalid game ID'),
  score: z.number().int().min(0, 'Score must be non-negative').optional().default(0),
  answer_report: z
    .object({
      total_answers: z.number().int().min(0).optional().default(0),
      correct_answers: z.number().int().min(0).optional().default(0),
      incorrect_answers: z.number().int().min(0).optional().default(0),
      questions: z.array(z.any()).optional().default([]),
      streaks: z.any().optional(),
      timing: z.any().optional(),
    })
    .optional()
    .default({
      total_answers: 0,
      correct_answers: 0,
      incorrect_answers: 0,
      questions: [],
    }),
});

export type CreateGamePlayerDataInput = z.infer<typeof CreateGamePlayerDataSchema>;

/**
 * Zod schema for updating game player data
 */
export const UpdateGamePlayerDataSchema = z.object({
  score: z.number().int().min(0, 'Score must be non-negative').optional(),
  answer_report: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateGamePlayerDataInput = z.infer<typeof UpdateGamePlayerDataSchema>;

/**
 * Zod schema for submitting an answer
 */
export const SubmitAnswerSchema = z.object({
  question_id: z.string().uuid('Invalid question ID'),
  question_number: z.number().int().min(1),
  answer_id: z.string().uuid('Invalid answer ID').nullable(),
  is_correct: z.boolean(),
  time_taken: z.number().min(0, 'Time taken must be non-negative'),
  points_earned: z.number().int().min(0, 'Points must be non-negative').optional().default(0),
});

export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;

/**
 * Game player data database interface
 */
export interface GamePlayerData {
  id: string;
  player_id: string;
  player_device_id: string;
  game_id: string;
  score: number;
  answer_report: AnswerReport;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Leaderboard entry with player info
 */
export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  device_id: string;
  score: number;
  rank: number;
  total_answers: number;
  correct_answers: number;
  accuracy: number;
  is_host: boolean;
  is_logged_in: boolean;
}

/**
 * Query parameters for leaderboard
 */
export const LeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

/**
 * Leaderboard response
 */
export interface LeaderboardResponse {
  game_id: string;
  entries: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
  updated_at: string;
}

/**
 * Player statistics summary
 */
export interface PlayerStats {
  player_id: string;
  player_name: string;
  score: number;
  rank: number;
  total_answers: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy: number;
  current_streak: number;
  max_streak: number;
  average_response_time: number;
  fastest_response: number;
  slowest_response: number;
  questions: Array<{
    question_id: string;
    question_number: number;
    is_correct: boolean;
    time_taken: number;
    points_earned: number;
  }>;
}

/**
 * Error types for game player data operations
 */
export interface GamePlayerDataError {
  error: string;
  message: string;
  requestId?: string;
}
