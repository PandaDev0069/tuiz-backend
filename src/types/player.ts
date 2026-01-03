// ====================================================
// File Name   : player.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Player type definitions and validation schemas
// - Supports guest and logged-in players
// - Host and player role management

// Notes:
// - Player names: 1-100 characters (trimmed)
// - Device ID required for all players
// - Max 200 players per query (default 100)
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
export const PLAYER_ROLE_PLAYER = 'player';
export const PLAYER_ROLE_HOST = 'host';

const STRING_MIN_LENGTH = 1;
const DEVICE_ID_MAX_LENGTH = 100;
const PLAYER_NAME_MAX_LENGTH = 100;

const PAGINATION_LIMIT_MIN = 1;
const PAGINATION_LIMIT_MAX = 200;
const PAGINATION_LIMIT_DEFAULT = 100;
const PAGINATION_OFFSET_MIN = 0;
const PAGINATION_OFFSET_DEFAULT = 0;

const BOOLEAN_STRING_TRUE = 'true';
const BOOLEAN_STRING_FALSE = 'false';

const BOOLEAN_DEFAULT_FALSE = false;

const ERROR_MESSAGES = {
  INVALID_GAME_ID: 'Invalid game ID',
  DEVICE_ID_REQUIRED: 'Device ID is required',
  DEVICE_ID_TOO_LONG: 'Device ID too long',
  PLAYER_NAME_REQUIRED: 'Player name is required',
  PLAYER_NAME_TOO_LONG: 'Player name too long',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Type: PlayerRole
 * Description:
 * - Represents the role of a player in a game
 * - Can be either 'player' or 'host'
 */
export type PlayerRole = typeof PLAYER_ROLE_PLAYER | typeof PLAYER_ROLE_HOST;

/**
 * Interface: Player
 * Description:
 * - Core player data structure
 * - Tracks player identity, game association, and role
 * - Supports both guest and logged-in players
 */
export interface Player {
  id: string;
  device_id: string;
  game_id: string;
  player_name: string;
  is_logged_in: boolean;
  is_host: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Interface: PlayerWithStats
 * Description:
 * - Extended player record with game statistics
 * - Includes score, answer counts, accuracy, and rank
 */
export interface PlayerWithStats extends Player {
  score?: number;
  total_answers?: number;
  correct_answers?: number;
  accuracy?: number;
  rank?: number;
}

/**
 * Interface: PlayersResponse
 * Description:
 * - Response structure for player list queries
 * - Includes pagination metadata (total, limit, offset)
 */
export interface PlayersResponse {
  players: Player[];
  total: number;
  game_id: string;
  limit: number;
  offset: number;
}

/**
 * Interface: PlayerError
 * Description:
 * - Standard error response structure for player operations
 * - Includes error code, message, and optional request ID
 */
export interface PlayerError {
  error: string;
  message: string;
  requestId?: string;
}

/**
 * Schema: CreatePlayerSchema
 * Description:
 * - Validation schema for creating a new player
 * - Validates game ID (UUID), device ID (1-100 chars), player name (1-100 chars)
 * - Optional flags for login status and host role (default false)
 */
export const CreatePlayerSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  device_id: z
    .string()
    .min(STRING_MIN_LENGTH, ERROR_MESSAGES.DEVICE_ID_REQUIRED)
    .max(DEVICE_ID_MAX_LENGTH, ERROR_MESSAGES.DEVICE_ID_TOO_LONG),
  player_name: z
    .string()
    .min(STRING_MIN_LENGTH, ERROR_MESSAGES.PLAYER_NAME_REQUIRED)
    .max(PLAYER_NAME_MAX_LENGTH, ERROR_MESSAGES.PLAYER_NAME_TOO_LONG)
    .trim(),
  is_logged_in: z.boolean().optional().default(BOOLEAN_DEFAULT_FALSE),
  is_host: z.boolean().optional().default(BOOLEAN_DEFAULT_FALSE),
});

/**
 * Schema: UpdatePlayerSchema
 * Description:
 * - Validation schema for updating player information
 * - All fields optional, validates player name (1-100 chars) if provided
 */
export const UpdatePlayerSchema = z.object({
  player_name: z
    .string()
    .min(STRING_MIN_LENGTH, ERROR_MESSAGES.PLAYER_NAME_REQUIRED)
    .max(PLAYER_NAME_MAX_LENGTH, ERROR_MESSAGES.PLAYER_NAME_TOO_LONG)
    .trim()
    .optional(),
  is_logged_in: z.boolean().optional(),
  is_host: z.boolean().optional(),
});

/**
 * Schema: PlayerQuerySchema
 * Description:
 * - Validation schema for querying players
 * - Supports filtering by is_host and is_logged_in (string to boolean conversion)
 * - Includes pagination with limit (1-200, default 100) and offset (min 0, default 0)
 */
export const PlayerQuerySchema = z.object({
  is_host: z
    .string()
    .optional()
    .transform((val) =>
      val === BOOLEAN_STRING_TRUE ? true : val === BOOLEAN_STRING_FALSE ? false : undefined,
    ),
  is_logged_in: z
    .string()
    .optional()
    .transform((val) =>
      val === BOOLEAN_STRING_TRUE ? true : val === BOOLEAN_STRING_FALSE ? false : undefined,
    ),
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
 * Schema: JoinGameSchema
 * Description:
 * - Validation schema for joining a game
 * - Requires device ID (1-100 chars) and player name (1-100 chars)
 */
export const JoinGameSchema = z.object({
  device_id: z
    .string()
    .min(STRING_MIN_LENGTH, ERROR_MESSAGES.DEVICE_ID_REQUIRED)
    .max(DEVICE_ID_MAX_LENGTH, ERROR_MESSAGES.DEVICE_ID_TOO_LONG),
  player_name: z
    .string()
    .min(STRING_MIN_LENGTH, ERROR_MESSAGES.PLAYER_NAME_REQUIRED)
    .max(PLAYER_NAME_MAX_LENGTH, ERROR_MESSAGES.PLAYER_NAME_TOO_LONG)
    .trim(),
});

/**
 * Type: CreatePlayerInput
 * Description:
 * - Inferred type from CreatePlayerSchema
 * - Represents validated input for creating a player
 */
export type CreatePlayerInput = z.infer<typeof CreatePlayerSchema>;

/**
 * Type: UpdatePlayerInput
 * Description:
 * - Inferred type from UpdatePlayerSchema
 * - Represents validated input for updating a player
 */
export type UpdatePlayerInput = z.infer<typeof UpdatePlayerSchema>;

/**
 * Type: PlayerQuery
 * Description:
 * - Inferred type from PlayerQuerySchema
 * - Represents validated query parameters for fetching players
 */
export type PlayerQuery = z.infer<typeof PlayerQuerySchema>;

/**
 * Type: JoinGameInput
 * Description:
 * - Inferred type from JoinGameSchema
 * - Represents validated input for joining a game
 */
export type JoinGameInput = z.infer<typeof JoinGameSchema>;
