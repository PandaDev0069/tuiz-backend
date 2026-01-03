// ====================================================
// File Name   : quiz.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2025-09-17

// Description:
// - Express routes for quiz CRUD operations
// - Handles quiz creation, updates, deletion, and querying
// - Manages quiz image cleanup and status transitions
// - Supports quiz editing workflow (draft/publish)

// Notes:
// - All routes require authentication via authMiddleware
// - Images are cleaned up before quiz deletion
// - Quiz status can be draft or published
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';

import { supabaseAdmin, generateQuizCode } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateQuizSetSchema,
  UpdateQuizSetSchema,
  QuizQuerySchema,
  QuizQueryParams,
  QuizSetResponse,
  QuizError,
  PaginatedResponse,
  CreateQuizSetInput,
  UpdateQuizSetInput,
} from '../types/quiz';
import { logger } from '../utils/logger';
import { validateRequest, validateQueryParams } from '../utils/quizValidation';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_QUIZ_SETS = 'quiz_sets';
const TABLE_QUESTIONS = 'questions';
const TABLE_ANSWERS = 'answers';
const STORAGE_BUCKET_QUIZ_IMAGES = 'quiz-images';

const COLUMN_ID = 'id';
const COLUMN_USER_ID = 'user_id';
const COLUMN_QUESTION_SET_ID = 'question_set_id';
const COLUMN_QUESTION_ID = 'question_id';
const COLUMN_THUMBNAIL_URL = 'thumbnail_url';
const COLUMN_IMAGE_URL = 'image_url';
const COLUMN_EXPLANATION_IMAGE_URL = 'explanation_image_url';
const COLUMN_ORDER_INDEX = 'order_index';
const COLUMN_IS_PUBLIC = 'is_public';
const COLUMN_CATEGORY = 'category';
const COLUMN_DIFFICULTY_LEVEL = 'difficulty_level';
const COLUMN_STATUS = 'status';
const SELECT_ALL = '*';

const STATUS_DRAFT = 'draft';
const STATUS_PUBLISHED = 'published';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_NO_CONTENT = 204;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const DEFAULT_TOTAL_QUESTIONS = 0;
const DEFAULT_TIMES_PLAYED = 0;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const DEFAULT_MAX_PLAYERS = 100;
const DEFAULT_COUNT = 0;
const MIN_QUESTIONS_FOR_PUBLISH = 1;
const PAGINATION_FIRST_PAGE = 1;

const QUERY_PARAM_INCLUDE = 'include';
const QUERY_VALUE_INCLUDE_QUESTIONS_ANSWERS = 'questions,answers';
const QUERY_VALUE_TRUE = 'true';
const SORT_ORDER_ASC = 'asc';
const DEFAULT_SORT_BY = 'created_at';
const DEFAULT_SORT_ORDER = 'desc';

const STORAGE_URL_REGEX = /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/quiz-images\/(.+)$/;

const ERROR_CODES = {
  CREATION_FAILED: 'creation_failed',
  INTERNAL_ERROR: 'internal_error',
  NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  UPDATE_FAILED: 'update_failed',
  DELETE_FAILED: 'delete_failed',
  FETCH_FAILED: 'fetch_failed',
  VALIDATION_ERROR: 'validation_error',
} as const;

const ERROR_MESSAGES = {
  FAILED_TO_CREATE_QUIZ: 'Failed to create quiz',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  QUIZ_NOT_FOUND: 'Quiz not found',
  CAN_ONLY_EDIT_OWN_QUIZZES: 'You can only edit your own quizzes',
  CAN_ONLY_UPDATE_OWN_QUIZZES: 'You can only update your own quizzes',
  CAN_ONLY_DELETE_OWN_QUIZZES: 'You can only delete your own quizzes',
  FAILED_TO_SET_DRAFT: 'Failed to set quiz to draft',
  FAILED_TO_UPDATE_QUIZ: 'Failed to update quiz',
  FAILED_TO_DELETE_QUIZ: 'Failed to delete quiz',
  FAILED_TO_FETCH_QUIZZES: 'Failed to fetch quizzes',
  ACCESS_DENIED: 'Access denied',
  FAILED_TO_FETCH_QUESTIONS: 'Failed to fetch questions',
  QUIZ_NOT_FOUND_NO_PERMISSION: 'Quiz not found or you do not have permission to edit it',
  FAILED_TO_FETCH_QUESTIONS_FOR_EDIT: 'Failed to fetch questions for editing',
  FAILED_TO_SET_DRAFT_STATUS: 'Failed to set quiz to draft status',
  QUIZ_NOT_FOUND_NO_PERMISSION_PUBLISH:
    'Quiz not found or you do not have permission to publish it',
  FAILED_TO_CHECK_QUESTIONS: 'Failed to check quiz questions',
  QUIZ_MUST_HAVE_QUESTIONS: 'Quiz must have at least one question to be published',
  FAILED_TO_PUBLISH_QUIZ: 'Failed to publish quiz',
} as const;

