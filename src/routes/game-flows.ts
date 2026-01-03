// ====================================================
// File Name   : game-flows.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Express router for game flow management endpoints
// - Handles CRUD operations for game flows
// - Manages question progression and flow state updates
// - Provides endpoints for retrieving, updating, and deleting game flows

// Notes:
// - All endpoints require authentication via authMiddleware
// - Rate limiting applied via gameFlowRateLimit middleware
// - Uses gameFlowService for business logic operations
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { gameFlowRateLimit } from '../middleware/rateLimit';
import { gameFlowService } from '../services/gameFlowService';
import { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const DEFAULT_PAGINATION_LIMIT = 50;
const DEFAULT_PAGINATION_OFFSET = 0;
const MIN_PAGINATION_LIMIT = 1;
const MAX_PAGINATION_LIMIT = 100;
const MIN_PAGINATION_OFFSET = 0;

const TABLE_GAME_FLOWS = 'game_flows';
const SELECT_ALL = '*';

const ERROR_CODES = {
  INVALID_REQUEST: 'invalid_request',
  NOT_FOUND: 'not_found',
  DATABASE_ERROR: 'database_error',
  SERVER_ERROR: 'server_error',
  OPERATION_FAILED: 'operation_failed',
} as const;

const ERROR_MESSAGES = {
  INVALID_GAME_ID_FORMAT: 'Invalid game_id format',
  GAME_ID_REQUIRED: 'game_id is required',
  GAME_FLOW_NOT_FOUND: 'Game flow not found',
  FAILED_TO_FETCH_GAME_FLOW: 'Failed to fetch game flow',
  FAILED_TO_FETCH_GAME_FLOWS: 'Failed to fetch game flows',
  FAILED_TO_UPDATE_GAME_FLOW: 'Failed to update game flow',
  FAILED_TO_DELETE_GAME_FLOW: 'Failed to delete game flow',
  FAILED_TO_ADVANCE_QUESTION: 'Failed to advance question',
  NO_VALID_FIELDS_TO_UPDATE: 'No valid fields to update',
  LIMIT_MUST_BE_BETWEEN_1_AND_100: 'Limit must be between 1 and 100',
  OFFSET_MUST_BE_NON_NEGATIVE: 'Offset must be non-negative',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

const SUCCESS_MESSAGES = {
  ADVANCED_TO_NEXT_QUESTION: 'Successfully advanced to next question',
  GAME_FLOW_DELETED_SUCCESSFULLY: 'Game flow deleted successfully',
} as const;

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
interface GameFlowUpdateBody {
  current_question_index?: number;
  current_question_id?: string | null;
  next_question_id?: string | null;
  current_question_start_time?: string | null;
  current_question_end_time?: string | null;
}

interface PaginationQuery {
  quiz_set_id?: string;
  limit?: string;
  offset?: string;
}

interface PaginationParams {
  limit: number;
  offset: number;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = express.Router();

/**
 * Route: GET /:game_id/flow
 * Description:
 * - Retrieves game flow for a specific game by game_id
 * - Returns complete game flow data including question progression state
 *
 * Parameters:
 * - game_id (string): Unique identifier for the game
 *
 * Returns:
 * - 200: Game flow object
 * - 400: Invalid game_id format
 * - 404: Game flow not found
 * - 500: Database or server error
 */
router.get(
  '/:game_id/flow',
  gameFlowRateLimit,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { game_id } = req.params;

    try {
      if (!validateGameId(game_id)) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INVALID_REQUEST,
          ERROR_MESSAGES.INVALID_GAME_ID_FORMAT,
          requestId,
        );
      }

      const gameFlow = await fetchGameFlowByGameId(game_id);
      if (!gameFlow) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND,
          ERROR_MESSAGES.GAME_FLOW_NOT_FOUND,
          requestId,
        );
      }

      return res.status(HTTP_STATUS.OK).json(gameFlow);
    } catch (error) {
      logger.error({ error, gameId: game_id, requestId }, 'Unhandled error in get game flow');
      return sendErrorResponse(
        res,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.SERVER_ERROR,
        ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        requestId,
      );
    }
  },
);

