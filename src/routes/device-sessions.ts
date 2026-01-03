// ====================================================
// File Name   : device-sessions.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - Express router for device session management endpoints
// - Handles CRUD operations for device sessions
// - Manages WebSocket connection tracking and statistics
// - Provides endpoints for device session queries and updates

// Notes:
// - All endpoints require authentication via authMiddleware
// - Uses Zod schemas for request validation
// - Supports pagination and filtering for device sessions
// - Provides statistics endpoints for device session analytics
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { ZodError } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { GetDeviceSessionsSchema, UpdateDeviceSessionSchema } from '../types/websocket';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const DEFAULT_PAGINATION_LIMIT = 50;
const DEFAULT_PAGINATION_OFFSET = 0;
const MIN_PAGINATION_LIMIT = 1;
const MAX_PAGINATION_LIMIT = 100;
const MIN_PAGINATION_OFFSET = 0;

const DECIMAL_PLACES = 2;
const PERCENTAGE_MULTIPLIER = 100;

const TABLE_DEVICE_SESSIONS = 'device_sessions';
const TABLE_WEBSOCKET_CONNECTIONS = 'websocket_connections';
const SELECT_ALL = '*';

const ERROR_CODES = {
  INVALID_REQUEST: 'invalid_request',
  VALIDATION_ERROR: 'validation_error',
  DATABASE_ERROR: 'database_error',
  SERVER_ERROR: 'server_error',
  NOT_FOUND: 'not_found',
} as const;

const ERROR_MESSAGES = {
  INVALID_QUERY_PARAMETERS: 'Invalid query parameters',
  INVALID_REQUEST_PARAMETERS: 'Invalid request parameters',
  DEVICE_ID_REQUIRED: 'device_id is required',
  INVALID_REQUEST_BODY: 'Invalid request body',
  NO_FIELDS_TO_UPDATE: 'No fields to update',
  DEVICE_SESSION_NOT_FOUND: 'Device session not found',
  FAILED_TO_FETCH_DEVICE_SESSIONS: 'Failed to fetch device sessions',
  FAILED_TO_FETCH_DEVICE_SESSION: 'Failed to fetch device session',
  FAILED_TO_CHECK_DEVICE_SESSION: 'Failed to check device session',
  FAILED_TO_UPDATE_DEVICE_SESSION: 'Failed to update device session',
  FAILED_TO_FETCH_DEVICE_CONNECTIONS: 'Failed to fetch device connections',
  LIMIT_MUST_BE_BETWEEN_1_AND_100: 'Limit must be between 1 and 100',
  OFFSET_MUST_BE_NON_NEGATIVE: 'Offset must be non-negative',
  FAILED_TO_FETCH_DEVICE_STATISTICS: 'Failed to fetch device statistics',
  FAILED_TO_FETCH_CONNECTION_STATISTICS: 'Failed to fetch connection statistics',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_DEVICE_SESSIONS: 'Error fetching device sessions',
  UNHANDLED_ERROR_GET_DEVICE_SESSIONS: 'Unhandled error in get device sessions',
  ERROR_FETCHING_DEVICE_SESSION: 'Error fetching device session',
  ERROR_GET_DEVICE_SESSION: 'Error in get device session',
  ERROR_CHECKING_DEVICE_SESSION: 'Error checking device session',
  ERROR_UPDATING_DEVICE_SESSION: 'Error updating device session',
  ERROR_UPDATE_DEVICE_SESSION: 'Error in update device session',
  ERROR_FETCHING_DEVICE_CONNECTIONS: 'Error fetching device connections',
  ERROR_GET_DEVICE_CONNECTIONS: 'Error in get device connections',
  ERROR_FETCHING_DEVICE_COUNT: 'Error fetching device count',
  ERROR_FETCHING_AGGREGATES: 'Error fetching aggregates',
  ERROR_GETTING_DEVICE_STATS: 'Error getting device stats',
} as const;

