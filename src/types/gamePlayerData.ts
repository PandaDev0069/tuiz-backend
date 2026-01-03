// ====================================================
// File Name   : gamePlayerData.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-30

// Description:
// - Game player data and leaderboard type definitions
// - Tracks answers, scores, streaks, and timing statistics
// - Real-time leaderboard with rank change tracking

// Notes:
// - Answer reports stored as JSONB in database
// - Rank history tracks position changes per question
// - Max 200 leaderboard entries per query
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const STRING_MIN_LENGTH = 1;
const DEVICE_ID_MAX_LENGTH = 100;

const SCORE_MIN = 0;
const SCORE_DEFAULT = 0;

const QUESTION_NUMBER_MIN = 1;

const TIME_TAKEN_MIN = 0;
const POINTS_MIN = 0;
const POINTS_DEFAULT = 0;

const PAGINATION_LIMIT_MIN = 1;
const PAGINATION_LIMIT_MAX = 200;
const PAGINATION_LIMIT_DEFAULT = 100;
const PAGINATION_OFFSET_MIN = 0;
const PAGINATION_OFFSET_DEFAULT = 0;

export const RANK_CHANGE_UP = 'up';
export const RANK_CHANGE_DOWN = 'down';
export const RANK_CHANGE_SAME = 'same';

const ERROR_MESSAGES = {
  INVALID_PLAYER_ID: 'Invalid player ID',
  PLAYER_DEVICE_ID_REQUIRED: 'Player device ID is required',
  INVALID_GAME_ID: 'Invalid game ID',
  SCORE_MUST_BE_NON_NEGATIVE: 'Score must be non-negative',
  INVALID_QUESTION_ID: 'Invalid question ID',
  INVALID_ANSWER_ID: 'Invalid answer ID',
  TIME_TAKEN_MUST_BE_NON_NEGATIVE: 'Time taken must be non-negative',
  POINTS_MUST_BE_NON_NEGATIVE: 'Points must be non-negative',
} as const;

const ANSWER_REPORT_DEFAULT = {
  total_answers: 0,
  correct_answers: 0,
  incorrect_answers: 0,
  questions: [] as unknown[],
};

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Interface: AnswerReport
 * Description:
 * - Comprehensive answer tracking structure
 * - Tracks answer statistics, question details, streaks, and timing
 * - Includes rank history for leaderboard position changes
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
  previous_rank?: number;
  current_rank?: number;
  rank_history?: Array<{
    question_number: number;
    rank: number;
    score: number;
    points_earned: number;
    timestamp: string;
  }>;
}

/**
 * Interface: GamePlayerData
 * Description:
 * - Core game player data record
 * - Links player to game with score and answer report
 * - Tracks all player performance data for a game session
 */
export interface GamePlayerData {
  id: string;
  player_id: string;
  player_device_id: string;
  game_id: string;
  score: number;
  answer_report: AnswerReport;
  created_at: string;
  updated_at: string;
}

/**
 * Interface: LeaderboardEntry
 * Description:
 * - Single entry in the game leaderboard
 * - Includes player info, score, rank, and change indicators
 * - Tracks accuracy and answer statistics
 */
export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  device_id: string;
  score: number;
  rank: number;
  previous_rank?: number;
  rank_change?: typeof RANK_CHANGE_UP | typeof RANK_CHANGE_DOWN | typeof RANK_CHANGE_SAME;
  score_change?: number;
  total_answers: number;
  correct_answers: number;
  accuracy: number;
  is_host: boolean;
  is_logged_in: boolean;
}

/**
 * Interface: LeaderboardResponse
 * Description:
 * - Response structure for leaderboard queries
 * - Includes pagination metadata and update timestamp
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
 * Interface: PlayerStats
 * Description:
 * - Comprehensive player statistics for a game
 * - Includes score, accuracy, streaks, timing, and per-question details
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
 * Interface: GamePlayerDataError
 * Description:
 * - Standard error response structure for game player data operations
 * - Includes error code, message, and optional request ID
 */
export interface GamePlayerDataError {
  error: string;
  message: string;
  requestId?: string;
}

/**
 * Schema: CreateGamePlayerDataSchema
 * Description:
 * - Validation schema for creating game player data
 * - Validates player ID (UUID), device ID (1-100 chars), game ID (UUID)
 * - Score defaults to 0, answer_report has default structure
 */
