// src/routes/questions.ts
import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateQuestionSchema,
  UpdateQuestionSchema,
  QuestionResponse,
  QuizError,
  CreateQuestionInput,
  UpdateQuestionInput,
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
): Promise<QuestionResponse | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .eq('question_set_id', quizId)
      .maybeSingle();

    if (error) {
      logger.error({ error, questionId, quizId }, 'Error fetching question by ID');
      return null;
    }

    return data as QuestionResponse;
  } catch (error) {
    logger.error({ error, questionId, quizId }, 'Exception in getQuestionById');
    return null;
  }
}

async function updateQuizQuestionCount(quizId: string): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('question_set_id', quizId);

    if (error) {
      logger.error({ error, quizId }, 'Error counting questions');
      return;
    }

    await supabaseAdmin
      .from('quiz_sets')
      .update({ total_questions: count || 0, updated_at: new Date().toISOString() })
      .eq('id', quizId);
  } catch (error) {
    logger.error({ error, quizId }, 'Exception in updateQuizQuestionCount');
  }
}

// ============================================================================
// QUESTION CRUD ROUTES
// ============================================================================

// POST /quiz/:quizId/questions - Add question
router.post(
  '/:quizId/questions',
  authMiddleware,
  validateRequest(CreateQuestionSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId } = req.params;
      const userId = req.user!.id;
      const questionData = req.body as CreateQuestionInput;

      // Verify quiz exists and user owns it
      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Quiz not found or you do not have permission to modify it',
        } as QuizError);
      }

      // Validate answers based on question type
      if (
        questionData.question_type === QuestionType.TRUE_FALSE &&
        questionData.answers.length !== 2
      ) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'True/False questions must have exactly 2 answers',
        } as QuizError);
      }

      if (
        questionData.question_type === QuestionType.MULTIPLE_CHOICE &&
        (questionData.answers.length < 2 || questionData.answers.length > 4)
      ) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Multiple choice questions must have between 2 and 4 answers',
        } as QuizError);
      }

      // Check that exactly one answer is correct
      const correctAnswers = questionData.answers.filter((answer) => answer.is_correct);
      if (correctAnswers.length !== 1) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Must have exactly one correct answer',
        } as QuizError);
      }

      // Start transaction-like operations
      const { data: question, error: questionError } = await supabaseAdmin
        .from('questions')
        .insert({
          question_set_id: quizId,
          question_text: questionData.question_text,
          question_type: questionData.question_type,
          image_url: questionData.image_url || null,
          show_question_time: questionData.show_question_time,
          answering_time: questionData.answering_time,
          points: questionData.points,
          difficulty: questionData.difficulty,
          order_index: questionData.order_index,
          explanation_title: questionData.explanation_title || null,
          explanation_text: questionData.explanation_text || null,
          explanation_image_url: questionData.explanation_image_url || null,
          show_explanation_time: questionData.show_explanation_time,
        })
        .select()
        .single();

      if (questionError) {
        logger.error(
          { error: questionError, quizId, userId, questionData },
          'Error creating question',
        );
        return res.status(500).json({
          error: 'creation_failed',
          message: 'Failed to create question',
        } as QuizError);
      }

      // Create answers
      const answersToInsert = questionData.answers.map((answer) => ({
        question_id: question.id,
        answer_text: answer.answer_text,
        image_url: answer.image_url || null,
        is_correct: answer.is_correct,
        order_index: answer.order_index,
      }));

      const { error: answersError } = await supabaseAdmin.from('answers').insert(answersToInsert);

      if (answersError) {
        logger.error({ error: answersError, questionId: question.id }, 'Error creating answers');
        // Clean up the question if answers failed
        await supabaseAdmin.from('questions').delete().eq('id', question.id);
        return res.status(500).json({
          error: 'creation_failed',
          message: 'Failed to create answers',
        } as QuizError);
      }

      // Update quiz question count
      await updateQuizQuestionCount(quizId);

      logger.info({ questionId: question.id, quizId, userId }, 'Question created successfully');

      res.status(201).json({
        id: question.id,
        question_set_id: question.question_set_id,
        question_text: question.question_text,
        question_type: question.question_type,
        image_url: question.image_url,
        show_question_time: question.show_question_time,
        answering_time: question.answering_time,
        points: question.points,
        difficulty: question.difficulty,
        order_index: question.order_index,
        created_at: question.created_at,
        updated_at: question.updated_at,
        explanation_title: question.explanation_title,
        explanation_text: question.explanation_text,
        explanation_image_url: question.explanation_image_url,
        show_explanation_time: question.show_explanation_time,
      } as QuestionResponse);
    } catch (error) {
      logger.error(
        { error, quizId: req.params.quizId },
        'Exception in POST /quiz/:quizId/questions',
      );
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

// PUT /quiz/:quizId/questions/:questionId - Update question
router.put(
  '/:quizId/questions/:questionId',
  authMiddleware,
  validateRequest(UpdateQuestionSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId, questionId } = req.params;
      const userId = req.user!.id;
      const updateData = req.body as UpdateQuestionInput;

      // Verify quiz exists and user owns it
      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Quiz not found or you do not have permission to modify it',
        } as QuizError);
      }

      // Verify question exists
      const existingQuestion = await getQuestionById(questionId, quizId);
      if (!existingQuestion) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Question not found',
        } as QuizError);
      }

      // Prepare update data
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Only update provided fields
      if (updateData.question_text !== undefined)
        updatePayload.question_text = updateData.question_text;
      if (updateData.question_type !== undefined)
        updatePayload.question_type = updateData.question_type;
      if (updateData.image_url !== undefined) updatePayload.image_url = updateData.image_url;
      if (updateData.show_question_time !== undefined)
        updatePayload.show_question_time = updateData.show_question_time;
      if (updateData.answering_time !== undefined)
        updatePayload.answering_time = updateData.answering_time;
      if (updateData.points !== undefined) updatePayload.points = updateData.points;
      if (updateData.difficulty !== undefined) updatePayload.difficulty = updateData.difficulty;
      if (updateData.order_index !== undefined) updatePayload.order_index = updateData.order_index;
      if (updateData.explanation_title !== undefined)
        updatePayload.explanation_title = updateData.explanation_title;
      if (updateData.explanation_text !== undefined)
        updatePayload.explanation_text = updateData.explanation_text;
      if (updateData.explanation_image_url !== undefined)
        updatePayload.explanation_image_url = updateData.explanation_image_url;
      if (updateData.show_explanation_time !== undefined)
        updatePayload.show_explanation_time = updateData.show_explanation_time;

      // Update question
      const { data: question, error: questionError } = await supabaseAdmin
        .from('questions')
        .update(updatePayload)
        .eq('id', questionId)
        .eq('question_set_id', quizId)
        .select()
        .single();

      if (questionError) {
        logger.error(
          { error: questionError, questionId, quizId, userId, updateData },
          'Error updating question',
        );
        return res.status(500).json({
          error: 'update_failed',
          message: 'Failed to update question',
        } as QuizError);
      }

      // Update answers if provided
      if (updateData.answers) {
        // Validate answers
        if (
          updateData.question_type === QuestionType.TRUE_FALSE &&
          updateData.answers.length !== 2
        ) {
          return res.status(400).json({
            error: 'validation_error',
            message: 'True/False questions must have exactly 2 answers',
          } as QuizError);
        }

        if (
          updateData.question_type === QuestionType.MULTIPLE_CHOICE &&
          (updateData.answers.length < 2 || updateData.answers.length > 4)
        ) {
          return res.status(400).json({
            error: 'validation_error',
            message: 'Multiple choice questions must have between 2 and 4 answers',
          } as QuizError);
        }

        const correctAnswers = updateData.answers.filter((answer) => answer.is_correct);
        if (correctAnswers.length !== 1) {
          return res.status(400).json({
            error: 'validation_error',
            message: 'Must have exactly one correct answer',
          } as QuizError);
        }

        // Delete existing answers
        const { error: deleteError } = await supabaseAdmin
          .from('answers')
          .delete()
          .eq('question_id', questionId);

        if (deleteError) {
          logger.error({ error: deleteError, questionId }, 'Error deleting existing answers');
          return res.status(500).json({
            error: 'update_failed',
            message: 'Failed to update answers',
          } as QuizError);
        }

        // Insert new answers
        const answersToInsert = updateData.answers.map((answer) => ({
          question_id: questionId,
          answer_text: answer.answer_text,
          image_url: answer.image_url || null,
          is_correct: answer.is_correct,
          order_index: answer.order_index,
        }));

        const { error: answersError } = await supabaseAdmin.from('answers').insert(answersToInsert);

        if (answersError) {
          logger.error({ error: answersError, questionId }, 'Error creating new answers');
          return res.status(500).json({
            error: 'update_failed',
            message: 'Failed to update answers',
          } as QuizError);
        }
      }

      logger.info({ questionId, quizId, userId }, 'Question updated successfully');

      res.json({
        id: question.id,
        question_set_id: question.question_set_id,
        question_text: question.question_text,
        question_type: question.question_type,
        image_url: question.image_url,
        show_question_time: question.show_question_time,
        answering_time: question.answering_time,
        points: question.points,
        difficulty: question.difficulty,
        order_index: question.order_index,
        created_at: question.created_at,
        updated_at: question.updated_at,
        explanation_title: question.explanation_title,
        explanation_text: question.explanation_text,
        explanation_image_url: question.explanation_image_url,
        show_explanation_time: question.show_explanation_time,
      } as QuestionResponse);
    } catch (error) {
      logger.error(
        { error, questionId: req.params.questionId, quizId: req.params.quizId },
        'Exception in PUT /quiz/:quizId/questions/:questionId',
      );
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

// DELETE /quiz/:quizId/questions/:questionId - Delete question
router.delete(
  '/:quizId/questions/:questionId',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId, questionId } = req.params;
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
      const existingQuestion = await getQuestionById(questionId, quizId);
      if (!existingQuestion) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Question not found',
        } as QuizError);
      }

      // Delete question (cascade will handle answers)
      const { error } = await supabaseAdmin
        .from('questions')
        .delete()
        .eq('id', questionId)
        .eq('question_set_id', quizId);

      if (error) {
        logger.error({ error, questionId, quizId, userId }, 'Error deleting question');
        return res.status(500).json({
          error: 'delete_failed',
          message: 'Failed to delete question',
        } as QuizError);
      }

      // Update quiz question count
      await updateQuizQuestionCount(quizId);

      logger.info({ questionId, quizId, userId }, 'Question deleted successfully');

      res.status(204).send();
    } catch (error) {
      logger.error(
        { error, questionId: req.params.questionId, quizId: req.params.quizId },
        'Exception in DELETE /quiz/:quizId/questions/:questionId',
      );
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

// PUT /quiz/:quizId/questions/reorder - Reorder questions
router.put('/:quizId/questions/reorder', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user!.id;
    const { questionIds } = req.body as { questionIds: string[] };

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'questionIds must be a non-empty array',
      } as QuizError);
    }

    // Verify quiz exists and user owns it
    const quiz = await getQuizById(quizId, userId);
    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found or you do not have permission to modify it',
      } as QuizError);
    }

    // Update order_index for each question
    const updates = questionIds.map((questionId, index) =>
      supabaseAdmin
        .from('questions')
        .update({
          order_index: index,
          updated_at: new Date().toISOString(),
        })
        .eq('id', questionId)
        .eq('question_set_id', quizId),
    );

    const results = await Promise.all(updates);

    // Check for errors
    const errors = results.filter((result) => result.error);
    if (errors.length > 0) {
      logger.error({ errors, quizId, userId, questionIds }, 'Error reordering questions');
      return res.status(500).json({
        error: 'reorder_failed',
        message: 'Failed to reorder questions',
      } as QuizError);
    }

    logger.info({ quizId, userId, questionIds }, 'Questions reordered successfully');

    res.json({ message: 'Questions reordered successfully' });
  } catch (error) {
    logger.error(
      { error, quizId: req.params.quizId },
      'Exception in PUT /quiz/:quizId/questions/reorder',
    );
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

export default router;
