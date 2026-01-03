// ====================================================
// File Name   : questions.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2025-09-17

// Description:
// - Express routes for question CRUD operations
// - Handles question creation, updates, deletion, and reordering
// - Supports batch question operations for editing workflows

// Notes:
// - All routes require authentication via authMiddleware
// - Questions are validated based on question type
// - Quiz question count is automatically updated
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
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
  DifficultyLevel,
  QuestionWithAnswers,
  CreateQuestionRequest,
  CreateAnswerRequest,
  Question,
  Answer,
} from '../types/quiz';
import { logger } from '../utils/logger';
import { validateRequest } from '../utils/quizValidation';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_QUIZ_SETS = 'quiz_sets';
const TABLE_QUESTIONS = 'questions';
const TABLE_ANSWERS = 'answers';

const COLUMN_ID = 'id';
const COLUMN_USER_ID = 'user_id';
const COLUMN_QUESTION_SET_ID = 'question_set_id';
const COLUMN_QUESTION_ID = 'question_id';
const COLUMN_TOTAL_QUESTIONS = 'total_questions';
const SELECT_ALL = '*';
const SELECT_QUIZ_FIELDS = 'id, user_id';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_NO_CONTENT = 204;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const TRUE_FALSE_ANSWER_COUNT = 2;
const MULTIPLE_CHOICE_MIN_ANSWERS = 2;
const MULTIPLE_CHOICE_MAX_ANSWERS = 4;
const REQUIRED_CORRECT_ANSWERS = 1;
const DEFAULT_COUNT = 0;
const EMPTY_ARRAY_LENGTH = 0;

const ERROR_CODES = {
  NOT_FOUND: 'not_found',
  VALIDATION_ERROR: 'validation_error',
  CREATION_FAILED: 'creation_failed',
  INTERNAL_ERROR: 'internal_error',
  UPDATE_FAILED: 'update_failed',
  DELETE_FAILED: 'delete_failed',
  REORDER_FAILED: 'reorder_failed',
  INVALID_REQUEST: 'invalid_request',
  CREATE_FAILED: 'create_failed',
} as const;

const ERROR_MESSAGES = {
  QUIZ_NOT_FOUND_OR_NO_PERMISSION: 'Quiz not found or you do not have permission to modify it',
  TRUE_FALSE_MUST_HAVE_TWO_ANSWERS: 'True/False questions must have exactly 2 answers',
  MULTIPLE_CHOICE_ANSWER_RANGE: 'Multiple choice questions must have between 2 and 4 answers',
  MUST_HAVE_EXACTLY_ONE_CORRECT: 'Must have exactly one correct answer',
  FAILED_TO_CREATE_QUESTION: 'Failed to create question',
  FAILED_TO_CREATE_ANSWERS: 'Failed to create answers',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  QUESTION_NOT_FOUND: 'Question not found',
  FAILED_TO_UPDATE_QUESTION: 'Failed to update question',
  FAILED_TO_UPDATE_ANSWERS: 'Failed to update answers',
  FAILED_TO_DELETE_QUESTION: 'Failed to delete question',
  QUESTION_IDS_MUST_BE_NON_EMPTY_ARRAY: 'questionIds must be a non-empty array',
  FAILED_TO_REORDER_QUESTIONS: 'Failed to reorder questions',
  QUESTIONS_MUST_BE_ARRAY: 'Questions must be an array',
  INVALID_QUESTION_DATA_FORMAT: 'Invalid question data format',
  FAILED_TO_DELETE_EXISTING_QUESTIONS: 'Failed to delete existing questions',
  QUESTION_TEXT_AND_TYPE_REQUIRED: 'Question text and type are required',
  FAILED_TO_CREATE_ANSWER: 'Failed to create answer',
} as const;