const DEFAULT_ZERO_STRING = '0.00';

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
 * - Get all device sessions with optional filtering
 * - Supports pagination and user_id filtering
 * - Requires authentication via authMiddleware
 *
 * Query Parameters:
 * - user_id (string, optional): Filter by user ID
 * - limit (number, optional): Number of results per page
 * - offset (number, optional): Number of results to skip
 *
 * Returns:
 * - 200: Paginated device sessions with metadata
 * - 400: Invalid query parameters
 * - 500: Server error
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;

  try {
    const validation = GetDeviceSessionsSchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.INVALID_QUERY_PARAMETERS,
        details: validation.error.issues,
        requestId,
      });
    }

    const { user_id, limit, offset } = validation.data;

    let query = supabaseAdmin
      .from(TABLE_DEVICE_SESSIONS)
      .select(SELECT_ALL, { count: 'exact' })
      .order('last_seen', { ascending: false })
      .range(offset, offset + limit - 1);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data: sessions, error, count } = await query;

    if (error) {
      logger.error({ error, requestId }, LOG_MESSAGES.ERROR_FETCHING_DEVICE_SESSIONS);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_DEVICE_SESSIONS,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      sessions: sessions || [],
      total: count || 0,
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

    logger.error({ error, requestId }, LOG_MESSAGES.UNHANDLED_ERROR_GET_DEVICE_SESSIONS);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: GET /:device_id
 * Description:
 * - Get a specific device session by device_id
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.params.device_id: Device identifier
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Device session object
 * - 400: Invalid device_id
 * - 404: Device session not found
 * - 500: Server error
 */
router.get('/:device_id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { device_id } = req.params;

  try {
    if (!device_id) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.DEVICE_ID_REQUIRED,
        requestId,
      });
    }

    const { data: session, error } = await supabaseAdmin
      .from(TABLE_DEVICE_SESSIONS)
      .select(SELECT_ALL)
      .eq('device_id', device_id)
      .maybeSingle();

    if (error) {
      logger.error(
        { error, deviceId: device_id, requestId },
        LOG_MESSAGES.ERROR_FETCHING_DEVICE_SESSION,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_DEVICE_SESSION,
        requestId,
      });
    }

    if (!session) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.DEVICE_SESSION_NOT_FOUND,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(session);
  } catch (error) {
    logger.error({ error, deviceId: device_id, requestId }, LOG_MESSAGES.ERROR_GET_DEVICE_SESSION);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: PATCH /:device_id
 * Description:
 * - Update device session metadata
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.params.device_id: Device identifier
 * - req.body: Update data (validated by UpdateDeviceSessionSchema)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Updated device session object
 * - 400: Invalid request or validation error
 * - 404: Device session not found
 * - 500: Server error
 */
router.patch('/:device_id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { device_id } = req.params;

  try {
    if (!device_id) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.DEVICE_ID_REQUIRED,
        requestId,
      });
    }

    const validation = UpdateDeviceSessionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
        details: validation.error.issues,
        requestId,
      });
    }

    const updates = validation.data;

    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.NO_FIELDS_TO_UPDATE,
        requestId,
      });
    }

    const { data: existingSession, error: fetchError } = await supabaseAdmin
      .from(TABLE_DEVICE_SESSIONS)
      .select('id')
      .eq('device_id', device_id)
      .maybeSingle();

    if (fetchError) {
      logger.error(
        { error: fetchError, deviceId: device_id, requestId },
        LOG_MESSAGES.ERROR_CHECKING_DEVICE_SESSION,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_CHECK_DEVICE_SESSION,
        requestId,
      });
    }

    if (!existingSession) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.DEVICE_SESSION_NOT_FOUND,
        requestId,
      });
    }

    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from(TABLE_DEVICE_SESSIONS)
      .update(updates)
      .eq('device_id', device_id)
      .select()
      .single();

    if (updateError) {
      logger.error(
        { error: updateError, deviceId: device_id, requestId },
        LOG_MESSAGES.ERROR_UPDATING_DEVICE_SESSION,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_UPDATE_DEVICE_SESSION,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json(updatedSession);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
        details: error.issues,
        requestId,
      });
    }

    logger.error(
      { error, deviceId: device_id, requestId },
      LOG_MESSAGES.ERROR_UPDATE_DEVICE_SESSION,
    );
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: GET /:device_id/connections
 * Description:
 * - Get all WebSocket connections for a specific device
 * - Supports pagination with limit and offset
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.params.device_id: Device identifier
 * - req.query.limit (string, optional): Number of results per page (default: 50, max: 100)
 * - req.query.offset (string, optional): Number of results to skip (default: 0)
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Paginated WebSocket connections with metadata
 * - 400: Invalid request or pagination parameters
 * - 500: Server error
 */
