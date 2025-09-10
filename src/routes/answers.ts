// src/routes/answers.ts
import express from 'express';
import { supabaseAdmin, createAuthenticatedClient } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { answerRateLimit } from '../middleware/rateLimit';
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
): Promise<{ id: string; question_type: QuestionType; question_set_id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('id, question_type, question_set_id')
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

async function getQuestionByIdOnly(
  questionId: string,
): Promise<{ id: string; question_type: QuestionType; question_set_id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('id, question_type, question_set_id')
      .eq('id', questionId)
      .maybeSingle();

    if (error) {
      logger.error({ error, questionId }, 'Error fetching question by ID');
      return null;
    }

    return data;
  } catch (error) {
    logger.error({ error, questionId }, 'Exception in getQuestionByIdOnly');
    return null;
  }
}

async function getAnswerById(answerId: string, questionId: string): Promise<AnswerResponse | null> {
  try {
    // Validate UUID format before querying database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(answerId)) {
      logger.warn({ answerId, questionId }, 'Invalid UUID format for answer ID');
      return null;
    }

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

async function fetchExistingAnswers(
  questionId: string,
  excludeAnswerId?: string,
): Promise<{ data: { id: string; is_correct: boolean }[] | null; error: Error | null }> {
  let query = supabaseAdmin.from('answers').select('id, is_correct').eq('question_id', questionId);

  if (excludeAnswerId) {
    query = query.neq('id', excludeAnswerId);
  }

  return await query;
}

function calculateAnswerCounts(
  existingAnswers: { id: string; is_correct: boolean }[],
  answerData: CreateAnswerInput,
  excludeAnswerId?: string,
): { totalAnswers: number; totalCorrectAnswers: number } {
  const existingAnswerList = existingAnswers || [];
  const correctAnswers = existingAnswerList.filter((answer) => answer.is_correct);

  const totalAnswersAfterOperation = excludeAnswerId
    ? existingAnswerList.length
    : existingAnswerList.length + 1;

  let totalCorrectAnswersAfterOperation = correctAnswers.length;

  if (excludeAnswerId) {
    // For updates: check if we're changing the correctness
    const existingAnswer = existingAnswerList.find((a) => a.id === excludeAnswerId);
    if (existingAnswer?.is_correct && !answerData.is_correct) {
      totalCorrectAnswersAfterOperation--; // removing a correct answer
    } else if (!existingAnswer?.is_correct && answerData.is_correct) {
      totalCorrectAnswersAfterOperation++; // making an incorrect answer correct
    }
  } else {
    // For creation: if the new answer is correct, add 1
    if (answerData.is_correct) {
      totalCorrectAnswersAfterOperation++;
    }
  }

  return {
    totalAnswers: totalAnswersAfterOperation,
    totalCorrectAnswers: totalCorrectAnswersAfterOperation,
  };
}

function validateQuestionTypeConstraints(
  questionType: QuestionType,
  totalAnswers: number,
): { isValid: boolean; message?: string } {
  if (questionType === QuestionType.TRUE_FALSE) {
    if (totalAnswers > 2) {
      return { isValid: false, message: 'True/False questions can only have 2 answers' };
    }
  } else if (questionType === QuestionType.MULTIPLE_CHOICE) {
    if (totalAnswers > 4) {
      return { isValid: false, message: 'Multiple choice questions can have at most 4 answers' };
    }
  }

  return { isValid: true };
}

function validateCorrectAnswerConstraint(totalCorrectAnswers: number): {
  isValid: boolean;
  message?: string;
} {
  if (totalCorrectAnswers !== 1) {
    return { isValid: false, message: 'Must have exactly one correct answer' };
  }
  return { isValid: true };
}

async function validateAnswerConstraints(
  questionId: string,
  answerData: CreateAnswerInput,
  excludeAnswerId?: string,
): Promise<{ isValid: boolean; message?: string }> {
  try {
    // Get existing answers for this question
    const { data: existingAnswers, error } = await fetchExistingAnswers(
      questionId,
      excludeAnswerId,
    );

    if (error) {
      logger.error({ error, questionId }, 'Error fetching existing answers');
      return { isValid: false, message: 'Failed to validate answer constraints' };
    }

    // Get question type
    const question = await getQuestionByIdOnly(questionId);
    if (!question) {
      return { isValid: false, message: 'Question not found' };
    }

    // Calculate answer counts after the operation
    const { totalAnswers, totalCorrectAnswers } = calculateAnswerCounts(
      existingAnswers || [],
      answerData,
      excludeAnswerId,
    );

    // Validate question type constraints
    const typeValidation = validateQuestionTypeConstraints(question.question_type, totalAnswers);
    if (!typeValidation.isValid) {
      return typeValidation;
    }

    // Validate correct answer constraint
    const correctAnswerValidation = validateCorrectAnswerConstraint(totalCorrectAnswers);
    if (!correctAnswerValidation.isValid) {
      return correctAnswerValidation;
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
  answerRateLimit,
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

      // Create authenticated client for RLS compliance
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'No valid session token provided',
        } as QuizError);
      }

      const supabase = createAuthenticatedClient(token);

      // Create answer
      const { data: answer, error: answerError } = await supabase
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
  answerRateLimit,
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

      // Create authenticated client for RLS compliance
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'No valid session token provided',
        } as QuizError);
      }

      const supabase = createAuthenticatedClient(token);

      // Update answer
      const { data: answer, error: answerError } = await supabase
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

      // Delete answer with atomic constraint check using a stored procedure
      // This will prevent race conditions by doing the check and delete atomically
      const { data: deleteResult, error } = await supabaseAdmin.rpc(
        'delete_answer_with_constraint_check',
        {
          p_answer_id: answerId,
          p_question_id: questionId,
        },
      );

      if (error) {
        // Check if it's our constraint violation
        if (error.message && error.message.includes('Cannot delete the last answer')) {
          return res.status(400).json({
            error: 'validation_error',
            message: 'Cannot delete the last answer. A question must have at least one answer.',
          } as QuizError);
        }

        logger.error({ error, answerId, questionId, quizId, userId }, 'Error deleting answer');
        return res.status(500).json({
          error: 'delete_failed',
          message: 'Failed to delete answer',
        } as QuizError);
      }

      if (!deleteResult) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Answer not found',
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