const SUCCESS_MESSAGES = {
  QUESTIONS_REORDERED_SUCCESSFULLY: 'Questions reordered successfully',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_QUIZ_BY_ID: 'Error fetching quiz by ID',
  EXCEPTION_IN_GET_QUIZ_BY_ID: 'Exception in getQuizById',
  ERROR_FETCHING_QUESTION_BY_ID: 'Error fetching question by ID',
  EXCEPTION_IN_GET_QUESTION_BY_ID: 'Exception in getQuestionById',
  ERROR_COUNTING_QUESTIONS: 'Error counting questions',
  EXCEPTION_IN_UPDATE_QUIZ_QUESTION_COUNT: 'Exception in updateQuizQuestionCount',
  ERROR_CREATING_QUESTION: 'Error creating question',
  ERROR_CREATING_ANSWERS: 'Error creating answers',
  QUESTION_CREATED_SUCCESSFULLY: 'Question created successfully',
  EXCEPTION_IN_POST_QUESTIONS: 'Exception in POST /quiz/:quizId/questions',
  ERROR_DELETING_EXISTING_ANSWERS: 'Error deleting existing answers',
  ERROR_CREATING_NEW_ANSWERS: 'Error creating new answers',
  EXCEPTION_IN_UPDATE_QUESTION_ANSWERS: 'Exception in updateQuestionAnswers',
  ERROR_UPDATING_QUESTION: 'Error updating question',
  QUESTION_UPDATED_SUCCESSFULLY: 'Question updated successfully',
  EXCEPTION_IN_PUT_QUESTION: 'Exception in PUT /quiz/:quizId/questions/:questionId',
  ERROR_DELETING_QUESTION: 'Error deleting question',
  QUESTION_DELETED_SUCCESSFULLY: 'Question deleted successfully',
  EXCEPTION_IN_DELETE_QUESTION: 'Exception in DELETE /quiz/:quizId/questions/:questionId',
  ERROR_REORDERING_QUESTIONS: 'Error reordering questions',
  QUESTIONS_REORDERED_SUCCESSFULLY: 'Questions reordered successfully',
  EXCEPTION_IN_PUT_REORDER: 'Exception in PUT /quiz/:quizId/questions/reorder',
  QUESTIONS_BATCH_SAVED_SUCCESSFULLY: 'Questions batch saved successfully',
  EXCEPTION_IN_POST_BATCH: 'Exception in POST /quiz/:quizId/questions/batch',
  ERROR_DELETING_EXISTING_QUESTIONS: 'Error deleting existing questions',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = express.Router();

/**
 * Route: POST /:quizId/questions
 * Description:
 * - Add a new question to a quiz
 * - Validates question type and answer count
 * - Creates question and associated answers
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.body: Question data (validated by CreateQuestionSchema)
 *
 * Returns:
 * - JSON response with created question object
 */
router.post(
  '/:quizId/questions',
  authMiddleware,
  validateRequest(CreateQuestionSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId } = req.params;
      const userId = req.user!.id;
      const questionData = req.body as CreateQuestionInput;

      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
        } as QuizError);
      }

      if (
        questionData.question_type === QuestionType.TRUE_FALSE &&
        questionData.answers.length !== TRUE_FALSE_ANSWER_COUNT
      ) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.VALIDATION_ERROR,
          message: ERROR_MESSAGES.TRUE_FALSE_MUST_HAVE_TWO_ANSWERS,
        } as QuizError);
      }

      if (
        questionData.question_type === QuestionType.MULTIPLE_CHOICE &&
        (questionData.answers.length < MULTIPLE_CHOICE_MIN_ANSWERS ||
          questionData.answers.length > MULTIPLE_CHOICE_MAX_ANSWERS)
      ) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.VALIDATION_ERROR,
          message: ERROR_MESSAGES.MULTIPLE_CHOICE_ANSWER_RANGE,
        } as QuizError);
      }

      const correctAnswers = questionData.answers.filter((answer) => answer.is_correct);
      if (correctAnswers.length !== REQUIRED_CORRECT_ANSWERS) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.VALIDATION_ERROR,
          message: ERROR_MESSAGES.MUST_HAVE_EXACTLY_ONE_CORRECT,
        } as QuizError);
      }

      const { data: question, error: questionError } = await supabaseAdmin
        .from(TABLE_QUESTIONS)
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
          LOG_MESSAGES.ERROR_CREATING_QUESTION,
        );
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.CREATION_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_CREATE_QUESTION,
        } as QuizError);
      }

      const answersToInsert = questionData.answers.map((answer) => ({
        question_id: question.id,
        answer_text: answer.answer_text,
        image_url: answer.image_url || null,
        is_correct: answer.is_correct,
        order_index: answer.order_index,
      }));

      const { error: answersError } = await supabaseAdmin
        .from(TABLE_ANSWERS)
        .insert(answersToInsert);

      if (answersError) {
        logger.error(
          { error: answersError, questionId: question.id },
          LOG_MESSAGES.ERROR_CREATING_ANSWERS,
        );
        await supabaseAdmin.from(TABLE_QUESTIONS).delete().eq(COLUMN_ID, question.id);
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.CREATION_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_CREATE_ANSWERS,
        } as QuizError);
      }

      await updateQuizQuestionCount(quizId);

      logger.info(
        { questionId: question.id, quizId, userId },
        LOG_MESSAGES.QUESTION_CREATED_SUCCESSFULLY,
      );

      res.status(HTTP_STATUS_CREATED).json({
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
      logger.error({ error, quizId: req.params.quizId }, LOG_MESSAGES.EXCEPTION_IN_POST_QUESTIONS);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as QuizError);
    }
  },
);