const LOG_MESSAGES = {
  STARTING_IMAGE_CLEANUP: 'Starting image cleanup for quiz',
  EXCEPTION_DURING_CLEANUP: 'Exception during quiz image cleanup',
  ERROR_DELETING_IMAGES: 'Error deleting quiz images from storage',
  SUCCESSFULLY_DELETED_IMAGES: 'Successfully deleted quiz images',
  ERROR_FETCHING_QUIZ_BY_ID: 'Error fetching quiz by ID',
  EXCEPTION_IN_GET_QUIZ_BY_ID: 'Exception in getQuizById',
  ERROR_FETCHING_QUESTIONS_FOR_EDIT: 'Error fetching questions for edit',
  EXCEPTION_IN_GET_COMPLETE_QUIZ: 'Exception in getCompleteQuizForEdit',
  ERROR_CREATING_QUIZ: 'Error creating quiz',
  QUIZ_CREATED_SUCCESSFULLY: 'Quiz created successfully',
  EXCEPTION_IN_POST_QUIZ: 'Exception in POST /quiz',
  EXCEPTION_IN_GET_QUIZ_ID: 'Exception in GET /quiz/:id',
  ERROR_SETTING_QUIZ_TO_DRAFT: 'Error setting quiz to draft',
  QUIZ_SET_TO_DRAFT: 'Quiz set to draft for editing',
  EXCEPTION_IN_PUT_START_EDIT: 'Exception in PUT /quiz/:id/start-edit',
  ERROR_UPDATING_QUIZ: 'Error updating quiz',
  QUIZ_UPDATED_SUCCESSFULLY: 'Quiz updated successfully',
  EXCEPTION_IN_PUT_QUIZ: 'Exception in PUT /quiz/:id',
  FAILED_TO_CLEANUP_IMAGES: 'Failed to cleanup images, proceeding with quiz deletion',
  ERROR_DELETING_QUIZ: 'Error deleting quiz',
  QUIZ_AND_IMAGES_DELETED: 'Quiz and associated images deleted successfully',
  EXCEPTION_IN_DELETE_QUIZ: 'Exception in DELETE /quiz/:id',
  ERROR_FETCHING_QUIZZES: 'Error fetching quizzes',
  EXCEPTION_IN_GET_QUIZ: 'Exception in GET /quiz',
  ERROR_FETCHING_QUESTIONS: 'Error fetching questions',
  QUIZ_DATA_FETCHED_FOR_EDIT: 'Quiz data fetched for editing',
  EXCEPTION_IN_GET_QUIZ_EDIT: 'Exception in GET /quiz/:id/edit',
  EXCEPTION_IN_PATCH_DRAFT: 'Exception in PATCH /quiz/:id/draft',
  ERROR_CHECKING_QUESTIONS: 'Error checking questions',
  QUIZ_PUBLISHED_SUCCESSFULLY: 'Quiz published successfully',
  EXCEPTION_IN_PATCH_PUBLISH: 'Exception in PATCH /quiz/:id/publish',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
interface QuestionWithAnswers {
  id: string;
  question_text: string;
  question_type: string;
  image_url: string | null;
  show_question_time: boolean;
  answering_time: number;
  points: number;
  difficulty: string;
  order_index: number;
  explanation_title: string | null;
  explanation_text: string | null;
  explanation_image_url: string | null;
  show_explanation_time: boolean;
  answers: {
    id: string;
    answer_text: string;
    image_url: string | null;
    is_correct: boolean;
    order_index: number;
  }[];
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = express.Router();

/**
 * Route: POST /
 * Description:
 * - Create a new quiz
 * - Generates unique quiz code and sets initial status to draft
 *
 * Parameters:
 * - req.body: Quiz data (validated by CreateQuizSetSchema)
 *
 * Returns:
 * - JSON response with created quiz object
 */
router.post(
  '/',
  authMiddleware,
  validateRequest(CreateQuizSetSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const quizData = req.body as CreateQuizSetInput;

      const quizCode = await generateQuizCode();

      const insertData = {
        user_id: userId,
        title: quizData.title,
        description: quizData.description,
        thumbnail_url: quizData.thumbnail_url || null,
        is_public: quizData.is_public,
        difficulty_level: quizData.difficulty_level,
        category: quizData.category,
        total_questions: DEFAULT_TOTAL_QUESTIONS,
        times_played: DEFAULT_TIMES_PLAYED,
        status: STATUS_DRAFT,
        tags: quizData.tags,
        play_settings: {
          code: quizCode,
          show_question_only: quizData.play_settings?.show_question_only ?? true,
          show_explanation: quizData.play_settings?.show_explanation ?? true,
          time_bonus: quizData.play_settings?.time_bonus ?? false,
          streak_bonus: quizData.play_settings?.streak_bonus ?? false,
          show_correct_answer: quizData.play_settings?.show_correct_answer ?? true,
          max_players: quizData.play_settings?.max_players ?? DEFAULT_MAX_PLAYERS,
        },
      };

      const { data, error } = await supabaseAdmin
        .from(TABLE_QUIZ_SETS)
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error({ error, userId, quizData }, LOG_MESSAGES.ERROR_CREATING_QUIZ);
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.CREATION_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_CREATE_QUIZ,
        } as QuizError);
      }

      logger.info({ quizId: data.id, userId }, LOG_MESSAGES.QUIZ_CREATED_SUCCESSFULLY);

      res.status(HTTP_STATUS_CREATED).json({
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        description: data.description,
        thumbnail_url: data.thumbnail_url,
        is_public: data.is_public,
        difficulty_level: data.difficulty_level,
        category: data.category,
        total_questions: data.total_questions,
        times_played: data.times_played,
        created_at: data.created_at,
        updated_at: data.updated_at,
        status: data.status,
        tags: data.tags,
        last_played_at: data.last_played_at,
        play_settings: data.play_settings,
        cloned_from: data.cloned_from,
      } as QuizSetResponse);
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_IN_POST_QUIZ);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as QuizError);
    }
  },
);

