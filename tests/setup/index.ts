/**
 * Test Infrastructure Exports
 *
 * Central export point for all test infrastructure components.
 * This provides a clean interface for importing test utilities.
 */

// Core infrastructure
export {
  TestDatabase,
  getTestDatabase,
  disposeTestDatabase,
  testDatabaseHelpers,
} from './testDatabase';
export { TestAuth, getTestAuth, disposeTestAuth, testAuthHelpers } from './testAuth';
export { TestDataManager } from './testUtils';

// Data factories
export {
  QuizDataFactory,
  QuestionDataFactory,
  AnswerDataFactory,
  UserDataFactory,
  CompleteQuizFactory,
  resetFactoryCounters,
  generateRandomString,
  generateRandomEmail,
  generateRandomUsername,
} from './testData';

// Test utilities
export {
  TestRequestHelper,
  TestAssertions,
  TestEnvironmentHelper,
  ResponseHelper,
  wait,
  randomNumber,
  randomString,
  randomEmail,
  randomUUID,
  deepClone,
  deepEqual,
  createTestContext,
} from './testUtils';

// Type exports
export type { TestDatabaseConfig } from './testDatabase';
export type { TestUser, CreateTestUserOptions } from './testAuth';
export type { TestQuizSetData, TestQuestionData, TestAnswerData, TestUserData } from './testData';