/**
 * Route: PUT /:quizId/questions/:questionId
 * Description:
 * - Update an existing question
 * - Optionally updates associated answers
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.params.questionId: Question identifier
 * - req.body: Update data (validated by UpdateQuestionSchema)
 *
 * Returns:
 * - JSON response with updated question object
 */
router.put(
  '/:quizId/questions/:questionId',
  authMiddleware,
  validateRequest(UpdateQuestionSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId, questionId } = req.params;
      const userId = req.user!.id;
      const updateData = req.body as UpdateQuestionInput;

      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
        } as QuizError);
      }

      const existingQuestion = await getQuestionById(questionId, quizId);
      if (!existingQuestion) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUESTION_NOT_FOUND,
        } as QuizError);
      }

      const updatePayload = buildQuestionUpdatePayload(updateData);

      const { data: question, error: questionError } = await supabaseAdmin
        .from(TABLE_QUESTIONS)
        .update(updatePayload)
        .eq(COLUMN_ID, questionId)
        .eq(COLUMN_QUESTION_SET_ID, quizId)
        .select()
        .single();

      if (questionError) {
        logger.error(
          { error: questionError, questionId, quizId, userId, updateData },
          LOG_MESSAGES.ERROR_UPDATING_QUESTION,
        );
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.UPDATE_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_UPDATE_QUESTION,
        } as QuizError);
      }

      if (updateData.answers) {
        const answerUpdateResult = await updateQuestionAnswers(
          questionId,
          updateData.answers,
          updateData.question_type || existingQuestion.question_type,
        );

        if (!answerUpdateResult.success) {
          return res.status(HTTP_STATUS_BAD_REQUEST).json({
            error: ERROR_CODES.VALIDATION_ERROR,
            message: answerUpdateResult.error,
          } as QuizError);
        }
      }

      logger.info({ questionId, quizId, userId }, LOG_MESSAGES.QUESTION_UPDATED_SUCCESSFULLY);

      res.json(buildQuestionResponse(question));
    } catch (error) {
      logger.error(
        { error, questionId: req.params.questionId, quizId: req.params.quizId },
        LOG_MESSAGES.EXCEPTION_IN_PUT_QUESTION,
      );
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as QuizError);
    }
  },
);

/**
 * Route: DELETE /:quizId/questions/:questionId
 * Description:
 * - Delete a question and its associated answers
 * - Updates quiz question count after deletion
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.params.questionId: Question identifier
 *
 * Returns:
 * - 204 No Content on success
 */
router.delete(
  '/:quizId/questions/:questionId',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { quizId, questionId } = req.params;
      const userId = req.user!.id;

      const quiz = await getQuizById(quizId, userId);
      if (!quiz) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
        } as QuizError);
      }

      const existingQuestion = await getQuestionById(questionId, quizId);
      if (!existingQuestion) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUESTION_NOT_FOUND,
        } as QuizError);
      }

      const { error } = await supabaseAdmin
        .from(TABLE_QUESTIONS)
        .delete()
        .eq(COLUMN_ID, questionId)
        .eq(COLUMN_QUESTION_SET_ID, quizId);

      if (error) {
        logger.error({ error, questionId, quizId, userId }, LOG_MESSAGES.ERROR_DELETING_QUESTION);
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.DELETE_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_DELETE_QUESTION,
        } as QuizError);
      }

      await updateQuizQuestionCount(quizId);

      logger.info({ questionId, quizId, userId }, LOG_MESSAGES.QUESTION_DELETED_SUCCESSFULLY);

      res.status(HTTP_STATUS_NO_CONTENT).send();
    } catch (error) {
      logger.error(
        { error, questionId: req.params.questionId, quizId: req.params.quizId },
        LOG_MESSAGES.EXCEPTION_IN_DELETE_QUESTION,
      );
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as QuizError);
    }
  },
);

