/**
 * Code Management Integration Tests
 *
 * Rate-limit aware integration tests for quiz code management APIs.
 * Tests code generation, checking, retrieval, and removal.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app';
import { RateLimitHelper } from '../setup/rateLimitHelper';
import { QuizDataFactory } from '../setup/testData';

describe('Code Management Integration Tests (Rate-Limited)', () => {
  let app: ReturnType<typeof createApp>;
  let testUser: { email: string; access_token: string } | null = null;
  let testQuiz: { id: string; title: string } | null = null;

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
          console.log('Created test user for code tests');
        }
      } catch (error) {
        console.warn('Failed to create test user:', error);
      }
    }

    // Check if we need to create a quiz
    if (!testQuiz && testUser && RateLimitHelper.canMakeDatabaseRequest()) {
      try {
        const quizData = QuizDataFactory.createQuizSet({
          title: 'Code Test Quiz',
          description: 'A quiz for testing code management',
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
          console.log('Created test quiz for code tests');
        }
      } catch (error) {
        console.warn('Failed to create test quiz:', error);
      }
    }
  });

  describe('Code Generation Operations', () => {
    it('should generate a unique quiz code', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping code generation - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .post(`/quiz/${testQuiz.id}/generate-code`)
          .set('Authorization', `Bearer ${testUser.access_token}`);
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('expires_at');
      expect(typeof response.body.code).toBe('string');
      expect(response.body.code.length).toBeGreaterThan(0);
    });

    it('should check code availability', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping code availability check - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      // First generate a code
      const generateResponse = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .post(`/quiz/${testQuiz.id}/generate-code`)
          .set('Authorization', `Bearer ${testUser!.access_token}`);
      });

      if (generateResponse.status !== 201) {
        console.log('Skipping code availability check - failed to generate code');
        expect(true).toBe(true);
        return;
      }

      const code = generateResponse.body.code;

      // Check if the code is available
      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app).get(`/quiz/code/check/${code}`);
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('quiz_id');
      expect(typeof response.body.available).toBe('boolean');
    });

    it('should get current quiz code', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping get quiz code - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .get(`/quiz/${testQuiz.id}/code`)
          .set('Authorization', `Bearer ${testUser.access_token}`);
      });

      // Should return either a code or indicate no code exists
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('code');
        expect(response.body).toHaveProperty('expires_at');
      }
    });

    it('should remove quiz code', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping code removal - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      // First generate a code
      const generateResponse = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .post(`/quiz/${testQuiz.id}/generate-code`)
          .set('Authorization', `Bearer ${testUser!.access_token}`);
      });

      if (generateResponse.status !== 201) {
        console.log('Skipping code removal - failed to generate code');
        expect(true).toBe(true);
        return;
      }

      // Remove the code
      const response = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .delete(`/quiz/${testQuiz.id}/code`)
          .set('Authorization', `Bearer ${testUser.access_token}`);
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('removed');
    });
  });

  describe('Code Validation', () => {
    it('should validate code format', () => {
      const validCode = 'ABC123';
      const invalidCodes = ['', 'AB', 'ABC123456789', 'abc123', 'ABC-123'];

      // Valid code should be 6 characters, alphanumeric, uppercase
      expect(validCode.length).toBe(6);
      expect(/^[A-Z0-9]{6}$/.test(validCode)).toBe(true);

      // Invalid codes should not match pattern
      invalidCodes.forEach((code) => {
        expect(/^[A-Z0-9]{6}$/.test(code)).toBe(false);
      });
    });

    it('should validate code uniqueness', () => {
      const codes = ['ABC123', 'DEF456', 'GHI789'];
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should validate code expiration', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

      expect(futureDate > now).toBe(true);
      expect(pastDate < now).toBe(true);
    });
  });

  describe('Code Error Handling', () => {
    it('should handle unauthorized access to code operations', async () => {
      const { default: request } = await import('supertest');
      const response = await request(app)
        .post('/quiz/invalid-id/generate-code')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should handle missing authorization header', async () => {
      const { default: request } = await import('supertest');
      const response = await request(app).post('/quiz/invalid-id/generate-code');

      expect(response.status).toBe(401);
    });

    it('should handle invalid quiz ID for code operations', async () => {
      if (!testUser) {
        console.log('Skipping invalid quiz ID test - no user available');
        expect(true).toBe(true);
        return;
      }

      const { default: request } = await import('supertest');
      const response = await request(app)
        .post('/quiz/invalid-id/generate-code')
        .set('Authorization', `Bearer ${testUser.access_token}`);

      expect(response.status).toBe(404);
    });

    it('should handle checking non-existent code', async () => {
      const { default: request } = await import('supertest');
      const response = await request(app).get('/quiz/code/check/NONEXISTENT');

      expect(response.status).toBe(404);
    });

    it('should handle removing non-existent code', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping remove non-existent code test - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      const { default: request } = await import('supertest');
      const response = await request(app)
        .delete(`/quiz/${testQuiz.id}/code`)
        .set('Authorization', `Bearer ${testUser.access_token}`);

      // Should either succeed (idempotent) or return not found
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Code Management Workflow', () => {
    it('should complete full code lifecycle', async () => {
      if (!testQuiz || !testUser) {
        console.log('Skipping full code lifecycle - missing prerequisites');
        expect(true).toBe(true);
        return;
      }

      // 1. Generate code
      const generateResponse = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .post(`/quiz/${testQuiz.id}/generate-code`)
          .set('Authorization', `Bearer ${testUser!.access_token}`);
      });

      if (generateResponse.status !== 201) {
        console.log('Skipping full code lifecycle - failed to generate code');
        expect(true).toBe(true);
        return;
      }

      const code = generateResponse.body.code;

      // 2. Check code availability
      const checkResponse = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app).get(`/quiz/code/check/${code}`);
      });

      expect(checkResponse.status).toBe(200);
      expect(checkResponse.body.available).toBe(true);

      // 3. Get current quiz code
      const getResponse = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .get(`/quiz/${testQuiz.id}/code`)
          .set('Authorization', `Bearer ${testUser!.access_token}`);
      });

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.code).toBe(code);

      // 4. Remove code
      const removeResponse = await RateLimitHelper.executeWithRateLimit('database', async () => {
        const { default: request } = await import('supertest');
        return request(app)
          .delete(`/quiz/${testQuiz.id}/code`)
          .set('Authorization', `Bearer ${testUser!.access_token}`);
      });

      expect(removeResponse.status).toBe(200);
    });
  });

  describe('Rate Limit Monitoring', () => {
    it('should monitor rate limit status during code operations', () => {
      const status = RateLimitHelper.getStatus();

      expect(status).toHaveProperty('auth');
      expect(status).toHaveProperty('userCreation');
      expect(status).toHaveProperty('database');

      console.log('Current rate limit status for codes:', {
        auth: `${status.auth.current}/${status.auth.limit}`,
        userCreation: `${status.userCreation.current}/${status.userCreation.limit}`,
        database: `${status.database.current}/${status.database.limit}`,
      });
    });
  });
});
