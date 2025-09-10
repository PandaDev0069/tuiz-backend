// src/routes/publishing.ts
import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { QuizStatus, QuizError, QuizSetResponse } from '../types/quiz';
import { logger } from '../utils/logger';

const router = express.Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getQuizById(quizId: string, userId: string): Promise<QuizSetResponse | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_sets')
      .select('*')
      .eq('id', quizId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error({ error, quizId, userId }, 'Error fetching quiz by ID');
      return null;
    }

    return data as QuizSetResponse;
  } catch (error) {
    logger.error({ error, quizId, userId }, 'Exception in getQuizById');
    return null;
  }
}

async function fetchQuizForValidation(quizId: string): Promise<QuizSetResponse | null> {
  try {
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz_sets')
      .select('*')
      .eq('id', quizId)
      .maybeSingle();

    if (quizError) {
      logger.error({ error: quizError, quizId }, 'Error fetching quiz for validation');
      return null;
    }

    return quiz as QuizSetResponse;
  } catch (error) {
    logger.error({ error, quizId }, 'Exception in fetchQuizForValidation');
    return null;
  }
}

async function validateQuizQuestions(quizId: string): Promise<{
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if quiz has questions
    const { count: questionCount, error: questionError } = await supabaseAdmin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('question_set_id', quizId);

    if (questionError) {
      logger.error({ error: questionError, quizId }, 'Error counting questions');
      return { errors: ['Failed to count questions'], warnings: [] };
    }

    if (!questionCount || questionCount === 0) {
      errors.push('Quiz must have at least one question');
      return { errors, warnings };
    }

    // Check if all questions have answers
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('id, question_text')
      .eq('question_set_id', quizId);

    if (questionsError) {
      logger.error({ error: questionsError, quizId }, 'Error fetching questions');
      return { errors: ['Failed to fetch questions'], warnings: [] };
    }

    for (const question of questions || []) {
      const questionValidation = await validateQuestionAnswers(question.id, question.question_text);
      errors.push(...questionValidation.errors);
    }

    return { errors, warnings };
  } catch (error) {
    logger.error({ error, quizId }, 'Exception in validateQuizQuestions');
    return { errors: ['Failed to validate questions'], warnings: [] };
  }
}

async function validateQuestionAnswers(
  questionId: string,
  questionText: string,
): Promise<{
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const { count: answerCount, error: answerError } = await supabaseAdmin
      .from('answers')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId);

    if (answerError) {
      logger.error({ error: answerError, questionId }, 'Error counting answers');
      errors.push(`Failed to count answers for question: ${questionText}`);
      return { errors };
    }

    if (!answerCount || answerCount === 0) {
      errors.push(`Question "${questionText}" must have at least one answer`);
      return { errors };
    }

    // Check if exactly one answer is correct
    const { data: answers, error: answersError } = await supabaseAdmin
      .from('answers')
      .select('is_correct')
      .eq('question_id', questionId);

    if (answersError) {
      logger.error({ error: answersError, questionId }, 'Error fetching answers');
      errors.push(`Failed to fetch answers for question: ${questionText}`);
      return { errors };
    }

    const correctAnswers = answers?.filter((answer) => answer.is_correct) || [];
    if (correctAnswers.length === 0) {
      errors.push(`Question "${questionText}" must have at least one correct answer`);
    } else if (correctAnswers.length > 1) {
      errors.push(`Question "${questionText}" must have exactly one correct answer`);
    }

    return { errors };
  } catch (error) {
    logger.error({ error, questionId }, 'Exception in validateQuestionAnswers');
    errors.push(`Failed to validate answers for question: ${questionText}`);
    return { errors };
  }
}

function validateQuizMetadata(quiz: QuizSetResponse): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check quiz metadata
  if (!quiz.title || quiz.title.trim().length === 0) {
    errors.push('Quiz title is required');
  }

  if (!quiz.description || quiz.description.trim().length === 0) {
    errors.push('Quiz description is required');
  }

  if (!quiz.category || quiz.category.trim().length === 0) {
    errors.push('Quiz category is required');
  }

  if (!quiz.tags || quiz.tags.length === 0) {
    warnings.push('Consider adding tags to help users find your quiz');
  }

  // Check if quiz is already published
  if (quiz.status === QuizStatus.PUBLISHED) {
    warnings.push('Quiz is already published');
  }

  return { errors, warnings };
}

async function validateQuizForPublishing(quizId: string): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if quiz exists
    const quiz = await fetchQuizForValidation(quizId);
    if (!quiz) {
      return { isValid: false, errors: ['Quiz not found'], warnings: [] };
    }

    // Validate quiz metadata
    const metadataValidation = validateQuizMetadata(quiz);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);

    // Validate questions and answers
    const questionsValidation = await validateQuizQuestions(quizId);
    errors.push(...questionsValidation.errors);
    warnings.push(...questionsValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    logger.error({ error, quizId }, 'Exception in validateQuizForPublishing');
    return { isValid: false, errors: ['Validation failed due to internal error'], warnings: [] };
  }
}

// ============================================================================
// PUBLISHING ROUTES
// ============================================================================

// POST /quiz/:id/publish - Publish quiz
router.post('/:id/publish', authMiddleware, async (req: AuthenticatedRequest, res) => {
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

    // Validate quiz before publishing
    const validation = await validateQuizForPublishing(id);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'validation_failed',
        message: 'Quiz cannot be published due to validation errors',
        details: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
      } as QuizError);
    }

    // Update quiz status to published
    const { data: updatedQuiz, error: updateError } = await supabaseAdmin
      .from('quiz_sets')
      .update({
        status: QuizStatus.PUBLISHED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, quizId: id, userId }, 'Error publishing quiz');
      return res.status(500).json({
        error: 'publish_failed',
        message: 'Failed to publish quiz',
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, 'Quiz published successfully');

    res.json({
      message: 'Quiz published successfully',
      quiz: updatedQuiz,
      validation: {
        errors: validation.errors,
        warnings: validation.warnings,
      },
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in POST /quiz/:id/publish');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// POST /quiz/:id/unpublish - Unpublish quiz
router.post('/:id/unpublish', authMiddleware, async (req: AuthenticatedRequest, res) => {
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

    // Check if quiz is currently published
    if (quiz.status !== QuizStatus.PUBLISHED) {
      return res.status(400).json({
        error: 'invalid_status',
        message: 'Quiz is not currently published',
      } as QuizError);
    }

    // Update quiz status to draft
    const { data: updatedQuiz, error: updateError } = await supabaseAdmin
      .from('quiz_sets')
      .update({
        status: QuizStatus.DRAFT,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, quizId: id, userId }, 'Error unpublishing quiz');
      return res.status(500).json({
        error: 'unpublish_failed',
        message: 'Failed to unpublish quiz',
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, 'Quiz unpublished successfully');

    res.json({
      message: 'Quiz unpublished successfully',
      quiz: updatedQuiz,
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in POST /quiz/:id/unpublish');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// GET /quiz/:id/validate - Validate quiz
router.get('/:id/validate', authMiddleware, async (req: AuthenticatedRequest, res) => {
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

    // Validate quiz
    const validation = await validateQuizForPublishing(id);

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        status: quiz.status,
        total_questions: quiz.total_questions,
      },
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in GET /quiz/:id/validate');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

export default router;
