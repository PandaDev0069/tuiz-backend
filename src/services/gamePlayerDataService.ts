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
  answerStats?: Record<string, number>;
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
      // Resolve game (for quiz/quiz_set) and validate existence
      const { data: game, error: gameError } = await supabaseAdmin
        .from('games')
        .select('id, quiz_set_id')
        .eq('id', gameId)
        .single();

      if (gameError || !game) {
        logger.error({ error: gameError, gameId }, 'Game not found for answer submission');
        return { success: false, error: 'Game not found' };
      }

      // Fetch question (points, answering_time)
      const { data: question, error: questionError } = await supabaseAdmin
        .from('questions')
        .select('id, points, answering_time, question_text')
        .eq('id', answer.question_id)
        .single();

      if (questionError || !question) {
        logger.error(
          { error: questionError, questionId: answer.question_id },
          'Question not found',
        );
        return { success: false, error: 'Question not found' };
      }

      // Fetch quiz play settings (time_bonus, streak_bonus)
      // Use quiz_set_id from game (questions don't have quiz_id column)
      const quizId = game.quiz_set_id;
      let playSettings: { time_bonus?: boolean; streak_bonus?: boolean } = {};
      if (quizId) {
        const { data: quiz, error: quizError } = await supabaseAdmin
          .from('quiz_sets')
          .select('play_settings')
          .eq('id', quizId)
          .maybeSingle();
        if (!quizError && quiz?.play_settings) {
          playSettings = quiz.play_settings as typeof playSettings;
        }
      }

      // Fetch correct answer id
      const { data: correctAnswer, error: correctAnswerError } = await supabaseAdmin
        .from('answers')
        .select('id')
        .eq('question_id', question.id)
        .eq('is_correct', true)
        .single();

      if (correctAnswerError || !correctAnswer) {
        logger.error(
          { error: correctAnswerError, questionId: question.id },
          'Correct answer not found',
        );
        return { success: false, error: 'Correct answer not found' };
      }

      // Determine correctness and timing (authoritative)
      const isCorrect = answer.answer_id === correctAnswer.id;
      const timeTakenSeconds = Math.max(0, answer.time_taken);
      const answeringTime = question.answering_time || 30;

      // Point calculation strict check (points only if <= answering_time)
      const answeredInTime = timeTakenSeconds <= answeringTime;

      // Validation tolerance (reject if significantly late, e.g. > 10% late)
      const maxSubmissionTime = answeringTime * 1.1;
      if (timeTakenSeconds > maxSubmissionTime) {
        logger.warn(
          { timeTaken: timeTakenSeconds, answeringTime, gameId, playerId },
          'Answer submission significantly late, may be ignored or capped',
        );
      }

      // Get current game player data
      const { data: initialData, error: fetchError } = await this.client
        .from('game_player_data')
        .select('*')
        .eq('player_id', playerId)
        .eq('game_id', gameId)
        .single();

      let currentData = initialData;

      // If player data doesn't exist, create it automatically
      if (fetchError && fetchError.code === 'PGRST116') {
        logger.warn({ playerId, gameId }, 'Game player data not found, creating it automatically');

        // Fetch player to get device_id
        const { data: player, error: playerError } = await this.client
          .from('players')
          .select('device_id')
          .eq('id', playerId)
          .eq('game_id', gameId)
          .single();

        if (playerError || !player) {
          logger.error(
            { error: playerError, playerId, gameId },
            'Player not found when trying to create game player data',
          );
          return {
            success: false,
            error: 'Player not found',
          };
        }

        // Create game player data
        const createResult = await this.createGamePlayerData({
          player_id: playerId,
          game_id: gameId,
          player_device_id: player.device_id,
          score: 0,
          answer_report: {
            total_answers: 0,
            correct_answers: 0,
            incorrect_answers: 0,
            questions: [],
          },
        });

        if (!createResult.success) {
          logger.error(
            { error: createResult.error, playerId, gameId },
            'Failed to create game player data automatically',
          );
          return {
            success: false,
            error: createResult.error || 'Failed to initialize player data',
          };
        }

        // Use the newly created data
        currentData = createResult.data;
        logger.info({ playerId, gameId }, 'Game player data created automatically');
      } else if (fetchError || !currentData) {
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

      // Reject duplicate answer for same question
      const alreadyAnswered =
        answerReport.questions?.some((q) => q.question_id === answer.question_id) || false;
      if (alreadyAnswered) {
        return {
          success: false,
          error: 'Question already answered',
        };
      }

      // Check if question has ended (answer reveal triggered)
      // Import gameFlowService dynamically to avoid circular dependency
      const { gameFlowService } = await import('../services/gameFlowService');
      const flowResult = await gameFlowService.getGameFlow(gameId);
      if (flowResult.success && flowResult.gameFlow) {
        const gameFlow = flowResult.gameFlow;
        // Check if this is the current question and if it has ended
        if (
          gameFlow.current_question_id === answer.question_id &&
          gameFlow.current_question_end_time
        ) {
          const endTime = new Date(gameFlow.current_question_end_time).getTime();
          const now = Date.now();
          // Allow a small grace period (1 second) for submissions in flight
          if (now > endTime + 1000) {
            logger.warn(
              { gameId, playerId, questionId: answer.question_id, endTime, now },
              'Answer submission rejected: question has ended',
            );
            return {
              success: false,
              error: 'Question has ended. Answers are locked.',
            };
          }
        }
      }

      // Calculate streaks prior to this answer (current streak = trailing correct count)
      const calcCurrentStreak = (questions: AnswerReport['questions'] = []) => {
        let streak = 0;
        const reversed = [...questions].reverse();
        for (const q of reversed) {
          if (q && q.is_correct) {
            streak += 1;
            continue;
          }
          break;
        }
        return streak;
      };
      const previousStreak = calcCurrentStreak(answerReport.questions);
      const newStreak = isCorrect && answeredInTime ? previousStreak + 1 : 0;

      // Compute points based on play settings
      const basePoints = question.points || 100;
      let computedPoints = 0;
      if (isCorrect && answeredInTime) {
        const timeBonusEnabled = !!playSettings.time_bonus;
        const streakBonusEnabled = !!playSettings.streak_bonus;

        // Formula: points = basePoints - (timeTaken * (basePoints / answeringTime))
        let timeAdjusted = basePoints;
        if (timeBonusEnabled) {
          const timePenaltyFactor = basePoints / answeringTime;
          const timePenalty = Math.min(timeTakenSeconds * timePenaltyFactor, basePoints);
          timeAdjusted = Math.max(0, basePoints - timePenalty);
        }

        // Streak multiplier: 0.1 per streak, max 0.5 bonus (1.5x)
        const streakMultiplier = streakBonusEnabled ? 1 + Math.min(0.5, newStreak * 0.1) : 1;

        computedPoints = Math.max(0, Math.round(timeAdjusted * streakMultiplier));
      }

      // Update answer report
      const updatedReport: AnswerReport = {
        total_answers: answerReport.total_answers + 1,
        correct_answers: answerReport.correct_answers + (isCorrect ? 1 : 0),
        incorrect_answers: answerReport.incorrect_answers + (isCorrect ? 0 : 1),
        questions: [
          ...(answerReport.questions || []),
          {
            question_id: answer.question_id,
            question_number: answer.question_number,
            answer_id: answer.answer_id,
            is_correct: isCorrect,
            time_taken: timeTakenSeconds,
            points_earned: computedPoints,
            answered_at: new Date().toISOString(),
          },
        ],
      };

      // Calculate streaks
      const questions = updatedReport.questions;
      const previousMaxStreak = answerReport.streaks?.max_streak || 0;
      const maxStreak = Math.max(previousMaxStreak, newStreak);

      updatedReport.streaks = {
        current_streak: newStreak,
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

      // Calculate previous rank before updating score
      // Only use stored current_rank as previous_rank if it exists (not first question)
      const existingCurrentRank = answerReport?.current_rank;
      let previousRank: number | undefined;

      if (existingCurrentRank !== undefined) {
        // Use stored current_rank as previous_rank for next question
        // This means we're on question 2 or later
        previousRank = existingCurrentRank;
      }
      // If existingCurrentRank is undefined, this is the first question
      // Don't set previousRank - it will remain undefined
      // This way, the first leaderboard won't show rank changes

      // Update score
      const newScore = currentData.score + computedPoints;

      // Calculate new rank after updating score
      const { count: newHigherScores } = await this.client
        .from('game_player_data')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .gt('score', newScore);
      const newRank = (newHigherScores || 0) + 1;

      // Update answer report with rank tracking
      // Only store previous_rank if we had a previous current_rank (not first question)
      if (previousRank !== undefined) {
        updatedReport.previous_rank = previousRank;
      }
      // Always update current_rank for next question's comparison
      updatedReport.current_rank = newRank;

      // Add to rank history
      const existingHistory = (answerReport.rank_history || []) as AnswerReport['rank_history'];
      updatedReport.rank_history = [
        ...(existingHistory || []),
        {
          question_number: answer.question_number,
          rank: newRank,
          score: newScore,
          points_earned: computedPoints,
          timestamp: new Date().toISOString(),
        },
      ];

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

      // Aggregate per-choice counts for this question across all players in the game
      let answerStats: Record<string, number> = {};
      const { data: allReports, error: reportsError } = await this.client
        .from('game_player_data')
        .select('answer_report')
        .eq('game_id', gameId);

      if (!reportsError && allReports) {
        answerStats = (allReports as { answer_report: AnswerReport }[]).reduce(
          (acc, row) => {
            const report = row.answer_report as AnswerReport;
            (report.questions || []).forEach((q) => {
              if (q.question_id === answer.question_id && q.answer_id) {
                acc[q.answer_id] = (acc[q.answer_id] || 0) + 1;
              }
            });
            return acc;
          },
          {} as Record<string, number>,
        );
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
        answerStats,
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
      // Exclude host from leaderboard (is_host = false)
      const { data: leaderboardData, error } = await this.client
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
        .eq('players.is_host', false) // Exclude host from leaderboard
        .order('score', { ascending: false })
        .range(query.offset, query.offset + query.limit - 1);

      if (error) {
        logger.error({ error, gameId }, 'Error fetching leaderboard');
        return null;
      }

      // Transform data to leaderboard entries
      interface PlayerData {
        player_name: string;
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
      // Filter out host players (in case the query filter didn't work)
      const filteredData = (leaderboardData || []).filter((item: LeaderboardData) => {
        const player = Array.isArray(item.players) ? item.players[0] : item.players;
        return !player?.is_host; // Exclude host
      });

      const entries: LeaderboardEntry[] = filteredData.map(
        (item: LeaderboardData, index: number) => {
          const answerReport = item.answer_report as AnswerReport;
          const player = Array.isArray(item.players) ? item.players[0] : item.players;
          const currentRank = query.offset + index + 1;
          const previousRank = answerReport?.previous_rank;

          // Determine rank change
          // Only show rank change if previous_rank exists (not first leaderboard)
          let rankChange: 'up' | 'down' | 'same' | undefined = undefined;
          if (previousRank !== undefined) {
            if (currentRank < previousRank) {
              rankChange = 'up';
            } else if (currentRank > previousRank) {
              rankChange = 'down';
            } else {
              rankChange = 'same';
            }
          }

          // Get score change from most recent question
          const rankHistory = answerReport?.rank_history || [];
          const mostRecentEntry =
            rankHistory.length > 0 ? rankHistory[rankHistory.length - 1] : null;
          const scoreChange = mostRecentEntry?.points_earned || 0;

          return {
            player_id: item.player_id,
            player_name: player?.player_name || 'Unknown',
            device_id: player?.device_id || '',
            score: item.score,
            rank: currentRank,
            previous_rank: previousRank,
            rank_change: rankChange,
            score_change: scoreChange,
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

      // Adjust total count to exclude hosts
      // If we filtered out hosts, the count might be off, so use entries length
      const totalWithoutHosts = entries.length;

      return {
        game_id: gameId,
        entries,
        total: totalWithoutHosts, // Use filtered count
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
