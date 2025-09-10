/**
 * Test Priority Configuration for CI/CD
 *
 * This file defines the priority levels for different test categories
 * to optimize CI execution and ensure critical functionality is tested first.
 */

export enum TestPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  OPTIONAL = 'optional',
}

export interface TestCategory {
  name: string;
  priority: TestPriority;
  description: string;
  files: string[];
  estimatedDuration: number; // in seconds
  requiresExternalServices: boolean;
}

export const TEST_CATEGORIES: TestCategory[] = [
  {
    name: 'Health & Basic',
    priority: TestPriority.CRITICAL,
    description: 'Basic health checks and core functionality',
    files: ['tests/health.test.ts', 'tests/not-found.test.ts'],
    estimatedDuration: 30,
    requiresExternalServices: false,
  },
  {
    name: 'Unit Tests',
    priority: TestPriority.CRITICAL,
    description: 'Fast unit tests with no external dependencies',
    files: [
      'tests/unit/validation.test.ts',
      'tests/unit/utils.test.ts',
      'tests/unit/auth-optimized.test.ts',
    ],
    estimatedDuration: 60,
    requiresExternalServices: false,
  },
  {
    name: 'Authentication',
    priority: TestPriority.HIGH,
    description: 'Core authentication functionality',
    files: ['tests/auth.test.ts', 'tests/integration/auth-flow.test.ts'],
    estimatedDuration: 120,
    requiresExternalServices: true,
  },
  {
    name: 'Quiz Core',
    priority: TestPriority.HIGH,
    description: 'Core quiz functionality',
    files: ['tests/quiz.test.ts', 'tests/integration/quiz-optimized.test.ts'],
    estimatedDuration: 180,
    requiresExternalServices: true,
  },
  {
    name: 'Database',
    priority: TestPriority.MEDIUM,
    description: 'Database operations and profiles',
    files: ['tests/database/profiles.test.ts'],
    estimatedDuration: 90,
    requiresExternalServices: true,
  },
  {
    name: 'API Endpoints',
    priority: TestPriority.MEDIUM,
    description: 'Individual API endpoint tests',
    files: [
      'tests/integration/answers.test.ts',
      'tests/integration/questions.test.ts',
      'tests/integration/codes.test.ts',
      'tests/integration/publishing.test.ts',
    ],
    estimatedDuration: 300,
    requiresExternalServices: true,
  },
  {
    name: 'Workflows',
    priority: TestPriority.LOW,
    description: 'Complex integration workflows',
    files: ['tests/integration/api-workflows.test.ts', 'tests/integration/quiz-management.test.ts'],
    estimatedDuration: 600,
    requiresExternalServices: true,
  },
];

export const CI_TEST_CONFIG = {
  // Critical tests that must always pass
  CRITICAL_TESTS: TEST_CATEGORIES.filter((cat) => cat.priority === TestPriority.CRITICAL).flatMap(
    (cat) => cat.files,
  ),

  // High priority tests for main branch
  HIGH_PRIORITY_TESTS: TEST_CATEGORIES.filter((cat) =>
    [TestPriority.CRITICAL, TestPriority.HIGH].includes(cat.priority),
  ).flatMap((cat) => cat.files),

  // All tests for full CI runs
  ALL_TESTS: TEST_CATEGORIES.filter((cat) =>
    [TestPriority.CRITICAL, TestPriority.HIGH, TestPriority.MEDIUM].includes(cat.priority),
  ).flatMap((cat) => cat.files),

  // Quick smoke tests
  SMOKE_TESTS: [
    'tests/health.test.ts',
    'tests/unit/validation.test.ts',
    'tests/unit/utils.test.ts',
  ],
};

export function getTestsForPriority(priority: TestPriority): string[] {
  return TEST_CATEGORIES.filter((cat) => cat.priority === priority).flatMap((cat) => cat.files);
}

export function getEstimatedDuration(priorities: TestPriority[]): number {
  return TEST_CATEGORIES.filter((cat) => priorities.includes(cat.priority)).reduce(
    (total, cat) => total + cat.estimatedDuration,
    0,
  );
}

export function getTestsRequiringExternalServices(priorities: TestPriority[]): string[] {
  return TEST_CATEGORIES.filter(
    (cat) => priorities.includes(cat.priority) && cat.requiresExternalServices,
  ).flatMap((cat) => cat.files);
}
