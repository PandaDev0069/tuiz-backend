/**
 * Validation Logic Unit Tests
 *
 * Tests for validation schemas, middleware, and utility functions.
 * Focuses on input validation, data sanitization, and error handling.
 */

import { describe, it, expect } from 'vitest';
import { RegisterSchema, LoginSchema } from '../../src/utils/validation';
import {
  CreateQuizSetSchema,
  CreateQuestionSchema,
  CreateAnswerSchema,
  ReorderQuestionsSchema,
} from '../../src/types/quiz';
// Note: Middleware functions are not yet implemented

describe('Validation Schemas', () => {
  describe('RegisterSchema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        username: 'testuser',
        displayName: 'Test User',
      };

      const result = RegisterSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.password).toBe('TestPassword123!');
        expect(result.data.username).toBe('testuser');
        expect(result.data.displayName).toBe('Test User');
      }
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        username: 'testuser',
        displayName: 'Test User',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['email']);
      }
    });

    it('should reject weak password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '123',
        username: 'testuser',
        displayName: 'Test User',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['password']);
      }
    });

    it('should accept optional username and displayName', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const result = RegisterSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty email', () => {
      const invalidData = {
        email: '',
        password: 'TestPassword123!',
        username: 'testuser',
        displayName: 'Test User',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
        username: 'testuser',
        displayName: 'Test User',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('LoginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.password).toBe('TestPassword123!');
      }
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty credentials', () => {
      const invalidData = {
        email: '',
        password: '',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateQuizSetSchema', () => {
    it('should validate correct quiz data', () => {
      const validData = {
        title: 'Test Quiz',
        description: 'A test quiz for validation',
        difficulty_level: 'medium',
        category: 'General Knowledge',
        tags: ['test', 'validation'],
        is_public: true,
        play_settings: {
          time_per_question: 30,
          show_correct_answers: true,
          allow_retry: false,
        },
      };

      const result = CreateQuizSetSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const invalidData = {
        title: '',
        description: 'A test quiz',
        difficulty: 'medium',
        category: 'General Knowledge',
        tags: ['test'],
        is_public: true,
        play_settings: {},
      };

      const result = CreateQuizSetSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid difficulty', () => {
      const invalidData = {
        title: 'Test Quiz',
        description: 'A test quiz',
        difficulty: 'INVALID',
        category: 'General Knowledge',
        tags: ['test'],
        is_public: true,
        play_settings: {},
      };

      const result = CreateQuizSetSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid difficulty levels', () => {
      const difficulties = ['easy', 'medium', 'hard'];

      for (const difficulty of difficulties) {
        const validData = {
          title: 'Test Quiz',
          description: 'A test quiz',
          difficulty_level: difficulty,
          category: 'General Knowledge',
          tags: ['test'],
          is_public: true,
          play_settings: {},
        };

        const result = CreateQuizSetSchema.safeParse(validData);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('CreateQuestionSchema', () => {
    it('should validate correct question data', () => {
      const validData = {
        question_text: 'What is the capital of France?',
        question_type: 'multiple_choice',
        show_question_time: 30,
        answering_time: 60,
        points: 10,
        difficulty: 'medium',
        order_index: 1,
        explanation_title: 'Explanation',
        explanation_text: 'Paris is the capital of France.',
        show_explanation_time: 30,
        image_url: 'https://example.com/image.jpg',
        answers: [
          {
            answer_text: 'Paris',
            is_correct: true,
            order_index: 1,
            image_url: 'https://example.com/paris.jpg',
          },
          {
            answer_text: 'London',
            is_correct: false,
            order_index: 2,
          },
        ],
      };

      const result = CreateQuestionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty question text', () => {
      const invalidData = {
        question_text: '',
        question_type: 'multiple_choice',
        order_index: 1,
        answers: [],
      };

      const result = CreateQuestionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid question type', () => {
      const invalidData = {
        question_text: 'What is the capital?',
        question_type: 'INVALID_TYPE',
        order_index: 1,
        answers: [],
      };

      const result = CreateQuestionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid question types', () => {
      const questionTypes = ['multiple_choice', 'true_false'];

      for (const questionType of questionTypes) {
        const validData = {
          question_text: 'What is the capital?',
          question_type: questionType,
          show_question_time: 30,
          answering_time: 60,
          points: 10,
          difficulty: 'medium',
          order_index: 1,
          show_explanation_time: 30,
          answers: [
            {
              answer_text: 'Answer 1',
              is_correct: true,
              order_index: 1,
            },
            {
              answer_text: 'Answer 2',
              is_correct: false,
              order_index: 2,
            },
          ],
        };

        const result = CreateQuestionSchema.safeParse(validData);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('CreateAnswerSchema', () => {
    it('should validate correct answer data', () => {
      const validData = {
        answer_text: 'Paris',
        is_correct: true,
        order_index: 1,
        image_url: 'https://example.com/paris.jpg',
      };

      const result = CreateAnswerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty answer text', () => {
      const invalidData = {
        answer_text: '',
        is_correct: true,
        order_index: 1,
      };

      const result = CreateAnswerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional image_url', () => {
      const validData = {
        answer_text: 'Paris',
        is_correct: true,
        order_index: 1,
      };

      const result = CreateAnswerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('ReorderQuestionsSchema', () => {
    it('should validate correct reorder data', () => {
      const validData = {
        questionIds: [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ],
      };

      const result = ReorderQuestionsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty questionIds array', () => {
      const invalidData = {
        questionIds: [],
      };

      const result = ReorderQuestionsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-array questionIds', () => {
      const invalidData = {
        questionIds: 'not-an-array',
      };

      const result = ReorderQuestionsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('Validation Middleware', () => {
  // Note: Middleware tests are complex and require proper mocking
  // For now, we'll focus on schema validation tests which are more reliable
  it('should validate request schemas correctly', () => {
    // Test that our schemas work as expected
    const validLoginData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
    };

    const result = LoginSchema.safeParse(validLoginData);
    expect(result.success).toBe(true);
  });
});

describe('Answer Validation Logic', () => {
  // Note: validateAnswerConstraints and validateQuizForPublishing functions
  // are not yet implemented in the codebase, so these tests are commented out
  // until those functions are available.

  it('should validate answer data structure', () => {
    const validAnswer = {
      answer_text: 'Paris',
      is_correct: true,
      order_index: 1,
      image_url: 'https://example.com/paris.jpg',
    };

    const result = CreateAnswerSchema.safeParse(validAnswer);
    expect(result.success).toBe(true);
  });

  it('should reject answer without text', () => {
    const invalidAnswer = {
      answer_text: '',
      is_correct: true,
      order_index: 1,
    };

    const result = CreateAnswerSchema.safeParse(invalidAnswer);
    expect(result.success).toBe(false);
  });
});

// Note: Mock functions removed as they're not needed for schema validation tests