/**
 * Route: GET /
 * Description:
 * - Retrieves all game flows with optional filtering by quiz_set_id
 * - Supports pagination with limit and offset parameters
 * - Returns paginated results with total count
 *
 * Query Parameters:
 * - quiz_set_id (string, optional): Filter by quiz set ID
 * - limit (string, optional): Number of results per page (default: 50, max: 100)
 * - offset (string, optional): Number of results to skip (default: 0)
 *
 * Returns:
 * - 200: Paginated game flows with metadata
 * - 400: Invalid pagination parameters
 * - 500: Database or server error
 */
router.get('/', gameFlowRateLimit, authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const query = req.query as PaginationQuery;

  try {
    const paginationParams = parsePaginationParams(query);
    if (!paginationParams) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_REQUEST,
        paginationParams === null
          ? ERROR_MESSAGES.LIMIT_MUST_BE_BETWEEN_1_AND_100
          : ERROR_MESSAGES.OFFSET_MUST_BE_NON_NEGATIVE,
        requestId,
      );
    }

    const result = await fetchGameFlows(query.quiz_set_id, paginationParams);
    if (!result) {
      return sendErrorResponse(
        res,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        ERROR_MESSAGES.FAILED_TO_FETCH_GAME_FLOWS,
        requestId,
      );
    }

    return res.status(HTTP_STATUS.OK).json({
      game_flows: result.gameFlows,
      total: result.total,
      limit: paginationParams.limit,
      offset: paginationParams.offset,
    });
  } catch (error) {
    logger.error({ error, requestId }, 'Unhandled error in get game flows');
    return sendErrorResponse(
      res,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.SERVER_ERROR,
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    );
  }
});

/**
 * Route: POST /:game_id/flow/advance
 * Description:
 * - Advances game flow to the next question
 * - Increments current_question_index by 1
 * - Uses gameFlowService for business logic
 *
 * Parameters:
 * - game_id (string): Unique identifier for the game
 *
 * Returns:
 * - 200: Success message with updated game flow
 * - 400: Invalid request or operation failed
 * - 404: Game flow not found
 * - 500: Server error
 */
router.post(
  '/:game_id/flow/advance',
  gameFlowRateLimit,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { game_id } = req.params;

    try {
      if (!validateGameId(game_id)) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INVALID_REQUEST,
          ERROR_MESSAGES.GAME_ID_REQUIRED,
          requestId,
        );
      }

      const currentFlow = await gameFlowService.getGameFlow(game_id);
      if (!currentFlow.success || !currentFlow.gameFlow) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND,
          ERROR_MESSAGES.GAME_FLOW_NOT_FOUND,
          requestId,
        );
      }

      const result = await gameFlowService.updateGameFlow(game_id, {
        current_question_index: currentFlow.gameFlow.current_question_index + 1,
      });

      if (!result.success) {
        logger.warn({ gameId: game_id, error: result.error }, 'Failed to advance question');
        return sendErrorResponse(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.OPERATION_FAILED,
          result.error || ERROR_MESSAGES.FAILED_TO_ADVANCE_QUESTION,
          requestId,
        );
      }

      return res.status(HTTP_STATUS.OK).json({
        message: SUCCESS_MESSAGES.ADVANCED_TO_NEXT_QUESTION,
        gameFlow: result.gameFlow,
      });
    } catch (error) {
      logger.error({ error, gameId: game_id, requestId }, 'Error advancing question');
      return sendErrorResponse(
        res,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.SERVER_ERROR,
        ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        requestId,
      );
    }
  },
);

/**
 * Route: PATCH /:game_id/flow
 * Description:
 * - Updates game flow with allowed fields
 * - Only specific fields can be updated for security
 * - Automatically sets updated_at timestamp
 *
 * Parameters:
 * - game_id (string): Unique identifier for the game
 *
 * Body:
 * - current_question_index (number, optional): New question index
 * - current_question_id (string | null, optional): Current question ID
 * - next_question_id (string | null, optional): Next question ID
 * - current_question_start_time (string | null, optional): Question start time
 * - current_question_end_time (string | null, optional): Question end time
 *
 * Returns:
 * - 200: Updated game flow object
 * - 400: Invalid request or no valid fields to update
 * - 500: Database or server error
 */
