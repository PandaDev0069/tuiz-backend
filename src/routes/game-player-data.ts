// ====================================================
// File Name   : game-player-data.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2026-01-03

// Description:
// - Express router for game player data management endpoints
// - Handles CRUD operations for player data in games
// - Manages answer submissions and leaderboard retrieval
// - Provides endpoints for player statistics and data updates

// Notes:
// - Some endpoints are public (no auth required) for player access
// - Protected endpoints require authentication via authMiddleware
// - Uses Zod schemas for request validation
// - Broadcasts WebSocket events for real-time answer statistics
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { ZodError } from 'zod';

import { authMiddleware } from '../middleware/auth';
import { gamePlayerDataService } from '../services/gamePlayerDataService';
import { requireWebSocketManager } from '../services/websocket';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateGamePlayerDataSchema,
  LeaderboardQuerySchema,
  SubmitAnswerSchema,
  UpdateGamePlayerDataSchema,
} from '../types/gamePlayerData';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_NO_CONTENT = 204;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const ERROR_CODES = {
  DATA_CREATION_FAILED: 'data_creation_failed',
  INVALID_PAYLOAD: 'invalid_payload',
  SERVER_ERROR: 'server_error',
  ANSWER_SUBMISSION_FAILED: 'answer_submission_failed',
  NOT_FOUND: 'not_found',
  DATA_UPDATE_FAILED: 'data_update_failed',
  INVALID_QUERY: 'invalid_query',
} as const;

const ERROR_MESSAGES = {
  PLAYER_DATA_ALREADY_EXISTS: 'Player data already exists for this game',
  INVALID_PLAYER_DATA: 'Invalid player data',
  FAILED_TO_CREATE_PLAYER_DATA: 'Failed to create player data',
  PLAYER_DATA_NOT_FOUND: 'Player data not found',
  INVALID_ANSWER_DATA: 'Invalid answer data',
  FAILED_TO_SUBMIT_ANSWER: 'Failed to submit answer',
  FAILED_TO_FETCH_PLAYER_DATA: 'Failed to fetch player data',
  PLAYER_STATS_NOT_FOUND: 'Player stats not found',
  FAILED_TO_FETCH_PLAYER_STATS: 'Failed to fetch player stats',
  NO_UPDATES_PROVIDED: 'No updates provided',
  INVALID_UPDATE_DATA: 'Invalid update data',
  FAILED_TO_UPDATE_PLAYER_DATA: 'Failed to update player data',
  FAILED_TO_DELETE_PLAYER_DATA: 'Failed to delete player data',
  GAME_NOT_FOUND_OR_NO_LEADERBOARD: 'Game not found or no leaderboard data available',
  INVALID_QUERY_PARAMETERS: 'Invalid query parameters',
  FAILED_TO_FETCH_LEADERBOARD: 'Failed to fetch leaderboard',
} as const;

const LOG_MESSAGES = {
  VALIDATION_ERROR_CREATING_PLAYER_DATA: 'Validation error creating player data',
  ERROR_CREATING_PLAYER_DATA: 'Error creating player data',
  VALIDATION_ERROR_SUBMITTING_ANSWER: 'Validation error submitting answer',
  FAILED_TO_BROADCAST_ANSWER_STATS:
    'Failed to broadcast answer stats (answer was still submitted successfully)',
  ERROR_SUBMITTING_ANSWER: 'Error submitting answer',
  ERROR_FETCHING_PLAYER_DATA: 'Error fetching player data',
  ERROR_FETCHING_PLAYER_STATS: 'Error fetching player stats',
  VALIDATION_ERROR_UPDATING_PLAYER_DATA: 'Validation error updating player data',
  ERROR_UPDATING_PLAYER_DATA: 'Error updating player data',
  ERROR_DELETING_PLAYER_DATA: 'Error deleting player data',
  VALIDATION_ERROR_FETCHING_LEADERBOARD: 'Validation error fetching leaderboard',
  ERROR_FETCHING_LEADERBOARD: 'Error fetching leaderboard',
} as const;

const WEBSOCKET_EVENTS = {
  GAME_ANSWER_STATS: 'game:answer:stats',
  GAME_ANSWER_STATS_UPDATE: 'game:answer:stats:update',
} as const;

const REQUEST_BODY_KEYS = {
  GAME_ID: 'game_id',
  PLAYER_ID: 'player_id',
} as const;

