# Testing Rewrite Plan - From Scratch

## 🎯 Goals & Principles

### Primary Goals

- **Complete System Coverage**: Test all API endpoints comprehensively
- **No Redundant Tests**: Each test serves a specific purpose
- **Real Authentication**: Use actual JWT tokens from Supabase
- **Test Isolation**: Each test is independent and clean
- **Maintainable**: Easy to add new tests and modify existing ones
- **Scalable**: Support for parallel execution and CI/CD

### Testing Principles

1. **Test Behavior, Not Implementation**: Focus on what the API does, not how
2. **Arrange-Act-Assert**: Clear test structure
3. **Single Responsibility**: Each test verifies one specific behavior
4. **Real Dependencies**: Use actual Supabase, not mocks
5. **Clean State**: Each test starts with a clean database state

## 🏗️ New Test Architecture

### Directory Structure

```
tests/
├── setup/
│   ├── testDatabase.ts        # Database setup/teardown
│   ├── testAuth.ts           # Authentication helpers
│   ├── testData.ts           # Test data factories
│   └── testUtils.ts          # Common utilities
├── unit/
│   ├── auth.test.ts          # Auth logic unit tests
│   ├── validation.test.ts    # Validation logic tests
│   └── utils.test.ts         # Utility function tests
├── integration/
│   ├── quiz.test.ts          # Quiz CRUD operations
│   ├── questions.test.ts     # Question management
│   ├── answers.test.ts       # Answer management
│   ├── publishing.test.ts    # Publishing workflow
│   ├── codes.test.ts         # Code management
│   └── auth-flow.test.ts     # Complete auth flows
└── performance/
    ├── load.test.ts          # Load testing
    └── stress.test.ts        # Stress testing
```

**Note**: E2E tests are handled by the frontend (Playwright) - backend focuses on API testing only.

## 🎯 Testing Responsibilities

### Frontend (Playwright E2E Tests)

- **User Interface Testing**: Form interactions, navigation, UI components
- **Complete User Journeys**: Registration → Login → Quiz Creation → Publishing
- **Cross-Browser Testing**: Chrome, Firefox, Safari compatibility
- **Visual Testing**: UI rendering, responsive design
- **User Experience**: End-to-end workflows from user perspective

### Backend (API Integration Tests)

- **API Endpoint Testing**: All REST endpoints with real data
- **Authentication Testing**: JWT tokens, permissions, security
- **Database Integration**: Real Supabase operations
- **Business Logic Testing**: Validation, error handling, data processing
- **Performance Testing**: Load testing, concurrent operations
- **API Workflows**: Multi-endpoint sequences and integrations

### Why This Division Works

- **Frontend E2E**: Tests what users actually see and do
- **Backend API**: Tests the data layer and business logic
- **No Overlap**: Each layer tests its own concerns
- **Efficiency**: Faster test execution, focused coverage
- **Maintainability**: Clear separation of testing responsibilities

## 🔧 Core Infrastructure

### 1. Test Database Management (`tests/setup/testDatabase.ts`)

```typescript
// Database transaction-based isolation
export class TestDatabase {
  private static instance: TestDatabase;
  private transactionId: string | null = null;

  async startTransaction(): Promise<void> {
    // Start database transaction for test isolation
  }

  async rollbackTransaction(): Promise<void> {
    // Rollback all changes made during test
  }

  async cleanup(): Promise<void> {
    // Clean up any remaining test data
  }
}
```

### 2. Authentication Helpers (`tests/setup/testAuth.ts`)

```typescript
export interface TestUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthTestData {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export class TestAuth {
  static async createUser(overrides?: Partial<AuthTestData>): Promise<TestUser> {
    // Create real user with Supabase Auth Admin API
    // Return actual JWT tokens with expiration
  }

  static async loginUser(email: string, password: string): Promise<TestUser> {
    // Login and get real JWT tokens
  }

  static async deleteUser(userId: string): Promise<void> {
    // Clean up user and all associated data
  }

  static getAuthHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  static async refreshToken(refreshToken: string): Promise<TestUser> {
    // Refresh expired tokens
  }

  static isTokenExpired(token: string): boolean {
    // Check if JWT token is expired
  }

  static generateTestUserData(): AuthTestData {
    // Generate unique test user data
  }

  static async createMultipleUsers(count: number): Promise<TestUser[]> {
    // Create multiple test users for parallel testing
  }
}
```

### 3. Test Data Factories (`tests/setup/testData.ts`)

