// src/routes/websocket-connections.ts
import express from 'express';
import { ZodError } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { GetWebSocketConnectionsSchema } from '../types/websocket';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /
 * Get WebSocket connections with filtering
 * Supports filtering by device_id, user_id, status
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Validate and parse query parameters
    const validation = GetWebSocketConnectionsSchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Invalid query parameters',
        details: validation.error.issues,
        requestId,
      });
    }

    const { device_id, user_id, status, limit, offset } = validation.data;

    // Build query
    let query = supabaseAdmin
      .from('websocket_connections')
      .select('*', { count: 'exact' })
      .order('connected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (device_id) {
      query = query.eq('device_id', device_id);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: connections, error, count } = await query;

    if (error) {
      logger.error({ error, requestId }, 'Error fetching websocket connections');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch websocket connections',
        requestId,
      });
    }

    return res.status(200).json({
      connections: connections || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request parameters',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, requestId }, 'Unhandled error in get websocket connections');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * GET /active
 * Get only active WebSocket connections
 */
router.get('/active', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { limit = '50', offset = '0' } = req.query;

  try {
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Limit must be between 1 and 100',
        requestId,
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Offset must be non-negative',
        requestId,
      });
    }

    const {
      data: connections,
      error,
      count,
    } = await supabaseAdmin
      .from('websocket_connections')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('connected_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) {
      logger.error({ error, requestId }, 'Error fetching active connections');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch active connections',
        requestId,
      });
    }

    return res.status(200).json({
      connections: connections || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    logger.error({ error, requestId }, 'Unhandled error in get active connections');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * GET /device/:device_id
 * Get connection history for a specific device
 */
router.get('/device/:device_id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { device_id } = req.params;
  const { limit = '50', offset = '0' } = req.query;

  try {
    if (!device_id) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'device_id is required',
        requestId,
      });
    }

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    const {
      data: connections,
      error,
      count,
    } = await supabaseAdmin
      .from('websocket_connections')
      .select('*', { count: 'exact' })
      .eq('device_id', device_id)
      .order('connected_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) {
      logger.error({ error, deviceId: device_id, requestId }, 'Error fetching device connections');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch device connections',
        requestId,
      });
    }

    return res.status(200).json({
      connections: connections || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    logger.error({ error, deviceId: device_id, requestId }, 'Error in get device connections');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * GET /stats
 * Get connection statistics
 */
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Get counts for each status
    const [activeResult, disconnectedResult, timeoutResult] = await Promise.all([
      supabaseAdmin
        .from('websocket_connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabaseAdmin
        .from('websocket_connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'disconnected'),
      supabaseAdmin
        .from('websocket_connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'timeout'),
    ]);

    if (activeResult.error || disconnectedResult.error || timeoutResult.error) {
      logger.error({ requestId }, 'Error fetching connection stats');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch connection stats',
        requestId,
      });
    }

    return res.status(200).json({
      active: activeResult.count || 0,
      disconnected: disconnectedResult.count || 0,
      timeout: timeoutResult.count || 0,
      total:
        (activeResult.count || 0) + (disconnectedResult.count || 0) + (timeoutResult.count || 0),
    });
  } catch (error) {
    logger.error({ error, requestId }, 'Error getting connection stats');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * GET /:connection_id
 * Get specific connection by ID
 */
router.get('/:connection_id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { connection_id } = req.params;

  try {
    if (!connection_id) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'connection_id is required',
        requestId,
      });
    }

    const { data: connection, error } = await supabaseAdmin
      .from('websocket_connections')
      .select('*')
      .eq('id', connection_id)
      .maybeSingle();

    if (error) {
      logger.error({ error, connectionId: connection_id, requestId }, 'Error fetching connection');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch connection',
        requestId,
      });
    }

    if (!connection) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Connection not found',
        requestId,
      });
    }

    return res.status(200).json(connection);
  } catch (error) {
    logger.error({ error, connectionId: connection_id, requestId }, 'Error in get connection');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

export default router;
