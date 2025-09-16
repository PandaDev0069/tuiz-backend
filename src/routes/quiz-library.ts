// src/routes/quiz-library.ts
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

const router = express.Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get author information for public quizzes
 */
async function getQuizAuthors(
  userIds: string[],
): Promise<Map<string, { id: string; display_name?: string; username?: string }>> {
  const authorMap = new Map();

  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, username')
      .in('id', userIds);

    if (error) {
      logger.error({ error, userIds }, 'Error fetching quiz authors');
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
    logger.error({ error, userIds }, 'Exception fetching quiz authors');
    return authorMap;
  }
}

/**
 * Clone quiz with all associated data (questions, answers, images)
 */
async function cloneQuizComplete(
  originalQuizId: string,
  newOwnerId: string,
): Promise<QuizSetResponse | null> {
  try {
    logger.info({ originalQuizId, newOwnerId }, 'Starting quiz clone operation');

    // 1. Get original quiz data
    const { data: originalQuiz, error: quizError } = await supabaseAdmin
      .from('quiz_sets')
      .select('*')
      .eq('id', originalQuizId)
      .eq('is_public', true) // Ensure it's public
      .single();

    if (quizError || !originalQuiz) {
      logger.error({ error: quizError, originalQuizId }, 'Original quiz not found or not public');
      return null;
    }

    // 2. Create new quiz (as draft, user becomes owner)
    const newQuizData = {
      user_id: newOwnerId,
      title: `${originalQuiz.title} (コピー)`,
      description: originalQuiz.description,
      thumbnail_url: originalQuiz.thumbnail_url, // We'll clone this later if needed
      is_public: false, // Cloned quizzes start as private drafts
      difficulty_level: originalQuiz.difficulty_level,
      category: originalQuiz.category,
      total_questions: 0, // Will be updated as we clone questions
      times_played: 0, // Reset play count
      status: 'draft' as const,
      tags: originalQuiz.tags,
      play_settings: {
        ...originalQuiz.play_settings,
        code: Math.floor(Math.random() * 900000) + 100000, // Generate new code
      },
      cloned_from: originalQuizId,
    };

    const { data: newQuiz, error: createError } = await supabaseAdmin
      .from('quiz_sets')
      .insert(newQuizData)
      .select()
      .single();

    if (createError || !newQuiz) {
      logger.error({ error: createError, newQuizData }, 'Failed to create cloned quiz');
      return null;
    }

    // 3. Get and clone questions
    const { data: originalQuestions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select(
        `
        *,
        answers (*)
      `,
      )
      .eq('question_set_id', originalQuizId)
      .order('order_index');

    if (questionsError) {
      logger.error({ error: questionsError, originalQuizId }, 'Failed to fetch original questions');
      // Clean up the created quiz
      await supabaseAdmin.from('quiz_sets').delete().eq('id', newQuiz.id);
      return null;
    }

    if (!originalQuestions || originalQuestions.length === 0) {
      logger.warn({ originalQuizId }, 'Original quiz has no questions');
      return newQuiz as QuizSetResponse;
    }

    // 4. Clone each question and its answers
    let questionCount = 0;
    for (const originalQuestion of originalQuestions) {
      // Clone question
      const newQuestionData = {
        question_set_id: newQuiz.id,
        question_text: originalQuestion.question_text,
        question_type: originalQuestion.question_type,
        image_url: originalQuestion.image_url, // TODO: Clone image to user's storage
        show_question_time: originalQuestion.show_question_time,
        answering_time: originalQuestion.answering_time,
        points: originalQuestion.points,
        difficulty: originalQuestion.difficulty,
        order_index: originalQuestion.order_index,
        explanation_title: originalQuestion.explanation_title,
        explanation_text: originalQuestion.explanation_text,
        explanation_image_url: originalQuestion.explanation_image_url, // TODO: Clone image
        show_explanation_time: originalQuestion.show_explanation_time,
      };

      const { data: newQuestion, error: questionCreateError } = await supabaseAdmin
        .from('questions')
        .insert(newQuestionData)
        .select()
        .single();

      if (questionCreateError || !newQuestion) {
        logger.error(
          { error: questionCreateError, originalQuestion: originalQuestion.id },
          'Failed to clone question',
        );
        continue; // Skip this question but continue with others
      }

      // Clone answers for this question
      if (originalQuestion.answers && originalQuestion.answers.length > 0) {
        const newAnswersData = originalQuestion.answers.map(
          (answer: {
            answer_text: string;
            image_url?: string;
            is_correct: boolean;
            order_index: number;
          }) => ({
            question_id: newQuestion.id,
            answer_text: answer.answer_text,
            image_url: answer.image_url, // TODO: Clone image
            is_correct: answer.is_correct,
            order_index: answer.order_index,
          }),
        );

        const { error: answersCreateError } = await supabaseAdmin
          .from('answers')
          .insert(newAnswersData);

        if (answersCreateError) {
          logger.error(
            { error: answersCreateError, questionId: newQuestion.id },
            'Failed to clone answers',
          );
        }
      }

      questionCount++;
    }

    // 5. Update quiz with correct question count
    await supabaseAdmin
      .from('quiz_sets')
      .update({ total_questions: questionCount })
      .eq('id', newQuiz.id);

    logger.info(
      {
        originalQuizId,
        newQuizId: newQuiz.id,
        newOwnerId,
        questionCount,
      },
      'Quiz cloned successfully',
    );

    return { ...newQuiz, total_questions: questionCount } as QuizSetResponse;
  } catch (error) {
    logger.error({ error, originalQuizId, newOwnerId }, 'Exception during quiz cloning');
    return null;
  }
}

// ============================================================================
// PUBLIC QUIZ BROWSING ROUTES
// ============================================================================

// GET /api/quiz-library/public/browse - Browse public quizzes
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

      // Build query
      let query = supabaseAdmin
        .from('quiz_sets')
        .select('*', { count: 'exact' })
        .eq('is_public', true)
        .eq('status', 'published');

      // Apply filters
      if (search) {
        const sanitizedSearch = sanitizeSearchQuery(search);
        if (sanitizedSearch) {
          query = query.or(
            `title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`,
          );
        }
      }

      if (category) {
        query = query.eq('category', category);
      }

      if (difficulty) {
        query = query.eq('difficulty_level', difficulty);
      }

      if (tags && tags.length > 0) {
        // Filter by tags using PostgreSQL array operations
        query = query.overlaps('tags', tags);
      }

      // Apply sorting and pagination
      query = query.order(field, { ascending: order === 'asc' });
      const { data: quizzes, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        logger.error({ error, query: req.query }, 'Error fetching public quizzes');
        return res.status(500).json({
          error: 'fetch_failed',
          message: 'Failed to fetch public quizzes',
        } as LibraryError);
      }

      // Get author information for all quizzes
      const userIds = quizzes?.map((quiz) => quiz.user_id) || [];
      const authorsMap = await getQuizAuthors(userIds);

      // Enhance quizzes with author information
      const enhancedQuizzes: PublicQuizResponse[] = (quizzes || []).map((quiz) => ({
        ...quiz,
        author: authorsMap.get(quiz.user_id) || {
          id: quiz.user_id,
          display_name: '不明なユーザー',
        },
      })) as PublicQuizResponse[];

      const totalPages = Math.ceil((count || 0) / limit);

      const response: PaginatedResponse<PublicQuizResponse> = {
        data: enhancedQuizzes,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      };

      logger.info(
        {
          count: enhancedQuizzes.length,
          total: count,
          page,
          search: search ? sanitizeSearchQuery(search) : undefined,
        },
        'Public quizzes fetched successfully',
      );

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Exception in GET /quiz-library/public/browse');
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as LibraryError);
    }
  },
);

