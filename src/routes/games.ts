// ====================================================
// File Name   : games.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-01
// Last Update : 2026-01-03

// Description:
// - Express routes for game management
// - Handles game creation, retrieval, and player management
// - Supports game code generation and uniqueness validation

// Notes:
// - Game creation requires authentication
// - Most routes are public for player access
// - Player ban/kick requires host authentication
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { ZodError } from 'zod';

import { supabaseAdmin, incrementQuizPlayCount } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { gameFlowService } from '../services/gameFlowService';
import { playerService } from '../services/playerService';
import { requireWebSocketManager } from '../services/websocket';
import { AuthenticatedRequest } from '../types/auth';
import { CreateGameSchema, GameStatus } from '../types/game';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_QUIZ_SETS = 'quiz_sets';
const TABLE_GAMES = 'games';
const TABLE_PLAYERS = 'players';

const COLUMN_ID = 'id';
const COLUMN_GAME_CODE = 'game_code';
const COLUMN_GAME_ID = 'game_id';
const SELECT_ALL = '*';
const SELECT_QUIZ_FIELDS = 'id, total_questions, play_settings';
const SELECT_GAME_FIELDS = 'id, user_id, game_code';
const SELECT_PLAYER_FIELDS = 'id, player_name, device_id, is_host';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const GAME_CODE_MIN = 100000;
const GAME_CODE_MAX = 900000;
const MAX_CODE_GENERATION_ATTEMPTS = 5;
const DEFAULT_CURRENT_PLAYERS = 0;
const DEFAULT_CURRENT_QUESTION_INDEX = 0;
const DEFAULT_LOCKED = false;
const HOST_IS_LOGGED_IN = true;
const HOST_IS_HOST = true;
const UNKNOWN_USER = 'unknown';

const ERROR_CODES = {
  NOT_FOUND: 'not_found',
  VALIDATION_ERROR: 'validation_error',
  DATABASE_ERROR: 'database_error',
  SERVER_ERROR: 'server_error',
  FORBIDDEN: 'forbidden',
  INVALID_REQUEST: 'invalid_request',
} as const;

const ERROR_MESSAGES = {
  QUIZ_NOT_FOUND: 'Quiz not found',
  FAILED_TO_CREATE_GAME: 'Failed to create game',
  FAILED_TO_GENERATE_UNIQUE_GAME_CODE: 'Failed to generate unique game code',
  FAILED_TO_INITIALIZE_GAME_FLOW: 'Failed to initialize game flow:',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  FAILED_TO_FETCH_GAME: 'Failed to fetch game',
  GAME_NOT_FOUND: 'Game not found',
  FAILED_TO_VERIFY_GAME: 'Failed to verify game',
  ONLY_HOST_CAN_BAN_PLAYERS: 'Only the game host can ban players',
  FAILED_TO_FETCH_PLAYER: 'Failed to fetch player',
  PLAYER_NOT_FOUND_IN_GAME: 'Player not found in this game',
  CANNOT_BAN_HOST_PLAYER: 'Cannot ban the host player',
  FAILED_TO_BAN_PLAYER: 'Failed to ban player',
} as const;

const SUCCESS_MESSAGES = {
  PLAYER_BANNED_SUCCESSFULLY: 'Player banned successfully',
} as const;

const LOG_MESSAGES = {
  FAILED_TO_FETCH_QUIZ_DETAILS: 'Failed to fetch quiz details',
  ERROR_CREATING_GAME: 'Error creating game',
  GAME_FLOW_CREATION_FAILED_ROLLING_BACK: 'Game flow creation failed, rolling back game creation',
  FAILED_TO_ROLLBACK_GAME_CREATION: 'Failed to rollback game creation after game_flows error',
  HOST_PLAYER_CREATED_SUCCESSFULLY: 'Host player created successfully',
  FAILED_TO_CREATE_HOST_PLAYER: 'Failed to create host player, but game was created',
  ERROR_CREATING_HOST_PLAYER: 'Error creating host player, but game was created',
  QUIZ_SET_TIMES_PLAYED_INCREMENTED: 'Quiz set times_played incremented successfully',
  FAILED_TO_INCREMENT_QUIZ_SET_TIMES_PLAYED:
    'Failed to increment quiz set times_played, but game was created',
  GAME_AND_GAME_FLOW_CREATED_SUCCESSFULLY: 'Game and game flow created successfully',
  UNEXPECTED_ERROR_CREATING_GAME: 'Unexpected error creating game',
  ERROR_FETCHING_GAME: 'Error fetching game',
  UNEXPECTED_ERROR_FETCHING_GAME: 'Unexpected error fetching game',
  ERROR_FETCHING_GAME_BY_CODE: 'Error fetching game by code',
  UNEXPECTED_ERROR_FETCHING_GAME_BY_CODE: 'Unexpected error fetching game by code',
  UNAUTHORIZED_ATTEMPT_TO_BAN_PLAYER: 'Unauthorized attempt to ban player',
  ERROR_FETCHING_PLAYER: 'Error fetching player',
  FAILED_TO_DELETE_PLAYER: 'Failed to delete player',
  PLAYER_BANNED_SUCCESSFULLY: 'Player banned successfully',
  UNEXPECTED_ERROR_BANNING_PLAYER: 'Unexpected error banning player',
} as const;

