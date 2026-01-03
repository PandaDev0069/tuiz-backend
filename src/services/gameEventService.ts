// ====================================================
// File Name   : gameEventService.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Service class for managing game event operations
// - Handles event logging, retrieval, replay functionality, and event deletion
// - Provides comprehensive game event tracking for analytics and replay features

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

const EMPTY_STRING = '';
const EMPTY_OBJECT = {};

const TABLE_GAMES = 'games';
const TABLE_GAME_EVENTS = 'game_events';
const TABLE_GAME_FLOWS = 'game_flows';
const TABLE_PLAYERS = 'players';

const COLUMN_ID = 'id';
const COLUMN_GAME_ID = 'game_id';
const COLUMN_SEQUENCE_NUMBER = 'sequence_number';
const COLUMN_QUIZ_SET_ID = 'quiz_set_id';
const COLUMN_STATUS = 'status';
const COLUMN_STARTED_AT = 'started_at';
const COLUMN_ENDED_AT = 'ended_at';
const COLUMN_CURRENT_QUESTION_INDEX = 'current_question_index';
const COLUMN_TOTAL_QUESTIONS = 'total_questions';
const COLUMN_EVENT_TYPE = 'event_type';
const COLUMN_PLAYER_ID = 'player_id';
const SELECT_ALL = '*';

const ORDER_ASCENDING = true;
const ORDER_DESCENDING = false;