// ============================================================================
// MY LIBRARY ROUTES
// ============================================================================

// GET /api/quiz-library/my-library - Get user's quiz library with enhanced filtering
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

      // Build query for user's quizzes
      let query = supabaseAdmin
        .from('quiz_sets')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply status filter
      if (status && status !== 'all') {
        if (status === 'drafts') {
          query = query.eq('status', 'draft');
        } else if (status === 'published') {
          query = query.eq('status', 'published');
        }
      }

      // Apply other filters
      if (category) {
        query = query.eq('category', category);
      }

      if (search) {
        const sanitizedSearch = sanitizeSearchQuery(search);
        if (sanitizedSearch) {
          query = query.or(
            `title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`,
          );
        }
      }

      // Apply sorting and pagination
      query = query.order(field, { ascending: order === 'asc' });
      const { data: quizzes, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        logger.error({ error, userId, query: req.query }, 'Error fetching user library');
        return res.status(500).json({
          error: 'fetch_failed',
          message: 'Failed to fetch quiz library',
        } as LibraryError);
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response: PaginatedResponse<QuizSetResponse> = {
        data: (quizzes || []) as QuizSetResponse[],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      };

      logger.info(
        {
          userId,
          count: quizzes?.length || 0,
          total: count,
          status,
          search: search ? sanitizeSearchQuery(search) : undefined,
        },
        'User library fetched successfully',
      );

      res.json(response);
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, 'Exception in GET /quiz-library/my-library');
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as LibraryError);
    }
  },
);

