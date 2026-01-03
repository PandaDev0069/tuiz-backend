// ====================================================
// File Name   : game-state.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2026-01-03

// Description:
// - Express routes for game state management
// - Handles game start, question flow, answer reveal, explanations, and status updates
// - Manages game progression and WebSocket event broadcasting

// Notes:
// - Most routes require authentication (host only)
// - Some routes are public for player access
// - WebSocket events are broadcast to game rooms
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Router } from 'express';
import type { Request, Response } from 'express';

import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { gameFlowService } from '../services/gameFlowService';
import { requireWebSocketManager } from '../services/websocket';
import type { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_GAMES = 'games';
const TABLE_QUESTIONS = 'questions';
const TABLE_ANSWERS = 'answers';
const TABLE_GAME_PLAYER_DATA = 'game_player_data';

const COLUMN_ID = 'id';
const COLUMN_USER_ID = 'user_id';
const COLUMN_QUESTION_SET_ID = 'question_set_id';
const COLUMN_QUESTION_ID = 'question_id';
const COLUMN_DELETED_AT = 'deleted_at';
const COLUMN_ORDER_INDEX = 'order_index';
const COLUMN_GAME_ID = 'game_id';

const SELECT_ALL = '*';
const SELECT_QUESTION_IDS = 'id, order_index';
const SELECT_QUESTION_TIMING = 'show_question_time, answering_time';
const SELECT_GAME_BASIC = 'id, quiz_set_id';
const SELECT_EXPLANATION_FIELDS =
  'id, explanation_title, explanation_text, explanation_image_url, show_explanation_time';
const SELECT_ANSWER_REPORT = 'answer_report';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const DEFAULT_QUESTION_INDEX = 0;
const DEFAULT_SHOW_TIME = 10;
const DEFAULT_ANSWERING_TIME = 30;
const DEFAULT_EXPLANATION_TIME = 10;
const MILLISECONDS_PER_SECOND = 1000;
const LEADERBOARD_OFFSET = 0;
const LEADERBOARD_LIMIT = 100;
const MIN_INDEX = 0;
const EMPTY_ARRAY_LENGTH = 0;

const GAME_STATUS_WAITING = 'waiting';
const GAME_STATUS_ACTIVE = 'active';
const GAME_STATUS_PAUSED = 'paused';
const GAME_STATUS_FINISHED = 'finished';

const PHASE_ENDED = 'ended';
const PHASE_COUNTDOWN = 'countdown';

const ACTION_PAUSE = 'pause';
const ACTION_RESUME = 'resume';
const ACTION_END = 'end';

const ERROR_CODES = {
  NOT_FOUND: 'not_found',
  INVALID_STATE: 'invalid_state',
  FLOW_NOT_FOUND: 'flow_not_found',
  QUESTIONS_FETCH_FAILED: 'questions_fetch_failed',
  NO_QUESTIONS: 'no_questions',
  FLOW_UPDATE_FAILED: 'flow_update_failed',
  UPDATE_FAILED: 'update_failed',
  SERVER_ERROR: 'server_error',
  INVALID_PAYLOAD: 'invalid_payload',
  INVALID_INDEX: 'invalid_index',
  NO_EXPLANATION: 'no_explanation',
  DATABASE_ERROR: 'database_error',
  NO_QUESTION: 'no_question',
} as const;

const ERROR_MESSAGES = {
  GAME_NOT_FOUND_OR_UNAUTHORIZED: 'Game not found or unauthorized',
  CANNOT_START_GAME_IN_STATE: 'Cannot start game in',
  STATE: 'state',
  GAME_FLOW_NOT_FOUND_CANNOT_INITIALIZE: 'Game flow not found. Cannot initialize game.',
  FAILED_TO_FETCH_QUESTIONS_FOR_QUIZ: 'Failed to fetch questions for quiz',
  QUIZ_SET_HAS_NO_QUESTIONS: 'Quiz set has no questions. Cannot start game.',
  FAILED_TO_INITIALIZE_GAME_FLOW: 'Failed to initialize game flow',
  FAILED_TO_START_GAME: 'Failed to start game',
  FAILED_TO_START_QUESTION: 'Failed to start question',
  NO_ACTIVE_QUESTION_TO_REVEAL: 'No active question to reveal',
  FAILED_TO_TRIGGER_ANSWER_REVEAL: 'Failed to trigger answer reveal',
  NO_ACTIVE_QUESTION_TO_SHOW_EXPLANATION: 'No active question to show explanation for',
  FAILED_TO_SHOW_EXPLANATION: 'Failed to show explanation',
  NO_ACTIVE_QUESTION_TO_HIDE_EXPLANATION: 'No active question to hide explanation for',
  FAILED_TO_HIDE_EXPLANATION: 'Failed to hide explanation',
  GAME_NOT_FOUND: 'Game not found',
  QUESTION_NOT_FOUND: 'Question not found',
  NO_EXPLANATION_AVAILABLE: 'No explanation available for this question',
  FAILED_TO_FETCH_EXPLANATION: 'Failed to fetch explanation',
  CURRENT_QUESTION_INDEX_OUT_OF_BOUNDS: 'Current question index',
  IS_OUT_OF_BOUNDS_TOTAL: 'is out of bounds (total:',
  FAILED_TO_ADVANCE_TO_NEXT_QUESTION: 'Failed to advance to next question',
  STATUS_OR_ACTION_REQUIRED: 'status or action is required',
  FAILED_TO_UPDATE_GAME_STATUS: 'Failed to update game status',
  FAILED_TO_GET_GAME_STATE: 'Failed to get game state',
  NO_CURRENT_QUESTION_ACTIVE: 'No current question active',
  FAILED_TO_FETCH_ANSWERS: 'Failed to fetch answers',
  FAILED_TO_GET_CURRENT_QUESTION: 'Failed to get current question',
  FAILED_TO_GET_GAME: 'Failed to get game',
  LOCKED_MUST_BE_BOOLEAN: 'locked must be a boolean',
  FAILED_TO_UPDATE_LOCK_STATUS: 'Failed to update lock status',
  QUESTION_ID_REQUIRED: 'questionId is required',
} as const;

const SUCCESS_MESSAGES = {
  ANSWER_REVEAL_TRIGGERED: 'Answer reveal triggered',
  EXPLANATION_SHOWN: 'Explanation shown',
  EXPLANATION_HIDDEN: 'Explanation hidden',
  GAME_COMPLETED: 'Game completed',
  ADVANCED_TO_NEXT_QUESTION: 'Advanced to next question',
} as const;

const LOG_MESSAGES = {
  FAILED_TO_FETCH_GAME_FLOW: 'Failed to fetch game flow',
  FAILED_TO_FETCH_QUESTIONS: 'Failed to fetch questions',
  NO_QUESTIONS_FOUND_IN_QUIZ_SET: 'No questions found in quiz set',
  FAILED_TO_UPDATE_GAME_FLOW: 'Failed to update game flow',
  FAILED_TO_START_GAME: 'Failed to start game',
  GAME_STARTED_SUCCESSFULLY: 'Game started successfully with question initialization',
  UNEXPECTED_ERROR_STARTING_GAME: 'Unexpected error starting game',
  FAILED_TO_FETCH_QUESTION_FOR_DURATION: 'Failed to fetch question for duration',
  QUESTION_STARTED_WITH_SERVER_TIMESTAMPS: 'Question started with server timestamps',
  FAILED_TO_CALCULATE_ANSWER_STATISTICS: 'Failed to calculate answer statistics',
  FAILED_TO_FETCH_LEADERBOARD_FOR_WEBSOCKET:
    'Failed to fetch leaderboard for WebSocket event (emitting without data)',
  FAILED_TO_EMIT_WEBSOCKET_EVENTS: 'Failed to emit WebSocket events (answer was still revealed)',
  ANSWER_REVEAL_TRIGGERED: 'Answer reveal triggered',
  EXPLANATION_SHOWN: 'Explanation shown',
  UNEXPECTED_ERROR_SHOWING_EXPLANATION: 'Unexpected error showing explanation',
  EXPLANATION_HIDDEN: 'Explanation hidden',
  UNEXPECTED_ERROR_HIDING_EXPLANATION: 'Unexpected error hiding explanation',
  UNEXPECTED_ERROR_FETCHING_EXPLANATION: 'Unexpected error fetching explanation',
  FAILED_TO_FETCH_QUESTIONS_FOR_NEXT: 'Failed to fetch questions',
  CURRENT_QUESTION_INDEX_OUT_OF_BOUNDS: 'Current question index is out of bounds',
  GAME_COMPLETED_NO_MORE_QUESTIONS: 'Game completed - no more questions',
  ADVANCED_TO_NEXT_QUESTION: 'Advanced to next question',
  UNEXPECTED_ERROR_ADVANCING_TO_NEXT_QUESTION: 'Unexpected error advancing to next question',
  FAILED_TO_UPDATE_GAME_STATUS: 'Failed to update game status',
  GAME_STATUS_UPDATED: 'Game status updated',
  FAILED_TO_FETCH_QUESTION: 'Failed to fetch question',
  UNEXPECTED_ERROR_FETCHING_CURRENT_QUESTION: 'Unexpected error fetching current question',
  FAILED_TO_UPDATE_LOCK_STATUS: 'Failed to update lock status',
  GAME_LOCK_STATUS_UPDATED: 'Game lock status updated',
} as const;

const WEBSOCKET_EVENTS = {
  GAME_QUESTION_STARTED: 'game:question:started',
  GAME_QUESTION_ENDED: 'game:question:ended',
  GAME_ANSWER_LOCKED: 'game:answer:locked',
  GAME_ANSWER_STATS_UPDATE: 'game:answer:stats:update',
  GAME_LEADERBOARD_UPDATE: 'game:leaderboard:update',
  GAME_EXPLANATION_SHOW: 'game:explanation:show',
  GAME_EXPLANATION_HIDE: 'game:explanation:hide',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = Router();

/**
 * Route: POST /:gameId/start
 * Description:
 * - Start a game - moves status from WAITING to ACTIVE
 * - Initializes game flow with first question and prepares for game loop
 * - Requires authentication (host only)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with updated game, game flow, and initialized questions
 */
router.post('/:gameId/start', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.user?.id;

    const game = await verifyGameOwnership(gameId, userId, res);
    if (!game) {
      return;
    }

    if (game.status !== GAME_STATUS_WAITING) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_STATE,
        message: `${ERROR_MESSAGES.CANNOT_START_GAME_IN_STATE} ${game.status} ${ERROR_MESSAGES.STATE}`,
      });
    }

    const gameFlow = await fetchGameFlowForStart(gameId, res);
    if (!gameFlow) {
      return;
    }

    const questions = await fetchQuestionsForStart(gameFlow.quiz_set_id, gameId, res);
    if (!questions || questions.length === EMPTY_ARRAY_LENGTH) {
      return;
    }

    const firstQuestion = questions[0];
    const secondQuestion = questions.length > 1 ? questions[1] : null;

    const flowUpdateResult = await initializeGameFlowForStart(
      gameId,
      firstQuestion.id,
      secondQuestion?.id || null,
      res,
    );
    if (!flowUpdateResult) {
      return;
    }

    const updatedGame = await updateGameStatusToActive(gameId, res);
    if (!updatedGame) {
      return;
    }

    logger.info(
      {
        gameId,
        userId,
        firstQuestionId: firstQuestion.id,
        nextQuestionId: secondQuestion?.id || null,
        totalQuestions: questions.length,
      },
      LOG_MESSAGES.GAME_STARTED_SUCCESSFULLY,
    );

    return res.status(HTTP_STATUS_OK).json({
      ...updatedGame,
      gameFlow: flowUpdateResult.gameFlow,
      initializedQuestions: {
        current: firstQuestion.id,
        next: secondQuestion?.id || null,
        total: questions.length,
      },
    });
  } catch (error) {
    logger.error({ error, gameId: req.params.gameId }, LOG_MESSAGES.UNEXPECTED_ERROR_STARTING_GAME);
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_START_GAME,
    });
  }
});