/**
 * Route: GET /:id
 * Description:
 * - Get quiz by ID
 * - Optionally includes questions and answers if include=questions,answers
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 * - req.query.include: Optional include parameter
 *
 * Returns:
 * - JSON response with quiz data
 */
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { [QUERY_PARAM_INCLUDE]: include } = req.query;

    const quiz = await getQuizById(id, userId);

    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND,
      } as QuizError);
    }

    if (include === QUERY_VALUE_INCLUDE_QUESTIONS_ANSWERS) {
      const completeQuiz = await getCompleteQuizForEdit(id, userId);
      if (!completeQuiz) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND,
        } as QuizError);
      }
      return res.json(completeQuiz);
    }

    res.json(quiz);
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, LOG_MESSAGES.EXCEPTION_IN_GET_QUIZ_ID);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: PUT /:id/start-edit
 * Description:
 * - Set quiz to draft status when editing starts
 * - Verifies quiz ownership before allowing edit
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with updated quiz status
 */
router.put('/:id/start-edit', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existingQuiz = await getQuizById(id, userId);
    if (!existingQuiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND,
      } as QuizError);
    }

    if (existingQuiz.user_id !== userId) {
      return res.status(HTTP_STATUS_FORBIDDEN).json({
        error: ERROR_CODES.FORBIDDEN,
        message: ERROR_MESSAGES.CAN_ONLY_EDIT_OWN_QUIZZES,
      } as QuizError);
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({
        status: STATUS_DRAFT,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, id)
      .eq(COLUMN_USER_ID, userId)
      .select()
      .single();

    if (error) {
      logger.error({ error, quizId: id, userId }, LOG_MESSAGES.ERROR_SETTING_QUIZ_TO_DRAFT);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UPDATE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_SET_DRAFT,
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, LOG_MESSAGES.QUIZ_SET_TO_DRAFT);

    res.json({
      id: data.id,
      status: data.status,
      updated_at: data.updated_at,
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, LOG_MESSAGES.EXCEPTION_IN_PUT_START_EDIT);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: PUT /:id
 * Description:
 * - Update quiz data
 * - Verifies quiz ownership before allowing update
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 * - req.body: Update data (validated by UpdateQuizSetSchema)
 *
 * Returns:
 * - JSON response with updated quiz object
 */
router.put(
  '/:id',
  authMiddleware,
  validateRequest(UpdateQuizSetSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const updateData = req.body as UpdateQuizSetInput;

      const existingQuiz = await getQuizById(id, userId);
      if (!existingQuiz) {
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND,
        } as QuizError);
      }

      if (existingQuiz.user_id !== userId) {
        return res.status(HTTP_STATUS_FORBIDDEN).json({
          error: ERROR_CODES.FORBIDDEN,
          message: ERROR_MESSAGES.CAN_ONLY_UPDATE_OWN_QUIZZES,
        } as QuizError);
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.title !== undefined) updatePayload.title = updateData.title;
      if (updateData.description !== undefined) updatePayload.description = updateData.description;
      if (updateData.thumbnail_url !== undefined)
        updatePayload.thumbnail_url = updateData.thumbnail_url;
      if (updateData.is_public !== undefined) updatePayload.is_public = updateData.is_public;
      if (updateData.difficulty_level !== undefined)
        updatePayload.difficulty_level = updateData.difficulty_level;
      if (updateData.category !== undefined) updatePayload.category = updateData.category;
      if (updateData.tags !== undefined) updatePayload.tags = updateData.tags;
      if (updateData.status !== undefined) updatePayload.status = updateData.status;
      if (updateData.play_settings !== undefined) {
        updatePayload.play_settings = {
          ...existingQuiz.play_settings,
          ...updateData.play_settings,
        };
      }

      const { data, error } = await supabaseAdmin
        .from(TABLE_QUIZ_SETS)
        .update(updatePayload)
        .eq(COLUMN_ID, id)
        .eq(COLUMN_USER_ID, userId)
        .select()
        .single();

      if (error) {
        logger.error({ error, quizId: id, userId, updateData }, LOG_MESSAGES.ERROR_UPDATING_QUIZ);
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.UPDATE_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_UPDATE_QUIZ,
        } as QuizError);
      }

      logger.info({ quizId: id, userId }, LOG_MESSAGES.QUIZ_UPDATED_SUCCESSFULLY);

      res.json({
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        description: data.description,
        thumbnail_url: data.thumbnail_url,
        is_public: data.is_public,
        difficulty_level: data.difficulty_level,
        category: data.category,
        total_questions: data.total_questions,
        times_played: data.times_played,
        created_at: data.created_at,
        updated_at: data.updated_at,
        status: data.status,
        tags: data.tags,
        last_played_at: data.last_played_at,
        play_settings: data.play_settings,
        cloned_from: data.cloned_from,
      } as QuizSetResponse);
    } catch (error) {
      logger.error({ error, quizId: req.params.id }, LOG_MESSAGES.EXCEPTION_IN_PUT_QUIZ);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as QuizError);
    }
  },
);

