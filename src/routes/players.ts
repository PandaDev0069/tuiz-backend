// ====================================================
// File Name   : players.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Express routes for player management in games
// - Handles player creation, joining, updates, deletion, and queries
// - Supports both authenticated and guest players

// Notes:
// - Most routes are public (no authentication required)
// - Update and delete routes require authentication
// - Uses playerService for business logic
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
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

const GUEST_IS_LOGGED_IN = false;
const GUEST_IS_HOST = false;

const ERROR_CODES = {
  PLAYER_CREATION_FAILED: 'player_creation_failed',
  INVALID_PAYLOAD: 'invalid_payload',
  SERVER_ERROR: 'server_error',
  JOIN_GAME_FAILED: 'join_game_failed',
  NOT_FOUND: 'not_found',
  INVALID_QUERY: 'invalid_query',
  PLAYER_UPDATE_FAILED: 'player_update_failed',
} as const;

const ERROR_MESSAGES = {
  INVALID_PLAYER_DATA: 'Invalid player data',
  FAILED_TO_CREATE_PLAYER: 'Failed to create player',
  INVALID_JOIN_DATA: 'Invalid join data',
  FAILED_TO_JOIN_GAME: 'Failed to join game',
  GAME_NOT_FOUND_OR_NO_PLAYERS: 'Game not found or no players available',
  INVALID_QUERY_PARAMETERS: 'Invalid query parameters',
  FAILED_TO_FETCH_PLAYERS: 'Failed to fetch players',
  FAILED_TO_FETCH_PLAYER_STATISTICS: 'Failed to fetch player statistics',
  PLAYER_NOT_FOUND: 'Player not found',
  FAILED_TO_FETCH_PLAYER: 'Failed to fetch player',
  INVALID_UPDATE_DATA: 'Invalid update data',
  FAILED_TO_UPDATE_PLAYER: 'Failed to update player',
  FAILED_TO_DELETE_PLAYER: 'Failed to delete player',
  PLAYER_NOT_FOUND_IN_GAME: 'Player not found in this game',
} as const;

const SUCCESS_MESSAGES = {
  SUCCESSFULLY_JOINED_GAME: 'Successfully joined game',
} as const;

const LOG_MESSAGES = {
  VALIDATION_ERROR_CREATING_PLAYER: 'Validation error creating player',
  ERROR_CREATING_PLAYER: 'Error creating player',
  VALIDATION_ERROR_JOINING_GAME: 'Validation error joining game',
  ERROR_JOINING_GAME: 'Error joining game',
  VALIDATION_ERROR_FETCHING_PLAYERS: 'Validation error fetching players',
  ERROR_FETCHING_PLAYERS: 'Error fetching players',
  ERROR_FETCHING_PLAYERS_WITH_STATS: 'Error fetching players with stats',
  ERROR_FETCHING_PLAYER: 'Error fetching player',
  VALIDATION_ERROR_UPDATING_PLAYER: 'Validation error updating player',
  ERROR_UPDATING_PLAYER: 'Error updating player',
  ERROR_DELETING_PLAYER: 'Error deleting player',
  ERROR_FETCHING_PLAYER_BY_DEVICE: 'Error fetching player by device',
} as const;

