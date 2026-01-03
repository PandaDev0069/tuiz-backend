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
// 2. Constants / Configuration
//----------------------------------------------------
const CONNECTION_STATUS_ACTIVE = 'active';
const CONNECTION_STATUS_DISCONNECTED = 'disconnected';
const CONNECTION_STATUS_TIMEOUT = 'timeout';

const PARTICIPANT_ROLE_HOST = 'host';
const PARTICIPANT_ROLE_PLAYER = 'player';
const PARTICIPANT_ROLE_SPECTATOR = 'spectator';

const STRING_MIN_LENGTH = 1;
const PAGINATION_LIMIT_MAX = 100;
const PAGINATION_LIMIT_DEFAULT = 50;
const PAGINATION_OFFSET_MIN = 0;
const PAGINATION_OFFSET_DEFAULT = 0;

const ERROR_MESSAGES = {
  INVALID_GAME_ID_FORMAT: 'Invalid game_id format',
  SOCKET_ID_REQUIRED: 'socket_id is required',
  DEVICE_ID_REQUIRED: 'device_id is required',
  INVALID_PLAYER_ID_FORMAT: 'Invalid player_id format',
  INVALID_USER_ID_FORMAT: 'Invalid user_id format',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Type: ConnectionStatus
 * Description:
 * - Represents the connection state of a room participant
 * - Used for tracking participant connection lifecycle
 */
export type ConnectionStatus =
  | typeof CONNECTION_STATUS_ACTIVE
  | typeof CONNECTION_STATUS_DISCONNECTED
  | typeof CONNECTION_STATUS_TIMEOUT;

/**
 * Type: ParticipantRole
 * Description:
 * - Represents the role of a participant in a game room
 * - Defines permissions and capabilities within the room
 */
export type ParticipantRole =
  | typeof PARTICIPANT_ROLE_HOST
  | typeof PARTICIPANT_ROLE_PLAYER
  | typeof PARTICIPANT_ROLE_SPECTATOR;

/**
 * Interface: RoomParticipant
 * Description:
 * - Core room participant record structure
 * - Tracks participant connection, role, and metadata
 * - Links participant to game, socket, device, and player
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
 * Interface: RoomParticipantWithPlayer
 * Description:
 * - Extended participant record with player information
 * - Includes player name and authentication status flags
 * - Used for displaying participant lists with full context
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
 * Interface: ActiveParticipantsSummary
 * Description:
 * - Aggregated summary of participants in a game room
 * - Provides counts by status and role
 * - Includes full participant list with player details
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

/**
 * Schema: CreateRoomParticipantSchema
 * Description:
 * - Validation schema for creating a new room participant
 * - Requires game_id, socket_id, device_id, and player_id
 * - Optional user_id, role (defaults to 'player'), and metadata
 */
export const CreateRoomParticipantSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID_FORMAT),
  socket_id: z.string().min(STRING_MIN_LENGTH, ERROR_MESSAGES.SOCKET_ID_REQUIRED),
  device_id: z.string().min(STRING_MIN_LENGTH, ERROR_MESSAGES.DEVICE_ID_REQUIRED),
  player_id: z.string().uuid(ERROR_MESSAGES.INVALID_PLAYER_ID_FORMAT),
  user_id: z.string().uuid(ERROR_MESSAGES.INVALID_USER_ID_FORMAT).nullable().optional(),
  role: z
    .enum([PARTICIPANT_ROLE_HOST, PARTICIPANT_ROLE_PLAYER, PARTICIPANT_ROLE_SPECTATOR])
    .default(PARTICIPANT_ROLE_PLAYER),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Type: CreateRoomParticipantData
 * Description:
 * - Inferred type from CreateRoomParticipantSchema
 * - Represents validated data for creating a room participant
 */
export type CreateRoomParticipantData = z.infer<typeof CreateRoomParticipantSchema>;

/**
 * Schema: UpdateParticipantStatusSchema
 * Description:
 * - Validation schema for updating participant connection status
 * - Requires status, optional socket_id and metadata
 */
export const UpdateParticipantStatusSchema = z.object({
  status: z.enum([
    CONNECTION_STATUS_ACTIVE,
    CONNECTION_STATUS_DISCONNECTED,
    CONNECTION_STATUS_TIMEOUT,
  ]),
  socket_id: z.string().min(STRING_MIN_LENGTH).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Type: UpdateParticipantStatusData
 * Description:
 * - Inferred type from UpdateParticipantStatusSchema
 * - Represents validated data for updating participant status
 */
export type UpdateParticipantStatusData = z.infer<typeof UpdateParticipantStatusSchema>;

/**
 * Schema: ParticipantQuerySchema
 * Description:
 * - Validation schema for querying room participants
 * - Supports filtering by game_id, device_id, player_id, socket_id, status, and role
 * - Includes pagination with limit (max 100, default 50) and offset (min 0, default 0)
 */
export const ParticipantQuerySchema = z.object({
  game_id: z.string().uuid().optional(),
  device_id: z.string().optional(),
  player_id: z.string().uuid().optional(),
  socket_id: z.string().optional(),
  status: z
    .enum([CONNECTION_STATUS_ACTIVE, CONNECTION_STATUS_DISCONNECTED, CONNECTION_STATUS_TIMEOUT])
    .optional(),
  role: z
    .enum([PARTICIPANT_ROLE_HOST, PARTICIPANT_ROLE_PLAYER, PARTICIPANT_ROLE_SPECTATOR])
    .optional(),
  limit: z.number().int().positive().max(PAGINATION_LIMIT_MAX).default(PAGINATION_LIMIT_DEFAULT),
  offset: z.number().int().min(PAGINATION_OFFSET_MIN).default(PAGINATION_OFFSET_DEFAULT),
});

/**
 * Type: ParticipantQuery
 * Description:
 * - Inferred type from ParticipantQuerySchema
 * - Represents validated query parameters for fetching room participants
 */
export type ParticipantQuery = z.infer<typeof ParticipantQuerySchema>;

/**
 * Schema: RejoinRoomSchema
 * Description:
 * - Validation schema for rejoining a room after disconnection
 * - Requires socket_id and device_id, optional metadata
 */
export const RejoinRoomSchema = z.object({
  socket_id: z.string().min(STRING_MIN_LENGTH, ERROR_MESSAGES.SOCKET_ID_REQUIRED),
  device_id: z.string().min(STRING_MIN_LENGTH, ERROR_MESSAGES.DEVICE_ID_REQUIRED),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Type: RejoinRoomData
 * Description:
 * - Inferred type from RejoinRoomSchema
 * - Represents validated data for rejoining a room
 */
export type RejoinRoomData = z.infer<typeof RejoinRoomSchema>;