/**
 * Route: DELETE /:id
 * Description:
 * - Delete quiz and associated images
 * - Verifies quiz ownership before allowing deletion
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - 204 No Content on success
 */
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existingQuiz = await getQuizById(id, userId);
    if (!existingQuiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND,
      } as QuizError);
    }

    if (existingQuiz.user_id !== userId) {
      return res.status(HTTP_STATUS_FORBIDDEN).json({
        error: ERROR_CODES.FORBIDDEN,
        message: ERROR_MESSAGES.CAN_ONLY_DELETE_OWN_QUIZZES,
      } as QuizError);
    }

    try {
      await cleanupQuizImages(id);
    } catch (error) {
      logger.error({ error, quizId: id }, LOG_MESSAGES.FAILED_TO_CLEANUP_IMAGES);
    }

    const { error } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .delete()
      .eq(COLUMN_ID, id)
      .eq(COLUMN_USER_ID, userId);

    if (error) {
      logger.error({ error, quizId: id, userId }, LOG_MESSAGES.ERROR_DELETING_QUIZ);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.DELETE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_DELETE_QUIZ,
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, LOG_MESSAGES.QUIZ_AND_IMAGES_DELETED);

    res.status(HTTP_STATUS_NO_CONTENT).send();
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, LOG_MESSAGES.EXCEPTION_IN_DELETE_QUIZ);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: GET /
 * Description:
 * - List quizzes with filtering, sorting, and pagination
 * - Supports filtering by category, difficulty, status, and search
 *
 * Parameters:
 * - req.query: Query parameters (validated by QuizQuerySchema)
 *
 * Returns:
 * - JSON response with paginated quiz list
 */
