/**
 * Performance Test Configuration
 *
 * Centralized configuration for performance and stress testing.
 * Allows easy adjustment of test parameters without modifying test files.
 */

export interface PerformanceTestConfig {
  // Load Testing Configuration
  loadTesting: {
    concurrentUsers: number;
    bulkOperations: number;
    testDuration: number; // in milliseconds
    responseTimeThreshold: number; // in milliseconds
    successRateThreshold: number; // percentage (0-100)
  };

  // Stress Testing Configuration
  stressTesting: {
    maxConcurrentUsers: number;
    largeDataSetSize: number;
    extendedTestDuration: number; // in milliseconds
    memoryThreshold: number; // in MB
    connectionThreshold: number;
  };

  // Performance Monitoring Configuration
  monitoring: {
    enableMemoryMonitoring: boolean;
    enableResponseTimeMonitoring: boolean;
    enableCustomMetrics: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    exportMetrics: boolean;
    exportPath?: string;
  };

  // Rate Limiting Configuration
  rateLimiting: {
    testRequests: number;
    expectedRateLimitPercentage: number; // percentage of requests that should be rate limited
    maxFailureRate: number; // maximum acceptable failure rate
  };

  // Database Performance Configuration
  database: {
    maxResponseTime: number; // in milliseconds
    averageResponseTimeThreshold: number; // in milliseconds
    maxConcurrentOperations: number;
  };

  // Memory Testing Configuration
  memoryTesting: {
    maxMemoryIncrease: number; // in MB
    testCycles: number;
    batchSize: number;
    garbageCollectionEnabled: boolean;
  };
}

/**
 * Default performance test configuration
 */
export const defaultPerformanceConfig: PerformanceTestConfig = {
  loadTesting: {
    concurrentUsers: 10,
    bulkOperations: 50,
    testDuration: 60000, // 1 minute
    responseTimeThreshold: 5000, // 5 seconds
    successRateThreshold: 80, // 80%
  },

  stressTesting: {
    maxConcurrentUsers: 50,
    largeDataSetSize: 1000,
    extendedTestDuration: 300000, // 5 minutes
    memoryThreshold: 200, // 200MB
    connectionThreshold: 200,
  },

  monitoring: {
    enableMemoryMonitoring: true,
    enableResponseTimeMonitoring: true,
    enableCustomMetrics: true,
    logLevel: 'info',
    exportMetrics: true,
    exportPath: './test-results/performance-metrics.json',
  },

  rateLimiting: {
    testRequests: 100,
    expectedRateLimitPercentage: 10, // 10% of requests should be rate limited
    maxFailureRate: 10, // 10% maximum failure rate
  },

  database: {
    maxResponseTime: 10000, // 10 seconds
    averageResponseTimeThreshold: 2000, // 2 seconds
    maxConcurrentOperations: 20,
  },

  memoryTesting: {
    maxMemoryIncrease: 100, // 100MB
    testCycles: 5,
    batchSize: 10,
    garbageCollectionEnabled: true,
  },
};

/**
 * Development performance test configuration (lighter load)
 */
export const developmentPerformanceConfig: PerformanceTestConfig = {
  ...defaultPerformanceConfig,
  loadTesting: {
    concurrentUsers: 5,
    bulkOperations: 20,
    testDuration: 30000, // 30 seconds
    responseTimeThreshold: 10000, // 10 seconds
    successRateThreshold: 70, // 70%
  },

  stressTesting: {
    maxConcurrentUsers: 20,
    largeDataSetSize: 100,
    extendedTestDuration: 60000, // 1 minute
    memoryThreshold: 50, // 50MB
    connectionThreshold: 50,
  },

  monitoring: {
    enableMemoryMonitoring: true,
    enableResponseTimeMonitoring: true,
    enableCustomMetrics: false,
    logLevel: 'debug',
    exportMetrics: false,
  },

  rateLimiting: {
    testRequests: 20,
    expectedRateLimitPercentage: 5,
    maxFailureRate: 20,
  },

  database: {
    maxResponseTime: 15000, // 15 seconds
    averageResponseTimeThreshold: 5000, // 5 seconds
    maxConcurrentOperations: 10,
  },

  memoryTesting: {
    maxMemoryIncrease: 50, // 50MB
    testCycles: 3,
    batchSize: 5,
    garbageCollectionEnabled: true,
  },
};

/**
 * Production performance test configuration (heavier load)
 */