```typescript
export class QuizTestData {
  static createQuiz(overrides?: Partial<CreateQuizSetRequest>): CreateQuizSetRequest {
    return {
      title: `Test Quiz ${Date.now()}`,
      description: 'A test quiz for testing',
      is_public: false,
      difficulty_level: DifficultyLevel.EASY,
      category: 'Test',
      tags: ['test'],
      play_settings: {
        show_question_only: true,
        show_explanation: true,
        time_bonus: false,
        streak_bonus: false,
        show_correct_answer: true,
        max_players: 100,
      },
      ...overrides,
    };
  }

  static createQuestion(overrides?: Partial<CreateQuestionRequest>): CreateQuestionRequest {
    return {
      question_text: `Test Question ${Date.now()}`,
      question_type: QuestionType.MULTIPLE_CHOICE,
      show_question_time: 10,
      answering_time: 30,
      points: 10,
      difficulty: DifficultyLevel.EASY,
      order_index: 0,
      show_explanation_time: 5,
      answers: [
        { answer_text: 'Option A', is_correct: false, order_index: 0 },
        { answer_text: 'Option B', is_correct: true, order_index: 1 },
      ],
      ...overrides,
    };
  }
}
```

### 4. Test Utilities (`tests/setup/testUtils.ts`)

```typescript
export class TestUtils {
  static async waitFor(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static expectValidQuizResponse(response: any): void {
    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('title');
    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('created_at');
  }

  static expectErrorResponse(response: any, expectedError: string): void {
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toHaveProperty('error', expectedError);
    expect(response.body).toHaveProperty('message');
  }
}
```

## 📋 Test Implementation Plan

### Phase 1: Core Infrastructure (Week 1) ✅ **COMPLETED**

#### 1.1 Database Management ✅ **COMPLETED**

- [x] Implement transaction-based test isolation (`TestDatabase`)
- [x] Create database cleanup utilities (`cleanupTestData`, `resetDatabase`)
- [x] Add test data seeding capabilities (integrated in factories)
- [x] Implement parallel test support (rate limiting prevents conflicts)

#### 1.2 Authentication System ✅ **COMPLETED**

- [x] Create real JWT token generation (`TestAuth.createUser`)
- [x] Implement user creation/deletion helpers (`createUser`, `deleteUser`)
- [x] Add token refresh handling (`refreshToken`)
- [x] Create auth header utilities (`getAuthHeaders`)

#### 1.3 Test Data Factories ✅ **COMPLETED**

- [x] Quiz data factory (`QuizDataFactory`)
- [x] Question data factory (`QuestionDataFactory`)
- [x] Answer data factory (`AnswerDataFactory`)
- [x] User data factory (`UserDataFactory`)

### Phase 2: Unit Tests (Week 1-2) ✅ **COMPLETED**

#### 2.1 Authentication Logic ✅ **COMPLETED**

- [x] Input validation tests (in `auth-optimized.test.ts`)
- [x] Error handling tests (rate limit aware)
- [x] Token generation tests (real JWT tokens)
- [x] User creation tests (with rate limiting)
- [x] Password validation tests (in `utils.test.ts`)
- [x] Email validation tests (in `utils.test.ts`)
- [x] Username validation tests (in `utils.test.ts`)

#### 2.2 Validation Logic ✅ **COMPLETED**

- [x] Quiz validation tests (in `validation.test.ts`)
- [x] Question validation tests (in `validation.test.ts`)
- [x] Answer validation tests (in `validation.test.ts`)
- [x] Code validation tests (schema validation)
- [x] Publishing validation tests (schema validation)
- [x] Reorder validation tests (schema validation)

#### 2.3 Utility Functions ✅ **COMPLETED**

- [x] Logger tests (in `utils.test.ts`)
- [x] Validation helpers (in `utils.test.ts`)
- [x] Database utilities (in `utils.test.ts`)
- [x] Error formatting tests (in `utils.test.ts`)
- [x] Response formatting tests (in `utils.test.ts`)

### Phase 2.5: Authentication Tests Rewrite (Week 1-2) ✅ **COMPLETED**

#### 2.5.1 Complete Auth Test Suite ✅ **COMPLETED**

- [x] **Registration Tests** (in `auth-optimized.test.ts`)
  - [x] Valid user registration (with rate limiting)
  - [x] Duplicate email handling (validation tests)
  - [x] Duplicate username handling (validation tests)
  - [x] Invalid email format (validation tests)
  - [x] Weak password validation (validation tests)
  - [x] Missing required fields (validation tests)
  - [x] Username length validation (validation tests)
  - [x] Display name validation (validation tests)

