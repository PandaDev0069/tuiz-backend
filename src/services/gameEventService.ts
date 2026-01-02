// src/services/gameEventService.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase';
import {
  CreateGameEventInput,
  GameEvent,
  GameEventQuery,
  GameEventsResponse,
  GameReplay,
} from '../types/gameEvent';
import { logger } from '../utils/logger';

/**
 * Result of game event creation operation
 */
export interface GameEventCreateResult {
  success: boolean;
  event?: GameEvent;
  error?: string;
}

/**
 * Service class for managing game event operations
 * Handles event logging, retrieval, and replay functionality
 */
export class GameEventService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabaseAdmin) {
    this.client = client;
  }

  /**
   * Log a new game event
   * Automatically determines sequence number based on existing events
   *
   * @param input - The game event data
   * @returns Result object with success status and created event or error
   */
  async createGameEvent(input: CreateGameEventInput): Promise<GameEventCreateResult> {
    try {
      // Validate required fields
      if (!input.game_id) {
        logger.error('createGameEvent called with missing game_id');
        return {
          success: false,
          error: 'game_id is required',
        };
      }

      if (!input.event_type) {
        logger.error({ gameId: input.game_id }, 'createGameEvent called with missing event_type');
        return {
          success: false,
          error: 'event_type is required',
        };
      }

      if (!input.action) {
        logger.error({ gameId: input.game_id }, 'createGameEvent called with missing action');
        return {
          success: false,
          error: 'action is required',
        };
      }

      // Verify that the game exists
      const { data: gameExists, error: gameCheckError } = await this.client
        .from('games')
        .select('id')
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

      if (!gameExists) {
        logger.warn({ gameId: input.game_id }, 'Attempted to create event for non-existent game');
        return {
          success: false,
          error: 'Game not found',
        };
      }

      // Get next sequence number if not provided
      let sequenceNumber = input.sequence_number;
      if (sequenceNumber === undefined) {
        const { data: lastEvent } = await this.client
          .from('game_events')
          .select('sequence_number')
          .eq('game_id', input.game_id)
          .order('sequence_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        sequenceNumber = lastEvent ? lastEvent.sequence_number + 1 : 0;
      }

      // Create the game event
      const { data: event, error: createError } = await this.client
        .from('game_events')
        .insert({
          game_id: input.game_id,
          event_type: input.event_type,
          action: input.action,
          socket_id: input.socket_id || null,
          device_id: input.device_id || null,
          player_id: input.player_id || null,
          user_id: input.user_id || null,
          payload: input.payload || {},
          sequence_number: sequenceNumber,
        })
        .select()
        .single();

      if (createError) {
        logger.error({ error: createError, gameId: input.game_id }, 'Error creating game event');
        return {
          success: false,
          error: 'Failed to create game event',
        };
      }

      logger.info(
        {
          eventId: event.id,
          gameId: input.game_id,
          eventType: input.event_type,
          sequenceNumber,
        },
        'Game event created successfully',
      );

      return {
        success: true,
        event,
      };
    } catch (err) {
      logger.error({ err, gameId: input.game_id }, 'Exception in createGameEvent');
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Get game events with filtering and pagination
   *
   * @param gameId - The game ID to fetch events for
   * @param query - Query parameters for filtering and pagination
   * @returns List of game events with metadata
   */
  async getGameEvents(gameId: string, query: GameEventQuery): Promise<GameEventsResponse | null> {
    try {
      let queryBuilder = this.client
        .from('game_events')
        .select('*', { count: 'exact' })
        .eq('game_id', gameId);

      // Apply filters
      if (query.event_type) {
        queryBuilder = queryBuilder.eq('event_type', query.event_type);
      }

      if (query.player_id) {
        queryBuilder = queryBuilder.eq('player_id', query.player_id);
      }

      // Apply ordering
      queryBuilder = queryBuilder.order('sequence_number', {
        ascending: query.order === 'asc',
      });

      // Apply pagination
      queryBuilder = queryBuilder.range(query.offset, query.offset + query.limit - 1);

      const { data: events, error, count } = await queryBuilder;

      if (error) {
        logger.error({ error, gameId }, 'Error fetching game events');
        return null;
      }

      return {
        events: events || [],
        total: count || 0,
        game_id: gameId,
        limit: query.limit,
        offset: query.offset,
      };
    } catch (err) {
      logger.error({ err, gameId }, 'Exception in getGameEvents');
      return null;
    }
  }

  /**
   * Get complete game replay data
   * Includes all events and game statistics for replay functionality
   *
   * @param gameId - The game ID to fetch replay data for
   * @returns Complete replay data or null
   */
  async getGameReplay(gameId: string): Promise<GameReplay | null> {
    try {
      // Fetch all events ordered by sequence
      const { data: events, error: eventsError } = await this.client
        .from('game_events')
        .select('*')
        .eq('game_id', gameId)
        .order('sequence_number', { ascending: true });

      if (eventsError) {
        logger.error({ error: eventsError, gameId }, 'Error fetching game events for replay');
        return null;
      }

      // Fetch game info
      const { data: game, error: gameError } = await this.client
        .from('games')
        .select('quiz_set_id, status, started_at, ended_at, current_question_index')
        .eq('id', gameId)
        .single();

      if (gameError) {
        logger.error({ error: gameError, gameId }, 'Error fetching game info for replay');
        return null;
      }

      // Fetch game flow for total questions
      const { data: gameFlow } = await this.client
        .from('game_flows')
        .select('total_questions')
        .eq('game_id', gameId)
        .maybeSingle();

      // Count unique players
      const { count: playerCount } = await this.client
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameId);

      // Calculate duration
      let durationSeconds: number | null = null;
      if (game.started_at && game.ended_at) {
        const start = new Date(game.started_at);
        const end = new Date(game.ended_at);
        durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
      }

      return {
        game_id: gameId,
        events: events || [],
        game_info: {
          quiz_set_id: game.quiz_set_id,
          total_questions: gameFlow?.total_questions || 0,
          started_at: game.started_at || '',
          ended_at: game.ended_at || null,
          status: game.status,
        },
        statistics: {
          total_events: events?.length || 0,
          total_players: playerCount || 0,
          duration_seconds: durationSeconds,
        },
      };
    } catch (err) {
      logger.error({ err, gameId }, 'Exception in getGameReplay');
      return null;
    }
  }

  /**
   * Delete all events for a game
   * Typically called when a game is deleted (CASCADE handles this automatically)
   *
   * @param gameId - The game ID to delete events for
   * @returns Success status
   */
  async deleteGameEvents(gameId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('game_events').delete().eq('game_id', gameId);

      if (error) {
        logger.error({ error, gameId }, 'Error deleting game events');
        return false;
      }

      logger.info({ gameId }, 'Game events deleted successfully');
      return true;
    } catch (err) {
      logger.error({ err, gameId }, 'Exception in deleteGameEvents');
      return false;
    }
  }
}

// Export singleton instance
export const gameEventService = new GameEventService();
