// src/routes/game-flows.ts
import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { gameFlowRateLimit } from '../middleware/rateLimit';
import { gameFlowService } from '../services/gameFlowService';
import { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /:game_id/flow
 * Get game flow for a specific game
 */
router.get(
  '/:game_id/flow',
  gameFlowRateLimit,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { game_id } = req.params;

    try {
      // Validate game_id format
      if (!game_id || typeof game_id !== 'string') {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'Invalid game_id format',
          requestId,
        });
      }

      // Fetch game flow
      const { data: gameFlow, error } = await supabaseAdmin
        .from('game_flows')
        .select('*')
        .eq('game_id', game_id)
        .maybeSingle();

      if (error) {
        logger.error({ error, gameId: game_id, requestId }, 'Error fetching game flow');
        return res.status(500).json({
          error: 'database_error',
          message: 'Failed to fetch game flow',
          requestId,
        });
      }

      if (!gameFlow) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Game flow not found',
          requestId,
        });
      }

      return res.status(200).json(gameFlow);
    } catch (error) {
      logger.error({ error, gameId: game_id, requestId }, 'Unhandled error in get game flow');
      return res.status(500).json({
        error: 'server_error',
        message: 'Internal server error',
        requestId,
      });
    }
  },
);

/**
 * GET /
 * Get all game flows (optionally filtered by quiz_set_id)
 */
router.get('/', gameFlowRateLimit, authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { quiz_set_id, limit = '50', offset = '0' } = req.query;

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

    let query = supabaseAdmin
      .from('game_flows')
      .select('*, games(game_code, status)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (quiz_set_id) {
      query = query.eq('quiz_set_id', quiz_set_id as string);
    }

    const { data: gameFlows, error, count } = await query;

    if (error) {
      logger.error({ error, requestId }, 'Error fetching game flows');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch game flows',
        requestId,
      });
    }

    return res.status(200).json({
      game_flows: gameFlows || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    logger.error({ error, requestId }, 'Unhandled error in get game flows');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * POST /:game_id/flow/advance
 * Advance to next question using gameFlowService
 */
router.post(
  '/:game_id/flow/advance',
  gameFlowRateLimit,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { game_id } = req.params;

    try {
      if (!game_id) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'game_id is required',
          requestId,
        });
      }

      // Get current flow first
      const currentFlow = await gameFlowService.getGameFlow(game_id);
      if (!currentFlow.success || !currentFlow.gameFlow) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Game flow not found',
          requestId,
        });
      }

      // Advance to next question
      const result = await gameFlowService.updateGameFlow(game_id, {
        current_question_index: currentFlow.gameFlow.current_question_index + 1,
      });
      if (!result.success) {
        logger.warn({ gameId: game_id, error: result.error }, 'Failed to advance question');
        return res.status(400).json({
          error: 'operation_failed',
          message: result.error || 'Failed to advance question',
          requestId,
        });
      }

      return res.status(200).json({
        message: 'Successfully advanced to next question',
        gameFlow: result.gameFlow,
      });
    } catch (error) {
      logger.error({ error, gameId: game_id, requestId }, 'Error advancing question');
      return res.status(500).json({
        error: 'server_error',
        message: 'Internal server error',
        requestId,
      });
    }
  },
);

/**
 * PATCH /:game_id/flow
 * Update game flow (current question index, timing, etc.)
 */
router.patch(
  '/:game_id/flow',
  gameFlowRateLimit,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { game_id } = req.params;
    const updates = req.body;

    try {
      if (!game_id) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'game_id is required',
          requestId,
        });
      }

      // Only allow specific fields to be updated - safely extract allowed properties
      const updateData: Record<string, unknown> = {};

      if (
        'current_question_index' in updates &&
        typeof updates.current_question_index === 'number'
      ) {
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

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'No valid fields to update',
          requestId,
        });
      }

      updateData.updated_at = new Date().toISOString();

      const { data: updatedFlow, error } = await supabaseAdmin
        .from('game_flows')
        .update(updateData)
        .eq('game_id', game_id)
        .select()
        .single();

      if (error) {
        logger.error({ error, gameId: game_id, requestId }, 'Error updating game flow');
        return res.status(500).json({
          error: 'database_error',
          message: 'Failed to update game flow',
          requestId,
        });
      }

      return res.status(200).json(updatedFlow);
    } catch (error) {
      logger.error({ error, gameId: game_id, requestId }, 'Error updating game flow');
      return res.status(500).json({
        error: 'server_error',
        message: 'Internal server error',
        requestId,
      });
    }
  },
);

/**
 * DELETE /:game_id/flow
 * Delete game flow (cascade deletes when game is deleted)
 */
router.delete(
  '/:game_id/flow',
  gameFlowRateLimit,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const requestId = req.headers['x-request-id'] as string;
    const { game_id } = req.params;

    try {
      if (!game_id) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'game_id is required',
          requestId,
        });
      }

      const result = await gameFlowService.deleteGameFlow(game_id);

      if (!result) {
        logger.warn({ gameId: game_id }, 'Failed to delete game flow');
        return res.status(400).json({
          error: 'operation_failed',
          message: 'Failed to delete game flow',
          requestId,
        });
      }

      return res.status(200).json({
        message: 'Game flow deleted successfully',
      });
    } catch (error) {
      logger.error({ error, gameId: game_id, requestId }, 'Error deleting game flow');
      return res.status(500).json({
        error: 'server_error',
        message: 'Internal server error',
        requestId,
      });
    }
  },
);

export default router;
