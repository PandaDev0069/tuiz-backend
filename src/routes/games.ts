import express from 'express';
import { ZodError } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { gameFlowService } from '../services/gameFlowService';
import { AuthenticatedRequest } from '../types/auth';
import { CreateGameSchema, GameStatus } from '../types/game';
import { logger } from '../utils/logger';

const router = express.Router();

// Helper to generate a 6-digit game code
function generateGameCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create a new game
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const userId = req.user?.id;

  try {
    // Validate input
    const input = CreateGameSchema.parse(req.body);

    // Fetch quiz details to get the code and total questions
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz_sets')
      .select('id, total_questions, play_settings')
      .eq('id', input.quiz_set_id)
      .single();

    if (quizError || !quiz) {
      logger.warn({ error: quizError, quizId: input.quiz_set_id }, 'Failed to fetch quiz details');
      return res.status(404).json({ error: 'not_found', message: 'Quiz not found' });
    }

    // Extract game code from quiz settings
    // play_settings is jsonb, so we need to cast or access safely
    const playSettings = quiz.play_settings as Record<string, unknown>;
    let gameCode = (playSettings?.code as number | string)?.toString();

    // If no code in settings, generate one
    if (!gameCode) {
      gameCode = generateGameCode();
    }

    // Check uniqueness and regenerate if needed
    let isUnique = false;
    let attempts = 0;

    // Check the initial code (either from settings or generated)
    const { data: existingGame } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('game_code', gameCode)
      .maybeSingle();

    if (!existingGame) {
      isUnique = true;
    } else {
      // If the preferred code is taken, try generating new ones
      while (!isUnique && attempts < 5) {
        gameCode = generateGameCode();
        const { data } = await supabaseAdmin
          .from('games')
          .select('id')
          .eq('game_code', gameCode)
          .maybeSingle();

        if (!data) {
          isUnique = true;
        } else {
          attempts++;
        }
      }
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique game code');
    }

    // Create game
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .insert({
        quiz_set_id: input.quiz_set_id,
        game_code: gameCode,
        status: GameStatus.WAITING,
        game_settings: input.game_settings || {},
        user_id: userId,
        current_players: 0,
        current_question_index: 0,
        locked: false,
      })
      .select()
      .single();

    if (gameError) {
      logger.error({ error: gameError, requestId }, 'Error creating game');
      return res.status(500).json({ error: 'database_error', message: 'Failed to create game' });
    }

    // Initialize game flow using the service
    const gameFlowResult = await gameFlowService.createGameFlow({
      game_id: game.id,
      quiz_set_id: input.quiz_set_id,
      total_questions: quiz.total_questions,
      current_question_index: 0,
    });

    if (!gameFlowResult.success) {
      // Rollback: Delete the game since game_flows creation failed
      logger.error(
        { gameId: game.id, error: gameFlowResult.error },
        'Game flow creation failed, rolling back game creation',
      );

      // Attempt to delete the game
      const { error: deleteError } = await supabaseAdmin.from('games').delete().eq('id', game.id);

      if (deleteError) {
        logger.error(
          { error: deleteError, gameId: game.id },
          'Failed to rollback game creation after game_flows error',
        );
      }

      return res.status(500).json({
        error: 'database_error',
        message: `Failed to initialize game flow: ${gameFlowResult.error}`,
      });
    }

    logger.info(
      { gameId: game.id, gameFlowId: gameFlowResult.gameFlow?.id, userId },
      'Game and game flow created successfully',
    );
    res.status(201).json({ game });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'validation_error', details: error.issues });
    }
    logger.error({ error, requestId }, 'Unexpected error creating game');
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
});

/**
 * GET /games/:gameId
 * Get game details by ID
 * Public access (for players to verify game exists)
 */
router.get('/:gameId', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameId } = req.params;

  try {
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();

    if (gameError) {
      logger.error({ error: gameError, gameId, requestId }, 'Error fetching game');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch game',
        requestId,
      });
    }

    if (!game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found',
        requestId,
      });
    }

    return res.status(200).json(game);
  } catch (error) {
    logger.error({ error, gameId, requestId }, 'Unexpected error fetching game');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

/**
 * GET /games/by-code/:gameCode
 * Get game details by room code
 * Public access (for players to join using room code)
 */
router.get('/by-code/:gameCode', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  const { gameCode } = req.params;

  try {
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('game_code', gameCode)
      .maybeSingle();

    if (gameError) {
      logger.error({ error: gameError, gameCode, requestId }, 'Error fetching game by code');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch game',
        requestId,
      });
    }

    if (!game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found',
        requestId,
      });
    }

    return res.status(200).json(game);
  } catch (error) {
    logger.error({ error, gameCode, requestId }, 'Unexpected error fetching game by code');
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      requestId,
    });
  }
});

export default router;
