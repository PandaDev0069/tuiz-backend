// ====================================================
// File Name   : quiz-library.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-17
// Last Update : 2025-09-17

// Description:
// - Express routes for quiz library operations
// - Handles public quiz browsing, user library management, and quiz cloning
// - Provides endpoints for categories, status counts, and quiz previews

// Notes:
// - Some routes require authentication via authMiddleware
// - Supports filtering, sorting, and pagination
// - Quiz cloning creates a copy with all questions and answers
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';

import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import { QuizSetResponse, PaginatedResponse } from '../types/quiz';
import {
  PublicQuizBrowseSchema,
  MyLibrarySchema,
  PublicQuizBrowseInput,
  MyLibraryInput,
  CloneQuizResponse,
  PublicQuizResponse,
  LibraryError,
} from '../types/quiz-library';
import { logger } from '../utils/logger';
import {
  validateLibraryRequest,
  validateCloneQuizParams,
  sanitizeSearchQuery,
  validatePagination,
  validateSort,
} from '../utils/quizLibraryValidation';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_QUIZ_SETS = 'quiz_sets';
const TABLE_QUESTIONS = 'questions';
const TABLE_ANSWERS = 'answers';
const TABLE_PROFILES = 'profiles';

const COLUMN_ID = 'id';
const COLUMN_USER_ID = 'user_id';
const COLUMN_IS_PUBLIC = 'is_public';
const COLUMN_STATUS = 'status';
const COLUMN_CATEGORY = 'category';
const COLUMN_DIFFICULTY_LEVEL = 'difficulty_level';
const COLUMN_QUESTION_SET_ID = 'question_set_id';
const COLUMN_ORDER_INDEX = 'order_index';
const COLUMN_TITLE = 'title';
const COLUMN_DESCRIPTION = 'description';
const COLUMN_TAGS = 'tags';
const SELECT_ALL = '*';
const SELECT_ID = 'id';
const SELECT_CATEGORY = 'category';
const SELECT_PROFILE_FIELDS = 'id, display_name, username';
const SELECT_QUIZ_FIELDS = 'id, title, user_id, is_public, status';

const STATUS_DRAFT = 'draft';
const STATUS_PUBLISHED = 'published';
const STATUS_ALL = 'all';
const STATUS_DRAFTS = 'drafts';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const DEFAULT_TOTAL_QUESTIONS = 0;
const DEFAULT_TIMES_PLAYED = 0;
const DEFAULT_COUNT = 0;
const DEFAULT_QUESTION_COUNT = 0;
const PAGINATION_FIRST_PAGE = 1;
const QUIZ_CODE_MIN = 100000;
const QUIZ_CODE_MAX = 900000;

const SORT_ORDER_ASC = 'asc';

const CLONE_TITLE_SUFFIX = ' (コピー)';
const UNKNOWN_USER_DISPLAY_NAME = '不明なユーザー';
const CLONE_SUCCESS_MESSAGE = 'クイズがライブラリに追加されました！';

const ERROR_CODES = {
  FETCH_FAILED: 'fetch_failed',
  INTERNAL_ERROR: 'internal_error',
  QUIZ_NOT_FOUND: 'quiz_not_found',
  QUIZ_NOT_CLONEABLE: 'quiz_not_cloneable',
  CANNOT_CLONE_OWN_QUIZ: 'cannot_clone_own_quiz',
  CLONE_FAILED: 'clone_failed',
} as const;