// ============================================================================
// QUIZ PREVIEW ROUTES
// ============================================================================

// GET /api/quiz-library/preview/:id - Get detailed quiz data for preview
router.get('/preview/:id', async (req, res) => {
  try {
    const { id: quizId } = req.params;

    logger.info({ quizId }, 'Quiz preview request received');

    // Get quiz data with questions and answers
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz_sets')
      .select(
        `
        *,
        questions (
          *,
          answers (*)
        )
      `,
      )
      .eq('id', quizId)
      .eq('is_public', true)
      .eq('status', 'published')
      .single();

    if (quizError || !quiz) {
      logger.warn({ quizId, error: quizError }, 'Quiz not found for preview');
      return res.status(404).json({
        error: 'quiz_not_found',
        message: 'Quiz not found or not available for preview',
      } as LibraryError);
    }

    // Get author information
    const authorsMap = await getQuizAuthors([quiz.user_id]);
    const author = authorsMap.get(quiz.user_id) || {
      id: quiz.user_id,
      display_name: '不明なユーザー',
    };

    // Sort questions by order_index and answers by order_index
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
        questionCount: quiz.questions?.length || 0,
      },
      'Quiz preview fetched successfully',
    );

    res.json(response);
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in GET /quiz-library/preview/:id');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as LibraryError);
  }
});

// ============================================================================
// CATEGORIES ROUTES
// ============================================================================

// GET /api/quiz-library/categories - Get available categories
router.get('/categories', async (req, res) => {
  try {
    logger.info('Categories request received');

    // Get unique categories from published public quizzes
    const { data: categories, error } = await supabaseAdmin
      .from('quiz_sets')
      .select('category')
      .eq('is_public', true)
      .eq('status', 'published')
      .not('category', 'is', null)
      .not('category', 'eq', '')
      .order('category');

    if (error) {
      logger.error({ error }, 'Error fetching categories');
      return res.status(500).json({
        error: 'fetch_failed',
        message: 'Failed to fetch categories',
      } as LibraryError);
    }

    // Extract unique categories and count occurrences
    const categoryMap = new Map<string, number>();
    categories?.forEach((item) => {
      const category = item.category;
      if (category) {
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      }
    });

    // Convert to array with counts
    const categoriesWithCounts = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    logger.info(
      {
        categoryCount: categoriesWithCounts.length,
        totalQuizzes: categories?.length || 0,
      },
      'Categories fetched successfully',
    );

    res.json({
      categories: categoriesWithCounts,
    });
  } catch (error) {
    logger.error({ error }, 'Exception in GET /quiz-library/categories');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as LibraryError);
  }
});

// ============================================================================
// STATUS COUNTS ROUTES
// ============================================================================