/**
 * Route: POST /:gameId/questions/start
 * Description:
 * - Start a specific question
 * - Calculates server timestamps and broadcasts WebSocket event
 * - Requires authentication (host only)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.body.questionId: Question identifier (required)
 * - req.body.questionIndex: Question index (optional)
 *
 * Returns:
 * - JSON response with game flow and timing information
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
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_PAYLOAD,
          message: ERROR_MESSAGES.QUESTION_ID_REQUIRED,
        });
      }

      const game = await verifyGameOwnership(gameId, userId, res);
      if (!game) {
        return;
      }

      const question = await fetchQuestionForStart(questionId, res);
      if (!question) {
        return;
      }

      const timing = calculateQuestionTiming(question);
      const result = await updateGameFlowForQuestionStart(
        gameId,
        questionId,
        questionIndex,
        timing.startTime,
        timing.endTime,
        res,
      );
      if (!result) {
        return;
      }

      await updateGameQuestionIndex(gameId, questionIndex);

      emitQuestionStartedEvent(gameId, questionId, questionIndex, timing.startsAt, timing.endsAt);

      logger.info(
        {
          gameId,
          questionId,
          questionIndex,
          startsAt: timing.startsAt,
          endsAt: timing.endsAt,
          durationMs: timing.durationMs,
        },
        LOG_MESSAGES.QUESTION_STARTED_WITH_SERVER_TIMESTAMPS,
      );

      return res.status(HTTP_STATUS_OK).json({
        ...result.gameFlow,
        server_time: timing.startTime,
        starts_at: timing.startsAt,
        ends_at: timing.endsAt,
        duration_ms: timing.durationMs,
      });
    } catch {
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_START_QUESTION,
      });
    }
  },
);

/**
 * Route: POST /:gameId/questions/reveal
 * Description:
 * - Trigger answer reveal for current question
 * - Calculates answer statistics and broadcasts multiple WebSocket events
 * - Requires authentication (host only)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with game flow and answer statistics
 */