const RESPONSE_KEYS = {
  ANSWER_STATS: 'answer_stats',
  ROOM_ID: 'roomId',
  QUESTION_ID: 'questionId',
  COUNTS: 'counts',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = express.Router();

/**
 * Route: POST /:gameId/players/:playerId/data
 * Description:
 * - Initialize player data for a game
 * - Public access (automatically created when player joins)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.playerId: Player identifier
 * - req.body: Player data (validated by CreateGamePlayerDataSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with created player data or error details
 */
router.post('/:gameId/players/:playerId/data', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId, playerId } = req.params;

  try {
    const input = CreateGamePlayerDataSchema.parse({
      ...req.body,
      [REQUEST_BODY_KEYS.GAME_ID]: gameId,
      [REQUEST_BODY_KEYS.PLAYER_ID]: playerId,
    });

    const result = await gamePlayerDataService.createGamePlayerData(input);

    if (!result.success) {
      const statusCode =
        result.error === ERROR_MESSAGES.PLAYER_DATA_ALREADY_EXISTS
          ? HTTP_STATUS_CONFLICT
          : HTTP_STATUS_BAD_REQUEST;
      return res.status(statusCode).json({
        error: ERROR_CODES.DATA_CREATION_FAILED,
        message: result.error,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_CREATED).json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { error, gameId, playerId, requestId },
        LOG_MESSAGES.VALIDATION_ERROR_CREATING_PLAYER_DATA,
      );
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.INVALID_PLAYER_DATA,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, playerId, requestId }, LOG_MESSAGES.ERROR_CREATING_PLAYER_DATA);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_CREATE_PLAYER_DATA,
      requestId,
    });
  }
});

/**
 * Route: POST /:gameId/players/:playerId/answer
 * Description:
 * - Submit an answer for a player
 * - Broadcasts WebSocket events for real-time answer statistics
 * - Public access (players can submit their own answers)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.playerId: Player identifier
 * - req.body: Answer data (validated by SubmitAnswerSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with updated player data and answer statistics
 */
router.post('/:gameId/players/:playerId/answer', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId, playerId } = req.params;

  const wsManager = requireWebSocketManager();
  const broadcast = wsManager.broadcastToRoom.bind(wsManager) as (
    roomId: string,
    event: string,
    payload: unknown,
  ) => void;

  try {
    const answer = SubmitAnswerSchema.parse(req.body);

    const result = await gamePlayerDataService.submitAnswer(playerId, gameId, answer);

    if (!result.success) {
      const statusCode =
        result.error === ERROR_MESSAGES.PLAYER_DATA_NOT_FOUND
          ? HTTP_STATUS_NOT_FOUND
          : HTTP_STATUS_BAD_REQUEST;
      return res.status(statusCode).json({
        error: ERROR_CODES.ANSWER_SUBMISSION_FAILED,
        message: result.error,
        requestId,
      });
    }

    if (result.answerStats) {
      await broadcastAnswerStats(
        gameId,
        playerId,
        answer.question_id,
        result.answerStats,
        broadcast,
      );
    }

    return res.status(HTTP_STATUS_OK).json({
      ...result.data,
      [RESPONSE_KEYS.ANSWER_STATS]: result.answerStats,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { error, gameId, playerId, requestId },
        LOG_MESSAGES.VALIDATION_ERROR_SUBMITTING_ANSWER,
      );
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.INVALID_ANSWER_DATA,
        details: error.issues,
        requestId,
      });
    }

    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
      gameId,
      playerId,
      requestId,
    };
    logger.error(errorDetails, LOG_MESSAGES.ERROR_SUBMITTING_ANSWER);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_SUBMIT_ANSWER,
      requestId,
    });
  }
});

/**
 * Route: GET /:gameId/players/:playerId/data
 * Description:
 * - Get player data for a game
 * - Public access (for viewing player stats)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.playerId: Player identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with player data or error details
 */
router.get('/:gameId/players/:playerId/data', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId, playerId } = req.params;

  try {
    const data = await gamePlayerDataService.getGamePlayerData(playerId, gameId);

    if (!data) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.PLAYER_DATA_NOT_FOUND,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(data);
  } catch (error) {
    logger.error({ error, gameId, playerId, requestId }, LOG_MESSAGES.ERROR_FETCHING_PLAYER_DATA);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PLAYER_DATA,
      requestId,
    });
  }
});

/**
 * Route: GET /:gameId/players/:playerId/stats
 * Description:
 * - Get detailed player statistics
 * - Public access (for viewing detailed stats)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.playerId: Player identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with player statistics or error details
 */
router.get('/:gameId/players/:playerId/stats', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId, playerId } = req.params;

  try {
    const stats = await gamePlayerDataService.getPlayerStats(playerId, gameId);

    if (!stats) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.PLAYER_STATS_NOT_FOUND,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(stats);
  } catch (error) {
    logger.error({ error, gameId, playerId, requestId }, LOG_MESSAGES.ERROR_FETCHING_PLAYER_STATS);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PLAYER_STATS,
      requestId,
    });
  }
});

/**
 * Route: PATCH /:gameId/players/:playerId/data
 * Description:
 * - Update player data manually
 * - Requires authentication (admin or host)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.playerId: Player identifier
 * - req.body: Update data (validated by UpdateGamePlayerDataSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with updated player data or error details
 */