const SERVICE_ERROR_MESSAGES = {
  GAME_NOT_FOUND: 'Game not found',
  GAME_LOCKED: 'Game is locked and not accepting new players',
  GAME_NOT_ACCEPTING_PLAYERS: 'Game is not accepting players',
  PLAYER_ALREADY_JOINED: 'Player already joined this game',
  NO_UPDATES_PROVIDED: 'No updates provided',
  PLAYER_NAME_CANNOT_BE_EMPTY: 'player_name cannot be empty',
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
 * Route: POST /:gameId/players
 * Description:
 * - Add a new player to the game (join game)
 * - Public access for guest players
 * - Validates input and creates player via playerService
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.body: Player creation data (validated by CreatePlayerSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with created player or error details
 */
router.post('/:gameId/players', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId } = req.params;

  try {
    const input = CreatePlayerSchema.parse({
      ...req.body,
      game_id: gameId,
    });

    const result = await playerService.createPlayer(input);

    if (!result.success) {
      let statusCode = HTTP_STATUS_BAD_REQUEST;
      if (result.error === SERVICE_ERROR_MESSAGES.GAME_NOT_FOUND) {
        statusCode = HTTP_STATUS_NOT_FOUND;
      } else if (
        result.error === SERVICE_ERROR_MESSAGES.GAME_LOCKED ||
        result.error === SERVICE_ERROR_MESSAGES.GAME_NOT_ACCEPTING_PLAYERS ||
        result.error === SERVICE_ERROR_MESSAGES.PLAYER_ALREADY_JOINED
      ) {
        statusCode = HTTP_STATUS_CONFLICT;
      }

      return res.status(statusCode).json({
        error: ERROR_CODES.PLAYER_CREATION_FAILED,
        message: result.error,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_CREATED).json(result.player);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, LOG_MESSAGES.VALIDATION_ERROR_CREATING_PLAYER);
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.INVALID_PLAYER_DATA,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, LOG_MESSAGES.ERROR_CREATING_PLAYER);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_CREATE_PLAYER,
      requestId,
    });
  }
});

/**
 * Route: POST /:gameId/join
 * Description:
 * - Simplified join endpoint for guest players
 * - Public access
 * - Creates player with guest defaults (not logged in, not host)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.body: Join game data (validated by JoinGameSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with success status, player data, and message
 */
router.post('/:gameId/join', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId } = req.params;

  try {
    const input = JoinGameSchema.parse(req.body);

    const result = await playerService.createPlayer({
      game_id: gameId,
      device_id: input.device_id,
      player_name: input.player_name,
      is_logged_in: GUEST_IS_LOGGED_IN,
      is_host: GUEST_IS_HOST,
    });

    if (!result.success) {
      let statusCode = HTTP_STATUS_BAD_REQUEST;
      if (result.error === SERVICE_ERROR_MESSAGES.GAME_NOT_FOUND) {
        statusCode = HTTP_STATUS_NOT_FOUND;
      } else if (
        result.error === SERVICE_ERROR_MESSAGES.GAME_LOCKED ||
        result.error === SERVICE_ERROR_MESSAGES.GAME_NOT_ACCEPTING_PLAYERS ||
        result.error === SERVICE_ERROR_MESSAGES.PLAYER_ALREADY_JOINED
      ) {
        statusCode = HTTP_STATUS_CONFLICT;
      }

      return res.status(statusCode).json({
        error: ERROR_CODES.JOIN_GAME_FAILED,
        message: result.error,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_CREATED).json({
      success: true,
      player: result.player,
      message: SUCCESS_MESSAGES.SUCCESSFULLY_JOINED_GAME,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, LOG_MESSAGES.VALIDATION_ERROR_JOINING_GAME);
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.INVALID_JOIN_DATA,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, LOG_MESSAGES.ERROR_JOINING_GAME);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_JOIN_GAME,
      requestId,
    });
  }
});

/**
 * Route: GET /:gameId/players
 * Description:
 * - Get all players in a game with filtering and pagination
 * - Public access (for viewing player list)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.query: Query parameters (validated by PlayerQuerySchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with players data or error details
 */
router.get('/:gameId/players', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId } = req.params;

  try {
    const query = PlayerQuerySchema.parse(req.query);

    const result = await playerService.getPlayers(gameId, query);

    if (!result) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.GAME_NOT_FOUND_OR_NO_PLAYERS,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, LOG_MESSAGES.VALIDATION_ERROR_FETCHING_PLAYERS);
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_QUERY,
        message: ERROR_MESSAGES.INVALID_QUERY_PARAMETERS,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, LOG_MESSAGES.ERROR_FETCHING_PLAYERS);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PLAYERS,
      requestId,
    });
  }
});

