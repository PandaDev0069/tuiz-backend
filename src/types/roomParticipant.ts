// ====================================================
// File Name   : roomParticipant.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Room participant type definitions and validation schemas
// - Tracks player connections, roles, and status in game rooms
// - Supports host, player, and spectator roles

// Notes:
// - ConnectionStatus: 'active' | 'disconnected' | 'timeout'
// - ParticipantRole: 'host' | 'player' | 'spectator'
// - Includes rejoin functionality for disconnected participants
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

//----------------------------------------------------
// 2. Type Definitions
//----------------------------------------------------
export type ConnectionStatus = 'active' | 'disconnected' | 'timeout';

export type ParticipantRole = 'host' | 'player' | 'spectator';

//----------------------------------------------------
// 3. Core Interfaces
//----------------------------------------------------
export interface RoomParticipant {
  id: string;
  game_id: string;
  socket_id: string;
  device_id: string;
  player_id: string;
  user_id: string | null;
  joined_at: string;
  left_at: string | null;
  role: string;
  status: ConnectionStatus;
  metadata: Record<string, unknown>;
}

export interface RoomParticipantWithPlayer {
  id: string;
  game_id: string;
  socket_id: string;
  device_id: string;
  player_id: string;
  player_name: string;
  user_id: string | null;
  joined_at: string;
  left_at: string | null;
  role: string;
  status: ConnectionStatus;
  is_host: boolean;
  is_logged_in: boolean;
  metadata: Record<string, unknown>;
}

export interface ActiveParticipantsSummary {
  game_id: string;
  total_participants: number;
  active_count: number;
  disconnected_count: number;
  hosts: number;
  players: number;
  spectators: number;
  participants: RoomParticipantWithPlayer[];
}

//----------------------------------------------------
// 4. Validation Schemas
//----------------------------------------------------
export const CreateRoomParticipantSchema = z.object({
  game_id: z.string().uuid('Invalid game_id format'),
  socket_id: z.string().min(1, 'socket_id is required'),
  device_id: z.string().min(1, 'device_id is required'),
  player_id: z.string().uuid('Invalid player_id format'),
  user_id: z.string().uuid('Invalid user_id format').nullable().optional(),
  role: z.enum(['host', 'player', 'spectator']).default('player'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateRoomParticipantData = z.infer<typeof CreateRoomParticipantSchema>;

export const UpdateParticipantStatusSchema = z.object({
  status: z.enum(['active', 'disconnected', 'timeout']),
  socket_id: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateParticipantStatusData = z.infer<typeof UpdateParticipantStatusSchema>;

export const ParticipantQuerySchema = z.object({
  game_id: z.string().uuid().optional(),
  device_id: z.string().optional(),
  player_id: z.string().uuid().optional(),
  socket_id: z.string().optional(),
  status: z.enum(['active', 'disconnected', 'timeout']).optional(),
  role: z.enum(['host', 'player', 'spectator']).optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ParticipantQuery = z.infer<typeof ParticipantQuerySchema>;

export const RejoinRoomSchema = z.object({
  socket_id: z.string().min(1, 'socket_id is required'),
  device_id: z.string().min(1, 'device_id is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RejoinRoomData = z.infer<typeof RejoinRoomSchema>;