export const productionPerformanceConfig: PerformanceTestConfig = {
  ...defaultPerformanceConfig,
  loadTesting: {
    concurrentUsers: 100,
    bulkOperations: 500,
    testDuration: 300000, // 5 minutes
    responseTimeThreshold: 2000, // 2 seconds
    successRateThreshold: 95, // 95%
  },

  stressTesting: {
    maxConcurrentUsers: 500,
    largeDataSetSize: 10000,
    extendedTestDuration: 1800000, // 30 minutes
    memoryThreshold: 500, // 500MB
    connectionThreshold: 1000,
  },

  monitoring: {
    enableMemoryMonitoring: true,
    enableResponseTimeMonitoring: true,
    enableCustomMetrics: true,
    logLevel: 'info',
    exportMetrics: true,
    exportPath: './test-results/production-performance-metrics.json',
  },

  rateLimiting: {
    testRequests: 1000,
    expectedRateLimitPercentage: 20, // 20% of requests should be rate limited
    maxFailureRate: 5, // 5% maximum failure rate
  },

  database: {
    maxResponseTime: 5000, // 5 seconds
    averageResponseTimeThreshold: 1000, // 1 second
    maxConcurrentOperations: 100,
  },

  memoryTesting: {
    maxMemoryIncrease: 200, // 200MB
    testCycles: 10,
    batchSize: 50,
    garbageCollectionEnabled: true,
  },
};

/**
 * Get performance test configuration based on environment
 */
export function getPerformanceConfig(
  environment: 'development' | 'production' | 'default' = 'default',
): PerformanceTestConfig {
  switch (environment) {
    case 'development':
      return developmentPerformanceConfig;
    case 'production':
      return productionPerformanceConfig;
    default:
      return defaultPerformanceConfig;
  }
}

/**
 * Performance test thresholds for validation
 */
export const performanceThresholds = {
  // Load testing thresholds
  loadTesting: {
    minSuccessRate: 80,
    maxAverageResponseTime: 5000,
    maxMemoryPeak: 200 * 1024 * 1024, // 200MB
    minOperationsPerSecond: 1,
  },

  // Stress testing thresholds
  stressTesting: {
    minSuccessRate: 70,
    maxAverageResponseTime: 10000,
    maxMemoryPeak: 500 * 1024 * 1024, // 500MB
    minOperationsPerSecond: 0.5,
  },

  // Database performance thresholds
  database: {
    minSuccessRate: 90,
    maxAverageResponseTime: 2000,
    maxMemoryPeak: 100 * 1024 * 1024, // 100MB
    minOperationsPerSecond: 2,
  },

  // Memory testing thresholds
  memory: {
    maxMemoryIncrease: 100 * 1024 * 1024, // 100MB
    maxMemoryLeak: 50 * 1024 * 1024, // 50MB
  },

  // Rate limiting thresholds
  rateLimiting: {
    minSuccessRate: 60,
    maxAverageResponseTime: 15000,
    maxMemoryPeak: 300 * 1024 * 1024, // 300MB
    minOperationsPerSecond: 0.1,
  },
};

/**
 * Test environment detection
 */