router.get(
  '/',
  authMiddleware,
  validateQueryParams(QuizQuerySchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const {
        page = DEFAULT_PAGE,
        limit = DEFAULT_LIMIT,
        category,
        difficulty,
        status,
        search,
        is_public,
        sort_by = DEFAULT_SORT_BY,
        sort_order = DEFAULT_SORT_ORDER,
      } = req.validatedQuery as QuizQueryParams;

      let query = supabaseAdmin.from(TABLE_QUIZ_SETS).select(SELECT_ALL, { count: 'exact' });

      if (is_public === QUERY_VALUE_TRUE) {
        query = query.eq(COLUMN_IS_PUBLIC, true);
      } else {
        query = query.eq(COLUMN_USER_ID, userId);
      }

      if (category) query = query.eq(COLUMN_CATEGORY, category);
      if (difficulty) query = query.eq(COLUMN_DIFFICULTY_LEVEL, difficulty);
      if (status) query = query.eq(COLUMN_STATUS, status);
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      query = query.order(sort_by, { ascending: sort_order === SORT_ORDER_ASC });
      const offset = (Number(page) - 1) * Number(limit);
      const { data, error, count } = await query.range(offset, offset + Number(limit) - 1);

      if (error) {
        logger.error(
          { error, userId, query: req.validatedQuery },
          LOG_MESSAGES.ERROR_FETCHING_QUIZZES,
        );
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.FETCH_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_FETCH_QUIZZES,
        } as QuizError);
      }

      const totalPages = Math.ceil((count || DEFAULT_COUNT) / Number(limit));

      const response: PaginatedResponse<QuizSetResponse> = {
        data: (data || []) as QuizSetResponse[],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count || DEFAULT_COUNT,
          total_pages: totalPages,
          has_next: Number(page) < totalPages,
          has_prev: Number(page) > PAGINATION_FIRST_PAGE,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.EXCEPTION_IN_GET_QUIZ);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as QuizError);
    }
  },
);

/**
 * Route: GET /:id
 * Description:
 * - Get single quiz by ID with questions and answers
 * - Checks ownership or public access
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with complete quiz data including questions
 */
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const quizId = req.params.id;

    const quiz = await getQuizById(quizId, userId);

    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND,
      } as QuizError);
    }

    if (quiz.user_id !== userId && !quiz.is_public) {
      return res.status(HTTP_STATUS_FORBIDDEN).json({
        error: ERROR_CODES.FORBIDDEN,
        message: ERROR_MESSAGES.ACCESS_DENIED,
      } as QuizError);
    }

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(
        `
          *,
          answers (*)
        `,
      )
      .eq(COLUMN_QUESTION_SET_ID, quizId)
      .order(COLUMN_ORDER_INDEX);

    if (questionsError) {
      logger.error(
        { error: questionsError, quizId, userId },
        LOG_MESSAGES.ERROR_FETCHING_QUESTIONS,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.FETCH_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_QUESTIONS,
      } as QuizError);
    }

    const response = {
      ...quiz,
      questions: questions || [],
    };

    res.json(response);
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.id },
      LOG_MESSAGES.EXCEPTION_IN_GET_QUIZ_ID,
    );
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: GET /:id/edit
 * Description:
 * - Get quiz data for editing
 * - Includes questions and answers for edit view
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with quiz data including questions
 */