router.patch(
  '/:game_id/flow',
  gameFlowRateLimit,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { game_id } = req.params;
    const updates = req.body as GameFlowUpdateBody;

    try {
      if (!validateGameId(game_id)) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INVALID_REQUEST,
          ERROR_MESSAGES.GAME_ID_REQUIRED,
          requestId,
        );
      }

      const updateData = extractAllowedUpdateFields(updates);
      if (Object.keys(updateData).length === 0) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INVALID_REQUEST,
          ERROR_MESSAGES.NO_VALID_FIELDS_TO_UPDATE,
          requestId,
        );
      }

      const updatedFlow = await updateGameFlow(game_id, updateData);
      if (!updatedFlow) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.DATABASE_ERROR,
          ERROR_MESSAGES.FAILED_TO_UPDATE_GAME_FLOW,
          requestId,
        );
      }

      return res.status(HTTP_STATUS.OK).json(updatedFlow);
    } catch (error) {
      logger.error({ error, gameId: game_id, requestId }, 'Error updating game flow');
      return sendErrorResponse(
        res,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.SERVER_ERROR,
        ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        requestId,
      );
    }
  },
);

/**
 * Route: DELETE /:game_id/flow
 * Description:
 * - Deletes game flow for a specific game
 * - Cascade deletes when game is deleted
 * - Uses gameFlowService for business logic
 *
 * Parameters:
 * - game_id (string): Unique identifier for the game
 *
 * Returns:
 * - 200: Success message
 * - 400: Invalid request or operation failed
 * - 500: Server error
 */
router.delete(
  '/:game_id/flow',
  gameFlowRateLimit,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { game_id } = req.params;

    try {
      if (!validateGameId(game_id)) {
        return sendErrorResponse(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INVALID_REQUEST,
          ERROR_MESSAGES.GAME_ID_REQUIRED,
          requestId,
        );
      }

      const result = await gameFlowService.deleteGameFlow(game_id);
      if (!result) {
        logger.warn({ gameId: game_id }, 'Failed to delete game flow');
        return sendErrorResponse(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.OPERATION_FAILED,
          ERROR_MESSAGES.FAILED_TO_DELETE_GAME_FLOW,
          requestId,
        );
      }

      return res.status(HTTP_STATUS.OK).json({
        message: SUCCESS_MESSAGES.GAME_FLOW_DELETED_SUCCESSFULLY,
      });
    } catch (error) {
      logger.error({ error, gameId: game_id, requestId }, 'Error deleting game flow');
      return sendErrorResponse(
        res,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.SERVER_ERROR,
        ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        requestId,
      );
    }
  },
);

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: validateGameId
 * Description:
 * - Validates that game_id is a non-empty string
 *
 * Parameters:
 * - game_id (unknown): Game ID to validate
 *
 * Returns:
 * - boolean: True if valid, false otherwise
 */
function validateGameId(game_id: unknown): game_id is string {
  return typeof game_id === 'string' && game_id.length > 0;
}

/**
 * Function: sendErrorResponse
 * Description:
 * - Sends a standardized error response
 *
 * Parameters:
 * - res (express.Response): Express response object
 * - status (number): HTTP status code
 * - errorCode (string): Error code identifier
 * - message (string): Error message
 * - requestId (string): Request ID for tracing
 *
 * Returns:
 * - express.Response: Response object with error JSON
 */
function sendErrorResponse(
  res: express.Response,
  status: number,
  errorCode: string,
  message: string,
  requestId: string,
): express.Response {
  return res.status(status).json({
    error: errorCode,
    message,
    requestId,
  });
}

/**
 * Function: fetchGameFlowByGameId
 * Description:
 * - Fetches a single game flow by game_id from database
 * - Handles database errors and returns null on failure
 *
 * Parameters:
 * - game_id (string): Game ID to fetch flow for
 *
 * Returns:
 * - Promise<unknown | null>: Game flow object or null if not found or error
 */
async function fetchGameFlowByGameId(game_id: string): Promise<unknown | null> {
  const { data: gameFlow, error } = await supabaseAdmin
    .from(TABLE_GAME_FLOWS)
    .select(SELECT_ALL)
    .eq('game_id', game_id)
    .maybeSingle();

  if (error) {
    logger.error({ error, gameId: game_id }, 'Error fetching game flow');
    return null;
  }

  return gameFlow;
}

