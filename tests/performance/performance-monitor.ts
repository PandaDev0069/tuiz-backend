/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for monitoring and collecting performance metrics
 * during load and stress testing.
 */

import { logger } from '../../src/utils/logger';

export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  memoryUsage?: NodeJS.MemoryUsage;
  customMetrics?: Record<string, number>;
}

export interface PerformanceSummary {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
  operationsPerSecond: number;
  memoryPeak: number;
  memoryAverage: number;
  customMetrics: Record<string, number>;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private isMonitoring: boolean = false;

  /**
   * Start monitoring performance
   */
  startMonitoring(): void {
    this.metrics = [];
    this.startTime = Date.now();
    this.isMonitoring = true;
    logger.info('Performance monitoring started');
  }

  /**
   * Stop monitoring performance
   */
  stopMonitoring(): void {
    this.endTime = Date.now();
    this.isMonitoring = false;
    logger.info('Performance monitoring stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    metric: Omit<PerformanceMetrics, 'startTime' | 'endTime' | 'duration'> & {
      startTime: number;
      endTime: number;
    },
  ): void {
    if (!this.isMonitoring) {
      logger.warn('Performance monitoring is not active');
      return;
    }

    const duration = metric.endTime - metric.startTime;
    const fullMetric: PerformanceMetrics = {
      ...metric,
      duration,
      memoryUsage: process.memoryUsage(),
    };

    this.metrics.push(fullMetric);
    logger.debug(`Recorded metric: ${metric.operationName} (${duration}ms)`);
  }

  /**
   * Record a successful operation
   */
  recordSuccess(
    operationName: string,
    startTime: number,
    endTime: number,
    customMetrics?: Record<string, number>,
  ): void {
    this.recordMetric({
      operationName,
      startTime,
      endTime,
      success: true,
      customMetrics,
    });
  }

  /**
   * Record a failed operation
   */
  recordFailure(
    operationName: string,
    startTime: number,
    endTime: number,
    error: string,
    customMetrics?: Record<string, number>,
  ): void {
    this.recordMetric({
      operationName,
      startTime,
      endTime,
      success: false,
      error,
      customMetrics,
    });
  }

