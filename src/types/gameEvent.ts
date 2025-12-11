// src/types/gameEvent.ts
import { z } from 'zod';

/**
 * Game event types matching frontend flow
 */
export enum GameEventType {
  // Question phase
  QUESTION_START = 'question_start',
  QUESTION_END = 'question_end',

  // Answer phase
  PLAYER_ANSWER = 'player_answer',
  ANSWER_REVEAL = 'answer_reveal',
  ANSWER_STATISTICS = 'answer_statistics',

  // Leaderboard phase
  LEADERBOARD_UPDATE = 'leaderboard_update',

  // Explanation phase
  EXPLANATION_SHOW = 'explanation_show',

  // Game control
  GAME_START = 'game_start',
  GAME_PAUSE = 'game_pause',
  GAME_RESUME = 'game_resume',
  GAME_END = 'game_end',

  // Player events
  PLAYER_JOIN = 'player_join',
  PLAYER_LEAVE = 'player_leave',
  PLAYER_DISCONNECT = 'player_disconnect',
  PLAYER_RECONNECT = 'player_reconnect',

  // Host actions
  HOST_ACTION = 'host_action',
}

/**
 * Zod schema for creating a game event
 */
export const CreateGameEventSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  event_type: z.nativeEnum(GameEventType),
  action: z.string().min(1, 'Action is required').max(255, 'Action too long'),
  socket_id: z.string().max(255).optional(),
  device_id: z.string().max(255).optional(),
  player_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  sequence_number: z.number().int().min(0).optional(),
});

export type CreateGameEventInput = z.infer<typeof CreateGameEventSchema>;

/**
 * Game event database interface
 */
export interface GameEvent {
  id: string;
  game_id: string;
  event_type: string;
  socket_id: string | null;
  device_id: string | null;
  player_id: string | null;
  user_id: string | null;
  timestamp: string; // ISO timestamp
  action: string;
  payload: Record<string, unknown>;
  sequence_number: number;
}

/**
 * Query parameters for fetching game events
 */
export const GameEventQuerySchema = z.object({
  event_type: z.string().optional(),
  player_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type GameEventQuery = z.infer<typeof GameEventQuerySchema>;

/**
 * Response wrapper for game events list
 */
export interface GameEventsResponse {
  events: GameEvent[];
  total: number;
  game_id: string;
  limit: number;
  offset: number;
}

/**
 * Game replay data structure
 */
export interface GameReplay {
  game_id: string;
  events: GameEvent[];
  game_info: {
    quiz_set_id: string;
    total_questions: number;
    started_at: string;
    ended_at: string | null;
    status: string;
  };
  statistics: {
    total_events: number;
    total_players: number;
    duration_seconds: number | null;
  };
}

/**
 * Error types for game event operations
 */
export interface GameEventError {
  error: string;
  message: string;
  requestId?: string;
}