const ERROR_MESSAGES = {
  FAILED_TO_FETCH_PUBLIC_QUIZZES: 'Failed to fetch public quizzes',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  QUIZ_NOT_FOUND_OR_NOT_AVAILABLE: 'Quiz not found or not available for preview',
  FAILED_TO_FETCH_CATEGORIES: 'Failed to fetch categories',
  FAILED_TO_FETCH_STATUS_COUNTS: 'Failed to fetch status counts',
  QUIZ_NOT_FOUND_OR_NOT_AVAILABLE_FOR_CLONING: 'Quiz not found or not available for cloning',
  QUIZ_NOT_AVAILABLE_FOR_CLONING: 'Quiz is not available for cloning',
  CANNOT_CLONE_OWN_QUIZ: 'You cannot clone your own quiz',
  FAILED_TO_CLONE_QUIZ: 'Failed to clone quiz',
  FAILED_TO_FETCH_QUIZ_LIBRARY: 'Failed to fetch quiz library',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_QUIZ_AUTHORS: 'Error fetching quiz authors',
  EXCEPTION_FETCHING_QUIZ_AUTHORS: 'Exception fetching quiz authors',
  STARTING_QUIZ_CLONE_OPERATION: 'Starting quiz clone operation',
  ORIGINAL_QUIZ_NOT_FOUND_OR_NOT_PUBLIC: 'Original quiz not found or not public',
  FAILED_TO_CREATE_CLONED_QUIZ: 'Failed to create cloned quiz',
  FAILED_TO_FETCH_ORIGINAL_QUESTIONS: 'Failed to fetch original questions',
  ORIGINAL_QUIZ_HAS_NO_QUESTIONS: 'Original quiz has no questions',
  FAILED_TO_CLONE_QUESTION: 'Failed to clone question',
  FAILED_TO_CLONE_ANSWERS: 'Failed to clone answers',
  QUIZ_CLONED_SUCCESSFULLY: 'Quiz cloned successfully',
  EXCEPTION_DURING_QUIZ_CLONING: 'Exception during quiz cloning',
  ERROR_FETCHING_PUBLIC_QUIZZES: 'Error fetching public quizzes',
  PUBLIC_QUIZZES_FETCHED_SUCCESSFULLY: 'Public quizzes fetched successfully',
  EXCEPTION_IN_GET_PUBLIC_BROWSE: 'Exception in GET /quiz-library/public/browse',
  ERROR_FETCHING_USER_LIBRARY: 'Error fetching user library',
  USER_LIBRARY_FETCHED_SUCCESSFULLY: 'User library fetched successfully',
  EXCEPTION_IN_GET_MY_LIBRARY: 'Exception in GET /quiz-library/my-library',
  QUIZ_PREVIEW_REQUEST_RECEIVED: 'Quiz preview request received',
  QUIZ_NOT_FOUND_FOR_PREVIEW: 'Quiz not found for preview',
  QUIZ_PREVIEW_FETCHED_SUCCESSFULLY: 'Quiz preview fetched successfully',
  EXCEPTION_IN_GET_PREVIEW: 'Exception in GET /quiz-library/preview/:id',
  CATEGORIES_REQUEST_RECEIVED: 'Categories request received',
  ERROR_FETCHING_CATEGORIES: 'Error fetching categories',
  CATEGORIES_FETCHED_SUCCESSFULLY: 'Categories fetched successfully',
  EXCEPTION_IN_GET_CATEGORIES: 'Exception in GET /quiz-library/categories',
  STATUS_COUNTS_REQUEST_RECEIVED: 'Status counts request received',
  ERROR_FETCHING_STATUS_COUNTS: 'Error fetching status counts',
  STATUS_COUNTS_FETCHED_SUCCESSFULLY: 'Status counts fetched successfully',
  EXCEPTION_IN_GET_STATUS_COUNTS: 'Exception in GET /quiz-library/status-counts',
  QUIZ_CLONE_REQUEST_RECEIVED: 'Quiz clone request received',
  QUIZ_NOT_FOUND_FOR_CLONING: 'Quiz not found for cloning',
  QUIZ_NOT_AVAILABLE_FOR_CLONING: 'Quiz not available for cloning',
  USER_TRYING_TO_CLONE_OWN_QUIZ: 'User trying to clone their own quiz',
  QUIZ_CLONING_FAILED: 'Quiz cloning failed',
  EXCEPTION_IN_POST_CLONE: 'Exception in POST /quiz-library/clone/:id',
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
 * Route: GET /public/browse
 * Description:
 * - Browse public quizzes with filtering, sorting, and pagination
 * - Returns quizzes with author information
 *
 * Parameters:
 * - req.query: Query parameters (validated by PublicQuizBrowseSchema)
 *
 * Returns:
 * - JSON response with paginated public quizzes
 */
router.get(
  '/public/browse',
  validateLibraryRequest(PublicQuizBrowseSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { page, limit, search, category, difficulty, sort, tags } = (
        req as unknown as { validatedQuery: PublicQuizBrowseInput }
      ).validatedQuery;

      const { offset } = validatePagination(page, limit);
      const { field, order } = validateSort(sort);

      let query = supabaseAdmin
        .from(TABLE_QUIZ_SETS)
        .select(SELECT_ALL, { count: 'exact' })
        .eq(COLUMN_IS_PUBLIC, true)
        .eq(COLUMN_STATUS, STATUS_PUBLISHED);

      if (search) {
        const sanitizedSearch = sanitizeSearchQuery(search);
        if (sanitizedSearch) {
          query = query.or(
            `${COLUMN_TITLE}.ilike.%${sanitizedSearch}%,${COLUMN_DESCRIPTION}.ilike.%${sanitizedSearch}%`,
          );
        }
      }

      if (category) {
        query = query.eq(COLUMN_CATEGORY, category);
      }

      if (difficulty) {
        query = query.eq(COLUMN_DIFFICULTY_LEVEL, difficulty);
      }

      if (tags && tags.length > DEFAULT_COUNT) {
        query = query.overlaps(COLUMN_TAGS, tags);
      }

      query = query.order(field, { ascending: order === SORT_ORDER_ASC });
      const { data: quizzes, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        logger.error({ error, query: req.query }, LOG_MESSAGES.ERROR_FETCHING_PUBLIC_QUIZZES);
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.FETCH_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_FETCH_PUBLIC_QUIZZES,
        } as LibraryError);
      }

      const userIds = quizzes?.map((quiz) => quiz.user_id) || [];
      const authorsMap = await getQuizAuthors(userIds);

      const enhancedQuizzes: PublicQuizResponse[] = (quizzes || []).map((quiz) => ({
        ...quiz,
        author: authorsMap.get(quiz.user_id) || {
          id: quiz.user_id,
          display_name: UNKNOWN_USER_DISPLAY_NAME,
        },
      })) as PublicQuizResponse[];

      const totalPages = Math.ceil((count || DEFAULT_COUNT) / limit);

      const response: PaginatedResponse<PublicQuizResponse> = {
        data: enhancedQuizzes,
        pagination: {
          page,
          limit,
          total: count || DEFAULT_COUNT,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > PAGINATION_FIRST_PAGE,
        },
      };

      logger.info(
        {
          count: enhancedQuizzes.length,
          total: count,
          page,
          search: search ? sanitizeSearchQuery(search) : undefined,
        },
        LOG_MESSAGES.PUBLIC_QUIZZES_FETCHED_SUCCESSFULLY,
      );

      res.json(response);
    } catch (error) {
      logger.error({ error }, LOG_MESSAGES.EXCEPTION_IN_GET_PUBLIC_BROWSE);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as LibraryError);
    }
  },
);

