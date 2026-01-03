// ====================================================
// File Name   : gameEventService.ts
// Project     : TUIZ v2
// Author      : Panda
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Service class for managing game event operations.
// - Handles event logging, retrieval, replay functionality, and event deletion.
// - Provides comprehensive game event tracking for analytics and replay features.

// Notes:
// - Automatically determines sequence numbers for events
// - Validates game existence before creating events
// - Provides pagination and filtering for event queries
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
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

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const INITIAL_SEQUENCE_NUMBER = 0;
const LAST_EVENT_QUERY_LIMIT = 1;
const MILLISECONDS_PER_SECOND = 1000;

const ERROR_MESSAGES = {
  GAME_ID_REQUIRED: 'game_id is required',
  EVENT_TYPE_REQUIRED: 'event_type is required',
  ACTION_REQUIRED: 'action is required',
  VERIFY_GAME_EXISTENCE_FAILED: 'Failed to verify game existence',
  GAME_NOT_FOUND: 'Game not found',
  CREATE_EVENT_FAILED: 'Failed to create game event',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Result of game event creation operation
 */
export interface GameEventCreateResult {
  success: boolean;
  event?: GameEvent;
  error?: string;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
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
   * Method: createGameEvent
   * Description:
   * - Log a new game event to the database
   * - Automatically determines sequence number based on existing events
   * - Validates game existence before creating event
   *
   * Parameters:
   * - input (CreateGameEventInput): The game event data including game_id, event_type, action, etc.
   *
   * Returns:
   * - Promise<GameEventCreateResult>: Result object with success status and created event or error
   */
  async createGameEvent(input: CreateGameEventInput): Promise<GameEventCreateResult> {
    try {
      if (!input.game_id) {
        logger.error('createGameEvent called with missing game_id');
        return {
          success: false,
          error: ERROR_MESSAGES.GAME_ID_REQUIRED,
        };
      }

      if (!input.event_type) {
        logger.error({ gameId: input.game_id }, 'createGameEvent called with missing event_type');
        return {
          success: false,
          error: ERROR_MESSAGES.EVENT_TYPE_REQUIRED,
        };
      }

      if (!input.action) {
        logger.error({ gameId: input.game_id }, 'createGameEvent called with missing action');
        return {
          success: false,
          error: ERROR_MESSAGES.ACTION_REQUIRED,
        };
      }

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
          error: ERROR_MESSAGES.VERIFY_GAME_EXISTENCE_FAILED,
        };
      }

      if (!gameExists) {
        logger.warn({ gameId: input.game_id }, 'Attempted to create event for non-existent game');
        return {
          success: false,
          error: ERROR_MESSAGES.GAME_NOT_FOUND,
        };
      }

      let sequenceNumber = input.sequence_number;
      if (sequenceNumber === undefined) {
        const { data: lastEvent } = await this.client
          .from('game_events')
          .select('sequence_number')
          .eq('game_id', input.game_id)
          .order('sequence_number', { ascending: false })
          .limit(LAST_EVENT_QUERY_LIMIT)
          .maybeSingle();

        sequenceNumber = lastEvent ? lastEvent.sequence_number + 1 : INITIAL_SEQUENCE_NUMBER;
      }

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
          error: ERROR_MESSAGES.CREATE_EVENT_FAILED,
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
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Method: getGameEvents
   * Description:
   * - Get game events with filtering and pagination
   * - Supports filtering by event_type and player_id
   * - Provides ordering and pagination capabilities
   *
   * Parameters:
   * - gameId (string): The game ID to fetch events for
   * - query (GameEventQuery): Query parameters for filtering and pagination
   *
   * Returns:
   * - Promise<GameEventsResponse | null>: List of game events with metadata, or null on error
   */
  async getGameEvents(gameId: string, query: GameEventQuery): Promise<GameEventsResponse | null> {
    try {
      let queryBuilder = this.client
        .from('game_events')
        .select('*', { count: 'exact' })
        .eq('game_id', gameId);

      if (query.event_type) {
        queryBuilder = queryBuilder.eq('event_type', query.event_type);
      }

      if (query.player_id) {
        queryBuilder = queryBuilder.eq('player_id', query.player_id);
      }

      queryBuilder = queryBuilder.order('sequence_number', {
        ascending: query.order === 'asc',
      });

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
   * Method: getGameReplay
   * Description:
   * - Get complete game replay data for a finished game
   * - Includes all events ordered by sequence number
   * - Provides game statistics and metadata for replay functionality
   *
   * Parameters:
   * - gameId (string): The game ID to fetch replay data for
   *
   * Returns:
   * - Promise<GameReplay | null>: Complete replay data with events and statistics, or null on error
   */
  async getGameReplay(gameId: string): Promise<GameReplay | null> {
    try {
      const { data: events, error: eventsError } = await this.client
        .from('game_events')
        .select('*')
        .eq('game_id', gameId)
        .order('sequence_number', { ascending: true });

      if (eventsError) {
        logger.error({ error: eventsError, gameId }, 'Error fetching game events for replay');
        return null;
      }

      const { data: game, error: gameError } = await this.client
        .from('games')
        .select('quiz_set_id, status, started_at, ended_at, current_question_index')
        .eq('id', gameId)
        .single();

      if (gameError) {
        logger.error({ error: gameError, gameId }, 'Error fetching game info for replay');
        return null;
      }

      const { data: gameFlow } = await this.client
        .from('game_flows')
        .select('total_questions')
        .eq('game_id', gameId)
        .maybeSingle();

      const { count: playerCount } = await this.client
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameId);

      let durationSeconds: number | null = null;
      if (game.started_at && game.ended_at) {
        const start = new Date(game.started_at);
        const end = new Date(game.ended_at);
        durationSeconds = Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_SECOND);
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
   * Method: deleteGameEvents
   * Description:
   * - Delete all events for a game
   * - Typically called when a game is deleted (CASCADE handles this automatically)
   * - Used for manual cleanup or testing purposes
   *
   * Parameters:
   * - gameId (string): The game ID to delete events for
   *
   * Returns:
   * - Promise<boolean>: Success status (true if deleted, false on error)
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

//----------------------------------------------------
// 5. Export
//----------------------------------------------------
export const gameEventService = new GameEventService();
