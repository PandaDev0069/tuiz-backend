// src/routes/codes.ts
import express from 'express';
import { supabaseAdmin, generateQuizCode } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { QuizError } from '../types/quiz';
import { logger } from '../utils/logger';

const router = express.Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getQuizById(
  quizId: string,
  userId: string,
): Promise<{ id: string; user_id: string; play_settings: Record<string, unknown> } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_sets')
      .select('id, user_id, play_settings')
      .eq('id', quizId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error({ error, quizId, userId }, 'Error fetching quiz by ID');
      return null;
    }

    return data;
  } catch (error) {
    logger.error({ error, quizId, userId }, 'Exception in getQuizById');
    return null;
  }
}

async function checkCodeAvailability(
  code: number,
): Promise<{ isAvailable: boolean; quizId?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_sets')
      .select('id')
      .eq('play_settings->code', code)
      .maybeSingle();

    if (error) {
      logger.error({ error, code }, 'Error checking code availability');
      return { isAvailable: false };
    }

    return {
      isAvailable: !data,
      quizId: data?.id,
    };
  } catch (error) {
    logger.error({ error, code }, 'Exception in checkCodeAvailability');
    return { isAvailable: false };
  }
}

async function generateUniqueCode(maxAttempts: number = 10): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const code = await generateQuizCode();
      const { isAvailable } = await checkCodeAvailability(code);

      if (isAvailable) {
        return code;
      }

      logger.warn({ code, attempt: attempt + 1 }, 'Generated code already exists, retrying');
    } catch (error) {
      logger.error({ error, attempt: attempt + 1 }, 'Error generating code, retrying');
    }
  }

  throw new Error('Failed to generate unique code after maximum attempts');
}

// ============================================================================
// CODE MANAGEMENT ROUTES
// ============================================================================

// POST /quiz/:id/generate-code - Generate unique code for quiz
router.post('/:id/generate-code', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify quiz exists and user owns it
    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found or you do not have permission to modify it',
      } as QuizError);
    }

    // Generate unique code
    const newCode = await generateUniqueCode();

    // Update quiz with new code
    const { data: updatedQuiz, error: updateError } = await supabaseAdmin
      .from('quiz_sets')
      .update({
        play_settings: {
          ...quiz.play_settings,
          code: newCode,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('play_settings')
      .single();

    if (updateError) {
      logger.error(
        { error: updateError, quizId: id, userId, newCode },
        'Error updating quiz with new code',
      );
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to update quiz with new code',
      } as QuizError);
    }

    logger.info({ quizId: id, userId, newCode }, 'Quiz code generated successfully');

    res.json({
      message: 'Quiz code generated successfully',
      code: newCode,
      quiz: {
        id,
        play_settings: updatedQuiz.play_settings,
      },
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in POST /quiz/:id/generate-code');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// GET /quiz/code/check/:code - Check code availability
router.get('/code/check/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const codeNumber = parseInt(code, 10);

    // Validate code format (6-digit number)
    if (isNaN(codeNumber) || codeNumber < 100000 || codeNumber > 999999) {
      return res.status(400).json({
        error: 'invalid_code',
        message: 'Code must be a 6-digit number',
      } as QuizError);
    }

    // Check code availability
    const { isAvailable, quizId } = await checkCodeAvailability(codeNumber);

    res.json({
      code: codeNumber,
      isAvailable,
      quizId: quizId || null,
      message: isAvailable ? 'Code is available' : 'Code is already in use',
    });
  } catch (error) {
    logger.error({ error, code: req.params.code }, 'Exception in GET /quiz/code/check/:code');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// GET /quiz/:id/code - Get current quiz code
router.get('/:id/code', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify quiz exists and user owns it
    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found or you do not have permission to view it',
      } as QuizError);
    }

    const currentCode = quiz.play_settings?.code;

    res.json({
      quizId: id,
      code: currentCode || null,
      hasCode: !!currentCode,
      message: currentCode ? 'Quiz code retrieved successfully' : 'Quiz has no code assigned',
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in GET /quiz/:id/code');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// DELETE /quiz/:id/code - Remove quiz code
router.delete('/:id/code', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify quiz exists and user owns it
    const quiz = await getQuizById(id, userId);
    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found or you do not have permission to modify it',
      } as QuizError);
    }

    // Update quiz to remove code
    const { data: updatedQuiz, error: updateError } = await supabaseAdmin
      .from('quiz_sets')
      .update({
        play_settings: {
          ...quiz.play_settings,
          code: null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('play_settings')
      .single();

    if (updateError) {
      logger.error({ error: updateError, quizId: id, userId }, 'Error removing quiz code');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to remove quiz code',
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, 'Quiz code removed successfully');

    res.json({
      message: 'Quiz code removed successfully',
      quiz: {
        id,
        play_settings: updatedQuiz.play_settings,
      },
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in DELETE /quiz/:id/code');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

export default router;