router.post(
  '/:gameId/questions/reveal',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.id;

      const game = await verifyGameOwnership(gameId, userId, res);
      if (!game) {
        return;
      }

      const gameFlow = await fetchGameFlowForReveal(gameId, res);
      if (!gameFlow) {
        return;
      }

      const currentQuestionId = gameFlow.current_question_id;
      if (!currentQuestionId) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_STATE,
          message: ERROR_MESSAGES.NO_ACTIVE_QUESTION_TO_REVEAL,
        });
      }

      const result = await updateGameFlowForReveal(gameId, res);
      if (!result) {
        return;
      }

      const answerStats = await calculateAnswerStatistics(gameId, currentQuestionId);

      await emitAnswerRevealEvents(gameId, currentQuestionId, answerStats);

      logger.info(
        { gameId, questionId: currentQuestionId, answerStats },
        LOG_MESSAGES.ANSWER_REVEAL_TRIGGERED,
      );

      return res.status(HTTP_STATUS_OK).json({
        message: SUCCESS_MESSAGES.ANSWER_REVEAL_TRIGGERED,
        gameFlow: result.gameFlow,
        answerStats,
      });
    } catch {
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_TRIGGER_ANSWER_REVEAL,
      });
    }
  },
);

/**
 * Route: POST /:gameId/questions/explanation/show
 * Description:
 * - Show explanation for current question
 * - Broadcasts WebSocket event to all players
 * - Requires authentication (host only)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with explanation data
 */
router.post(
  '/:gameId/questions/explanation/show',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.id;

      const game = await verifyGameOwnership(gameId, userId, res);
      if (!game) {
        return;
      }

      const gameFlow = await fetchGameFlowForExplanation(gameId, res);
      if (!gameFlow) {
        return;
      }

      const currentQuestionId = gameFlow.current_question_id;
      if (!currentQuestionId) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_STATE,
          message: ERROR_MESSAGES.NO_ACTIVE_QUESTION_TO_SHOW_EXPLANATION,
        });
      }

      const question = await fetchQuestionExplanation(currentQuestionId, res);
      if (!question) {
        return;
      }

      const showExplanationTime = question.show_explanation_time || DEFAULT_EXPLANATION_TIME;

      emitExplanationShowEvent(gameId, currentQuestionId, question, showExplanationTime);

      logger.info({ gameId, questionId: currentQuestionId }, LOG_MESSAGES.EXPLANATION_SHOWN);

      return res.status(HTTP_STATUS_OK).json({
        message: SUCCESS_MESSAGES.EXPLANATION_SHOWN,
        explanation: {
          title: question.explanation_title,
          text: question.explanation_text,
          image_url: question.explanation_image_url,
          show_time: question.show_explanation_time,
        },
      });
    } catch (error) {
      logger.error(
        { error, gameId: req.params.gameId },
        LOG_MESSAGES.UNEXPECTED_ERROR_SHOWING_EXPLANATION,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_SHOW_EXPLANATION,
      });
    }
  },
);

/**
 * Route: POST /:gameId/questions/explanation/hide
 * Description:
 * - Hide explanation for current question
 * - Broadcasts WebSocket event to all players
 * - Requires authentication (host only)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with success message
 */
router.post(
  '/:gameId/questions/explanation/hide',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.id;

      const game = await verifyGameOwnership(gameId, userId, res);
      if (!game) {
        return;
      }

      const gameFlow = await fetchGameFlowForExplanation(gameId, res);
      if (!gameFlow) {
        return;
      }

      const currentQuestionId = gameFlow.current_question_id;
      if (!currentQuestionId) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_STATE,
          message: ERROR_MESSAGES.NO_ACTIVE_QUESTION_TO_HIDE_EXPLANATION,
        });
      }

      emitExplanationHideEvent(gameId, currentQuestionId);

      logger.info({ gameId, questionId: currentQuestionId }, LOG_MESSAGES.EXPLANATION_HIDDEN);

      return res.status(HTTP_STATUS_OK).json({
        message: SUCCESS_MESSAGES.EXPLANATION_HIDDEN,
      });
    } catch (error) {
      logger.error(
        { error, gameId: req.params.gameId },
        LOG_MESSAGES.UNEXPECTED_ERROR_HIDING_EXPLANATION,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_HIDE_EXPLANATION,
      });
    }
  },
);

/**
 * Route: GET /:gameId/questions/:questionId/explanation
 * Description:
 * - Get explanation for a question
 * - Public access (for displaying explanation)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.params.questionId: Question identifier
 *
 * Returns:
 * - JSON response with explanation data
 */
router.get('/:gameId/questions/:questionId/explanation', async (req: Request, res: Response) => {
  try {
    const { gameId, questionId } = req.params;

    const game = await verifyGameExists(gameId, res);
    if (!game) {
      return;
    }

    const question = await fetchQuestionExplanation(questionId, res);
    if (!question) {
      return;
    }

    if (!question.explanation_text && !question.explanation_title) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NO_EXPLANATION,
        message: ERROR_MESSAGES.NO_EXPLANATION_AVAILABLE,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      question_id: question.id,
      explanation_title: question.explanation_title,
      explanation_text: question.explanation_text,
      explanation_image_url: question.explanation_image_url,
      show_explanation_time: question.show_explanation_time || DEFAULT_EXPLANATION_TIME,
    });
  } catch (error) {
    logger.error(
      { error, gameId: req.params.gameId, questionId: req.params.questionId },
      LOG_MESSAGES.UNEXPECTED_ERROR_FETCHING_EXPLANATION,
    );
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_EXPLANATION,
    });
  }
});

/**
 * Route: POST /:gameId/questions/next
 * Description:
 * - Advance to the next question (updates game_flows with next question info)
 * - Handles game completion when no more questions
 * - Requires authentication (host only)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with updated game flow and next question info
 */
router.post(
  '/:gameId/questions/next',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.id;

      const game = await verifyGameOwnership(gameId, userId, res);
      if (!game) {
        return;
      }

      const gameFlow = await fetchGameFlowForNext(gameId, res);
      if (!gameFlow) {
        return;
      }

      const currentIndex = gameFlow.current_question_index ?? DEFAULT_QUESTION_INDEX;

      const questions = await fetchQuestionsForNext(gameFlow.quiz_set_id, gameId, res);
      if (!questions) {
        return;
      }

      const validationResult = validateQuestionIndex(currentIndex, questions.length, gameId, res);
      if (!validationResult) {
        return;
      }

      const nextIndex = currentIndex + 1;

      if (nextIndex >= questions.length) {
        return await handleGameCompletion(gameId, res);
      }

      const nextQuestion = questions.at(nextIndex);
      if (!nextQuestion) {
        return await handleGameCompletion(gameId, res);
      }

      const questionAfterNext = questions.at(nextIndex + 1) || null;

      const updateResult = await updateGameFlowForNext(
        gameId,
        nextQuestion.id,
        nextIndex,
        questionAfterNext?.id || null,
        res,
      );
      if (!updateResult) {
        return;
      }

      await updateGameQuestionIndex(gameId, nextIndex);

      emitPhaseChangeEvent(gameId, PHASE_COUNTDOWN);

      logger.info(
        {
          gameId,
          nextQuestionId: nextQuestion.id,
          nextIndex,
          totalQuestions: questions.length,
        },
        LOG_MESSAGES.ADVANCED_TO_NEXT_QUESTION,
      );

      return res.status(HTTP_STATUS_OK).json({
        message: SUCCESS_MESSAGES.ADVANCED_TO_NEXT_QUESTION,
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
        LOG_MESSAGES.UNEXPECTED_ERROR_ADVANCING_TO_NEXT_QUESTION,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_ADVANCE_TO_NEXT_QUESTION,
      });
    }
  },
);

