import { z } from 'zod';

// =============================================
// Room Participant Types
// =============================================

/**
 * Room participant connection status matching DB enum
 */
export type ConnectionStatus = 'active' | 'disconnected' | 'timeout';

/**
 * Room participant role
 */
export type ParticipantRole = 'host' | 'player' | 'spectator';

/**
 * Room participant from database
 */
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

/**
 * Room participant with player details
 */
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

/**
 * Active participants summary
 */
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

// =============================================
// Zod Validation Schemas
// =============================================

/**
 * Schema for creating a room participant
 */
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

/**
 * Schema for updating participant status
 */
export const UpdateParticipantStatusSchema = z.object({
  status: z.enum(['active', 'disconnected', 'timeout']),
  socket_id: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateParticipantStatusData = z.infer<typeof UpdateParticipantStatusSchema>;

/**
 * Schema for participant query filters
 */
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

/**
 * Schema for rejoining a room
 */
export const RejoinRoomSchema = z.object({
  socket_id: z.string().min(1, 'socket_id is required'),
  device_id: z.string().min(1, 'device_id is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RejoinRoomData = z.infer<typeof RejoinRoomSchema>;
