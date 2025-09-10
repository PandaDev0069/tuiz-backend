/**
 * Test Utilities
 *
 * Provides common utilities and helpers for testing.
 * Includes request helpers, assertion utilities, and test data management.
 */

import request from 'supertest';
import type { Express } from 'express';
import type { TestDatabase } from './testDatabase';
import type { TestAuth } from './testAuth';
import { logger } from '../../src/utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TestResponse {
  status: number;
  body: Record<string, unknown>;
}

// ============================================================================
// REQUEST HELPERS
// ============================================================================

export class TestRequestHelper {
  private app: Express;
  private testAuth: TestAuth;

  constructor(app: Express, testAuth: TestAuth) {
    this.app = app;
    this.testAuth = testAuth;
  }

  /**
   * Make an authenticated request
   */
  async authenticatedRequest(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    endpoint: string,
    userId: string,
    data?: Record<string, unknown>,
  ) {
    const authHeader = await this.testAuth.getAuthHeader(userId);

    let req = request(this.app)[method](endpoint).set(authHeader);
    
    if (data) {
      if (method === 'get') {
        req = req.query(data as Record<string, string>);
      } else {
        req = req.send(data);
      }
    }

    return req;
  }

  /**
   * Make an unauthenticated request
   */
  unauthenticatedRequest(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    endpoint: string,
    data?: Record<string, unknown>,
  ) {
    let req = request(this.app)[method](endpoint);
    
    if (data) {
      if (method === 'get') {
        req = req.query(data as Record<string, string>);
      } else {
        req = req.send(data);
      }
    }

    return req;
  }

  /**
   * Make a request with custom headers
   */
  customRequest(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    endpoint: string,
    headers: Record<string, string>,
    data?: Record<string, unknown>,
  ) {
    let req = request(this.app)[method](endpoint).set(headers);
    
    if (data) {
      if (method === 'get') {
        req = req.query(data as Record<string, string>);
      } else {
        req = req.send(data);
      }
    }

    return req;
  }
}

// ============================================================================
// ASSERTION UTILITIES
// ============================================================================

export class TestAssertions {
  /**
   * Assert that a response has the expected status code
   */
  static expectStatus(response: TestResponse, expectedStatus: number): void {
    if (response.status !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, but got ${response.status}. ` +
          `Response body: ${JSON.stringify(response.body, null, 2)}`,
      );
    }
  }

  /**
   * Assert that a response has a success status (2xx)
   */
  static expectSuccess(response: TestResponse): void {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Expected success status (2xx), but got ${response.status}. ` +
          `Response body: ${JSON.stringify(response.body, null, 2)}`,
      );
    }
  }

  /**
   * Assert that a response has an error status (4xx or 5xx)
   */
  static expectError(response: TestResponse): void {
    if (response.status < 400) {
      throw new Error(
        `Expected error status (4xx or 5xx), but got ${response.status}. ` +
          `Response body: ${JSON.stringify(response.body, null, 2)}`,
      );
    }
  }

  /**
   * Assert that a response has the expected structure
   */
  static expectStructure(response: TestResponse, expectedStructure: Record<string, string>): void {
    const body = response.body;

    for (const [key, expectedType] of Object.entries(expectedStructure)) {
      if (!(key in body)) {
        throw new Error(`Expected property '${key}' not found in response`);
      }

      const actualType = typeof body[key];
      if (actualType !== expectedType) {
        throw new Error(
          `Expected property '${key}' to be of type '${expectedType}', but got '${actualType}'`,
        );
      }
    }
  }

  /**
   * Assert that a response contains specific data
   */
  static expectContains(response: TestResponse, expectedData: Record<string, unknown>): void {
    const body = response.body;

    for (const [key, expectedValue] of Object.entries(expectedData)) {
      if (!(key in body)) {
        throw new Error(`Expected property '${key}' not found in response`);
      }

      if (body[key] !== expectedValue) {
        throw new Error(
          `Expected property '${key}' to be '${expectedValue}', but got '${body[key]}'`,
        );
      }
    }
  }

  /**
   * Assert that a response has pagination structure
   */
  static expectPagination(response: TestResponse): void {
    const body = response.body;

    if (!body.data || !Array.isArray(body.data)) {
      throw new Error('Expected paginated response with data array');
    }

    if (typeof body.total !== 'number') {
      throw new Error('Expected paginated response with total count');
    }

    if (typeof body.page !== 'number') {
      throw new Error('Expected paginated response with page number');
    }

    if (typeof body.limit !== 'number') {
      throw new Error('Expected paginated response with limit');
    }
  }

  /**
   * Assert that a response has error structure
   */
  static expectErrorStructure(response: TestResponse): void {
    const body = response.body;

    if (!body.error) {
      throw new Error('Expected error response with error property');
    }

    if (typeof body.error !== 'string') {
      throw new Error('Expected error property to be a string');
    }
  }

  /**
   * Assert that a response has validation error structure
   */
  static expectValidationError(response: TestResponse): void {
    this.expectErrorStructure(response);

    const body = response.body;
    if (!body.details || !Array.isArray(body.details)) {
      throw new Error('Expected validation error with details array');
    }
  }
}

// ============================================================================
// TEST DATA MANAGEMENT
// ============================================================================

export class TestDataManager {
  private testDatabase: TestDatabase;
  private testAuth: TestAuth;
  private createdData: {
    users: string[];
    quizzes: string[];
    questions: string[];
    answers: string[];
  } = {
    users: [],
    quizzes: [],
    questions: [],
    answers: [],
  };

  constructor(testDatabase: TestDatabase, testAuth: TestAuth) {
    this.testDatabase = testDatabase;
    this.testAuth = testAuth;
  }