/**
 * Route: GET /my-library
 * Description:
 * - Get user's quiz library with enhanced filtering
 * - Supports filtering by status, category, and search
 *
 * Parameters:
 * - req.query: Query parameters (validated by MyLibrarySchema)
 *
 * Returns:
 * - JSON response with paginated user quizzes
 */
router.get(
  '/my-library',
  authMiddleware,
  validateLibraryRequest(MyLibrarySchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { page, limit, status, category, search, sort } = (
        req as unknown as { validatedQuery: MyLibraryInput }
      ).validatedQuery;

      const { offset } = validatePagination(page, limit);
      const { field, order } = validateSort(sort);

      let query = supabaseAdmin
        .from(TABLE_QUIZ_SETS)
        .select(SELECT_ALL, { count: 'exact' })
        .eq(COLUMN_USER_ID, userId);

      if (status && status !== STATUS_ALL) {
        if (status === STATUS_DRAFTS) {
          query = query.eq(COLUMN_STATUS, STATUS_DRAFT);
        } else if (status === STATUS_PUBLISHED) {
          query = query.eq(COLUMN_STATUS, STATUS_PUBLISHED);
        }
      }

      if (category) {
        query = query.eq(COLUMN_CATEGORY, category);
      }

      if (search) {
        const sanitizedSearch = sanitizeSearchQuery(search);
        if (sanitizedSearch) {
          query = query.or(
            `${COLUMN_TITLE}.ilike.%${sanitizedSearch}%,${COLUMN_DESCRIPTION}.ilike.%${sanitizedSearch}%`,
          );
        }
      }

      query = query.order(field, { ascending: order === SORT_ORDER_ASC });
      const { data: quizzes, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        logger.error({ error, userId, query: req.query }, LOG_MESSAGES.ERROR_FETCHING_USER_LIBRARY);
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.FETCH_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_FETCH_QUIZ_LIBRARY,
        } as LibraryError);
      }

      const totalPages = Math.ceil((count || DEFAULT_COUNT) / limit);

      const response: PaginatedResponse<QuizSetResponse> = {
        data: (quizzes || []) as QuizSetResponse[],
        pagination: {
          page,
          limit,
          total: count || DEFAULT_COUNT,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > PAGINATION_FIRST_PAGE,
        },
      };

      logger.info(
        {
          userId,
          count: quizzes?.length || DEFAULT_COUNT,
          total: count,
          status,
          search: search ? sanitizeSearchQuery(search) : undefined,
        },
        LOG_MESSAGES.USER_LIBRARY_FETCHED_SUCCESSFULLY,
      );

      res.json(response);
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.EXCEPTION_IN_GET_MY_LIBRARY);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as LibraryError);
    }
  },
);