const WEBSOCKET_EVENTS = {
  GAME_PLAYER_KICKED: 'game:player-kicked',
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
 * Route: POST /
 * Description:
 * - Create a new game
 * - Requires authentication
 * - Generates unique game code, creates game flow, and optionally creates host player
 *
 * Parameters:
 * - req.body: Game creation data (validated by CreateGameSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with created game and host player (if applicable)
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const userId = req.user?.id;

  try {
    const input = CreateGameSchema.parse(req.body);

    const quiz = await fetchQuizDetails(input.quiz_set_id);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND,
      });
    }

    const gameCode = await ensureUniqueGameCode(quiz.play_settings);

    const game = await createGameRecord(input, gameCode, userId);
    if (!game) {
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_CREATE_GAME,
      });
    }

    const gameFlowResult = await initializeGameFlow(
      game.id,
      input.quiz_set_id,
      quiz.total_questions,
    );
    if (!gameFlowResult.success) {
      await rollbackGameCreation(game.id);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: `${ERROR_MESSAGES.FAILED_TO_INITIALIZE_GAME_FLOW} ${gameFlowResult.error}`,
      });
    }

    const hostPlayer = await createHostPlayerIfProvided(game.id, input, userId);

    await incrementQuizPlayCountSafely(input.quiz_set_id, game.id);

    logger.info(
      { gameId: game.id, gameFlowId: gameFlowResult.gameFlow?.id, userId },
      LOG_MESSAGES.GAME_AND_GAME_FLOW_CREATED_SUCCESSFULLY,
    );

    res.status(HTTP_STATUS_CREATED).json({ game, host_player: hostPlayer });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        details: error.issues,
      });
    }
    logger.error({ error, requestId }, LOG_MESSAGES.UNEXPECTED_ERROR_CREATING_GAME);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
});

/**
 * Route: GET /:gameId
 * Description:
 * - Get game details by ID
 * - Public access (for players to verify game exists)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with game data or error details
 */
