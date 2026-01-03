// ====================================================
// File Name   : gamePlayerDataService.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-30

// Description:
// - Service for managing game player data operations
// - Handles scoring, answer tracking, and leaderboard generation
// - Core service for real-time quiz gameplay scoring system
// - Authoritative server-side answer validation and point calculation

// Notes:
// - All scoring calculations are server-side authoritative
// - Answer reports stored as JSONB in database
// - Supports time bonus and streak bonus scoring modes
// - Handles automatic player data creation if missing
// - Tracks rank changes and answer statistics per question
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
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

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const DEFAULT_BASE_POINTS = 100;
const DEFAULT_ANSWERING_TIME_SECONDS = 30;
const DEFAULT_SCORE = 0;
const INITIAL_TOTAL_ANSWERS = 0;
const INITIAL_CORRECT_ANSWERS = 0;
const INITIAL_INCORRECT_ANSWERS = 0;
const DEFAULT_ACCURACY = 0;
const RANK_OFFSET = 1;

const TIME_TOLERANCE_MULTIPLIER = 1.1;
const GRACE_PERIOD_MS = 1000;

const STREAK_BONUS_PER_STREAK = 0.1;
const MAX_STREAK_BONUS = 0.5;
const STREAK_MULTIPLIER_BASE = 1;

const ACCURACY_PERCENTAGE_MULTIPLIER = 100;
const MIN_TIME_TAKEN_SECONDS = 0;
const MIN_POINTS = 0;

const SUPABASE_NOT_FOUND_ERROR_CODE = 'PGRST116';

const TABLE_GAMES = 'games';
const TABLE_PLAYERS = 'players';
const TABLE_QUESTIONS = 'questions';
const TABLE_ANSWERS = 'answers';
const TABLE_QUIZ_SETS = 'quiz_sets';
const TABLE_GAME_PLAYER_DATA = 'game_player_data';

const COLUMN_ID = 'id';
const COLUMN_PLAYER_ID = 'player_id';
const COLUMN_GAME_ID = 'game_id';
const COLUMN_QUESTION_ID = 'question_id';
const COLUMN_PLAYER_DEVICE_ID = 'player_device_id';
const COLUMN_SCORE = 'score';
const COLUMN_ANSWER_REPORT = 'answer_report';
const COLUMN_IS_HOST = 'is_host';
const COLUMN_IS_CORRECT = 'is_correct';
const COLUMN_PLAY_SETTINGS = 'play_settings';
const SELECT_ALL = '*';

const GAME_SELECT_FIELDS = 'id, quiz_set_id';
const QUESTION_SELECT_FIELDS = 'id, points, answering_time, question_text';
const PLAYER_SELECT_DEVICE_ID = 'device_id';
const LEADERBOARD_SELECT_QUERY = `
  *,
  players!inner (
    id,
    player_name,
    device_id,
    is_host,
    is_logged_in
  )
`;
const PLAYER_STATS_SELECT_QUERY = `
  *,
  players!inner (
    player_name
  )
`;

const RANK_CHANGE_UP = 'up';
const RANK_CHANGE_DOWN = 'down';
const RANK_CHANGE_SAME = 'same';

