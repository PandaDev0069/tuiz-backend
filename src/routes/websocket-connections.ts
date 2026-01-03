// ====================================================
// File Name   : websocket-connections.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Express routes for WebSocket connection management
// - Provides endpoints for querying and retrieving connection data
// - Supports filtering, pagination, and statistics

// Notes:
// - All routes require authentication via authMiddleware
// - Uses request ID from headers for request tracking
// - Supports filtering by device_id, user_id, and status
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { ZodError } from 'zod';

import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';

import type { AuthenticatedRequest } from '../types/auth';
import { GetWebSocketConnectionsSchema } from '../types/websocket';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_WEBSOCKET_CONNECTIONS = 'websocket_connections';

const COLUMN_ID = 'id';
const COLUMN_DEVICE_ID = 'device_id';
const COLUMN_USER_ID = 'user_id';
const COLUMN_STATUS = 'status';
const COLUMN_CONNECTED_AT = 'connected_at';
const SELECT_ALL = '*';

const STATUS_ACTIVE = 'active';
const STATUS_DISCONNECTED = 'disconnected';
const STATUS_TIMEOUT = 'timeout';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_OK = 200;

const DEFAULT_LIMIT_STRING = '50';
const DEFAULT_OFFSET_STRING = '0';
const PARSE_INT_BASE = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const MIN_OFFSET = 0;
const DEFAULT_COUNT = 0;
const EMPTY_ARRAY: unknown[] = [];

const ERROR_CODES = {
  INVALID_REQUEST: 'invalid_request',
  DATABASE_ERROR: 'database_error',
  VALIDATION_ERROR: 'validation_error',
  SERVER_ERROR: 'server_error',
  NOT_FOUND: 'not_found',
} as const;

const ERROR_MESSAGES = {
  INVALID_QUERY_PARAMETERS: 'Invalid query parameters',
  INVALID_REQUEST_PARAMETERS: 'Invalid request parameters',
  FAILED_FETCH_CONNECTIONS: 'Failed to fetch websocket connections',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  LIMIT_OUT_OF_RANGE: 'Limit must be between 1 and 100',
  OFFSET_MUST_BE_NON_NEGATIVE: 'Offset must be non-negative',
  DEVICE_ID_REQUIRED: 'device_id is required',
  FAILED_FETCH_ACTIVE_CONNECTIONS: 'Failed to fetch active connections',
  FAILED_FETCH_DEVICE_CONNECTIONS: 'Failed to fetch device connections',
  FAILED_FETCH_CONNECTION_STATS: 'Failed to fetch connection stats',
  CONNECTION_ID_REQUIRED: 'connection_id is required',
  FAILED_FETCH_CONNECTION: 'Failed to fetch connection',
  CONNECTION_NOT_FOUND: 'Connection not found',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_CONNECTIONS: 'Error fetching websocket connections',
  UNHANDLED_ERROR_GET_CONNECTIONS: 'Unhandled error in get websocket connections',
  ERROR_FETCHING_ACTIVE_CONNECTIONS: 'Error fetching active connections',
  UNHANDLED_ERROR_GET_ACTIVE: 'Unhandled error in get active connections',
  ERROR_FETCHING_DEVICE_CONNECTIONS: 'Error fetching device connections',
  ERROR_IN_GET_DEVICE_CONNECTIONS: 'Error in get device connections',
  ERROR_FETCHING_STATS: 'Error fetching connection stats',
  ERROR_GETTING_STATS: 'Error getting connection stats',
  ERROR_FETCHING_CONNECTION: 'Error fetching connection',
  ERROR_IN_GET_CONNECTION: 'Error in get connection',
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
 * Route: GET /
 * Description:
 * - Get WebSocket connections with filtering
 * - Supports filtering by device_id, user_id, status
 * - Returns paginated results with total count
 *
 * Parameters:
 * - req.query: Query parameters (device_id, user_id, status, limit, offset)
 *
 * Returns:
 * - JSON response with connections array, total count, limit, and offset
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';

  try {
    const validation = GetWebSocketConnectionsSchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.INVALID_QUERY_PARAMETERS,
        details: validation.error.issues,
        requestId,
      });
    }

    const { device_id, user_id, status, limit, offset } = validation.data;

    let query = supabaseAdmin
      .from(TABLE_WEBSOCKET_CONNECTIONS)
      .select(SELECT_ALL, { count: 'exact' })
      .order(COLUMN_CONNECTED_AT, { ascending: false })
      .range(offset, offset + limit - 1);

    if (device_id) {
      query = query.eq(COLUMN_DEVICE_ID, device_id);
    }

    if (user_id) {
      query = query.eq(COLUMN_USER_ID, user_id);
    }

    if (status) {
      query = query.eq(COLUMN_STATUS, status);
    }

    const { data: connections, error, count } = await query;

    if (error) {
      logger.error({ error, requestId }, LOG_MESSAGES.ERROR_FETCHING_CONNECTIONS);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_FETCH_CONNECTIONS,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      connections: connections || EMPTY_ARRAY,
      total: count || DEFAULT_COUNT,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.INVALID_REQUEST_PARAMETERS,
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, requestId }, LOG_MESSAGES.UNHANDLED_ERROR_GET_CONNECTIONS);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: GET /active
 * Description:
 * - Get only active WebSocket connections
 * - Returns paginated results with total count
 *
 * Parameters:
 * - req.query: Query parameters (limit, offset)
 *
 * Returns:
 * - JSON response with active connections array, total count, limit, and offset
 */