/**
 * Route: GET /preview/:id
 * Description:
 * - Get detailed quiz data for preview
 * - Includes questions and answers with author information
 *
 * Parameters:
 * - req.params.id: Quiz identifier
 *
 * Returns:
 * - JSON response with complete quiz data
 */
router.get('/preview/:id', async (req, res) => {
  try {
    const { id: quizId } = req.params;

    logger.info({ quizId }, LOG_MESSAGES.QUIZ_PREVIEW_REQUEST_RECEIVED);

    const { data: quiz, error: quizError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(
        `
        *,
        questions (
          *,
          answers (*)
        )
      `,
      )
      .eq(COLUMN_ID, quizId)
      .eq(COLUMN_IS_PUBLIC, true)
      .eq(COLUMN_STATUS, STATUS_PUBLISHED)
      .single();

    if (quizError || !quiz) {
      logger.warn({ quizId, error: quizError }, LOG_MESSAGES.QUIZ_NOT_FOUND_FOR_PREVIEW);
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.QUIZ_NOT_FOUND,
        message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NOT_AVAILABLE,
      } as LibraryError);
    }

    const authorsMap = await getQuizAuthors([quiz.user_id]);
    const author = authorsMap.get(quiz.user_id) || {
      id: quiz.user_id,
      display_name: UNKNOWN_USER_DISPLAY_NAME,
    };

    if (quiz.questions) {
      quiz.questions.sort(
        (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index,
      );
      quiz.questions.forEach((question: { answers?: { order_index: number }[] }) => {
        if (question.answers) {
          question.answers.sort((a, b) => a.order_index - b.order_index);
        }
      });
    }

    const response = {
      quiz: {
        ...quiz,
        author,
      },
      questions: quiz.questions || [],
    };

    logger.info(
      {
        quizId,
        questionCount: quiz.questions?.length || DEFAULT_COUNT,
      },
      LOG_MESSAGES.QUIZ_PREVIEW_FETCHED_SUCCESSFULLY,
    );

    res.json(response);
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, LOG_MESSAGES.EXCEPTION_IN_GET_PREVIEW);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as LibraryError);
  }
});

/**
 * Route: GET /categories
 * Description:
 * - Get available categories from published public quizzes
 * - Returns unique categories with counts
 *
 * Returns:
 * - JSON response with categories array
 */
router.get('/categories', async (req, res) => {
  try {
    logger.info(LOG_MESSAGES.CATEGORIES_REQUEST_RECEIVED);

    const { data: categories, error } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(SELECT_CATEGORY)
      .eq(COLUMN_IS_PUBLIC, true)
      .eq(COLUMN_STATUS, STATUS_PUBLISHED)
      .not(COLUMN_CATEGORY, 'is', null)
      .not(COLUMN_CATEGORY, 'eq', '')
      .order(COLUMN_CATEGORY);

    if (error) {
      logger.error({ error }, LOG_MESSAGES.ERROR_FETCHING_CATEGORIES);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.FETCH_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_CATEGORIES,
      } as LibraryError);
    }

    const categoryMap = new Map<string, number>();
    categories?.forEach((item) => {
      const category = item.category;
      if (category) {
        categoryMap.set(category, (categoryMap.get(category) || DEFAULT_COUNT) + 1);
      }
    });

    const categoriesWithCounts = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    logger.info(
      {
        categoryCount: categoriesWithCounts.length,
        totalQuizzes: categories?.length || DEFAULT_COUNT,
      },
      LOG_MESSAGES.CATEGORIES_FETCHED_SUCCESSFULLY,
    );

    res.json({
      categories: categoriesWithCounts,
    });
  } catch (error) {
    logger.error({ error }, LOG_MESSAGES.EXCEPTION_IN_GET_CATEGORIES);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as LibraryError);
  }
});