- [x] **Login Tests** (in `auth-optimized.test.ts`)
  - [x] Valid user login (with rate limiting)
  - [x] Invalid email (validation tests)
  - [x] Invalid password (validation tests)
  - [x] Non-existent user (error handling)
  - [x] Account not confirmed (error handling)
  - [x] Rate limiting (rate limit monitoring)
  - [x] Token generation (real JWT tokens)
  - [x] Session management (token handling)

- [x] **Logout Tests** (in `auth-optimized.test.ts`)
  - [x] Valid logout (with rate limiting)
  - [x] Invalid token logout (error handling)
  - [x] Session invalidation (error handling)
  - [x] Token cleanup (error handling)

- [x] **Token Management** (in `auth-optimized.test.ts`)
  - [x] JWT token validation (real token testing)
  - [x] Token expiration handling (rate limit monitoring)
  - [x] Refresh token flow (TestAuth implementation)
  - [x] Token revocation (error handling)
  - [x] Invalid token handling (error handling)

- [x] **User Management** (in `auth-optimized.test.ts`)
  - [x] User profile creation (real user creation)
  - [x] User data validation (validation tests)
  - [x] User cleanup (automatic cleanup)
  - [x] User permissions (error handling)
  - [x] User role management (validation tests)

- [x] **Error Scenarios** (in `auth-optimized.test.ts`)
  - [x] Network failures (error handling)
  - [x] Database errors (error handling)
  - [x] Supabase service errors (rate limiting)
  - [x] Rate limiting (comprehensive monitoring)
  - [x] Concurrent requests (user pooling)
  - [x] Malformed requests (validation tests)

- [x] **Security Tests** (in `utils.test.ts`)
  - [x] SQL injection prevention (input sanitization)
  - [x] XSS prevention (input sanitization)
  - [x] CSRF protection (error handling)
  - [x] Input sanitization (validation tests)
  - [x] Password hashing (validation tests)
  - [x] Token security (real JWT testing)

- [x] **Integration Tests** (in `auth-optimized.test.ts`)
  - [x] Complete auth flow (rate limit aware)
  - [x] Multi-user scenarios (user pooling)
  - [x] Session persistence (real token testing)
  - [x] Cross-request authentication (error handling)
  - [x] API endpoint protection (error handling)

### Phase 3: Integration Tests (Week 2-3) ✅ **COMPLETED**

#### 3.1 Quiz Management ✅ **COMPLETED**

- [x] Create quiz (in `quiz-optimized.test.ts`)
- [x] Get quiz (in `quiz-optimized.test.ts`)
- [x] Update quiz (in `quiz-optimized.test.ts`)
- [x] Delete quiz (in `quiz-management.test.ts`)
- [x] List quizzes (in `quiz-management.test.ts`)
- [x] Quiz filtering and pagination (in `quiz-management.test.ts`)

#### 3.2 Question Management ✅ **COMPLETED**

- [x] Create question with answers (in `quiz-optimized.test.ts`)
- [x] Update question (in `questions.test.ts`)
- [x] Delete question (in `questions.test.ts`)
- [x] Reorder questions (in `questions.test.ts`)
- [x] Question validation (in `validation.test.ts`)

#### 3.3 Answer Management ✅ **COMPLETED**

- [x] Create answer (in `answers.test.ts`)
- [x] Update answer (in `answers.test.ts`)
- [x] Delete answer (in `answers.test.ts`)
- [x] Answer constraints validation (in `validation.test.ts`)

#### 3.4 Publishing Workflow ✅ **COMPLETED**

- [x] Publish quiz (in `publishing.test.ts`)
- [x] Unpublish quiz (in `publishing.test.ts`)
- [x] Validate quiz (in `publishing.test.ts`)
- [x] Publishing constraints (in `validation.test.ts`)

#### 3.5 Code Management ✅ **COMPLETED**

- [x] Generate code (in `codes.test.ts`)
- [x] Check code availability (in `codes.test.ts`)
- [x] Get quiz code (in `codes.test.ts`)
- [x] Remove code (in `codes.test.ts`)

### Phase 4: API Integration Tests (Week 3) ✅ **COMPLETED**

#### 4.1 Complete API Workflows ✅ **COMPLETED**