router.get('/active', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const limit = (req.query.limit as string) || DEFAULT_LIMIT_STRING;
  const offset = (req.query.offset as string) || DEFAULT_OFFSET_STRING;

  try {
    const limitNum = parseInt(limit as string, PARSE_INT_BASE);
    const offsetNum = parseInt(offset as string, PARSE_INT_BASE);

    if (isNaN(limitNum) || limitNum < MIN_LIMIT || limitNum > MAX_LIMIT) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.LIMIT_OUT_OF_RANGE,
        requestId,
      });
    }

    if (isNaN(offsetNum) || offsetNum < MIN_OFFSET) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.OFFSET_MUST_BE_NON_NEGATIVE,
        requestId,
      });
    }

    const {
      data: connections,
      error,
      count,
    } = await supabaseAdmin
      .from(TABLE_WEBSOCKET_CONNECTIONS)
      .select(SELECT_ALL, { count: 'exact' })
      .eq(COLUMN_STATUS, STATUS_ACTIVE)
      .order(COLUMN_CONNECTED_AT, { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) {
      logger.error({ error, requestId }, LOG_MESSAGES.ERROR_FETCHING_ACTIVE_CONNECTIONS);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_FETCH_ACTIVE_CONNECTIONS,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      connections: connections || EMPTY_ARRAY,
      total: count || DEFAULT_COUNT,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    logger.error({ error, requestId }, LOG_MESSAGES.UNHANDLED_ERROR_GET_ACTIVE);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: GET /device/:device_id
 * Description:
 * - Get connection history for a specific device
 * - Returns paginated results with total count
 *
 * Parameters:
 * - req.params.device_id: Device identifier
 * - req.query: Query parameters (limit, offset)
 *
 * Returns:
 * - JSON response with connections array, total count, limit, and offset
 */
router.get('/device/:device_id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { device_id } = req.params;
  const limit = (req.query.limit as string) || DEFAULT_LIMIT_STRING;
  const offset = (req.query.offset as string) || DEFAULT_OFFSET_STRING;

  try {
    if (!device_id) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.DEVICE_ID_REQUIRED,
        requestId,
      });
    }

    const limitNum = parseInt(limit as string, PARSE_INT_BASE);
    const offsetNum = parseInt(offset as string, PARSE_INT_BASE);

    const {
      data: connections,
      error,
      count,
    } = await supabaseAdmin
      .from(TABLE_WEBSOCKET_CONNECTIONS)
      .select(SELECT_ALL, { count: 'exact' })
      .eq(COLUMN_DEVICE_ID, device_id)
      .order(COLUMN_CONNECTED_AT, { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) {
      logger.error(
        { error, deviceId: device_id, requestId },
        LOG_MESSAGES.ERROR_FETCHING_DEVICE_CONNECTIONS,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_FETCH_DEVICE_CONNECTIONS,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      connections: connections || EMPTY_ARRAY,
      total: count || DEFAULT_COUNT,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    logger.error(
      { error, deviceId: device_id, requestId },
      LOG_MESSAGES.ERROR_IN_GET_DEVICE_CONNECTIONS,
    );
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: GET /stats
 * Description:
 * - Get connection statistics by status
 * - Returns counts for active, disconnected, and timeout connections
 *
 * Returns:
 * - JSON response with status counts and total
 */
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';

  try {
    const [activeResult, disconnectedResult, timeoutResult] = await Promise.all([
      supabaseAdmin
        .from(TABLE_WEBSOCKET_CONNECTIONS)
        .select(COLUMN_ID, { count: 'exact', head: true })
        .eq(COLUMN_STATUS, STATUS_ACTIVE),
      supabaseAdmin
        .from(TABLE_WEBSOCKET_CONNECTIONS)
        .select(COLUMN_ID, { count: 'exact', head: true })
        .eq(COLUMN_STATUS, STATUS_DISCONNECTED),
      supabaseAdmin
        .from(TABLE_WEBSOCKET_CONNECTIONS)
        .select(COLUMN_ID, { count: 'exact', head: true })
        .eq(COLUMN_STATUS, STATUS_TIMEOUT),
    ]);

    if (activeResult.error || disconnectedResult.error || timeoutResult.error) {
      logger.error({ requestId }, LOG_MESSAGES.ERROR_FETCHING_STATS);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_FETCH_CONNECTION_STATS,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      active: activeResult.count || DEFAULT_COUNT,
      disconnected: disconnectedResult.count || DEFAULT_COUNT,
      timeout: timeoutResult.count || DEFAULT_COUNT,
      total:
        (activeResult.count || DEFAULT_COUNT) +
        (disconnectedResult.count || DEFAULT_COUNT) +
        (timeoutResult.count || DEFAULT_COUNT),
    });
  } catch (error) {
    logger.error({ error, requestId }, LOG_MESSAGES.ERROR_GETTING_STATS);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: GET /:connection_id
 * Description:
 * - Get specific connection by ID
 * - Returns single connection object
 *
 * Parameters:
 * - req.params.connection_id: Connection identifier
 *
 * Returns:
 * - JSON response with connection object or 404 if not found
 */
router.get('/:connection_id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = (req.headers['x-request-id'] as string) || '';
  const { connection_id } = req.params;

  try {
    if (!connection_id) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.CONNECTION_ID_REQUIRED,
        requestId,
      });
    }

    const { data: connection, error } = await supabaseAdmin
      .from(TABLE_WEBSOCKET_CONNECTIONS)
      .select(SELECT_ALL)
      .eq(COLUMN_ID, connection_id)
      .maybeSingle();

    if (error) {
      logger.error(
        { error, connectionId: connection_id, requestId },
        LOG_MESSAGES.ERROR_FETCHING_CONNECTION,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_FETCH_CONNECTION,
        requestId,
      });
    }

    if (!connection) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.CONNECTION_NOT_FOUND,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(connection);
  } catch (error) {
    logger.error(
      { error, connectionId: connection_id, requestId },
      LOG_MESSAGES.ERROR_IN_GET_CONNECTION,
    );
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
