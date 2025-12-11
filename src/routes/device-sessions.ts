// src/routes/device-sessions.ts
import express from 'express';
import { ZodError } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { GetDeviceSessionsSchema, UpdateDeviceSessionSchema } from '../types/websocket';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /
 * Get all device sessions with optional filtering
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Validate and parse query parameters
    const validation = GetDeviceSessionsSchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Invalid query parameters',
        details: validation.error.issues,
        requestId,
      });
    }

    const { user_id, limit, offset } = validation.data;

    // Build query
    let query = supabaseAdmin
      .from('device_sessions')
      .select('*', { count: 'exact' })
      .order('last_seen', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data: sessions, error, count } = await query;

    if (error) {
      logger.error({ error, requestId }, 'Error fetching device sessions');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch device sessions',
        requestId,
      });
    }

    return res.status(200).json({
      sessions: sessions || [],
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

    logger.error({ error, requestId }, 'Unhandled error in get device sessions');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * GET /:device_id
 * Get a specific device session by device_id
 */
router.get('/:device_id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { device_id } = req.params;

  try {
    if (!device_id) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'device_id is required',
        requestId,
      });
    }

    const { data: session, error } = await supabaseAdmin
      .from('device_sessions')
      .select('*')
      .eq('device_id', device_id)
      .maybeSingle();

    if (error) {
      logger.error({ error, deviceId: device_id, requestId }, 'Error fetching device session');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch device session',
        requestId,
      });
    }

    if (!session) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Device session not found',
        requestId,
      });
    }

    return res.status(200).json(session);
  } catch (error) {
    logger.error({ error, deviceId: device_id, requestId }, 'Error in get device session');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * PATCH /:device_id
 * Update device session metadata
 */
router.patch('/:device_id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { device_id } = req.params;

  try {
    if (!device_id) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'device_id is required',
        requestId,
      });
    }

    // Validate request body
    const validation = UpdateDeviceSessionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request body',
        details: validation.error.issues,
        requestId,
      });
    }

    const updates = validation.data;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'No fields to update',
        requestId,
      });
    }

    // Check if device session exists
    const { data: existingSession, error: fetchError } = await supabaseAdmin
      .from('device_sessions')
      .select('id')
      .eq('device_id', device_id)
      .maybeSingle();

    if (fetchError) {
      logger.error(
        { error: fetchError, deviceId: device_id, requestId },
        'Error checking device session',
      );
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to check device session',
        requestId,
      });
    }

    if (!existingSession) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Device session not found',
        requestId,
      });
    }

    // Update the session
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('device_sessions')
      .update(updates)
      .eq('device_id', device_id)
      .select()
      .single();

    if (updateError) {
      logger.error(
        { error: updateError, deviceId: device_id, requestId },
        'Error updating device session',
      );
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to update device session',
        requestId,
      });
    }

    return res.status(200).json(updatedSession);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request body',
        details: error.issues,
        requestId,
      });
    }

    logger.error({ error, deviceId: device_id, requestId }, 'Error in update device session');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * GET /:device_id/connections
 * Get all WebSocket connections for a specific device
 */
router.get('/:device_id/connections', authMiddleware, async (req: AuthenticatedRequest, res) => {
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
 * GET /stats/summary
 * Get summary statistics for all device sessions
 */
router.get('/stats/summary', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Get total device sessions count
    const { count: totalDevices, error: countError } = await supabaseAdmin
      .from('device_sessions')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      logger.error({ error: countError, requestId }, 'Error fetching device count');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch device statistics',
        requestId,
      });
    }

    // Get total connections and reconnections
    const { data: aggregates, error: aggError } = await supabaseAdmin
      .from('device_sessions')
      .select('total_connections, total_reconnections');

    if (aggError) {
      logger.error({ error: aggError, requestId }, 'Error fetching aggregates');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch connection statistics',
        requestId,
      });
    }

    const totalConnections =
      aggregates?.reduce((sum, session) => sum + (session.total_connections || 0), 0) || 0;
    const totalReconnections =
      aggregates?.reduce((sum, session) => sum + (session.total_reconnections || 0), 0) || 0;

    return res.status(200).json({
      total_devices: totalDevices || 0,
      total_connections: totalConnections,
      total_reconnections: totalReconnections,
      average_connections_per_device: totalDevices
        ? (totalConnections / totalDevices).toFixed(2)
        : '0.00',
      reconnection_rate: totalConnections
        ? ((totalReconnections / totalConnections) * 100).toFixed(2)
        : '0.00',
    });
  } catch (error) {
    logger.error({ error, requestId }, 'Error getting device stats');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

export default router;