/**
 * Route: PUT /:quizId/questions/reorder
 * Description:
 * - Reorder questions within a quiz
 * - Updates order_index for each question based on array position
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.body.questionIds: Array of question IDs in desired order
 *
 * Returns:
 * - JSON response with success message
 */
router.put('/:quizId/questions/reorder', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user!.id;
    const { questionIds } = req.body as { questionIds: string[] };

    if (!Array.isArray(questionIds) || questionIds.length === EMPTY_ARRAY_LENGTH) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.QUESTION_IDS_MUST_BE_NON_EMPTY_ARRAY,
      } as QuizError);
    }

    const quiz = await getQuizById(quizId, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
      } as QuizError);
    }

    const updates = questionIds.map((questionId, index) =>
      supabaseAdmin
        .from(TABLE_QUESTIONS)
        .update({
          order_index: index,
          updated_at: new Date().toISOString(),
        })
        .eq(COLUMN_ID, questionId)
        .eq(COLUMN_QUESTION_SET_ID, quizId),
    );

    const results = await Promise.all(updates);

    const errors = results.filter((result) => result.error);
    if (errors.length > EMPTY_ARRAY_LENGTH) {
      logger.error(
        { errors, quizId, userId, questionIds },
        LOG_MESSAGES.ERROR_REORDERING_QUESTIONS,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.REORDER_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_REORDER_QUESTIONS,
      } as QuizError);
    }

    logger.info({ quizId, userId, questionIds }, LOG_MESSAGES.QUESTIONS_REORDERED_SUCCESSFULLY);

    res.json({ message: SUCCESS_MESSAGES.QUESTIONS_REORDERED_SUCCESSFULLY });
  } catch (error) {
    logger.error({ error, quizId: req.params.quizId }, LOG_MESSAGES.EXCEPTION_IN_PUT_REORDER);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: POST /:quizId/questions/batch
 * Description:
 * - Batch save questions for editing workflow
 * - Deletes existing questions and creates new ones
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.body.questions: Array of question data to save
 *
 * Returns:
 * - JSON response with saved questions array
 */
router.post('/:quizId/questions/batch', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user!.id;
    const { questions } = req.body;

    const validationError = await validateBatchQuestionsRequest(quizId, userId, questions);
    if (validationError) {
      return res.status(validationError.status).json(validationError.response);
    }

    const deleteError = await deleteExistingQuestions(quizId, userId);
    if (deleteError) {
      return res.status(deleteError.status).json(deleteError.response);
    }

    const savedQuestions = await createQuestionsWithAnswers(
      quizId,
      questions as CreateQuestionRequest[],
      userId,
    );
    if ('error' in savedQuestions) {
      return res.status(savedQuestions.error.status).json(savedQuestions.error.response);
    }

    await updateQuizQuestionCount(quizId);

    logger.info(
      { quizId, userId, questionCount: savedQuestions.data.length },
      LOG_MESSAGES.QUESTIONS_BATCH_SAVED_SUCCESSFULLY,
    );

    res.json(savedQuestions.data);
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.quizId },
      LOG_MESSAGES.EXCEPTION_IN_POST_BATCH,
    );
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: getQuizById
 * Description:
 * - Get quiz by ID and verify user ownership
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - userId (string): User identifier
 *
 * Returns:
 * - object | null: Quiz data with id and user_id, or null if not found
 */
