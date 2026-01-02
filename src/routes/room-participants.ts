import { Router } from 'express';
import type { Request, Response } from 'express';

import { supabase } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { getRoomParticipantService } from '../services/roomParticipantService';
import {
  CreateRoomParticipantSchema,
  UpdateParticipantStatusSchema,
  ParticipantQuerySchema,
  RejoinRoomSchema,
} from '../types/roomParticipant';

const router = Router();
const roomParticipantService = getRoomParticipantService(supabase);

/**
 * POST /games/:gameId/participants
 * Add a participant to a room
 */
router.post('/:gameId/participants', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const validation = CreateRoomParticipantSchema.safeParse({
      ...req.body,
      game_id: gameId,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: validation.error.issues[0]?.message || 'Invalid request data',
      });
    }

    const result = await roomParticipantService.addParticipant(validation.data);

    if (!result.success) {
      return res.status(400).json({
        error: 'add_participant_failed',
        message: result.error,
      });
    }

    return res.status(201).json(result.participant);
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to add participant',
    });
  }
});

/**
 * GET /games/:gameId/participants
 * Get all participants for a game
 */
router.get('/:gameId/participants', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const validation = ParticipantQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_query',
        message: validation.error.issues[0]?.message || 'Invalid query parameters',
      });
    }

    const result = await roomParticipantService.getGameParticipants(gameId, validation.data);

    if (!result.success) {
      return res.status(404).json({
        error: 'fetch_failed',
        message: result.error,
      });
    }

    return res.status(200).json({
      game_id: gameId,
      participants: result.participants,
      total: result.participants?.length || 0,
    });
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch participants',
    });
  }
});

/**
 * GET /games/:gameId/participants/summary
 * Get active participants summary for a game
 */
router.get('/:gameId/participants/summary', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const result = await roomParticipantService.getActiveParticipantsSummary(gameId);

    if (!result.success) {
      return res.status(404).json({
        error: 'fetch_failed',
        message: result.error,
      });
    }

    return res.status(200).json(result.summary);
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch participants summary',
    });
  }
});

/**
 * GET /games/:gameId/participants/socket/:socketId
 * Get participant by socket ID
 */
router.get('/:gameId/participants/socket/:socketId', async (req: Request, res: Response) => {
  try {
    const { socketId } = req.params;
    const result = await roomParticipantService.getParticipantBySocketId(socketId);

    if (!result.success) {
      return res.status(404).json({
        error: 'not_found',
        message: result.error,
      });
    }

    return res.status(200).json(result.participant);
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch participant',
    });
  }
});

/**
 * POST /games/:gameId/participants/:playerId/rejoin
 * Rejoin a room (reconnection support)
 */
router.post('/:gameId/participants/:playerId/rejoin', async (req: Request, res: Response) => {
  try {
    const { gameId, playerId } = req.params;
    const validation = RejoinRoomSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: validation.error.issues[0]?.message || 'Invalid request data',
      });
    }

    const result = await roomParticipantService.rejoinRoom(gameId, playerId, validation.data);

    if (!result.success) {
      return res.status(400).json({
        error: 'rejoin_failed',
        message: result.error,
      });
    }

    return res.status(200).json(result.participant);
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to rejoin room',
    });
  }
});

/**
 * PATCH /games/:gameId/participants/:participantId/status
 * Update participant status (authenticated)
 */
router.patch(
  '/:gameId/participants/:participantId/status',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { participantId } = req.params;
      const validation = UpdateParticipantStatusSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'invalid_payload',
          message: validation.error.issues[0]?.message || 'Invalid request data',
        });
      }

      const result = await roomParticipantService.updateParticipantStatus(
        participantId,
        validation.data,
      );

      if (!result.success) {
        return res.status(400).json({
          error: 'update_failed',
          message: result.error,
        });
      }

      return res.status(200).json(result.participant);
    } catch {
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to update participant status',
      });
    }
  },
);

/**
 * DELETE /games/:gameId/participants/:participantId
 * Remove a participant from a room (authenticated)
 */
router.delete(
  '/:gameId/participants/:participantId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { participantId } = req.params;
      const result = await roomParticipantService.removeParticipant(participantId);

      if (!result.success) {
        return res.status(400).json({
          error: 'remove_failed',
          message: result.error,
        });
      }

      return res.status(200).json({ message: 'Participant removed successfully' });
    } catch {
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to remove participant',
      });
    }
  },
);

/**
 * GET /device/:deviceId/history
 * Get participant history for a device
 */
router.get('/device/:deviceId/history', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await roomParticipantService.getDeviceParticipantHistory(deviceId, limit);

    if (!result.success) {
      return res.status(404).json({
        error: 'fetch_failed',
        message: result.error,
      });
    }

    return res.status(200).json({
      device_id: deviceId,
      history: result.participants,
      count: result.participants?.length || 0,
    });
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch device history',
    });
  }
});

export default router;