export function getTestEnvironment(): 'development' | 'production' | 'default' {
  const nodeEnv = process.env.NODE_ENV;
  const testEnv = process.env.TEST_ENV;

  if (testEnv === 'production' || nodeEnv === 'production') {
    return 'production';
  }

  if (testEnv === 'development' || nodeEnv === 'development') {
    return 'development';
  }

  return 'default';
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  /**
   * Get current configuration
   */
  static getConfig(): PerformanceTestConfig {
    const environment = getTestEnvironment();
    return getPerformanceConfig(environment);
  }

  /**
   * Check if performance meets thresholds
   */
  static checkThresholds(
    testType: keyof typeof performanceThresholds,
    metrics: {
      successRate: number;
      averageResponseTime: number;
      memoryPeak: number;
      operationsPerSecond: number;
    },
  ): { passed: boolean; failures: string[] } {
    const failures: string[] = [];

    // Use switch statement to avoid dynamic property access
    switch (testType) {
      case 'loadTesting': {
        const thresholds = performanceThresholds.loadTesting;
        if (metrics.successRate < thresholds.minSuccessRate) {
          failures.push(
            `Success rate ${metrics.successRate.toFixed(2)}% is below threshold ${thresholds.minSuccessRate}%`,
          );
        }
        if (metrics.averageResponseTime > thresholds.maxAverageResponseTime) {
          failures.push(
            `Average response time ${metrics.averageResponseTime.toFixed(2)}ms exceeds threshold ${thresholds.maxAverageResponseTime}ms`,
          );
        }
        if (metrics.memoryPeak > thresholds.maxMemoryPeak) {
          failures.push(
            `Memory peak ${(metrics.memoryPeak / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryPeak / 1024 / 1024).toFixed(2)}MB`,
          );
        }
        if (metrics.operationsPerSecond < thresholds.minOperationsPerSecond) {
          failures.push(
            `Operations per second ${metrics.operationsPerSecond.toFixed(2)} is below threshold ${thresholds.minOperationsPerSecond}`,
          );
        }
        break;
      }
      case 'stressTesting': {
        const thresholds = performanceThresholds.stressTesting;
        if (metrics.successRate < thresholds.minSuccessRate) {
          failures.push(
            `Success rate ${metrics.successRate.toFixed(2)}% is below threshold ${thresholds.minSuccessRate}%`,
          );
        }
        if (metrics.averageResponseTime > thresholds.maxAverageResponseTime) {
          failures.push(
            `Average response time ${metrics.averageResponseTime.toFixed(2)}ms exceeds threshold ${thresholds.maxAverageResponseTime}ms`,
          );
        }
        if (metrics.memoryPeak > thresholds.maxMemoryPeak) {
          failures.push(
            `Memory peak ${(metrics.memoryPeak / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryPeak / 1024 / 1024).toFixed(2)}MB`,
          );
        }
        if (metrics.operationsPerSecond < thresholds.minOperationsPerSecond) {
          failures.push(
            `Operations per second ${metrics.operationsPerSecond.toFixed(2)} is below threshold ${thresholds.minOperationsPerSecond}`,
          );
        }
        break;
      }
      case 'database': {
        const thresholds = performanceThresholds.database;
        if (metrics.successRate < thresholds.minSuccessRate) {
          failures.push(
            `Success rate ${metrics.successRate.toFixed(2)}% is below threshold ${thresholds.minSuccessRate}%`,
          );
        }
        if (metrics.averageResponseTime > thresholds.maxAverageResponseTime) {
          failures.push(
            `Average response time ${metrics.averageResponseTime.toFixed(2)}ms exceeds threshold ${thresholds.maxAverageResponseTime}ms`,
          );
        }
        if (metrics.memoryPeak > thresholds.maxMemoryPeak) {
          failures.push(
            `Memory peak ${(metrics.memoryPeak / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryPeak / 1024 / 1024).toFixed(2)}MB`,
          );
        }
        if (metrics.operationsPerSecond < thresholds.minOperationsPerSecond) {
          failures.push(
            `Operations per second ${metrics.operationsPerSecond.toFixed(2)} is below threshold ${thresholds.minOperationsPerSecond}`,
          );
        }
        break;
      }
      case 'memory': {
        const thresholds = performanceThresholds.memory;
        if (metrics.memoryPeak > thresholds.maxMemoryIncrease) {
          failures.push(
            `Memory peak ${(metrics.memoryPeak / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB`,
          );
        }
        break;
      }
      case 'rateLimiting': {
        const thresholds = performanceThresholds.rateLimiting;
        if (metrics.successRate < thresholds.minSuccessRate) {
          failures.push(
            `Success rate ${metrics.successRate.toFixed(2)}% is below threshold ${thresholds.minSuccessRate}%`,
          );
        }
        if (metrics.averageResponseTime > thresholds.maxAverageResponseTime) {
          failures.push(
            `Average response time ${metrics.averageResponseTime.toFixed(2)}ms exceeds threshold ${thresholds.maxAverageResponseTime}ms`,
          );
        }
        if (metrics.memoryPeak > thresholds.maxMemoryPeak) {
          failures.push(
            `Memory peak ${(metrics.memoryPeak / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryPeak / 1024 / 1024).toFixed(2)}MB`,
          );
        }
        if (metrics.operationsPerSecond < thresholds.minOperationsPerSecond) {
          failures.push(
            `Operations per second ${metrics.operationsPerSecond.toFixed(2)} is below threshold ${thresholds.minOperationsPerSecond}`,
          );
        }
        break;
      }
      default:
        throw new Error(`Invalid test type: ${testType}`);
    }

    return {
      passed: failures.length === 0,
      failures,
    };
  }

  /**
   * Generate test data based on configuration
   */
  static generateTestData(config: PerformanceTestConfig) {
    return {
      concurrentUsers: config.loadTesting.concurrentUsers,
      bulkOperations: config.loadTesting.bulkOperations,
      maxConcurrentUsers: config.stressTesting.maxConcurrentUsers,
      largeDataSetSize: config.stressTesting.largeDataSetSize,
      testDuration: config.loadTesting.testDuration,
      extendedTestDuration: config.stressTesting.extendedTestDuration,
    };
  }

  /**
   * Format performance metrics for logging
   */
  static formatMetrics(metrics: {
    successRate: number;
    averageResponseTime: number;
    memoryPeak: number;
    operationsPerSecond: number;
  }): string {
    return [
      `Success Rate: ${metrics.successRate.toFixed(2)}%`,
      `Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`,
      `Memory Peak: ${(metrics.memoryPeak / 1024 / 1024).toFixed(2)}MB`,
      `Operations/Second: ${metrics.operationsPerSecond.toFixed(2)}`,
    ].join(' | ');
  }
}