router.get('/:gameId', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameId } = req.params;

  try {
    const { data: game, error: gameError } = await supabaseAdmin
      .from(TABLE_GAMES)
      .select(SELECT_ALL)
      .eq(COLUMN_ID, gameId)
      .maybeSingle();

    if (gameError) {
      logger.error({ error: gameError, gameId, requestId }, LOG_MESSAGES.ERROR_FETCHING_GAME);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_GAME,
        requestId,
      });
    }

    if (!game) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.GAME_NOT_FOUND,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(game);
  } catch (error) {
    logger.error({ error, gameId, requestId }, LOG_MESSAGES.UNEXPECTED_ERROR_FETCHING_GAME);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: GET /by-code/:gameCode
 * Description:
 * - Get game details by room code
 * - Public access (for players to join using room code)
 *
 * Parameters:
 * - req.params.gameCode: Game code identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with game data or error details
 */
router.get('/by-code/:gameCode', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { gameCode } = req.params;

  try {
    const { data: game, error: gameError } = await supabaseAdmin
      .from(TABLE_GAMES)
      .select(SELECT_ALL)
      .eq(COLUMN_GAME_CODE, gameCode)
      .maybeSingle();

    if (gameError) {
      logger.error(
        { error: gameError, gameCode, requestId },
        LOG_MESSAGES.ERROR_FETCHING_GAME_BY_CODE,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_GAME,
        requestId,
      });
    }

    if (!game) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.GAME_NOT_FOUND,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(game);
  } catch (error) {
    logger.error(
      { error, gameCode, requestId },
      LOG_MESSAGES.UNEXPECTED_ERROR_FETCHING_GAME_BY_CODE,
    );
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: DELETE /:gameId/players/:playerId
 * Description:
 * - Ban/kick a player from the game
 * - Requires authentication (host only)
 * - Emits WebSocket event to notify all clients
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.playerId: Player identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - JSON response with success message or error details
 */
router.delete(
  '/:gameId/players/:playerId',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = (req.headers['x-request-id'] as string) || '';
    const { gameId, playerId } = req.params;
    const userId = req.user?.id;

    try {
      const game = await verifyGameAndHost(gameId, userId, res, requestId);
      if (!game) {
        return;
      }

      const player = await fetchPlayerForBan(playerId, gameId, res, requestId);
      if (!player) {
        return;
      }

      if (player.is_host) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_REQUEST,
          message: ERROR_MESSAGES.CANNOT_BAN_HOST_PLAYER,
          requestId,
        });
      }

      const success = await playerService.deletePlayer(playerId);
      if (!success) {
        logger.warn({ playerId, gameId }, LOG_MESSAGES.FAILED_TO_DELETE_PLAYER);
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.DATABASE_ERROR,
          message: ERROR_MESSAGES.FAILED_TO_BAN_PLAYER,
          requestId,
        });
      }

      emitPlayerKickedEvent(gameId, playerId, player.player_name, userId || UNKNOWN_USER);

      logger.info(
        { playerId, playerName: player.player_name, gameId, kickedBy: userId },
        LOG_MESSAGES.PLAYER_BANNED_SUCCESSFULLY,
      );

      return res.status(HTTP_STATUS_OK).json({
        message: SUCCESS_MESSAGES.PLAYER_BANNED_SUCCESSFULLY,
        player_id: playerId,
      });
    } catch (error) {
      logger.error(
        { error, gameId, playerId, requestId },
        LOG_MESSAGES.UNEXPECTED_ERROR_BANNING_PLAYER,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        requestId,
      });
    }
  },
);

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: generateGameCode
 * Description:
 * - Generate a random 6-digit game code
 *
 * Returns:
 * - string: 6-digit game code as string
 */
function generateGameCode(): string {
  return Math.floor(GAME_CODE_MIN + Math.random() * GAME_CODE_MAX).toString();
}

/**
 * Function: fetchQuizDetails
 * Description:
 * - Fetch quiz details including total questions and play settings
 *
 * Parameters:
 * - quizSetId (string): Quiz set identifier
 *
 * Returns:
 * - object | null: Quiz data with id, total_questions, and play_settings, or null if not found
 */
async function fetchQuizDetails(quizSetId: string): Promise<{
  id: string;
  total_questions: number;
  play_settings: Record<string, unknown>;
} | null> {
  const { data: quiz, error: quizError } = await supabaseAdmin
    .from(TABLE_QUIZ_SETS)
    .select(SELECT_QUIZ_FIELDS)
    .eq(COLUMN_ID, quizSetId)
    .single();

  if (quizError || !quiz) {
    logger.warn({ error: quizError, quizId: quizSetId }, LOG_MESSAGES.FAILED_TO_FETCH_QUIZ_DETAILS);
    return null;
  }

  return quiz;
}

/**
 * Function: extractGameCodeFromSettings
 * Description:
 * - Extract game code from quiz play settings
 *
 * Parameters:
 * - playSettings (Record<string, unknown>): Quiz play settings object
 *
 * Returns:
 * - string | null: Extracted game code or null if not found
 */
function extractGameCodeFromSettings(playSettings: Record<string, unknown>): string | null {
  const code = playSettings?.code as number | string | undefined;
  return code ? code.toString() : null;
}

/**
 * Function: checkGameCodeExists
 * Description:
 * - Check if a game code already exists in the database
 *
 * Parameters:
 * - gameCode (string): Game code to check
 *
 * Returns:
 * - boolean: True if code exists, false otherwise
 */
async function checkGameCodeExists(gameCode: string): Promise<boolean> {
  const { data: existingGame } = await supabaseAdmin
    .from(TABLE_GAMES)
    .select(COLUMN_ID)
    .eq(COLUMN_GAME_CODE, gameCode)
    .maybeSingle();

  return !!existingGame;
}

/**
 * Function: ensureUniqueGameCode
 * Description:
 * - Ensure game code is unique by checking and regenerating if needed
 * - Attempts up to MAX_CODE_GENERATION_ATTEMPTS times
 *
 * Parameters:
 * - playSettings (Record<string, unknown>): Quiz play settings object
 *
 * Returns:
 * - string: Unique game code
 *
 * Throws:
 * - Error: If unable to generate unique code after max attempts
 */
