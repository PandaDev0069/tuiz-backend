// src/routes/game-player-data.ts
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

const router = express.Router();

/**
 * POST /games/:gameId/players/:playerId/data
 * Initialize player data for a game
 * Public access (automatically created when player joins)
 */
router.post('/:gameId/players/:playerId/data', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId, playerId } = req.params;

  try {
    // Validate input
    const input = CreateGamePlayerDataSchema.parse({
      ...req.body,
      game_id: gameId,
      player_id: playerId,
    });

    // Create the game player data
    const result = await gamePlayerDataService.createGamePlayerData(input);

    if (!result.success) {
      const statusCode = result.error === 'Player data already exists for this game' ? 409 : 400;
      return res.status(statusCode).json({
        error: 'data_creation_failed',
        message: result.error,
        requestId,
      });
    }

    return res.status(201).json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, playerId, requestId }, 'Validation error creating player data');
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Invalid player data',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, playerId, requestId }, 'Error creating player data');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to create player data',
      requestId,
    });
  }
});

/**
 * POST /games/:gameId/players/:playerId/answer
 * Submit an answer for a player
 * Public access (players can submit their own answers)
 */
router.post('/:gameId/players/:playerId/answer', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId, playerId } = req.params;
  // IMPORTANT: bind to preserve `this` inside WebSocketManager (otherwise `this` becomes undefined)
  const wsManager = requireWebSocketManager();
  const broadcast = wsManager.broadcastToRoom.bind(wsManager) as (
    roomId: string,
    event: string,
    payload: unknown,
  ) => void;

  try {
    // Validate input
    const answer = SubmitAnswerSchema.parse(req.body);

    // Submit the answer
    const result = await gamePlayerDataService.submitAnswer(playerId, gameId, answer);

    if (!result.success) {
      const statusCode = result.error === 'Player data not found' ? 404 : 400;
      return res.status(statusCode).json({
        error: 'answer_submission_failed',
        message: result.error,
        requestId,
      });
    }

    // Broadcast per-choice counts for this question (best-effort)
    // Wrap in try-catch to prevent broadcast errors from affecting the response
    if (result.answerStats) {
      try {
        // Emit both event names for compatibility (frontend listens to both)
        broadcast(gameId, 'game:answer:stats', {
          roomId: gameId,
          questionId: answer.question_id,
          counts: result.answerStats,
        });
        broadcast(gameId, 'game:answer:stats:update', {
          roomId: gameId,
          questionId: answer.question_id,
          counts: result.answerStats,
        });
      } catch (broadcastError) {
        // Log but don't fail the request - answer was already submitted successfully
        const errorDetails =
          broadcastError instanceof Error
            ? {
                message: broadcastError.message,
                stack: broadcastError.stack,
                name: broadcastError.name,
              }
            : { error: String(broadcastError) };
        logger.warn(
          { ...errorDetails, gameId, playerId, questionId: answer.question_id },
          'Failed to broadcast answer stats (answer was still submitted successfully)',
        );
      }
    }

    // Return response - answer was submitted successfully
    // Note: result.data is the updated game_player_data row from Supabase
    return res.status(200).json({
      ...result.data,
      answer_stats: result.answerStats,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, playerId, requestId }, 'Validation error submitting answer');
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Invalid answer data',
        details: error.issues,
        requestId,
      });
    }

    // Log error with more details
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
      gameId,
      playerId,
      requestId,
    };
    logger.error(errorDetails, 'Error submitting answer');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to submit answer',
      requestId,
    });
  }
});

/**
 * GET /games/:gameId/players/:playerId/data
 * Get player data for a game
 * Public access (for viewing player stats)
 */
router.get('/:gameId/players/:playerId/data', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId, playerId } = req.params;

  try {
    const data = await gamePlayerDataService.getGamePlayerData(playerId, gameId);

    if (!data) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Player data not found',
        requestId,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    logger.error({ error, gameId, playerId, requestId }, 'Error fetching player data');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch player data',
      requestId,
    });
  }
});

/**
 * GET /games/:gameId/players/:playerId/stats
 * Get detailed player statistics
 * Public access (for viewing detailed stats)
 */
router.get('/:gameId/players/:playerId/stats', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId, playerId } = req.params;

  try {
    const stats = await gamePlayerDataService.getPlayerStats(playerId, gameId);

    if (!stats) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Player stats not found',
        requestId,
      });
    }

    return res.status(200).json(stats);
  } catch (error) {
    logger.error({ error, gameId, playerId, requestId }, 'Error fetching player stats');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch player stats',
      requestId,
    });
  }
});

/**
 * PATCH /games/:gameId/players/:playerId/data
 * Update player data manually
 * Requires authentication (admin or host)
 */
router.patch(
  '/:gameId/players/:playerId/data',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { gameId, playerId } = req.params;

    try {
      // Validate input
      const updates = UpdateGamePlayerDataSchema.parse(req.body);

      // Update the player data
      const result = await gamePlayerDataService.updateGamePlayerData(playerId, gameId, updates);

      if (!result.success) {
        const statusCode = result.error === 'No updates provided' ? 400 : 500;
        return res.status(statusCode).json({
          error: 'data_update_failed',
          message: result.error,
          requestId,
        });
      }

      return res.status(200).json(result.data);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn(
          { error, gameId, playerId, requestId },
          'Validation error updating player data',
        );
        return res.status(400).json({
          error: 'invalid_payload',
          message: 'Invalid update data',
          details: error.issues,
          requestId,
        });
      }

      logger.error({ error, gameId, playerId, requestId }, 'Error updating player data');
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to update player data',
        requestId,
      });
    }
  },
);

/**
 * DELETE /games/:gameId/players/:playerId/data
 * Delete player data
 * Requires authentication (admin or host)
 */
router.delete(
  '/:gameId/players/:playerId/data',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { gameId, playerId } = req.params;

    try {
      const success = await gamePlayerDataService.deleteGamePlayerData(playerId, gameId);

      if (!success) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Player data not found',
          requestId,
        });
      }

      return res.status(204).send();
    } catch (error) {
      logger.error({ error, gameId, playerId, requestId }, 'Error deleting player data');
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to delete player data',
        requestId,
      });
    }
  },
);

/**
 * GET /games/:gameId/leaderboard
 * Get game leaderboard with player rankings
 * Public access (for viewing leaderboard)
 */
router.get('/:gameId/leaderboard', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    // Validate query parameters
    const query = LeaderboardQuerySchema.parse(req.query);

    // Fetch leaderboard
    const leaderboard = await gamePlayerDataService.getLeaderboard(gameId, query);

    if (!leaderboard) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found or no leaderboard data available',
        requestId,
      });
    }

    return res.status(200).json(leaderboard);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, 'Validation error fetching leaderboard');
      return res.status(400).json({
        error: 'invalid_query',
        message: 'Invalid query parameters',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, 'Error fetching leaderboard');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch leaderboard',
      requestId,
    });
  }
});

export default router;