const ERROR_MESSAGES = {
  GAME_ID_REQUIRED: 'game_id is required',
  EVENT_TYPE_REQUIRED: 'event_type is required',
  ACTION_REQUIRED: 'action is required',
  VERIFY_GAME_EXISTENCE_FAILED: 'Failed to verify game existence',
  GAME_NOT_FOUND: 'Game not found',
  CREATE_EVENT_FAILED: 'Failed to create game event',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

const LOG_MESSAGES = {
  CREATE_EVENT_MISSING_GAME_ID: 'createGameEvent called with missing game_id',
  CREATE_EVENT_MISSING_EVENT_TYPE: 'createGameEvent called with missing event_type',
  CREATE_EVENT_MISSING_ACTION: 'createGameEvent called with missing action',
  ERROR_CHECKING_GAME_EXISTENCE: 'Error checking game existence',
  ATTEMPTED_CREATE_EVENT_NON_EXISTENT_GAME: 'Attempted to create event for non-existent game',
  ERROR_CREATING_GAME_EVENT: 'Error creating game event',
  GAME_EVENT_CREATED_SUCCESSFULLY: 'Game event created successfully',
  EXCEPTION_IN_CREATE_GAME_EVENT: 'Exception in createGameEvent',
  ERROR_FETCHING_GAME_EVENTS: 'Error fetching game events',
  EXCEPTION_IN_GET_GAME_EVENTS: 'Exception in getGameEvents',
  ERROR_FETCHING_GAME_EVENTS_FOR_REPLAY: 'Error fetching game events for replay',
  ERROR_FETCHING_GAME_INFO_FOR_REPLAY: 'Error fetching game info for replay',
  EXCEPTION_IN_GET_GAME_REPLAY: 'Exception in getGameReplay',
  ERROR_DELETING_GAME_EVENTS: 'Error deleting game events',
  GAME_EVENTS_DELETED_SUCCESSFULLY: 'Game events deleted successfully',
  EXCEPTION_IN_DELETE_GAME_EVENTS: 'Exception in deleteGameEvents',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Interface: GameEventCreateResult
 * Description:
 * - Result structure for game event creation operations
 * - Contains success status, created event (if successful), or error message
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
 * Class: GameEventService
 * Description:
 * - Service class for managing game event operations
 * - Handles event logging, retrieval, replay functionality, and event deletion
 * - Provides comprehensive game event tracking for analytics and replay features
 */
export class GameEventService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabaseAdmin) {
    this.client = client;
  }

  /**
   * Method: createGameEvent
   * Description:
   * - Logs a new game event to the database
   * - Automatically determines sequence number based on existing events
   * - Validates game existence before creating event
   *
   * Parameters:
   * - input (CreateGameEventInput): Game event data including game_id, event_type, action, etc.
   *
   * Returns:
   * - Promise<GameEventCreateResult>: Result object with success status and created event or error
   */
  async createGameEvent(input: CreateGameEventInput): Promise<GameEventCreateResult> {
    try {
      const validationError = this.validateCreateEventInput(input);
      if (validationError) {
        return validationError;
      }

      const gameExists = await this.verifyGameExists(input.game_id);
      if (!gameExists) {
        return {
          success: false,
          error: ERROR_MESSAGES.GAME_NOT_FOUND,
        };
      }

      const sequenceNumber = await this.determineSequenceNumber(
        input.game_id,
        input.sequence_number,
      );

      const event = await this.insertGameEvent(input, sequenceNumber);
      if (!event) {
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
        LOG_MESSAGES.GAME_EVENT_CREATED_SUCCESSFULLY,
      );

      return {
        success: true,
        event,
      };
    } catch (err) {
      logger.error({ err, gameId: input.game_id }, LOG_MESSAGES.EXCEPTION_IN_CREATE_GAME_EVENT);
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Method: validateCreateEventInput
   * Description:
   * - Validates required fields in create event input
   * - Returns error result if validation fails
   *
   * Parameters:
   * - input (CreateGameEventInput): Input to validate
   *
   * Returns:
   * - GameEventCreateResult | null: Error result if validation fails, null if valid
   */
  private validateCreateEventInput(input: CreateGameEventInput): GameEventCreateResult | null {
    if (!input.game_id) {
      logger.error(LOG_MESSAGES.CREATE_EVENT_MISSING_GAME_ID);
      return {
        success: false,
        error: ERROR_MESSAGES.GAME_ID_REQUIRED,
      };
    }

    if (!input.event_type) {
      logger.error({ gameId: input.game_id }, LOG_MESSAGES.CREATE_EVENT_MISSING_EVENT_TYPE);
      return {
        success: false,
        error: ERROR_MESSAGES.EVENT_TYPE_REQUIRED,
      };
    }

    if (!input.action) {
      logger.error({ gameId: input.game_id }, LOG_MESSAGES.CREATE_EVENT_MISSING_ACTION);
      return {
        success: false,
        error: ERROR_MESSAGES.ACTION_REQUIRED,
      };
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
    const { data: gameExists, error: gameCheckError } = await this.client
      .from(TABLE_GAMES)
      .select(COLUMN_ID)
      .eq(COLUMN_ID, gameId)
      .maybeSingle();

    if (gameCheckError) {
      logger.error({ error: gameCheckError, gameId }, LOG_MESSAGES.ERROR_CHECKING_GAME_EXISTENCE);
      return false;
    }

    if (!gameExists) {
      logger.warn({ gameId }, LOG_MESSAGES.ATTEMPTED_CREATE_EVENT_NON_EXISTENT_GAME);
      return false;
    }

    return true;
  }

  /**
   * Method: determineSequenceNumber
   * Description:
   * - Determines the next sequence number for a game event
   * - Uses provided sequence number or calculates from last event
   *
   * Parameters:
   * - gameId (string): Game ID to determine sequence for
   * - providedSequenceNumber (number | undefined): Optional provided sequence number
   *
   * Returns:
   * - Promise<number>: Sequence number to use for the event
   */
  private async determineSequenceNumber(
    gameId: string,
    providedSequenceNumber: number | undefined,
  ): Promise<number> {
    if (providedSequenceNumber !== undefined) {
      return providedSequenceNumber;
    }

    const { data: lastEvent } = await this.client
      .from(TABLE_GAME_EVENTS)
      .select(COLUMN_SEQUENCE_NUMBER)
      .eq(COLUMN_GAME_ID, gameId)
      .order(COLUMN_SEQUENCE_NUMBER, { ascending: ORDER_DESCENDING })
      .limit(LAST_EVENT_QUERY_LIMIT)
      .maybeSingle();

    return lastEvent ? lastEvent.sequence_number + 1 : INITIAL_SEQUENCE_NUMBER;
  }

  /**
   * Method: insertGameEvent
   * Description:
   * - Inserts a new game event into the database
   * - Returns created event or null on error
   *
   * Parameters:
   * - input (CreateGameEventInput): Event data to insert
   * - sequenceNumber (number): Sequence number for the event
   *
   * Returns:
   * - Promise<GameEvent | null>: Created event or null on error
   */
  private async insertGameEvent(
    input: CreateGameEventInput,
    sequenceNumber: number,
  ): Promise<GameEvent | null> {
    const { data: event, error: createError } = await this.client
      .from(TABLE_GAME_EVENTS)
      .insert({
        game_id: input.game_id,
        event_type: input.event_type,
        action: input.action,
        socket_id: input.socket_id || null,
        device_id: input.device_id || null,
        player_id: input.player_id || null,
        user_id: input.user_id || null,
        payload: input.payload || EMPTY_OBJECT,
        sequence_number: sequenceNumber,
      })
      .select()
      .single();

    if (createError) {
      logger.error(
        { error: createError, gameId: input.game_id },
        LOG_MESSAGES.ERROR_CREATING_GAME_EVENT,
      );
      return null;
    }

    return event;
  }

  /**
   * Method: buildGameEventsQuery
   * Description:
   * - Builds a Supabase query for fetching game events with filters
   * - Applies event_type and player_id filters if provided
   * - Applies ordering and pagination
   *
   * Parameters:
   * - gameId (string): Game ID to query events for
   * - query (GameEventQuery): Query parameters for filtering and pagination
   *
   * Returns:
   * - Query builder with all filters and pagination applied
   */
  private buildGameEventsQuery(gameId: string, query: GameEventQuery) {
    let queryBuilder = this.client
      .from(TABLE_GAME_EVENTS)
      .select(SELECT_ALL, { count: 'exact' })
      .eq(COLUMN_GAME_ID, gameId);

    if (query.event_type) {
      queryBuilder = queryBuilder.eq(COLUMN_EVENT_TYPE, query.event_type);
    }

    if (query.player_id) {
      queryBuilder = queryBuilder.eq(COLUMN_PLAYER_ID, query.player_id);
    }

    queryBuilder = queryBuilder.order(COLUMN_SEQUENCE_NUMBER, {
      ascending: query.order === 'asc',
    });

    queryBuilder = queryBuilder.range(query.offset, query.offset + query.limit - 1);

    return queryBuilder;
  }

  /**
   * Method: fetchGameEventsForReplay
   * Description:
   * - Fetches all game events for replay in sequence order
   * - Returns events array or null on error
   *
   * Parameters:
   * - gameId (string): Game ID to fetch events for
   *
   * Returns:
   * - Promise<GameEvent[] | null>: Events array or null on error
   */
  private async fetchGameEventsForReplay(gameId: string): Promise<GameEvent[] | null> {
    const { data: events, error: eventsError } = await this.client
      .from(TABLE_GAME_EVENTS)
      .select(SELECT_ALL)
      .eq(COLUMN_GAME_ID, gameId)
      .order(COLUMN_SEQUENCE_NUMBER, { ascending: ORDER_ASCENDING });

    if (eventsError) {
      logger.error(
        { error: eventsError, gameId },
        LOG_MESSAGES.ERROR_FETCHING_GAME_EVENTS_FOR_REPLAY,
      );
      return null;
    }

    return events;
  }

  /**
   * Method: fetchGameInfoForReplay
   * Description:
   * - Fetches game information needed for replay
   * - Returns game data or null on error
   *
   * Parameters:
   * - gameId (string): Game ID to fetch info for
   *
   * Returns:
   * - Promise<Game info object | null>: Game info or null on error
   */
  private async fetchGameInfoForReplay(gameId: string) {
    const { data: game, error: gameError } = await this.client
      .from(TABLE_GAMES)
      .select(
        `${COLUMN_QUIZ_SET_ID}, ${COLUMN_STATUS}, ${COLUMN_STARTED_AT}, ${COLUMN_ENDED_AT}, ${COLUMN_CURRENT_QUESTION_INDEX}`,
      )
      .eq(COLUMN_ID, gameId)
      .single();

    if (gameError) {
      logger.error({ error: gameError, gameId }, LOG_MESSAGES.ERROR_FETCHING_GAME_INFO_FOR_REPLAY);
      return null;
    }

    return game;
  }

  /**
   * Method: fetchGameFlowForReplay
   * Description:
   * - Fetches game flow data for replay
   * - Returns game flow or null if not found
   *
   * Parameters:
   * - gameId (string): Game ID to fetch flow for
   *
   * Returns:
   * - Promise<Game flow object | null>: Game flow or null
   */
  private async fetchGameFlowForReplay(gameId: string) {
    const { data: gameFlow } = await this.client
      .from(TABLE_GAME_FLOWS)
      .select(COLUMN_TOTAL_QUESTIONS)
      .eq(COLUMN_GAME_ID, gameId)
      .maybeSingle();

    return gameFlow;
  }

  /**
   * Method: fetchPlayerCountForReplay
   * Description:
   * - Fetches the count of players for a game
   * - Returns player count or 0
   *
   * Parameters:
   * - gameId (string): Game ID to count players for
   *
   * Returns:
   * - Promise<number>: Player count
   */
  private async fetchPlayerCountForReplay(gameId: string): Promise<number> {
    const { count: playerCount } = await this.client
      .from(TABLE_PLAYERS)
      .select(COLUMN_ID, { count: 'exact', head: true })
      .eq(COLUMN_GAME_ID, gameId);

    return playerCount || 0;
  }

  /**
   * Method: calculateGameDuration
   * Description:
   * - Calculates game duration in seconds from start and end timestamps
   * - Returns null if either timestamp is missing
   *
   * Parameters:
   * - startedAt (string | null): Game start timestamp
   * - endedAt (string | null): Game end timestamp
   *
   * Returns:
   * - number | null: Duration in seconds or null if timestamps missing
   */
  private calculateGameDuration(startedAt: string | null, endedAt: string | null): number | null {
    if (!startedAt || !endedAt) {
      return null;
    }

    const start = new Date(startedAt);
    const end = new Date(endedAt);
    return Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_SECOND);
  }

  /**
   * Method: getGameEvents
   * Description:
   * - Retrieves game events with filtering and pagination
   * - Supports filtering by event_type and player_id
   * - Provides ordering and pagination capabilities
   *
   * Parameters:
   * - gameId (string): Game ID to fetch events for
   * - query (GameEventQuery): Query parameters for filtering and pagination
   *
   * Returns:
   * - Promise<GameEventsResponse | null>: List of game events with metadata, or null on error
   */
  async getGameEvents(gameId: string, query: GameEventQuery): Promise<GameEventsResponse | null> {
    try {
      const queryBuilder = this.buildGameEventsQuery(gameId, query);
      const { data: events, error, count } = await queryBuilder;

      if (error) {
        logger.error({ error, gameId }, LOG_MESSAGES.ERROR_FETCHING_GAME_EVENTS);
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
      logger.error({ err, gameId }, LOG_MESSAGES.EXCEPTION_IN_GET_GAME_EVENTS);
      return null;
    }
  }

  /**
   * Method: getGameReplay
   * Description:
   * - Retrieves complete game replay data for a finished game
   * - Includes all events ordered by sequence number
   * - Provides game statistics and metadata for replay functionality
   *
   * Parameters:
   * - gameId (string): Game ID to fetch replay data for
   *
   * Returns:
   * - Promise<GameReplay | null>: Complete replay data with events and statistics, or null on error
   */
  async getGameReplay(gameId: string): Promise<GameReplay | null> {
    try {
      const events = await this.fetchGameEventsForReplay(gameId);
      if (events === null) {
        return null;
      }

      const game = await this.fetchGameInfoForReplay(gameId);
      if (game === null) {
        return null;
      }

      const gameFlow = await this.fetchGameFlowForReplay(gameId);
      const playerCount = await this.fetchPlayerCountForReplay(gameId);
      const durationSeconds = this.calculateGameDuration(game.started_at, game.ended_at);

      return {
        game_id: gameId,
        events: events || [],
        game_info: {
          quiz_set_id: game.quiz_set_id,
          total_questions: gameFlow?.total_questions || 0,
          started_at: game.started_at || EMPTY_STRING,
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
      logger.error({ err, gameId }, LOG_MESSAGES.EXCEPTION_IN_GET_GAME_REPLAY);
      return null;
    }
  }

  /**
   * Method: deleteGameEvents
   * Description:
   * - Deletes all events for a game
   * - Typically called when a game is deleted (CASCADE handles this automatically)
   * - Used for manual cleanup or testing purposes
   *
   * Parameters:
   * - gameId (string): Game ID to delete events for
   *
   * Returns:
   * - Promise<boolean>: Success status (true if deleted, false on error)
   */
  async deleteGameEvents(gameId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(TABLE_GAME_EVENTS)
        .delete()
        .eq(COLUMN_GAME_ID, gameId);

      if (error) {
        logger.error({ error, gameId }, LOG_MESSAGES.ERROR_DELETING_GAME_EVENTS);
        return false;
      }

      logger.info({ gameId }, LOG_MESSAGES.GAME_EVENTS_DELETED_SUCCESSFULLY);
      return true;
    } catch (err) {
      logger.error({ err, gameId }, LOG_MESSAGES.EXCEPTION_IN_DELETE_GAME_EVENTS);
      return false;
    }
  }
}

//----------------------------------------------------
// 5. Export
//----------------------------------------------------
export const gameEventService = new GameEventService();
