// ====================================================
// File Name   : room-participants.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-12

// Description:
// - Express routes for room participant management
// - Handles participant CRUD operations and room reconnection
// - Provides endpoints for querying participants and device history

// Notes:
// - Some routes require authentication via authMiddleware
// - Supports participant reconnection and status updates
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
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

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_OK = 200;

const DEFAULT_LIMIT = 10;
const DEFAULT_COUNT = 0;

const ERROR_CODES = {
  INVALID_PAYLOAD: 'invalid_payload',
  ADD_PARTICIPANT_FAILED: 'add_participant_failed',
  SERVER_ERROR: 'server_error',
  INVALID_QUERY: 'invalid_query',
  FETCH_FAILED: 'fetch_failed',
  NOT_FOUND: 'not_found',
  REJOIN_FAILED: 'rejoin_failed',
  UPDATE_FAILED: 'update_failed',
  REMOVE_FAILED: 'remove_failed',
} as const;

const ERROR_MESSAGES = {
  INVALID_REQUEST_DATA: 'Invalid request data',
  INVALID_QUERY_PARAMETERS: 'Invalid query parameters',
  FAILED_TO_ADD_PARTICIPANT: 'Failed to add participant',
  FAILED_TO_FETCH_PARTICIPANTS: 'Failed to fetch participants',
  FAILED_TO_FETCH_SUMMARY: 'Failed to fetch participants summary',
  FAILED_TO_FETCH_PARTICIPANT: 'Failed to fetch participant',
  FAILED_TO_REJOIN_ROOM: 'Failed to rejoin room',
  FAILED_TO_UPDATE_STATUS: 'Failed to update participant status',
  FAILED_TO_REMOVE_PARTICIPANT: 'Failed to remove participant',
  FAILED_TO_FETCH_DEVICE_HISTORY: 'Failed to fetch device history',
} as const;

const SUCCESS_MESSAGES = {
  PARTICIPANT_REMOVED: 'Participant removed successfully',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = Router();
const roomParticipantService = getRoomParticipantService(supabase);

/**
 * Route: POST /:gameId/participants
 * Description:
 * - Add a participant to a room
 * - Validates request payload and creates participant record
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.body: Participant data (validated by CreateRoomParticipantSchema)
 *
 * Returns:
 * - JSON response with created participant object
 */
router.post('/:gameId/participants', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const validation = CreateRoomParticipantSchema.safeParse({
      ...req.body,
      game_id: gameId,
    });

    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: validation.error.issues[0]?.message || ERROR_MESSAGES.INVALID_REQUEST_DATA,
      });
    }

    const result = await roomParticipantService.addParticipant(validation.data);

    if (!result.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.ADD_PARTICIPANT_FAILED,
        message: result.error,
      });
    }

    return res.status(HTTP_STATUS_CREATED).json(result.participant);
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_ADD_PARTICIPANT,
    });
  }
});

/**
 * Route: GET /:gameId/participants
 * Description:
 * - Get all participants for a game
 * - Supports query parameters for filtering and pagination
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.query: Query parameters (validated by ParticipantQuerySchema)
 *
 * Returns:
 * - JSON response with participants array and total count
 */
router.get('/:gameId/participants', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const validation = ParticipantQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_QUERY,
        message: validation.error.issues[0]?.message || ERROR_MESSAGES.INVALID_QUERY_PARAMETERS,
      });
    }

    const result = await roomParticipantService.getGameParticipants(gameId, validation.data);

    if (!result.success) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.FETCH_FAILED,
        message: result.error,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      game_id: gameId,
      participants: result.participants,
      total: result.participants?.length || DEFAULT_COUNT,
    });
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PARTICIPANTS,
    });
  }
});

/**
 * Route: GET /:gameId/participants/summary
 * Description:
 * - Get active participants summary for a game
 * - Returns aggregated statistics for active participants
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with participants summary object
 */
router.get('/:gameId/participants/summary', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const result = await roomParticipantService.getActiveParticipantsSummary(gameId);

    if (!result.success) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.FETCH_FAILED,
        message: result.error,
      });
    }

    return res.status(HTTP_STATUS_OK).json(result.summary);
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_SUMMARY,
    });
  }
});