router.get('/:id/edit', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: quizId } = req.params;
    const userId = req.user!.id;

    const quiz = await getQuizById(quizId, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_NO_PERMISSION,
      } as QuizError);
    }

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(
        `
        *,
        answers (*)
      `,
      )
      .eq(COLUMN_QUESTION_SET_ID, quizId)
      .order(COLUMN_ORDER_INDEX, { ascending: true });

    if (questionsError) {
      logger.error(
        { error: questionsError, quizId, userId },
        LOG_MESSAGES.ERROR_FETCHING_QUESTIONS_FOR_EDIT,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.FETCH_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_QUESTIONS_FOR_EDIT,
      } as QuizError);
    }

    const response = {
      ...quiz,
      questions: questions || [],
    };

    logger.info(
      { quizId, userId, questionCount: questions?.length || DEFAULT_COUNT },
      LOG_MESSAGES.QUIZ_DATA_FETCHED_FOR_EDIT,
    );
    res.json(response);
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.id },
      LOG_MESSAGES.EXCEPTION_IN_GET_QUIZ_EDIT,
    );
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: PATCH /:id/draft
 * Description:
 * - Set quiz to draft status for editing
 * - Verifies quiz ownership
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with updated quiz status
 */
router.patch('/:id/draft', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: quizId } = req.params;
    const userId = req.user!.id;

    const quiz = await getQuizById(quizId, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_NO_PERMISSION,
      } as QuizError);
    }

    const { error: updateError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({
        status: STATUS_DRAFT,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, quizId)
      .eq(COLUMN_USER_ID, userId);

    if (updateError) {
      logger.error(
        { error: updateError, quizId, userId },
        LOG_MESSAGES.ERROR_SETTING_QUIZ_TO_DRAFT,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UPDATE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_SET_DRAFT_STATUS,
      } as QuizError);
    }

    logger.info({ quizId, userId }, LOG_MESSAGES.QUIZ_SET_TO_DRAFT);
    res.json({
      id: quizId,
      status: STATUS_DRAFT,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.id },
      LOG_MESSAGES.EXCEPTION_IN_PATCH_DRAFT,
    );
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as QuizError);
  }
});

/**
 * Route: PATCH /:id/publish
 * Description:
 * - Publish edited quiz
 * - Validates that quiz has at least one question
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with published quiz status
 */