/**
 * Route: GET /status-counts
 * Description:
 * - Get quiz status counts for user's library
 * - Returns counts for all, draft, and published quizzes
 *
 * Returns:
 * - JSON response with status counts
 */
router.get('/status-counts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    logger.info({ userId }, LOG_MESSAGES.STATUS_COUNTS_REQUEST_RECEIVED);

    const [allResult, draftResult, publishedResult] = await Promise.all([
      supabaseAdmin
        .from(TABLE_QUIZ_SETS)
        .select(SELECT_ID, { count: 'exact' })
        .eq(COLUMN_USER_ID, userId),
      supabaseAdmin
        .from(TABLE_QUIZ_SETS)
        .select(SELECT_ID, { count: 'exact' })
        .eq(COLUMN_USER_ID, userId)
        .eq(COLUMN_STATUS, STATUS_DRAFT),
      supabaseAdmin
        .from(TABLE_QUIZ_SETS)
        .select(SELECT_ID, { count: 'exact' })
        .eq(COLUMN_USER_ID, userId)
        .eq(COLUMN_STATUS, STATUS_PUBLISHED),
    ]);

    if (allResult.error) {
      logger.error({ error: allResult.error, userId }, LOG_MESSAGES.ERROR_FETCHING_STATUS_COUNTS);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.FETCH_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_STATUS_COUNTS,
      } as LibraryError);
    }

    const response = {
      all: allResult.count || DEFAULT_COUNT,
      published: publishedResult.count || DEFAULT_COUNT,
      draft: draftResult.count || DEFAULT_COUNT,
    };

    logger.info(
      {
        userId,
        counts: response,
      },
      LOG_MESSAGES.STATUS_COUNTS_FETCHED_SUCCESSFULLY,
    );

    res.json(response);
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.EXCEPTION_IN_GET_STATUS_COUNTS);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    } as LibraryError);
  }
});

/**
 * Route: POST /clone/:id
 * Description:
 * - Clone a public quiz with all associated data
 * - Creates a new quiz owned by the requesting user
 *
 * Parameters:
 * - req.params.id: Quiz identifier to clone
 *
 * Returns:
 * - JSON response with cloned quiz data
 */