  /**
   * Track created data for cleanup
   */
  trackUser(userId: string): void {
    this.createdData.users.push(userId);
  }

  trackQuiz(quizId: string): void {
    this.createdData.quizzes.push(quizId);
  }

  trackQuestion(questionId: string): void {
    this.createdData.questions.push(questionId);
  }

  trackAnswer(answerId: string): void {
    this.createdData.answers.push(answerId);
  }

  /**
   * Clean up all tracked data
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up in reverse order of dependencies
      await this.cleanupAnswers();
      await this.cleanupQuestions();
      await this.cleanupQuizzes();
      await this.cleanupUsers();
    } catch (error) {
      logger.warn('Failed to cleanup test data:', error);
    }
  }

  private async cleanupAnswers(): Promise<void> {
    for (const answerId of this.createdData.answers) {
      try {
        await this.testDatabase.admin.from('answers').delete().eq('id', answerId);
      } catch (error) {
        logger.warn(`Failed to cleanup answer ${answerId}:`, error);
      }
    }
    this.createdData.answers = [];
  }

  private async cleanupQuestions(): Promise<void> {
    for (const questionId of this.createdData.questions) {
      try {
        await this.testDatabase.admin.from('questions').delete().eq('id', questionId);
      } catch (error) {
        logger.warn(`Failed to cleanup question ${questionId}:`, error);
      }
    }
    this.createdData.questions = [];
  }

  private async cleanupQuizzes(): Promise<void> {
    for (const quizId of this.createdData.quizzes) {
      try {
        await this.testDatabase.admin.from('quiz_sets').delete().eq('id', quizId);
      } catch (error) {
        logger.warn(`Failed to cleanup quiz ${quizId}:`, error);
      }
    }
    this.createdData.quizzes = [];
  }

  private async cleanupUsers(): Promise<void> {
    for (const userId of this.createdData.users) {
      try {
        await this.testAuth.deleteTestUser(userId);
      } catch (error) {
        logger.warn(`Failed to cleanup user ${userId}:`, error);
      }
    }
    this.createdData.users = [];
  }
}

// ============================================================================
// TEST ENVIRONMENT HELPERS
// ============================================================================

export class TestEnvironmentHelper {
  /**
   * Check if we're running in a test environment
   */
  static isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  /**
   * Check if we're running in CI
   */
  static isCI(): boolean {
    return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  }

  /**
   * Get test timeout based on environment
   */
  static getTestTimeout(): number {
    if (this.isCI()) {
      return 10000; // 10 seconds for CI
    }
    return 30000; // 30 seconds for local
  }

  /**
   * Get test retry count based on environment
   */
  static getTestRetries(): number {
    if (this.isCI()) {
      return 1; // 1 retry for CI
    }
    return 0; // No retries for local
  }

  /**
   * Log test information
   */
  static logTestInfo(testName: string): void {
    if (this.isTestEnvironment()) {
      logger.info(`Test: ${testName}`);
    }
  }

  /**
   * Log test error
   */
  static logTestError(testName: string): void {
    logger.error(`Test Error: ${testName}`);
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

export class ResponseHelper {
  /**
   * Extract data from a successful response
   */
  static extractData(response: TestResponse): unknown {
    if (response.body.data) {
      return response.body.data;
    }
    return response.body;
  }

  /**
   * Extract error message from an error response
   */
  static extractError(response: TestResponse): string {
    if (typeof response.body.error === 'string') {
      return response.body.error;
    }
    if (typeof response.body.message === 'string') {
      return response.body.message;
    }
    return 'Unknown error';
  }

  /**
   * Extract validation errors from a validation error response
   */
  static extractValidationErrors(response: TestResponse): string[] {
    if (response.body.details && Array.isArray(response.body.details)) {
      return response.body.details;
    }
    return [];
  }

  /**
   * Check if response is a success
   */
  static isSuccess(response: TestResponse): boolean {
    return response.status >= 200 && response.status < 300;
  }

  /**
   * Check if response is an error
   */
  static isError(response: TestResponse): boolean {
    return response.status >= 400;
  }

  /**
   * Check if response is a validation error
   */
  static isValidationError(response: TestResponse): boolean {
    return response.status === 400 && Array.isArray(response.body.details);
  }

  /**
   * Check if response is an authentication error
   */
  static isAuthError(response: TestResponse): boolean {
    return response.status === 401;
  }

  /**
   * Check if response is an authorization error
   */
  static isAuthorizationError(response: TestResponse): boolean {
    return response.status === 403;
  }

  /**
   * Check if response is a not found error
   */
  static isNotFoundError(response: TestResponse): boolean {
    return response.status === 404;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random number between min and max
 */
export function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random string of specified length
 */
export function randomString(length: number = 8): string {
  return Math.random().toString(36).substr(2, length);
}

/**
 * Generate a random email
 */
export function randomEmail(domain: string = 'example.com'): string {
  return `test-${randomString()}-${Date.now()}@${domain}`;
}

/**
 * Generate a random UUID-like string
 */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if two objects are deeply equal
 */
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Create a test context object
 */
export function createTestContext(
  testDatabase: TestDatabase,
  testAuth: TestAuth,
  testDataManager: TestDataManager,
) {
  return {
    db: testDatabase,
    auth: testAuth,
    data: testDataManager,
    request: new TestRequestHelper(global.app, testAuth),
    assertions: TestAssertions,
    response: ResponseHelper,
    environment: TestEnvironmentHelper,
  };
}

// Global app reference (will be set by test setup)
declare global {
  var app: Express;
}