/**
 * Route: PATCH /:gameId/status
 * Description:
 * - Update game status (pause, resume, end)
 * - Supports both action-based and direct status updates
 * - Requires authentication (host only)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.body.status: Direct status value (optional)
 * - req.body.action: Action value ('pause', 'resume', 'end') (optional)
 *
 * Returns:
 * - JSON response with updated game data
 */
router.patch(
  '/:gameId/status',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId } = req.params;
      const { status, action } = req.body;
      const userId = req.user?.id;

      if (!status && !action) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_PAYLOAD,
          message: ERROR_MESSAGES.STATUS_OR_ACTION_REQUIRED,
        });
      }

      const game = await verifyGameOwnership(gameId, userId, res);
      if (!game) {
        return;
      }

      const updateData = buildStatusUpdateData(action, status, game);

      const updatedGame = await updateGameStatus(gameId, updateData, res);
      if (!updatedGame) {
        return;
      }

      logger.info({ gameId, status, action }, LOG_MESSAGES.GAME_STATUS_UPDATED);

      return res.status(HTTP_STATUS_OK).json(updatedGame);
    } catch {
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_UPDATE_GAME_STATUS,
      });
    }
  },
);

/**
 * Route: GET /:gameId/state
 * Description:
 * - Get current game state including flow information
 * - Public access
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with game and game flow data
 */
router.get('/:gameId/state', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    const game = await fetchGameForState(gameId, res);
    if (!game) {
      return;
    }

    const flowResult = await gameFlowService.getGameFlow(gameId);

    if (!flowResult.success) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.GAME_FLOW_NOT_FOUND_CANNOT_INITIALIZE,
      });
    }

    return res.status(HTTP_STATUS_OK).json({
      game,
      gameFlow: flowResult.gameFlow,
    });
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_GET_GAME_STATE,
    });
  }
});

/**
 * Route: GET /:gameId/questions/current
 * Description:
 * - Get current question with full metadata (images, answers, etc.)
 * - Public endpoint - accessible by all players
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with question, answers, and timing information
 */
router.get('/:gameId/questions/current', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    const gameFlow = await fetchGameFlowForCurrentQuestion(gameId, res);
    if (!gameFlow) {
      return;
    }

    const currentQuestionId = gameFlow.current_question_id;
    if (!currentQuestionId) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NO_QUESTION,
        message: ERROR_MESSAGES.NO_CURRENT_QUESTION_ACTIVE,
      });
    }

    const question = await fetchQuestionWithAnswers(currentQuestionId, res);
    if (!question) {
      return;
    }

    const timing = calculateQuestionTimingForCurrent(
      question,
      gameFlow.current_question_start_time,
    );

    return res.status(HTTP_STATUS_OK).json({
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
      answers: (question.answers || []).map((answer) => ({
        id: answer.id,
        text: answer.answer_text,
        image_url: answer.image_url,
        is_correct: answer.is_correct,
        order_index: answer.order_index,
      })),
      question_index: gameFlow.current_question_index,
      total_questions: gameFlow.total_questions,
      server_time: timing.serverTime,
      start_time: gameFlow.current_question_start_time,
      remaining_ms: timing.remainingMs,
      is_active: timing.isActive,
    });
  } catch (error) {
    logger.error(
      { error, gameId: req.params.gameId },
      LOG_MESSAGES.UNEXPECTED_ERROR_FETCHING_CURRENT_QUESTION,
    );
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_GET_CURRENT_QUESTION,
    });
  }
});

/**
 * Route: GET /:gameId
 * Description:
 * - Get game details
 * - Public access
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 *
 * Returns:
 * - JSON response with game data
 */
router.get('/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    const { data: game, error } = await supabaseAdmin
      .from(TABLE_GAMES)
      .select(SELECT_ALL)
      .eq(COLUMN_ID, gameId)
      .single();

    if (error || !game) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.GAME_NOT_FOUND,
      });
    }

    return res.status(HTTP_STATUS_OK).json(game);
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_GET_GAME,
    });
  }
});

/**
 * Route: PATCH /:gameId/lock
 * Description:
 * - Lock or unlock the game room
 * - Requires authentication (host only)
 *
 * Parameters:
 * - req.params.gameId: Game identifier
 * - req.body.locked: Boolean value for lock status
 *
 * Returns:
 * - JSON response with updated game data
 */
router.patch('/:gameId/lock', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const { locked } = req.body;
    const userId = req.user?.id;

    if (typeof locked !== 'boolean') {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_PAYLOAD,
        message: ERROR_MESSAGES.LOCKED_MUST_BE_BOOLEAN,
      });
    }

    const game = await verifyGameOwnership(gameId, userId, res);
    if (!game) {
      return;
    }

    const updatedGame = await updateGameLockStatus(gameId, locked, res);
    if (!updatedGame) {
      return;
    }

    logger.info({ gameId, locked }, LOG_MESSAGES.GAME_LOCK_STATUS_UPDATED);

    return res.status(HTTP_STATUS_OK).json(updatedGame);
  } catch {
    return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_UPDATE_LOCK_STATUS,
    });
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: verifyGameOwnership
 * Description:
 * - Verify game exists and belongs to user
 * - Sends error response if verification fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - userId (string | undefined): User identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Game data if verification succeeds, null otherwise
 */
async function verifyGameOwnership(
  gameId: string,
  userId: string | undefined,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const { data: game, error: gameError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .select(SELECT_ALL)
    .eq(COLUMN_ID, gameId)
    .eq(COLUMN_USER_ID, userId)
    .single();

  if (gameError || !game) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.GAME_NOT_FOUND_OR_UNAUTHORIZED,
    });
    return null;
  }

  return game;
}

/**
 * Function: verifyGameExists
 * Description:
 * - Verify game exists (no ownership check)
 * - Sends error response if game not found
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Game data if found, null otherwise
 */
async function verifyGameExists(
  gameId: string,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const { data: game, error: gameError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .select(SELECT_GAME_BASIC)
    .eq(COLUMN_ID, gameId)
    .single();

  if (gameError || !game) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.GAME_NOT_FOUND,
    });
    return null;
  }

  return game;
}

/**
 * Function: fetchGameFlowForStart
 * Description:
 * - Fetch game flow for game start operation
 * - Sends error response if flow not found
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Game flow data if found, null otherwise
 */
async function fetchGameFlowForStart(
  gameId: string,
  res: Response,
): Promise<{ quiz_set_id: string } | null> {
  const flowResult = await gameFlowService.getGameFlow(gameId);
  if (!flowResult.success || !flowResult.gameFlow) {
    logger.error({ gameId, error: flowResult.error }, LOG_MESSAGES.FAILED_TO_FETCH_GAME_FLOW);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.FLOW_NOT_FOUND,
      message: ERROR_MESSAGES.GAME_FLOW_NOT_FOUND_CANNOT_INITIALIZE,
    });
    return null;
  }

  return flowResult.gameFlow;
}