router.patch('/:id/publish', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: quizId } = req.params;
    const userId = req.user!.id;

    const quiz = await getQuizById(quizId, userId);
    if (!quiz) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_NO_PERMISSION_PUBLISH,
      } as QuizError);
    }

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(COLUMN_ID)
      .eq(COLUMN_QUESTION_SET_ID, quizId);

    if (questionsError) {
      logger.error(
        { error: questionsError, quizId, userId },
        LOG_MESSAGES.ERROR_CHECKING_QUESTIONS,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.FETCH_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_CHECK_QUESTIONS,
      } as QuizError);
    }

    if (!questions || questions.length < MIN_QUESTIONS_FOR_PUBLISH) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.QUIZ_MUST_HAVE_QUESTIONS,
      } as QuizError);
    }

    const { error: updateError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({
        status: STATUS_PUBLISHED,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, quizId)
      .eq(COLUMN_USER_ID, userId);

    if (updateError) {
      logger.error({ error: updateError, quizId, userId }, LOG_MESSAGES.ERROR_UPDATING_QUIZ);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UPDATE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_PUBLISH_QUIZ,
      } as QuizError);
    }

    logger.info(
      { quizId, userId, questionCount: questions.length },
      LOG_MESSAGES.QUIZ_PUBLISHED_SUCCESSFULLY,
    );
    res.json({
      id: quizId,
      status: STATUS_PUBLISHED,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.id },
      LOG_MESSAGES.EXCEPTION_IN_PATCH_PUBLISH,
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
 * Function: cleanupQuizImages
 * Description:
 * - Clean up all images related to a quiz before hard deletion
 * - Collects and deletes all associated images from storage
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - void: No return value
 */
async function cleanupQuizImages(quizId: string): Promise<void> {
  try {
    logger.info({ quizId }, LOG_MESSAGES.STARTING_IMAGE_CLEANUP);

    const imagePaths = await collectAllQuizImagePaths(quizId);
    await deleteImagesFromStorage(quizId, imagePaths);
  } catch (error) {
    logger.error({ error, quizId }, LOG_MESSAGES.EXCEPTION_DURING_CLEANUP);
  }
}

/**
 * Function: collectAllQuizImagePaths
 * Description:
 * - Collect all image paths associated with a quiz
 * - Gathers thumbnail, question, and answer image paths
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - string[]: Array of image paths
 */
async function collectAllQuizImagePaths(quizId: string): Promise<string[]> {
  const imagePaths: string[] = [];

  const thumbnailPath = await getQuizThumbnailPath(quizId);
  if (thumbnailPath) imagePaths.push(thumbnailPath);

  const questionImagePaths = await getQuestionImagePaths(quizId);
  imagePaths.push(...questionImagePaths);

  const answerImagePaths = await getAnswerImagePaths(quizId);
  imagePaths.push(...answerImagePaths);

  return imagePaths;
}

/**
 * Function: getQuizThumbnailPath
 * Description:
 * - Get quiz thumbnail path from database
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - string | null: Thumbnail storage path or null if not found
 */
async function getQuizThumbnailPath(quizId: string): Promise<string | null> {
  const { data: quizData } = await supabaseAdmin
    .from(TABLE_QUIZ_SETS)
    .select(COLUMN_THUMBNAIL_URL)
    .eq(COLUMN_ID, quizId)
    .single();

  if (!quizData?.thumbnail_url) return null;

  return extractStoragePathFromUrl(quizData.thumbnail_url);
}

/**
 * Function: getQuestionImagePaths
 * Description:
 * - Get all question image paths for a quiz
 * - Collects both question images and explanation images
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - string[]: Array of question image paths
 */
async function getQuestionImagePaths(quizId: string): Promise<string[]> {
  const { data: questionsData } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
    .select(`id, ${COLUMN_IMAGE_URL}, ${COLUMN_EXPLANATION_IMAGE_URL}`)
    .eq(COLUMN_QUESTION_SET_ID, quizId);

  if (!questionsData) return [];

  const imagePaths: string[] = [];
  for (const question of questionsData) {
    if (question.image_url) {
      const imagePath = extractStoragePathFromUrl(question.image_url);
      if (imagePath) imagePaths.push(imagePath);
    }
    if (question.explanation_image_url) {
      const explanationPath = extractStoragePathFromUrl(question.explanation_image_url);
      if (explanationPath) imagePaths.push(explanationPath);
    }
  }

  return imagePaths;
}

/**
 * Function: getAnswerImagePaths
 * Description:
 * - Get all answer image paths for a quiz
 * - First gets question IDs, then collects answer images
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 *
 * Returns:
 * - string[]: Array of answer image paths
 */
async function getAnswerImagePaths(quizId: string): Promise<string[]> {
  const { data: questionsData } = await supabaseAdmin
    .from(TABLE_QUESTIONS)
    .select(COLUMN_ID)
    .eq(COLUMN_QUESTION_SET_ID, quizId);

  if (!questionsData || questionsData.length === DEFAULT_COUNT) return [];

  const questionIds = questionsData.map((q) => q.id);
  const { data: answersData } = await supabaseAdmin
    .from(TABLE_ANSWERS)
    .select(COLUMN_IMAGE_URL)
    .in(COLUMN_QUESTION_ID, questionIds);

  if (!answersData) return [];

  const imagePaths: string[] = [];
  for (const answer of answersData) {
    if (answer.image_url) {
      const answerPath = extractStoragePathFromUrl(answer.image_url);
      if (answerPath) imagePaths.push(answerPath);
    }
  }

  return imagePaths;
}

/**
 * Function: deleteImagesFromStorage
 * Description:
 * - Delete images from Supabase storage
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - imagePaths (string[]): Array of image paths to delete
 *
 * Returns:
 * - void: No return value
 */
async function deleteImagesFromStorage(quizId: string, imagePaths: string[]): Promise<void> {
  if (imagePaths.length === DEFAULT_COUNT) return;

  const { error: deleteError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET_QUIZ_IMAGES)
    .remove(imagePaths);

  if (deleteError) {
    logger.error({ error: deleteError, quizId, imagePaths }, LOG_MESSAGES.ERROR_DELETING_IMAGES);
  } else {
    logger.info(
      { quizId, deletedCount: imagePaths.length },
      LOG_MESSAGES.SUCCESSFULLY_DELETED_IMAGES,
    );
  }
}

/**
 * Function: extractStoragePathFromUrl
 * Description:
 * - Extract storage path from Supabase storage URL
 * - Parses URL to get the file path within the storage bucket
 *
 * Parameters:
 * - imageUrl (string): Full Supabase storage URL
 *
 * Returns:
 * - string | null: Storage path or null if URL format is invalid
 */
function extractStoragePathFromUrl(imageUrl: string): string | null {
  if (!imageUrl) return null;

  const match = imageUrl.match(STORAGE_URL_REGEX);
  return match ? match[1] : null;
}

/**
 * Function: getQuizById
 * Description:
 * - Get quiz by ID from database
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - userId (string | undefined): Optional user identifier for logging
 *
 * Returns:
 * - QuizSetResponse | null: Quiz data or null if not found
 */
async function getQuizById(quizId: string, userId?: string): Promise<QuizSetResponse | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(SELECT_ALL)
      .eq(COLUMN_ID, quizId)
      .maybeSingle();

    if (error) {
      logger.error({ error, quizId, userId }, LOG_MESSAGES.ERROR_FETCHING_QUIZ_BY_ID);
      return null;
    }

    return data as QuizSetResponse;
  } catch (error) {
    logger.error({ error, quizId, userId }, LOG_MESSAGES.EXCEPTION_IN_GET_QUIZ_BY_ID);
    return null;
  }
}