const ERROR_MESSAGES = {
  PLAYER_ID_REQUIRED: 'player_id is required',
  GAME_ID_REQUIRED: 'game_id is required',
  PLAYER_DEVICE_ID_REQUIRED: 'player_device_id is required',
  PLAYER_DATA_EXISTS: 'Player data already exists for this game',
  GAME_NOT_FOUND: 'Game not found',
  QUESTION_NOT_FOUND: 'Question not found',
  CORRECT_ANSWER_NOT_FOUND: 'Correct answer not found',
  PLAYER_NOT_FOUND: 'Player not found',
  PLAYER_DATA_NOT_FOUND: 'Player data not found',
  QUESTION_ALREADY_ANSWERED: 'Question already answered',
  QUESTION_ENDED: 'Question has ended. Answers are locked.',
  NO_UPDATES_PROVIDED: 'No updates provided',
  FAILED_TO_CREATE: 'Failed to create game player data',
  FAILED_TO_UPDATE: 'Failed to update game player data',
  FAILED_TO_INITIALIZE: 'Failed to initialize player data',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

const LOG_MESSAGES = {
  CREATE_MISSING_PLAYER_ID: 'createGamePlayerData called with missing player_id',
  CREATE_MISSING_GAME_ID: 'createGamePlayerData called with missing game_id',
  CREATE_MISSING_DEVICE_ID: 'createGamePlayerData called with missing player_device_id',
  PLAYER_DATA_ALREADY_EXISTS: 'Game player data already exists',
  ERROR_CREATING_DATA: 'Error creating game player data',
  DATA_CREATED_SUCCESSFULLY: 'Game player data created successfully',
  EXCEPTION_IN_CREATE: 'Exception in createGamePlayerData',
  GAME_NOT_FOUND_FOR_ANSWER: 'Game not found for answer submission',
  QUESTION_NOT_FOUND_FOR_ANSWER: 'Question not found',
  CORRECT_ANSWER_NOT_FOUND_FOR_QUESTION: 'Correct answer not found',
  ANSWER_SUBMISSION_LATE: 'Answer submission significantly late, may be ignored or capped',
  DATA_NOT_FOUND_CREATING: 'Game player data not found, creating it automatically',
  PLAYER_NOT_FOUND_FOR_DATA: 'Player not found when trying to create game player data',
  FAILED_CREATE_DATA_AUTO: 'Failed to create game player data automatically',
  DATA_CREATED_AUTO: 'Game player data created automatically',
  ERROR_FETCHING_DATA_FOR_ANSWER: 'Error fetching game player data for answer submission',
  ANSWER_REJECTED_QUESTION_ENDED: 'Answer submission rejected: question has ended',
  ANSWER_SUBMITTED_SUCCESSFULLY: 'Answer submitted successfully',
  EXCEPTION_IN_SUBMIT_ANSWER: 'Exception in submitAnswer',
  ERROR_UPDATING_DATA: 'Error updating game player data',
  DATA_UPDATED_SUCCESSFULLY: 'Game player data updated successfully',
  EXCEPTION_IN_UPDATE: 'Exception in updateGamePlayerData',
  ERROR_FETCHING_DATA: 'Error fetching game player data',
  EXCEPTION_IN_GET_DATA: 'Exception in getGamePlayerData',
  ERROR_FETCHING_LEADERBOARD: 'Error fetching leaderboard',
  EXCEPTION_IN_GET_LEADERBOARD: 'Exception in getLeaderboard',
  ERROR_FETCHING_STATS: 'Error fetching player stats',
  EXCEPTION_IN_GET_STATS: 'Exception in getPlayerStats',
  ERROR_DELETING_DATA: 'Error deleting game player data',
  DATA_DELETED_SUCCESSFULLY: 'Game player data deleted successfully',
  EXCEPTION_IN_DELETE: 'Exception in deleteGamePlayerData',
} as const;

const DEFAULT_ANSWER_REPORT: AnswerReport = {
  total_answers: INITIAL_TOTAL_ANSWERS,
  correct_answers: INITIAL_CORRECT_ANSWERS,
  incorrect_answers: INITIAL_INCORRECT_ANSWERS,
  questions: [],
};

const UNKNOWN_PLAYER_NAME = 'Unknown';
const EMPTY_DEVICE_ID = '';

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------

/**
 * Interface: GamePlayerDataCreateResult
 * Description:
 * - Result structure for game player data creation operations
 * - Contains success status, created data (if successful), or error message
 */
export interface GamePlayerDataCreateResult {
  success: boolean;
  data?: GamePlayerData;
  error?: string;
}

/**
 * Interface: GamePlayerDataUpdateResult
 * Description:
 * - Result structure for game player data update operations
 * - Contains success status, updated data (if successful), error message, and answer statistics
 */
export interface GamePlayerDataUpdateResult {
  success: boolean;
  data?: GamePlayerData;
  error?: string;
  answerStats?: Record<string, number>;
}

/**
 * Interface: PlaySettings
 * Description:
 * - Play settings configuration from quiz set
 * - Controls time bonus and streak bonus scoring modes
 */
interface PlaySettings {
  time_bonus?: boolean;
  streak_bonus?: boolean;
}

/**
 * Interface: GameData
 * Description:
 * - Game data structure with quiz set reference
 * - Used for validating game existence and fetching quiz settings
 */
interface GameData {
  id: string;
  quiz_set_id: string | null;
}

/**
 * Interface: QuestionData
 * Description:
 * - Question data structure with scoring and timing information
 * - Used for calculating points and validating answer submissions
 */
interface QuestionData {
  id: string;
  points: number | null;
  answering_time: number | null;
  question_text: string | null;
}

/**
 * Interface: PlayerData
 * Description:
 * - Player data structure from database
 * - Contains player identification and role information
 */
interface PlayerData {
  player_name: string;
  device_id: string;
  is_host: boolean;
  user_id: string | null;
}

/**
 * Interface: LeaderboardData
 * Description:
 * - Leaderboard data structure from database query
 * - Contains player data with score and answer report information
 */
interface LeaderboardData {
  player_id: string;
  player_device_id: string;
  game_id: string;
  score: number;
  answer_report: AnswerReport;
  players: PlayerData | PlayerData[];
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------

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
   * Function: createGamePlayerData
   * Description:
   * - Creates initial game player data entry for a player in a game
   * - Validates required fields and checks for existing entries
   * - Initializes score and answer report with default values
   *
   * Parameters:
   * - input (CreateGamePlayerDataInput): The game player data creation parameters
   *
   * Returns:
   * - Promise<GamePlayerDataCreateResult>: Result object with success status and created data or error
   *
   * Throws:
   * - Logs errors but returns error result instead of throwing
   */
  async createGamePlayerData(
    input: CreateGamePlayerDataInput,
  ): Promise<GamePlayerDataCreateResult> {
    try {
      if (!input.player_id) {
        logger.error(LOG_MESSAGES.CREATE_MISSING_PLAYER_ID);
        return {
          success: false,
          error: ERROR_MESSAGES.PLAYER_ID_REQUIRED,
        };
      }

      if (!input.game_id) {
        logger.error({ playerId: input.player_id }, LOG_MESSAGES.CREATE_MISSING_GAME_ID);
        return {
          success: false,
          error: ERROR_MESSAGES.GAME_ID_REQUIRED,
        };
      }

      if (!input.player_device_id) {
        logger.error({ playerId: input.player_id }, LOG_MESSAGES.CREATE_MISSING_DEVICE_ID);
        return {
          success: false,
          error: ERROR_MESSAGES.PLAYER_DEVICE_ID_REQUIRED,
        };
      }

      const { data: existing } = await this.client
        .from(TABLE_GAME_PLAYER_DATA)
        .select(COLUMN_ID)
        .eq(COLUMN_PLAYER_ID, input.player_id)
        .eq(COLUMN_GAME_ID, input.game_id)
        .maybeSingle();

      if (existing) {
        logger.warn(
          { playerId: input.player_id, gameId: input.game_id },
          LOG_MESSAGES.PLAYER_DATA_ALREADY_EXISTS,
        );
        return {
          success: false,
          error: ERROR_MESSAGES.PLAYER_DATA_EXISTS,
        };
      }

      const { data, error: createError } = await this.client
        .from(TABLE_GAME_PLAYER_DATA)
        .insert({
          [COLUMN_PLAYER_ID]: input.player_id,
          [COLUMN_PLAYER_DEVICE_ID]: input.player_device_id,
          [COLUMN_GAME_ID]: input.game_id,
          [COLUMN_SCORE]: input.score || DEFAULT_SCORE,
          [COLUMN_ANSWER_REPORT]: input.answer_report || DEFAULT_ANSWER_REPORT,
        })
        .select()
        .single();

      if (createError) {
        logger.error(
          { error: createError, playerId: input.player_id, gameId: input.game_id },
          LOG_MESSAGES.ERROR_CREATING_DATA,
        );
        return {
          success: false,
          error: ERROR_MESSAGES.FAILED_TO_CREATE,
        };
      }

      logger.info(
        {
          dataId: data.id,
          playerId: input.player_id,
          gameId: input.game_id,
        },
        LOG_MESSAGES.DATA_CREATED_SUCCESSFULLY,
      );

      return {
        success: true,
        data,
      };
    } catch (err) {
      logger.error(
        { err, playerId: input.player_id, gameId: input.game_id },
        LOG_MESSAGES.EXCEPTION_IN_CREATE,
      );
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Function: submitAnswer
   * Description:
   * - Submits a player's answer and updates score/report
   * - Validates game, question, and answer correctness
   * - Calculates points with time bonus and streak bonus if enabled
   * - Updates answer report with timing statistics and rank tracking
   * - Aggregates answer statistics for all players
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   * - answer (SubmitAnswerInput): The answer submission data
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult>: Result object with success status and updated data or error
   *
   * Throws:
   * - Logs errors but returns error result instead of throwing
   */
  async submitAnswer(
    playerId: string,
    gameId: string,
    answer: SubmitAnswerInput,
  ): Promise<GamePlayerDataUpdateResult> {
    try {
      const contextResult = await this.validateAnswerContext(gameId, answer.question_id);
      if (!contextResult.success) {
        return contextResult;
      }
      const context = contextResult as {
        success: true;
        game: GameData;
        question: QuestionData;
        playSettings: PlaySettings;
        correctAnswer: { id: string };
      };

      const answerProcessingResult = await this.processAnswerSubmission(
        playerId,
        gameId,
        answer,
        context,
      );
      if (!answerProcessingResult.success) {
        return answerProcessingResult;
      }
      const processedAnswer = answerProcessingResult as {
        success: true;
        currentData: GamePlayerData;
        answerReport: AnswerReport;
        isCorrect: boolean;
        timeTakenSeconds: number;
        answeredInTime: boolean;
        answeringTime: number;
      };

      const scoringResult = await this.calculateAnswerScore(processedAnswer, context, answer);
      if (!scoringResult.success) {
        return scoringResult;
      }
      const scoring = scoringResult as {
        success: true;
        updatedReport: AnswerReport;
        computedPoints: number;
        newScore: number;
        newRank: number;
        isCorrect: boolean;
      };

      const persistenceResult = await this.persistAnswerSubmission(
        playerId,
        gameId,
        answer,
        scoring,
      );
      if (!persistenceResult.success) {
        return persistenceResult;
      }
      const persisted = persistenceResult as {
        success: true;
        data: GamePlayerData;
        answerStats: Record<string, number>;
      };

      logger.info(
        {
          playerId,
          gameId,
          questionId: answer.question_id,
          isCorrect: scoring.isCorrect,
          newScore: scoring.newScore,
        },
        LOG_MESSAGES.ANSWER_SUBMITTED_SUCCESSFULLY,
      );

      return {
        success: true,
        data: persisted.data,
        answerStats: persisted.answerStats,
      };
    } catch (err) {
      logger.error({ err, playerId, gameId }, LOG_MESSAGES.EXCEPTION_IN_SUBMIT_ANSWER);
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Function: updateGamePlayerData
   * Description:
   * - Updates game player data manually
   * - Validates that updates are provided
   * - Updates specified fields in the database
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   * - updates (UpdateGamePlayerDataInput): The fields to update
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult>: Result object with success status and updated data or error
   *
   * Throws:
   * - Logs errors but returns error result instead of throwing
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
          error: ERROR_MESSAGES.NO_UPDATES_PROVIDED,
        };
      }

      const { data, error: updateError } = await this.client
        .from(TABLE_GAME_PLAYER_DATA)
        .update(updates)
        .eq(COLUMN_PLAYER_ID, playerId)
        .eq(COLUMN_GAME_ID, gameId)
        .select()
        .single();

      if (updateError) {
        logger.error({ error: updateError, playerId, gameId }, LOG_MESSAGES.ERROR_UPDATING_DATA);
        return {
          success: false,
          error: ERROR_MESSAGES.FAILED_TO_UPDATE,
        };
      }

      logger.info({ playerId, gameId, updates }, LOG_MESSAGES.DATA_UPDATED_SUCCESSFULLY);

      return {
        success: true,
        data,
      };
    } catch (err) {
      logger.error({ err, playerId, gameId }, LOG_MESSAGES.EXCEPTION_IN_UPDATE);
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Function: getGamePlayerData
   * Description:
   * - Retrieves game player data for a specific player in a game
   * - Returns null if not found or on error
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   *
   * Returns:
   * - Promise<GamePlayerData | null>: Game player data or null if not found
   *
   * Throws:
   * - Logs errors but returns null instead of throwing
   */
  async getGamePlayerData(playerId: string, gameId: string): Promise<GamePlayerData | null> {
    try {
      const { data, error } = await this.client
        .from(TABLE_GAME_PLAYER_DATA)
        .select(SELECT_ALL)
        .eq(COLUMN_PLAYER_ID, playerId)
        .eq(COLUMN_GAME_ID, gameId)
        .single();

      if (error) {
        logger.error({ error, playerId, gameId }, LOG_MESSAGES.ERROR_FETCHING_DATA);
        return null;
      }

      return data;
    } catch (err) {
      logger.error({ err, playerId, gameId }, LOG_MESSAGES.EXCEPTION_IN_GET_DATA);
      return null;
    }
  }

  /**
   * Function: getLeaderboard
   * Description:
   * - Retrieves leaderboard for a game with pagination
   * - Excludes host players from leaderboard
   * - Calculates rank changes and score changes
   * - Returns formatted leaderboard entries with player information
   *
   * Parameters:
   * - gameId (string): The game ID
   * - query (LeaderboardQuery): Query parameters for pagination
   *
   * Returns:
   * - Promise<LeaderboardResponse | null>: Leaderboard with player rankings or null on error
   *
   * Throws:
   * - Logs errors but returns null instead of throwing
   */
  async getLeaderboard(
    gameId: string,
    query: LeaderboardQuery,
  ): Promise<LeaderboardResponse | null> {
    try {
      const { data: leaderboardData, error } = await this.client
        .from(TABLE_GAME_PLAYER_DATA)
        .select(LEADERBOARD_SELECT_QUERY, { count: 'exact' })
        .eq(COLUMN_GAME_ID, gameId)
        .eq(`${TABLE_PLAYERS}.${COLUMN_IS_HOST}`, false)
        .order(COLUMN_SCORE, { ascending: false })
        .range(query.offset, query.offset + query.limit - 1);

      if (error) {
        logger.error({ error, gameId }, LOG_MESSAGES.ERROR_FETCHING_LEADERBOARD);
        return null;
      }

      const filteredData = (leaderboardData || []).filter((item: LeaderboardData) => {
        const player = Array.isArray(item.players) ? item.players[0] : item.players;
        return !player?.is_host;
      });

      const entries: LeaderboardEntry[] = filteredData.map(
        (item: LeaderboardData, index: number) => {
          const answerReport = item.answer_report as AnswerReport;
          const player = Array.isArray(item.players) ? item.players[0] : item.players;
          const currentRank = query.offset + index + 1;
          const previousRank = answerReport?.previous_rank;

          let rankChange: 'up' | 'down' | 'same' | undefined = undefined;
          if (previousRank !== undefined) {
            if (currentRank < previousRank) {
              rankChange = RANK_CHANGE_UP;
            } else if (currentRank > previousRank) {
              rankChange = RANK_CHANGE_DOWN;
            } else {
              rankChange = RANK_CHANGE_SAME;
            }
          }

          const rankHistory = answerReport?.rank_history || [];
          const mostRecentEntry =
            rankHistory.length > 0 ? rankHistory[rankHistory.length - 1] : null;
          const scoreChange = mostRecentEntry?.points_earned || 0;

          return {
            player_id: item.player_id,
            player_name: player?.player_name || UNKNOWN_PLAYER_NAME,
            device_id: player?.device_id || EMPTY_DEVICE_ID,
            score: item.score,
            rank: currentRank,
            previous_rank: previousRank,
            rank_change: rankChange,
            score_change: scoreChange,
            total_answers: answerReport?.total_answers || INITIAL_TOTAL_ANSWERS,
            correct_answers: answerReport?.correct_answers || INITIAL_CORRECT_ANSWERS,
            accuracy:
              answerReport?.total_answers > INITIAL_TOTAL_ANSWERS
                ? Math.round(
                    (answerReport.correct_answers / answerReport.total_answers) *
                      ACCURACY_PERCENTAGE_MULTIPLIER,
                  )
                : DEFAULT_ACCURACY,
            is_host: player?.is_host || false,
            is_logged_in: !!player?.user_id,
          };
        },
      );

      const totalWithoutHosts = entries.length;

      return {
        game_id: gameId,
        entries,
        total: totalWithoutHosts,
        limit: query.limit,
        offset: query.offset,
        updated_at: new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ err, gameId }, LOG_MESSAGES.EXCEPTION_IN_GET_LEADERBOARD);
      return null;
    }
  }

  /**
   * Function: getPlayerStats
   * Description:
   * - Retrieves detailed player statistics for a game
   * - Calculates rank, accuracy, streaks, and timing statistics
   * - Returns comprehensive player performance data
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   *
   * Returns:
   * - Promise<PlayerStats | null>: Detailed player statistics or null on error
   *
   * Throws:
   * - Logs errors but returns null instead of throwing
   */
  async getPlayerStats(playerId: string, gameId: string): Promise<PlayerStats | null> {
    try {
      const { data, error } = await this.client
        .from(TABLE_GAME_PLAYER_DATA)
        .select(PLAYER_STATS_SELECT_QUERY)
        .eq(COLUMN_PLAYER_ID, playerId)
        .eq(COLUMN_GAME_ID, gameId)
        .single();

      if (error) {
        logger.error({ error, playerId, gameId }, LOG_MESSAGES.ERROR_FETCHING_STATS);
        return null;
      }

      const answerReport = data.answer_report as AnswerReport;
      const player = Array.isArray(data.players) ? data.players[0] : data.players;

      const { count: higherScores } = await this.client
        .from(TABLE_GAME_PLAYER_DATA)
        .select(SELECT_ALL, { count: 'exact', head: true })
        .eq(COLUMN_GAME_ID, gameId)
        .gt(COLUMN_SCORE, data.score);

      const rank = (higherScores || INITIAL_TOTAL_ANSWERS) + RANK_OFFSET;

      return {
        player_id: playerId,
        player_name: player?.player_name || UNKNOWN_PLAYER_NAME,
        score: data.score,
        rank,
        total_answers: answerReport?.total_answers || INITIAL_TOTAL_ANSWERS,
        correct_answers: answerReport?.correct_answers || INITIAL_CORRECT_ANSWERS,
        incorrect_answers: answerReport?.incorrect_answers || INITIAL_INCORRECT_ANSWERS,
        accuracy:
          answerReport?.total_answers > INITIAL_TOTAL_ANSWERS
            ? Math.round(
                (answerReport.correct_answers / answerReport.total_answers) *
                  ACCURACY_PERCENTAGE_MULTIPLIER,
              )
            : DEFAULT_ACCURACY,
        current_streak: answerReport?.streaks?.current_streak || INITIAL_TOTAL_ANSWERS,
        max_streak: answerReport?.streaks?.max_streak || INITIAL_TOTAL_ANSWERS,
        average_response_time: answerReport?.timing?.average_response_time || INITIAL_TOTAL_ANSWERS,
        fastest_response: answerReport?.timing?.fastest_response || INITIAL_TOTAL_ANSWERS,
        slowest_response: answerReport?.timing?.slowest_response || INITIAL_TOTAL_ANSWERS,
        questions: (answerReport?.questions || []).map((q) => ({
          question_id: q.question_id,
          question_number: q.question_number,
          is_correct: q.is_correct,
          time_taken: q.time_taken,
          points_earned: q.points_earned,
        })),
      };
    } catch (err) {
      logger.error({ err, playerId, gameId }, LOG_MESSAGES.EXCEPTION_IN_GET_STATS);
      return null;
    }
  }

  /**
   * Function: deleteGamePlayerData
   * Description:
   * - Deletes game player data for a specific player in a game
   * - Returns boolean indicating success or failure
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   *
   * Returns:
   * - Promise<boolean>: Success status
   *
   * Throws:
   * - Logs errors but returns false instead of throwing
   */
  async deleteGamePlayerData(playerId: string, gameId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(TABLE_GAME_PLAYER_DATA)
        .delete()
        .eq(COLUMN_PLAYER_ID, playerId)
        .eq(COLUMN_GAME_ID, gameId);

      if (error) {
        logger.error({ error, playerId, gameId }, LOG_MESSAGES.ERROR_DELETING_DATA);
        return false;
      }

      logger.info({ playerId, gameId }, LOG_MESSAGES.DATA_DELETED_SUCCESSFULLY);
      return true;
    } catch (err) {
      logger.error({ err, playerId, gameId }, LOG_MESSAGES.EXCEPTION_IN_DELETE);
      return false;
    }
  }

  //----------------------------------------------------
  // 5. Helper Functions
  //----------------------------------------------------

  /**
   * Method: validateAnswerContext
   * Description:
   * - Validates game and question existence
   * - Fetches play settings and correct answer
   * - Returns all context data needed for answer processing
   *
   * Parameters:
   * - gameId (string): The game ID
   * - questionId (string): The question ID
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult | { success: true; game: GameData; question: QuestionData; playSettings: PlaySettings; correctAnswer: { id: string } }>:
   *   Error result or success with all context data
   */
  private async validateAnswerContext(
    gameId: string,
    questionId: string,
  ): Promise<
    | GamePlayerDataUpdateResult
    | {
        success: true;
        game: GameData;
        question: QuestionData;
        playSettings: PlaySettings;
        correctAnswer: { id: string };
      }
  > {
    const validationResult = await this.validateGameAndQuestion(gameId, questionId);
    if (!validationResult.success) {
      return validationResult;
    }

    if (!('game' in validationResult) || !('question' in validationResult)) {
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }

    const { game, question } = validationResult;

    const playSettings = await this.fetchPlaySettings(game.quiz_set_id);
    const correctAnswerResult = await this.fetchCorrectAnswer(question.id);
    if (!correctAnswerResult.success) {
      return correctAnswerResult;
    }

    if (!('correctAnswer' in correctAnswerResult)) {
      return {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      };
    }

    return {
      success: true,
      game,
      question,
      playSettings,
      correctAnswer: correctAnswerResult.correctAnswer,
    };
  }

  /**
   * Method: processAnswerSubmission
   * Description:
   * - Processes answer submission (correctness, timing validation)
   * - Ensures player data exists
   * - Validates answer submission eligibility
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   * - answer (SubmitAnswerInput): The answer submission data
   * - context: Context data from validateAnswerContext
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult | { success: true; currentData: GamePlayerData; answerReport: AnswerReport; isCorrect: boolean; timeTakenSeconds: number; answeredInTime: boolean; answeringTime: number }>:
   *   Error result or success with processed answer data
   */
  private async processAnswerSubmission(
    playerId: string,
    gameId: string,
    answer: SubmitAnswerInput,
    context: {
      game: GameData;
      question: QuestionData;
      playSettings: PlaySettings;
      correctAnswer: { id: string };
    },
  ): Promise<
    | GamePlayerDataUpdateResult
    | {
        success: true;
        currentData: GamePlayerData;
        answerReport: AnswerReport;
        isCorrect: boolean;
        timeTakenSeconds: number;
        answeredInTime: boolean;
        answeringTime: number;
      }
  > {
    const { question, correctAnswer } = context;

    const isCorrect = answer.answer_id === correctAnswer.id;
    const timeTakenSeconds = Math.max(MIN_TIME_TAKEN_SECONDS, answer.time_taken);
    const answeringTime = question.answering_time || DEFAULT_ANSWERING_TIME_SECONDS;
    const answeredInTime = timeTakenSeconds <= answeringTime;
    const maxSubmissionTime = answeringTime * TIME_TOLERANCE_MULTIPLIER;

    if (timeTakenSeconds > maxSubmissionTime) {
      logger.warn(
        { timeTaken: timeTakenSeconds, answeringTime, gameId, playerId },
        LOG_MESSAGES.ANSWER_SUBMISSION_LATE,
      );
    }

    const playerDataResult = await this.ensurePlayerDataExists(playerId, gameId);
    if (!playerDataResult.success) {
      return playerDataResult;
    }

    if (!('data' in playerDataResult) || !playerDataResult.data) {
      return {
        success: false,
        error: ERROR_MESSAGES.PLAYER_DATA_NOT_FOUND,
      };
    }

    const currentData = playerDataResult.data;
    const answerReport: AnswerReport = currentData.answer_report as AnswerReport;

    const validationCheck = await this.validateAnswerSubmission(
      answerReport,
      answer.question_id,
      gameId,
    );
    if (!validationCheck.success) {
      return validationCheck;
    }

    return {
      success: true,
      currentData,
      answerReport,
      isCorrect,
      timeTakenSeconds,
      answeredInTime,
      answeringTime,
    };
  }

  /**
   * Method: calculateAnswerScore
   * Description:
   * - Calculates streak and points for the answer
   * - Updates answer report with new answer and statistics
   *
   * Parameters:
   * - answerProcessingResult: Result from processAnswerSubmission
   * - context: Context data from validateAnswerContext
   * - answer (SubmitAnswerInput): The answer submission data
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult | { success: true; updatedReport: AnswerReport; computedPoints: number; newScore: number; newRank: number; isCorrect: boolean }>:
   *   Error result or success with scoring data
   */
  private async calculateAnswerScore(
    answerProcessingResult: {
      currentData: GamePlayerData;
      answerReport: AnswerReport;
      isCorrect: boolean;
      timeTakenSeconds: number;
      answeredInTime: boolean;
      answeringTime: number;
    },
    context: {
      question: QuestionData;
      playSettings: PlaySettings;
    },
    answer: SubmitAnswerInput,
  ): Promise<
    | GamePlayerDataUpdateResult
    | {
        success: true;
        updatedReport: AnswerReport;
        computedPoints: number;
        newScore: number;
        newRank: number;
        isCorrect: boolean;
      }
  > {
    const {
      currentData,
      answerReport,
      isCorrect,
      timeTakenSeconds,
      answeredInTime,
      answeringTime,
    } = answerProcessingResult;
    const { question, playSettings } = context;

    const previousStreak = this.calculateCurrentStreak(answerReport.questions);
    const newStreak =
      isCorrect && answeredInTime ? previousStreak + RANK_OFFSET : INITIAL_TOTAL_ANSWERS;
    const basePoints = question.points || DEFAULT_BASE_POINTS;

    const computedPoints = this.calculatePoints(
      isCorrect,
      answeredInTime,
      basePoints,
      answeringTime,
      timeTakenSeconds,
      newStreak,
      playSettings,
    );

    const updatedReport = this.updateAnswerReport(
      answerReport,
      answer,
      isCorrect,
      timeTakenSeconds,
      computedPoints,
      newStreak,
    );

    const newScore = currentData.score + computedPoints;
    const newRank = await this.calculateRank(currentData.game_id, newScore);

    return {
      success: true,
      updatedReport,
      computedPoints,
      newScore,
      newRank,
      isCorrect,
    };
  }

  /**
   * Method: persistAnswerSubmission
   * Description:
   * - Updates rank tracking in answer report
   * - Saves player data update to database
   * - Aggregates answer statistics for all players
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   * - answer (SubmitAnswerInput): The answer submission data
   * - scoringResult: Result from calculateAnswerScore
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult | { success: true; data: GamePlayerData; answerStats: Record<string, number> }>:
   *   Error result or success with persisted data and statistics
   */
  private async persistAnswerSubmission(
    playerId: string,
    gameId: string,
    answer: SubmitAnswerInput,
    scoringResult: {
      updatedReport: AnswerReport;
      newScore: number;
      newRank: number;
    },
  ): Promise<
    | GamePlayerDataUpdateResult
    | {
        success: true;
        data: GamePlayerData;
        answerStats: Record<string, number>;
      }
  > {
    const previousReport = await this.getGamePlayerData(playerId, gameId);
    const previousAnswerReport = (previousReport?.answer_report as AnswerReport) || {
      total_answers: INITIAL_TOTAL_ANSWERS,
      correct_answers: INITIAL_CORRECT_ANSWERS,
      incorrect_answers: INITIAL_INCORRECT_ANSWERS,
      questions: [],
    };

    this.updateRankTracking(
      scoringResult.updatedReport,
      previousAnswerReport,
      scoringResult.newRank,
      scoringResult.newScore,
      answer.question_number,
    );

    const updateResult = await this.savePlayerDataUpdate(
      playerId,
      gameId,
      scoringResult.newScore,
      scoringResult.updatedReport,
    );
    if (!updateResult.success) {
      return updateResult;
    }

    const answerStats = await this.aggregateAnswerStats(gameId, answer.question_id);

    return {
      success: true,
      data: updateResult.data!,
      answerStats,
    };
  }

  /**
   * Function: validateGameAndQuestion
   * Description:
   * - Validates that game and question exist in database
   * - Fetches game data and question data
   *
   * Parameters:
   * - gameId (string): The game ID
   * - questionId (string): The question ID
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult | { success: true; game: GameData; question: QuestionData }>:
   *   Error result or success with game and question data
   */
  private async validateGameAndQuestion(
    gameId: string,
    questionId: string,
  ): Promise<
    GamePlayerDataUpdateResult | { success: true; game: GameData; question: QuestionData }
  > {
    const { data: game, error: gameError } = await supabaseAdmin
      .from(TABLE_GAMES)
      .select(GAME_SELECT_FIELDS)
      .eq(COLUMN_ID, gameId)
      .single();

    if (gameError || !game) {
      logger.error({ error: gameError, gameId }, LOG_MESSAGES.GAME_NOT_FOUND_FOR_ANSWER);
      return { success: false, error: ERROR_MESSAGES.GAME_NOT_FOUND };
    }

    const { data: question, error: questionError } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(QUESTION_SELECT_FIELDS)
      .eq(COLUMN_ID, questionId)
      .single();

    if (questionError || !question) {
      logger.error(
        { error: questionError, questionId },
        LOG_MESSAGES.QUESTION_NOT_FOUND_FOR_ANSWER,
      );
      return { success: false, error: ERROR_MESSAGES.QUESTION_NOT_FOUND };
    }

    return { success: true, game, question };
  }

  /**
   * Function: fetchPlaySettings
   * Description:
   * - Fetches quiz play settings (time_bonus, streak_bonus) from quiz set
   *
   * Parameters:
   * - quizId (string | null): The quiz set ID
   *
   * Returns:
   * - Promise<PlaySettings>: Play settings object with bonus flags
   */
  private async fetchPlaySettings(quizId: string | null): Promise<PlaySettings> {
    if (!quizId) {
      return {};
    }

    const { data: quiz, error: quizError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(COLUMN_PLAY_SETTINGS)
      .eq(COLUMN_ID, quizId)
      .maybeSingle();

    if (quizError || !quiz?.play_settings) {
      return {};
    }

    return quiz.play_settings as PlaySettings;
  }

  /**
   * Function: fetchCorrectAnswer
   * Description:
   * - Fetches the correct answer ID for a question
   *
   * Parameters:
   * - questionId (string): The question ID
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult | { success: true; correctAnswer: { id: string } }>:
   *   Error result or success with correct answer data
   */
  private async fetchCorrectAnswer(
    questionId: string,
  ): Promise<GamePlayerDataUpdateResult | { success: true; correctAnswer: { id: string } }> {
    const { data: correctAnswer, error: correctAnswerError } = await supabaseAdmin
      .from(TABLE_ANSWERS)
      .select(COLUMN_ID)
      .eq(COLUMN_QUESTION_ID, questionId)
      .eq(COLUMN_IS_CORRECT, true)
      .single();

    if (correctAnswerError || !correctAnswer) {
      logger.error(
        { error: correctAnswerError, questionId },
        LOG_MESSAGES.CORRECT_ANSWER_NOT_FOUND_FOR_QUESTION,
      );
      return { success: false, error: ERROR_MESSAGES.CORRECT_ANSWER_NOT_FOUND };
    }

    return { success: true, correctAnswer };
  }

  /**
   * Function: ensurePlayerDataExists
   * Description:
   * - Ensures player data exists, creating it if missing
   * - Handles automatic creation when player data is not found
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult | { success: true; data: GamePlayerData }>:
   *   Error result or success with player data
   */
  private async ensurePlayerDataExists(
    playerId: string,
    gameId: string,
  ): Promise<GamePlayerDataUpdateResult | { success: true; data: GamePlayerData }> {
    const { data: initialData, error: fetchError } = await this.client
      .from(TABLE_GAME_PLAYER_DATA)
      .select(SELECT_ALL)
      .eq(COLUMN_PLAYER_ID, playerId)
      .eq(COLUMN_GAME_ID, gameId)
      .single();

    let currentData = initialData;

    if (fetchError && fetchError.code === SUPABASE_NOT_FOUND_ERROR_CODE) {
      logger.warn({ playerId, gameId }, LOG_MESSAGES.DATA_NOT_FOUND_CREATING);

      const { data: player, error: playerError } = await this.client
        .from(TABLE_PLAYERS)
        .select(PLAYER_SELECT_DEVICE_ID)
        .eq(COLUMN_ID, playerId)
        .eq(COLUMN_GAME_ID, gameId)
        .single();

      if (playerError || !player) {
        logger.error(
          { error: playerError, playerId, gameId },
          LOG_MESSAGES.PLAYER_NOT_FOUND_FOR_DATA,
        );
        return {
          success: false,
          error: ERROR_MESSAGES.PLAYER_NOT_FOUND,
        };
      }

      const createResult = await this.createGamePlayerData({
        player_id: playerId,
        game_id: gameId,
        player_device_id: player.device_id,
        score: DEFAULT_SCORE,
        answer_report: DEFAULT_ANSWER_REPORT,
      });

      if (!createResult.success) {
        logger.error(
          { error: createResult.error, playerId, gameId },
          LOG_MESSAGES.FAILED_CREATE_DATA_AUTO,
        );
        return {
          success: false,
          error: createResult.error || ERROR_MESSAGES.FAILED_TO_INITIALIZE,
        };
      }

      currentData = createResult.data;
      logger.info({ playerId, gameId }, LOG_MESSAGES.DATA_CREATED_AUTO);
    } else if (fetchError || !currentData) {
      logger.error(
        { error: fetchError, playerId, gameId },
        LOG_MESSAGES.ERROR_FETCHING_DATA_FOR_ANSWER,
      );
      return {
        success: false,
        error: ERROR_MESSAGES.PLAYER_DATA_NOT_FOUND,
      };
    }

    return { success: true, data: currentData };
  }

  /**
   * Function: validateAnswerSubmission
   * Description:
   * - Validates answer submission (checks for duplicates and timing)
   * - Rejects if question already answered or if question has ended
   *
   * Parameters:
   * - answerReport (AnswerReport): Current answer report
   * - questionId (string): The question ID
   * - gameId (string): The game ID
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult | { success: true }>:
   *   Error result or success
   */
  private async validateAnswerSubmission(
    answerReport: AnswerReport,
    questionId: string,
    gameId: string,
  ): Promise<GamePlayerDataUpdateResult | { success: true }> {
    const alreadyAnswered =
      answerReport.questions?.some((q) => q.question_id === questionId) ?? false;
    if (alreadyAnswered) {
      return {
        success: false,
        error: ERROR_MESSAGES.QUESTION_ALREADY_ANSWERED,
      };
    }

    const { gameFlowService } = await import('../services/gameFlowService');
    const flowResult = await gameFlowService.getGameFlow(gameId);
    if (flowResult.success && flowResult.gameFlow) {
      const gameFlow = flowResult.gameFlow;
      if (gameFlow.current_question_id === questionId && gameFlow.current_question_end_time) {
        const endTime = new Date(gameFlow.current_question_end_time).getTime();
        const now = Date.now();
        if (now > endTime + GRACE_PERIOD_MS) {
          logger.warn(
            { gameId, questionId, endTime, now },
            LOG_MESSAGES.ANSWER_REJECTED_QUESTION_ENDED,
          );
          return {
            success: false,
            error: ERROR_MESSAGES.QUESTION_ENDED,
          };
        }
      }
    }

    return { success: true };
  }

  /**
   * Function: calculateCurrentStreak
   * Description:
   * - Calculates current streak from trailing correct answers
   * - Counts consecutive correct answers from the end of the questions array
   *
   * Parameters:
   * - questions (AnswerReport['questions']): Array of answered questions
   *
   * Returns:
   * - number: Current streak count
   */
  private calculateCurrentStreak(questions: AnswerReport['questions'] = []): number {
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
  }

  /**
   * Function: calculatePoints
   * Description:
   * - Calculates points earned for an answer
   * - Applies time bonus and streak bonus if enabled
   * - Formula: basePoints - (timeTaken * (basePoints / answeringTime)) for time bonus
   * - Streak multiplier: 1 + min(0.5, streak * 0.1) for streak bonus
   *
   * Parameters:
   * - isCorrect (boolean): Whether answer is correct
   * - answeredInTime (boolean): Whether answer was submitted in time
   * - basePoints (number): Base points for the question
   * - answeringTime (number): Allowed time in seconds
   * - timeTakenSeconds (number): Time taken in seconds
   * - newStreak (number): New streak count after this answer
   * - playSettings (PlaySettings): Play settings with bonus flags
   *
   * Returns:
   * - number: Calculated points (0 if incorrect or not in time)
   */
  private calculatePoints(
    isCorrect: boolean,
    answeredInTime: boolean,
    basePoints: number,
    answeringTime: number,
    timeTakenSeconds: number,
    newStreak: number,
    playSettings: PlaySettings,
  ): number {
    if (!isCorrect || !answeredInTime) {
      return MIN_POINTS;
    }

    const timeBonusEnabled = !!playSettings.time_bonus;
    const streakBonusEnabled = !!playSettings.streak_bonus;

    let timeAdjusted = basePoints;
    if (timeBonusEnabled) {
      const timePenaltyFactor = basePoints / answeringTime;
      const timePenalty = Math.min(timeTakenSeconds * timePenaltyFactor, basePoints);
      timeAdjusted = Math.max(MIN_POINTS, basePoints - timePenalty);
    }

    const streakMultiplier = streakBonusEnabled
      ? STREAK_MULTIPLIER_BASE + Math.min(MAX_STREAK_BONUS, newStreak * STREAK_BONUS_PER_STREAK)
      : STREAK_MULTIPLIER_BASE;

    return Math.max(MIN_POINTS, Math.round(timeAdjusted * streakMultiplier));
  }

  /**
   * Function: updateAnswerReport
   * Description:
   * - Updates answer report with new answer and statistics
   * - Calculates streaks and timing statistics
   *
   * Parameters:
   * - answerReport (AnswerReport): Current answer report
   * - answer (SubmitAnswerInput): Answer submission data
   * - isCorrect (boolean): Whether answer is correct
   * - timeTakenSeconds (number): Time taken in seconds
   * - computedPoints (number): Points earned
   * - newStreak (number): New streak count
   *
   * Returns:
   * - AnswerReport: Updated answer report
   */
  private updateAnswerReport(
    answerReport: AnswerReport,
    answer: SubmitAnswerInput,
    isCorrect: boolean,
    timeTakenSeconds: number,
    computedPoints: number,
    newStreak: number,
  ): AnswerReport {
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

    const questions = updatedReport.questions;
    const previousMaxStreak = answerReport.streaks?.max_streak || 0;
    const maxStreak = Math.max(previousMaxStreak, newStreak);

    updatedReport.streaks = {
      current_streak: newStreak,
      max_streak: maxStreak,
    };

    const responseTimes = questions.map((q) => q.time_taken);
    updatedReport.timing = {
      average_response_time:
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      fastest_response: Math.min(...responseTimes),
      slowest_response: Math.max(...responseTimes),
    };

    return updatedReport;
  }

  /**
   * Function: calculateRank
   * Description:
   * - Calculates player rank based on score
   * - Counts players with higher scores
   *
   * Parameters:
   * - gameId (string): The game ID
   * - score (number): Player's score
   *
   * Returns:
   * - Promise<number>: Player rank (1-based)
   */
  private async calculateRank(gameId: string, score: number): Promise<number> {
    const { count: newHigherScores } = await this.client
      .from(TABLE_GAME_PLAYER_DATA)
      .select(SELECT_ALL, { count: 'exact', head: true })
      .eq(COLUMN_GAME_ID, gameId)
      .gt(COLUMN_SCORE, score);
    return (newHigherScores || INITIAL_TOTAL_ANSWERS) + RANK_OFFSET;
  }

  /**
   * Function: updateRankTracking
   * Description:
   * - Updates rank tracking in answer report
   * - Stores previous rank, current rank, and rank history
   *
   * Parameters:
   * - updatedReport (AnswerReport): Answer report to update
   * - answerReport (AnswerReport): Previous answer report
   * - newRank (number): New calculated rank
   * - newScore (number): New total score
   * - questionNumber (number): Question number for rank history
   *
   * Returns:
   * - void: Modifies updatedReport in place
   */
  private updateRankTracking(
    updatedReport: AnswerReport,
    answerReport: AnswerReport,
    newRank: number,
    newScore: number,
    questionNumber: number,
  ): void {
    const existingCurrentRank = answerReport?.current_rank;
    let previousRank: number | undefined;

    if (existingCurrentRank !== undefined) {
      previousRank = existingCurrentRank;
    }

    if (previousRank !== undefined) {
      updatedReport.previous_rank = previousRank;
    }

    updatedReport.current_rank = newRank;
    const existingHistory = (answerReport.rank_history || []) as AnswerReport['rank_history'];
    const lastQuestion = updatedReport.questions[updatedReport.questions.length - 1];
    if (lastQuestion) {
      updatedReport.rank_history = [
        ...(existingHistory || []),
        {
          question_number: questionNumber,
          rank: newRank,
          score: newScore,
          points_earned: lastQuestion.points_earned,
          timestamp: new Date().toISOString(),
        },
      ];
    }
  }

  /**
   * Function: savePlayerDataUpdate
   * Description:
   * - Saves updated player data to database
   *
   * Parameters:
   * - playerId (string): The player ID
   * - gameId (string): The game ID
   * - newScore (number): New score
   * - updatedReport (AnswerReport): Updated answer report
   *
   * Returns:
   * - Promise<GamePlayerDataUpdateResult>: Result with updated data or error
   */
  private async savePlayerDataUpdate(
    playerId: string,
    gameId: string,
    newScore: number,
    updatedReport: AnswerReport,
  ): Promise<GamePlayerDataUpdateResult> {
    const { data: updatedData, error: updateError } = await this.client
      .from(TABLE_GAME_PLAYER_DATA)
      .update({
        [COLUMN_SCORE]: newScore,
        [COLUMN_ANSWER_REPORT]: updatedReport,
      })
      .eq(COLUMN_PLAYER_ID, playerId)
      .eq(COLUMN_GAME_ID, gameId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, playerId, gameId }, LOG_MESSAGES.ERROR_UPDATING_DATA);
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_UPDATE,
      };
    }

    return {
      success: true,
      data: updatedData,
    };
  }

  /**
   * Function: aggregateAnswerStats
   * Description:
   * - Aggregates per-choice answer counts for a question across all players
   *
   * Parameters:
   * - gameId (string): The game ID
   * - questionId (string): The question ID
   *
   * Returns:
   * - Promise<Record<string, number>>: Map of answer_id to count
   */
  private async aggregateAnswerStats(
    gameId: string,
    questionId: string,
  ): Promise<Record<string, number>> {
    const { data: allReports, error: reportsError } = await this.client
      .from(TABLE_GAME_PLAYER_DATA)
      .select(COLUMN_ANSWER_REPORT)
      .eq(COLUMN_GAME_ID, gameId);

    if (reportsError || !allReports) {
      return {};
    }

    return (allReports as { answer_report: AnswerReport }[]).reduce(
      (acc, row) => {
        const report = row.answer_report as AnswerReport;
        (report.questions || []).forEach((q) => {
          if (q.question_id === questionId && q.answer_id) {
            acc[q.answer_id] = (acc[q.answer_id] || 0) + 1;
          }
        });
        return acc;
      },
      {} as Record<string, number>,
    );
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------

// Export singleton instance
export const gamePlayerDataService = new GamePlayerDataService();
