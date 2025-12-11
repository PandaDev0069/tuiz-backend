// src/routes/game-events.ts
import express from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { gameEventService } from '../services/gameEventService';
import { AuthenticatedRequest } from '../types/auth';
import { CreateGameEventSchema, GameEventQuerySchema, GameEventType } from '../types/gameEvent';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /games/:gameId/events
 * Create a new game event
 * Requires authentication
 */
router.post('/:gameId/events', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;
  const userId = req.user?.id;

  try {
    // Validate input
    const input = CreateGameEventSchema.parse({
      ...req.body,
      game_id: gameId,
      user_id: userId,
    });

    // Create the event
    const result = await gameEventService.createGameEvent(input);

    if (!result.success) {
      const statusCode = result.error === 'Game not found' ? 404 : 400;
      return res.status(statusCode).json({
        error: 'event_creation_failed',
        message: result.error,
        requestId,
      });
    }

    return res.status(201).json(result.event);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, 'Validation error creating game event');
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Invalid event data',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, 'Error creating game event');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to create game event',
      requestId,
    });
  }
});

/**
 * GET /games/:gameId/events
 * Get game events with filtering and pagination
 * Public access (for viewing replays)
 */
router.get('/:gameId/events', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    // Validate query parameters
    const query = GameEventQuerySchema.parse(req.query);

    // Fetch events
    const result = await gameEventService.getGameEvents(gameId, query);

    if (!result) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found or no events available',
        requestId,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error, gameId, requestId }, 'Validation error fetching game events');
      return res.status(400).json({
        error: 'invalid_query',
        message: 'Invalid query parameters',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, gameId, requestId }, 'Error fetching game events');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch game events',
      requestId,
    });
  }
});

/**
 * GET /games/:gameId/replay
 * Get complete game replay data
 * Public access (for viewing replays)
 */
router.get('/:gameId/replay', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    // Fetch complete replay data
    const replay = await gameEventService.getGameReplay(gameId);

    if (!replay) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found or replay data unavailable',
        requestId,
      });
    }

    return res.status(200).json(replay);
  } catch (error) {
    logger.error({ error, gameId, requestId }, 'Error fetching game replay');
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch game replay',
      requestId,
    });
  }
});

/**
 * GET /games/:gameId/events/types
 * Get available event types for documentation
 * Public endpoint
 */
router.get('/:gameId/events/types', (_req, res) => {
  return res.status(200).json({
    event_types: Object.values(GameEventType),
    description: {
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
    },
  });
});

export default router;
