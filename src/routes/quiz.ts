// src/routes/quiz.ts
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

const router = express.Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean up all images related to a quiz before hard deletion
 */
async function cleanupQuizImages(quizId: string): Promise<void> {
  try {
    logger.info({ quizId }, 'Starting image cleanup for quiz');
    const imagePaths: string[] = [];

    // Get quiz thumbnail
    const { data: quizData } = await supabaseAdmin
      .from('quiz_sets')
      .select('thumbnail_url')
      .eq('id', quizId)
      .single();

    if (quizData?.thumbnail_url) {
      const thumbnailPath = extractStoragePathFromUrl(quizData.thumbnail_url);
      if (thumbnailPath) imagePaths.push(thumbnailPath);
    }

    // Get all question images
    const { data: questionsData } = await supabaseAdmin
      .from('questions')
      .select('id, image_url, explanation_image_url')
      .eq('question_set_id', quizId);

    if (questionsData) {
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
    }

    // Get all answer images
    if (questionsData && questionsData.length > 0) {
      const questionIds = questionsData.map((q) => q.id);
      const { data: answersData } = await supabaseAdmin
        .from('answers')
        .select('image_url')
        .in('question_id', questionIds);

      if (answersData) {
        for (const answer of answersData) {
          if (answer.image_url) {
            const answerPath = extractStoragePathFromUrl(answer.image_url);
            if (answerPath) imagePaths.push(answerPath);
          }
        }
      }
    }

    // Delete all collected images from storage
    if (imagePaths.length > 0) {
      const { error: deleteError } = await supabaseAdmin.storage
        .from('quiz-images')
        .remove(imagePaths);

      if (deleteError) {
        logger.error(
          { error: deleteError, quizId, imagePaths },
          'Error deleting quiz images from storage',
        );
      } else {
        logger.info(
          { quizId, deletedCount: imagePaths.length },
          'Successfully deleted quiz images',
        );
      }
    }
  } catch (error) {
    logger.error({ error, quizId }, 'Exception during quiz image cleanup');
    // Don't throw - we want the quiz deletion to proceed even if image cleanup fails
  }
}

/**
 * Extract storage path from Supabase storage URL
 */
function extractStoragePathFromUrl(imageUrl: string): string | null {
  if (!imageUrl) return null;

  // Extract path from Supabase storage URL
  // URL format: https://[project].supabase.co/storage/v1/object/public/quiz-images/[path]
  const match = imageUrl.match(
    /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/quiz-images\/(.+)$/,
  );
  return match ? match[1] : null;
}

async function getQuizById(quizId: string, userId?: string): Promise<QuizSetResponse | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_sets')
      .select('*')
      .eq('id', quizId)
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

async function getCompleteQuizForEdit(
  quizId: string,
  userId: string,
): Promise<(QuizSetResponse & { questions: QuestionWithAnswers[] }) | null> {
  try {
    // First get the quiz data
    const quiz = await getQuizById(quizId, userId);
    if (!quiz || quiz.user_id !== userId) {
      return null;
    }

    // Get questions for this quiz
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
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
      .eq('question_set_id', quizId)
      .order('order_index');

    if (questionsError) {
      logger.error({ error: questionsError, quizId, userId }, 'Error fetching questions for edit');
      return null;
    }

    // Transform the data to match the expected format
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
    logger.error({ error, quizId, userId }, 'Exception in getCompleteQuizForEdit');
    return null;
  }
}

// ============================================================================
// QUIZ CRUD ROUTES
// ============================================================================

