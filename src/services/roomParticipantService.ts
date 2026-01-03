// ====================================================
// File Name   : roomParticipantService.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-12

// Description:
// - Service class for managing room participants
// - Tracks WebSocket connections, room membership, and participant history
// - Handles participant lifecycle: add, update, remove, and rejoin operations

// Notes:
// - Validates game and player existence before adding participants
// - Supports participant status tracking (active, disconnected, timeout)
// - Provides participant queries with player details and summaries
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CreateRoomParticipantData,
  UpdateParticipantStatusData,
  ParticipantQuery,
  RoomParticipant,
  RoomParticipantWithPlayer,
  ActiveParticipantsSummary,
  RejoinRoomData,
} from '../types/roomParticipant';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const DEFAULT_PARTICIPANT_LIMIT = 50;
const DEFAULT_OFFSET = 0;
const DEFAULT_HISTORY_LIMIT = 10;
const REJOIN_QUERY_LIMIT = 1;

const TABLE_GAMES = 'games';
const TABLE_PLAYERS = 'players';
const TABLE_ROOM_PARTICIPANTS = 'room_participants';

const COLUMN_ID = 'id';
const COLUMN_GAME_ID = 'game_id';
const COLUMN_SOCKET_ID = 'socket_id';
const COLUMN_DEVICE_ID = 'device_id';
const COLUMN_PLAYER_ID = 'player_id';
const COLUMN_USER_ID = 'user_id';
const COLUMN_ROLE = 'role';
const COLUMN_STATUS = 'status';
const COLUMN_JOINED_AT = 'joined_at';
const COLUMN_LEFT_AT = 'left_at';
const COLUMN_METADATA = 'metadata';
const SELECT_ALL = '*';

const STATUS_ACTIVE = 'active';
const STATUS_DISCONNECTED = 'disconnected';
const STATUS_TIMEOUT = 'timeout';

const ROLE_PLAYER = 'player';
const ROLE_SPECTATOR = 'spectator';

const PLAYER_NAME_UNKNOWN = 'Unknown';
const EMPTY_OBJECT = {};

const PLAYERS_SELECT_QUERY = `
  *,
  players (
    name,
    is_host,
    user_id
  )
`;

const ERROR_MESSAGES = {
  GAME_ID_REQUIRED: 'game_id is required',
  SOCKET_ID_REQUIRED: 'socket_id is required',
  DEVICE_ID_REQUIRED: 'device_id is required',
  PLAYER_ID_REQUIRED: 'player_id is required',
  GAME_NOT_FOUND: 'Game not found',
  PLAYER_NOT_FOUND: 'Player not found',
  ADD_PARTICIPANT_FAILED: 'Failed to add participant',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  PARTICIPANT_ID_REQUIRED: 'participantId is required',
  STATUS_REQUIRED: 'status is required',
  UPDATE_STATUS_FAILED: 'Failed to update participant status',
  GAME_ID_REQUIRED_FOR_QUERY: 'gameId is required',
  FETCH_PARTICIPANTS_FAILED: 'Failed to fetch participants',
  FETCH_SUMMARY_FAILED: 'Failed to fetch participants summary',
  SOCKET_ID_REQUIRED_FOR_QUERY: 'socketId is required',
  FETCH_PARTICIPANT_FAILED: 'Failed to fetch participant',
  PARTICIPANT_NOT_FOUND: 'Participant not found',
  PLAYER_ID_REQUIRED_FOR_REJOIN: 'playerId is required',
  FIND_PARTICIPANT_FAILED: 'Failed to find participant',
  NO_PARTICIPANT_RECORD_FOUND: 'No participant record found',
  REJOIN_ROOM_FAILED: 'Failed to rejoin room',
  REMOVE_PARTICIPANT_FAILED: 'Failed to remove participant',
  DEVICE_ID_REQUIRED_FOR_HISTORY: 'deviceId is required',
  FETCH_HISTORY_FAILED: 'Failed to fetch participant history',
} as const;