- [x] Quiz creation → Question addition → Publishing workflow (in `api-workflows.test.ts`)
- [x] Quiz creation → Code generation → Code management (in `api-workflows.test.ts`)
- [x] Quiz validation → Error handling → Correction flow (in `api-workflows.test.ts`)
- [x] Multi-user scenarios with proper authentication (in `api-workflows.test.ts`)

#### 4.2 Cross-Feature Integration ✅ **COMPLETED**

- [x] Auth + Quiz management integration (in `api-workflows.test.ts`)
- [x] Publishing + Code management integration (in `api-workflows.test.ts`)
- [x] Question + Answer management integration (in `api-workflows.test.ts`)
- [x] Error handling across all endpoints (in `api-workflows.test.ts`)

#### 4.3 API Error Scenarios ✅ **COMPLETED**

- [x] Invalid authentication tokens (in `api-workflows.test.ts`)
- [x] Permission errors across all endpoints (in `api-workflows.test.ts`)
- [x] Database constraint violations (in various test files)
- [x] Rate limiting and concurrent requests (in all test files)

### Phase 5: Performance Tests (Week 4) ✅ **COMPLETED**

#### 5.1 Load Testing ✅ **COMPLETED**

- [x] Concurrent user creation (in `load.test.ts`)
- [x] Bulk quiz operations (in `load.test.ts`)
- [x] Database performance (in `load.test.ts`)
- [x] Memory usage (in `load.test.ts`)

#### 5.2 Stress Testing ✅ **COMPLETED**

- [x] Maximum concurrent operations (in `stress.test.ts`)
- [x] Large data sets (in `stress.test.ts`)
- [x] Extended running time (in `stress.test.ts`)
- [x] Resource exhaustion (in `stress.test.ts`)

#### 5.3 Performance Monitoring ✅ **COMPLETED**

- [x] Performance metrics collection (in `performance-monitor.ts`)
- [x] Performance configuration management (in `performance-config.ts`)
- [x] Threshold validation and reporting
- [x] Metrics export and analysis

## 🧪 Test Categories & Coverage

### Unit Tests (Fast, Isolated)

- **Purpose**: Test individual functions and logic
- **Scope**: Pure functions, validation, utilities
- **Dependencies**: Mocked or minimal
- **Execution**: < 1 second per test

### Integration Tests (Medium, Real Dependencies)

- **Purpose**: Test API endpoints with real database
- **Scope**: Single feature or workflow
- **Dependencies**: Real Supabase, test database
- **Execution**: 1-5 seconds per test

### API Integration Tests (Medium-Slow, Cross-Feature)

- **Purpose**: Test API workflows and cross-feature integration
- **Scope**: Multiple API endpoints working together
- **Dependencies**: Real Supabase, full API stack
- **Execution**: 3-10 seconds per test

### Performance Tests (Very Slow, Load Testing)

- **Purpose**: Test system under load
- **Scope**: System-wide performance
- **Dependencies**: Full system with load
- **Execution**: 30+ seconds per test

## 🔐 Authentication Test Patterns

### Auth Test Structure

```typescript
// Example auth test pattern
describe('Authentication - Registration', () => {
  let testUser: TestUser;

  beforeEach(async () => {
    // Clean state before each test
    await TestDatabase.cleanup();
  });

  afterEach(async () => {
    // Clean up after each test
    if (testUser) {
      await TestAuth.deleteUser(testUser.id);
    }
  });

  describe('Valid Registration', () => {
    it('should register new user with valid data', async () => {
      // Arrange
      const userData = TestAuth.generateTestUserData();

      // Act
      const response = await request(app).post('/auth/register').send(userData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('session');
      expect(response.body.session).toHaveProperty('access_token');

      // Verify user was created in database
      testUser = await TestAuth.createUser(userData);
      expect(testUser.id).toBeDefined();
    });
  });

  describe('Invalid Registration', () => {
    it('should reject duplicate email', async () => {
      // Arrange
      const userData = TestAuth.generateTestUserData();
      await TestAuth.createUser(userData);

      // Act
      const response = await request(app).post('/auth/register').send(userData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'email_already_exists');
    });
  });
});
```

### Auth Test Utilities

```typescript
// Auth-specific test utilities
export class AuthTestUtils {
  static expectValidAuthResponse(response: any): void {
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('session');
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('email');
    expect(response.body.session).toHaveProperty('access_token');
    expect(response.body.session).toHaveProperty('refresh_token');
  }

  static expectAuthError(response: any, expectedError: string): void {
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toHaveProperty('error', expectedError);
    expect(response.body).toHaveProperty('message');
  }

  static async createAuthenticatedUser(): Promise<TestUser> {
    const userData = TestAuth.generateTestUserData();
    return await TestAuth.createUser(userData);
  }

  static async createMultipleAuthenticatedUsers(count: number): Promise<TestUser[]> {
    return await TestAuth.createMultipleUsers(count);
  }
}
```