router.patch(
  '/:gameId/players/:playerId/data',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = (req.headers['x-request-id'] as string) || '';
    const { gameId, playerId } = req.params;

    try {
      const updates = UpdateGamePlayerDataSchema.parse(req.body);

      const result = await gamePlayerDataService.updateGamePlayerData(playerId, gameId, updates);

      if (!result.success) {
        const statusCode =
          result.error === ERROR_MESSAGES.NO_UPDATES_PROVIDED
            ? HTTP_STATUS_BAD_REQUEST
            : HTTP_STATUS_INTERNAL_SERVER_ERROR;
        return res.status(statusCode).json({
          error: ERROR_CODES.DATA_UPDATE_FAILED,
          message: result.error,
          requestId,
        });
      }

      return res.status(HTTP_STATUS_OK).json(result.data);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn(
          { error, gameId, playerId, requestId },
          LOG_MESSAGES.VALIDATION_ERROR_UPDATING_PLAYER_DATA,
        );
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_PAYLOAD,
          message: ERROR_MESSAGES.INVALID_UPDATE_DATA,
          details: error.issues,
          requestId,
        });
      }

      logger.error({ error, gameId, playerId, requestId }, LOG_MESSAGES.ERROR_UPDATING_PLAYER_DATA);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_UPDATE_PLAYER_DATA,
        requestId,
      });
    }
  },
);

/**
 * Route: DELETE /:gameId/players/:playerId/data
 * Description:
 * - Delete player data
 * - Requires authentication (admin or host)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.playerId: Player identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - No content response (204) or error details
 */
router.delete(
  '/:gameId/players/:playerId/data',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = (req.headers['x-request-id'] as string) || '';
    const { gameId, playerId } = req.params;

    try {
      const success = await gamePlayerDataService.deleteGamePlayerData(playerId, gameId);

      if (!success) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.PLAYER_DATA_NOT_FOUND,
          requestId,
        });
      }

      return res.status(HTTP_STATUS_NO_CONTENT).send();
    } catch (error) {
      logger.error({ error, gameId, playerId, requestId }, LOG_MESSAGES.ERROR_DELETING_PLAYER_DATA);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_DELETE_PLAYER_DATA,
        requestId,
      });
    }
  },
);

/**
 * Route: GET /:gameId/leaderboard
 * Description:
 * - Get game leaderboard with player rankings
 * - Public access (for viewing leaderboard)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.query: Query parameters (validated by LeaderboardQuerySchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with leaderboard data or error details
 */
router.get('/:gameId/leaderboard', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId } = req.params;

  try {
    const query = LeaderboardQuerySchema.parse(req.query);

    const leaderboard = await gamePlayerDataService.getLeaderboard(gameId, query);

    if (!leaderboard) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.GAME_NOT_FOUND_OR_NO_LEADERBOARD,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(leaderboard);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, LOG_MESSAGES.VALIDATION_ERROR_FETCHING_LEADERBOARD);
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_QUERY,
        message: ERROR_MESSAGES.INVALID_QUERY_PARAMETERS,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, LOG_MESSAGES.ERROR_FETCHING_LEADERBOARD);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_LEADERBOARD,
      requestId,
    });
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: broadcastAnswerStats
 * Description:
 * - Broadcast answer statistics via WebSocket events
 * - Emits both event names for compatibility
 * - Does not fail if broadcast fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - playerId (string): Player identifier
 * - questionId (string): Question identifier
 * - answerStats (Record<string, number>): Answer statistics
 * - broadcast (function): WebSocket broadcast function
 *
 * Returns:
 * - void: No return value
 */
async function broadcastAnswerStats(
  gameId: string,
  playerId: string,
  questionId: string,
  answerStats: Record<string, number>,
  broadcast: (roomId: string, event: string, payload: unknown) => void,
): Promise<void> {
  try {
    broadcast(gameId, WEBSOCKET_EVENTS.GAME_ANSWER_STATS, {
      [RESPONSE_KEYS.ROOM_ID]: gameId,
      [RESPONSE_KEYS.QUESTION_ID]: questionId,
      [RESPONSE_KEYS.COUNTS]: answerStats,
    });
    broadcast(gameId, WEBSOCKET_EVENTS.GAME_ANSWER_STATS_UPDATE, {
      [RESPONSE_KEYS.ROOM_ID]: gameId,
      [RESPONSE_KEYS.QUESTION_ID]: questionId,
      [RESPONSE_KEYS.COUNTS]: answerStats,
    });
  } catch (broadcastError) {
    const errorDetails =
      broadcastError instanceof Error
        ? {
            message: broadcastError.message,
            stack: broadcastError.stack,
            name: broadcastError.name,
          }
        : { error: String(broadcastError) };
    logger.warn(
      { ...errorDetails, gameId, playerId, questionId },
      LOG_MESSAGES.FAILED_TO_BROADCAST_ANSWER_STATS,
    );
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