router.post(
  '/clone/:id',
  authMiddleware,
  validateCloneQuizParams,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id: quizId } = req.params;
      const userId = req.user!.id;

      logger.info({ quizId, userId }, LOG_MESSAGES.QUIZ_CLONE_REQUEST_RECEIVED);

      const { data: originalQuiz, error: fetchError } = await supabaseAdmin
        .from(TABLE_QUIZ_SETS)
        .select(SELECT_QUIZ_FIELDS)
        .eq(COLUMN_ID, quizId)
        .single();

      if (fetchError || !originalQuiz) {
        logger.warn({ quizId, userId, error: fetchError }, LOG_MESSAGES.QUIZ_NOT_FOUND_FOR_CLONING);
        return res.status(HTTP_STATUS_NOT_FOUND).json({
          error: ERROR_CODES.QUIZ_NOT_FOUND,
          message: ERROR_MESSAGES.QUIZ_NOT_FOUND_OR_NOT_AVAILABLE_FOR_CLONING,
        } as LibraryError);
      }

      if (!originalQuiz.is_public || originalQuiz.status !== STATUS_PUBLISHED) {
        logger.warn(
          { quizId, userId, isPublic: originalQuiz.is_public, status: originalQuiz.status },
          LOG_MESSAGES.QUIZ_NOT_AVAILABLE_FOR_CLONING,
        );
        return res.status(HTTP_STATUS_FORBIDDEN).json({
          error: ERROR_CODES.QUIZ_NOT_CLONEABLE,
          message: ERROR_MESSAGES.QUIZ_NOT_AVAILABLE_FOR_CLONING,
        } as LibraryError);
      }

      if (originalQuiz.user_id === userId) {
        logger.warn({ quizId, userId }, LOG_MESSAGES.USER_TRYING_TO_CLONE_OWN_QUIZ);
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.CANNOT_CLONE_OWN_QUIZ,
          message: ERROR_MESSAGES.CANNOT_CLONE_OWN_QUIZ,
        } as LibraryError);
      }

      const clonedQuiz = await cloneQuizComplete(quizId, userId);

      if (!clonedQuiz) {
        logger.error({ quizId, userId }, LOG_MESSAGES.QUIZ_CLONING_FAILED);
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.CLONE_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_CLONE_QUIZ,
        } as LibraryError);
      }

      const authorsMap = await getQuizAuthors([originalQuiz.user_id]);
      const author = authorsMap.get(originalQuiz.user_id) || {
        id: originalQuiz.user_id,
        display_name: UNKNOWN_USER_DISPLAY_NAME,
        username: undefined,
      };

      const response: CloneQuizResponse = {
        clonedQuiz,
        message: CLONE_SUCCESS_MESSAGE,
        originalQuiz: {
          id: originalQuiz.id,
          title: originalQuiz.title,
          author: author.display_name || author.username || UNKNOWN_USER_DISPLAY_NAME,
        },
      };

      logger.info(
        {
          originalQuizId: quizId,
          clonedQuizId: clonedQuiz.id,
          userId,
        },
        LOG_MESSAGES.QUIZ_CLONED_SUCCESSFULLY,
      );

      res.status(HTTP_STATUS_CREATED).json(response);
    } catch (error) {
      logger.error(
        { error, quizId: req.params.id, userId: req.user?.id },
        LOG_MESSAGES.EXCEPTION_IN_POST_CLONE,
      );
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      } as LibraryError);
    }
  },
);

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: getQuizAuthors
 * Description:
 * - Get author information for public quizzes
 * - Fetches profile data for multiple user IDs
 *
 * Parameters:
 * - userIds (string[]): Array of user identifiers
 *
 * Returns:
 * - Map<string, { id: string; display_name?: string; username?: string }>: Map of user ID to author info
 */
async function getQuizAuthors(
  userIds: string[],
): Promise<Map<string, { id: string; display_name?: string; username?: string }>> {
  const authorMap = new Map();

  try {
    const { data: profiles, error } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .select(SELECT_PROFILE_FIELDS)
      .in(COLUMN_ID, userIds);

    if (error) {
      logger.error({ error, userIds }, LOG_MESSAGES.ERROR_FETCHING_QUIZ_AUTHORS);
      return authorMap;
    }

    profiles?.forEach((profile) => {
      authorMap.set(profile.id, {
        id: profile.id,
        display_name: profile.display_name,
        username: profile.username,
      });
    });

    return authorMap;
  } catch (error) {
    logger.error({ error, userIds }, LOG_MESSAGES.EXCEPTION_FETCHING_QUIZ_AUTHORS);
    return authorMap;
  }
}

/**
 * Function: cloneQuizComplete
 * Description:
 * - Clone quiz with all associated data (questions, answers, images)
 * - Creates a new quiz owned by the specified user
 *
 * Parameters:
 * - originalQuizId (string): Original quiz identifier
 * - newOwnerId (string): New owner user identifier
 *
 * Returns:
 * - QuizSetResponse | null: Cloned quiz data or null if cloning failed
 */