/**
 * Route: GET /:gameId/participants/socket/:socketId
 * Description:
 * - Get participant by socket ID
 * - Retrieves participant information using WebSocket socket identifier
 *
 * Parameters:
 * - req.params.socketId: Socket identifier
 *
 * Returns:
 * - JSON response with participant object
 */
router.get('/:gameId/participants/socket/:socketId', async (req: Request, res: Response) => {
  try {
    const { socketId } = req.params;
    const result = await roomParticipantService.getParticipantBySocketId(socketId);

    if (!result.success) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: result.error,
      });
    }

    return res.status(HTTP_STATUS_OK).json(result.participant);
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_PARTICIPANT,
    });
  }
});

/**
 * Route: POST /:gameId/participants/:playerId/rejoin
 * Description:
 * - Rejoin a room (reconnection support)
 * - Allows participants to reconnect to a room after disconnection
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.playerId: Player identifier
 * - req.body: Rejoin data (validated by RejoinRoomSchema)
 *
 * Returns:
 * - JSON response with updated participant object
 */
router.post('/:gameId/participants/:playerId/rejoin', async (req: Request, res: Response) => {
  try {
    const { gameId, playerId } = req.params;
    const validation = RejoinRoomSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: validation.error.issues[0]?.message || ERROR_MESSAGES.INVALID_REQUEST_DATA,
      });
    }

    const result = await roomParticipantService.rejoinRoom(gameId, playerId, validation.data);

    if (!result.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.REJOIN_FAILED,
        message: result.error,
      });
    }

    return res.status(HTTP_STATUS_OK).json(result.participant);
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_REJOIN_ROOM,
    });
  }
});

/**
 * Route: PATCH /:gameId/participants/:participantId/status
 * Description:
 * - Update participant status (authenticated)
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.params.participantId: Participant identifier
 * - req.body: Status update data (validated by UpdateParticipantStatusSchema)
 *
 * Returns:
 * - JSON response with updated participant object
 */
router.patch(
  '/:gameId/participants/:participantId/status',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { participantId } = req.params;
      const validation = UpdateParticipantStatusSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_PAYLOAD,
          message: validation.error.issues[0]?.message || ERROR_MESSAGES.INVALID_REQUEST_DATA,
        });
      }

      const result = await roomParticipantService.updateParticipantStatus(
        participantId,
        validation.data,
      );

      if (!result.success) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.UPDATE_FAILED,
          message: result.error,
        });
      }

      return res.status(HTTP_STATUS_OK).json(result.participant);
    } catch {
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_UPDATE_STATUS,
      });
    }
  },
);

/**
 * Route: DELETE /:gameId/participants/:participantId
 * Description:
 * - Remove a participant from a room (authenticated)
 * - Requires authentication via authMiddleware
 *
 * Parameters:
 * - req.params.participantId: Participant identifier
 *
 * Returns:
 * - JSON response with success message
 */
router.delete(
  '/:gameId/participants/:participantId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { participantId } = req.params;
      const result = await roomParticipantService.removeParticipant(participantId);

      if (!result.success) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.REMOVE_FAILED,
          message: result.error,
        });
      }

      return res.status(HTTP_STATUS_OK).json({ message: SUCCESS_MESSAGES.PARTICIPANT_REMOVED });
    } catch {
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_REMOVE_PARTICIPANT,
      });
    }
  },
);

/**
 * Route: GET /device/:deviceId/history
 * Description:
 * - Get participant history for a device
 * - Retrieves historical participant records for a specific device
 *
 * Parameters:
 * - req.params.deviceId: Device identifier
 * - req.query.limit: Optional limit for number of records (default: 10)
 *
 * Returns:
 * - JSON response with device history array and count
 */
router.get('/device/:deviceId/history', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;

    const result = await roomParticipantService.getDeviceParticipantHistory(deviceId, limit);

    if (!result.success) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.FETCH_FAILED,
        message: result.error,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      device_id: deviceId,
      history: result.participants,
      count: result.participants?.length || DEFAULT_COUNT,
    });
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_DEVICE_HISTORY,
    });
  }
});

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
