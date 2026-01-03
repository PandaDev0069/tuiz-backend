// ====================================================
// File Name   : playerService.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-12

// Description:
// - Service class for managing player operations
// - Handles player CRUD, game joining, and statistics
// - Manages player lifecycle and game participation

// Notes:
// - Validates game status and lock state before allowing joins
// - Automatically creates game_player_data when player is created
// - Deduplicates players by device_id to prevent duplicate display
// - Hosts are not counted in player count increments/decrements
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAdmin } from '../lib/supabase';
import {
  CreatePlayerInput,
  Player,
  PlayerQuery,
  PlayersResponse,
  PlayerWithStats,
  UpdatePlayerInput,
} from '../types/player';
import { logger } from '../utils/logger';
import { gamePlayerDataService } from './gamePlayerDataService';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const INITIAL_SCORE = 0;
const INITIAL_TOTAL_ANSWERS = 0;
const INITIAL_CORRECT_ANSWERS = 0;
const INITIAL_INCORRECT_ANSWERS = 0;
const ACCURACY_PERCENTAGE_MULTIPLIER = 100;
const DEFAULT_ACCURACY = 0;

const TABLE_GAMES = 'games';
const TABLE_PLAYERS = 'players';

const COLUMN_ID = 'id';
const COLUMN_GAME_ID = 'game_id';
const COLUMN_DEVICE_ID = 'device_id';
const COLUMN_IS_LOGGED_IN = 'is_logged_in';
const COLUMN_IS_HOST = 'is_host';
const COLUMN_CREATED_AT = 'created_at';
const SELECT_ALL = '*';

const GAME_STATUS_WAITING = 'waiting';
const GAME_STATUS_ACTIVE = 'active';

const RPC_INCREMENT_GAME_PLAYERS = 'increment_game_players';
const RPC_DECREMENT_GAME_PLAYERS = 'decrement_game_players';
const RPC_PARAM_GAME_ID = 'p_game_id';

const GAME_SELECT_FIELDS = 'id, status, locked';
const GAME_PLAYER_DATA_SELECT_QUERY = `
  *,
  game_player_data (
    score,
    answer_report
  )
`;

const ERROR_MESSAGES = {
  GAME_ID_REQUIRED: 'game_id is required',
  DEVICE_ID_REQUIRED: 'device_id is required',
  PLAYER_NAME_REQUIRED: 'player_name is required',
  VERIFY_GAME_EXISTENCE_FAILED: 'Failed to verify game existence',
  GAME_NOT_FOUND: 'Game not found',
  GAME_LOCKED: 'Game is locked and not accepting new players',
  GAME_NOT_ACCEPTING_PLAYERS: 'Game is not accepting players',
  PLAYER_ALREADY_JOINED: 'Player already joined this game',
  CREATE_PLAYER_FAILED: 'Failed to create player',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  FETCH_PLAYERS_FAILED: 'Error fetching players',
  FETCH_PLAYER_FAILED: 'Error fetching player',
  FETCH_PLAYER_BY_DEVICE_FAILED: 'Error fetching player by device',
  NO_UPDATES_PROVIDED: 'No updates provided',
  PLAYER_NAME_CANNOT_BE_EMPTY: 'player_name cannot be empty',
  UPDATE_PLAYER_FAILED: 'Failed to update player',
  DELETE_PLAYER_FAILED: 'Error deleting player',
  FETCH_PLAYERS_WITH_STATS_FAILED: 'Error fetching players with stats',
} as const;