const LOG_MESSAGES = {
  ADD_PARTICIPANT_MISSING_GAME_ID: 'addParticipant called with missing game_id',
  ADD_PARTICIPANT_MISSING_SOCKET_ID: 'addParticipant called with missing socket_id',
  ADD_PARTICIPANT_MISSING_DEVICE_ID: 'addParticipant called with missing device_id',
  ADD_PARTICIPANT_MISSING_PLAYER_ID: 'addParticipant called with missing player_id',
  GAME_NOT_FOUND: 'Game not found',
  PLAYER_NOT_FOUND: 'Player not found',
  ERROR_ADDING_PARTICIPANT: 'Error adding participant',
  PARTICIPANT_ADDED: 'Participant added',
  EXCEPTION_ADDING_PARTICIPANT: 'Unexpected error adding participant',
  UPDATE_STATUS_MISSING_PARTICIPANT_ID: 'updateParticipantStatus called with missing participantId',
  UPDATE_STATUS_MISSING_STATUS: 'updateParticipantStatus called with missing status',
  ERROR_UPDATING_STATUS: 'Error updating participant status',
  PARTICIPANT_STATUS_UPDATED: 'Participant status updated',
  EXCEPTION_UPDATING_STATUS: 'Unexpected error updating participant status',
  GET_PARTICIPANTS_MISSING_GAME_ID: 'getGameParticipants called with missing gameId',
  ERROR_FETCHING_PARTICIPANTS: 'Error fetching game participants',
  EXCEPTION_FETCHING_PARTICIPANTS: 'Unexpected error fetching game participants',
  GET_SUMMARY_MISSING_GAME_ID: 'getActiveParticipantsSummary called with missing gameId',
  ERROR_FETCHING_SUMMARY: 'Error fetching active participants summary',
  EXCEPTION_FETCHING_SUMMARY: 'Unexpected error fetching active participants summary',
  GET_BY_SOCKET_MISSING_SOCKET_ID: 'getParticipantBySocketId called with missing socketId',
  ERROR_FETCHING_BY_SOCKET: 'Error fetching participant by socket',
  EXCEPTION_FETCHING_BY_SOCKET: 'Unexpected error fetching participant by socket',
  REJOIN_MISSING_GAME_ID: 'rejoinRoom called with missing gameId',
  REJOIN_MISSING_PLAYER_ID: 'rejoinRoom called with missing playerId',
  ERROR_FINDING_PARTICIPANT: 'Error finding participant',
  NO_EXISTING_PARTICIPANT_FOR_REJOIN: 'No existing participant found for rejoin',
  ERROR_REJOINING_ROOM: 'Error rejoining room',
  PARTICIPANT_REJOINED_ROOM: 'Participant rejoined room',
  EXCEPTION_REJOINING_ROOM: 'Unexpected error rejoining room',
  REMOVE_MISSING_PARTICIPANT_ID: 'removeParticipant called with missing participantId',
  ERROR_REMOVING_PARTICIPANT: 'Error removing participant',
  PARTICIPANT_REMOVED: 'Participant removed',
  EXCEPTION_REMOVING_PARTICIPANT: 'Unexpected error removing participant',
  GET_HISTORY_MISSING_DEVICE_ID: 'getDeviceParticipantHistory called with missing deviceId',
  ERROR_FETCHING_HISTORY: 'Error fetching device participant history',
  EXCEPTION_FETCHING_HISTORY: 'Unexpected error fetching device participant history',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
interface ParticipantData {
  id: string;
  game_id: string;
  socket_id: string;
  device_id: string;
  player_id: string;
  user_id: string | null;
  joined_at: string;
  left_at: string | null;
  role: string;
  status: 'active' | 'disconnected' | 'timeout';
  metadata: Record<string, unknown>;
  players: { name: string; is_host: boolean; user_id: string | null } | null;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Class: RoomParticipantService
 * Description:
 * - Service class for managing room participants
 * - Tracks WebSocket connections, room membership, and participant history
 * - Handles participant lifecycle: add, update, remove, and rejoin operations
 */
export class RoomParticipantService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Method: addParticipant
   * Description:
   * - Adds a participant to a room
   * - Validates required fields and verifies game and player existence
   * - Creates participant record with initial status
   *
   * Parameters:
   * - data (CreateRoomParticipantData): Participant creation data
   *
   * Returns:
   * - Promise<{ success: boolean; participant?: RoomParticipant; error?: string }>: Result with participant or error
   */
  async addParticipant(
    data: CreateRoomParticipantData,
  ): Promise<{ success: boolean; participant?: RoomParticipant; error?: string }> {
    try {
      const validationError = this.validateAddParticipantInput(data);
      if (validationError) {
        return validationError;
      }

      const gameExists = await this.verifyGameExists(data.game_id);
      if (!gameExists) {
        return { success: false, error: ERROR_MESSAGES.GAME_NOT_FOUND };
      }

      const playerExists = await this.verifyPlayerExists(data.player_id);
      if (!playerExists) {
        return { success: false, error: ERROR_MESSAGES.PLAYER_NOT_FOUND };
      }

      const participant = await this.insertParticipant(data);
      if (!participant) {
        return { success: false, error: ERROR_MESSAGES.ADD_PARTICIPANT_FAILED };
      }

      logger.info(
        { participantId: participant.id, gameId: data.game_id },
        LOG_MESSAGES.PARTICIPANT_ADDED,
      );
      return { success: true, participant };
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_ADDING_PARTICIPANT);
      return { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Method: updateParticipantStatus
   * Description:
   * - Updates participant status (active, disconnected, timeout)
   * - Optionally updates socket_id for reconnection
   * - Sets left_at timestamp for disconnected/timeout status
   *
   * Parameters:
   * - participantId (string): Participant ID to update
   * - data (UpdateParticipantStatusData): Status update data
   *
   * Returns:
   * - Promise<{ success: boolean; participant?: RoomParticipant; error?: string }>: Result with participant or error
   */
  async updateParticipantStatus(
    participantId: string,
    data: UpdateParticipantStatusData,
  ): Promise<{ success: boolean; participant?: RoomParticipant; error?: string }> {
    try {
      if (!participantId) {
        logger.error(LOG_MESSAGES.UPDATE_STATUS_MISSING_PARTICIPANT_ID);
        return { success: false, error: ERROR_MESSAGES.PARTICIPANT_ID_REQUIRED };
      }

      if (!data.status) {
        logger.error({ participantId }, LOG_MESSAGES.UPDATE_STATUS_MISSING_STATUS);
        return { success: false, error: ERROR_MESSAGES.STATUS_REQUIRED };
      }

      const updateData = this.buildStatusUpdateData(data);

      const { data: participant, error } = await this.supabase
        .from(TABLE_ROOM_PARTICIPANTS)
        .update(updateData)
        .eq(COLUMN_ID, participantId)
        .select()
        .single();

      if (error) {
        logger.error({ error, participantId }, LOG_MESSAGES.ERROR_UPDATING_STATUS);
        return { success: false, error: ERROR_MESSAGES.UPDATE_STATUS_FAILED };
      }

      logger.info({ participantId, status: data.status }, LOG_MESSAGES.PARTICIPANT_STATUS_UPDATED);
      return { success: true, participant };
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_UPDATING_STATUS);
      return { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Method: getGameParticipants
   * Description:
   * - Retrieves participants for a game with player details
   * - Supports filtering by status, role, and device_id
   * - Provides pagination and ordering
   *
   * Parameters:
   * - gameId (string): Game ID to fetch participants for
   * - query (Partial<ParticipantQuery>): Query parameters for filtering and pagination
   *
   * Returns:
   * - Promise<{ success: boolean; participants?: RoomParticipantWithPlayer[]; error?: string }>: Result with participants or error
   */
  async getGameParticipants(
    gameId: string,
    query: Partial<ParticipantQuery> = {},
  ): Promise<{ success: boolean; participants?: RoomParticipantWithPlayer[]; error?: string }> {
    try {
      if (!gameId) {
        logger.error(LOG_MESSAGES.GET_PARTICIPANTS_MISSING_GAME_ID);
        return { success: false, error: ERROR_MESSAGES.GAME_ID_REQUIRED_FOR_QUERY };
      }

      const dbQuery = this.buildParticipantsQuery(gameId, query);
      const { data: participants, error } = await dbQuery;

      if (error) {
        logger.error({ error, gameId }, LOG_MESSAGES.ERROR_FETCHING_PARTICIPANTS);
        return { success: false, error: ERROR_MESSAGES.FETCH_PARTICIPANTS_FAILED };
      }

      const result = this.transformParticipantsWithPlayer(participants || []);

      return { success: true, participants: result };
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_FETCHING_PARTICIPANTS);
      return { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Method: getActiveParticipantsSummary
   * Description:
   * - Retrieves active participants summary for a game
   * - Calculates counts by status, role, and host status
   * - Includes full participant list with player details
   *
   * Parameters:
   * - gameId (string): Game ID to fetch summary for
   *
   * Returns:
   * - Promise<{ success: boolean; summary?: ActiveParticipantsSummary; error?: string }>: Result with summary or error
   */
  async getActiveParticipantsSummary(
    gameId: string,
  ): Promise<{ success: boolean; summary?: ActiveParticipantsSummary; error?: string }> {
    try {
      if (!gameId) {
        logger.error(LOG_MESSAGES.GET_SUMMARY_MISSING_GAME_ID);
        return { success: false, error: ERROR_MESSAGES.GAME_ID_REQUIRED_FOR_QUERY };
      }

      const participants = await this.fetchParticipantsWithPlayerDetails(gameId);
      if (participants === null) {
        return { success: false, error: ERROR_MESSAGES.FETCH_SUMMARY_FAILED };
      }

      const participantsList = this.transformParticipantsWithPlayer(participants);
      const summary = this.calculateParticipantsSummary(gameId, participantsList);

      return { success: true, summary };
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_FETCHING_SUMMARY);
      return { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Method: getParticipantBySocketId
   * Description:
   * - Retrieves participant by socket ID
   * - Only returns active participants
   *
   * Parameters:
   * - socketId (string): Socket ID to search for
   *
   * Returns:
   * - Promise<{ success: boolean; participant?: RoomParticipant; error?: string }>: Result with participant or error
   */
  async getParticipantBySocketId(
    socketId: string,
  ): Promise<{ success: boolean; participant?: RoomParticipant; error?: string }> {
    try {
      if (!socketId) {
        logger.error(LOG_MESSAGES.GET_BY_SOCKET_MISSING_SOCKET_ID);
        return { success: false, error: ERROR_MESSAGES.SOCKET_ID_REQUIRED_FOR_QUERY };
      }

      const { data: participant, error } = await this.supabase
        .from(TABLE_ROOM_PARTICIPANTS)
        .select(SELECT_ALL)
        .eq(COLUMN_SOCKET_ID, socketId)
        .eq(COLUMN_STATUS, STATUS_ACTIVE)
        .maybeSingle();

      if (error) {
        logger.error({ error, socketId }, LOG_MESSAGES.ERROR_FETCHING_BY_SOCKET);
        return { success: false, error: ERROR_MESSAGES.FETCH_PARTICIPANT_FAILED };
      }

      if (!participant) {
        return { success: false, error: ERROR_MESSAGES.PARTICIPANT_NOT_FOUND };
      }

      return { success: true, participant };
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_FETCHING_BY_SOCKET);
      return { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Method: rejoinRoom
   * Description:
   * - Rejoins a room (reconnection support)
   * - Updates existing participant record with new socket_id
   * - Reactivates participant status
   *
   * Parameters:
   * - gameId (string): Game ID
   * - playerId (string): Player ID
   * - data (RejoinRoomData): Rejoin data with new socket_id
   *
   * Returns:
   * - Promise<{ success: boolean; participant?: RoomParticipant; error?: string }>: Result with participant or error
   */
  async rejoinRoom(
    gameId: string,
    playerId: string,
    data: RejoinRoomData,
  ): Promise<{ success: boolean; participant?: RoomParticipant; error?: string }> {
    try {
      if (!gameId) {
        logger.error(LOG_MESSAGES.REJOIN_MISSING_GAME_ID);
        return { success: false, error: ERROR_MESSAGES.GAME_ID_REQUIRED_FOR_QUERY };
      }

      if (!playerId) {
        logger.error({ gameId }, LOG_MESSAGES.REJOIN_MISSING_PLAYER_ID);
        return { success: false, error: ERROR_MESSAGES.PLAYER_ID_REQUIRED_FOR_REJOIN };
      }

      const existingParticipant = await this.findMostRecentParticipant(gameId, playerId);
      if (!existingParticipant) {
        return { success: false, error: ERROR_MESSAGES.NO_PARTICIPANT_RECORD_FOUND };
      }

      const participant = await this.updateParticipantForRejoin(
        existingParticipant.id,
        data,
        existingParticipant.metadata,
      );
      if (!participant) {
        return { success: false, error: ERROR_MESSAGES.REJOIN_ROOM_FAILED };
      }

      logger.info(
        { participantId: participant.id, gameId, playerId },
        LOG_MESSAGES.PARTICIPANT_REJOINED_ROOM,
      );
      return { success: true, participant };
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_REJOINING_ROOM);
      return { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Method: removeParticipant
   * Description:
   * - Removes a participant from a room (mark as left)
   * - Updates status to disconnected and sets left_at timestamp
   *
   * Parameters:
   * - participantId (string): Participant ID to remove
   *
   * Returns:
   * - Promise<{ success: boolean; error?: string }>: Success status or error
   */
  async removeParticipant(participantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!participantId) {
        logger.error(LOG_MESSAGES.REMOVE_MISSING_PARTICIPANT_ID);
        return { success: false, error: ERROR_MESSAGES.PARTICIPANT_ID_REQUIRED };
      }

      const { error } = await this.supabase
        .from(TABLE_ROOM_PARTICIPANTS)
        .update({
          [COLUMN_STATUS]: STATUS_DISCONNECTED,
          [COLUMN_LEFT_AT]: new Date().toISOString(),
        })
        .eq(COLUMN_ID, participantId);

      if (error) {
        logger.error({ error, participantId }, LOG_MESSAGES.ERROR_REMOVING_PARTICIPANT);
        return { success: false, error: ERROR_MESSAGES.REMOVE_PARTICIPANT_FAILED };
      }

      logger.info({ participantId }, LOG_MESSAGES.PARTICIPANT_REMOVED);
      return { success: true };
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_REMOVING_PARTICIPANT);
      return { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Method: getDeviceParticipantHistory
   * Description:
   * - Retrieves participant history for a device
   * - Returns most recent participants ordered by joined_at
   *
   * Parameters:
   * - deviceId (string): Device ID to fetch history for
   * - limit (number): Maximum number of records to return (default: 10)
   *
   * Returns:
   * - Promise<{ success: boolean; participants?: RoomParticipant[]; error?: string }>: Result with participants or error
   */
  async getDeviceParticipantHistory(
    deviceId: string,
    limit: number = DEFAULT_HISTORY_LIMIT,
  ): Promise<{ success: boolean; participants?: RoomParticipant[]; error?: string }> {
    try {
      if (!deviceId) {
        logger.error(LOG_MESSAGES.GET_HISTORY_MISSING_DEVICE_ID);
        return { success: false, error: ERROR_MESSAGES.DEVICE_ID_REQUIRED_FOR_HISTORY };
      }

      const { data: participants, error } = await this.supabase
        .from(TABLE_ROOM_PARTICIPANTS)
        .select(SELECT_ALL)
        .eq(COLUMN_DEVICE_ID, deviceId)
        .order(COLUMN_JOINED_AT, { ascending: false })
        .limit(limit);

      if (error) {
        logger.error({ error, deviceId }, LOG_MESSAGES.ERROR_FETCHING_HISTORY);
        return { success: false, error: ERROR_MESSAGES.FETCH_HISTORY_FAILED };
      }

      return { success: true, participants: participants || [] };
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_FETCHING_HISTORY);
      return { success: false, error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Method: validateAddParticipantInput
   * Description:
   * - Validates required fields in add participant input
   * - Returns error result if validation fails
   *
   * Parameters:
   * - data (CreateRoomParticipantData): Input to validate
   *
   * Returns:
   * - { success: boolean; error?: string } | null: Error result if validation fails, null if valid
   */
  private validateAddParticipantInput(
    data: CreateRoomParticipantData,
  ): { success: boolean; error?: string } | null {
    if (!data.game_id) {
      logger.error(LOG_MESSAGES.ADD_PARTICIPANT_MISSING_GAME_ID);
      return { success: false, error: ERROR_MESSAGES.GAME_ID_REQUIRED };
    }

    if (!data.socket_id) {
      logger.error({ gameId: data.game_id }, LOG_MESSAGES.ADD_PARTICIPANT_MISSING_SOCKET_ID);
      return { success: false, error: ERROR_MESSAGES.SOCKET_ID_REQUIRED };
    }

    if (!data.device_id) {
      logger.error({ gameId: data.game_id }, LOG_MESSAGES.ADD_PARTICIPANT_MISSING_DEVICE_ID);
      return { success: false, error: ERROR_MESSAGES.DEVICE_ID_REQUIRED };
    }

    if (!data.player_id) {
      logger.error({ gameId: data.game_id }, LOG_MESSAGES.ADD_PARTICIPANT_MISSING_PLAYER_ID);
      return { success: false, error: ERROR_MESSAGES.PLAYER_ID_REQUIRED };
    }

    return null;
  }

  /**
   * Method: verifyGameExists
   * Description:
   * - Verifies that a game exists in the database
   * - Returns false if game doesn't exist or error occurs
   *
   * Parameters:
   * - gameId (string): Game ID to verify
   *
   * Returns:
   * - Promise<boolean>: True if game exists, false otherwise
   */
  private async verifyGameExists(gameId: string): Promise<boolean> {
    const { data: game, error: gameError } = await this.supabase
      .from(TABLE_GAMES)
      .select(COLUMN_ID)
      .eq(COLUMN_ID, gameId)
      .maybeSingle();

    if (gameError || !game) {
      logger.error({ error: gameError, gameId }, LOG_MESSAGES.GAME_NOT_FOUND);
      return false;
    }

    return true;
  }

  /**
   * Method: verifyPlayerExists
   * Description:
   * - Verifies that a player exists in the database
   * - Returns false if player doesn't exist or error occurs
   *
   * Parameters:
   * - playerId (string): Player ID to verify
   *
   * Returns:
   * - Promise<boolean>: True if player exists, false otherwise
   */
  private async verifyPlayerExists(playerId: string): Promise<boolean> {
    const { data: player, error: playerError } = await this.supabase
      .from(TABLE_PLAYERS)
      .select(COLUMN_ID)
      .eq(COLUMN_ID, playerId)
      .maybeSingle();

    if (playerError || !player) {
      logger.error({ error: playerError, playerId }, LOG_MESSAGES.PLAYER_NOT_FOUND);
      return false;
    }

    return true;
  }

  /**
   * Method: insertParticipant
   * Description:
   * - Inserts a new participant record into the database
   * - Returns created participant or null on error
   *
   * Parameters:
   * - data (CreateRoomParticipantData): Participant data to insert
   *
   * Returns:
   * - Promise<RoomParticipant | null>: Created participant or null on error
   */
  private async insertParticipant(
    data: CreateRoomParticipantData,
  ): Promise<RoomParticipant | null> {
    const { data: participant, error } = await this.supabase
      .from(TABLE_ROOM_PARTICIPANTS)
      .insert({
        [COLUMN_GAME_ID]: data.game_id,
        [COLUMN_SOCKET_ID]: data.socket_id,
        [COLUMN_DEVICE_ID]: data.device_id,
        [COLUMN_PLAYER_ID]: data.player_id,
        [COLUMN_USER_ID]: data.user_id || null,
        [COLUMN_ROLE]: data.role || ROLE_PLAYER,
        [COLUMN_STATUS]: STATUS_ACTIVE,
        [COLUMN_METADATA]: data.metadata || EMPTY_OBJECT,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, LOG_MESSAGES.ERROR_ADDING_PARTICIPANT);
      return null;
    }

    return participant;
  }

  /**
   * Method: buildStatusUpdateData
   * Description:
   * - Builds update data object for status update
   * - Includes socket_id and metadata if provided
   * - Sets left_at timestamp for disconnected/timeout status
   *
   * Parameters:
   * - data (UpdateParticipantStatusData): Status update data
   *
   * Returns:
   * - Record<string, unknown>: Update data object
   */
  private buildStatusUpdateData(data: UpdateParticipantStatusData): Record<string, unknown> {
    const updateData: Record<string, unknown> = {
      status: data.status,
    };

    if (data.socket_id) {
      updateData.socket_id = data.socket_id;
    }

    if (data.metadata) {
      updateData.metadata = data.metadata;
    }

    if (data.status === STATUS_DISCONNECTED || data.status === STATUS_TIMEOUT) {
      updateData.left_at = new Date().toISOString();
    }

    return updateData;
  }

  /**
   * Method: buildParticipantsQuery
   * Description:
   * - Builds Supabase query for fetching participants with filters
   * - Applies status, role, and device_id filters if provided
   * - Applies pagination and ordering
   *
   * Parameters:
   * - gameId (string): Game ID to query participants for
   * - query (Partial<ParticipantQuery>): Query parameters
   *
   * Returns:
   * - Query builder with all filters and pagination applied
   */
  private buildParticipantsQuery(gameId: string, query: Partial<ParticipantQuery>) {
    let dbQuery = this.supabase
      .from(TABLE_ROOM_PARTICIPANTS)
      .select(PLAYERS_SELECT_QUERY)
      .eq(COLUMN_GAME_ID, gameId);

    if (query.status) {
      dbQuery = dbQuery.eq(COLUMN_STATUS, query.status);
    }

    if (query.role) {
      dbQuery = dbQuery.eq(COLUMN_ROLE, query.role);
    }

    if (query.device_id) {
      dbQuery = dbQuery.eq(COLUMN_DEVICE_ID, query.device_id);
    }

    const limit = query.limit || DEFAULT_PARTICIPANT_LIMIT;
    const offset = query.offset || DEFAULT_OFFSET;
    dbQuery = dbQuery
      .range(offset, offset + limit - 1)
      .order(COLUMN_JOINED_AT, { ascending: false });

    return dbQuery;
  }

  /**
   * Method: transformParticipantsWithPlayer
   * Description:
   * - Transforms participant data with player details
   * - Maps database structure to RoomParticipantWithPlayer format
   *
   * Parameters:
   * - participants (ParticipantData[]): Raw participant data from database
   *
   * Returns:
   * - RoomParticipantWithPlayer[]: Transformed participants with player details
   */
  private transformParticipantsWithPlayer(
    participants: ParticipantData[],
  ): RoomParticipantWithPlayer[] {
    return participants.map((p: ParticipantData) => {
      const player = p.players;
      return {
        id: p.id,
        game_id: p.game_id,
        socket_id: p.socket_id,
        device_id: p.device_id,
        player_id: p.player_id,
        player_name: player?.name || PLAYER_NAME_UNKNOWN,
        user_id: p.user_id,
        joined_at: p.joined_at,
        left_at: p.left_at,
        role: p.role,
        status: p.status,
        is_host: player?.is_host || false,
        is_logged_in: !!p.user_id,
        metadata: p.metadata,
      };
    });
  }

  /**
   * Method: fetchParticipantsWithPlayerDetails
   * Description:
   * - Fetches all participants for a game with player details
   * - Returns participants array or null on error
   *
   * Parameters:
   * - gameId (string): Game ID to fetch participants for
   *
   * Returns:
   * - Promise<ParticipantData[] | null>: Participants array or null on error
   */
  private async fetchParticipantsWithPlayerDetails(
    gameId: string,
  ): Promise<ParticipantData[] | null> {
    const { data: participants, error } = await this.supabase
      .from(TABLE_ROOM_PARTICIPANTS)
      .select(PLAYERS_SELECT_QUERY)
      .eq(COLUMN_GAME_ID, gameId)
      .order(COLUMN_JOINED_AT, { ascending: false });

    if (error) {
      logger.error({ error, gameId }, LOG_MESSAGES.ERROR_FETCHING_SUMMARY);
      return null;
    }

    return participants as ParticipantData[] | null;
  }

  /**
   * Method: calculateParticipantsSummary
   * Description:
   * - Calculates participants summary statistics
   * - Counts by status, role, and host status
   *
   * Parameters:
   * - gameId (string): Game ID
   * - participantsList (RoomParticipantWithPlayer[]): List of participants
   *
   * Returns:
   * - ActiveParticipantsSummary: Summary with counts and participant list
   */
  private calculateParticipantsSummary(
    gameId: string,
    participantsList: RoomParticipantWithPlayer[],
  ): ActiveParticipantsSummary {
    const activeCount = participantsList.filter((p) => p.status === STATUS_ACTIVE).length;
    const disconnectedCount = participantsList.filter(
      (p) => p.status === STATUS_DISCONNECTED || p.status === STATUS_TIMEOUT,
    ).length;
    const hosts = participantsList.filter((p) => p.is_host).length;
    const players = participantsList.filter((p) => p.role === ROLE_PLAYER).length;
    const spectators = participantsList.filter((p) => p.role === ROLE_SPECTATOR).length;

    return {
      game_id: gameId,
      total_participants: participantsList.length,
      active_count: activeCount,
      disconnected_count: disconnectedCount,
      hosts,
      players,
      spectators,
      participants: participantsList,
    };
  }

  /**
   * Method: findMostRecentParticipant
   * Description:
   * - Finds most recent participant record for a player in a game
   * - Returns participant or null if not found or on error
   *
   * Parameters:
   * - gameId (string): Game ID
   * - playerId (string): Player ID
   *
   * Returns:
   * - Promise<RoomParticipant | null>: Participant or null
   */
  private async findMostRecentParticipant(
    gameId: string,
    playerId: string,
  ): Promise<RoomParticipant | null> {
    const { data: existingParticipant, error: fetchError } = await this.supabase
      .from(TABLE_ROOM_PARTICIPANTS)
      .select(SELECT_ALL)
      .eq(COLUMN_GAME_ID, gameId)
      .eq(COLUMN_PLAYER_ID, playerId)
      .order(COLUMN_JOINED_AT, { ascending: false })
      .limit(REJOIN_QUERY_LIMIT)
      .maybeSingle();

    if (fetchError) {
      logger.error({ error: fetchError, gameId, playerId }, LOG_MESSAGES.ERROR_FINDING_PARTICIPANT);
      return null;
    }

    if (!existingParticipant) {
      logger.warn({ gameId, playerId }, LOG_MESSAGES.NO_EXISTING_PARTICIPANT_FOR_REJOIN);
      return null;
    }

    return existingParticipant;
  }

  /**
   * Method: updateParticipantForRejoin
   * Description:
   * - Updates participant record for rejoin operation
   * - Sets new socket_id, reactivates status, and clears left_at
   *
   * Parameters:
   * - participantId (string): Participant ID to update
   * - data (RejoinRoomData): Rejoin data
   * - existingMetadata (Record<string, unknown>): Existing metadata to merge
   *
   * Returns:
   * - Promise<RoomParticipant | null>: Updated participant or null on error
   */
  private async updateParticipantForRejoin(
    participantId: string,
    data: RejoinRoomData,
    existingMetadata: Record<string, unknown>,
  ): Promise<RoomParticipant | null> {
    const { data: participant, error: updateError } = await this.supabase
      .from(TABLE_ROOM_PARTICIPANTS)
      .update({
        [COLUMN_SOCKET_ID]: data.socket_id,
        [COLUMN_STATUS]: STATUS_ACTIVE,
        [COLUMN_LEFT_AT]: null,
        [COLUMN_METADATA]: data.metadata || existingMetadata,
      })
      .eq(COLUMN_ID, participantId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, participantId }, LOG_MESSAGES.ERROR_REJOINING_ROOM);
      return null;
    }

    return participant;
  }
}

//----------------------------------------------------
// 5. Export
//----------------------------------------------------
let roomParticipantServiceInstance: RoomParticipantService | null = null;

/**
 * Function: getRoomParticipantService
 * Description:
 * - Factory function to get or create RoomParticipantService singleton instance
 * - Ensures single instance per Supabase client
 *
 * Parameters:
 * - supabase (SupabaseClient): Supabase client instance
 *
 * Returns:
 * - RoomParticipantService: Service instance
 */
export function getRoomParticipantService(supabase: SupabaseClient): RoomParticipantService {
  if (!roomParticipantServiceInstance) {
    roomParticipantServiceInstance = new RoomParticipantService(supabase);
  }
  return roomParticipantServiceInstance;
}
