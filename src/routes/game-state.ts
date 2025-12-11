import { Router } from 'express';
import type { Request, Response } from 'express';

import { supabaseAdmin } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { gameFlowService } from '../services/gameFlowService.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /games/:gameId/start
 * Start a game - moves status from WAITING to ACTIVE
 */
router.post('/:gameId/start', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.user?.id;

    // Verify game exists and belongs to user
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .eq('user_id', userId)
      .single();

    if (gameError || !game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found or unauthorized',
      });
    }

    // Check if game is already started
    if (game.status !== 'waiting') {
      return res.status(400).json({
        error: 'invalid_state',
        message: `Cannot start game in ${game.status} state`,
      });
    }

    // Update game status to active
    const { data: updatedGame, error: updateError } = await supabaseAdmin
      .from('games')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, gameId }, 'Failed to start game');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to start game',
      });
    }

    logger.info({ gameId, userId }, 'Game started successfully');
    return res.status(200).json(updatedGame);
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to start game',
    });
  }
});

/**
 * POST /games/:gameId/questions/start
 * Start a specific question
 */
router.post(
  '/:gameId/questions/start',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId } = req.params;
      const { questionId, questionIndex } = req.body;
      const userId = req.user?.id;

      if (!questionId) {
        return res.status(400).json({
          error: 'invalid_payload',
          message: 'questionId is required',
        });
      }

      // Verify game ownership
      const { data: game, error: gameError } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', gameId)
        .eq('user_id', userId)
        .single();

      if (gameError || !game) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Game not found or unauthorized',
        });
      }

      // Update game flow
      const result = await gameFlowService.updateGameFlow(gameId, {
        current_question_id: questionId,
        current_question_index: questionIndex !== undefined ? questionIndex : undefined,
        current_question_start_time: new Date().toISOString(),
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'update_failed',
          message: result.error,
        });
      }

      // Also update current_question_index in games table
      await supabaseAdmin
        .from('games')
        .update({
          current_question_index: questionIndex,
        })
        .eq('id', gameId);

      logger.info({ gameId, questionId, questionIndex }, 'Question started');
      return res.status(200).json(result.gameFlow);
    } catch {
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to start question',
      });
    }
  },
);

/**
 * POST /games/:gameId/questions/reveal
 * Trigger answer reveal for current question
 */
router.post(
  '/:gameId/questions/reveal',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.id;

      // Verify game ownership
      const { data: game, error: gameError } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', gameId)
        .eq('user_id', userId)
        .single();

      if (gameError || !game) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Game not found or unauthorized',
        });
      }

      // Update game flow with end time
      const result = await gameFlowService.updateGameFlow(gameId, {
        current_question_end_time: new Date().toISOString(),
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'update_failed',
          message: result.error,
        });
      }

      logger.info({ gameId }, 'Answer reveal triggered');
      return res.status(200).json({
        message: 'Answer reveal triggered',
        gameFlow: result.gameFlow,
      });
    } catch {
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to trigger answer reveal',
      });
    }
  },
);

/**
 * PATCH /games/:gameId/status
 * Update game status (pause, resume, end)
 */
router.patch(
  '/:gameId/status',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId } = req.params;
      const { status, action } = req.body;
      const userId = req.user?.id;

      // Validate status or action
      if (!status && !action) {
        return res.status(400).json({
          error: 'invalid_payload',
          message: 'status or action is required',
        });
      }

      // Verify game ownership
      const { data: game, error: gameError } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', gameId)
        .eq('user_id', userId)
        .single();

      if (gameError || !game) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Game not found or unauthorized',
        });
      }

      const updateData: Record<string, unknown> = {};

      // Handle action-based updates
      if (action === 'pause') {
        updateData.status = 'paused';
        updateData.paused_at = new Date().toISOString();
      } else if (action === 'resume') {
        updateData.status = 'active';
        updateData.resumed_at = new Date().toISOString();
      } else if (action === 'end') {
        updateData.status = 'completed';
        updateData.ended_at = new Date().toISOString();
      } else if (status) {
        // Direct status update
        updateData.status = status;

        if (status === 'completed' && !game.ended_at) {
          updateData.ended_at = new Date().toISOString();
        }
      }

      // Update game
      const { data: updatedGame, error: updateError } = await supabaseAdmin
        .from('games')
        .update(updateData)
        .eq('id', gameId)
        .select()
        .single();

      if (updateError) {
        logger.error({ error: updateError, gameId }, 'Failed to update game status');
        return res.status(500).json({
          error: 'update_failed',
          message: 'Failed to update game status',
        });
      }

      logger.info({ gameId, status, action }, 'Game status updated');
      return res.status(200).json(updatedGame);
    } catch {
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to update game status',
      });
    }
  },
);

/**
 * GET /games/:gameId/state
 * Get current game state including flow information
 */
router.get('/:gameId/state', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // Get game details
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found',
      });
    }

    // Get game flow
    const flowResult = await gameFlowService.getGameFlow(gameId);

    if (!flowResult.success) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game flow not found',
      });
    }

    return res.status(200).json({
      game,
      gameFlow: flowResult.gameFlow,
    });
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to get game state',
    });
  }
});

/**
 * GET /games/:gameId
 * Get game details
 */
router.get('/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    const { data: game, error } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found',
      });
    }

    return res.status(200).json(game);
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to get game',
    });
  }
});

/**
 * PATCH /games/:gameId/lock
 * Lock or unlock the game room
 */
router.patch('/:gameId/lock', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const { locked } = req.body;
    const userId = req.user?.id;

    if (typeof locked !== 'boolean') {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'locked must be a boolean',
      });
    }

    // Verify game ownership
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .eq('user_id', userId)
      .single();

    if (gameError || !game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found or unauthorized',
      });
    }

    // Update lock status
    const { data: updatedGame, error: updateError } = await supabaseAdmin
      .from('games')
      .update({ locked })
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, gameId }, 'Failed to update lock status');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to update lock status',
      });
    }

    logger.info({ gameId, locked }, 'Game lock status updated');
    return res.status(200).json(updatedGame);
  } catch {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to update lock status',
    });
  }
});

export default router;
