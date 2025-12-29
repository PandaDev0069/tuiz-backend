// src/services/playerService.ts
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

/**
 * Result of player creation operation
 */
export interface PlayerCreateResult {
  success: boolean;
  player?: Player;
  error?: string;
}

/**
 * Result of player update operation
 */
export interface PlayerUpdateResult {
  success: boolean;
  player?: Player;
  error?: string;
}

/**
 * Service class for managing player operations
 * Handles player CRUD, game joining, and statistics
 */
export class PlayerService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabaseAdmin) {
    this.client = client;
  }

  /**
   * Create a new player (join game)
   *
   * @param input - The player creation data
   * @returns Result object with success status and created player or error
   */
  async createPlayer(input: CreatePlayerInput): Promise<PlayerCreateResult> {
    try {
      // Validate required fields
      if (!input.game_id) {
        logger.error('createPlayer called with missing game_id');
        return {
          success: false,
          error: 'game_id is required',
        };
      }

      if (!input.device_id) {
        logger.error({ gameId: input.game_id }, 'createPlayer called with missing device_id');
        return {
          success: false,
          error: 'device_id is required',
        };
      }

      if (!input.player_name || input.player_name.trim() === '') {
        logger.error({ gameId: input.game_id }, 'createPlayer called with missing player_name');
        return {
          success: false,
          error: 'player_name is required',
        };
      }

      // Verify that the game exists and is accepting players
      const { data: game, error: gameCheckError } = await this.client
        .from('games')
        .select('id, status, locked')
        .eq('id', input.game_id)
        .maybeSingle();

      if (gameCheckError) {
        logger.error(
          { error: gameCheckError, gameId: input.game_id },
          'Error checking game existence',
        );
        return {
          success: false,
          error: 'Failed to verify game existence',
        };
      }

      if (!game) {
        logger.warn({ gameId: input.game_id }, 'Attempted to join non-existent game');
        return {
          success: false,
          error: 'Game not found',
        };
      }

      if (game.locked) {
        logger.warn({ gameId: input.game_id }, 'Attempted to join locked game');
        return {
          success: false,
          error: 'Game is locked and not accepting new players',
        };
      }

      if (game.status !== 'waiting' && game.status !== 'active') {
        logger.warn(
          { gameId: input.game_id, status: game.status },
          'Attempted to join game with invalid status',
        );
        return {
          success: false,
          error: 'Game is not accepting players',
        };
      }

      // Check if player already exists with this device_id
      const { data: existingPlayer } = await this.client
        .from('players')
        .select('id')
        .eq('game_id', input.game_id)
        .eq('device_id', input.device_id)
        .maybeSingle();

      if (existingPlayer) {
        logger.warn(
          { gameId: input.game_id, deviceId: input.device_id },
          'Player already exists in this game',
        );
        return {
          success: false,
          error: 'Player already joined this game',
        };
      }

      // Create the player
      const { data: player, error: createError } = await this.client
        .from('players')
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
        logger.error({ error: createError, gameId: input.game_id }, 'Error creating player');
        return {
          success: false,
          error: 'Failed to create player',
        };
      }

      // Increment current_players count only for non-host players
      // Hosts are not counted in the player count
      if (!input.is_host) {
        const { error: updateError } = await this.client.rpc('increment_game_players', {
          p_game_id: input.game_id,
        });

        if (updateError) {
          logger.warn(
            { error: updateError, gameId: input.game_id },
            'Failed to increment player count',
          );
          // Don't fail the request, player was created successfully
        }
      }

      // Automatically create game_player_data for the player
      const gamePlayerDataResult = await gamePlayerDataService.createGamePlayerData({
        player_id: player.id,
        game_id: input.game_id,
        player_device_id: input.device_id,
        score: 0,
        answer_report: {
          total_answers: 0,
          correct_answers: 0,
          incorrect_answers: 0,
          questions: [],
        },
      });

      if (!gamePlayerDataResult.success) {
        // Log warning but don't fail - player was created successfully
        // The game_player_data will be created automatically when submitting first answer
        logger.warn(
          {
            error: gamePlayerDataResult.error,
            playerId: player.id,
            gameId: input.game_id,
          },
          'Failed to create game_player_data during player creation (will be created on first answer)',
        );
      } else {
        logger.info(
          { playerId: player.id, gameId: input.game_id },
          'Game player data created automatically during player creation',
        );
      }

      logger.info(
        {
          playerId: player.id,
          gameId: input.game_id,
          playerName: player.player_name,
        },
        'Player created successfully',
      );

      return {
        success: true,
        player,
      };
    } catch (err) {
      logger.error({ err, gameId: input.game_id }, 'Exception in createPlayer');
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Get all players in a game with filtering and pagination
   *
   * @param gameId - The game ID to fetch players for
   * @param query - Query parameters for filtering and pagination
   * @returns List of players with metadata
   */
  async getPlayers(gameId: string, query: PlayerQuery): Promise<PlayersResponse | null> {
    try {
      let queryBuilder = this.client
        .from('players')
        .select('*', { count: 'exact' })
        .eq('game_id', gameId);

      // Apply filters
      if (query.is_host !== undefined) {
        queryBuilder = queryBuilder.eq('is_host', query.is_host);
      }

      if (query.is_logged_in !== undefined) {
        queryBuilder = queryBuilder.eq('is_logged_in', query.is_logged_in);
      }

      // Order by created_at (join order)
      queryBuilder = queryBuilder.order('created_at', { ascending: true });

      // Apply pagination
      queryBuilder = queryBuilder.range(query.offset, query.offset + query.limit - 1);

      const { data: players, error } = await queryBuilder;

      if (error) {
        logger.error({ error, gameId }, 'Error fetching players');
        return null;
      }

      // Deduplicate players by device_id - if multiple players have the same device_id,
      // keep only the first one (earliest created_at) to prevent duplicate display
      const playersArray = players || [];
      const deviceIdMap = new Map<string, (typeof playersArray)[0]>();

      playersArray.forEach((player) => {
        if (player.device_id) {
          const existing = deviceIdMap.get(player.device_id);
          // Keep the first player (earliest created_at) for each device_id
          if (!existing || new Date(player.created_at) < new Date(existing.created_at)) {
            deviceIdMap.set(player.device_id, player);
          }
        } else {
          // If no device_id, include the player (shouldn't happen, but handle it)
          // Use player.id as key to ensure uniqueness
          deviceIdMap.set(player.id, player);
        }
      });

      // Convert map values to array
      const deduplicatedPlayers = Array.from(deviceIdMap.values());

      // Recalculate count after deduplication
      const deduplicatedCount = deduplicatedPlayers.length;

      return {
        players: deduplicatedPlayers,
        total: deduplicatedCount,
        game_id: gameId,
        limit: query.limit,
        offset: query.offset,
      };
    } catch (err) {
      logger.error({ err, gameId }, 'Exception in getPlayers');
      return null;
    }
  }

  /**
   * Get a single player by ID
   *
   * @param playerId - The player ID to fetch
   * @returns Player data or null
   */
  async getPlayerById(playerId: string): Promise<Player | null> {
    try {
      const { data: player, error } = await this.client
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (error) {
        logger.error({ error, playerId }, 'Error fetching player');
        return null;
      }

      return player;
    } catch (err) {
      logger.error({ err, playerId }, 'Exception in getPlayerById');
      return null;
    }
  }

  /**
   * Get player by device ID in a specific game
   *
   * @param gameId - The game ID
   * @param deviceId - The device ID
   * @returns Player data or null
   */
  async getPlayerByDeviceId(gameId: string, deviceId: string): Promise<Player | null> {
    try {
      const { data: player, error } = await this.client
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error) {
        logger.error({ error, gameId, deviceId }, 'Error fetching player by device');
        return null;
      }

      return player;
    } catch (err) {
      logger.error({ err, gameId, deviceId }, 'Exception in getPlayerByDeviceId');
      return null;
    }
  }

  /**
   * Update a player
   *
   * @param playerId - The player ID to update
   * @param updates - The fields to update
   * @returns Result object with success status and updated player or error
   */
  async updatePlayer(playerId: string, updates: UpdatePlayerInput): Promise<PlayerUpdateResult> {
    try {
      if (Object.keys(updates).length === 0) {
        return {
          success: false,
          error: 'No updates provided',
        };
      }

      // Build update object
      const updateData: Partial<Player> = {};

      if (updates.player_name !== undefined) {
        if (!updates.player_name || updates.player_name.trim() === '') {
          return {
            success: false,
            error: 'player_name cannot be empty',
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

      // Update the player
      const { data: player, error: updateError } = await this.client
        .from('players')
        .update(updateData)
        .eq('id', playerId)
        .select()
        .single();

      if (updateError) {
        logger.error({ error: updateError, playerId }, 'Error updating player');
        return {
          success: false,
          error: 'Failed to update player',
        };
      }

      logger.info({ playerId, updates: updateData }, 'Player updated successfully');

      return {
        success: true,
        player,
      };
    } catch (err) {
      logger.error({ err, playerId }, 'Exception in updatePlayer');
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Delete a player (remove from game)
   *
   * @param playerId - The player ID to delete
   * @returns Success status
   */
  async deletePlayer(playerId: string): Promise<boolean> {
    try {
      // Get game_id before deleting for player count decrement
      const { data: player } = await this.client
        .from('players')
        .select('game_id')
        .eq('id', playerId)
        .single();

      if (!player) {
        logger.warn({ playerId }, 'Attempted to delete non-existent player');
        return false;
      }

      // Check if player is host before deleting
      const { data: playerData } = await this.client
        .from('players')
        .select('is_host')
        .eq('id', playerId)
        .single();

      const { error } = await this.client.from('players').delete().eq('id', playerId);

      if (error) {
        logger.error({ error, playerId }, 'Error deleting player');
        return false;
      }

      // Decrement current_players count only for non-host players
      // Hosts are not counted in the player count
      if (!playerData?.is_host) {
        const { error: updateError } = await this.client.rpc('decrement_game_players', {
          p_game_id: player.game_id,
        });

        if (updateError) {
          logger.warn(
            { error: updateError, gameId: player.game_id },
            'Failed to decrement player count',
          );
          // Don't fail the request, player was deleted successfully
        }
      }

      logger.info({ playerId, gameId: player.game_id }, 'Player deleted successfully');
      return true;
    } catch (err) {
      logger.error({ err, playerId }, 'Exception in deletePlayer');
      return false;
    }
  }

  /**
   * Get players with their game statistics
   *
   * @param gameId - The game ID
   * @returns List of players with stats
   */
  async getPlayersWithStats(gameId: string): Promise<PlayerWithStats[]> {
    try {
      // Join players with game_player_data for statistics
      const { data: playersWithStats, error } = await this.client
        .from('players')
        .select(
          `
          *,
          game_player_data (
            score,
            answer_report
          )
        `,
        )
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error({ error, gameId }, 'Error fetching players with stats');
        return [];
      }

      // Transform the data
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
      const result: PlayerWithStats[] = (playersWithStats || []).map((p: PlayerStatsData) => {
        const stats = p.game_player_data?.[0] || { score: 0, answer_report: {} };
        const answerReport = stats.answer_report || {};
        const totalAnswers = answerReport.total_answers ?? 0;
        const correctAnswers = answerReport.correct_answers ?? 0;

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
          score: stats.score || 0,
          total_answers: totalAnswers,
          correct_answers: correctAnswers,
          accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
        };
      });

      return result;
    } catch (err) {
      logger.error({ err, gameId }, 'Exception in getPlayersWithStats');
      return [];
    }
  }
}

// Export singleton instance
export const playerService = new PlayerService();