  /**
   * Get performance summary
   */
  getSummary(): PerformanceSummary {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        totalDuration: this.endTime - this.startTime,
        operationsPerSecond: 0,
        memoryPeak: 0,
        memoryAverage: 0,
        customMetrics: {},
      };
    }

    const successful = this.metrics.filter((m) => m.success);
    const failed = this.metrics.filter((m) => !m.success);
    const durations = this.metrics.map((m) => m.duration);
    const memoryUsages = this.metrics.map((m) => m.memoryUsage?.heapUsed || 0);

    const totalDuration = this.endTime - this.startTime;
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const successRate = (successful.length / this.metrics.length) * 100;
    const operationsPerSecond = (this.metrics.length / totalDuration) * 1000;

    // Calculate memory metrics
    const memoryPeak = Math.max(...memoryUsages);
    const memoryAverage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;

    // Calculate custom metrics averages
    const customMetrics: Record<string, number> = {};
    const customMetricKeys = new Set<string>();

    this.metrics.forEach((metric) => {
      if (metric.customMetrics) {
        Object.keys(metric.customMetrics).forEach((key) => {
          customMetricKeys.add(key);
        });
      }
    });

    // Use Map for safe key-value operations to avoid injection
    const customMetricsMap = new Map<string, number>();

    customMetricKeys.forEach((key) => {
      // Validate key to prevent injection
      if (typeof key !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        return; // Skip invalid keys
      }

      const values = this.metrics
        .filter(
          (m) => m.customMetrics && Object.prototype.hasOwnProperty.call(m.customMetrics, key),
        )
        .map((m) => {
          const customMetrics = m.customMetrics;
          // Safe property access using Object.entries to avoid injection
          const entries = Object.entries(customMetrics || {});
          const entry = entries.find(([k]) => k === key);
          return entry ? entry[1] : 0;
        });

      if (values.length > 0) {
        // Use Map.set for safe property assignment
        customMetricsMap.set(key, values.reduce((a, b) => a + b, 0) / values.length);
      }
    });

    // Convert Map back to object using Object.assign to avoid injection
    const customMetricsObj = Object.fromEntries(customMetricsMap);
    Object.assign(customMetrics, customMetricsObj);

    return {
      totalOperations: this.metrics.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      successRate,
      averageDuration,
      minDuration,
      maxDuration,
      totalDuration,
      operationsPerSecond,
      memoryPeak,
      memoryAverage,
      customMetrics,
    };
  }

  /**
   * Get detailed metrics for analysis
   */
  getDetailedMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific operation
   */
  getMetricsForOperation(operationName: string): PerformanceMetrics[] {
    return this.metrics.filter((m) => m.operationName === operationName);
  }

  /**
   * Get metrics within a time range
   */
  getMetricsInTimeRange(startTime: number, endTime: number): PerformanceMetrics[] {
    return this.metrics.filter((m) => m.startTime >= startTime && m.endTime <= endTime);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    logger.info('Performance metrics cleared');
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        summary: this.getSummary(),
        metrics: this.getDetailedMetrics(),
        monitoringPeriod: {
          start: this.startTime,
          end: this.endTime,
          duration: this.endTime - this.startTime,
        },
      },
      null,
      2,
    );
  }

  /**
   * Log performance summary
   */
  logSummary(): void {
    const summary = this.getSummary();

    logger.info('=== Performance Summary ===');
    logger.info(`Total Operations: ${summary.totalOperations}`);
    logger.info(`Successful: ${summary.successfulOperations}`);
    logger.info(`Failed: ${summary.failedOperations}`);
    logger.info(`Success Rate: ${summary.successRate.toFixed(2)}%`);
    logger.info(`Average Duration: ${summary.averageDuration.toFixed(2)}ms`);
    logger.info(`Min Duration: ${summary.minDuration}ms`);
    logger.info(`Max Duration: ${summary.maxDuration}ms`);
    logger.info(`Total Duration: ${summary.totalDuration}ms`);
    logger.info(`Operations/Second: ${summary.operationsPerSecond.toFixed(2)}`);
    logger.info(`Memory Peak: ${(summary.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
    logger.info(`Memory Average: ${(summary.memoryAverage / 1024 / 1024).toFixed(2)}MB`);

    if (Object.keys(summary.customMetrics).length > 0) {
      logger.info('Custom Metrics:');
      Object.entries(summary.customMetrics).forEach(([key, value]) => {
        logger.info(`  ${key}: ${value.toFixed(2)}`);
      });
    }

    logger.info('========================');
  }

  /**
   * Check if performance meets thresholds
   */
  checkThresholds(thresholds: {
    minSuccessRate?: number;
    maxAverageDuration?: number;
    maxMemoryPeak?: number;
    minOperationsPerSecond?: number;
  }): { passed: boolean; failures: string[] } {
    const summary = this.getSummary();
    const failures: string[] = [];

    if (thresholds.minSuccessRate && summary.successRate < thresholds.minSuccessRate) {
      failures.push(
        `Success rate ${summary.successRate.toFixed(2)}% is below threshold ${thresholds.minSuccessRate}%`,
      );
    }

    if (thresholds.maxAverageDuration && summary.averageDuration > thresholds.maxAverageDuration) {
      failures.push(
        `Average duration ${summary.averageDuration.toFixed(2)}ms exceeds threshold ${thresholds.maxAverageDuration}ms`,
      );
    }

    if (thresholds.maxMemoryPeak && summary.memoryPeak > thresholds.maxMemoryPeak) {
      failures.push(
        `Memory peak ${(summary.memoryPeak / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryPeak / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    if (
      thresholds.minOperationsPerSecond &&
      summary.operationsPerSecond < thresholds.minOperationsPerSecond
    ) {
      failures.push(
        `Operations per second ${summary.operationsPerSecond.toFixed(2)} is below threshold ${thresholds.minOperationsPerSecond}`,
      );
    }

    return {
      passed: failures.length === 0,
      failures,
    };
  }
}

/**
 * Global performance monitor instance
 */
let globalPerformanceMonitor: PerformanceMonitor | null = null;

/**
 * Get or create the global performance monitor
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor();
  }
  return globalPerformanceMonitor;
}

/**
 * Dispose of the global performance monitor
 */
export function disposePerformanceMonitor(): void {
  if (globalPerformanceMonitor) {
    globalPerformanceMonitor.clearMetrics();
    globalPerformanceMonitor = null;
  }
}

/**
 * Performance monitoring decorator for functions
 */
export function monitorPerformance(operationName: string, customMetrics?: Record<string, number>) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const monitor = getPerformanceMonitor();
      const startTime = Date.now();

      try {
        const result = await method.apply(this, args);
        const endTime = Date.now();
        monitor.recordSuccess(operationName, startTime, endTime, customMetrics);
        return result;
      } catch (error) {
        const endTime = Date.now();
        monitor.recordFailure(
          operationName,
          startTime,
          endTime,
          error instanceof Error ? error.message : String(error),
          customMetrics,
        );
        throw error;
      }
    };
  };
}

/**
 * Performance monitoring helper for test functions
 */
export class TestPerformanceHelper {
  private monitor: PerformanceMonitor;

  constructor() {
    this.monitor = getPerformanceMonitor();
  }

  /**
   * Wrap a test function with performance monitoring
   */
  wrapTest<T extends unknown[], R>(
    operationName: string,
    testFunction: (...args: T) => Promise<R>,
    customMetrics?: Record<string, number>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = Date.now();

      try {
        const result = await testFunction(...args);
        const endTime = Date.now();
        this.monitor.recordSuccess(operationName, startTime, endTime, customMetrics);
        return result;
      } catch (error) {
        const endTime = Date.now();
        this.monitor.recordFailure(
          operationName,
          startTime,
          endTime,
          error instanceof Error ? error.message : String(error),
          customMetrics,
        );
        throw error;
      }
    };
  }

  /**
   * Monitor a batch of operations
   */
  async monitorBatch<T>(
    operationName: string,
    operations: (() => Promise<T>)[],
    customMetrics?: Record<string, number>,
  ): Promise<T[]> {
    const startTime = Date.now();
    const results: T[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const operation of operations) {
      try {
        const result = await operation();
        results.push(result);
        successCount++;
      } catch (error) {
        failureCount++;
        logger.warn(`Batch operation failed: ${error}`);
      }
    }

    const endTime = Date.now();
    const batchCustomMetrics = {
      ...customMetrics,
      batchSize: operations.length,
      successCount,
      failureCount,
    };

    this.monitor.recordSuccess(operationName, startTime, endTime, batchCustomMetrics);
    return results;
  }

  /**
   * Get current performance summary
   */
  getSummary(): PerformanceSummary {
    return this.monitor.getSummary();
  }

  /**
   * Log current performance summary
   */
  logSummary(): void {
    this.monitor.logSummary();
  }
}
