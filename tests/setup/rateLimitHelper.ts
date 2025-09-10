/**
 * Rate Limit Helper
 *
 * Handles Supabase rate limiting for the free plan by implementing
 * intelligent delays, user pooling, and test optimization strategies.
 */

import { logger } from '../../src/utils/logger';

// Rate limit configuration for Supabase free plan
const RATE_LIMITS = {
  // Auth API limits (per minute)
  AUTH_REQUESTS_PER_MINUTE: 10,
  USER_CREATION_PER_MINUTE: 5,

  // Database limits
  DATABASE_REQUESTS_PER_MINUTE: 20,

  // Delays between operations (in milliseconds)
  DELAY_BETWEEN_USER_CREATION: 2000, // 2 seconds
  DELAY_BETWEEN_AUTH_REQUESTS: 1000, // 1 second
  DELAY_BETWEEN_DATABASE_REQUESTS: 500, // 0.5 seconds

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000, // 5 seconds
};

export class RateLimitHelper {
  private static requestCounts = {
    auth: 0,
    userCreation: 0,
    database: 0,
  };

  private static lastResetTime = Date.now();
  private static userPool: string[] = [];
  private static maxPoolSize = 3; // Keep only 3 users in pool for free plan

  /**
   * Reset counters every minute
   */
  private static resetCountersIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastResetTime >= 60000) {
      // 1 minute
      this.requestCounts = { auth: 0, userCreation: 0, database: 0 };
      this.lastResetTime = now;
      logger.debug('Rate limit counters reset');
    }
  }

  /**
   * Check if we can make an auth request
   */
  static canMakeAuthRequest(): boolean {
    this.resetCountersIfNeeded();
    return this.requestCounts.auth < RATE_LIMITS.AUTH_REQUESTS_PER_MINUTE;
  }

  /**
   * Check if we can create a new user
   */
  static canCreateUser(): boolean {
    this.resetCountersIfNeeded();
    return this.requestCounts.userCreation < RATE_LIMITS.USER_CREATION_PER_MINUTE;
  }

  /**
   * Check if we can make a database request
   */
  static canMakeDatabaseRequest(): boolean {
    this.resetCountersIfNeeded();
    return this.requestCounts.database < RATE_LIMITS.DATABASE_REQUESTS_PER_MINUTE;
  }

  /**
   * Record an auth request
   */
  static recordAuthRequest(): void {
    this.resetCountersIfNeeded();
    this.requestCounts.auth++;
  }

  /**
   * Record a user creation
   */
  static recordUserCreation(): void {
    this.resetCountersIfNeeded();
    this.requestCounts.userCreation++;
  }

  /**
   * Record a database request
   */
  static recordDatabaseRequest(): void {
    this.resetCountersIfNeeded();
    this.requestCounts.database++;
  }

  /**
   * Get delay needed before next operation
   */
  static getDelayForOperation(operation: 'auth' | 'userCreation' | 'database'): number {
    this.resetCountersIfNeeded();

    switch (operation) {
      case 'userCreation':
        return RATE_LIMITS.DELAY_BETWEEN_USER_CREATION;
      case 'auth':
        return RATE_LIMITS.DELAY_BETWEEN_AUTH_REQUESTS;
      case 'database':
        return RATE_LIMITS.DELAY_BETWEEN_DATABASE_REQUESTS;
      default:
        return 1000;
    }
  }

  /**
   * Wait for rate limit reset
   */
  static async waitForRateLimitReset(
    operation: 'auth' | 'userCreation' | 'database',
  ): Promise<void> {
    const delay = this.getDelayForOperation(operation);
    logger.debug(`Waiting ${delay}ms for rate limit reset (${operation})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Execute operation with rate limiting
   */
  static async executeWithRateLimit<T>(
    operation: 'auth' | 'userCreation' | 'database',
    fn: () => Promise<T>,
    retryCount = 0,
  ): Promise<T> {
    try {
      // Check if we can proceed
      if (operation === 'auth' && !this.canMakeAuthRequest()) {
        await this.waitForRateLimitReset('auth');
      } else if (operation === 'userCreation' && !this.canCreateUser()) {
        await this.waitForRateLimitReset('userCreation');
      } else if (operation === 'database' && !this.canMakeDatabaseRequest()) {
        await this.waitForRateLimitReset('database');
      }

      // Execute the function
      const result = await fn();

      // Record the operation
      if (operation === 'auth') {
        this.recordAuthRequest();
      } else if (operation === 'userCreation') {
        this.recordUserCreation();
      } else if (operation === 'database') {
        this.recordDatabaseRequest();
      }

      return result;
    } catch (error) {
      // Check if it's a rate limit error
      if (this.isRateLimitError(error) && retryCount < RATE_LIMITS.MAX_RETRIES) {
        logger.warn(
          `Rate limit hit, retrying in ${RATE_LIMITS.RETRY_DELAY}ms (attempt ${retryCount + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMITS.RETRY_DELAY));
        return this.executeWithRateLimit(operation, fn, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is rate limit related
   */
  private static isRateLimitError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage = (error as { message?: string }).message?.toLowerCase() || '';
    const errorCode = (error as { code?: string }).code?.toLowerCase() || '';

    return (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorCode.includes('rate_limit') ||
      errorCode.includes('429') ||
      (error as { status?: number }).status === 429
    );
  }

  /**
   * Add user to pool for reuse
   */
  static addUserToPool(userId: string): void {
    if (this.userPool.length < this.maxPoolSize) {
      this.userPool.push(userId);
      logger.debug(`Added user ${userId} to pool (${this.userPool.length}/${this.maxPoolSize})`);
    }
  }

  /**
   * Get user from pool for reuse
   */
  static getUserFromPool(): string | null {
    if (this.userPool.length > 0) {
      const userId = this.userPool.shift()!;
      logger.debug(`Reusing user ${userId} from pool (${this.userPool.length} remaining)`);
      return userId;
    }
    return null;
  }

  /**
   * Clear user pool
   */
  static clearUserPool(): void {
    this.userPool = [];
    logger.debug('User pool cleared');
  }

  /**
   * Get current rate limit status
   */
  static getStatus(): {
    auth: { current: number; limit: number; canProceed: boolean };
    userCreation: { current: number; limit: number; canProceed: boolean };
    database: { current: number; limit: number; canProceed: boolean };
    userPool: { current: number; max: number };
  } {
    this.resetCountersIfNeeded();

    return {
      auth: {
        current: this.requestCounts.auth,
        limit: RATE_LIMITS.AUTH_REQUESTS_PER_MINUTE,
        canProceed: this.canMakeAuthRequest(),
      },
      userCreation: {
        current: this.requestCounts.userCreation,
        limit: RATE_LIMITS.USER_CREATION_PER_MINUTE,
        canProceed: this.canCreateUser(),
      },
      database: {
        current: this.requestCounts.database,
        limit: RATE_LIMITS.DATABASE_REQUESTS_PER_MINUTE,
        canProceed: this.canMakeDatabaseRequest(),
      },
      userPool: {
        current: this.userPool.length,
        max: this.maxPoolSize,
      },
    };
  }

  /**
   * Wait for all rate limits to reset
   */
  static async waitForAllRateLimitsReset(): Promise<void> {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;
    const timeToWait = Math.max(0, Math.min(5000, 60000 - timeSinceReset)); // Wait max 5 seconds for tests

    if (timeToWait > 0) {
      logger.debug(`Waiting ${timeToWait}ms for all rate limits to reset`);
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
    }

    this.resetCountersIfNeeded();
  }
}

/**
 * Test optimization strategies for rate-limited environments
 */
export class TestOptimization {
  /**
   * Batch operations to reduce API calls
   */
  static async batchOperations<T>(operations: (() => Promise<T>)[], batchSize = 3): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((op) => op()));
      results.push(...batchResults);

      // Add delay between batches
      if (i + batchSize < operations.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Use mock data when possible to avoid API calls
   */
  static shouldUseMockData(testType: 'unit' | 'integration' | 'e2e'): boolean {
    // Use mocks for unit tests, real data for integration/e2e
    return testType === 'unit';
  }

  /**
   * Prioritize tests by importance to run critical tests first
   */
  static getTestPriority(testName: string): number {
    const criticalTests = ['auth', 'login', 'register', 'logout'];
    const importantTests = ['validation', 'error', 'security'];

    if (criticalTests.some((test) => testName.toLowerCase().includes(test))) {
      return 1; // Highest priority
    }
    if (importantTests.some((test) => testName.toLowerCase().includes(test))) {
      return 2; // High priority
    }
    return 3; // Normal priority
  }
}