/**
 * Function: getCompleteQuizForEdit
 * Description:
 * - Get complete quiz data with questions and answers for editing
 * - Verifies quiz ownership before returning data
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - userId (string): User identifier
 *
 * Returns:
 * - (QuizSetResponse & { questions: QuestionWithAnswers[] }) | null: Complete quiz data or null
 */
async function getCompleteQuizForEdit(
  quizId: string,
  userId: string,
): Promise<(QuizSetResponse & { questions: QuestionWithAnswers[] }) | null> {
  try {
    const quiz = await getQuizById(quizId, userId);
    if (!quiz || quiz.user_id !== userId) {
      return null;
    }

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(
        `
        id,
        question_text,
        question_type,
        image_url,
        show_question_time,
        answering_time,
        points,
        difficulty,
        order_index,
        explanation_title,
        explanation_text,
        explanation_image_url,
        show_explanation_time,
        answers (
          id,
          answer_text,
          image_url,
          is_correct,
          order_index
        )
      `,
      )
      .eq(COLUMN_QUESTION_SET_ID, quizId)
      .order(COLUMN_ORDER_INDEX);

    if (questionsError) {
      logger.error(
        { error: questionsError, quizId, userId },
        LOG_MESSAGES.ERROR_FETCHING_QUESTIONS_FOR_EDIT,
      );
      return null;
    }

    const transformedQuestions = questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      image_url: q.image_url,
      show_question_time: q.show_question_time,
      answering_time: q.answering_time,
      points: q.points,
      difficulty: q.difficulty,
      order_index: q.order_index,
      explanation_title: q.explanation_title,
      explanation_text: q.explanation_text,
      explanation_image_url: q.explanation_image_url,
      show_explanation_time: q.show_explanation_time,
      answers: q.answers.map(
        (a: {
          id: string;
          answer_text: string;
          image_url: string | null;
          is_correct: boolean;
          order_index: number;
        }) => ({
          id: a.id,
          answer_text: a.answer_text,
          image_url: a.image_url,
          is_correct: a.is_correct,
          order_index: a.order_index,
        }),
      ),
    }));

    return {
      ...quiz,
      questions: transformedQuestions,
    };
  } catch (error) {
    logger.error({ error, quizId, userId }, LOG_MESSAGES.EXCEPTION_IN_GET_COMPLETE_QUIZ);
    return null;
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