// POST /quiz - Create quiz
router.post(
  '/',
  authMiddleware,
  validateRequest(CreateQuizSetSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const quizData = req.body as CreateQuizSetInput;

      // Generate unique quiz code
      const quizCode = await generateQuizCode();

      // Prepare quiz data for insertion
      const insertData = {
        user_id: userId,
        title: quizData.title,
        description: quizData.description,
        thumbnail_url: quizData.thumbnail_url || null,
        is_public: quizData.is_public,
        difficulty_level: quizData.difficulty_level,
        category: quizData.category,
        total_questions: 0, // Will be updated when questions are added
        times_played: 0,
        status: 'draft' as const,
        tags: quizData.tags,
        play_settings: {
          code: quizCode,
          show_question_only: quizData.play_settings?.show_question_only ?? true,
          show_explanation: quizData.play_settings?.show_explanation ?? true,
          time_bonus: quizData.play_settings?.time_bonus ?? false,
          streak_bonus: quizData.play_settings?.streak_bonus ?? false,
          show_correct_answer: quizData.play_settings?.show_correct_answer ?? true,
          max_players: quizData.play_settings?.max_players ?? 100,
        },
      };

      const { data, error } = await supabaseAdmin
        .from('quiz_sets')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error({ error, userId, quizData }, 'Error creating quiz');
        return res.status(500).json({
          error: 'creation_failed',
          message: 'Failed to create quiz',
        } as QuizError);
      }

      logger.info({ quizId: data.id, userId }, 'Quiz created successfully');

      res.status(201).json({
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
      logger.error({ error }, 'Exception in POST /quiz');
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

// GET /quiz/:id - Get quiz
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { include } = req.query;

    const quiz = await getQuizById(id, userId);

    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found',
      } as QuizError);
    }

    // If include=questions,answers, return complete quiz data
    if (include === 'questions,answers') {
      const completeQuiz = await getCompleteQuizForEdit(id, userId);
      if (!completeQuiz) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Quiz not found',
        } as QuizError);
      }
      return res.json(completeQuiz);
    }

    res.json(quiz);
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in GET /quiz/:id');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// PUT /quiz/:id/start-edit - Set quiz to draft status when editing starts
router.put('/:id/start-edit', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify quiz exists and user owns it
    const existingQuiz = await getQuizById(id, userId);
    if (!existingQuiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found',
      } as QuizError);
    }

    if (existingQuiz.user_id !== userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You can only edit your own quizzes',
      } as QuizError);
    }

    // Set quiz status to draft
    const { data, error } = await supabaseAdmin
      .from('quiz_sets')
      .update({
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error({ error, quizId: id, userId }, 'Error setting quiz to draft');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to set quiz to draft',
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, 'Quiz set to draft for editing');

    res.json({
      id: data.id,
      status: data.status,
      updated_at: data.updated_at,
    });
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in PUT /quiz/:id/start-edit');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// PUT /quiz/:id - Update quiz
router.put(
  '/:id',
  authMiddleware,
  validateRequest(UpdateQuizSetSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const updateData = req.body as UpdateQuizSetInput;

      // Verify quiz exists and user owns it
      const existingQuiz = await getQuizById(id, userId);
      if (!existingQuiz) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Quiz not found',
        } as QuizError);
      }

      if (existingQuiz.user_id !== userId) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'You can only update your own quizzes',
        } as QuizError);
      }

      // Prepare update data
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Only update provided fields
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
        .from('quiz_sets')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error({ error, quizId: id, userId, updateData }, 'Error updating quiz');
        return res.status(500).json({
          error: 'update_failed',
          message: 'Failed to update quiz',
        } as QuizError);
      }

      logger.info({ quizId: id, userId }, 'Quiz updated successfully');

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
      logger.error({ error, quizId: req.params.id }, 'Exception in PUT /quiz/:id');
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

// DELETE /quiz/:id - Delete quiz
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify quiz exists and user owns it
    const existingQuiz = await getQuizById(id, userId);
    if (!existingQuiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found',
      } as QuizError);
    }

    if (existingQuiz.user_id !== userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You can only delete your own quizzes',
      } as QuizError);
    }

    // Clean up all images before deleting the quiz
    try {
      await cleanupQuizImages(id);
    } catch (error) {
      logger.error(
        { error, quizId: id },
        'Failed to cleanup images, proceeding with quiz deletion',
      );
      // Continue with deletion even if image cleanup fails
    }

    // Delete quiz (hard delete)
    const { error } = await supabaseAdmin
      .from('quiz_sets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error({ error, quizId: id, userId }, 'Error deleting quiz');
      return res.status(500).json({
        error: 'delete_failed',
        message: 'Failed to delete quiz',
      } as QuizError);
    }

    logger.info({ quizId: id, userId }, 'Quiz and associated images deleted successfully');

    res.status(204).send();
  } catch (error) {
    logger.error({ error, quizId: req.params.id }, 'Exception in DELETE /quiz/:id');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// GET /quiz - List quizzes
router.get(
  '/',
  authMiddleware,
  validateQueryParams(QuizQuerySchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const {
        page = 1,
        limit = 10,
        category,
        difficulty,
        status,
        search,
        is_public,
        sort_by = 'created_at',
        sort_order = 'desc',
      } = req.validatedQuery as QuizQueryParams;

      // Build query step by step
      let query = supabaseAdmin.from('quiz_sets').select('*', { count: 'exact' });

      // Apply base filter
      if (is_public === 'true') {
        query = query.eq('is_public', true);
      } else {
        query = query.eq('user_id', userId);
      }

      // Apply additional filters
      if (category) query = query.eq('category', category);
      if (difficulty) query = query.eq('difficulty_level', difficulty);
      if (status) query = query.eq('status', status);
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply sorting and pagination
      query = query.order(sort_by, { ascending: sort_order === 'asc' });
      const offset = (Number(page) - 1) * Number(limit);
      const { data, error, count } = await query.range(offset, offset + Number(limit) - 1);

      if (error) {
        logger.error({ error, userId, query: req.validatedQuery }, 'Error fetching quizzes');
        return res.status(500).json({
          error: 'fetch_failed',
          message: 'Failed to fetch quizzes',
        } as QuizError);
      }

      const totalPages = Math.ceil((count || 0) / Number(limit));

      const response: PaginatedResponse<QuizSetResponse> = {
        data: (data || []) as QuizSetResponse[],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count || 0,
          total_pages: totalPages,
          has_next: Number(page) < totalPages,
          has_prev: Number(page) > 1,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, 'Exception in GET /quiz');
      res.status(500).json({
        error: 'internal_error',
        message: 'Internal server error',
      } as QuizError);
    }
  },
);