async function ensureUniqueGameCode(playSettings: Record<string, unknown>): Promise<string> {
  let gameCode = extractGameCodeFromSettings(playSettings) || generateGameCode();

  const exists = await checkGameCodeExists(gameCode);
  if (!exists) {
    return gameCode;
  }

  let attempts = 0;
  while (attempts < MAX_CODE_GENERATION_ATTEMPTS) {
    gameCode = generateGameCode();
    const codeExists = await checkGameCodeExists(gameCode);
    if (!codeExists) {
      return gameCode;
    }
    attempts++;
  }

  throw new Error(ERROR_MESSAGES.FAILED_TO_GENERATE_UNIQUE_GAME_CODE);
}

/**
 * Function: createGameRecord
 * Description:
 * - Create a new game record in the database
 *
 * Parameters:
 * - input (object): Game creation input data
 * - gameCode (string): Unique game code
 * - userId (string | undefined): User identifier
 *
 * Returns:
 * - object | null: Created game data or null if creation failed
 */
async function createGameRecord(
  input: { quiz_set_id: string; game_settings?: Record<string, unknown> },
  gameCode: string,
  userId: string | undefined,
): Promise<{ id: string } | null> {
  const { data: game, error: gameError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .insert({
      quiz_set_id: input.quiz_set_id,
      game_code: gameCode,
      status: GameStatus.WAITING,
      game_settings: input.game_settings || {},
      user_id: userId,
      current_players: DEFAULT_CURRENT_PLAYERS,
      current_question_index: DEFAULT_CURRENT_QUESTION_INDEX,
      locked: DEFAULT_LOCKED,
    })
    .select()
    .single();

  if (gameError) {
    logger.error({ error: gameError }, LOG_MESSAGES.ERROR_CREATING_GAME);
    return null;
  }

  return game;
}

/**
 * Function: initializeGameFlow
 * Description:
 * - Initialize game flow for a newly created game
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - quizSetId (string): Quiz set identifier
 * - totalQuestions (number): Total number of questions
 *
 * Returns:
 * - object: Result with success flag and optional game flow data or error
 */
async function initializeGameFlow(
  gameId: string,
  quizSetId: string,
  totalQuestions: number,
): Promise<{ success: boolean; gameFlow?: { id: string }; error?: string }> {
  const gameFlowResult = await gameFlowService.createGameFlow({
    game_id: gameId,
    quiz_set_id: quizSetId,
    total_questions: totalQuestions,
    current_question_index: DEFAULT_CURRENT_QUESTION_INDEX,
  });

  return gameFlowResult;
}

/**
 * Function: rollbackGameCreation
 * Description:
 * - Rollback game creation by deleting the game record
 *
 * Parameters:
 * - gameId (string): Game identifier to delete
 *
 * Returns:
 * - void: No return value
 */
async function rollbackGameCreation(gameId: string): Promise<void> {
  logger.error({ gameId }, LOG_MESSAGES.GAME_FLOW_CREATION_FAILED_ROLLING_BACK);

  const { error: deleteError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .delete()
    .eq(COLUMN_ID, gameId);

  if (deleteError) {
    logger.error({ error: deleteError, gameId }, LOG_MESSAGES.FAILED_TO_ROLLBACK_GAME_CREATION);
  }
}

/**
 * Function: createHostPlayerIfProvided
 * Description:
 * - Create host player if device_id and player_name are provided
 * - Does not fail the request if player creation fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - input (object): Game creation input with optional device_id and player_name
 * - userId (string | undefined): User identifier
 *
 * Returns:
 * - object | null: Created host player or null
 */
async function createHostPlayerIfProvided(
  gameId: string,
  input: { device_id?: string; player_name?: string },
  userId: string | undefined,
): Promise<{ id: string } | null> {
  if (!input.device_id || !input.player_name) {
    return null;
  }

  try {
    const hostPlayerResult = await playerService.createPlayer({
      game_id: gameId,
      device_id: input.device_id,
      player_name: input.player_name,
      is_logged_in: HOST_IS_LOGGED_IN,
      is_host: HOST_IS_HOST,
    });

    if (hostPlayerResult.success && hostPlayerResult.player) {
      logger.info(
        { gameId, hostPlayerId: hostPlayerResult.player.id, userId },
        LOG_MESSAGES.HOST_PLAYER_CREATED_SUCCESSFULLY,
      );
      return hostPlayerResult.player;
    } else {
      logger.warn(
        { gameId, error: hostPlayerResult.error },
        LOG_MESSAGES.FAILED_TO_CREATE_HOST_PLAYER,
      );
    }
  } catch (hostError) {
    logger.error({ error: hostError, gameId }, LOG_MESSAGES.ERROR_CREATING_HOST_PLAYER);
  }

  return null;
}

/**
 * Function: incrementQuizPlayCountSafely
 * Description:
 * - Increment quiz play count without failing the request
 *
 * Parameters:
 * - quizSetId (string): Quiz set identifier
 * - gameId (string): Game identifier for logging
 *
 * Returns:
 * - void: No return value
 */
async function incrementQuizPlayCountSafely(quizSetId: string, gameId: string): Promise<void> {
  try {
    await incrementQuizPlayCount(quizSetId);
    logger.info({ quizSetId, gameId }, LOG_MESSAGES.QUIZ_SET_TIMES_PLAYED_INCREMENTED);
  } catch (incrementError) {
    logger.error(
      { error: incrementError, quizSetId, gameId },
      LOG_MESSAGES.FAILED_TO_INCREMENT_QUIZ_SET_TIMES_PLAYED,
    );
  }
}

/**
 * Function: verifyGameAndHost
 * Description:
 * - Verify game exists and user is the host
 * - Sends error response if verification fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - userId (string | undefined): User identifier
 * - res (express.Response): Express response object
 * - requestId (string): Request identifier for tracing
 *
 * Returns:
 * - object | null: Game data if verification succeeds, null otherwise
 */
async function verifyGameAndHost(
  gameId: string,
  userId: string | undefined,
  res: express.Response,
  requestId: string,
): Promise<{ id: string; user_id: string; game_code: string } | null> {
  const { data: game, error: gameError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .select(SELECT_GAME_FIELDS)
    .eq(COLUMN_ID, gameId)
    .maybeSingle();

  if (gameError) {
    logger.error({ error: gameError, gameId, requestId }, LOG_MESSAGES.ERROR_FETCHING_GAME);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.DATABASE_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_VERIFY_GAME,
      requestId,
    });
    return null;
  }

  if (!game) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.GAME_NOT_FOUND,
      requestId,
    });
    return null;
  }

  if (game.user_id !== userId) {
    logger.warn(
      { gameId, userId, gameUserId: game.user_id },
      LOG_MESSAGES.UNAUTHORIZED_ATTEMPT_TO_BAN_PLAYER,
    );
    res.status(HTTP_STATUS_FORBIDDEN).json({
      error: ERROR_CODES.FORBIDDEN,
      message: ERROR_MESSAGES.ONLY_HOST_CAN_BAN_PLAYERS,
      requestId,
    });
    return null;
  }

  return game;
}

