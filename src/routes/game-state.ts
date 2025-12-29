import { Router } from 'express';
import type { Request, Response } from 'express';

import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { wsManager } from '../server';
import { gameFlowService } from '../services/gameFlowService';
import type { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /games/:gameId/start
 * Start a game - moves status from WAITING to ACTIVE
 * Initializes game flow with first question and prepares for game loop
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

    // Get game flow to access quiz_set_id
    const flowResult = await gameFlowService.getGameFlow(gameId);
    if (!flowResult.success || !flowResult.gameFlow) {
      logger.error({ gameId, error: flowResult.error }, 'Failed to fetch game flow');
      return res.status(500).json({
        error: 'flow_not_found',
        message: 'Game flow not found. Cannot initialize game.',
      });
    }

    const gameFlow = flowResult.gameFlow;

    // Fetch all questions from the quiz set, ordered by order_index
    // Filter out deleted questions
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('id, order_index')
      .eq('question_set_id', gameFlow.quiz_set_id)
      .is('deleted_at', null)
      .order('order_index', { ascending: true });

    if (questionsError) {
      logger.error(
        { error: questionsError, gameId, quizSetId: gameFlow.quiz_set_id },
        'Failed to fetch questions',
      );
      return res.status(500).json({
        error: 'questions_fetch_failed',
        message: 'Failed to fetch questions for quiz',
      });
    }

    if (!questions || questions.length === 0) {
      logger.warn({ gameId, quizSetId: gameFlow.quiz_set_id }, 'No questions found in quiz set');
      return res.status(400).json({
        error: 'no_questions',
        message: 'Quiz set has no questions. Cannot start game.',
      });
    }

    // Initialize question tracking
    const firstQuestion = questions[0];
    const secondQuestion = questions.length > 1 ? questions[1] : null;

    // Update game flow with first question
    const flowUpdateResult = await gameFlowService.updateGameFlow(gameId, {
      current_question_id: firstQuestion.id,
      current_question_index: 0,
      next_question_id: secondQuestion?.id || null,
      current_question_start_time: null, // Will be set when question actually starts
      current_question_end_time: null,
    });

    if (!flowUpdateResult.success) {
      logger.error({ gameId, error: flowUpdateResult.error }, 'Failed to update game flow');
      return res.status(500).json({
        error: 'flow_update_failed',
        message: 'Failed to initialize game flow',
      });
    }

    // Update game status to active and set current_question_index
    const { data: updatedGame, error: updateError } = await supabaseAdmin
      .from('games')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        current_question_index: 0,
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

    logger.info(
      {
        gameId,
        userId,
        firstQuestionId: firstQuestion.id,
        nextQuestionId: secondQuestion?.id || null,
        totalQuestions: questions.length,
      },
      'Game started successfully with question initialization',
    );

    return res.status(200).json({
      ...updatedGame,
      gameFlow: flowUpdateResult.gameFlow,
      initializedQuestions: {
        current: firstQuestion.id,
        next: secondQuestion?.id || null,
        total: questions.length,
      },
    });
  } catch (error) {
    logger.error({ error, gameId: req.params.gameId }, 'Unexpected error starting game');
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

      // Fetch question to get duration
      const { data: question, error: questionError } = await supabaseAdmin
        .from('questions')
        .select('show_question_time, answering_time')
        .eq('id', questionId)
        .single();

      if (questionError || !question) {
        logger.error({ error: questionError, questionId }, 'Failed to fetch question for duration');
        return res.status(404).json({
          error: 'not_found',
          message: 'Question not found',
        });
      }

      // Calculate server timestamps
      const serverTime = new Date();
      const startTime = serverTime.toISOString();
      // Total duration is show_question_time (viewing) + answering_time (answering)
      const showTime = question.show_question_time || 10;
      const answeringTime = question.answering_time || 30;
      const totalDurationSeconds = showTime + answeringTime;
      const durationMs = totalDurationSeconds * 1000;
      const endTime = new Date(serverTime.getTime() + durationMs).toISOString();

      // Update game flow with server timestamp
      const result = await gameFlowService.updateGameFlow(gameId, {
        current_question_id: questionId,
        current_question_index: questionIndex !== undefined ? questionIndex : undefined,
        current_question_start_time: startTime,
        current_question_end_time: endTime,
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

      // Emit WebSocket event with server timestamps
      const startsAt = serverTime.getTime();
      const endsAt = serverTime.getTime() + durationMs;
      wsManager.broadcastToRoom(gameId, 'game:question:started', {
        roomId: gameId,
        question: { id: questionId, index: questionIndex },
        startsAt,
        endsAt,
      });

      logger.info(
        {
          gameId,
          questionId,
          questionIndex,
          startsAt,
          endsAt,
          durationMs,
        },
        'Question started with server timestamps',
      );

      return res.status(200).json({
        ...result.gameFlow,
        server_time: startTime,
        starts_at: startsAt,
        ends_at: endsAt,
        duration_ms: durationMs,
      });
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

      // Get current game flow to get question ID
      const flowResult = await gameFlowService.getGameFlow(gameId);
      if (!flowResult.success || !flowResult.gameFlow) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Game flow not found',
        });
      }

      const gameFlow = flowResult.gameFlow;
      const currentQuestionId = gameFlow.current_question_id;

      if (!currentQuestionId) {
        return res.status(400).json({
          error: 'invalid_state',
          message: 'No active question to reveal',
        });
      }

      // Update game flow with end time (locks answer submissions)
      const result = await gameFlowService.updateGameFlow(gameId, {
        current_question_end_time: new Date().toISOString(),
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'update_failed',
          message: result.error,
        });
      }

      // Calculate final answer statistics for this question
      let answerStats: Record<string, number> = {};
      try {
        const { data: allReports, error: reportsError } = await supabaseAdmin
          .from('game_player_data')
          .select('answer_report')
          .eq('game_id', gameId);

        if (!reportsError && allReports) {
          answerStats = (allReports as { answer_report: unknown }[]).reduce(
            (acc, row) => {
              const report = row.answer_report as {
                questions?: Array<{ question_id: string; answer_id: string | null }>;
              };
              (report?.questions || []).forEach((q) => {
                if (q.question_id === currentQuestionId && q.answer_id) {
                  acc[q.answer_id] = (acc[q.answer_id] || 0) + 1;
                }
              });
              return acc;
            },
            {} as Record<string, number>,
          );
        }
      } catch (statsError) {
        logger.warn(
          { error: statsError, gameId, questionId: currentQuestionId },
          'Failed to calculate answer statistics',
        );
        // Continue even if stats calculation fails
      }

      // Emit WebSocket events
      try {
        // Emit question ended event
        wsManager.broadcastToRoom(gameId, 'game:question:ended', {
          roomId: gameId,
          questionId: currentQuestionId,
        });

        // Emit answer locked event with final statistics
        wsManager.broadcastToRoom(gameId, 'game:answer:locked', {
          roomId: gameId,
          questionId: currentQuestionId,
          counts: answerStats,
        });

        // Emit final answer stats update
        wsManager.broadcastToRoom(gameId, 'game:answer:stats:update', {
          roomId: gameId,
          questionId: currentQuestionId,
          counts: answerStats,
        });
      } catch (wsError) {
        logger.warn(
          { error: wsError, gameId },
          'Failed to emit WebSocket events (answer was still revealed)',
        );
        // Continue even if WebSocket emission fails
      }

      logger.info(
        { gameId, questionId: currentQuestionId, answerStats },
        'Answer reveal triggered',
      );
      return res.status(200).json({
        message: 'Answer reveal triggered',
        gameFlow: result.gameFlow,
        answerStats,
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
 * POST /games/:gameId/questions/next
 * Advance to the next question (updates game_flows with next question info)
 */
router.post(
  '/:gameId/questions/next',
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

      // Get current game flow
      const flowResult = await gameFlowService.getGameFlow(gameId);
      if (!flowResult.success || !flowResult.gameFlow) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Game flow not found',
        });
      }

      const gameFlow = flowResult.gameFlow;
      const currentIndex = gameFlow.current_question_index ?? 0;

      // Fetch all questions to get the next one
      const { data: questions, error: questionsError } = await supabaseAdmin
        .from('questions')
        .select('id, order_index')
        .eq('question_set_id', gameFlow.quiz_set_id)
        .is('deleted_at', null)
        .order('order_index', { ascending: true });

      if (questionsError || !questions) {
        logger.error({ error: questionsError, gameId }, 'Failed to fetch questions');
        return res.status(500).json({
          error: 'questions_fetch_failed',
          message: 'Failed to fetch questions',
        });
      }

      const nextIndex = currentIndex + 1;
      // Safe: nextIndex is validated against questions.length before use
      // eslint-disable-next-line security/detect-object-injection
      const nextQuestion = questions[nextIndex];
      const questionAfterNext = questions[nextIndex + 1] || null;

      if (!nextQuestion) {
        // No more questions - game is complete
        const endResult = await gameFlowService.updateGameFlow(gameId, {
          current_question_id: null,
          next_question_id: null,
          current_question_start_time: null,
          current_question_end_time: null,
        });

        // Update game status to finished
        await supabaseAdmin
          .from('games')
          .update({
            status: 'finished',
            ended_at: new Date().toISOString(),
          })
          .eq('id', gameId);

        // Emit game end event via phase change
        wsManager.broadcastToRoom(gameId, 'game:phase:change', {
          roomId: gameId,
          phase: 'ended',
        });

        logger.info({ gameId }, 'Game completed - no more questions');
        return res.status(200).json({
          message: 'Game completed',
          gameFlow: endResult.gameFlow,
          isComplete: true,
        });
      }

      // Update game flow with next question info (but don't start it yet)
      const updateResult = await gameFlowService.updateGameFlow(gameId, {
        current_question_id: nextQuestion.id,
        current_question_index: nextIndex,
        next_question_id: questionAfterNext?.id || null,
        current_question_start_time: null, // Will be set when question actually starts
        current_question_end_time: null,
      });

      if (!updateResult.success) {
        return res.status(500).json({
          error: 'update_failed',
          message: updateResult.error,
        });
      }

      // Update games table
      await supabaseAdmin
        .from('games')
        .update({
          current_question_index: nextIndex,
        })
        .eq('id', gameId);

      // Emit phase change to countdown
      wsManager.broadcastToRoom(gameId, 'game:phase:change', {
        roomId: gameId,
        phase: 'countdown',
      });

      logger.info(
        {
          gameId,
          nextQuestionId: nextQuestion.id,
          nextIndex,
          totalQuestions: questions.length,
        },
        'Advanced to next question',
      );

      return res.status(200).json({
        message: 'Advanced to next question',
        gameFlow: updateResult.gameFlow,
        nextQuestion: {
          id: nextQuestion.id,
          index: nextIndex,
        },
        isComplete: false,
      });
    } catch (error) {
      logger.error(
        { error, gameId: req.params.gameId },
        'Unexpected error advancing to next question',
      );
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to advance to next question',
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
 * GET /games/:gameId/questions/current
 * Get current question with full metadata (images, answers, etc.)
 * Public endpoint - accessible by all players
 */
router.get('/:gameId/questions/current', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // Get game flow to find current question
    const flowResult = await gameFlowService.getGameFlow(gameId);

    if (!flowResult.success || !flowResult.gameFlow) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game flow not found',
      });
    }

    const gameFlow = flowResult.gameFlow;

    if (!gameFlow.current_question_id) {
      return res.status(404).json({
        error: 'no_question',
        message: 'No current question active',
      });
    }

    // Fetch question with answers
    const { data: question, error: questionError } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('id', gameFlow.current_question_id)
      .is('deleted_at', null)
      .single();

    if (questionError || !question) {
      logger.error(
        { error: questionError, questionId: gameFlow.current_question_id },
        'Failed to fetch question',
      );
      return res.status(404).json({
        error: 'not_found',
        message: 'Question not found',
      });
    }

    // Fetch answers for this question
    const { data: answers, error: answersError } = await supabaseAdmin
      .from('answers')
      .select('*')
      .eq('question_id', question.id)
      .order('order_index', { ascending: true });

    if (answersError) {
      logger.error({ error: answersError, questionId: question.id }, 'Failed to fetch answers');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch answers',
      });
    }

    // Calculate server time and remaining time
    const serverTime = new Date().toISOString();
    let remainingMs = 0;
    let isActive = false;

    if (gameFlow.current_question_start_time) {
      const startTime = new Date(gameFlow.current_question_start_time).getTime();
      const now = Date.now();
      // Total duration is show_question_time + answering_time
      const totalDurationMs = (question.show_question_time + question.answering_time) * 1000;
      const elapsed = now - startTime;
      remainingMs = Math.max(0, totalDurationMs - elapsed);
      isActive = remainingMs > 0;
    }

    return res.status(200).json({
      question: {
        id: question.id,
        text: question.question_text,
        image_url: question.image_url,
        type: question.question_type,
        time_limit: question.show_question_time,
        answering_time: question.answering_time,
        points: question.points,
        difficulty: question.difficulty,
        explanation_title: question.explanation_title,
        explanation_text: question.explanation_text,
        explanation_image_url: question.explanation_image_url,
        show_explanation_time: question.show_explanation_time,
      },
      answers: (answers || []).map((answer) => ({
        id: answer.id,
        text: answer.answer_text,
        image_url: answer.image_url,
        is_correct: answer.is_correct,
        order_index: answer.order_index,
      })),
      question_index: gameFlow.current_question_index,
      total_questions: gameFlow.total_questions,
      server_time: serverTime,
      start_time: gameFlow.current_question_start_time,
      remaining_ms: remainingMs,
      is_active: isActive,
    });
  } catch (error) {
    logger.error(
      { error, gameId: req.params.gameId },
      'Unexpected error fetching current question',
    );
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to get current question',
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