/**
 * Function: parsePaginationParams
 * Description:
 * - Parses and validates pagination query parameters
 * - Returns null if validation fails
 *
 * Parameters:
 * - query (PaginationQuery): Query parameters from request
 *
 * Returns:
 * - PaginationParams | null: Parsed pagination params or null if invalid
 */
function parsePaginationParams(query: PaginationQuery): PaginationParams | null {
  const limitStr = query.limit ?? String(DEFAULT_PAGINATION_LIMIT);
  const offsetStr = query.offset ?? String(DEFAULT_PAGINATION_OFFSET);

  const limitNum = parseInt(limitStr, 10);
  const offsetNum = parseInt(offsetStr, 10);

  if (isNaN(limitNum) || limitNum < MIN_PAGINATION_LIMIT || limitNum > MAX_PAGINATION_LIMIT) {
    return null;
  }

  if (isNaN(offsetNum) || offsetNum < MIN_PAGINATION_OFFSET) {
    return null;
  }

  return { limit: limitNum, offset: offsetNum };
}

/**
 * Function: fetchGameFlows
 * Description:
 * - Fetches paginated game flows with optional quiz_set_id filter
 * - Returns null on database error
 *
 * Parameters:
 * - quiz_set_id (string | undefined): Optional quiz set ID filter
 * - pagination (PaginationParams): Pagination parameters
 *
 * Returns:
 * - Promise<{ gameFlows: unknown[]; total: number } | null>: Game flows with total count or null on error
 */
async function fetchGameFlows(
  quiz_set_id: string | undefined,
  pagination: PaginationParams,
): Promise<{ gameFlows: unknown[]; total: number } | null> {
  let query = supabaseAdmin
    .from(TABLE_GAME_FLOWS)
    .select('*, games(game_code, status)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (quiz_set_id) {
    query = query.eq('quiz_set_id', quiz_set_id);
  }

  const { data: gameFlows, error, count } = await query;

  if (error) {
    logger.error({ error }, 'Error fetching game flows');
    return null;
  }

  return {
    gameFlows: gameFlows || [],
    total: count || 0,
  };
}

/**
 * Function: extractAllowedUpdateFields
 * Description:
 * - Extracts and validates allowed fields from update request body
 * - Only includes fields that are in ALLOWED_UPDATE_FIELDS
 * - Validates current_question_index is a number if present
 *
 * Parameters:
 * - updates (GameFlowUpdateBody): Update request body
 *
 * Returns:
 * - Record<string, unknown>: Object containing only allowed update fields
 */
function extractAllowedUpdateFields(updates: GameFlowUpdateBody): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if ('current_question_index' in updates && typeof updates.current_question_index === 'number') {
    updateData.current_question_index = updates.current_question_index;
  }

  if ('current_question_id' in updates) {
    updateData.current_question_id = updates.current_question_id;
  }

  if ('next_question_id' in updates) {
    updateData.next_question_id = updates.next_question_id;
  }

  if ('current_question_start_time' in updates) {
    updateData.current_question_start_time = updates.current_question_start_time;
  }

  if ('current_question_end_time' in updates) {
    updateData.current_question_end_time = updates.current_question_end_time;
  }

  return updateData;
}

/**
 * Function: updateGameFlow
 * Description:
 * - Updates game flow in database with provided data
 * - Automatically sets updated_at timestamp
 * - Returns null on database error
 *
 * Parameters:
 * - game_id (string): Game ID to update flow for
 * - updateData (Record<string, unknown>): Fields to update
 *
 * Returns:
 * - Promise<unknown | null>: Updated game flow or null on error
 */
async function updateGameFlow(
  game_id: string,
  updateData: Record<string, unknown>,
): Promise<unknown | null> {
  updateData.updated_at = new Date().toISOString();

  const { data: updatedFlow, error } = await supabaseAdmin
    .from(TABLE_GAME_FLOWS)
    .update(updateData)
    .eq('game_id', game_id)
    .select()
    .single();

  if (error) {
    logger.error({ error, gameId: game_id }, 'Error updating game flow');
    return null;
  }

  return updatedFlow;
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
