// src/services/gameFlowService.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase';
import { GameFlow } from '../types/game';
import { logger } from '../utils/logger';

/**
 * Input parameters for creating a game flow
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
 * Result of game flow creation operation
 */
export interface GameFlowCreateResult {
  success: boolean;
  gameFlow?: GameFlow;
  error?: string;
}

/**
 * Service class for managing game flow operations
 */
export class GameFlowService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabaseAdmin) {
    this.client = client;
  }

  /**
   * Create a new game flow entry when a game is created
   *
   * @param input - The game flow creation parameters
   * @returns Result object with success status and created game flow or error
   */
  async createGameFlow(input: CreateGameFlowInput): Promise<GameFlowCreateResult> {
    try {
      // Validate required fields
      if (!input.game_id) {
        logger.error('createGameFlow called with missing game_id');
        return {
          success: false,
          error: 'game_id is required',
        };
      }

      if (!input.quiz_set_id) {
        logger.error({ gameId: input.game_id }, 'createGameFlow called with missing quiz_set_id');
        return {
          success: false,
          error: 'quiz_set_id is required',
        };
      }

      if (input.total_questions < 0) {
        logger.error(
          { gameId: input.game_id, totalQuestions: input.total_questions },
          'createGameFlow called with invalid total_questions',
        );
        return {
          success: false,
          error: 'total_questions must be non-negative',
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
        logger.warn(
          { gameId: input.game_id },
          'Attempted to create game flow for non-existent game',
        );
        return {
          success: false,
          error: 'Game not found',
        };
      }

      // Verify that the quiz_set exists
      const { data: quizExists, error: quizCheckError } = await this.client
        .from('quiz_sets')
        .select('id')
        .eq('id', input.quiz_set_id)
        .maybeSingle();

      if (quizCheckError) {
        logger.error(
          { error: quizCheckError, quizSetId: input.quiz_set_id },
          'Error checking quiz_set existence',
        );
        return {
          success: false,
          error: 'Failed to verify quiz_set existence',
        };
      }

      if (!quizExists) {
        logger.warn(
          { quizSetId: input.quiz_set_id },
          'Attempted to create game flow for non-existent quiz_set',
        );
        return {
          success: false,
          error: 'Quiz set not found',
        };
      }

      // Create the game flow entry
      const { data: gameFlow, error: insertError } = await this.client
        .from('game_flows')
        .insert({
          game_id: input.game_id,
          quiz_set_id: input.quiz_set_id,
          total_questions: input.total_questions,
          current_question_index: input.current_question_index ?? 0,
          current_question_id: input.current_question_id ?? null,
          next_question_id: input.next_question_id ?? null,
          current_question_start_time: null,
          current_question_end_time: null,
        })
        .select()
        .single();

      if (insertError) {
        logger.error(
          { error: insertError, gameId: input.game_id, quizSetId: input.quiz_set_id },
          'Failed to insert game flow',
        );
        return {
          success: false,
          error: 'Failed to create game flow',
        };
      }

      logger.info(
        { gameFlowId: gameFlow.id, gameId: input.game_id, quizSetId: input.quiz_set_id },
        'Game flow created successfully',
      );

      return {
        success: true,
        gameFlow: gameFlow as GameFlow,
      };
    } catch (error) {
      logger.error(
        { error, gameId: input.game_id, quizSetId: input.quiz_set_id },
        'Unexpected error in createGameFlow',
      );
      return {
        success: false,
        error: 'Unexpected error creating game flow',
      };
    }
  }

  /**
   * Get game flow by game ID
   *
   * @param gameId - The game ID to fetch flow for
   * @returns The game flow or null if not found
   */
  async getGameFlowByGameId(gameId: string): Promise<GameFlow | null> {
    try {
      const { data, error } = await this.client
        .from('game_flows')
        .select('*')
        .eq('game_id', gameId)
        .maybeSingle();

      if (error) {
        logger.error({ error, gameId }, 'Error fetching game flow');
        return null;
      }

      return data as GameFlow | null;
    } catch (error) {
      logger.error({ error, gameId }, 'Unexpected error fetching game flow');
      return null;
    }
  }

  /**
   * Update game flow with new question progression
   *
   * @param gameId - The game ID
   * @param updates - Partial updates to apply
   * @returns Result object with success status and updated game flow or error
   */
  async updateGameFlow(
    gameId: string,
    updates: Partial<Omit<GameFlow, 'id' | 'game_id' | 'created_at' | 'updated_at'>>,
  ): Promise<GameFlowCreateResult> {
    try {
      const { data: gameFlow, error } = await this.client
        .from('game_flows')
        .update(updates)
        .eq('game_id', gameId)
        .select()
        .single();

      if (error) {
        logger.error({ error, gameId, updates }, 'Error updating game flow');
        return {
          success: false,
          error: 'Failed to update game flow',
        };
      }

      logger.info({ gameId, updates }, 'Game flow updated successfully');
      return {
        success: true,
        gameFlow: gameFlow as GameFlow,
      };
    } catch (error) {
      logger.error({ error, gameId, updates }, 'Unexpected error updating game flow');
      return {
        success: false,
        error: 'Unexpected error updating game flow',
      };
    }
  }

  /**
   * Get game flow by game ID
   *
   * @param gameId - The game ID to fetch flow for
   * @returns Result object with success status and game flow or error
   */
  async getGameFlow(gameId: string): Promise<GameFlowCreateResult> {
    try {
      const { data, error } = await this.client
        .from('game_flows')
        .select('*')
        .eq('game_id', gameId)
        .maybeSingle();

      if (error) {
        logger.error({ error, gameId }, 'Error fetching game flow');
        return {
          success: false,
          error: 'Failed to fetch game flow',
        };
      }

      if (!data) {
        return {
          success: false,
          error: 'Game flow not found',
        };
      }

      return {
        success: true,
        gameFlow: data as GameFlow,
      };
    } catch (error) {
      logger.error({ error, gameId }, 'Unexpected error fetching game flow');
      return {
        success: false,
        error: 'Unexpected error fetching game flow',
      };
    }
  }

  /**
   * Delete game flow by game ID
   *
   * @param gameId - The game ID
   * @returns Success status
   */
  async deleteGameFlow(gameId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('game_flows').delete().eq('game_id', gameId);

      if (error) {
        logger.error({ error, gameId }, 'Error deleting game flow');
        return false;
      }

      logger.info({ gameId }, 'Game flow deleted successfully');
      return true;
    } catch (error) {
      logger.error({ error, gameId }, 'Unexpected error deleting game flow');
      return false;
    }
  }
}

// Export singleton instance for convenience
export const gameFlowService = new GameFlowService();