/**
 * Function: fetchQuestionsForStart
 * Description:
 * - Fetch all questions for quiz set, ordered by order_index
 * - Filters out deleted questions
 * - Sends error response if fetch fails or no questions found
 *
 * Parameters:
 * - quizSetId (string): Quiz set identifier
 * - gameId (string): Game identifier for logging
 * - res (Response): Express response object
 *
 * Returns:
 * - Array | null: Questions array if found, null otherwise
 */
async function fetchQuestionsForStart(
  quizSetId: string,
  gameId: string,
  res: Response,
): Promise<Array<{ id: string; order_index: number }> | null> {
  const { data: questions, error: questionsError } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
    .select(SELECT_QUESTION_IDS)
    .eq(COLUMN_QUESTION_SET_ID, quizSetId)
    .is(COLUMN_DELETED_AT, null)
    .order(COLUMN_ORDER_INDEX, { ascending: true });

  if (questionsError) {
    logger.error(
      { error: questionsError, gameId, quizSetId },
      LOG_MESSAGES.FAILED_TO_FETCH_QUESTIONS,
    );
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.QUESTIONS_FETCH_FAILED,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_QUESTIONS_FOR_QUIZ,
    });
    return null;
  }

  if (!questions || questions.length === EMPTY_ARRAY_LENGTH) {
    logger.warn({ gameId, quizSetId }, LOG_MESSAGES.NO_QUESTIONS_FOUND_IN_QUIZ_SET);
    res.status(HTTP_STATUS_BAD_REQUEST).json({
      error: ERROR_CODES.NO_QUESTIONS,
      message: ERROR_MESSAGES.QUIZ_SET_HAS_NO_QUESTIONS,
    });
    return null;
  }

  return questions;
}

/**
 * Function: initializeGameFlowForStart
 * Description:
 * - Initialize game flow with first question
 * - Sends error response if update fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - firstQuestionId (string): First question identifier
 * - nextQuestionId (string | null): Next question identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Update result if successful, null otherwise
 */
async function initializeGameFlowForStart(
  gameId: string,
  firstQuestionId: string,
  nextQuestionId: string | null,
  res: Response,
): Promise<{ gameFlow: Record<string, unknown> } | null> {
  const flowUpdateResult = await gameFlowService.updateGameFlow(gameId, {
    current_question_id: firstQuestionId,
    current_question_index: DEFAULT_QUESTION_INDEX,
    next_question_id: nextQuestionId,
    current_question_start_time: null,
    current_question_end_time: null,
  });

  if (!flowUpdateResult.success || !flowUpdateResult.gameFlow) {
    logger.error(
      { gameId, error: flowUpdateResult.error },
      LOG_MESSAGES.FAILED_TO_UPDATE_GAME_FLOW,
    );
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.FLOW_UPDATE_FAILED,
      message: ERROR_MESSAGES.FAILED_TO_INITIALIZE_GAME_FLOW,
    });
    return null;
  }

  return { gameFlow: flowUpdateResult.gameFlow as unknown as Record<string, unknown> };
}

/**
 * Function: updateGameStatusToActive
 * Description:
 * - Update game status to active and set current_question_index
 * - Sends error response if update fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Updated game data if successful, null otherwise
 */
async function updateGameStatusToActive(
  gameId: string,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .update({
      status: GAME_STATUS_ACTIVE,
      started_at: new Date().toISOString(),
      current_question_index: DEFAULT_QUESTION_INDEX,
    })
    .eq(COLUMN_ID, gameId)
    .select()
    .single();

  if (updateError) {
    logger.error({ error: updateError, gameId }, LOG_MESSAGES.FAILED_TO_START_GAME);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.UPDATE_FAILED,
      message: ERROR_MESSAGES.FAILED_TO_START_GAME,
    });
    return null;
  }

  return updatedGame;
}

/**
 * Function: fetchQuestionForStart
 * Description:
 * - Fetch question to get timing information
 * - Sends error response if question not found
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Question data if found, null otherwise
 */
async function fetchQuestionForStart(
  questionId: string,
  res: Response,
): Promise<{ show_question_time: number; answering_time: number } | null> {
  const { data: question, error: questionError } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
    .select(SELECT_QUESTION_TIMING)
    .eq(COLUMN_ID, questionId)
    .single();

  if (questionError || !question) {
    logger.error(
      { error: questionError, questionId },
      LOG_MESSAGES.FAILED_TO_FETCH_QUESTION_FOR_DURATION,
    );
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.QUESTION_NOT_FOUND,
    });
    return null;
  }

  return question;
}

/**
 * Function: calculateQuestionTiming
 * Description:
 * - Calculate question timing including start time, end time, and duration
 *
 * Parameters:
 * - question (object): Question data with show_question_time and answering_time
 *
 * Returns:
 * - object: Timing information with startTime, endTime, startsAt, endsAt, and durationMs
 */
function calculateQuestionTiming(question: {
  show_question_time?: number | null;
  answering_time?: number | null;
}): {
  startTime: string;
  endTime: string;
  startsAt: number;
  endsAt: number;
  durationMs: number;
} {
  const serverTime = new Date();
  const startTime = serverTime.toISOString();
  const showTime = question.show_question_time || DEFAULT_SHOW_TIME;
  const answeringTime = question.answering_time || DEFAULT_ANSWERING_TIME;
  const totalDurationSeconds = showTime + answeringTime;
  const durationMs = totalDurationSeconds * MILLISECONDS_PER_SECOND;
  const endTime = new Date(serverTime.getTime() + durationMs).toISOString();
  const startsAt = serverTime.getTime();
  const endsAt = serverTime.getTime() + durationMs;

  return {
    startTime,
    endTime,
    startsAt,
    endsAt,
    durationMs,
  };
}

/**
 * Function: updateGameFlowForQuestionStart
 * Description:
 * - Update game flow with question start information
 * - Sends error response if update fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - questionId (string): Question identifier
 * - questionIndex (number | undefined): Question index
 * - startTime (string): Start time ISO string
 * - endTime (string): End time ISO string
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Update result if successful, null otherwise
 */
async function updateGameFlowForQuestionStart(
  gameId: string,
  questionId: string,
  questionIndex: number | undefined,
  startTime: string,
  endTime: string,
  res: Response,
): Promise<{ gameFlow: Record<string, unknown> } | null> {
  const result = await gameFlowService.updateGameFlow(gameId, {
    current_question_id: questionId,
    current_question_index: questionIndex !== undefined ? questionIndex : undefined,
    current_question_start_time: startTime,
    current_question_end_time: endTime,
  });

  if (!result.success || !result.gameFlow) {
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.UPDATE_FAILED,
      message: result.error,
    });
    return null;
  }

  return { gameFlow: result.gameFlow as unknown as Record<string, unknown> };
}

/**
 * Function: updateGameQuestionIndex
 * Description:
 * - Update current_question_index in games table
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - questionIndex (number | undefined): Question index
 *
 * Returns:
 * - void: No return value
 */
async function updateGameQuestionIndex(
  gameId: string,
  questionIndex: number | undefined,
): Promise<void> {
  await supabaseAdmin
    .from(TABLE_GAMES)
    .update({
      current_question_index: questionIndex,
    })
    .eq(COLUMN_ID, gameId);
}