// GET /api/quiz-library/status-counts - Get quiz status counts for user's library
router.get('/status-counts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    logger.info({ userId }, 'Status counts request received');

    // Get counts for each status
    const [allResult, draftResult, publishedResult] = await Promise.all([
      supabaseAdmin.from('quiz_sets').select('id', { count: 'exact' }).eq('user_id', userId),
      supabaseAdmin
        .from('quiz_sets')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'draft'),
      supabaseAdmin
        .from('quiz_sets')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'published'),
    ]);

    if (allResult.error) {
      logger.error({ error: allResult.error, userId }, 'Error fetching status counts');
      return res.status(500).json({
        error: 'fetch_failed',
        message: 'Failed to fetch status counts',
      } as LibraryError);
    }

    const response = {
      all: allResult.count || 0,
      published: publishedResult.count || 0,
      draft: draftResult.count || 0,
    };

    logger.info(
      {
        userId,
        counts: response,
      },
      'Status counts fetched successfully',
    );

    res.json(response);
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Exception in GET /quiz-library/status-counts');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as LibraryError);
  }
});

// ============================================================================
// QUIZ CLONING ROUTES
// ============================================================================

// POST /api/quiz-library/clone/:id - Clone a public quiz
router.post(
  '/clone/:id',
  authMiddleware,
  validateCloneQuizParams,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id: quizId } = req.params;
      const userId = req.user!.id;

      logger.info({ quizId, userId }, 'Quiz clone request received');

      // Verify the quiz exists and is public
      const { data: originalQuiz, error: fetchError } = await supabaseAdmin
        .from('quiz_sets')
        .select('id, title, user_id, is_public, status')
        .eq('id', quizId)
        .single();

      if (fetchError || !originalQuiz) {
        logger.warn({ quizId, userId, error: fetchError }, 'Quiz not found for cloning');
        return res.status(404).json({
          error: 'quiz_not_found',
          message: 'Quiz not found or not available for cloning',
        } as LibraryError);
      }

      if (!originalQuiz.is_public || originalQuiz.status !== 'published') {
        logger.warn(
          { quizId, userId, isPublic: originalQuiz.is_public, status: originalQuiz.status },
          'Quiz not available for cloning',
        );
        return res.status(403).json({
          error: 'quiz_not_cloneable',
          message: 'Quiz is not available for cloning',
        } as LibraryError);
      }

      // Check if user is trying to clone their own quiz
      if (originalQuiz.user_id === userId) {
        logger.warn({ quizId, userId }, 'User trying to clone their own quiz');
        return res.status(400).json({
          error: 'cannot_clone_own_quiz',
          message: 'You cannot clone your own quiz',
        } as LibraryError);
      }

      // Perform the clone operation
      const clonedQuiz = await cloneQuizComplete(quizId, userId);

      if (!clonedQuiz) {
        logger.error({ quizId, userId }, 'Quiz cloning failed');
        return res.status(500).json({
          error: 'clone_failed',
          message: 'Failed to clone quiz',
        } as LibraryError);
      }

      // Get author information for response
      const authorsMap = await getQuizAuthors([originalQuiz.user_id]);
      const author = authorsMap.get(originalQuiz.user_id) || {
        id: originalQuiz.user_id,
        display_name: '不明なユーザー',
        username: undefined,
      };

      const response: CloneQuizResponse = {
        clonedQuiz,
        message: 'クイズがライブラリに追加されました！',
        originalQuiz: {
          id: originalQuiz.id,
          title: originalQuiz.title,
          author: author.display_name || author.username || '不明なユーザー',
        },
      };

      logger.info(
        {
          originalQuizId: quizId,
          clonedQuizId: clonedQuiz.id,
          userId,
        },
        'Quiz cloned successfully',
      );

      res.status(201).json(response);
    } catch (error) {
      logger.error(
        { error, quizId: req.params.id, userId: req.user?.id },
        'Exception in POST /quiz-library/clone/:id',
      );
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as LibraryError);
    }
  },
);

export default router;
