// src/routes/answers.ts
import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateAnswerSchema,
  AnswerResponse,
  QuizError,
  CreateAnswerInput,
  QuestionType,
} from '../types/quiz';
import { logger } from '../utils/logger';
import { validateRequest } from '../utils/quizValidation';

const router = express.Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getQuizById(
  quizId: string,
  userId: string,
): Promise<{ id: string; user_id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_sets')
      .select('id, user_id')
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

async function getQuestionById(
  questionId: string,
  quizId: string,
): Promise<{ id: string; question_type: QuestionType } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('id, question_type')
      .eq('id', questionId)
      .eq('question_set_id', quizId)
      .maybeSingle();

    if (error) {
      logger.error({ error, questionId, quizId }, 'Error fetching question by ID');
      return null;
    }

    return data;
  } catch (error) {
    logger.error({ error, questionId, quizId }, 'Exception in getQuestionById');
    return null;
  }
}

async function getAnswerById(answerId: string, questionId: string): Promise<AnswerResponse | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('answers')
      .select('*')
      .eq('id', answerId)
      .eq('question_id', questionId)
      .maybeSingle();

    if (error) {
      logger.error({ error, answerId, questionId }, 'Error fetching answer by ID');
      return null;
    }

    return data as AnswerResponse;
  } catch (error) {
    logger.error({ error, answerId, questionId }, 'Exception in getAnswerById');
    return null;
  }
}

async function validateAnswerConstraints(
  questionId: string,
  answerData: CreateAnswerInput,
  excludeAnswerId?: string,
): Promise<{ isValid: boolean; message?: string }> {
  try {
    // Get existing answers for this question
    let query = supabaseAdmin
      .from('answers')
      .select('id, is_correct')
      .eq('question_id', questionId);

    if (excludeAnswerId) {
      query = query.neq('id', excludeAnswerId);
    }

    const { data: existingAnswers, error } = await query;

    if (error) {
      logger.error({ error, questionId }, 'Error fetching existing answers');
      return { isValid: false, message: 'Failed to validate answer constraints' };
    }

    // Get question type
    const question = await getQuestionById(questionId, ''); // We'll get quizId from question
    if (!question) {
      return { isValid: false, message: 'Question not found' };
    }

    // Count correct answers including the new/updated one
    const correctAnswers = existingAnswers?.filter((answer) => answer.is_correct) || [];
    const totalCorrectAnswers = correctAnswers.length + (answerData.is_correct ? 1 : 0);

    // Validate based on question type
    if (question.question_type === QuestionType.TRUE_FALSE) {
      const totalAnswers = (existingAnswers?.length || 0) + (excludeAnswerId ? 0 : 1);
      if (totalAnswers > 2) {
        return { isValid: false, message: 'True/False questions can only have 2 answers' };
      }
    } else if (question.question_type === QuestionType.MULTIPLE_CHOICE) {
      const totalAnswers = (existingAnswers?.length || 0) + (excludeAnswerId ? 0 : 1);
      if (totalAnswers > 4) {
        return { isValid: false, message: 'Multiple choice questions can have at most 4 answers' };
      }
    }

    // Must have exactly one correct answer
    if (totalCorrectAnswers !== 1) {
      return { isValid: false, message: 'Must have exactly one correct answer' };
    }

    return { isValid: true };
  } catch (error) {
    logger.error({ error, questionId }, 'Exception in validateAnswerConstraints');
    return { isValid: false, message: 'Failed to validate answer constraints' };
  }
}

// ============================================================================
// ANSWER CRUD ROUTES
// ============================================================================