/**
 * Function: emitQuestionStartedEvent
 * Description:
 * - Emit WebSocket event for question started
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - questionId (string): Question identifier
 * - questionIndex (number | undefined): Question index
 * - startsAt (number): Start timestamp in milliseconds
 * - endsAt (number): End timestamp in milliseconds
 *
 * Returns:
 * - void: No return value
 */
function emitQuestionStartedEvent(
  gameId: string,
  questionId: string,
  questionIndex: number | undefined,
  startsAt: number,
  endsAt: number,
): void {
  const wsManager = requireWebSocketManager();
  wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_QUESTION_STARTED, {
    roomId: gameId,
    question: { id: questionId, index: questionIndex },
    startsAt,
    endsAt,
  });
}

/**
 * Function: fetchGameFlowForReveal
 * Description:
 * - Fetch game flow for answer reveal operation
 * - Sends error response if flow not found
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Game flow data if found, null otherwise
 */
async function fetchGameFlowForReveal(
  gameId: string,
  res: Response,
): Promise<{ current_question_id: string | null } | null> {
  const flowResult = await gameFlowService.getGameFlow(gameId);
  if (!flowResult.success || !flowResult.gameFlow) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.GAME_FLOW_NOT_FOUND_CANNOT_INITIALIZE,
    });
    return null;
  }

  return flowResult.gameFlow;
}

/**
 * Function: updateGameFlowForReveal
 * Description:
 * - Update game flow with end time to lock answer submissions
 * - Sends error response if update fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Update result if successful, null otherwise
 */
async function updateGameFlowForReveal(
  gameId: string,
  res: Response,
): Promise<{ gameFlow: Record<string, unknown> } | null> {
  const result = await gameFlowService.updateGameFlow(gameId, {
    current_question_end_time: new Date().toISOString(),
  });

  if (!result.success || !result.gameFlow) {
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.UPDATE_FAILED,
      message: result.error,
    });
    return null;
  }

  return { gameFlow: result.gameFlow as unknown as Record<string, unknown> };
}

/**
 * Function: calculateAnswerStatistics
 * Description:
 * - Calculate final answer statistics for current question
 * - Does not fail if calculation fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - currentQuestionId (string): Current question identifier
 *
 * Returns:
 * - Record<string, number>: Answer statistics mapping answer_id to count
 */
async function calculateAnswerStatistics(
  gameId: string,
  currentQuestionId: string,
): Promise<Record<string, number>> {
  let answerStats: Record<string, number> = {};

  try {
    const { data: allReports, error: reportsError } = await supabaseAdmin
      .from(TABLE_GAME_PLAYER_DATA)
      .select(SELECT_ANSWER_REPORT)
      .eq(COLUMN_GAME_ID, gameId);

    if (!reportsError && allReports) {
      answerStats = (allReports as { answer_report: unknown }[]).reduce(
        (acc, row) => {
          const report = row.answer_report as {
            questions?: Array<{ question_id: string; answer_id: string | null }>;
          };
          (report?.questions || []).forEach((q) => {
            if (q.question_id === currentQuestionId && q.answer_id) {
              acc[q.answer_id] = (acc[q.answer_id] || DEFAULT_QUESTION_INDEX) + 1;
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
      LOG_MESSAGES.FAILED_TO_CALCULATE_ANSWER_STATISTICS,
    );
  }

  return answerStats;
}

/**
 * Function: emitAnswerRevealEvents
 * Description:
 * - Emit all WebSocket events for answer reveal
 * - Includes question ended, answer locked, stats update, and leaderboard update
 * - Does not fail if WebSocket emission fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - currentQuestionId (string): Current question identifier
 * - answerStats (Record<string, number>): Answer statistics
 *
 * Returns:
 * - void: No return value
 */
async function emitAnswerRevealEvents(
  gameId: string,
  currentQuestionId: string,
  answerStats: Record<string, number>,
): Promise<void> {
  try {
    const wsManager = requireWebSocketManager();

    wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_QUESTION_ENDED, {
      roomId: gameId,
      questionId: currentQuestionId,
    });

    wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_ANSWER_LOCKED, {
      roomId: gameId,
      questionId: currentQuestionId,
      counts: answerStats,
    });

    wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_ANSWER_STATS_UPDATE, {
      roomId: gameId,
      questionId: currentQuestionId,
      counts: answerStats,
    });

    await emitLeaderboardUpdateEvent(gameId, wsManager);
  } catch (wsError) {
    logger.warn({ error: wsError, gameId }, LOG_MESSAGES.FAILED_TO_EMIT_WEBSOCKET_EVENTS);
  }
}

/**
 * Function: emitLeaderboardUpdateEvent
 * Description:
 * - Emit leaderboard update WebSocket event with actual leaderboard data
 * - Falls back to event without data if leaderboard fetch fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - wsManager (object): WebSocket manager instance
 *
 * Returns:
 * - void: No return value
 */
async function emitLeaderboardUpdateEvent(
  gameId: string,
  wsManager: ReturnType<typeof requireWebSocketManager>,
): Promise<void> {
  try {
    const { gamePlayerDataService } = await import('../services/gamePlayerDataService');
    const leaderboard = await gamePlayerDataService.getLeaderboard(gameId, {
      offset: LEADERBOARD_OFFSET,
      limit: LEADERBOARD_LIMIT,
    });

    if (leaderboard) {
      wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_LEADERBOARD_UPDATE, {
        roomId: gameId,
        leaderboard: {
          game_id: gameId,
          entries: leaderboard.entries,
          total: leaderboard.total,
          updated_at: leaderboard.updated_at,
        },
      });
    } else {
      wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_LEADERBOARD_UPDATE, {
        roomId: gameId,
      });
    }
  } catch (leaderboardError) {
    logger.warn(
      { error: leaderboardError, gameId },
      LOG_MESSAGES.FAILED_TO_FETCH_LEADERBOARD_FOR_WEBSOCKET,
    );
    wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_LEADERBOARD_UPDATE, {
      roomId: gameId,
    });
  }
}

/**
 * Function: fetchGameFlowForExplanation
 * Description:
 * - Fetch game flow for explanation operations
 * - Sends error response if flow not found
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Game flow data if found, null otherwise
 */
async function fetchGameFlowForExplanation(
  gameId: string,
  res: Response,
): Promise<{ current_question_id: string | null } | null> {
  const flowResult = await gameFlowService.getGameFlow(gameId);
  if (!flowResult.success || !flowResult.gameFlow) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.GAME_FLOW_NOT_FOUND_CANNOT_INITIALIZE,
    });
    return null;
  }

  return flowResult.gameFlow;
}

/**
 * Function: fetchQuestionExplanation
 * Description:
 * - Fetch question with explanation data
 * - Sends error response if question not found
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Question data if found, null otherwise
 */
async function fetchQuestionExplanation(
  questionId: string,
  res: Response,
): Promise<{
  id: string;
  explanation_title: string | null;
  explanation_text: string | null;
  explanation_image_url: string | null;
  show_explanation_time: number | null;
} | null> {
  const { data: question, error: questionError } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
    .select(SELECT_EXPLANATION_FIELDS)
    .eq(COLUMN_ID, questionId)
    .single();

  if (questionError || !question) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.QUESTION_NOT_FOUND,
    });
    return null;
  }

  return question;
}

