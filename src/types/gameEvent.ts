// ====================================================
// File Name   : gameEvent.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Game event types for real-time game flow tracking
// - Event recording for game replay and analytics
// - Matches frontend game phase transitions

// Notes:
// - Events stored sequentially with sequence_number
// - Supports game replay reconstruction
// - Player actions tracked with device_id and socket_id
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const STRING_MIN_LENGTH = 1;
const ACTION_MAX_LENGTH = 255;
const SOCKET_ID_MAX_LENGTH = 255;
const DEVICE_ID_MAX_LENGTH = 255;

const SEQUENCE_NUMBER_MIN = 0;

const PAGINATION_LIMIT_MIN = 1;
const PAGINATION_LIMIT_MAX = 1000;
const PAGINATION_LIMIT_DEFAULT = 100;
const PAGINATION_OFFSET_MIN = 0;
const PAGINATION_OFFSET_DEFAULT = 0;

const ORDER_ASC = 'asc';
const ORDER_DESC = 'desc';

const ERROR_MESSAGES = {
  INVALID_GAME_ID: 'Invalid game ID',
  ACTION_REQUIRED: 'Action is required',
  ACTION_TOO_LONG: 'Action too long',
} as const;

const EMPTY_OBJECT = {} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Enum: GameEventType
 * Description:
 * - Represents all possible game event types
 * - Covers question phases, answer phases, leaderboard, explanations, game control, and player events
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
 * Interface: GameEvent
 * Description:
 * - Core game event record structure
 * - Tracks all game events with metadata and payload
 * - Includes sequence number for chronological ordering
 */
export interface GameEvent {
  id: string;
  game_id: string;
  event_type: string;
  socket_id: string | null;
  device_id: string | null;
  player_id: string | null;
  user_id: string | null;
  timestamp: string;
  action: string;
  payload: Record<string, unknown>;
  sequence_number: number;
}

/**
 * Interface: GameEventsResponse
 * Description:
 * - Response structure for game events queries
 * - Includes pagination metadata (total, limit, offset)
 */
export interface GameEventsResponse {
  events: GameEvent[];
  total: number;
  game_id: string;
  limit: number;
  offset: number;
}

/**
 * Interface: GameReplay
 * Description:
 * - Complete game replay structure
 * - Includes all events, game info, and statistics
 * - Used for reconstructing and analyzing game sessions
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
 * Interface: GameEventError
 * Description:
 * - Standard error response structure for game event operations
 * - Includes error code, message, and optional request ID
 */
export interface GameEventError {
  error: string;
  message: string;
  requestId?: string;
}

/**
 * Schema: CreateGameEventSchema
 * Description:
 * - Validation schema for creating a game event
 * - Validates game ID (UUID), event type (enum), action (1-255 chars)
 * - Optional socket_id, device_id (max 255), player_id, user_id (UUIDs)
 * - Payload defaults to empty object, sequence_number defaults to 0
 */
export const CreateGameEventSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  event_type: z.nativeEnum(GameEventType),
  action: z
    .string()
    .min(STRING_MIN_LENGTH, ERROR_MESSAGES.ACTION_REQUIRED)
    .max(ACTION_MAX_LENGTH, ERROR_MESSAGES.ACTION_TOO_LONG),
  socket_id: z.string().max(SOCKET_ID_MAX_LENGTH).optional(),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
  player_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional().default(EMPTY_OBJECT),
  sequence_number: z.number().int().min(SEQUENCE_NUMBER_MIN).optional(),
});

/**
 * Schema: GameEventQuerySchema
 * Description:
 * - Validation schema for querying game events
 * - Supports filtering by event_type and player_id
 * - Includes pagination (limit 1-1000, default 100) and ordering (asc/desc, default asc)
 */
export const GameEventQuerySchema = z.object({
  event_type: z.string().optional(),
  player_id: z.string().uuid().optional(),
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
  order: z.enum([ORDER_ASC, ORDER_DESC]).optional().default(ORDER_ASC),
});

/**
 * Type: CreateGameEventInput
 * Description:
 * - Inferred type from CreateGameEventSchema
 * - Represents validated input for creating a game event
 */
export type CreateGameEventInput = z.infer<typeof CreateGameEventSchema>;

/**
 * Type: GameEventQuery
 * Description:
 * - Inferred type from GameEventQuerySchema
 * - Represents validated query parameters for fetching game events
 */
export type GameEventQuery = z.infer<typeof GameEventQuerySchema>;