async function getQuizById(
  quizId: string,
  userId: string,
): Promise<{ id: string; user_id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(SELECT_QUIZ_FIELDS)
      .eq(COLUMN_ID, quizId)
      .eq(COLUMN_USER_ID, userId)
      .maybeSingle();

    if (error) {
      logger.error({ error, quizId, userId }, LOG_MESSAGES.ERROR_FETCHING_QUIZ_BY_ID);
      return null;
    }

    return data;
  } catch (error) {
    logger.error({ error, quizId, userId }, LOG_MESSAGES.EXCEPTION_IN_GET_QUIZ_BY_ID);
    return null;
  }
}

/**
 * Function: getQuestionById
 * Description:
 * - Get question by ID and verify it belongs to the quiz
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - QuestionResponse | null: Question data or null if not found
 */
async function getQuestionById(
  questionId: string,
  quizId: string,
): Promise<QuestionResponse | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(SELECT_ALL)
      .eq(COLUMN_ID, questionId)
      .eq(COLUMN_QUESTION_SET_ID, quizId)
      .maybeSingle();

    if (error) {
      logger.error({ error, questionId, quizId }, LOG_MESSAGES.ERROR_FETCHING_QUESTION_BY_ID);
      return null;
    }

    return data as QuestionResponse;
  } catch (error) {
    logger.error({ error, questionId, quizId }, LOG_MESSAGES.EXCEPTION_IN_GET_QUESTION_BY_ID);
    return null;
  }
}

/**
 * Function: updateQuizQuestionCount
 * Description:
 * - Update the total_questions count for a quiz
 * - Counts all questions associated with the quiz
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - void: No return value
 */
async function updateQuizQuestionCount(quizId: string): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(SELECT_ALL, { count: 'exact', head: true })
      .eq(COLUMN_QUESTION_SET_ID, quizId);

    if (error) {
      logger.error({ error, quizId }, LOG_MESSAGES.ERROR_COUNTING_QUESTIONS);
      return;
    }

    await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({
        [COLUMN_TOTAL_QUESTIONS]: count || DEFAULT_COUNT,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, quizId);
  } catch (error) {
    logger.error({ error, quizId }, LOG_MESSAGES.EXCEPTION_IN_UPDATE_QUIZ_QUESTION_COUNT);
  }
}

/**
 * Function: validateAnswerUpdate
 * Description:
 * - Validate answer count and correctness based on question type
 *
 * Parameters:
 * - answers (Array<{ is_correct: boolean }>): Array of answers to validate
 * - questionType (QuestionType): Type of question
 *
 * Returns:
 * - object: Validation result with isValid flag and optional error message
 */
function validateAnswerUpdate(
  answers: Array<{ is_correct: boolean }>,
  questionType: QuestionType,
): {
  isValid: boolean;
  error?: string;
} {
  if (questionType === QuestionType.TRUE_FALSE && answers.length !== TRUE_FALSE_ANSWER_COUNT) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.TRUE_FALSE_MUST_HAVE_TWO_ANSWERS,
    };
  }

  if (
    questionType === QuestionType.MULTIPLE_CHOICE &&
    (answers.length < MULTIPLE_CHOICE_MIN_ANSWERS || answers.length > MULTIPLE_CHOICE_MAX_ANSWERS)
  ) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.MULTIPLE_CHOICE_ANSWER_RANGE,
    };
  }

  const correctAnswers = answers.filter((answer) => answer.is_correct);
  if (correctAnswers.length !== REQUIRED_CORRECT_ANSWERS) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.MUST_HAVE_EXACTLY_ONE_CORRECT,
    };
  }

  return { isValid: true };
}

/**
 * Function: buildQuestionUpdatePayload
 * Description:
 * - Build update payload from partial question data
 * - Only includes fields that are provided
 *
 * Parameters:
 * - updateData (UpdateQuestionInput): Partial question update data
 *
 * Returns:
 * - Record<string, unknown>: Update payload object
 */
function buildQuestionUpdatePayload(updateData: UpdateQuestionInput): Record<string, unknown> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

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

  return updatePayload;
}

/**
 * Function: updateQuestionAnswers
 * Description:
 * - Update answers for a question
 * - Deletes existing answers and inserts new ones
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - answers (Array): Array of answer data
 * - questionType (QuestionType): Type of question for validation
 *
 * Returns:
 * - object: Result with success flag and optional error message
 */