// GET /quiz/:id - Get single quiz by ID
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const quizId = req.params.id;

    // Get the quiz data
    const quiz = await getQuizById(quizId, userId);

    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found',
      } as QuizError);
    }

    // Check if user owns the quiz or if it's public
    if (quiz.user_id !== userId && !quiz.is_public) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Access denied',
      } as QuizError);
    }

    // Get questions for this quiz
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select(
        `
          *,
          answers (*)
        `,
      )
      .eq('question_set_id', quizId)
      .order('order_index');

    if (questionsError) {
      logger.error({ error: questionsError, quizId, userId }, 'Error fetching questions');
      return res.status(500).json({
        error: 'fetch_failed',
        message: 'Failed to fetch questions',
      } as QuizError);
    }

    // Format the response to match QuizSetComplete structure
    const response = {
      ...quiz,
      questions: questions || [],
    };

    res.json(response);
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.id },
      'Exception in GET /quiz/:id',
    );
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// ============================================================================
// QUIZ EDITING ENDPOINTS
// ============================================================================

// GET /quiz/:id/edit - Get quiz data for editing
router.get('/:id/edit', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: quizId } = req.params;
    const userId = req.user!.id;

    // Verify quiz exists and user owns it
    const quiz = await getQuizById(quizId, userId);
    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found or you do not have permission to edit it',
      } as QuizError);
    }

    // Get questions with answers for editing
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select(
        `
        *,
        answers (*)
      `,
      )
      .eq('question_set_id', quizId)
      .order('order_index', { ascending: true });

    if (questionsError) {
      logger.error({ error: questionsError, quizId, userId }, 'Error fetching questions for edit');
      return res.status(500).json({
        error: 'fetch_failed',
        message: 'Failed to fetch questions for editing',
      } as QuizError);
    }

    // Format the response to match QuizSetComplete structure
    const response = {
      ...quiz,
      questions: questions || [],
    };

    logger.info(
      { quizId, userId, questionCount: questions?.length || 0 },
      'Quiz data fetched for editing',
    );
    res.json(response);
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.id },
      'Exception in GET /quiz/:id/edit',
    );
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// PATCH /quiz/:id/draft - Set quiz to draft status for editing
router.patch('/:id/draft', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: quizId } = req.params;
    const userId = req.user!.id;

    // Verify quiz exists and user owns it
    const quiz = await getQuizById(quizId, userId);
    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found or you do not have permission to edit it',
      } as QuizError);
    }

    // Update quiz status to draft
    const { error: updateError } = await supabaseAdmin
      .from('quiz_sets')
      .update({
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quizId)
      .eq('user_id', userId);

    if (updateError) {
      logger.error({ error: updateError, quizId, userId }, 'Error setting quiz to draft');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to set quiz to draft status',
      } as QuizError);
    }

    logger.info({ quizId, userId }, 'Quiz set to draft for editing');
    res.json({
      id: quizId,
      status: 'draft',
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.id },
      'Exception in PATCH /quiz/:id/draft',
    );
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

// PATCH /quiz/:id/publish - Publish edited quiz
router.patch('/:id/publish', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: quizId } = req.params;
    const userId = req.user!.id;

    // Verify quiz exists and user owns it
    const quiz = await getQuizById(quizId, userId);
    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found or you do not have permission to publish it',
      } as QuizError);
    }

    // Check if quiz has questions
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('id')
      .eq('question_set_id', quizId);

    if (questionsError) {
      logger.error({ error: questionsError, quizId, userId }, 'Error checking questions');
      return res.status(500).json({
        error: 'fetch_failed',
        message: 'Failed to check quiz questions',
      } as QuizError);
    }

    if (!questions || questions.length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Quiz must have at least one question to be published',
      } as QuizError);
    }

    // Update quiz status to published
    const { error: updateError } = await supabaseAdmin
      .from('quiz_sets')
      .update({
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quizId)
      .eq('user_id', userId);

    if (updateError) {
      logger.error({ error: updateError, quizId, userId }, 'Error publishing quiz');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to publish quiz',
      } as QuizError);
    }

    logger.info({ quizId, userId, questionCount: questions.length }, 'Quiz published successfully');
    res.json({
      id: quizId,
      status: 'published',
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error, userId: req.user?.id, quizId: req.params.id },
      'Exception in PATCH /quiz/:id/publish',
    );
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as QuizError);
  }
});

export default router;