const LOG_MESSAGES = {
  CREATE_PLAYER_MISSING_GAME_ID: 'createPlayer called with missing game_id',
  CREATE_PLAYER_MISSING_DEVICE_ID: 'createPlayer called with missing device_id',
  CREATE_PLAYER_MISSING_PLAYER_NAME: 'createPlayer called with missing player_name',
  ERROR_CHECKING_GAME_EXISTENCE: 'Error checking game existence',
  ATTEMPTED_JOIN_NON_EXISTENT_GAME: 'Attempted to join non-existent game',
  ATTEMPTED_JOIN_LOCKED_GAME: 'Attempted to join locked game',
  ATTEMPTED_JOIN_INVALID_STATUS: 'Attempted to join game with invalid status',
  PLAYER_ALREADY_EXISTS: 'Player already exists in this game',
  ERROR_CREATING_PLAYER: 'Error creating player',
  FAILED_INCREMENT_PLAYER_COUNT: 'Failed to increment player count',
  FAILED_CREATE_GAME_PLAYER_DATA:
    'Failed to create game_player_data during player creation (will be created on first answer)',
  GAME_PLAYER_DATA_CREATED: 'Game player data created automatically during player creation',
  PLAYER_CREATED_SUCCESSFULLY: 'Player created successfully',
  EXCEPTION_IN_CREATE_PLAYER: 'Exception in createPlayer',
  EXCEPTION_IN_GET_PLAYERS: 'Exception in getPlayers',
  EXCEPTION_IN_GET_PLAYER_BY_ID: 'Exception in getPlayerById',
  EXCEPTION_IN_GET_PLAYER_BY_DEVICE: 'Exception in getPlayerByDeviceId',
  EXCEPTION_IN_UPDATE_PLAYER: 'Exception in updatePlayer',
  ATTEMPTED_DELETE_NON_EXISTENT_PLAYER: 'Attempted to delete non-existent player',
  FAILED_DECREMENT_PLAYER_COUNT: 'Failed to decrement player count',
  PLAYER_DELETED_SUCCESSFULLY: 'Player deleted successfully',
  EXCEPTION_IN_DELETE_PLAYER: 'Exception in deletePlayer',
  EXCEPTION_IN_GET_PLAYERS_WITH_STATS: 'Exception in getPlayersWithStats',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Interface: PlayerCreateResult
 * Description:
 * - Result structure for player creation operations
 * - Contains success status, created player (if successful), or error message
 */
export interface PlayerCreateResult {
  success: boolean;
  player?: Player;
  error?: string;
}

/**
 * Interface: PlayerUpdateResult
 * Description:
 * - Result structure for player update operations
 * - Contains success status, updated player (if successful), or error message
 */
export interface PlayerUpdateResult {
  success: boolean;
  player?: Player;
  error?: string;
}

interface PlayerStatsData {
  id: string;
  name: string;
  device_id: string;
  user_id: string | null;
  is_host: boolean;
  status: string;
  game_id: string;
  joined_at: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  game_player_data?: Array<{
    score: number;
    answer_report: {
      total_answers?: number;
      correct_answers?: number;
    };
  }>;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Class: PlayerService
 * Description:
 * - Service class for managing player operations
 * - Handles player CRUD, game joining, and statistics
 * - Manages player lifecycle and game participation
 */
export class PlayerService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabaseAdmin) {
    this.client = client;
  }

  /**
   * Method: createPlayer
   * Description:
   * - Creates a new player (join game)
   * - Validates game status and lock state
   * - Automatically creates game_player_data for the player
   *
   * Parameters:
   * - input (CreatePlayerInput): Player creation data
   *
   * Returns:
   * - Promise<PlayerCreateResult>: Result object with success status and created player or error
   */
  async createPlayer(input: CreatePlayerInput): Promise<PlayerCreateResult> {
    try {
      const validationError = this.validateCreatePlayerInput(input);
      if (validationError) {
        return validationError;
      }

      const gameValidation = await this.validateGameForPlayerJoin(input.game_id);
      if (!gameValidation.valid) {
        return {
          success: false,
          error: gameValidation.error,
        };
      }

      const playerExists = await this.checkExistingPlayer(input.game_id, input.device_id);
      if (playerExists) {
        return {
          success: false,
          error: ERROR_MESSAGES.PLAYER_ALREADY_JOINED,
        };
      }

      const player = await this.insertPlayer(input);
      if (!player) {
        return {
          success: false,
          error: ERROR_MESSAGES.CREATE_PLAYER_FAILED,
        };
      }

      await this.incrementPlayerCountIfNeeded(input.game_id, input.is_host);
      await this.createGamePlayerDataForPlayer(player.id, input.game_id, input.device_id);

      logger.info(
        {
          playerId: player.id,
          gameId: input.game_id,
          playerName: player.player_name,
        },
        LOG_MESSAGES.PLAYER_CREATED_SUCCESSFULLY,
      );

      return {
        success: true,
        player,
      };
    } catch (err) {
      logger.error({ err, gameId: input.game_id }, LOG_MESSAGES.EXCEPTION_IN_CREATE_PLAYER);
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Method: getPlayers
   * Description:
   * - Retrieves all players in a game with filtering and pagination
   * - Deduplicates players by device_id to prevent duplicate display
   *
   * Parameters:
   * - gameId (string): Game ID to fetch players for
   * - query (PlayerQuery): Query parameters for filtering and pagination
   *
   * Returns:
   * - Promise<PlayersResponse | null>: List of players with metadata, or null on error
   */
  async getPlayers(gameId: string, query: PlayerQuery): Promise<PlayersResponse | null> {
    try {
      const queryBuilder = this.buildPlayersQuery(gameId, query);
      const { data: players, error } = await queryBuilder;

      if (error) {
        logger.error({ error, gameId }, ERROR_MESSAGES.FETCH_PLAYERS_FAILED);
        return null;
      }

      const deduplicatedPlayers = this.deduplicatePlayersByDeviceId(players || []);

      return {
        players: deduplicatedPlayers,
        total: deduplicatedPlayers.length,
        game_id: gameId,
        limit: query.limit,
        offset: query.offset,
      };
    } catch (err) {
      logger.error({ err, gameId }, LOG_MESSAGES.EXCEPTION_IN_GET_PLAYERS);
      return null;
    }
  }

  /**
   * Method: getPlayerById
   * Description:
   * - Retrieves a single player by ID
   *
   * Parameters:
   * - playerId (string): Player ID to fetch
   *
   * Returns:
   * - Promise<Player | null>: Player data or null if not found or on error
   */
  async getPlayerById(playerId: string): Promise<Player | null> {
    try {
      const { data: player, error } = await this.client
        .from(TABLE_PLAYERS)
        .select(SELECT_ALL)
        .eq(COLUMN_ID, playerId)
        .single();

      if (error) {
        logger.error({ error, playerId }, ERROR_MESSAGES.FETCH_PLAYER_FAILED);
        return null;
      }

      return player;
    } catch (err) {
      logger.error({ err, playerId }, LOG_MESSAGES.EXCEPTION_IN_GET_PLAYER_BY_ID);
      return null;
    }
  }

  /**
   * Method: getPlayerByDeviceId
   * Description:
   * - Retrieves player by device ID in a specific game
   *
   * Parameters:
   * - gameId (string): Game ID
   * - deviceId (string): Device ID
   *
   * Returns:
   * - Promise<Player | null>: Player data or null if not found or on error
   */
  async getPlayerByDeviceId(gameId: string, deviceId: string): Promise<Player | null> {
    try {
      const { data: player, error } = await this.client
        .from(TABLE_PLAYERS)
        .select(SELECT_ALL)
        .eq(COLUMN_GAME_ID, gameId)
        .eq(COLUMN_DEVICE_ID, deviceId)
        .maybeSingle();

      if (error) {
        logger.error({ error, gameId, deviceId }, ERROR_MESSAGES.FETCH_PLAYER_BY_DEVICE_FAILED);
        return null;
      }

      return player;
    } catch (err) {
      logger.error({ err, gameId, deviceId }, LOG_MESSAGES.EXCEPTION_IN_GET_PLAYER_BY_DEVICE);
      return null;
    }
  }

  /**
   * Method: updatePlayer
   * Description:
   * - Updates a player with provided fields
   * - Validates player_name is not empty if provided
   *
   * Parameters:
   * - playerId (string): Player ID to update
   * - updates (UpdatePlayerInput): Fields to update
   *
   * Returns:
   * - Promise<PlayerUpdateResult>: Result object with success status and updated player or error
   */
  async updatePlayer(playerId: string, updates: UpdatePlayerInput): Promise<PlayerUpdateResult> {
    try {
      if (Object.keys(updates).length === 0) {
        return {
          success: false,
          error: ERROR_MESSAGES.NO_UPDATES_PROVIDED,
        };
      }

      const updateData = this.buildUpdateData(updates);
      if (!updateData.valid) {
        return {
          success: false,
          error: updateData.error,
        };
      }

      const { data: player, error: updateError } = await this.client
        .from(TABLE_PLAYERS)
        .update(updateData.data)
        .eq(COLUMN_ID, playerId)
        .select()
        .single();

      if (updateError) {
        logger.error({ error: updateError, playerId }, ERROR_MESSAGES.UPDATE_PLAYER_FAILED);
        return {
          success: false,
          error: ERROR_MESSAGES.UPDATE_PLAYER_FAILED,
        };
      }

      logger.info({ playerId, updates: updateData.data }, 'Player updated successfully');

      return {
        success: true,
        player,
      };
    } catch (err) {
      logger.error({ err, playerId }, LOG_MESSAGES.EXCEPTION_IN_UPDATE_PLAYER);
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Method: deletePlayer
   * Description:
   * - Deletes a player (remove from game)
   * - Decrements player count for non-host players
   *
   * Parameters:
   * - playerId (string): Player ID to delete
   *
   * Returns:
   * - Promise<boolean>: Success status (true if deleted, false on error)
   */
  async deletePlayer(playerId: string): Promise<boolean> {
    try {
      const playerInfo = await this.fetchPlayerInfoForDeletion(playerId);
      if (!playerInfo) {
        return false;
      }

      const { error } = await this.client.from(TABLE_PLAYERS).delete().eq(COLUMN_ID, playerId);

      if (error) {
        logger.error({ error, playerId }, ERROR_MESSAGES.DELETE_PLAYER_FAILED);
        return false;
      }

      await this.decrementPlayerCountIfNeeded(playerInfo.game_id, playerInfo.is_host);

      logger.info(
        { playerId, gameId: playerInfo.game_id },
        LOG_MESSAGES.PLAYER_DELETED_SUCCESSFULLY,
      );
      return true;
    } catch (err) {
      logger.error({ err, playerId }, LOG_MESSAGES.EXCEPTION_IN_DELETE_PLAYER);
      return false;
    }
  }

  /**
   * Method: getPlayersWithStats
   * Description:
   * - Retrieves players with their game statistics
   * - Joins players with game_player_data for score and answer statistics
   *
   * Parameters:
   * - gameId (string): Game ID to fetch players for
   *
   * Returns:
   * - Promise<PlayerWithStats[]>: List of players with stats, or empty array on error
   */
  async getPlayersWithStats(gameId: string): Promise<PlayerWithStats[]> {
    try {
      const { data: playersWithStats, error } = await this.client
        .from(TABLE_PLAYERS)
        .select(GAME_PLAYER_DATA_SELECT_QUERY)
        .eq(COLUMN_GAME_ID, gameId)
        .order(COLUMN_CREATED_AT, { ascending: true });

      if (error) {
        logger.error({ error, gameId }, ERROR_MESSAGES.FETCH_PLAYERS_WITH_STATS_FAILED);
        return [];
      }

      return this.transformPlayersWithStats(playersWithStats || []);
    } catch (err) {
      logger.error({ err, gameId }, LOG_MESSAGES.EXCEPTION_IN_GET_PLAYERS_WITH_STATS);
      return [];
    }
  }

  /**
   * Method: validateCreatePlayerInput
   * Description:
   * - Validates required fields in create player input
   * - Returns error result if validation fails
   *
   * Parameters:
   * - input (CreatePlayerInput): Input to validate
   *
   * Returns:
   * - PlayerCreateResult | null: Error result if validation fails, null if valid
   */
  private validateCreatePlayerInput(input: CreatePlayerInput): PlayerCreateResult | null {
    if (!input.game_id) {
      logger.error(LOG_MESSAGES.CREATE_PLAYER_MISSING_GAME_ID);
      return {
        success: false,
        error: ERROR_MESSAGES.GAME_ID_REQUIRED,
      };
    }

    if (!input.device_id) {
      logger.error({ gameId: input.game_id }, LOG_MESSAGES.CREATE_PLAYER_MISSING_DEVICE_ID);
      return {
        success: false,
        error: ERROR_MESSAGES.DEVICE_ID_REQUIRED,
      };
    }

    if (!input.player_name || input.player_name.trim() === '') {
      logger.error({ gameId: input.game_id }, LOG_MESSAGES.CREATE_PLAYER_MISSING_PLAYER_NAME);
      return {
        success: false,
        error: ERROR_MESSAGES.PLAYER_NAME_REQUIRED,
      };
    }

    return null;
  }

  /**
   * Method: validateGameForPlayerJoin
   * Description:
   * - Validates that game exists and is accepting players
   * - Checks game status and lock state
   *
   * Parameters:
   * - gameId (string): Game ID to validate
   *
   * Returns:
   * - Promise<{ valid: boolean; error?: string }>: Validation result
   */
  private async validateGameForPlayerJoin(
    gameId: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const { data: game, error: gameCheckError } = await this.client
      .from(TABLE_GAMES)
      .select(GAME_SELECT_FIELDS)
      .eq(COLUMN_ID, gameId)
      .maybeSingle();

    if (gameCheckError) {
      logger.error({ error: gameCheckError, gameId }, LOG_MESSAGES.ERROR_CHECKING_GAME_EXISTENCE);
      return {
        valid: false,
        error: ERROR_MESSAGES.VERIFY_GAME_EXISTENCE_FAILED,
      };
    }

    if (!game) {
      logger.warn({ gameId }, LOG_MESSAGES.ATTEMPTED_JOIN_NON_EXISTENT_GAME);
      return {
        valid: false,
        error: ERROR_MESSAGES.GAME_NOT_FOUND,
      };
    }

    if (game.locked) {
      logger.warn({ gameId }, LOG_MESSAGES.ATTEMPTED_JOIN_LOCKED_GAME);
      return {
        valid: false,
        error: ERROR_MESSAGES.GAME_LOCKED,
      };
    }

    if (game.status !== GAME_STATUS_WAITING && game.status !== GAME_STATUS_ACTIVE) {
      logger.warn({ gameId, status: game.status }, LOG_MESSAGES.ATTEMPTED_JOIN_INVALID_STATUS);
      return {
        valid: false,
        error: ERROR_MESSAGES.GAME_NOT_ACCEPTING_PLAYERS,
      };
    }

    return { valid: true };
  }

  /**
   * Method: checkExistingPlayer
   * Description:
   * - Checks if player already exists with this device_id in the game
   * - Returns true if player exists, false otherwise
   *
   * Parameters:
   * - gameId (string): Game ID
   * - deviceId (string): Device ID
   *
   * Returns:
   * - Promise<boolean>: True if player exists, false otherwise
   */
  private async checkExistingPlayer(gameId: string, deviceId: string): Promise<boolean> {
    const { data: existingPlayer } = await this.client
      .from(TABLE_PLAYERS)
      .select(COLUMN_ID)
      .eq(COLUMN_GAME_ID, gameId)
      .eq(COLUMN_DEVICE_ID, deviceId)
      .maybeSingle();

    if (existingPlayer) {
      logger.warn({ gameId, deviceId }, LOG_MESSAGES.PLAYER_ALREADY_EXISTS);
      return true;
    }

    return false;
  }

  /**
   * Method: insertPlayer
   * Description:
   * - Inserts a new player into the database
   * - Returns created player or null on error
   *
   * Parameters:
   * - input (CreatePlayerInput): Player data to insert
   *
   * Returns:
   * - Promise<Player | null>: Created player or null on error
   */
  private async insertPlayer(input: CreatePlayerInput): Promise<Player | null> {
    const { data: player, error: createError } = await this.client
      .from(TABLE_PLAYERS)
      .insert({
        game_id: input.game_id,
        device_id: input.device_id,
        player_name: input.player_name.trim(),
        is_logged_in: input.is_logged_in || false,
        is_host: input.is_host || false,
      })
      .select()
      .single();

    if (createError) {
      logger.error(
        { error: createError, gameId: input.game_id },
        LOG_MESSAGES.ERROR_CREATING_PLAYER,
      );
      return null;
    }

    return player;
  }

  /**
   * Method: incrementPlayerCountIfNeeded
   * Description:
   * - Increments current_players count only for non-host players
   * - Hosts are not counted in the player count
   *
   * Parameters:
   * - gameId (string): Game ID
   * - isHost (boolean | undefined): Whether player is host
   */
  private async incrementPlayerCountIfNeeded(
    gameId: string,
    isHost: boolean | undefined,
  ): Promise<void> {
    if (isHost) {
      return;
    }

    const { error: updateError } = await this.client.rpc(RPC_INCREMENT_GAME_PLAYERS, {
      [RPC_PARAM_GAME_ID]: gameId,
    });

    if (updateError) {
      logger.warn({ error: updateError, gameId }, LOG_MESSAGES.FAILED_INCREMENT_PLAYER_COUNT);
    }
  }

  /**
   * Method: createGamePlayerDataForPlayer
   * Description:
   * - Automatically creates game_player_data for the player
   * - Logs warning if creation fails but doesn't fail the request
   *
   * Parameters:
   * - playerId (string): Player ID
   * - gameId (string): Game ID
   * - deviceId (string): Device ID
   */
  private async createGamePlayerDataForPlayer(
    playerId: string,
    gameId: string,
    deviceId: string,
  ): Promise<void> {
    const gamePlayerDataResult = await gamePlayerDataService.createGamePlayerData({
      player_id: playerId,
      game_id: gameId,
      player_device_id: deviceId,
      score: INITIAL_SCORE,
      answer_report: {
        total_answers: INITIAL_TOTAL_ANSWERS,
        correct_answers: INITIAL_CORRECT_ANSWERS,
        incorrect_answers: INITIAL_INCORRECT_ANSWERS,
        questions: [],
      },
    });

    if (!gamePlayerDataResult.success) {
      logger.warn(
        {
          error: gamePlayerDataResult.error,
          playerId,
          gameId,
        },
        LOG_MESSAGES.FAILED_CREATE_GAME_PLAYER_DATA,
      );
    } else {
      logger.info({ playerId, gameId }, LOG_MESSAGES.GAME_PLAYER_DATA_CREATED);
    }
  }

  /**
   * Method: buildPlayersQuery
   * Description:
   * - Builds Supabase query for fetching players with filters
   * - Applies is_host and is_logged_in filters if provided
   * - Applies ordering and pagination
   *
   * Parameters:
   * - gameId (string): Game ID to query players for
   * - query (PlayerQuery): Query parameters
   *
   * Returns:
   * - Query builder with all filters and pagination applied
   */
  private buildPlayersQuery(gameId: string, query: PlayerQuery) {
    let queryBuilder = this.client
      .from(TABLE_PLAYERS)
      .select(SELECT_ALL, { count: 'exact' })
      .eq(COLUMN_GAME_ID, gameId);

    if (query.is_host !== undefined) {
      queryBuilder = queryBuilder.eq(COLUMN_IS_HOST, query.is_host);
    }

    if (query.is_logged_in !== undefined) {
      queryBuilder = queryBuilder.eq(COLUMN_IS_LOGGED_IN, query.is_logged_in);
    }

    queryBuilder = queryBuilder.order(COLUMN_CREATED_AT, { ascending: true });
    queryBuilder = queryBuilder.range(query.offset, query.offset + query.limit - 1);

    return queryBuilder;
  }

  /**
   * Method: deduplicatePlayersByDeviceId
   * Description:
   * - Deduplicates players by device_id
   * - Keeps only the first player (earliest created_at) for each device_id
   * - Prevents duplicate display of players
   *
   * Parameters:
   * - players (Player[]): Array of players to deduplicate
   *
   * Returns:
   * - Player[]: Deduplicated array of players
   */
  private deduplicatePlayersByDeviceId(players: Player[]): Player[] {
    const deviceIdMap = new Map<string, Player>();

    players.forEach((player) => {
      if (player.device_id) {
        const existing = deviceIdMap.get(player.device_id);
        if (!existing || new Date(player.created_at) < new Date(existing.created_at)) {
          deviceIdMap.set(player.device_id, player);
        }
      } else {
        deviceIdMap.set(player.id, player);
      }
    });

    return Array.from(deviceIdMap.values());
  }

  /**
   * Method: buildUpdateData
   * Description:
   * - Builds update data object from update input
   * - Validates player_name is not empty if provided
   *
   * Parameters:
   * - updates (UpdatePlayerInput): Update input
   *
   * Returns:
   * - { valid: boolean; data?: Partial<Player>; error?: string }: Update data result
   */
  private buildUpdateData(updates: UpdatePlayerInput): {
    valid: boolean;
    data?: Partial<Player>;
    error?: string;
  } {
    const updateData: Partial<Player> = {};

    if (updates.player_name !== undefined) {
      if (!updates.player_name || updates.player_name.trim() === '') {
        return {
          valid: false,
          error: ERROR_MESSAGES.PLAYER_NAME_CANNOT_BE_EMPTY,
        };
      }
      updateData.player_name = updates.player_name.trim();
    }

    if (updates.is_logged_in !== undefined) {
      updateData.is_logged_in = updates.is_logged_in;
    }

    if (updates.is_host !== undefined) {
      updateData.is_host = updates.is_host;
    }

    return { valid: true, data: updateData };
  }

  /**
   * Method: fetchPlayerInfoForDeletion
   * Description:
   * - Fetches player info needed for deletion (game_id and is_host)
   * - Returns player info or null if not found
   *
   * Parameters:
   * - playerId (string): Player ID
   *
   * Returns:
   * - Promise<{ game_id: string; is_host: boolean } | null>: Player info or null
   */
  private async fetchPlayerInfoForDeletion(
    playerId: string,
  ): Promise<{ game_id: string; is_host: boolean } | null> {
    const { data: player } = await this.client
      .from(TABLE_PLAYERS)
      .select(`${COLUMN_GAME_ID}, ${COLUMN_IS_HOST}`)
      .eq(COLUMN_ID, playerId)
      .single();

    if (!player) {
      logger.warn({ playerId }, LOG_MESSAGES.ATTEMPTED_DELETE_NON_EXISTENT_PLAYER);
      return null;
    }

    return {
      game_id: player.game_id,
      is_host: player.is_host || false,
    };
  }

  /**
   * Method: decrementPlayerCountIfNeeded
   * Description:
   * - Decrements current_players count only for non-host players
   * - Hosts are not counted in the player count
   *
   * Parameters:
   * - gameId (string): Game ID
   * - isHost (boolean): Whether player is host
   */
  private async decrementPlayerCountIfNeeded(gameId: string, isHost: boolean): Promise<void> {
    if (isHost) {
      return;
    }

    const { error: updateError } = await this.client.rpc(RPC_DECREMENT_GAME_PLAYERS, {
      [RPC_PARAM_GAME_ID]: gameId,
    });

    if (updateError) {
      logger.warn({ error: updateError, gameId }, LOG_MESSAGES.FAILED_DECREMENT_PLAYER_COUNT);
    }
  }

  /**
   * Method: transformPlayersWithStats
   * Description:
   * - Transforms player data with statistics
   * - Calculates accuracy from answer report
   *
   * Parameters:
   * - playersWithStats (PlayerStatsData[]): Raw player data with stats
   *
   * Returns:
   * - PlayerWithStats[]: Transformed players with stats
   */
  private transformPlayersWithStats(playersWithStats: PlayerStatsData[]): PlayerWithStats[] {
    return playersWithStats.map((p: PlayerStatsData) => {
      const stats = p.game_player_data?.[0] || { score: INITIAL_SCORE, answer_report: {} };
      const answerReport = stats.answer_report || {};
      const totalAnswers = answerReport.total_answers ?? INITIAL_TOTAL_ANSWERS;
      const correctAnswers = answerReport.correct_answers ?? INITIAL_CORRECT_ANSWERS;

      return {
        id: p.id,
        name: p.name,
        player_name: p.name,
        device_id: p.device_id,
        user_id: p.user_id,
        game_id: p.game_id,
        is_host: p.is_host,
        is_logged_in: !!p.user_id,
        status: p.status,
        joined_at: p.joined_at,
        last_seen_at: p.last_seen_at,
        created_at: p.created_at,
        updated_at: p.updated_at,
        score: stats.score || INITIAL_SCORE,
        total_answers: totalAnswers,
        correct_answers: correctAnswers,
        accuracy:
          totalAnswers > INITIAL_TOTAL_ANSWERS
            ? Math.round((correctAnswers / totalAnswers) * ACCURACY_PERCENTAGE_MULTIPLIER)
            : DEFAULT_ACCURACY,
      };
    });
  }
}

//----------------------------------------------------
// 5. Export
//----------------------------------------------------
export const playerService = new PlayerService();