// POST /quiz/:quizId/questions/:questionId/answers - Add answer
router.post(
  '/:quizId/questions/:questionId/answers',
  authMiddleware,
  validateRequest(CreateAnswerSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId, questionId } = req.params;
      const userId = req.user!.id;
      const answerData = req.body as CreateAnswerInput;

      // Verify quiz exists and user owns it
      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Quiz not found or you do not have permission to modify it',
        } as QuizError);
      }

      // Verify question exists and get its type
      const question = await getQuestionById(questionId, quizId);
      if (!question) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Question not found',
        } as QuizError);
      }

      // Validate answer constraints
      const validation = await validateAnswerConstraints(questionId, answerData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'validation_error',
          message: validation.message,
        } as QuizError);
      }

      // Create answer
      const { data: answer, error: answerError } = await supabaseAdmin
        .from('answers')
        .insert({
          question_id: questionId,
          answer_text: answerData.answer_text,
          image_url: answerData.image_url || null,
          is_correct: answerData.is_correct,
          order_index: answerData.order_index,
        })
        .select()
        .single();

      if (answerError) {
        logger.error(
          { error: answerError, questionId, quizId, userId, answerData },
          'Error creating answer',
        );
        return res.status(500).json({
          error: 'creation_failed',
          message: 'Failed to create answer',
        } as QuizError);
      }

      logger.info(
        { answerId: answer.id, questionId, quizId, userId },
        'Answer created successfully',
      );

      res.status(201).json({
        id: answer.id,
        question_id: answer.question_id,
        answer_text: answer.answer_text,
        image_url: answer.image_url,
        is_correct: answer.is_correct,
        order_index: answer.order_index,
        created_at: answer.created_at,
        updated_at: answer.updated_at,
      } as AnswerResponse);
    } catch (error) {
      logger.error(
        { error, questionId: req.params.questionId, quizId: req.params.quizId },
        'Exception in POST /quiz/:quizId/questions/:questionId/answers',
      );
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

// PUT /quiz/:quizId/questions/:questionId/answers/:answerId - Update answer
router.put(
  '/:quizId/questions/:questionId/answers/:answerId',
  authMiddleware,
  validateRequest(CreateAnswerSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId, questionId, answerId } = req.params;
      const userId = req.user!.id;
      const answerData = req.body as CreateAnswerInput;

      // Verify quiz exists and user owns it
      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Quiz not found or you do not have permission to modify it',
        } as QuizError);
      }

      // Verify question exists
      const question = await getQuestionById(questionId, quizId);
      if (!question) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Question not found',
        } as QuizError);
      }

      // Verify answer exists
      const existingAnswer = await getAnswerById(answerId, questionId);
      if (!existingAnswer) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Answer not found',
        } as QuizError);
      }

      // Validate answer constraints
      const validation = await validateAnswerConstraints(questionId, answerData, answerId);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'validation_error',
          message: validation.message,
        } as QuizError);
      }

      // Update answer
      const { data: answer, error: answerError } = await supabaseAdmin
        .from('answers')
        .update({
          answer_text: answerData.answer_text,
          image_url: answerData.image_url || null,
          is_correct: answerData.is_correct,
          order_index: answerData.order_index,
          updated_at: new Date().toISOString(),
        })
        .eq('id', answerId)
        .eq('question_id', questionId)
        .select()
        .single();

      if (answerError) {
        logger.error(
          { error: answerError, answerId, questionId, quizId, userId, answerData },
          'Error updating answer',
        );
        return res.status(500).json({
          error: 'update_failed',
          message: 'Failed to update answer',
        } as QuizError);
      }

      logger.info({ answerId, questionId, quizId, userId }, 'Answer updated successfully');

      res.json({
        id: answer.id,
        question_id: answer.question_id,
        answer_text: answer.answer_text,
        image_url: answer.image_url,
        is_correct: answer.is_correct,
        order_index: answer.order_index,
        created_at: answer.created_at,
        updated_at: answer.updated_at,
      } as AnswerResponse);
    } catch (error) {
      logger.error(
        {
          error,
          answerId: req.params.answerId,
          questionId: req.params.questionId,
          quizId: req.params.quizId,
        },
        'Exception in PUT /quiz/:quizId/questions/:questionId/answers/:answerId',
      );
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

// DELETE /quiz/:quizId/questions/:questionId/answers/:answerId - Delete answer
router.delete(
  '/:quizId/questions/:questionId/answers/:answerId',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId, questionId, answerId } = req.params;
      const userId = req.user!.id;

      // Verify quiz exists and user owns it
      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Quiz not found or you do not have permission to modify it',
        } as QuizError);
      }

      // Verify question exists
      const question = await getQuestionById(questionId, quizId);
      if (!question) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Question not found',
        } as QuizError);
      }

      // Verify answer exists
      const existingAnswer = await getAnswerById(answerId, questionId);
      if (!existingAnswer) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Answer not found',
        } as QuizError);
      }

      // Check if this is the last answer
      const { count, error: countError } = await supabaseAdmin
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', questionId);

      if (countError) {
        logger.error({ error: countError, questionId }, 'Error counting answers');
        return res.status(500).json({
          error: 'delete_failed',
          message: 'Failed to count answers',
        } as QuizError);
      }

      if (count && count <= 1) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Cannot delete the last answer. A question must have at least one answer.',
        } as QuizError);
      }

      // Delete answer
      const { error } = await supabaseAdmin
        .from('answers')
        .delete()
        .eq('id', answerId)
        .eq('question_id', questionId);

      if (error) {
        logger.error({ error, answerId, questionId, quizId, userId }, 'Error deleting answer');
        return res.status(500).json({
          error: 'delete_failed',
          message: 'Failed to delete answer',
        } as QuizError);
      }

      logger.info({ answerId, questionId, quizId, userId }, 'Answer deleted successfully');

      res.status(204).send();
    } catch (error) {
      logger.error(
        {
          error,
          answerId: req.params.answerId,
          questionId: req.params.questionId,
          quizId: req.params.quizId,
        },
        'Exception in DELETE /quiz/:quizId/questions/:questionId/answers/:answerId',
      );
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

export default router;
