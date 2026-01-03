// ====================================================
// File Name   : game-events.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Express router for game event management endpoints
// - Handles creation and retrieval of game events
// - Provides endpoints for event filtering, pagination, and replay data
// - Supports game replay functionality with complete event history

// Notes:
// - Some endpoints are public (no auth required) for replay viewing
// - Event creation requires authentication via authMiddleware
// - Uses Zod schemas for request validation
// - Event types endpoint provides documentation for available event types
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { gameEventService } from '../services/gameEventService';
import { AuthenticatedRequest } from '../types/auth';
import { CreateGameEventSchema, GameEventQuerySchema, GameEventType } from '../types/gameEvent';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const ERROR_CODES = {
  EVENT_CREATION_FAILED: 'event_creation_failed',
  INVALID_PAYLOAD: 'invalid_payload',
  SERVER_ERROR: 'server_error',
  INVALID_QUERY: 'invalid_query',
  NOT_FOUND: 'not_found',
} as const;

const ERROR_MESSAGES = {
  GAME_NOT_FOUND: 'Game not found',
  INVALID_EVENT_DATA: 'Invalid event data',
  FAILED_TO_CREATE_EVENT: 'Failed to create game event',
  INVALID_QUERY_PARAMETERS: 'Invalid query parameters',
  FAILED_TO_FETCH_EVENTS: 'Failed to fetch game events',
  GAME_NOT_FOUND_OR_NO_EVENTS: 'Game not found or no events available',
  GAME_NOT_FOUND_OR_REPLAY_UNAVAILABLE: 'Game not found or replay data unavailable',
  FAILED_TO_FETCH_REPLAY: 'Failed to fetch game replay',
} as const;

const LOG_MESSAGES = {
  VALIDATION_ERROR_CREATING_EVENT: 'Validation error creating game event',
  ERROR_CREATING_EVENT: 'Error creating game event',
  VALIDATION_ERROR_FETCHING_EVENTS: 'Validation error fetching game events',
  ERROR_FETCHING_EVENTS: 'Error fetching game events',
  ERROR_FETCHING_REPLAY: 'Error fetching game replay',
} as const;

const EVENT_TYPE_DESCRIPTIONS = {
  [GameEventType.QUESTION_START]: 'Question phase begins',
  [GameEventType.QUESTION_END]: 'Question phase ends',
  [GameEventType.PLAYER_ANSWER]: 'Player submits answer',
  [GameEventType.ANSWER_REVEAL]: 'Correct answer revealed',
  [GameEventType.ANSWER_STATISTICS]: 'Answer statistics displayed',
  [GameEventType.LEADERBOARD_UPDATE]: 'Leaderboard updated',
  [GameEventType.EXPLANATION_SHOW]: 'Explanation displayed',
  [GameEventType.GAME_START]: 'Game starts',
  [GameEventType.GAME_PAUSE]: 'Game paused',
  [GameEventType.GAME_RESUME]: 'Game resumed',
  [GameEventType.GAME_END]: 'Game ends',
  [GameEventType.PLAYER_JOIN]: 'Player joins game',
  [GameEventType.PLAYER_LEAVE]: 'Player leaves game',
  [GameEventType.PLAYER_DISCONNECT]: 'Player disconnects',
  [GameEventType.PLAYER_RECONNECT]: 'Player reconnects',
  [GameEventType.HOST_ACTION]: 'Host performs action',
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
 * Route: POST /:gameId/events
 * Description:
 * - Create a new game event
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.body: Event data (validated by CreateGameEventSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 201: Created event object
 * - 400: Invalid request or validation error
 * - 404: Game not found
 * - 500: Server error
 */
router.post('/:gameId/events', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;
  const userId = req.user?.id;

  try {
    const input = CreateGameEventSchema.parse({
      ...req.body,
      game_id: gameId,
      user_id: userId,
    });

    const result = await gameEventService.createGameEvent(input);

    if (!result.success) {
      const statusCode =
        result.error === ERROR_MESSAGES.GAME_NOT_FOUND
          ? HTTP_STATUS_NOT_FOUND
          : HTTP_STATUS_BAD_REQUEST;
      return res.status(statusCode).json({
        error: ERROR_CODES.EVENT_CREATION_FAILED,
        message: result.error,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_CREATED).json(result.event);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, LOG_MESSAGES.VALIDATION_ERROR_CREATING_EVENT);
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.INVALID_EVENT_DATA,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, LOG_MESSAGES.ERROR_CREATING_EVENT);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_CREATE_EVENT,
      requestId,
    });
  }
});

/**
 * Route: GET /:gameId/events
 * Description:
 * - Get game events with filtering and pagination
 * - Public access (for viewing replays)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.query: Query parameters (validated by GameEventQuerySchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Game events with metadata
 * - 400: Invalid query parameters
 * - 404: Game not found or no events available
 * - 500: Server error
 */
router.get('/:gameId/events', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    const query = GameEventQuerySchema.parse(req.query);

    const result = await gameEventService.getGameEvents(gameId, query);

    if (!result) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.GAME_NOT_FOUND_OR_NO_EVENTS,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, LOG_MESSAGES.VALIDATION_ERROR_FETCHING_EVENTS);
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_QUERY,
        message: ERROR_MESSAGES.INVALID_QUERY_PARAMETERS,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, LOG_MESSAGES.ERROR_FETCHING_EVENTS);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_EVENTS,
      requestId,
    });
  }
});

/**
 * Route: GET /:gameId/replay
 * Description:
 * - Get complete game replay data
 * - Public access (for viewing replays)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Complete game replay data
 * - 404: Game not found or replay data unavailable
 * - 500: Server error
 */
router.get('/:gameId/replay', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    const replay = await gameEventService.getGameReplay(gameId);

    if (!replay) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.GAME_NOT_FOUND_OR_REPLAY_UNAVAILABLE,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(replay);
  } catch (error) {
    logger.error({ error, gameId, requestId }, LOG_MESSAGES.ERROR_FETCHING_REPLAY);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_REPLAY,
      requestId,
    });
  }
});

/**
 * Route: GET /:gameId/events/types
 * Description:
 * - Get available event types for documentation
 * - Public endpoint
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - 200: Available event types with descriptions
 */
router.get('/:gameId/events/types', (_req, res) => {
  return res.status(HTTP_STATUS_OK).json({
    event_types: Object.values(GameEventType),
    description: EVENT_TYPE_DESCRIPTIONS,
  });
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
// No helper functions - all logic in route handlers

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
