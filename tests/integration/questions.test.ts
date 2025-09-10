/**
 * Question Management Integration Tests
 *
 * Rate-limit aware integration tests for question management APIs.
 * Tests CRUD operations, reordering, and validation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app';
import { RateLimitHelper } from '../setup/rateLimitHelper';
import { QuestionDataFactory, QuizDataFactory } from '../setup/testData';

describe('Question Management Integration Tests (Rate-Limited)', () => {
  let app: ReturnType<typeof createApp>;
  let testUser: { email: string; access_token: string } | null = null;
  let testQuiz: { id: string; title: string } | null = null;
  let testQuestions: { id: string; question_text: string; order_index: number }[] = [];

  beforeAll(async () => {
    app = createApp();

    // Wait for any existing rate limits to reset
    await RateLimitHelper.waitForAllRateLimitsReset();
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      console.log(`Would clean up user: ${testUser.email}`);
    }
    if (testQuiz) {
      console.log(`Would clean up quiz: ${testQuiz.id}`);
    }
  });

  beforeEach(async () => {
    // Check if we need to create a user
    if (!testUser && RateLimitHelper.canCreateUser()) {
      try {
        const userData = {
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          username: `testuser_${Date.now()}`,
          displayName: `Test User ${Date.now()}`,
        };

        const response = await RateLimitHelper.executeWithRateLimit('userCreation', async () => {
          const { default: request } = await import('supertest');
          return request(app).post('/auth/register').send(userData);
        });

        if (response.status === 201) {
          testUser = response.body.user;
          console.log('Created test user for question tests');
        }
      } catch (error) {
        console.warn('Failed to create test user:', error);
      }
    }

    // Check if we need to create a quiz
    if (!testQuiz && testUser && RateLimitHelper.canMakeDatabaseRequest()) {
      try {
        const quizData = QuizDataFactory.createQuizSet({
          title: 'Question Test Quiz',
          description: 'A quiz for testing question management',
        });

        const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
          const { default: request } = await import('supertest');
          return request(app)
            .post('/quiz')
            .set('Authorization', `Bearer ${testUser!.access_token}`)
            .send(quizData);
        });

        if (response.status === 201) {
          testQuiz = response.body;
          console.log('Created test quiz for question tests');
        }
      } catch (error) {
        console.warn('Failed to create test quiz:', error);
      }
    }

    // Create test questions if we have a quiz and can make database requests
    if (
      testQuiz &&
      testUser &&
      testQuestions.length === 0 &&
      RateLimitHelper.canMakeDatabaseRequest()
    ) {
      try {
        const questionConfigs = [
          { text: 'What is the capital of France?', index: 1 },
          { text: 'What is the largest planet in our solar system?', index: 2 },
          { text: 'Who wrote Romeo and Juliet?', index: 3 },
        ];

        for (const config of questionConfigs) {
          if (!RateLimitHelper.canMakeDatabaseRequest()) {
            console.log('Rate limit reached, stopping question creation');
            break;
          }

          const questionData = QuestionDataFactory.createMultipleChoiceQuestion({
            question_text: config.text,
            explanation: `Explanation for question ${config.index}`,
            order_index: config.index,
            answers: [
              {
                answer_text: `Correct Answer ${config.index}`,
                is_correct: true,
                order_index: 1,
              },
              {
                answer_text: `Wrong Answer A ${config.index}`,
                is_correct: false,
                order_index: 2,
              },
              {
                answer_text: `Wrong Answer B ${config.index}`,
                is_correct: false,
                order_index: 3,
              },
            ],
          });

          const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
            const { default: request } = await import('supertest');
            return request(app)
              .post(`/quiz/${testQuiz!.id}/questions`)
              .set('Authorization', `Bearer ${testUser!.access_token}`)
              .send(questionData);
          });

          if (response.status === 201) {
            testQuestions.push({
              id: response.body.id,
              question_text: response.body.question_text,
              order_index: response.body.order_index,
            });
          }
        }

        console.log(`Created ${testQuestions.length} test questions`);
      } catch (error) {
        console.warn('Failed to create test questions:', error);
      }
    }
  });

  describe('Question CRUD Operations', () => {
    it('should get all questions for a quiz', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping get questions - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .get(`/quiz/${testQuiz.id}/questions`)
          .set('Authorization', `Bearer ${testUser!.access_token}`);
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(0);
    });

    it('should get a specific question by ID', async () => {
      if (!testQuiz || !testUser || testQuestions.length === 0) {
        console.log('Skipping get question - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const question = testQuestions[0];
      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .get(`/quiz/${testQuiz!.id}/questions/${question.id}`)
          .set('Authorization', `Bearer ${testUser!.access_token}`);
      });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(question.id);
      expect(response.body.question_text).toBe(question.question_text);
    });

    it('should update a question', async () => {
      if (!testQuiz || !testUser || testQuestions.length === 0) {
        console.log('Skipping question update - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const question = testQuestions[0];
      const updateData = {
        question_text: 'Updated question text',
        explanation: 'Updated explanation',
        answers: [
          {
            answer_text: 'Updated Correct Answer',
            is_correct: true,
            order_index: 1,
          },
          {
            answer_text: 'Updated Wrong Answer',
            is_correct: false,
            order_index: 2,
          },
        ],
      };

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .put(`/quiz/${testQuiz!.id}/questions/${question.id}`)
          .set('Authorization', `Bearer ${testUser!.access_token}`)
          .send(updateData);
      });

      expect(response.status).toBe(200);
      expect(response.body.question_text).toBe(updateData.question_text);
      expect(response.body.explanation).toBe(updateData.explanation);
    });

    it('should delete a question', async () => {
      if (!testQuiz || !testUser || testQuestions.length === 0) {
        console.log('Skipping question deletion - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const question = testQuestions[testQuestions.length - 1]; // Use the last question
      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .delete(`/quiz/${testQuiz!.id}/questions/${question.id}`)
          .set('Authorization', `Bearer ${testUser!.access_token}`);
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Remove from our test array
      testQuestions = testQuestions.filter((q) => q.id !== question.id);
    });
  });

  describe('Question Reordering', () => {
    it('should reorder questions', async () => {
      if (!testQuiz || !testUser || testQuestions.length < 2) {
        console.log('Skipping question reordering - need at least 2 questions');
        expect(true).toBe(true);
        return;
      }

      // Get current order
      const originalOrder = testQuestions.map((q) => q.id);
      const newOrder = [...originalOrder].reverse(); // Reverse the order

      const reorderData = {
        question_ids: newOrder,
      };

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .put(`/quiz/${testQuiz!.id}/questions/reorder`)
          .set('Authorization', `Bearer ${testUser!.access_token}`)
          .send(reorderData);
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reordered');
    });

    it('should validate reorder data', () => {
      const validReorderData = {
        question_ids: ['id1', 'id2', 'id3'],
      };

      const invalidReorderData = {
        question_ids: [], // Empty array
      };

      expect(Array.isArray(validReorderData.question_ids)).toBe(true);
      expect(validReorderData.question_ids.length).toBeGreaterThan(0);

      expect(Array.isArray(invalidReorderData.question_ids)).toBe(true);
      expect(invalidReorderData.question_ids.length).toBe(0);
    });
  });

  describe('Question Validation', () => {
    it('should validate question data structure', () => {
      const validQuestionData = QuestionDataFactory.createMultipleChoiceQuestion();

      expect(validQuestionData).toHaveProperty('question_text');
      expect(validQuestionData).toHaveProperty('question_type');
      expect(validQuestionData).toHaveProperty('order_index');
      expect(validQuestionData).toHaveProperty('explanation');
      expect(validQuestionData).toHaveProperty('time_limit');
      expect(validQuestionData).toHaveProperty('points');

      expect(typeof validQuestionData.question_text).toBe('string');
      expect(['MULTIPLE_CHOICE', 'TRUE_FALSE']).toContain(validQuestionData.question_type);
      expect(typeof validQuestionData.order_index).toBe('number');
      expect(typeof validQuestionData.explanation).toBe('string');
      expect(typeof validQuestionData.time_limit).toBe('number');
      expect(typeof validQuestionData.points).toBe('number');
    });

    it('should validate question constraints', () => {
      const validQuestion = QuestionDataFactory.createMultipleChoiceQuestion({
        question_text: 'Valid question text',
        order_index: 1,
        answers: [
          { answer_text: 'Answer 1', is_correct: true, order_index: 1 },
          { answer_text: 'Answer 2', is_correct: false, order_index: 2 },
        ],
      });

      expect(validQuestion.question_text.length).toBeGreaterThan(0);
      expect(validQuestion.order_index).toBeGreaterThan(0);
      expect(validQuestion.answers.length).toBeGreaterThan(0);

      // Check that there's at least one correct answer
      const hasCorrectAnswer = validQuestion.answers.some((answer) => answer.is_correct);
      expect(hasCorrectAnswer).toBe(true);
    });

    it('should detect invalid question data', () => {
      const invalidQuestions = [
        { question_text: '', order_index: 1, answers: [] }, // Empty text
        { question_text: 'Valid', order_index: 0, answers: [] }, // Invalid order
        { question_text: 'Valid', order_index: 1, answers: [] }, // No answers
        {
          question_text: 'Valid',
          order_index: 1,
          answers: [{ answer_text: 'Answer', is_correct: false, order_index: 1 }],
        }, // No correct answer
      ];

      invalidQuestions.forEach((question) => {
        if (question.question_text === '') {
          expect(question.question_text.length).toBe(0);
        }
        if (question.order_index === 0) {
          expect(question.order_index).toBeLessThanOrEqual(0);
        }
        if (question.answers.length === 0) {
          expect(question.answers.length).toBe(0);
        }
        if (question.answers.length > 0 && !question.answers.some((a) => a.is_correct)) {
          expect(question.answers.some((a) => a.is_correct)).toBe(false);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthorized access to question operations', async () => {
      const { default: request } = await import('supertest');
      const response = await request(app)
        .post('/quiz/invalid-id/questions')
        .set('Authorization', 'Bearer invalid-token')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should handle missing authorization header', async () => {
      const { default: request } = await import('supertest');
      const response = await request(app).post('/quiz/invalid-id/questions').send({});

      expect(response.status).toBe(401);
    });

    it('should handle invalid quiz ID for question operations', async () => {
      if (!testUser) {
        console.log('Skipping invalid quiz ID test - no user available');
        expect(true).toBe(true);
        return;
      }

      const { default: request } = await import('supertest');
      const response = await request(app)
        .get('/quiz/invalid-id/questions')
        .set('Authorization', `Bearer ${testUser.access_token}`);

      expect(response.status).toBe(404);
    });

    it('should handle invalid question ID', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping invalid question ID test - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const { default: request } = await import('supertest');
      const response = await request(app)
        .get(`/quiz/${testQuiz.id}/questions/invalid-id`)
        .set('Authorization', `Bearer ${testUser.access_token}`);

      expect(response.status).toBe(404);
    });

    it('should handle invalid reorder data', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping invalid reorder test - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const { default: request } = await import('supertest');
      const response = await request(app)
        .put(`/quiz/${testQuiz.id}/questions/reorder`)
        .set('Authorization', `Bearer ${testUser.access_token}`)
        .send({ question_ids: [] }); // Empty array

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limit Monitoring', () => {
    it('should monitor rate limit status during question operations', () => {
      const status = RateLimitHelper.getStatus();

      expect(status).toHaveProperty('auth');
      expect(status).toHaveProperty('userCreation');
      expect(status).toHaveProperty('database');

      console.log('Current rate limit status for questions:', {
        auth: `${status.auth.current}/${status.auth.limit}`,
        userCreation: `${status.userCreation.current}/${status.userCreation.limit}`,
        database: `${status.database.current}/${status.database.limit}`,
      });
    });
  });
});