async function cloneQuizComplete(
  originalQuizId: string,
  newOwnerId: string,
): Promise<QuizSetResponse | null> {
  try {
    logger.info({ originalQuizId, newOwnerId }, LOG_MESSAGES.STARTING_QUIZ_CLONE_OPERATION);

    const { data: originalQuiz, error: quizError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .select(SELECT_ALL)
      .eq(COLUMN_ID, originalQuizId)
      .eq(COLUMN_IS_PUBLIC, true)
      .single();

    if (quizError || !originalQuiz) {
      logger.error(
        { error: quizError, originalQuizId },
        LOG_MESSAGES.ORIGINAL_QUIZ_NOT_FOUND_OR_NOT_PUBLIC,
      );
      return null;
    }

    const newQuizData = {
      user_id: newOwnerId,
      title: `${originalQuiz.title}${CLONE_TITLE_SUFFIX}`,
      description: originalQuiz.description,
      thumbnail_url: originalQuiz.thumbnail_url,
      is_public: false,
      difficulty_level: originalQuiz.difficulty_level,
      category: originalQuiz.category,
      total_questions: DEFAULT_TOTAL_QUESTIONS,
      times_played: DEFAULT_TIMES_PLAYED,
      status: STATUS_DRAFT,
      tags: originalQuiz.tags,
      play_settings: {
        ...originalQuiz.play_settings,
        code: Math.floor(Math.random() * QUIZ_CODE_MAX) + QUIZ_CODE_MIN,
      },
      cloned_from: originalQuizId,
    };

    const { data: newQuiz, error: createError } = await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .insert(newQuizData)
      .select()
      .single();

    if (createError || !newQuiz) {
      logger.error({ error: createError, newQuizData }, LOG_MESSAGES.FAILED_TO_CREATE_CLONED_QUIZ);
      return null;
    }

    const { data: originalQuestions, error: questionsError } = await supabaseAdmin
      .from(TABLE_QUESTIONS)
      .select(
        `
        *,
        answers (*)
      `,
      )
      .eq(COLUMN_QUESTION_SET_ID, originalQuizId)
      .order(COLUMN_ORDER_INDEX);

    if (questionsError) {
      logger.error(
        { error: questionsError, originalQuizId },
        LOG_MESSAGES.FAILED_TO_FETCH_ORIGINAL_QUESTIONS,
      );
      await supabaseAdmin.from(TABLE_QUIZ_SETS).delete().eq(COLUMN_ID, newQuiz.id);
      return null;
    }

    if (!originalQuestions || originalQuestions.length === DEFAULT_COUNT) {
      logger.warn({ originalQuizId }, LOG_MESSAGES.ORIGINAL_QUIZ_HAS_NO_QUESTIONS);
      return newQuiz as QuizSetResponse;
    }

    let questionCount = DEFAULT_QUESTION_COUNT;
    for (const originalQuestion of originalQuestions) {
      const newQuestionData = {
        question_set_id: newQuiz.id,
        question_text: originalQuestion.question_text,
        question_type: originalQuestion.question_type,
        image_url: originalQuestion.image_url,
        show_question_time: originalQuestion.show_question_time,
        answering_time: originalQuestion.answering_time,
        points: originalQuestion.points,
        difficulty: originalQuestion.difficulty,
        order_index: originalQuestion.order_index,
        explanation_title: originalQuestion.explanation_title,
        explanation_text: originalQuestion.explanation_text,
        explanation_image_url: originalQuestion.explanation_image_url,
        show_explanation_time: originalQuestion.show_explanation_time,
      };

      const { data: newQuestion, error: questionCreateError } = await supabaseAdmin
        .from(TABLE_QUESTIONS)
        .insert(newQuestionData)
        .select()
        .single();

      if (questionCreateError || !newQuestion) {
        logger.error(
          { error: questionCreateError, originalQuestion: originalQuestion.id },
          LOG_MESSAGES.FAILED_TO_CLONE_QUESTION,
        );
        continue;
      }

      if (originalQuestion.answers && originalQuestion.answers.length > DEFAULT_COUNT) {
        const newAnswersData = originalQuestion.answers.map(
          (answer: {
            answer_text: string;
            image_url?: string;
            is_correct: boolean;
            order_index: number;
          }) => ({
            question_id: newQuestion.id,
            answer_text: answer.answer_text,
            image_url: answer.image_url,
            is_correct: answer.is_correct,
            order_index: answer.order_index,
          }),
        );

        const { error: answersCreateError } = await supabaseAdmin
          .from(TABLE_ANSWERS)
          .insert(newAnswersData);

        if (answersCreateError) {
          logger.error(
            { error: answersCreateError, questionId: newQuestion.id },
            LOG_MESSAGES.FAILED_TO_CLONE_ANSWERS,
          );
        }
      }

      questionCount++;
    }

    await supabaseAdmin
      .from(TABLE_QUIZ_SETS)
      .update({ total_questions: questionCount })
      .eq(COLUMN_ID, newQuiz.id);

    logger.info(
      {
        originalQuizId,
        newQuizId: newQuiz.id,
        newOwnerId,
        questionCount,
      },
      LOG_MESSAGES.QUIZ_CLONED_SUCCESSFULLY,
    );

    return { ...newQuiz, total_questions: questionCount } as QuizSetResponse;
  } catch (error) {
    logger.error({ error, originalQuizId, newOwnerId }, LOG_MESSAGES.EXCEPTION_DURING_QUIZ_CLONING);
    return null;
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
