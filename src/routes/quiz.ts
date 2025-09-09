// src/routes/quiz.ts
import express, { Request } from 'express';
import { logger } from '../utils/logger';

// Extend Express Request type to include user

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email?: string;
    };
  }
}

const router = express.Router();

// GET /quiz - List all quizzes for a user
router.get('/', async (req, res) => {
  try {
    // Get user ID from authentication (we'll add this later)
    const userId = req.user?.id || 'test-user-123'; // Temporary for testing

    // if (!userId) {
    //   return res.status(401).json({
    //     error: 'unauthorized',
    //     message: 'User not authenticated',
    //   });
    // }

    // Mock data for demonstration (replace with actual database query)
    const mockQuizzes = [
      {
        id: '1',
        title: 'Sample Quiz 1',
        description: 'This is a sample quiz for testing',
        difficulty_level: 'easy',
        category: 'Programming',
        status: 'draft',
        created_at: new Date().toISOString(),
        user_id: userId,
      },
      {
        id: '2',
        title: 'Sample Quiz 2',
        description: 'Another sample quiz',
        difficulty_level: 'medium',
        category: 'Science',
        status: 'published',
        created_at: new Date().toISOString(),
        user_id: userId,
      },
    ];

    // Send success response
    res.status(200).json({
      quizzes: mockQuizzes,
      total: mockQuizzes.length,
    });
  } catch (error) {
    logger.error({ error }, 'Unexpected error in GET /quiz');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    });
  }
});

// POST /quiz - Create a new quiz
router.post('/', async (req, res) => {
  try {
    // Add authentication check (copy from GET route)
    const userId = req.user?.id || 'test-user-123'; // Temporary for testing

    // if (!userId) {
    //   return res.status(401).json({
    //     error: 'unauthorized',
    //     message: 'User not authenticated',
    //   });
    // }

    // Get quiz data from request body
    const { title, description, difficulty_level, category, is_public, tags, play_settings } =
      req.body;

    // Validate required fields
    if (!title || !description || !difficulty_level || !category) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Missing required fields',
      });
    }

    // Mock quiz creation (replace with actual database insert)
    const mockQuiz = {
      id: Date.now().toString(),
      user_id: userId,
      title,
      description,
      difficulty_level,
      category,
      is_public: is_public || false,
      tags: tags || [],
      play_settings: play_settings || {
        code: 0,
        show_question_only: true,
        show_explanation: true,
        time_bonus: false,
        streak_bonus: false,
        show_correct_answer: true,
        max_players: 400,
      },
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Send success response
    res.status(201).json({
      quiz: mockQuiz,
      message: 'Quiz created successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Unexpected error in POST /quiz');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    });
  }
});

export default router;
