// src/routes/players.ts
import express from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { playerService } from '../services/playerService';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreatePlayerSchema,
  JoinGameSchema,
  PlayerQuerySchema,
  UpdatePlayerSchema,
} from '../types/player';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /games/:gameId/players
 * Add a new player to the game (join game)
 * Public access for guest players
 */
router.post('/:gameId/players', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    // Validate input
    const input = CreatePlayerSchema.parse({
      ...req.body,
      game_id: gameId,
    });

    // Create the player
    const result = await playerService.createPlayer(input);

    if (!result.success) {
      let statusCode = 400;
      if (result.error === 'Game not found') {
        statusCode = 404;
      } else if (
        result.error === 'Game is locked and not accepting new players' ||
        result.error === 'Game is not accepting players' ||
        result.error === 'Player already joined this game'
      ) {
        statusCode = 409; // Conflict
      }

      return res.status(statusCode).json({
        error: 'player_creation_failed',
        message: result.error,
        requestId,
      });
    }

    return res.status(201).json(result.player);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, 'Validation error creating player');
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Invalid player data',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, 'Error creating player');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to create player',
      requestId,
    });
  }
});

/**
 * POST /games/:gameId/join
 * Simplified join endpoint for guest players
 * Public access
 */
router.post('/:gameId/join', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    // Validate input
    const input = JoinGameSchema.parse(req.body);

    // Create the player with guest defaults
    const result = await playerService.createPlayer({
      game_id: gameId,
      device_id: input.device_id,
      player_name: input.player_name,
      is_logged_in: false,
      is_host: false,
    });

    if (!result.success) {
      let statusCode = 400;
      if (result.error === 'Game not found') {
        statusCode = 404;
      } else if (
        result.error === 'Game is locked and not accepting new players' ||
        result.error === 'Game is not accepting players' ||
        result.error === 'Player already joined this game'
      ) {
        statusCode = 409; // Conflict
      }

      return res.status(statusCode).json({
        error: 'join_game_failed',
        message: result.error,
        requestId,
      });
    }

    return res.status(201).json({
      success: true,
      player: result.player,
      message: 'Successfully joined game',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, 'Validation error joining game');
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Invalid join data',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, 'Error joining game');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to join game',
      requestId,
    });
  }
});

/**
 * GET /games/:gameId/players
 * Get all players in a game with filtering and pagination
 * Public access (for viewing player list)
 */
router.get('/:gameId/players', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    // Validate query parameters
    const query = PlayerQuerySchema.parse(req.query);

    // Fetch players
    const result = await playerService.getPlayers(gameId, query);

    if (!result) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found or no players available',
        requestId,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, 'Validation error fetching players');
      return res.status(400).json({
        error: 'invalid_query',
        message: 'Invalid query parameters',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, 'Error fetching players');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch players',
      requestId,
    });
  }
});

/**
 * GET /games/:gameId/players/stats
 * Get all players with their game statistics
 * Public access (for viewing leaderboard)
 */
router.get('/:gameId/players/stats', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    // Fetch players with stats
    const players = await playerService.getPlayersWithStats(gameId);

    return res.status(200).json({
      game_id: gameId,
      players,
      total: players.length,
    });
  } catch (error) {
    logger.error({ error, gameId, requestId }, 'Error fetching players with stats');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch player statistics',
      requestId,
    });
  }
});

/**
 * GET /players/:playerId
 * Get a single player by ID
 * Public access
 */
router.get('/players/:playerId', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { playerId } = req.params;

  try {
    const player = await playerService.getPlayerById(playerId);

    if (!player) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Player not found',
        requestId,
      });
    }

    return res.status(200).json(player);
  } catch (error) {
    logger.error({ error, playerId, requestId }, 'Error fetching player');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch player',
      requestId,
    });
  }
});

/**
 * PATCH /players/:playerId
 * Update a player
 * Requires authentication or host permissions
 */
router.patch('/players/:playerId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { playerId } = req.params;

  try {
    // Validate input
    const updates = UpdatePlayerSchema.parse(req.body);

    // Update the player
    const result = await playerService.updatePlayer(playerId, updates);

    if (!result.success) {
      const statusCode =
        result.error === 'No updates provided' || result.error === 'player_name cannot be empty'
          ? 400
          : 500;
      return res.status(statusCode).json({
        error: 'player_update_failed',
        message: result.error,
        requestId,
      });
    }

    return res.status(200).json(result.player);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, playerId, requestId }, 'Validation error updating player');
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Invalid update data',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, playerId, requestId }, 'Error updating player');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to update player',
      requestId,
    });
  }
});

/**
 * DELETE /players/:playerId
 * Remove a player from the game
 * Requires authentication or host permissions
 */
router.delete('/players/:playerId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { playerId } = req.params;

  try {
    const success = await playerService.deletePlayer(playerId);

    if (!success) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Player not found',
        requestId,
      });
    }

    return res.status(204).send();
  } catch (error) {
    logger.error({ error, playerId, requestId }, 'Error deleting player');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to delete player',
      requestId,
    });
  }
});

/**
 * GET /games/:gameId/players/device/:deviceId
 * Get player by device ID in a specific game
 * Public access (for reconnection)
 */
router.get('/:gameId/players/device/:deviceId', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId, deviceId } = req.params;

  try {
    const player = await playerService.getPlayerByDeviceId(gameId, deviceId);

    if (!player) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Player not found in this game',
        requestId,
      });
    }

    return res.status(200).json(player);
  } catch (error) {
    logger.error({ error, gameId, deviceId, requestId }, 'Error fetching player by device');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch player',
      requestId,
    });
  }
});

export default router;
