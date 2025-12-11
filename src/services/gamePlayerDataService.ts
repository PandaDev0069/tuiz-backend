// src/services/gamePlayerDataService.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase';
import {
  AnswerReport,
  CreateGamePlayerDataInput,
  GamePlayerData,
  LeaderboardEntry,
  LeaderboardQuery,
  LeaderboardResponse,
  PlayerStats,
  SubmitAnswerInput,
  UpdateGamePlayerDataInput,
} from '../types/gamePlayerData';
import { logger } from '../utils/logger';

/**
 * Result of game player data creation operation
 */
export interface GamePlayerDataCreateResult {
  success: boolean;
  data?: GamePlayerData;
  error?: string;
}

/**
 * Result of game player data update operation
 */
export interface GamePlayerDataUpdateResult {
  success: boolean;
  data?: GamePlayerData;
  error?: string;
}

/**
 * Service class for managing game player data operations
 * Handles scoring, answer tracking, and leaderboard generation
 */
export class GamePlayerDataService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabaseAdmin) {
    this.client = client;
  }

  /**
   * Create initial game player data entry
   *
   * @param input - The game player data creation parameters
   * @returns Result object with success status and created data or error
   */
  async createGamePlayerData(
    input: CreateGamePlayerDataInput,
  ): Promise<GamePlayerDataCreateResult> {
    try {
      // Validate required fields
      if (!input.player_id) {
        logger.error('createGamePlayerData called with missing player_id');
        return {
          success: false,
          error: 'player_id is required',
        };
      }

      if (!input.game_id) {
        logger.error(
          { playerId: input.player_id },
          'createGamePlayerData called with missing game_id',
        );
        return {
          success: false,
          error: 'game_id is required',
        };
      }

      if (!input.player_device_id) {
        logger.error(
          { playerId: input.player_id },
          'createGamePlayerData called with missing player_device_id',
        );
        return {
          success: false,
          error: 'player_device_id is required',
        };
      }

      // Check if entry already exists
      const { data: existing } = await this.client
        .from('game_player_data')
        .select('id')
        .eq('player_id', input.player_id)
        .eq('game_id', input.game_id)
        .maybeSingle();

      if (existing) {
        logger.warn(
          { playerId: input.player_id, gameId: input.game_id },
          'Game player data already exists',
        );
        return {
          success: false,
          error: 'Player data already exists for this game',
        };
      }

      // Create the game player data
      const { data, error: createError } = await this.client
        .from('game_player_data')
        .insert({
          player_id: input.player_id,
          player_device_id: input.player_device_id,
          game_id: input.game_id,
          score: input.score || 0,
          answer_report: input.answer_report || {
            total_answers: 0,
            correct_answers: 0,
            incorrect_answers: 0,
            questions: [],
          },
        })
        .select()
        .single();

      if (createError) {
        logger.error(
          { error: createError, playerId: input.player_id, gameId: input.game_id },
          'Error creating game player data',
        );
        return {
          success: false,
          error: 'Failed to create game player data',
        };
      }

      logger.info(
        {
          dataId: data.id,
          playerId: input.player_id,
          gameId: input.game_id,
        },
        'Game player data created successfully',
      );

      return {
        success: true,
        data,
      };
    } catch (err) {
      logger.error(
        { err, playerId: input.player_id, gameId: input.game_id },
        'Exception in createGamePlayerData',
      );
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Submit a player's answer and update score/report
   *
   * @param playerId - The player ID
   * @param gameId - The game ID
   * @param answer - The answer submission data
   * @returns Result object with success status and updated data or error
   */
  async submitAnswer(
    playerId: string,
    gameId: string,
    answer: SubmitAnswerInput,
  ): Promise<GamePlayerDataUpdateResult> {
    try {
      // Get current game player data
      const { data: currentData, error: fetchError } = await this.client
        .from('game_player_data')
        .select('*')
        .eq('player_id', playerId)
        .eq('game_id', gameId)
        .single();

      if (fetchError || !currentData) {
        logger.error(
          { error: fetchError, playerId, gameId },
          'Error fetching game player data for answer submission',
        );
        return {
          success: false,
          error: 'Player data not found',
        };
      }

      // Parse current answer report
      const answerReport: AnswerReport = currentData.answer_report as AnswerReport;

      // Update answer report
      const updatedReport: AnswerReport = {
        total_answers: answerReport.total_answers + 1,
        correct_answers: answerReport.correct_answers + (answer.is_correct ? 1 : 0),
        incorrect_answers: answerReport.incorrect_answers + (answer.is_correct ? 0 : 1),
        questions: [
          ...(answerReport.questions || []),
          {
            question_id: answer.question_id,
            question_number: answer.question_number,
            answer_id: answer.answer_id,
            is_correct: answer.is_correct,
            time_taken: answer.time_taken,
            points_earned: answer.points_earned || 0,
            answered_at: new Date().toISOString(),
          },
        ],
      };

      // Calculate streaks
      const questions = updatedReport.questions;
      let currentStreak = 0;
      let maxStreak = 0;
      let tempStreak = 0;

      for (let i = questions.length - 1; i >= 0; i--) {
        const question = questions[i as number];
        if (question && question.is_correct) {
          tempStreak++;
          if (i === questions.length - 1) {
            currentStreak = tempStreak;
          }
          maxStreak = Math.max(maxStreak, tempStreak);
        } else {
          if (i === questions.length - 1) {
            currentStreak = 0;
          }
          tempStreak = 0;
        }
      }

      updatedReport.streaks = {
        current_streak: currentStreak,
        max_streak: maxStreak,
      };

      // Calculate timing statistics
      const responseTimes = questions.map((q) => q.time_taken);
      updatedReport.timing = {
        average_response_time:
          responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        fastest_response: Math.min(...responseTimes),
        slowest_response: Math.max(...responseTimes),
      };

      // Update score
      const newScore = currentData.score + (answer.points_earned || 0);

      // Save updates
      const { data: updatedData, error: updateError } = await this.client
        .from('game_player_data')
        .update({
          score: newScore,
          answer_report: updatedReport,
        })
        .eq('player_id', playerId)
        .eq('game_id', gameId)
        .select()
        .single();

      if (updateError) {
        logger.error({ error: updateError, playerId, gameId }, 'Error updating game player data');
        return {
          success: false,
          error: 'Failed to update game player data',
        };
      }

      logger.info(
        {
          playerId,
          gameId,
          questionId: answer.question_id,
          isCorrect: answer.is_correct,
          newScore,
        },
        'Answer submitted successfully',
      );

      return {
        success: true,
        data: updatedData,
      };
    } catch (err) {
      logger.error({ err, playerId, gameId }, 'Exception in submitAnswer');
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Update game player data manually
   *
   * @param playerId - The player ID
   * @param gameId - The game ID
   * @param updates - The fields to update
   * @returns Result object with success status and updated data or error
   */
  async updateGamePlayerData(
    playerId: string,
    gameId: string,
    updates: UpdateGamePlayerDataInput,
  ): Promise<GamePlayerDataUpdateResult> {
    try {
      if (Object.keys(updates).length === 0) {
        return {
          success: false,
          error: 'No updates provided',
        };
      }

      const { data, error: updateError } = await this.client
        .from('game_player_data')
        .update(updates)
        .eq('player_id', playerId)
        .eq('game_id', gameId)
        .select()
        .single();

      if (updateError) {
        logger.error({ error: updateError, playerId, gameId }, 'Error updating game player data');
        return {
          success: false,
          error: 'Failed to update game player data',
        };
      }

      logger.info({ playerId, gameId, updates }, 'Game player data updated successfully');

      return {
        success: true,
        data,
      };
    } catch (err) {
      logger.error({ err, playerId, gameId }, 'Exception in updateGamePlayerData');
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Get game player data for a specific player
   *
   * @param playerId - The player ID
   * @param gameId - The game ID
   * @returns Game player data or null
   */
  async getGamePlayerData(playerId: string, gameId: string): Promise<GamePlayerData | null> {
    try {
      const { data, error } = await this.client
        .from('game_player_data')
        .select('*')
        .eq('player_id', playerId)
        .eq('game_id', gameId)
        .single();

      if (error) {
        logger.error({ error, playerId, gameId }, 'Error fetching game player data');
        return null;
      }

      return data;
    } catch (err) {
      logger.error({ err, playerId, gameId }, 'Exception in getGamePlayerData');
      return null;
    }
  }

  /**
   * Get leaderboard for a game
   *
   * @param gameId - The game ID
   * @param query - Query parameters for pagination
   * @returns Leaderboard with player rankings
   */
  async getLeaderboard(
    gameId: string,
    query: LeaderboardQuery,
  ): Promise<LeaderboardResponse | null> {
    try {
      // Join game_player_data with players table for player info
      const {
        data: leaderboardData,
        error,
        count,
      } = await this.client
        .from('game_player_data')
        .select(
          `
          *,
          players!inner (
            id,
            player_name,
            device_id,
            is_host,
            is_logged_in
          )
        `,
          { count: 'exact' },
        )
        .eq('game_id', gameId)
        .order('score', { ascending: false })
        .range(query.offset, query.offset + query.limit - 1);

      if (error) {
        logger.error({ error, gameId }, 'Error fetching leaderboard');
        return null;
      }

      // Transform data to leaderboard entries
      interface PlayerData {
        name: string;
        device_id: string;
        is_host: boolean;
        user_id: string | null;
      }
      interface LeaderboardData {
        player_id: string;
        player_device_id: string;
        game_id: string;
        score: number;
        answer_report: AnswerReport;
        players: PlayerData | PlayerData[];
      }
      const entries: LeaderboardEntry[] = (leaderboardData || []).map(
        (item: LeaderboardData, index: number) => {
          const answerReport = item.answer_report as AnswerReport;
          const player = Array.isArray(item.players) ? item.players[0] : item.players;

          return {
            player_id: item.player_id,
            player_name: player?.name || 'Unknown',
            device_id: player?.device_id || '',
            score: item.score,
            rank: query.offset + index + 1,
            total_answers: answerReport?.total_answers || 0,
            correct_answers: answerReport?.correct_answers || 0,
            accuracy:
              answerReport?.total_answers > 0
                ? Math.round((answerReport.correct_answers / answerReport.total_answers) * 100)
                : 0,
            is_host: player?.is_host || false,
            is_logged_in: !!player?.user_id,
          };
        },
      );

      return {
        game_id: gameId,
        entries,
        total: count || 0,
        limit: query.limit,
        offset: query.offset,
        updated_at: new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ err, gameId }, 'Exception in getLeaderboard');
      return null;
    }
  }

  /**
   * Get detailed player statistics
   *
   * @param playerId - The player ID
   * @param gameId - The game ID
   * @returns Detailed player statistics or null
   */
  async getPlayerStats(playerId: string, gameId: string): Promise<PlayerStats | null> {
    try {
      const { data, error } = await this.client
        .from('game_player_data')
        .select(
          `
          *,
          players!inner (
            player_name
          )
        `,
        )
        .eq('player_id', playerId)
        .eq('game_id', gameId)
        .single();

      if (error) {
        logger.error({ error, playerId, gameId }, 'Error fetching player stats');
        return null;
      }

      const answerReport = data.answer_report as AnswerReport;
      const player = Array.isArray(data.players) ? data.players[0] : data.players;

      // Calculate rank
      const { count: higherScores } = await this.client
        .from('game_player_data')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .gt('score', data.score);

      const rank = (higherScores || 0) + 1;

      return {
        player_id: playerId,
        player_name: player?.player_name || 'Unknown',
        score: data.score,
        rank,
        total_answers: answerReport?.total_answers || 0,
        correct_answers: answerReport?.correct_answers || 0,
        incorrect_answers: answerReport?.incorrect_answers || 0,
        accuracy:
          answerReport?.total_answers > 0
            ? Math.round((answerReport.correct_answers / answerReport.total_answers) * 100)
            : 0,
        current_streak: answerReport?.streaks?.current_streak || 0,
        max_streak: answerReport?.streaks?.max_streak || 0,
        average_response_time: answerReport?.timing?.average_response_time || 0,
        fastest_response: answerReport?.timing?.fastest_response || 0,
        slowest_response: answerReport?.timing?.slowest_response || 0,
        questions: (answerReport?.questions || []).map((q) => ({
          question_id: q.question_id,
          question_number: q.question_number,
          is_correct: q.is_correct,
          time_taken: q.time_taken,
          points_earned: q.points_earned,
        })),
      };
    } catch (err) {
      logger.error({ err, playerId, gameId }, 'Exception in getPlayerStats');
      return null;
    }
  }

  /**
   * Delete game player data
   *
   * @param playerId - The player ID
   * @param gameId - The game ID
   * @returns Success status
   */
  async deleteGamePlayerData(playerId: string, gameId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('game_player_data')
        .delete()
        .eq('player_id', playerId)
        .eq('game_id', gameId);

      if (error) {
        logger.error({ error, playerId, gameId }, 'Error deleting game player data');
        return false;
      }

      logger.info({ playerId, gameId }, 'Game player data deleted successfully');
      return true;
    } catch (err) {
      logger.error({ err, playerId, gameId }, 'Exception in deleteGamePlayerData');
      return false;
    }
  }
}

// Export singleton instance
export const gamePlayerDataService = new GamePlayerDataService();
