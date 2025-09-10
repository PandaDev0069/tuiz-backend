/**
 * Test Configuration for Supabase Free Plan
 *
 * Optimized configuration to work within Supabase free plan limits.
 * Includes rate limiting, test prioritization, and resource management.
 */

export const TEST_CONFIG = {
  // Rate limiting configuration
  RATE_LIMITS: {
    // Supabase free plan limits (conservative estimates)
    AUTH_REQUESTS_PER_MINUTE: 8, // Conservative limit
    USER_CREATION_PER_MINUTE: 3, // Very conservative limit
    DATABASE_REQUESTS_PER_MINUTE: 15, // Conservative limit

    // Delays between operations (milliseconds)
    DELAY_BETWEEN_USER_CREATION: 3000, // 3 seconds
    DELAY_BETWEEN_AUTH_REQUESTS: 1500, // 1.5 seconds
    DELAY_BETWEEN_DATABASE_REQUESTS: 1000, // 1 second

    // Retry configuration
    MAX_RETRIES: 2,
    RETRY_DELAY: 10000, // 10 seconds
  },

  // Test execution configuration
  EXECUTION: {
    // Maximum number of users to create per test suite
    MAX_USERS_PER_SUITE: 2,

    // Maximum number of quizzes to create per test suite
    MAX_QUIZZES_PER_SUITE: 3,

    // Test timeout (increased for rate limiting)
    TEST_TIMEOUT: 30000, // 30 seconds

    // Suite timeout
    SUITE_TIMEOUT: 300000, // 5 minutes
  },

  // Test prioritization
  PRIORITY: {
    // Critical tests that must run first
    CRITICAL: ['auth-login', 'auth-register', 'auth-logout', 'quiz-create', 'quiz-read'],

    // Important tests that should run if possible
    IMPORTANT: ['quiz-update', 'question-create', 'validation', 'error-handling'],

    // Nice-to-have tests that can be skipped if needed
    OPTIONAL: ['quiz-delete', 'question-update', 'answer-management', 'publishing'],
  },

  // Resource management
  RESOURCES: {
    // Enable user pooling to reuse users across tests
    ENABLE_USER_POOLING: true,

    // Maximum users to keep in pool
    MAX_POOL_SIZE: 2,

    // Enable test data cleanup
    ENABLE_CLEANUP: true,

    // Cleanup delay (to avoid hitting rate limits)
    CLEANUP_DELAY: 5000, // 5 seconds
  },

  // Environment detection
  ENVIRONMENT: {
    // Detect if running in CI/CD
    IS_CI: process.env.CI === 'true',

    // Detect if running in development
    IS_DEV: process.env.NODE_ENV === 'development',

    // Detect if running in test mode
    IS_TEST: process.env.NODE_ENV === 'test',
  },

  // Logging configuration
  LOGGING: {
    // Enable detailed logging
    ENABLE_DEBUG: process.env.TEST_DEBUG === 'true',

    // Log rate limit status
    LOG_RATE_LIMITS: true,

    // Log test execution time
    LOG_EXECUTION_TIME: true,
  },
};

/**
 * Get optimized test configuration based on environment
 */
export function getOptimizedConfig() {
  const config = { ...TEST_CONFIG };

  // Adjust for CI environment
  if (config.ENVIRONMENT.IS_CI) {
    config.RATE_LIMITS.AUTH_REQUESTS_PER_MINUTE = 5;
    config.RATE_LIMITS.USER_CREATION_PER_MINUTE = 2;
    config.RATE_LIMITS.DATABASE_REQUESTS_PER_MINUTE = 10;

    config.EXECUTION.MAX_USERS_PER_SUITE = 1;
    config.EXECUTION.MAX_QUIZZES_PER_SUITE = 2;

    config.RESOURCES.MAX_POOL_SIZE = 1;
  }

  // Adjust for development environment
  if (config.ENVIRONMENT.IS_DEV) {
    config.RATE_LIMITS.DELAY_BETWEEN_USER_CREATION = 2000;
    config.RATE_LIMITS.DELAY_BETWEEN_AUTH_REQUESTS = 1000;
    config.RATE_LIMITS.DELAY_BETWEEN_DATABASE_REQUESTS = 500;
  }

  return config;
}

/**
 * Check if test should run based on current rate limits
 */
export function shouldRunTest(
  testName: string,
  currentRateLimits: {
    userCreation: { canProceed: boolean };
    database: { canProceed: boolean };
    auth: { canProceed: boolean };
  },
): boolean {
  const config = getOptimizedConfig();

  // Always run critical tests
  if (config.PRIORITY.CRITICAL.some((critical) => testName.includes(critical))) {
    return true;
  }

  // Run important tests if rate limits allow
  if (config.PRIORITY.IMPORTANT.some((important) => testName.includes(important))) {
    return currentRateLimits.userCreation.canProceed || currentRateLimits.database.canProceed;
  }

  // Run optional tests only if all rate limits are clear
  if (config.PRIORITY.OPTIONAL.some((optional) => testName.includes(optional))) {
    return (
      currentRateLimits.userCreation.canProceed &&
      currentRateLimits.database.canProceed &&
      currentRateLimits.auth.canProceed
    );
  }

  return true;
}

/**
 * Get test execution order based on priority
 */
export function getTestExecutionOrder(tests: string[]): string[] {
  const config = getOptimizedConfig();

  return tests.sort((a, b) => {
    const aPriority = getTestPriority(a, config);
    const bPriority = getTestPriority(b, config);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // If same priority, sort alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Get test priority (1 = highest, 3 = lowest)
 */
function getTestPriority(testName: string, config: typeof TEST_CONFIG): number {
  if (config.PRIORITY.CRITICAL.some((critical: string) => testName.includes(critical))) {
    return 1;
  }
  if (config.PRIORITY.IMPORTANT.some((important: string) => testName.includes(important))) {
    return 2;
  }
  if (config.PRIORITY.OPTIONAL.some((optional: string) => testName.includes(optional))) {
    return 3;
  }
  return 2; // Default to important
}

/**
 * Get delay for test execution based on current rate limits
 */
export function getTestDelay(currentRateLimits: {
  userCreation: { canProceed: boolean };
  auth: { canProceed: boolean };
  database: { canProceed: boolean };
}): number {
  const config = getOptimizedConfig();

  if (!currentRateLimits.userCreation.canProceed) {
    return config.RATE_LIMITS.DELAY_BETWEEN_USER_CREATION;
  }
  if (!currentRateLimits.auth.canProceed) {
    return config.RATE_LIMITS.DELAY_BETWEEN_AUTH_REQUESTS;
  }
  if (!currentRateLimits.database.canProceed) {
    return config.RATE_LIMITS.DELAY_BETWEEN_DATABASE_REQUESTS;
  }

  return 0;
}