async function updateQuestionAnswers(
  questionId: string,
  answers: Array<{
    answer_text: string;
    image_url?: string | null;
    is_correct: boolean;
    order_index: number;
  }>,
  questionType: QuestionType,
): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = validateAnswerUpdate(answers, questionType);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const { error: deleteError } = await supabaseAdmin
      .from(TABLE_ANSWERS)
      .delete()
      .eq(COLUMN_QUESTION_ID, questionId);

    if (deleteError) {
      logger.error(
        { error: deleteError, questionId },
        LOG_MESSAGES.ERROR_DELETING_EXISTING_ANSWERS,
      );
      return { success: false, error: ERROR_MESSAGES.FAILED_TO_UPDATE_ANSWERS };
    }

    const answersToInsert = answers.map((answer) => ({
      question_id: questionId,
      answer_text: answer.answer_text,
      image_url: answer.image_url || null,
      is_correct: answer.is_correct,
      order_index: answer.order_index,
    }));

    const { error: answersError } = await supabaseAdmin.from(TABLE_ANSWERS).insert(answersToInsert);

    if (answersError) {
      logger.error({ error: answersError, questionId }, LOG_MESSAGES.ERROR_CREATING_NEW_ANSWERS);
      return { success: false, error: ERROR_MESSAGES.FAILED_TO_UPDATE_ANSWERS };
    }

    return { success: true };
  } catch (error) {
    logger.error({ error, questionId }, LOG_MESSAGES.EXCEPTION_IN_UPDATE_QUESTION_ANSWERS);
    return { success: false, error: ERROR_MESSAGES.FAILED_TO_UPDATE_ANSWERS };
  }
}

/**
 * Function: buildQuestionResponse
 * Description:
 * - Build QuestionResponse object from database record
 *
 * Parameters:
 * - question (Record<string, unknown>): Question data from database
 *
 * Returns:
 * - QuestionResponse: Formatted question response object
 */
function buildQuestionResponse(question: Record<string, unknown>): QuestionResponse {
  return {
    id: question.id as string,
    question_set_id: question.question_set_id as string,
    question_text: question.question_text as string,
    question_type: question.question_type as QuestionType,
    image_url: question.image_url as string | undefined,
    show_question_time: question.show_question_time as number,
    answering_time: question.answering_time as number,
    points: question.points as number,
    difficulty: question.difficulty as DifficultyLevel,
    order_index: question.order_index as number,
    created_at: question.created_at as string,
    updated_at: question.updated_at as string,
    explanation_title: question.explanation_title as string | undefined,
    explanation_text: question.explanation_text as string | undefined,
    explanation_image_url: question.explanation_image_url as string | undefined,
    show_explanation_time: question.show_explanation_time as number,
  };
}

/**
 * Function: validateBatchQuestionsRequest
 * Description:
 * - Validate batch questions request
 * - Verifies quiz ownership and request format
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - userId (string): User identifier
 * - questions (unknown): Questions data to validate
 *
 * Returns:
 * - object | null: Error response object or null if valid
 */
async function validateBatchQuestionsRequest(
  quizId: string,
  userId: string,
  questions: unknown,
): Promise<{ status: number; response: QuizError } | null> {
  const quiz = await getQuizById(quizId, userId);
  if (!quiz) {
    return {
      status: HTTP_STATUS_NOT_FOUND,
      response: {
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NO_PERMISSION,
      } as QuizError,
    };
  }

  if (!Array.isArray(questions)) {
    return {
      status: HTTP_STATUS_BAD_REQUEST,
      response: {
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.QUESTIONS_MUST_BE_ARRAY,
      } as QuizError,
    };
  }

  if (
    !questions.every(
      (q) => typeof q === 'object' && q !== null && 'question_text' in q && 'question_type' in q,
    )
  ) {
    return {
      status: HTTP_STATUS_BAD_REQUEST,
      response: {
        error: ERROR_CODES.INVALID_REQUEST,
        message: ERROR_MESSAGES.INVALID_QUESTION_DATA_FORMAT,
      } as QuizError,
    };
  }

  return null;
}

/**
 * Function: deleteExistingQuestions
 * Description:
 * - Delete all existing questions for a quiz
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - userId (string): User identifier for logging
 *
 * Returns:
 * - object | null: Error response object or null if successful
 */