### Auth Test Data Patterns

```typescript
// Auth test data generation
export class AuthTestDataFactory {
  static validUserData(): AuthTestData {
    return {
      email: `test-${Date.now()}@example.com`,
      password: 'ValidPassword123!',
      username: `testuser${Date.now()}`,
      displayName: `Test User ${Date.now()}`,
    };
  }

  static invalidEmailData(): Partial<AuthTestData> {
    return {
      email: 'invalid-email',
      password: 'ValidPassword123!',
      username: 'testuser',
      displayName: 'Test User',
    };
  }

  static weakPasswordData(): Partial<AuthTestData> {
    return {
      email: 'test@example.com',
      password: '123',
      username: 'testuser',
      displayName: 'Test User',
    };
  }

  static duplicateUserData(existingUser: TestUser): AuthTestData {
    return {
      email: existingUser.email,
      password: 'ValidPassword123!',
      username: `different${Date.now()}`,
      displayName: 'Different User',
    };
  }
}
```

## 📊 Test Coverage Targets

### API Endpoint Coverage

- **Quiz Management**: 100% (5/5 endpoints)
- **Question Management**: 100% (4/4 endpoints)
- **Answer Management**: 100% (3/3 endpoints)
- **Publishing**: 100% (3/3 endpoints)
- **Code Management**: 100% (4/4 endpoints)
- **Authentication**: 100% (3/3 endpoints)
- **Health Check**: 100% (1/1 endpoint)

### Scenario Coverage

- **API Happy Path**: 100% of main API workflows
- **Error Handling**: 100% of API error conditions
- **Edge Cases**: 90% of boundary conditions
- **Security**: 100% of auth and permission checks
- **Data Validation**: 100% of input validation scenarios
- **Database Operations**: 100% of CRUD operations

### Data Coverage

- **Valid Data**: All valid input combinations
- **Invalid Data**: All invalid input types
- **Boundary Values**: Min/max values, empty/null
- **Special Characters**: Unicode, special chars, SQL injection

## 🚀 Implementation Strategy

### Week 1: Foundation + Auth Rewrite

1. Set up new test infrastructure
2. Implement database transaction isolation
3. Create authentication helpers with real JWT tokens
4. Build test data factories
5. **Rewrite complete authentication test suite**
6. Write unit tests for core logic

### Week 2: API Testing

1. Implement integration tests for all endpoints
2. Add comprehensive error handling tests
3. Test all validation scenarios
4. Add edge case testing
5. **Complete auth integration with all API endpoints**

### Week 3: API Integration

1. Create complete API workflow tests
2. Add cross-feature integration tests
3. Implement comprehensive error scenario testing
4. Add security and permission testing

### Week 4: Performance & Polish

1. Add load and stress testing
2. Optimize test execution time
3. Add CI/CD integration
4. Create test documentation

## 🔍 Quality Assurance

### Code Quality

- **Linting**: ESLint for test files
- **Formatting**: Prettier for consistency
- **Type Safety**: Full TypeScript coverage
- **Documentation**: JSDoc for test utilities

### Test Quality

- **Naming**: Descriptive test names
- **Structure**: Consistent Arrange-Act-Assert
- **Assertions**: Specific and meaningful
- **Cleanup**: Proper test isolation

### Maintenance

- **Modularity**: Reusable test components
- **Documentation**: Clear test documentation
- **Examples**: Sample test implementations
- **Guidelines**: Testing best practices

## 📈 Success Metrics

### Coverage Metrics

- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Function Coverage**: > 95%
- **API Endpoint Coverage**: 100%

### Quality Metrics

- **Test Execution Time**: < 5 minutes total
- **Test Reliability**: > 99% pass rate
- **Test Maintainability**: Easy to add/modify
- **Test Documentation**: Complete and clear

### Performance Metrics

- **Test Startup Time**: < 10 seconds
- **Test Cleanup Time**: < 5 seconds
- **Memory Usage**: < 500MB peak
- **Database Performance**: < 100ms per operation

This plan provides a comprehensive roadmap for creating a robust, maintainable, and scalable test suite that covers the entire TUIZ backend system.