/**
 * Route: GET /:gameId/players/stats
 * Description:
 * - Get all players with their game statistics
 * - Public access (for viewing leaderboard)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with game ID, players array, and total count
 */
router.get('/:gameId/players/stats', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId } = req.params;

  try {
    const players = await playerService.getPlayersWithStats(gameId);

    return res.status(HTTP_STATUS_OK).json({
      game_id: gameId,
      players,
      total: players.length,
    });
  } catch (error) {
    logger.error({ error, gameId, requestId }, LOG_MESSAGES.ERROR_FETCHING_PLAYERS_WITH_STATS);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PLAYER_STATISTICS,
      requestId,
    });
  }
});

/**
 * Route: GET /players/:playerId
 * Description:
 * - Get a single player by ID
 * - Public access
 *
 * Parameters:
 * - req.params.playerId: Player identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with player data or error details
 */
router.get('/players/:playerId', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { playerId } = req.params;

  try {
    const player = await playerService.getPlayerById(playerId);

    if (!player) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.PLAYER_NOT_FOUND,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(player);
  } catch (error) {
    logger.error({ error, playerId, requestId }, LOG_MESSAGES.ERROR_FETCHING_PLAYER);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PLAYER,
      requestId,
    });
  }
});

/**
 * Route: PATCH /players/:playerId
 * Description:
 * - Update a player
 * - Requires authentication or host permissions
 *
 * Parameters:
 * - req.params.playerId: Player identifier
 * - req.body: Update data (validated by UpdatePlayerSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with updated player data or error details
 */
router.patch('/players/:playerId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { playerId } = req.params;

  try {
    const updates = UpdatePlayerSchema.parse(req.body);

    const result = await playerService.updatePlayer(playerId, updates);

    if (!result.success) {
      const statusCode =
        result.error === SERVICE_ERROR_MESSAGES.NO_UPDATES_PROVIDED ||
        result.error === SERVICE_ERROR_MESSAGES.PLAYER_NAME_CANNOT_BE_EMPTY
          ? HTTP_STATUS_BAD_REQUEST
          : HTTP_STATUS_INTERNAL_SERVER_ERROR;
      return res.status(statusCode).json({
        error: ERROR_CODES.PLAYER_UPDATE_FAILED,
        message: result.error,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(result.player);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, playerId, requestId }, LOG_MESSAGES.VALIDATION_ERROR_UPDATING_PLAYER);
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.INVALID_UPDATE_DATA,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, playerId, requestId }, LOG_MESSAGES.ERROR_UPDATING_PLAYER);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_UPDATE_PLAYER,
      requestId,
    });
  }
});

/**
 * Route: DELETE /players/:playerId
 * Description:
 * - Remove a player from the game
 * - Requires authentication or host permissions
 *
 * Parameters:
 * - req.params.playerId: Player identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 204 No Content on success or error details
 */
router.delete('/players/:playerId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { playerId } = req.params;

  try {
    const success = await playerService.deletePlayer(playerId);

    if (!success) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.PLAYER_NOT_FOUND,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_NO_CONTENT).send();
  } catch (error) {
    logger.error({ error, playerId, requestId }, LOG_MESSAGES.ERROR_DELETING_PLAYER);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_DELETE_PLAYER,
      requestId,
    });
  }
});

/**
 * Route: GET /:gameId/players/device/:deviceId
 * Description:
 * - Get player by device ID in a specific game
 * - Public access (for reconnection)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.deviceId: Device identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with player data or error details
 */
router.get('/:gameId/players/device/:deviceId', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId, deviceId } = req.params;

  try {
    const player = await playerService.getPlayerByDeviceId(gameId, deviceId);

    if (!player) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.PLAYER_NOT_FOUND_IN_GAME,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(player);
  } catch (error) {
    logger.error(
      { error, gameId, deviceId, requestId },
      LOG_MESSAGES.ERROR_FETCHING_PLAYER_BY_DEVICE,
    );
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PLAYER,
      requestId,
    });
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
// No helper functions - all logic is in playerService

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