/**
 * Function: emitExplanationShowEvent
 * Description:
 * - Emit WebSocket event to show explanation
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - questionId (string): Question identifier
 * - question (object): Question data with explanation fields
 * - showTime (number): Explanation show time in seconds
 *
 * Returns:
 * - void: No return value
 */
function emitExplanationShowEvent(
  gameId: string,
  questionId: string,
  question: {
    explanation_title: string | null;
    explanation_text: string | null;
    explanation_image_url: string | null;
  },
  showTime: number,
): void {
  const wsManager = requireWebSocketManager();
  wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_EXPLANATION_SHOW, {
    roomId: gameId,
    questionId,
    explanation: {
      title: question.explanation_title,
      text: question.explanation_text,
      image_url: question.explanation_image_url,
      show_time: showTime,
    },
  });
}

/**
 * Function: emitExplanationHideEvent
 * Description:
 * - Emit WebSocket event to hide explanation
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - questionId (string): Question identifier
 *
 * Returns:
 * - void: No return value
 */
function emitExplanationHideEvent(gameId: string, questionId: string): void {
  const wsManager = requireWebSocketManager();
  wsManager.broadcastToRoom(gameId, WEBSOCKET_EVENTS.GAME_EXPLANATION_HIDE, {
    roomId: gameId,
    questionId,
  });
}

/**
 * Function: fetchGameFlowForNext
 * Description:
 * - Fetch game flow for next question operation
 * - Sends error response if flow not found
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Game flow data if found, null otherwise
 */
async function fetchGameFlowForNext(
  gameId: string,
  res: Response,
): Promise<{ current_question_index: number | null; quiz_set_id: string } | null> {
  const flowResult = await gameFlowService.getGameFlow(gameId);
  if (!flowResult.success || !flowResult.gameFlow) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.GAME_FLOW_NOT_FOUND_CANNOT_INITIALIZE,
    });
    return null;
  }

  return flowResult.gameFlow;
}

/**
 * Function: fetchQuestionsForNext
 * Description:
 * - Fetch all questions for next question operation
 * - Sends error response if fetch fails
 *
 * Parameters:
 * - quizSetId (string): Quiz set identifier
 * - gameId (string): Game identifier for logging
 * - res (Response): Express response object
 *
 * Returns:
 * - Array | null: Questions array if found, null otherwise
 */
async function fetchQuestionsForNext(
  quizSetId: string,
  gameId: string,
  res: Response,
): Promise<Array<{ id: string; order_index: number }> | null> {
  const { data: questions, error: questionsError } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
    .select(SELECT_QUESTION_IDS)
    .eq(COLUMN_QUESTION_SET_ID, quizSetId)
    .is(COLUMN_DELETED_AT, null)
    .order(COLUMN_ORDER_INDEX, { ascending: true });

  if (questionsError || !questions) {
    logger.error(
      { error: questionsError, gameId },
      LOG_MESSAGES.FAILED_TO_FETCH_QUESTIONS_FOR_NEXT,
    );
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.QUESTIONS_FETCH_FAILED,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_QUESTIONS_FOR_QUIZ,
    });
    return null;
  }

  return questions;
}

/**
 * Function: validateQuestionIndex
 * Description:
 * - Validate current question index is within bounds
 * - Sends error response if validation fails
 *
 * Parameters:
 * - currentIndex (number): Current question index
 * - totalQuestions (number): Total number of questions
 * - gameId (string): Game identifier for logging
 * - res (Response): Express response object
 *
 * Returns:
 * - boolean: True if valid, false otherwise (response sent)
 */
function validateQuestionIndex(
  currentIndex: number,
  totalQuestions: number,
  gameId: string,
  res: Response,
): boolean {
  if (currentIndex < MIN_INDEX || currentIndex >= totalQuestions) {
    logger.error(
      { gameId, currentIndex, totalQuestions },
      LOG_MESSAGES.CURRENT_QUESTION_INDEX_OUT_OF_BOUNDS,
    );
    res.status(HTTP_STATUS_BAD_REQUEST).json({
      error: ERROR_CODES.INVALID_INDEX,
      message: `${ERROR_MESSAGES.CURRENT_QUESTION_INDEX_OUT_OF_BOUNDS} ${currentIndex} ${ERROR_MESSAGES.IS_OUT_OF_BOUNDS_TOTAL} ${totalQuestions})`,
    });
    return false;
  }

  return true;
}

/**
 * Function: handleGameCompletion
 * Description:
 * - Handle game completion when no more questions
 * - Updates game flow, game status, and emits phase change
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - boolean: Always returns true (response sent)
 */
async function handleGameCompletion(gameId: string, res: Response): Promise<boolean> {
  const endResult = await gameFlowService.updateGameFlow(gameId, {
    current_question_id: null,
    next_question_id: null,
    current_question_start_time: null,
    current_question_end_time: null,
  });

  await supabaseAdmin
    .from(TABLE_GAMES)
    .update({
      status: GAME_STATUS_FINISHED,
      ended_at: new Date().toISOString(),
    })
    .eq(COLUMN_ID, gameId);

  emitPhaseChangeEvent(gameId, PHASE_ENDED);

  logger.info({ gameId }, LOG_MESSAGES.GAME_COMPLETED_NO_MORE_QUESTIONS);

  res.status(HTTP_STATUS_OK).json({
    message: SUCCESS_MESSAGES.GAME_COMPLETED,
    gameFlow: endResult.gameFlow,
    isComplete: true,
  });

  return true;
}

/**
 * Function: updateGameFlowForNext
 * Description:
 * - Update game flow with next question information
 * - Sends error response if update fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - nextQuestionId (string): Next question identifier
 * - nextIndex (number): Next question index
 * - questionAfterNextId (string | null): Question after next identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Update result if successful, null otherwise
 */
async function updateGameFlowForNext(
  gameId: string,
  nextQuestionId: string,
  nextIndex: number,
  questionAfterNextId: string | null,
  res: Response,
): Promise<{ gameFlow: Record<string, unknown> } | null> {
  const updateResult = await gameFlowService.updateGameFlow(gameId, {
    current_question_id: nextQuestionId,
    current_question_index: nextIndex,
    next_question_id: questionAfterNextId,
    current_question_start_time: null,
    current_question_end_time: null,
  });

  if (!updateResult.success || !updateResult.gameFlow) {
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.UPDATE_FAILED,
      message: updateResult.error,
    });
    return null;
  }

  return { gameFlow: updateResult.gameFlow as unknown as Record<string, unknown> };
}

/**
 * Function: emitPhaseChangeEvent
 * Description:
 * - Emit WebSocket phase change event
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - phase (string): Phase value ('ended' or 'countdown')
 *
 * Returns:
 * - void: No return value
 */
function emitPhaseChangeEvent(gameId: string, phase: string): void {
  const wsManager = requireWebSocketManager();
  wsManager.broadcastPhaseChange(gameId, phase);
}

