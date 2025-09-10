/**
 * Stress Testing Suite
 *
 * Tests the system under extreme conditions to find breaking points
 * and ensure graceful degradation under stress.
 *
 * These tests push the system to its limits and measure:
 * - Maximum concurrent operations
 * - Large data set handling
 * - Extended running time
 * - Resource exhaustion scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { TestDatabase, getTestDatabase } from '../setup/testDatabase';
import { TestAuth, type TestUser, getTestAuth } from '../setup/testAuth';
import { QuizDataFactory, QuestionDataFactory } from '../setup/testData';
import { logger } from '../../src/utils/logger';

// Type for API responses
interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

describe('Stress Testing', () => {
  let testDb: TestDatabase;
  let testAuth: TestAuth;
  let testUsers: TestUser[] = [];
  const MAX_CONCURRENT_USERS = 50;
  const LARGE_DATA_SET_SIZE = 1000;
  const EXTENDED_TEST_DURATION = 300000; // 5 minutes
  const app = createApp();

  beforeAll(async () => {
    testDb = getTestDatabase();
    testAuth = getTestAuth(testDb);
    await testDb.startTransaction();

    // Create maximum number of test users for stress testing
    logger.info(`Creating ${MAX_CONCURRENT_USERS} test users for stress testing`);
    testUsers = await testAuth.createMultipleTestUsers(MAX_CONCURRENT_USERS);
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

  describe('Maximum Concurrent Operations', () => {
    it('should handle maximum concurrent user operations', async () => {
      const startTime = Date.now();
      const promises: Promise<ApiResponse | void>[] = [];
      const results = {
        successful: 0,
        failed: 0,
        rateLimited: 0,
        errors: 0,
      };

      // Create maximum concurrent operations
      for (let i = 0; i < MAX_CONCURRENT_USERS; i++) {
        // Safe array access with bounds checking
        if (i >= testUsers.length) {
          throw new Error(`Test user index ${i} is out of bounds`);
        }
        // Use Array.at() for safer array access
        const user = testUsers.at(i) as TestUser;

        // Mix of different operations
        if (i % 3 === 0) {
          // Registration
          const userData = {
            email: `stress-test-${i}-${Date.now()}@example.com`,
            username: `stresstest${i}${Date.now()}`,
            displayName: `Stress Test User ${i}`,
            password: 'ValidPassword123!',
          };

          promises.push(
            request(app)
              .post('/auth/register')
              .send(userData)
              .then((response) => {
                if (response.status < 400) results.successful++;
                else if (response.status === 429) results.rateLimited++;
                else results.failed++;
                return response;
              })
              .catch(() => {
                results.errors++;
              }),
          );
        } else if (i % 3 === 1) {
          // Login
          promises.push(
            request(app)
              .post('/auth/login')
              .send({
                email: user.email,
                password: 'ValidPassword123!',
              })
              .then((response) => {
                if (response.status < 400) results.successful++;
                else if (response.status === 429) results.rateLimited++;
                else results.failed++;
                return response;
              })
              .catch(() => {
                results.errors++;
              }),
          );
        } else {
          // Profile access
          promises.push(
            request(app)
              .get('/auth/profile')
              .set('Authorization', `Bearer ${user.accessToken}`)
              .then((response) => {
                if (response.status < 400) results.successful++;
                else if (response.status === 429) results.rateLimited++;
                else results.failed++;
                return response;
              })
              .catch(() => {
                results.errors++;
              }),
          );
        }
      }

      await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(`Maximum concurrent operations results:`);
      logger.info(`  Total operations: ${MAX_CONCURRENT_USERS}`);
      logger.info(`  Successful: ${results.successful}`);
      logger.info(`  Failed: ${results.failed}`);
      logger.info(`  Rate limited: ${results.rateLimited}`);
      logger.info(`  Errors: ${results.errors}`);
      logger.info(`  Duration: ${duration}ms`);

      // Should handle at least 80% of operations successfully
      expect(results.successful).toBeGreaterThanOrEqual(MAX_CONCURRENT_USERS * 0.8);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(60000); // Under 60 seconds

      // Should not have too many errors
      expect(results.errors).toBeLessThan(MAX_CONCURRENT_USERS * 0.1); // Less than 10% errors
    }, 120000);

    it('should handle maximum concurrent quiz operations', async () => {
      const startTime = Date.now();
      const promises: Promise<ApiResponse | void>[] = [];
      const results = {
        successful: 0,
        failed: 0,
        rateLimited: 0,
        errors: 0,
      };

      // Create maximum concurrent quiz operations
      for (let i = 0; i < MAX_CONCURRENT_USERS; i++) {
        // Safe array access with bounds checking
        if (i >= testUsers.length) {
          throw new Error(`Test user index ${i} is out of bounds`);
        }
        // Use Array.at() for safer array access
        const user = testUsers.at(i) as TestUser;

        // Mix of quiz operations
        if (i % 4 === 0) {
          // Create quiz
          const quizData = QuizDataFactory.createQuizSet({
            title: `Stress Test Quiz ${i} - ${Date.now()}`,
          });

          promises.push(
            request(app)
              .post('/quiz')
              .set('Authorization', `Bearer ${user.accessToken}`)
              .send(quizData)
              .then((response) => {
                if (response.status < 400) results.successful++;
                else if (response.status === 429) results.rateLimited++;
                else results.failed++;
                return response;
              })
              .catch(() => {
                results.errors++;
              }),
          );
        } else if (i % 4 === 1) {
          // List quizzes
          promises.push(
            request(app)
              .get('/quiz')
              .set('Authorization', `Bearer ${user.accessToken}`)
              .then((response) => {
                if (response.status < 400) results.successful++;
                else if (response.status === 429) results.rateLimited++;
                else results.failed++;
                return response;
              })
              .catch(() => {
                results.errors++;
              }),
          );
        } else if (i % 4 === 2) {
          // Health check
          promises.push(
            request(app)
              .get('/health')
              .then((response) => {
                if (response.status < 400) results.successful++;
                else if (response.status === 429) results.rateLimited++;
                else results.failed++;
                return response;
              })
              .catch(() => {
                results.errors++;
              }),
          );
        } else {
          // Profile access
          promises.push(
            request(app)
              .get('/auth/profile')
              .set('Authorization', `Bearer ${user.accessToken}`)
              .then((response) => {
                if (response.status < 400) results.successful++;
                else if (response.status === 429) results.rateLimited++;
                else results.failed++;
                return response;
              })
              .catch(() => {
                results.errors++;
              }),
          );
        }
      }

      await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(`Maximum concurrent quiz operations results:`);
      logger.info(`  Total operations: ${MAX_CONCURRENT_USERS}`);
      logger.info(`  Successful: ${results.successful}`);
      logger.info(`  Failed: ${results.failed}`);
      logger.info(`  Rate limited: ${results.rateLimited}`);
      logger.info(`  Errors: ${results.errors}`);
      logger.info(`  Duration: ${duration}ms`);

      // Should handle at least 70% of operations successfully
      expect(results.successful).toBeGreaterThanOrEqual(MAX_CONCURRENT_USERS * 0.7);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(90000); // Under 90 seconds

      // Should not have too many errors
      expect(results.errors).toBeLessThan(MAX_CONCURRENT_USERS * 0.15); // Less than 15% errors
    }, 150000);
  });

  describe('Large Data Set Handling', () => {
    it('should handle large quiz creation with many questions', async () => {
      const user = testUsers[0];
      const quizData = QuizDataFactory.createQuizSet({
        title: `Large Quiz Test - ${Date.now()}`,
        description: 'A quiz with many questions for stress testing',
      });

      // Create the quiz first
      const quizResponse = await request(app)
        .post('/quiz')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send(quizData)
        .expect(201);

      const quizId = quizResponse.body.id;
      const startTime = Date.now();
      const promises: Promise<ApiResponse | void>[] = [];
      const results = {
        successful: 0,
        failed: 0,
        errors: 0,
      };

      // Create many questions simultaneously
      for (let i = 0; i < LARGE_DATA_SET_SIZE; i++) {
        const questionData = QuestionDataFactory.createMultipleChoiceQuestion({
          question_text: `Stress Test Question ${i} - ${Date.now()}`,
          order_index: i,
        });

        promises.push(
          request(app)
            .post(`/quiz/${quizId}/questions`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send(questionData)
            .then((response) => {
              if (response.status < 400) results.successful++;
              else results.failed++;
              return response;
            })
            .catch(() => {
              results.errors++;
            }),
        );
      }

      await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(`Large data set handling results:`);
      logger.info(`  Total questions: ${LARGE_DATA_SET_SIZE}`);
      logger.info(`  Successful: ${results.successful}`);
      logger.info(`  Failed: ${results.failed}`);
      logger.info(`  Errors: ${results.errors}`);
      logger.info(`  Duration: ${duration}ms`);
      logger.info(`  Average time per question: ${duration / LARGE_DATA_SET_SIZE}ms`);

      // Should handle at least 80% of questions successfully
      expect(results.successful).toBeGreaterThanOrEqual(LARGE_DATA_SET_SIZE * 0.8);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(300000); // Under 5 minutes

      // Should not have too many errors
      expect(results.errors).toBeLessThan(LARGE_DATA_SET_SIZE * 0.1); // Less than 10% errors
    }, 600000);

    it('should handle large quiz retrieval and listing', async () => {
      const user = testUsers[0];
      const quizIds: string[] = [];

      // First create many quizzes
      logger.info('Creating quizzes for large data set test');
      for (let i = 0; i < 100; i++) {
        const quizData = QuizDataFactory.createQuizSet({
          title: `Large Data Quiz ${i} - ${Date.now()}`,
        });

        const response = await request(app)
          .post('/quiz')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send(quizData)
          .expect(201);

        quizIds.push(response.body.id);
      }

      const startTime = Date.now();
      const promises: Promise<ApiResponse | void>[] = [];
      const results = {
        successful: 0,
        failed: 0,
        errors: 0,
      };

      // Create concurrent retrieval requests
      for (const quizId of quizIds) {
        promises.push(
          request(app)
            .get(`/quiz/${quizId}`)
            .then((response) => {
              if (response.status < 400) results.successful++;
              else results.failed++;
              return response;
            })
            .catch(() => {
              results.errors++;
            }),
        );
      }

      // Also test listing all quizzes
      promises.push(
        request(app)
          .get('/quiz')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .then((response) => {
            if (response.status < 400) results.successful++;
            else results.failed++;
            return response;
          })
          .catch(() => {
            results.errors++;
          }),
      );

      await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(`Large quiz retrieval results:`);
      logger.info(`  Total operations: ${quizIds.length + 1}`);
      logger.info(`  Successful: ${results.successful}`);
      logger.info(`  Failed: ${results.failed}`);
      logger.info(`  Errors: ${results.errors}`);
      logger.info(`  Duration: ${duration}ms`);

      // Should handle at least 90% of operations successfully
      expect(results.successful).toBeGreaterThanOrEqual((quizIds.length + 1) * 0.9);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(60000); // Under 60 seconds

      // Should not have too many errors
      expect(results.errors).toBeLessThan((quizIds.length + 1) * 0.05); // Less than 5% errors
    }, 120000);
  });

  describe('Extended Running Time', () => {
    it('should maintain performance during extended operation', async () => {
      const startTime = Date.now();
      const endTime = startTime + EXTENDED_TEST_DURATION;
      const results = {
        cycles: 0,
        successful: 0,
        failed: 0,
        errors: 0,
        responseTimes: [] as number[],
      };

      logger.info(`Starting extended test for ${EXTENDED_TEST_DURATION / 1000} seconds`);

      while (Date.now() < endTime) {
        const cycleStart = Date.now();
        const promises: Promise<ApiResponse | void>[] = [];

        // Create a batch of operations
        for (let i = 0; i < 10; i++) {
          const user = testUsers[i % testUsers.length];

          // Mix of operations
          if (i % 3 === 0) {
            // Create quiz
            const quizData = QuizDataFactory.createQuizSet({
              title: `Extended Test Quiz ${results.cycles}-${i} - ${Date.now()}`,
            });

            promises.push(
              request(app)
                .post('/quiz')
                .set('Authorization', `Bearer ${user.accessToken}`)
                .send(quizData)
                .then((response) => {
                  if (response.status < 400) results.successful++;
                  else results.failed++;
                  return response;
                })
                .catch(() => {
                  results.errors++;
                }),
            );
          } else if (i % 3 === 1) {
            // List quizzes
            promises.push(
              request(app)
                .get('/quiz')
                .set('Authorization', `Bearer ${user.accessToken}`)
                .then((response) => {
                  if (response.status < 400) results.successful++;
                  else results.failed++;
                  return response;
                })
                .catch(() => {
                  results.errors++;
                }),
            );
          } else {
            // Health check
            promises.push(
              request(app)
                .get('/health')
                .then((response) => {
                  if (response.status < 400) results.successful++;
                  else results.failed++;
                  return response;
                })
                .catch(() => {
                  results.errors++;
                }),
            );
          }
        }

        await Promise.allSettled(promises);

        const cycleEnd = Date.now();
        const cycleDuration = cycleEnd - cycleStart;
        results.responseTimes.push(cycleDuration);
        results.cycles++;

        // Log progress every 30 seconds
        if (results.cycles % 30 === 0) {
          const elapsed = Date.now() - startTime;
          const remaining = endTime - Date.now();
          const avgResponseTime =
            results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;

          logger.info(`Extended test progress:`);
          logger.info(`  Elapsed: ${elapsed / 1000}s`);
          logger.info(`  Remaining: ${remaining / 1000}s`);
          logger.info(`  Cycles: ${results.cycles}`);
          logger.info(`  Successful: ${results.successful}`);
          logger.info(`  Failed: ${results.failed}`);
          logger.info(`  Errors: ${results.errors}`);
          logger.info(`  Avg response time: ${avgResponseTime.toFixed(2)}ms`);
        }

        // Small delay between cycles
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const totalDuration = Date.now() - startTime;
      const avgResponseTime =
        results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
      const maxResponseTime = Math.max(...results.responseTimes);
      const minResponseTime = Math.min(...results.responseTimes);

      logger.info(`Extended test results:`);
      logger.info(`  Total duration: ${totalDuration / 1000}s`);
      logger.info(`  Cycles completed: ${results.cycles}`);
      logger.info(`  Total operations: ${results.successful + results.failed + results.errors}`);
      logger.info(`  Successful: ${results.successful}`);
      logger.info(`  Failed: ${results.failed}`);
      logger.info(`  Errors: ${results.errors}`);
      logger.info(
        `  Success rate: ${((results.successful / (results.successful + results.failed + results.errors)) * 100).toFixed(2)}%`,
      );
      logger.info(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
      logger.info(`  Max response time: ${maxResponseTime}ms`);
      logger.info(`  Min response time: ${minResponseTime}ms`);

      // Should maintain good performance throughout
      expect(results.successful).toBeGreaterThan(0);
      expect(results.cycles).toBeGreaterThan(0);

      // Success rate should be at least 80%
      const successRate =
        results.successful / (results.successful + results.failed + results.errors);
      expect(successRate).toBeGreaterThanOrEqual(0.8);

      // Average response time should be reasonable
      expect(avgResponseTime).toBeLessThan(5000); // Under 5 seconds

      // Max response time should not be too high
      expect(maxResponseTime).toBeLessThan(30000); // Under 30 seconds
    }, 600000); // 10 minutes timeout
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory pressure gracefully', async () => {
      const initialMemory = process.memoryUsage();
      logger.info(`Initial memory usage: ${JSON.stringify(initialMemory)}`);

      const results = {
        cycles: 0,
        successful: 0,
        failed: 0,
        errors: 0,
        memorySnapshots: [] as NodeJS.MemoryUsage[],
      };

      // Create memory pressure by creating and deleting many objects
      for (let cycle = 0; cycle < 20; cycle++) {
        const promises: Promise<ApiResponse | void>[] = [];
        const quizIds: string[] = [];

        // Create many quizzes
        for (let i = 0; i < 50; i++) {
          const user = testUsers[i % testUsers.length];
          const quizData = QuizDataFactory.createQuizSet({
            title: `Memory Pressure Quiz ${cycle}-${i} - ${Date.now()}`,
          });

          promises.push(
            request(app)
              .post('/quiz')
              .set('Authorization', `Bearer ${user.accessToken}`)
              .send(quizData)
              .then((response) => {
                if (response.status < 400) {
                  results.successful++;
                  quizIds.push(response.body.id as string);
                } else {
                  results.failed++;
                }
                return response;
              })
              .catch(() => {
                results.errors++;
              }),
          );
        }

        await Promise.allSettled(promises);

        // Delete the quizzes to free memory
        for (const quizId of quizIds) {
          const user = testUsers[0];
          try {
            await request(app)
              .delete(`/quiz/${quizId}`)
              .set('Authorization', `Bearer ${user.accessToken}`)
              .expect(200);
          } catch {
            // Ignore deletion errors
          }
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Take memory snapshot
        const currentMemory = process.memoryUsage();
        results.memorySnapshots.push(currentMemory);
        results.cycles++;

        logger.info(`Memory pressure cycle ${cycle + 1}:`);
        logger.info(`  Heap used: ${currentMemory.heapUsed / 1024 / 1024}MB`);
        logger.info(`  Heap total: ${currentMemory.heapTotal / 1024 / 1024}MB`);
        logger.info(`  External: ${currentMemory.external / 1024 / 1024}MB`);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      logger.info(`Memory pressure test results:`);
      logger.info(`  Cycles completed: ${results.cycles}`);
      logger.info(`  Successful operations: ${results.successful}`);
      logger.info(`  Failed operations: ${results.failed}`);
      logger.info(`  Errors: ${results.errors}`);
      logger.info(`  Final memory usage: ${JSON.stringify(finalMemory)}`);
      logger.info(`  Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);

      // Should complete all cycles
      expect(results.cycles).toBe(20);

      // Should maintain reasonable memory usage
      expect(memoryIncreaseMB).toBeLessThan(200); // Less than 200MB increase

      // Should not have too many failures
      expect(results.failed).toBeLessThan(results.successful * 0.1); // Less than 10% failures
    }, 300000);

    it('should handle connection exhaustion gracefully', async () => {
      const startTime = Date.now();
      const promises: Promise<ApiResponse | void>[] = [];
      const results = {
        successful: 0,
        failed: 0,
        errors: 0,
        connectionErrors: 0,
      };

      // Create many concurrent connections
      for (let i = 0; i < 200; i++) {
        promises.push(
          request(app)
            .get('/health')
            .timeout(10000) // 10 second timeout
            .then((response) => {
              if (response.status < 400) results.successful++;
              else results.failed++;
              return response;
            })
            .catch((error) => {
              results.errors++;
              if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
                results.connectionErrors++;
              }
            }),
        );
      }

      await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(`Connection exhaustion test results:`);
      logger.info(`  Total requests: 200`);
      logger.info(`  Successful: ${results.successful}`);
      logger.info(`  Failed: ${results.failed}`);
      logger.info(`  Errors: ${results.errors}`);
      logger.info(`  Connection errors: ${results.connectionErrors}`);
      logger.info(`  Duration: ${duration}ms`);

      // Should handle most requests successfully
      expect(results.successful).toBeGreaterThan(150); // At least 75% success

      // Should not have too many connection errors
      expect(results.connectionErrors).toBeLessThan(50); // Less than 25% connection errors

      // Should complete within reasonable time
      expect(duration).toBeLessThan(60000); // Under 60 seconds
    }, 120000);
  });
});