/**
 * Function: fetchPlayerForBan
 * Description:
 * - Fetch player information before banning
 * - Sends error response if player not found
 *
 * Parameters:
 * - playerId (string): Player identifier
 * - gameId (string): Game identifier
 * - res (express.Response): Express response object
 * - requestId (string): Request identifier for tracing
 *
 * Returns:
 * - object | null: Player data if found, null otherwise
 */
async function fetchPlayerForBan(
  playerId: string,
  gameId: string,
  res: express.Response,
  requestId: string,
): Promise<{ id: string; player_name: string; device_id: string; is_host: boolean } | null> {
  const { data: player, error: playerError } = await supabaseAdmin
    .from(TABLE_PLAYERS)
    .select(SELECT_PLAYER_FIELDS)
    .eq(COLUMN_ID, playerId)
    .eq(COLUMN_GAME_ID, gameId)
    .maybeSingle();

  if (playerError) {
    logger.error({ error: playerError, playerId, gameId }, LOG_MESSAGES.ERROR_FETCHING_PLAYER);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.DATABASE_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PLAYER,
      requestId,
    });
    return null;
  }

  if (!player) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.PLAYER_NOT_FOUND_IN_GAME,
      requestId,
    });
    return null;
  }

  return player;
}

/**
 * Function: emitPlayerKickedEvent
 * Description:
 * - Emit WebSocket event to notify all clients about player being kicked
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - playerId (string): Player identifier
 * - playerName (string): Player name
 * - kickedBy (string): User identifier who kicked the player
 *
 * Returns:
 * - void: No return value
 */
function emitPlayerKickedEvent(
  gameId: string,
  playerId: string,
  playerName: string,
  kickedBy: string,
): void {
  const wsManager = requireWebSocketManager();
  wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_PLAYER_KICKED, {
    player_id: playerId,
    player_name: playerName,
    game_id: gameId,
    kicked_by: kickedBy,
    timestamp: new Date().toISOString(),
  });
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