export const CreateGamePlayerDataSchema = z.object({
  player_id: z.string().uuid(ERROR_MESSAGES.INVALID_PLAYER_ID),
  player_device_id: z
    .string()
    .min(STRING_MIN_LENGTH, ERROR_MESSAGES.PLAYER_DEVICE_ID_REQUIRED)
    .max(DEVICE_ID_MAX_LENGTH),
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  score: z
    .number()
    .int()
    .min(SCORE_MIN, ERROR_MESSAGES.SCORE_MUST_BE_NON_NEGATIVE)
    .optional()
    .default(SCORE_DEFAULT),
  answer_report: z
    .object({
      total_answers: z.number().int().min(SCORE_MIN).optional().default(SCORE_DEFAULT),
      correct_answers: z.number().int().min(SCORE_MIN).optional().default(SCORE_DEFAULT),
      incorrect_answers: z.number().int().min(SCORE_MIN).optional().default(SCORE_DEFAULT),
      questions: z.array(z.unknown()).optional().default([]),
      streaks: z.unknown().optional(),
      timing: z.unknown().optional(),
    })
    .optional()
    .default(ANSWER_REPORT_DEFAULT),
});

/**
 * Schema: UpdateGamePlayerDataSchema
 * Description:
 * - Validation schema for updating game player data
 * - All fields optional, validates score if provided
 */
export const UpdateGamePlayerDataSchema = z.object({
  score: z.number().int().min(SCORE_MIN, ERROR_MESSAGES.SCORE_MUST_BE_NON_NEGATIVE).optional(),
  answer_report: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema: SubmitAnswerSchema
 * Description:
 * - Validation schema for submitting an answer
 * - Validates question ID (UUID), question number (min 1), answer ID (UUID or null)
 * - Validates time taken and points (both non-negative)
 */
export const SubmitAnswerSchema = z.object({
  question_id: z.string().uuid(ERROR_MESSAGES.INVALID_QUESTION_ID),
  question_number: z.number().int().min(QUESTION_NUMBER_MIN),
  answer_id: z.string().uuid(ERROR_MESSAGES.INVALID_ANSWER_ID).nullable(),
  is_correct: z.boolean().optional(),
  time_taken: z.number().min(TIME_TAKEN_MIN, ERROR_MESSAGES.TIME_TAKEN_MUST_BE_NON_NEGATIVE),
  points_earned: z
    .number()
    .int()
    .min(POINTS_MIN, ERROR_MESSAGES.POINTS_MUST_BE_NON_NEGATIVE)
    .optional()
    .default(POINTS_DEFAULT),
});

/**
 * Schema: LeaderboardQuerySchema
 * Description:
 * - Validation schema for querying leaderboard
 * - Includes pagination with limit (1-200, default 100) and offset (min 0, default 0)
 */
export const LeaderboardQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_LIMIT_MIN)
    .max(PAGINATION_LIMIT_MAX)
    .optional()
    .default(PAGINATION_LIMIT_DEFAULT),
  offset: z.coerce
    .number()
    .int()
    .min(PAGINATION_OFFSET_MIN)
    .optional()
    .default(PAGINATION_OFFSET_DEFAULT),
});

/**
 * Type: CreateGamePlayerDataInput
 * Description:
 * - Inferred type from CreateGamePlayerDataSchema
 * - Represents validated input for creating game player data
 */
export type CreateGamePlayerDataInput = z.infer<typeof CreateGamePlayerDataSchema>;

/**
 * Type: UpdateGamePlayerDataInput
 * Description:
 * - Inferred type from UpdateGamePlayerDataSchema
 * - Represents validated input for updating game player data
 */
export type UpdateGamePlayerDataInput = z.infer<typeof UpdateGamePlayerDataSchema>;

/**
 * Type: SubmitAnswerInput
 * Description:
 * - Inferred type from SubmitAnswerSchema
 * - Represents validated input for submitting an answer
 */
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;

/**
 * Type: LeaderboardQuery
 * Description:
 * - Inferred type from LeaderboardQuerySchema
 * - Represents validated query parameters for fetching leaderboard
 */
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
