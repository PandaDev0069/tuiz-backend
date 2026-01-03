// ====================================================
// File Name   : gameFlowService.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-03
// Last Update : 2025-12-11

// Description:
// - Service class for managing game flow operations
// - Handles game flow creation, retrieval, updates, and deletion
// - Manages question progression and flow state for quiz games

// Notes:
// - Validates game and quiz_set existence before creating flows
// - Tracks current question index and question IDs
// - Provides methods for both simple and detailed flow retrieval
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAdmin } from '../lib/supabase';
import { GameFlow } from '../types/game';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const DEFAULT_QUESTION_INDEX = 0;
const MIN_TOTAL_QUESTIONS = 0;

const TABLE_GAMES = 'games';
const TABLE_QUIZ_SETS = 'quiz_sets';
const TABLE_GAME_FLOWS = 'game_flows';

const COLUMN_ID = 'id';
const COLUMN_GAME_ID = 'game_id';
const COLUMN_QUIZ_SET_ID = 'quiz_set_id';
const COLUMN_TOTAL_QUESTIONS = 'total_questions';
const COLUMN_CURRENT_QUESTION_INDEX = 'current_question_index';
const COLUMN_CURRENT_QUESTION_ID = 'current_question_id';
const COLUMN_NEXT_QUESTION_ID = 'next_question_id';
const COLUMN_CURRENT_QUESTION_START_TIME = 'current_question_start_time';
const COLUMN_CURRENT_QUESTION_END_TIME = 'current_question_end_time';
const SELECT_ALL = '*';

const ERROR_MESSAGES = {
  GAME_ID_REQUIRED: 'game_id is required',
  QUIZ_SET_ID_REQUIRED: 'quiz_set_id is required',
  TOTAL_QUESTIONS_MUST_BE_NON_NEGATIVE: 'total_questions must be non-negative',
  VERIFY_GAME_EXISTENCE_FAILED: 'Failed to verify game existence',
  GAME_NOT_FOUND: 'Game not found',
  VERIFY_QUIZ_SET_EXISTENCE_FAILED: 'Failed to verify quiz_set existence',
  QUIZ_SET_NOT_FOUND: 'Quiz set not found',
  CREATE_GAME_FLOW_FAILED: 'Failed to create game flow',
  INTERNAL_SERVER_ERROR: 'Unexpected error creating game flow',
  UPDATE_GAME_FLOW_FAILED: 'Failed to update game flow',
  UPDATE_INTERNAL_ERROR: 'Unexpected error updating game flow',
  FETCH_GAME_FLOW_FAILED: 'Failed to fetch game flow',
  FETCH_INTERNAL_ERROR: 'Unexpected error fetching game flow',
  GAME_FLOW_NOT_FOUND: 'Game flow not found',
} as const;

