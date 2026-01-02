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
// 2. Type Definitions
//----------------------------------------------------
export type PlayerRole = 'player' | 'host';

//----------------------------------------------------
// 3. Core Interfaces
//----------------------------------------------------
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

export interface PlayerWithStats extends Player {
  score?: number;
  total_answers?: number;
  correct_answers?: number;
  accuracy?: number;
  rank?: number;
}

export interface PlayersResponse {
  players: Player[];
  total: number;
  game_id: string;
  limit: number;
  offset: number;
}

export interface PlayerError {
  error: string;
  message: string;
  requestId?: string;
}

//----------------------------------------------------
// 4. Validation Schemas
//----------------------------------------------------
export const CreatePlayerSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  device_id: z.string().min(1, 'Device ID is required').max(100, 'Device ID too long'),
  player_name: z.string().min(1, 'Player name is required').max(100, 'Player name too long').trim(),
  is_logged_in: z.boolean().optional().default(false),
  is_host: z.boolean().optional().default(false),
});

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

export const PlayerQuerySchema = z.object({
  is_host: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  is_logged_in: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const JoinGameSchema = z.object({
  device_id: z.string().min(1, 'Device ID is required').max(100, 'Device ID too long'),
  player_name: z.string().min(1, 'Player name is required').max(100, 'Player name too long').trim(),
});

//----------------------------------------------------
// 5. Type Exports
//----------------------------------------------------
export type CreatePlayerInput = z.infer<typeof CreatePlayerSchema>;
export type UpdatePlayerInput = z.infer<typeof UpdatePlayerSchema>;
export type PlayerQuery = z.infer<typeof PlayerQuerySchema>;
export type JoinGameInput = z.infer<typeof JoinGameSchema>;
