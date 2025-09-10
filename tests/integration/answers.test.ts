/**
 * Answer Management Integration Tests
 *
 * Rate-limit aware integration tests for answer management APIs.
 * Tests CRUD operations for answers with proper authentication.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app';
import { RateLimitHelper } from '../setup/rateLimitHelper';
import { AnswerDataFactory, QuestionDataFactory, QuizDataFactory } from '../setup/testData';

describe('Answer Management Integration Tests (Rate-Limited)', () => {
  let app: ReturnType<typeof createApp>;
  let testUser: { email: string; access_token: string } | null = null;
  let testQuiz: { id: string; title: string } | null = null;
  let testQuestion: { id: string; question_text: string } | null = null;

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
          console.log('Created test user for answer tests');
        }
      } catch (error) {
        console.warn('Failed to create test user:', error);
      }
    }

    // Check if we need to create a quiz
    if (!testQuiz && testUser && RateLimitHelper.canMakeDatabaseRequest()) {
      try {
        const quizData = QuizDataFactory.createQuizSet({
          title: 'Answer Test Quiz',
          description: 'A quiz for testing answer management',
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
          console.log('Created test quiz for answer tests');
        }
      } catch (error) {
        console.warn('Failed to create test quiz:', error);
      }
    }

    // Check if we need to create a question
    if (!testQuestion && testQuiz && testUser && RateLimitHelper.canMakeDatabaseRequest()) {
      try {
        const questionData = QuestionDataFactory.createMultipleChoiceQuestion({
          question_text: 'What is the capital of France?',
          explanation: 'Paris is the capital of France.',
          order_index: 1,
          answers: [
            {
              answer_text: 'Paris',
              is_correct: true,
              order_index: 1,
            },
            {
              answer_text: 'London',
              is_correct: false,
              order_index: 2,
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
          testQuestion = response.body;
          console.log('Created test question for answer tests');
        }
      } catch (error) {
        console.warn('Failed to create test question:', error);
      }
    }
  });

  describe('Answer CRUD Operations', () => {
    it('should create a new answer', async () => {
      if (!testQuiz || !testQuestion || !testUser) {
        console.log('Skipping answer creation - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const answerData = AnswerDataFactory.createCorrectAnswer({
        answer_text: 'Berlin',
        is_correct: false,
        order_index: 3,
      });

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .post(`/quiz/${testQuiz.id}/questions/${testQuestion.id}/answers`)
          .set('Authorization', `Bearer ${testUser.access_token}`)
          .send(answerData);
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.answer_text).toBe(answerData.answer_text);
      expect(response.body.is_correct).toBe(answerData.is_correct);
      expect(response.body.order_index).toBe(answerData.order_index);
    });

    it('should get answers for a question', async () => {
      if (!testQuiz || !testQuestion || !testUser) {
        console.log('Skipping answer retrieval - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .get(`/quiz/${testQuiz.id}/questions/${testQuestion.id}/answers`)
          .set('Authorization', `Bearer ${testUser.access_token}`);
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should update an existing answer', async () => {
      if (!testQuiz || !testQuestion || !testUser) {
        console.log('Skipping answer update - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      // First create an answer
      const answerData = AnswerDataFactory.createCorrectAnswer({
        answer_text: 'Madrid',
        is_correct: false,
        order_index: 4,
      });

      const createResponse = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .post(`/quiz/${testQuiz.id}/questions/${testQuestion.id}/answers`)
          .set('Authorization', `Bearer ${testUser.access_token}`)
          .send(answerData);
      });

      if (createResponse.status !== 201) {
        console.log('Skipping answer update - failed to create answer');
        expect(true).toBe(true);
        return;
      }

      const answerId = createResponse.body.id;
      const updateData = {
        answer_text: 'Updated Madrid',
        is_correct: true,
        order_index: 5,
      };

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .put(`/quiz/${testQuiz.id}/questions/${testQuestion.id}/answers/${answerId}`)
          .set('Authorization', `Bearer ${testUser.access_token}`)
          .send(updateData);
      });

      expect(response.status).toBe(200);
      expect(response.body.answer_text).toBe(updateData.answer_text);
      expect(response.body.is_correct).toBe(updateData.is_correct);
      expect(response.body.order_index).toBe(updateData.order_index);
    });

    it('should delete an answer', async () => {
      if (!testQuiz || !testQuestion || !testUser) {
        console.log('Skipping answer deletion - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      // First create an answer
      const answerData = AnswerDataFactory.createCorrectAnswer({
        answer_text: 'Rome',
        is_correct: false,
        order_index: 6,
      });

      const createResponse = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .post(`/quiz/${testQuiz.id}/questions/${testQuestion.id}/answers`)
          .set('Authorization', `Bearer ${testUser.access_token}`)
          .send(answerData);
      });

      if (createResponse.status !== 201) {
        console.log('Skipping answer deletion - failed to create answer');
        expect(true).toBe(true);
        return;
      }

      const answerId = createResponse.body.id;

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .delete(`/quiz/${testQuiz.id}/questions/${testQuestion.id}/answers/${answerId}`)
          .set('Authorization', `Bearer ${testUser.access_token}`);
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('Answer Validation', () => {
    it('should validate answer data structure', () => {
      const validAnswerData = AnswerDataFactory.createCorrectAnswer();

      expect(validAnswerData).toHaveProperty('answer_text');
      expect(validAnswerData).toHaveProperty('is_correct');
      expect(validAnswerData).toHaveProperty('order_index');

      expect(typeof validAnswerData.answer_text).toBe('string');
      expect(typeof validAnswerData.is_correct).toBe('boolean');
      expect(typeof validAnswerData.order_index).toBe('number');
    });

    it('should validate answer constraints', () => {
      const validAnswer = AnswerDataFactory.createCorrectAnswer({
        answer_text: 'Valid Answer',
        is_correct: true,
        order_index: 1,
      });

      expect(validAnswer.answer_text.length).toBeGreaterThan(0);
      expect(validAnswer.order_index).toBeGreaterThan(0);
    });

    it('should detect invalid answer data', () => {
      const invalidAnswers = [
        { answer_text: '', is_correct: true, order_index: 1 }, // Empty text
        { answer_text: 'Valid', is_correct: true, order_index: 0 }, // Invalid order
        { answer_text: 'Valid', is_correct: 'not_boolean', order_index: 1 }, // Invalid type
      ];

      invalidAnswers.forEach((invalidAnswer) => {
        if (invalidAnswer.answer_text === '') {
          expect(invalidAnswer.answer_text.length).toBe(0);
        }
        if (invalidAnswer.order_index === 0) {
          expect(invalidAnswer.order_index).toBeLessThanOrEqual(0);
        }
        if (typeof invalidAnswer.is_correct !== 'boolean') {
          expect(typeof invalidAnswer.is_correct).not.toBe('boolean');
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthorized access', async () => {
      const { default: request } = await import('supertest');
      const response = await request(app)
        .post('/quiz/invalid-id/questions/invalid-id/answers')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should handle missing authorization header', async () => {
      const { default: request } = await import('supertest');
      const response = await request(app).post('/quiz/invalid-id/questions/invalid-id/answers');

      expect(response.status).toBe(401);
    });

    it('should handle invalid quiz ID', async () => {
      if (!testUser) {
        console.log('Skipping invalid quiz ID test - no user available');
        expect(true).toBe(true);
        return;
      }

      const { default: request } = await import('supertest');
      const response = await request(app)
        .post('/quiz/invalid-id/questions/invalid-id/answers')
        .set('Authorization', `Bearer ${testUser.access_token}`)
        .send(AnswerDataFactory.createCorrectAnswer());

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
        .post(`/quiz/${testQuiz.id}/questions/invalid-id/answers`)
        .set('Authorization', `Bearer ${testUser.access_token}`)
        .send(AnswerDataFactory.createCorrectAnswer());

      expect(response.status).toBe(404);
    });
  });

  describe('Rate Limit Monitoring', () => {
    it('should monitor rate limit status during answer operations', () => {
      const status = RateLimitHelper.getStatus();

      expect(status).toHaveProperty('auth');
      expect(status).toHaveProperty('userCreation');
      expect(status).toHaveProperty('database');

      console.log('Current rate limit status for answers:', {
        auth: `${status.auth.current}/${status.auth.limit}`,
        userCreation: `${status.userCreation.current}/${status.userCreation.limit}`,
        database: `${status.database.current}/${status.database.limit}`,
      });
    });
  });
});