async function deleteExistingQuestions(
  quizId: string,
  userId: string,
): Promise<{ status: number; response: QuizError } | null> {
  const { error: deleteError } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
    .delete()
    .eq(COLUMN_QUESTION_SET_ID, quizId);

  if (deleteError) {
    logger.error(
      { error: deleteError, quizId, userId },
      LOG_MESSAGES.ERROR_DELETING_EXISTING_QUESTIONS,
    );
    return {
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      response: {
        error: ERROR_CODES.DELETE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_DELETE_EXISTING_QUESTIONS,
      } as QuizError,
    };
  }

  return null;
}

/**
 * Function: createQuestionsWithAnswers
 * Description:
 * - Create multiple questions with their answers
 * - Processes questions sequentially
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - questions (CreateQuestionRequest[]): Array of question data
 * - userId (string): User identifier for logging
 *
 * Returns:
 * - object: Success result with data array or error result
 */
async function createQuestionsWithAnswers(
  quizId: string,
  questions: CreateQuestionRequest[],
  userId: string,
): Promise<{ data: QuestionWithAnswers[] } | { error: { status: number; response: QuizError } }> {
  const savedQuestions: QuestionWithAnswers[] = [];

  for (const questionData of questions) {
    if (!questionData.question_text || !questionData.question_type) {
      return {
        error: {
          status: HTTP_STATUS_BAD_REQUEST,
          response: {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: ERROR_MESSAGES.QUESTION_TEXT_AND_TYPE_REQUIRED,
          } as QuizError,
        },
      };
    }

    const questionResult = await createQuestion(quizId, questionData, userId);
    if ('error' in questionResult) {
      return { error: questionResult.error };
    }

    const answersResult = await createAnswersForQuestion(
      questionResult.data.id,
      questionData.answers || [],
    );
    if ('error' in answersResult) {
      return { error: answersResult.error };
    }

    savedQuestions.push({
      ...questionResult.data,
      answers: answersResult.data,
    });
  }

  return { data: savedQuestions };
}

/**
 * Function: createQuestion
 * Description:
 * - Create a single question in the database
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - questionData (CreateQuestionRequest): Question data
 * - userId (string): User identifier for logging
 *
 * Returns:
 * - object: Success result with question data or error result
 */
async function createQuestion(
  quizId: string,
  questionData: CreateQuestionRequest,
  userId: string,
): Promise<{ data: Question } | { error: { status: number; response: QuizError } }> {
  const { data: question, error: questionError } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
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
    logger.error({ error: questionError, quizId, userId }, LOG_MESSAGES.ERROR_CREATING_QUESTION);
    return {
      error: {
        status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
        response: {
          error: ERROR_CODES.CREATE_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_CREATE_QUESTION,
        } as QuizError,
      },
    };
  }

  return { data: question };
}

/**
 * Function: createAnswersForQuestion
 * Description:
 * - Create answers for a question
 * - Processes answers sequentially
 *
 * Parameters:
 * - questionId (string): Question identifier
 * - answersData (CreateAnswerRequest[]): Array of answer data
 *
 * Returns:
 * - object: Success result with answers array or error result
 */
async function createAnswersForQuestion(
  questionId: string,
  answersData: CreateAnswerRequest[],
): Promise<{ data: Answer[] } | { error: { status: number; response: QuizError } }> {
  const answers = [];

  for (const answerData of answersData) {
    const { data: answer, error: answerError } = await supabaseAdmin
      .from(TABLE_ANSWERS)
      .insert({
        question_id: questionId,
        answer_text: answerData.answer_text,
        image_url: answerData.image_url ?? null,
        is_correct: answerData.is_correct,
        order_index: answerData.order_index,
      })
      .select()
      .single();

    if (answerError) {
      logger.error({ error: answerError, questionId }, LOG_MESSAGES.ERROR_CREATING_ANSWERS);
      return {
        error: {
          status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
          response: {
            error: ERROR_CODES.CREATE_FAILED,
            message: ERROR_MESSAGES.FAILED_TO_CREATE_ANSWER,
          } as QuizError,
        },
      };
    }

    answers.push(answer);
  }

  return { data: answers };
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
