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
// 2. Core Interfaces
//----------------------------------------------------
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

export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  device_id: string;
  score: number;
  rank: number;
  previous_rank?: number;
  rank_change?: 'up' | 'down' | 'same';
  score_change?: number;
  total_answers: number;
  correct_answers: number;
  accuracy: number;
  is_host: boolean;
  is_logged_in: boolean;
}

export interface LeaderboardResponse {
  game_id: string;
  entries: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
  updated_at: string;
}

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

export interface GamePlayerDataError {
  error: string;
  message: string;
  requestId?: string;
}

//----------------------------------------------------
// 3. Validation Schemas
//----------------------------------------------------
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

export const UpdateGamePlayerDataSchema = z.object({
  score: z.number().int().min(0, 'Score must be non-negative').optional(),
  answer_report: z.record(z.string(), z.unknown()).optional(),
});

export const SubmitAnswerSchema = z.object({
  question_id: z.string().uuid('Invalid question ID'),
  question_number: z.number().int().min(1),
  answer_id: z.string().uuid('Invalid answer ID').nullable(),
  is_correct: z.boolean().optional(),
  time_taken: z.number().min(0, 'Time taken must be non-negative'),
  points_earned: z.number().int().min(0, 'Points must be non-negative').optional().default(0),
});

export const LeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

//----------------------------------------------------
// 4. Type Exports
//----------------------------------------------------
export type CreateGamePlayerDataInput = z.infer<typeof CreateGamePlayerDataSchema>;
export type UpdateGamePlayerDataInput = z.infer<typeof UpdateGamePlayerDataSchema>;
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