/**
 * Function: buildStatusUpdateData
 * Description:
 * - Build update data object based on action or status
 *
 * Parameters:
 * - action (string | undefined): Action value ('pause', 'resume', 'end')
 * - status (string | undefined): Direct status value
 * - game (object): Current game data
 *
 * Returns:
 * - Record<string, unknown>: Update data object
 */
function buildStatusUpdateData(
  action: string | undefined,
  status: string | undefined,
  game: Record<string, unknown>,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (action === ACTION_PAUSE) {
    updateData.status = GAME_STATUS_PAUSED;
    updateData.paused_at = new Date().toISOString();
  } else if (action === ACTION_RESUME) {
    updateData.status = GAME_STATUS_ACTIVE;
    updateData.resumed_at = new Date().toISOString();
  } else if (action === ACTION_END) {
    updateData.status = GAME_STATUS_FINISHED;
    updateData.ended_at = new Date().toISOString();
  } else if (status) {
    updateData.status = status;

    if (status === GAME_STATUS_FINISHED && !game.ended_at) {
      updateData.ended_at = new Date().toISOString();
    }
  }

  return updateData;
}

/**
 * Function: updateGameStatus
 * Description:
 * - Update game status
 * - Sends error response if update fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - updateData (Record<string, unknown>): Update data object
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Updated game data if successful, null otherwise
 */
async function updateGameStatus(
  gameId: string,
  updateData: Record<string, unknown>,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .update(updateData)
    .eq(COLUMN_ID, gameId)
    .select()
    .single();

  if (updateError) {
    logger.error({ error: updateError, gameId }, LOG_MESSAGES.FAILED_TO_UPDATE_GAME_STATUS);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.UPDATE_FAILED,
      message: ERROR_MESSAGES.FAILED_TO_UPDATE_GAME_STATUS,
    });
    return null;
  }

  return updatedGame;
}

/**
 * Function: fetchGameForState
 * Description:
 * - Fetch game for state endpoint
 * - Sends error response if game not found
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Game data if found, null otherwise
 */
async function fetchGameForState(
  gameId: string,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const { data: game, error: gameError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .select(SELECT_ALL)
    .eq(COLUMN_ID, gameId)
    .single();

  if (gameError || !game) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.GAME_NOT_FOUND,
    });
    return null;
  }

  return game;
}

/**
 * Function: fetchGameFlowForCurrentQuestion
 * Description:
 * - Fetch game flow for current question endpoint
 * - Sends error response if flow not found
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Game flow data if found, null otherwise
 */
async function fetchGameFlowForCurrentQuestion(
  gameId: string,
  res: Response,
): Promise<{
  current_question_id: string | null;
  current_question_index: number | null;
  total_questions: number;
  current_question_start_time: string | null;
} | null> {
  const flowResult = await gameFlowService.getGameFlow(gameId);

  if (!flowResult.success || !flowResult.gameFlow) {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.GAME_FLOW_NOT_FOUND_CANNOT_INITIALIZE,
    });
    return null;
  }

  return flowResult.gameFlow;
}

/**
 * Function: fetchQuestionWithAnswers
 * Description:
 * - Fetch question with all answers
 * - Sends error response if question or answers not found
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Question data with answers if found, null otherwise
 */
async function fetchQuestionWithAnswers(
  questionId: string,
  res: Response,
): Promise<{
  id: string;
  question_text: string;
  image_url: string | null;
  question_type: string;
  show_question_time: number;
  answering_time: number;
  points: number;
  difficulty: string;
  explanation_title: string | null;
  explanation_text: string | null;
  explanation_image_url: string | null;
  show_explanation_time: number | null;
  answers: Array<{
    id: string;
    answer_text: string;
    image_url: string | null;
    is_correct: boolean;
    order_index: number;
  }>;
} | null> {
  const { data: question, error: questionError } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
    .select(SELECT_ALL)
    .eq(COLUMN_ID, questionId)
    .is(COLUMN_DELETED_AT, null)
    .single();

  if (questionError || !question) {
    logger.error({ error: questionError, questionId }, LOG_MESSAGES.FAILED_TO_FETCH_QUESTION);
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES.QUESTION_NOT_FOUND,
    });
    return null;
  }

  const { data: answers, error: answersError } = await supabaseAdmin
    .from(TABLE_ANSWERS)
    .select(SELECT_ALL)
    .eq(COLUMN_QUESTION_ID, question.id)
    .order(COLUMN_ORDER_INDEX, { ascending: true });

  if (answersError) {
    logger.error({ error: answersError, questionId }, LOG_MESSAGES.FAILED_TO_FETCH_QUESTION);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.DATABASE_ERROR,
      message: ERROR_MESSAGES.FAILED_TO_FETCH_ANSWERS,
    });
    return null;
  }

  return {
    ...question,
    answers: answers || [],
  } as {
    id: string;
    question_text: string;
    image_url: string | null;
    question_type: string;
    show_question_time: number;
    answering_time: number;
    points: number;
    difficulty: string;
    explanation_title: string | null;
    explanation_text: string | null;
    explanation_image_url: string | null;
    show_explanation_time: number | null;
    answers: Array<{
      id: string;
      answer_text: string;
      image_url: string | null;
      is_correct: boolean;
      order_index: number;
    }>;
  };
}

/**
 * Function: calculateQuestionTimingForCurrent
 * Description:
 * - Calculate server time and remaining time for current question
 *
 * Parameters:
 * - question (object): Question data with timing fields
 * - startTime (string | null): Question start time ISO string
 *
 * Returns:
 * - object: Timing information with serverTime, remainingMs, and isActive
 */
function calculateQuestionTimingForCurrent(
  question: { show_question_time: number; answering_time: number },
  startTime: string | null,
): {
  serverTime: string;
  remainingMs: number;
  isActive: boolean;
} {
  const serverTime = new Date().toISOString();
  let remainingMs = DEFAULT_QUESTION_INDEX;
  let isActive = false;

  if (startTime) {
    const startTimeMs = new Date(startTime).getTime();
    const now = Date.now();
    const totalDurationMs =
      (question.show_question_time + question.answering_time) * MILLISECONDS_PER_SECOND;
    const elapsed = now - startTimeMs;
    remainingMs = Math.max(MIN_INDEX, totalDurationMs - elapsed);
    isActive = remainingMs > DEFAULT_QUESTION_INDEX;
  }

  return {
    serverTime,
    remainingMs,
    isActive,
  };
}

/**
 * Function: updateGameLockStatus
 * Description:
 * - Update game lock status
 * - Sends error response if update fails
 *
 * Parameters:
 * - gameId (string): Game identifier
 * - locked (boolean): Lock status
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Updated game data if successful, null otherwise
 */
async function updateGameLockStatus(
  gameId: string,
  locked: boolean,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from(TABLE_GAMES)
    .update({ locked })
    .eq(COLUMN_ID, gameId)
    .select()
    .single();

  if (updateError) {
    logger.error({ error: updateError, gameId }, LOG_MESSAGES.FAILED_TO_UPDATE_LOCK_STATUS);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.UPDATE_FAILED,
      message: ERROR_MESSAGES.FAILED_TO_UPDATE_LOCK_STATUS,
    });
    return null;
  }

  return updatedGame;
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
