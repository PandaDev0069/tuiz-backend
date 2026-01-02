// src/types/player.ts
import { z } from 'zod';

/**
 * Player role in the game
 */
export type PlayerRole = 'player' | 'host';

/**
 * Zod schema for creating a player
 */
export const CreatePlayerSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  device_id: z.string().min(1, 'Device ID is required').max(100, 'Device ID too long'),
  player_name: z.string().min(1, 'Player name is required').max(100, 'Player name too long').trim(),
  is_logged_in: z.boolean().optional().default(false),
  is_host: z.boolean().optional().default(false),
});

export type CreatePlayerInput = z.infer<typeof CreatePlayerSchema>;

/**
 * Zod schema for updating a player
 */
export const UpdatePlayerSchema = z.object({
  player_name: z
    .string()
    .min(1, 'Player name is required')
    .max(100, 'Player name too long')
    .trim()
    .optional(),
  is_logged_in: z.boolean().optional(),
  is_host: z.boolean().optional(),
});

export type UpdatePlayerInput = z.infer<typeof UpdatePlayerSchema>;

/**
 * Player database interface
 */
export interface Player {
  id: string;
  device_id: string;
  game_id: string;
  player_name: string;
  is_logged_in: boolean;
  is_host: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Player with additional statistics
 */
export interface PlayerWithStats extends Player {
  score?: number;
  total_answers?: number;
  correct_answers?: number;
  accuracy?: number;
  rank?: number;
}

/**
 * Query parameters for fetching players
 */
export const PlayerQuerySchema = z.object({
  is_host: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  is_logged_in: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type PlayerQuery = z.infer<typeof PlayerQuerySchema>;

/**
 * Response wrapper for players list
 */
export interface PlayersResponse {
  players: Player[];
  total: number;
  game_id: string;
  limit: number;
  offset: number;
}

/**
 * Error types for player operations
 */
export interface PlayerError {
  error: string;
  message: string;
  requestId?: string;
}

/**
 * Join game request (for guest players)
 */
export const JoinGameSchema = z.object({
  device_id: z.string().min(1, 'Device ID is required').max(100, 'Device ID too long'),
  player_name: z.string().min(1, 'Player name is required').max(100, 'Player name too long').trim(),
});

export type JoinGameInput = z.infer<typeof JoinGameSchema>;