router.get('/:device_id/connections', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { device_id } = req.params;
  const { limit = String(DEFAULT_PAGINATION_LIMIT), offset = String(DEFAULT_PAGINATION_OFFSET) } =
    req.query;

  try {
    if (!device_id) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.DEVICE_ID_REQUIRED,
        requestId,
      });
    }

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    if (isNaN(limitNum) || limitNum < MIN_PAGINATION_LIMIT || limitNum > MAX_PAGINATION_LIMIT) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.LIMIT_MUST_BE_BETWEEN_1_AND_100,
        requestId,
      });
    }

    if (isNaN(offsetNum) || offsetNum < MIN_PAGINATION_OFFSET) {
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
      .eq('device_id', device_id)
      .order('connected_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) {
      logger.error(
        { error, deviceId: device_id, requestId },
        LOG_MESSAGES.ERROR_FETCHING_DEVICE_CONNECTIONS,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_DEVICE_CONNECTIONS,
        requestId,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      connections: connections || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    logger.error(
      { error, deviceId: device_id, requestId },
      LOG_MESSAGES.ERROR_GET_DEVICE_CONNECTIONS,
    );
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

/**
 * Route: GET /stats/summary
 * Description:
 * - Get summary statistics for all device sessions
 * - Calculates total devices, connections, reconnections, and rates
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.headers['x-request-id']: Request identifier for tracing
 *
 * Returns:
 * - 200: Device session statistics summary
 * - 500: Server error
 */
router.get('/stats/summary', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;

  try {
    const { count: totalDevices, error: countError } = await supabaseAdmin
      .from(TABLE_DEVICE_SESSIONS)
      .select('id', { count: 'exact', head: true });

    if (countError) {
      logger.error({ error: countError, requestId }, LOG_MESSAGES.ERROR_FETCHING_DEVICE_COUNT);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_DEVICE_STATISTICS,
        requestId,
      });
    }

    const { data: aggregates, error: aggError } = await supabaseAdmin
      .from(TABLE_DEVICE_SESSIONS)
      .select('total_connections, total_reconnections');

    if (aggError) {
      logger.error({ error: aggError, requestId }, LOG_MESSAGES.ERROR_FETCHING_AGGREGATES);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DATABASE_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_CONNECTION_STATISTICS,
        requestId,
      });
    }

    const totalConnections =
      aggregates?.reduce((sum, session) => sum + (session.total_connections || 0), 0) || 0;
    const totalReconnections =
      aggregates?.reduce((sum, session) => sum + (session.total_reconnections || 0), 0) || 0;

    return res.status(HTTP_STATUS_OK).json({
      total_devices: totalDevices || 0,
      total_connections: totalConnections,
      total_reconnections: totalReconnections,
      average_connections_per_device: totalDevices
        ? (totalConnections / totalDevices).toFixed(DECIMAL_PLACES)
        : DEFAULT_ZERO_STRING,
      reconnection_rate: totalConnections
        ? ((totalReconnections / totalConnections) * PERCENTAGE_MULTIPLIER).toFixed(DECIMAL_PLACES)
        : DEFAULT_ZERO_STRING,
    });
  } catch (error) {
    logger.error({ error, requestId }, LOG_MESSAGES.ERROR_GETTING_DEVICE_STATS);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
// No helper functions - all logic in route handlers

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
