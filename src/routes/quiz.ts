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

    const quiz = await getQuizById(id, userId);

    if (!quiz) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Quiz not found',
      } as QuizError);
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

    // Delete quiz (cascade will handle questions and answers)
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

    logger.info({ quizId: id, userId }, 'Quiz deleted successfully');

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
      } = req.query as QuizQueryParams;

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
        logger.error({ error, userId, query: req.query }, 'Error fetching quizzes');
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

export default router;
