/**
 * Load Testing Suite
 *
 * Tests the system under various load conditions to ensure it can handle
 * concurrent users and operations without performance degradation.
 *
 * These tests are designed to run for extended periods and measure:
 * - Response times under load
 * - Memory usage patterns
 * - Database performance
 * - Concurrent operation handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { TestDatabase, getTestDatabase } from '../setup/testDatabase';
import { TestAuth, type TestUser, getTestAuth } from '../setup/testAuth';
import { QuizDataFactory } from '../setup/testData';
import { logger } from '../../src/utils/logger';

// Type for API responses
interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

describe('Load Testing', () => {
  let testDb: TestDatabase;
  let testAuth: TestAuth;
  let testUsers: TestUser[] = [];
  const CONCURRENT_USERS = 10;
  const BULK_OPERATIONS = 50;
  const app = createApp();

  beforeAll(async () => {
    testDb = getTestDatabase();
    testAuth = getTestAuth(testDb);
    await testDb.startTransaction();

    // Create multiple test users for concurrent operations
    logger.info(`Creating ${CONCURRENT_USERS} test users for load testing`);
    testUsers = await testAuth.createMultipleTestUsers(CONCURRENT_USERS);
    logger.info(`Created ${testUsers.length} test users`);
  });

  afterAll(async () => {
    // Clean up all test users
    logger.info('Cleaning up test users');
    for (const user of testUsers) {
      try {
        await testAuth.deleteTestUser(user.id);
      } catch (error) {
        logger.warn(`Failed to delete user ${user.id}:`, error);
      }
    }

    await testDb.rollbackTransaction();
    await testDb.dispose();
  });

  beforeEach(async () => {
    await testDb.startTransaction();
  });

  afterEach(async () => {
    await testDb.rollbackTransaction();
  });

  describe('Concurrent User Operations', () => {
    it('should handle concurrent user registration', async () => {
      const startTime = Date.now();
      const promises: Promise<ApiResponse>[] = [];

      // Create multiple registration requests simultaneously
      for (let i = 0; i < CONCURRENT_USERS; i++) {
        const userData = {
          email: `load-test-${i}-${Date.now()}@example.com`,
          username: `loadtest${i}${Date.now()}`,
          displayName: `Load Test User ${i}`,
          password: 'ValidPassword123!',
        };

        promises.push(request(app).post('/auth/register').send(userData).expect(201));
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Check that all registrations succeeded
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info(
        `Concurrent registration results: ${successful} successful, ${failed} failed in ${duration}ms`,
      );

      expect(successful).toBeGreaterThanOrEqual(CONCURRENT_USERS * 0.8); // At least 80% success rate
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    }, 60000);

    it('should handle concurrent user login', async () => {
      const startTime = Date.now();
      const promises: Promise<ApiResponse>[] = [];

      // Create concurrent login requests for existing users
      for (const user of testUsers) {
        promises.push(
          request(app)
            .post('/auth/login')
            .send({
              email: user.email,
              password: 'ValidPassword123!',
            })
            .expect(200),
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Check that all logins succeeded
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info(
        `Concurrent login results: ${successful} successful, ${failed} failed in ${duration}ms`,
      );

      expect(successful).toBeGreaterThanOrEqual(CONCURRENT_USERS * 0.9); // At least 90% success rate
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    }, 30000);
  });

  describe('Bulk Quiz Operations', () => {
    it('should handle bulk quiz creation', async () => {
      const startTime = Date.now();
      const promises: Promise<ApiResponse>[] = [];
      const createdQuizzes: ApiResponse[] = [];

      // Create multiple quizzes simultaneously
      for (let i = 0; i < BULK_OPERATIONS; i++) {
        const user = testUsers[i % testUsers.length];
        const quizData = QuizDataFactory.createQuizSet({
          title: `Load Test Quiz ${i} - ${Date.now()}`,
          description: `Bulk quiz creation test ${i}`,
        });

        promises.push(
          request(app)
            .post('/quiz')
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send(quizData)
            .expect(201)
            .then((response) => {
              createdQuizzes.push(response.body);
              return response;
            }),
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Check that all quiz creations succeeded
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info(
        `Bulk quiz creation results: ${successful} successful, ${failed} failed in ${duration}ms`,
      );
      logger.info(`Average response time: ${duration / BULK_OPERATIONS}ms per quiz`);

      expect(successful).toBeGreaterThanOrEqual(BULK_OPERATIONS * 0.8); // At least 80% success rate
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
      expect(createdQuizzes.length).toBe(successful);
    }, 120000);

    it('should handle concurrent quiz retrieval', async () => {
      // First create some quizzes to retrieve
      const quizIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const user = testUsers[i % testUsers.length];
        const quizData = QuizDataFactory.createQuizSet({
          title: `Retrieval Test Quiz ${i} - ${Date.now()}`,
        });

        const response = await request(app)
          .post('/quiz')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send(quizData)
          .expect(201);

        quizIds.push((response.body as { id: string }).id);
      }

      const startTime = Date.now();
      const promises: Promise<ApiResponse>[] = [];

      // Create concurrent retrieval requests
      for (const quizId of quizIds) {
        promises.push(request(app).get(`/quiz/${quizId}`).expect(200));
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Check that all retrievals succeeded
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info(
        `Concurrent quiz retrieval results: ${successful} successful, ${failed} failed in ${duration}ms`,
      );

      expect(successful).toBe(quizIds.length); // All should succeed
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    }, 30000);
  });

  describe('Database Performance', () => {
    it('should maintain performance under database load', async () => {
      const startTime = Date.now();
      const promises: Promise<ApiResponse>[] = [];
      const responseTimes: number[] = [];

      // Create mixed database operations
      for (let i = 0; i < 20; i++) {
        const user = testUsers[i % testUsers.length];
        const operationStart = Date.now();

        // Mix of different operations
        if (i % 4 === 0) {
          // Create quiz
          const quizData = QuizDataFactory.createQuizSet({
            title: `DB Load Test Quiz ${i} - ${Date.now()}`,
          });
          promises.push(
            request(app)
              .post('/quiz')
              .set('Authorization', `Bearer ${user.accessToken}`)
              .send(quizData)
              .expect(201)
              .then((response) => {
                responseTimes.push(Date.now() - operationStart);
                return response;
              }),
          );
        } else if (i % 4 === 1) {
          // List quizzes
          promises.push(
            request(app)
              .get('/quiz')
              .set('Authorization', `Bearer ${user.accessToken}`)
              .expect(200)
              .then((response) => {
                responseTimes.push(Date.now() - operationStart);
                return response;
              }),
          );
        } else if (i % 4 === 2) {
          // Health check
          promises.push(
            request(app)
              .get('/health')
              .expect(200)
              .then((response) => {
                responseTimes.push(Date.now() - operationStart);
                return response;
              }),
          );
        } else {
          // User profile operations
          promises.push(
            request(app)
              .get('/auth/profile')
              .set('Authorization', `Bearer ${user.accessToken}`)
              .expect(200)
              .then((response) => {
                responseTimes.push(Date.now() - operationStart);
                return response;
              }),
          );
        }
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Calculate performance metrics
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      logger.info(`Database performance results:`);
      logger.info(`  Total operations: ${results.length}`);
      logger.info(`  Successful: ${successful}`);
      logger.info(`  Total duration: ${totalDuration}ms`);
      logger.info(`  Average response time: ${averageResponseTime.toFixed(2)}ms`);
      logger.info(`  Max response time: ${maxResponseTime}ms`);
      logger.info(`  Min response time: ${minResponseTime}ms`);

      expect(successful).toBeGreaterThanOrEqual(results.length * 0.9); // At least 90% success rate
      expect(averageResponseTime).toBeLessThan(2000); // Average response time under 2 seconds
      expect(maxResponseTime).toBeLessThan(10000); // Max response time under 10 seconds
    }, 60000);
  });

  describe('Memory Usage Monitoring', () => {
    it('should not leak memory during extended operations', async () => {
      const initialMemory = process.memoryUsage();
      logger.info(`Initial memory usage: ${JSON.stringify(initialMemory)}`);

      // Perform extended operations
      for (let cycle = 0; cycle < 5; cycle++) {
        logger.info(`Memory test cycle ${cycle + 1}/5`);

        // Create and delete quizzes in batches
        const batchSize = 10;
        for (let batch = 0; batch < 3; batch++) {
          const promises: Promise<ApiResponse>[] = [];
          const quizIds: string[] = [];

          // Create batch of quizzes
          for (let i = 0; i < batchSize; i++) {
            const user = testUsers[i % testUsers.length];
            const quizData = QuizDataFactory.createQuizSet({
              title: `Memory Test Quiz ${cycle}-${batch}-${i} - ${Date.now()}`,
            });

            promises.push(
              request(app)
                .post('/quiz')
                .set('Authorization', `Bearer ${user.accessToken}`)
                .send(quizData)
                .expect(201)
                .then((response) => {
                  quizIds.push(response.body.id);
                  return response;
                }),
            );
          }

          await Promise.all(promises);

          // Delete the quizzes
          for (const quizId of quizIds) {
            const user = testUsers[0]; // Use first user for deletion
            await request(app)
              .delete(`/quiz/${quizId}`)
              .set('Authorization', `Bearer ${user.accessToken}`)
              .expect(200);
          }

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }

        // Check memory usage after each cycle
        const currentMemory = process.memoryUsage();
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;

        logger.info(`Memory after cycle ${cycle + 1}: ${JSON.stringify(currentMemory)}`);
        logger.info(`Memory increase: ${memoryIncrease} bytes`);
      }

      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = totalMemoryIncrease / 1024 / 1024;

      logger.info(`Final memory usage: ${JSON.stringify(finalMemory)}`);
      logger.info(`Total memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncreaseMB).toBeLessThan(100);
    }, 120000);
  });

  describe('Rate Limiting Under Load', () => {
    it('should handle rate limiting gracefully under high load', async () => {
      const startTime = Date.now();
      const promises: Promise<ApiResponse>[] = [];
      const rateLimitResponses: ApiResponse[] = [];

      // Create many rapid requests to trigger rate limiting
      for (let i = 0; i < 100; i++) {
        const user = testUsers[i % testUsers.length];

        promises.push(
          request(app)
            .post('/auth/login')
            .send({
              email: user.email,
              password: 'ValidPassword123!',
            })
            .then((response) => {
              if (response.status === 429) {
                rateLimitResponses.push(response);
              }
              return response;
            })
            .catch(() => {
              // Handle network errors gracefully
              return { status: 500, body: { error: 'network_error' } };
            }),
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status < 400,
      ).length;

      const rateLimited = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429,
      ).length;

      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info(`Rate limiting test results:`);
      logger.info(`  Total requests: ${results.length}`);
      logger.info(`  Successful: ${successful}`);
      logger.info(`  Rate limited: ${rateLimited}`);
      logger.info(`  Failed: ${failed}`);
      logger.info(`  Duration: ${duration}ms`);

      // Should have some rate limiting responses
      expect(rateLimited).toBeGreaterThan(0);

      // Should not have too many failures
      expect(failed).toBeLessThan(results.length * 0.1); // Less than 10% failures

      // Should complete within reasonable time
      expect(duration).toBeLessThan(30000); // Under 30 seconds
    }, 60000);
  });
});