const LOG_MESSAGES = {
  CREATE_FLOW_MISSING_GAME_ID: 'createGameFlow called with missing game_id',
  CREATE_FLOW_MISSING_QUIZ_SET_ID: 'createGameFlow called with missing quiz_set_id',
  CREATE_FLOW_INVALID_TOTAL_QUESTIONS: 'createGameFlow called with invalid total_questions',
  ERROR_CHECKING_GAME_EXISTENCE: 'Error checking game existence',
  ATTEMPTED_CREATE_FLOW_NON_EXISTENT_GAME: 'Attempted to create game flow for non-existent game',
  ERROR_CHECKING_QUIZ_SET_EXISTENCE: 'Error checking quiz_set existence',
  ATTEMPTED_CREATE_FLOW_NON_EXISTENT_QUIZ_SET:
    'Attempted to create game flow for non-existent quiz_set',
  FAILED_TO_INSERT_GAME_FLOW: 'Failed to insert game flow',
  GAME_FLOW_CREATED_SUCCESSFULLY: 'Game flow created successfully',
  EXCEPTION_IN_CREATE_GAME_FLOW: 'Unexpected error in createGameFlow',
  ERROR_FETCHING_GAME_FLOW: 'Error fetching game flow',
  EXCEPTION_IN_FETCH_GAME_FLOW: 'Unexpected error fetching game flow',
  ERROR_UPDATING_GAME_FLOW: 'Error updating game flow',
  GAME_FLOW_UPDATED_SUCCESSFULLY: 'Game flow updated successfully',
  EXCEPTION_IN_UPDATE_GAME_FLOW: 'Unexpected error updating game flow',
  ERROR_DELETING_GAME_FLOW: 'Error deleting game flow',
  GAME_FLOW_DELETED_SUCCESSFULLY: 'Game flow deleted successfully',
  EXCEPTION_IN_DELETE_GAME_FLOW: 'Unexpected error deleting game flow',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Interface: CreateGameFlowInput
 * Description:
 * - Input parameters for creating a new game flow
 * - Contains game and quiz set references along with question tracking
 */
export interface CreateGameFlowInput {
  game_id: string;
  quiz_set_id: string;
  total_questions: number;
  current_question_index?: number;
  current_question_id?: string | null;
  next_question_id?: string | null;
}

/**
 * Interface: GameFlowCreateResult
 * Description:
 * - Result structure for game flow operations
 * - Contains success status, created/updated game flow (if successful), or error message
 */
export interface GameFlowCreateResult {
  success: boolean;
  gameFlow?: GameFlow;
  error?: string;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Class: GameFlowService
 * Description:
 * - Service class for managing game flow operations
 * - Handles game flow creation, retrieval, updates, and deletion
 * - Manages question progression and flow state for quiz games
 */
export class GameFlowService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabaseAdmin) {
    this.client = client;
  }

  /**
   * Method: createGameFlow
   * Description:
   * - Creates a new game flow entry when a game is created
   * - Validates required fields and verifies game and quiz_set existence
   * - Initializes question tracking fields
   *
   * Parameters:
   * - input (CreateGameFlowInput): Game flow creation parameters
   *
   * Returns:
   * - Promise<GameFlowCreateResult>: Result object with success status and created game flow or error
   */
  async createGameFlow(input: CreateGameFlowInput): Promise<GameFlowCreateResult> {
    try {
      const validationError = this.validateCreateFlowInput(input);
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

      const quizSetExists = await this.verifyQuizSetExists(input.quiz_set_id);
      if (!quizSetExists) {
        return {
          success: false,
          error: ERROR_MESSAGES.QUIZ_SET_NOT_FOUND,
        };
      }

      const gameFlow = await this.insertGameFlow(input);
      if (!gameFlow) {
        return {
          success: false,
          error: ERROR_MESSAGES.CREATE_GAME_FLOW_FAILED,
        };
      }

      logger.info(
        { gameFlowId: gameFlow.id, gameId: input.game_id, quizSetId: input.quiz_set_id },
        LOG_MESSAGES.GAME_FLOW_CREATED_SUCCESSFULLY,
      );

      return {
        success: true,
        gameFlow: gameFlow as GameFlow,
      };
    } catch (error) {
      logger.error(
        { error, gameId: input.game_id, quizSetId: input.quiz_set_id },
        LOG_MESSAGES.EXCEPTION_IN_CREATE_GAME_FLOW,
      );
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Method: getGameFlowByGameId
   * Description:
   * - Retrieves game flow by game ID
   * - Returns null if not found or on error
   *
   * Parameters:
   * - gameId (string): Game ID to fetch flow for
   *
   * Returns:
   * - Promise<GameFlow | null>: Game flow or null if not found or on error
   */
  async getGameFlowByGameId(gameId: string): Promise<GameFlow | null> {
    try {
      const { data, error } = await this.client
        .from(TABLE_GAME_FLOWS)
        .select(SELECT_ALL)
        .eq(COLUMN_GAME_ID, gameId)
        .maybeSingle();

      if (error) {
        logger.error({ error, gameId }, LOG_MESSAGES.ERROR_FETCHING_GAME_FLOW);
        return null;
      }

      return data as GameFlow | null;
    } catch (error) {
      logger.error({ error, gameId }, LOG_MESSAGES.EXCEPTION_IN_FETCH_GAME_FLOW);
      return null;
    }
  }

  /**
   * Method: updateGameFlow
   * Description:
   * - Updates game flow with new question progression
   * - Allows partial updates to flow state
   *
   * Parameters:
   * - gameId (string): Game ID to update flow for
   * - updates (Partial<Omit<GameFlow, 'id' | 'game_id' | 'created_at' | 'updated_at'>>): Partial updates to apply
   *
   * Returns:
   * - Promise<GameFlowCreateResult>: Result object with success status and updated game flow or error
   */
  async updateGameFlow(
    gameId: string,
    updates: Partial<Omit<GameFlow, 'id' | 'game_id' | 'created_at' | 'updated_at'>>,
  ): Promise<GameFlowCreateResult> {
    try {
      const { data: gameFlow, error } = await this.client
        .from(TABLE_GAME_FLOWS)
        .update(updates)
        .eq(COLUMN_GAME_ID, gameId)
        .select()
        .single();

      if (error) {
        logger.error({ error, gameId, updates }, LOG_MESSAGES.ERROR_UPDATING_GAME_FLOW);
        return {
          success: false,
          error: ERROR_MESSAGES.UPDATE_GAME_FLOW_FAILED,
        };
      }

      logger.info({ gameId, updates }, LOG_MESSAGES.GAME_FLOW_UPDATED_SUCCESSFULLY);
      return {
        success: true,
        gameFlow: gameFlow as GameFlow,
      };
    } catch (error) {
      logger.error({ error, gameId, updates }, LOG_MESSAGES.EXCEPTION_IN_UPDATE_GAME_FLOW);
      return {
        success: false,
        error: ERROR_MESSAGES.UPDATE_INTERNAL_ERROR,
      };
    }
  }

  /**
   * Method: getGameFlow
   * Description:
   * - Retrieves game flow by game ID with detailed result structure
   * - Returns result object with success status and error handling
   *
   * Parameters:
   * - gameId (string): Game ID to fetch flow for
   *
   * Returns:
   * - Promise<GameFlowCreateResult>: Result object with success status and game flow or error
   */
  async getGameFlow(gameId: string): Promise<GameFlowCreateResult> {
    try {
      const { data, error } = await this.client
        .from(TABLE_GAME_FLOWS)
        .select(SELECT_ALL)
        .eq(COLUMN_GAME_ID, gameId)
        .maybeSingle();

      if (error) {
        logger.error({ error, gameId }, LOG_MESSAGES.ERROR_FETCHING_GAME_FLOW);
        return {
          success: false,
          error: ERROR_MESSAGES.FETCH_GAME_FLOW_FAILED,
        };
      }

      if (!data) {
        return {
          success: false,
          error: ERROR_MESSAGES.GAME_FLOW_NOT_FOUND,
        };
      }

      return {
        success: true,
        gameFlow: data as GameFlow,
      };
    } catch (error) {
      logger.error({ error, gameId }, LOG_MESSAGES.EXCEPTION_IN_FETCH_GAME_FLOW);
      return {
        success: false,
        error: ERROR_MESSAGES.FETCH_INTERNAL_ERROR,
      };
    }
  }

  /**
   * Method: deleteGameFlow
   * Description:
   * - Deletes game flow by game ID
   * - Used for cleanup when game is deleted
   *
   * Parameters:
   * - gameId (string): Game ID to delete flow for
   *
   * Returns:
   * - Promise<boolean>: Success status (true if deleted, false on error)
   */
  async deleteGameFlow(gameId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(TABLE_GAME_FLOWS)
        .delete()
        .eq(COLUMN_GAME_ID, gameId);

      if (error) {
        logger.error({ error, gameId }, LOG_MESSAGES.ERROR_DELETING_GAME_FLOW);
        return false;
      }

      logger.info({ gameId }, LOG_MESSAGES.GAME_FLOW_DELETED_SUCCESSFULLY);
      return true;
    } catch (error) {
      logger.error({ error, gameId }, LOG_MESSAGES.EXCEPTION_IN_DELETE_GAME_FLOW);
      return false;
    }
  }

  /**
   * Method: validateCreateFlowInput
   * Description:
   * - Validates required fields in create flow input
   * - Returns error result if validation fails
   *
   * Parameters:
   * - input (CreateGameFlowInput): Input to validate
   *
   * Returns:
   * - GameFlowCreateResult | null: Error result if validation fails, null if valid
   */
  private validateCreateFlowInput(input: CreateGameFlowInput): GameFlowCreateResult | null {
    if (!input.game_id) {
      logger.error(LOG_MESSAGES.CREATE_FLOW_MISSING_GAME_ID);
      return {
        success: false,
        error: ERROR_MESSAGES.GAME_ID_REQUIRED,
      };
    }

    if (!input.quiz_set_id) {
      logger.error({ gameId: input.game_id }, LOG_MESSAGES.CREATE_FLOW_MISSING_QUIZ_SET_ID);
      return {
        success: false,
        error: ERROR_MESSAGES.QUIZ_SET_ID_REQUIRED,
      };
    }

    if (input.total_questions < MIN_TOTAL_QUESTIONS) {
      logger.error(
        { gameId: input.game_id, totalQuestions: input.total_questions },
        LOG_MESSAGES.CREATE_FLOW_INVALID_TOTAL_QUESTIONS,
      );
      return {
        success: false,
        error: ERROR_MESSAGES.TOTAL_QUESTIONS_MUST_BE_NON_NEGATIVE,
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
      logger.warn({ gameId }, LOG_MESSAGES.ATTEMPTED_CREATE_FLOW_NON_EXISTENT_GAME);
      return false;
    }

    return true;
  }

  /**
   * Method: verifyQuizSetExists
   * Description:
   * - Verifies that a quiz_set exists in the database
   * - Returns false if quiz_set doesn't exist or error occurs
   *
   * Parameters:
   * - quizSetId (string): Quiz set ID to verify
   *
   * Returns:
   * - Promise<boolean>: True if quiz_set exists, false otherwise
   */
  private async verifyQuizSetExists(quizSetId: string): Promise<boolean> {
    const { data: quizExists, error: quizCheckError } = await this.client
      .from(TABLE_QUIZ_SETS)
      .select(COLUMN_ID)
      .eq(COLUMN_ID, quizSetId)
      .maybeSingle();

    if (quizCheckError) {
      logger.error(
        { error: quizCheckError, quizSetId },
        LOG_MESSAGES.ERROR_CHECKING_QUIZ_SET_EXISTENCE,
      );
      return false;
    }

    if (!quizExists) {
      logger.warn({ quizSetId }, LOG_MESSAGES.ATTEMPTED_CREATE_FLOW_NON_EXISTENT_QUIZ_SET);
      return false;
    }

    return true;
  }

  /**
   * Method: insertGameFlow
   * Description:
   * - Inserts a new game flow entry into the database
   * - Returns created game flow or null on error
   *
   * Parameters:
   * - input (CreateGameFlowInput): Game flow data to insert
   *
   * Returns:
   * - Promise<GameFlow | null>: Created game flow or null on error
   */
  private async insertGameFlow(input: CreateGameFlowInput): Promise<GameFlow | null> {
    const { data: gameFlow, error: insertError } = await this.client
      .from(TABLE_GAME_FLOWS)
      .insert({
        [COLUMN_GAME_ID]: input.game_id,
        [COLUMN_QUIZ_SET_ID]: input.quiz_set_id,
        [COLUMN_TOTAL_QUESTIONS]: input.total_questions,
        [COLUMN_CURRENT_QUESTION_INDEX]: input.current_question_index ?? DEFAULT_QUESTION_INDEX,
        [COLUMN_CURRENT_QUESTION_ID]: input.current_question_id ?? null,
        [COLUMN_NEXT_QUESTION_ID]: input.next_question_id ?? null,
        [COLUMN_CURRENT_QUESTION_START_TIME]: null,
        [COLUMN_CURRENT_QUESTION_END_TIME]: null,
      })
      .select()
      .single();

    if (insertError) {
      logger.error(
        { error: insertError, gameId: input.game_id, quizSetId: input.quiz_set_id },
        LOG_MESSAGES.FAILED_TO_INSERT_GAME_FLOW,
      );
      return null;
    }

    return gameFlow as GameFlow;
  }
}

//----------------------------------------------------
// 5. Export
//----------------------------------------------------
export const gameFlowService = new GameFlowService();
