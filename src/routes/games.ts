import express from 'express';
import { ZodError } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
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

    // Initialize game flow
    const { error: flowError } = await supabaseAdmin.from('game_flows').insert({
      game_id: game.id,
      quiz_set_id: input.quiz_set_id,
      total_questions: quiz.total_questions,
      current_question_index: 0,
    });

    if (flowError) {
      logger.error({ error: flowError, gameId: game.id }, 'Error creating game flow');
    }

    logger.info({ gameId: game.id, userId }, 'Game created successfully');
    res.status(201).json({ game });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'validation_error', details: error.issues });
    }
    logger.error({ error, requestId }, 'Unexpected error creating game');
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
});

export default router;
