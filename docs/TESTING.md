# Testing (tuiz-backend)

## Goals

- Fast feedback on API behavior and error contracts
- Real Supabase integration testing with proper cleanup
- Comprehensive coverage of auth flows and database operations

## Tools

- **Vitest** – test runner with excellent TypeScript support
- **Supertest** – HTTP assertions against the Express app (no actual server needed)
- **Supabase Admin Client** – direct database integration for setup/teardown
- **Real Database Testing** – all auth tests use actual Supabase instance

## Test Categories

### 1. HTTP Integration Tests

- Route handlers with actual Supabase auth
- Error contract validation
- Request/response validation

### 2. Database Integration Tests

- Profile creation triggers
- RLS policy enforcement
- Database function testing (RPC)

### 3. End-to-End Flow Tests

- Complete user journeys (register → login → logout)
- Cross-system integration validation

### 4. Unit Tests

- Utility functions
- Validation schemas
- Error handling

## Test Structure

```
tests/
  setup.ts                    # Global test setup and cleanup
  auth.test.ts                # Authentication routes (11 tests)
  health.test.ts              # Health endpoint
  not-found.test.ts          # 404 handling
  database/
    profiles.test.ts          # Database profile operations (4 tests)
  integration/
    auth-flow.test.ts         # End-to-end user flows (3 tests)
```

## Test Data Management

### Test Users

```typescript
// Defined in tests/setup.ts
export const TEST_USER = {
  email: 'test@tuiz.example.com',
  password: 'testpassword123',
  username: 'testuser',
  displayName: 'Test User',
};
```

### Cleanup Strategy

- **Before All Tests**: Clean up any existing test data
- **Before Each Test**: Ensure clean state for isolation
- **After All Tests**: Final cleanup
- **Automatic Cleanup**: Removes all `@tuiz.example.com` domain emails

## Commands

```bash
npm test                           # Run all tests once (CI)
npm test -- tests/auth.test.ts     # Run specific test file
npm test -- --reporter=verbose     # Detailed test output
npm run test:ui                    # Vitest UI (interactive)

# Individual test categories
npm test -- tests/auth.test.ts                      # Auth routes only
npm test -- tests/database/profiles.test.ts         # Database tests only
npm test -- tests/integration/auth-flow.test.ts     # Integration tests only
```

## Current Test Coverage

### ✅ Authentication Routes (`tests/auth.test.ts`) - 11 tests

- **Registration**: Valid/invalid payloads, duplicate emails
- **Login**: Valid/invalid credentials, session creation
- **Logout**: Token validation, session invalidation

### ✅ Database Integration (`tests/database/profiles.test.ts`) - 4 tests

- **Profile Creation**: Automatic trigger execution
- **Metadata Handling**: Username/display name extraction
- **Timestamp Updates**: `last_active` RPC functions
- **Security**: RLS policy validation

### ✅ Complete Flows (`tests/integration/auth-flow.test.ts`) - 3 tests

- **User Journey**: Full registration → login → logout cycle
- **Error Scenarios**: Invalid registration/login attempts
- **Database Consistency**: Profile creation verification

### ✅ Infrastructure Tests - 2 tests

- **Health Endpoint**: API status checking
- **Error Handling**: 404 responses with unified contracts

## Real Database Testing

All auth and database tests use actual Supabase:

- **Real Auth**: Supabase Auth API for user creation/authentication
- **Real Database**: PostgreSQL with triggers, RLS, and functions
- **Real Sessions**: JWT tokens and session management
- **Proper Cleanup**: Admin client removes test data

## Test Patterns

### 1) Auth Route Testing

```typescript
describe('POST /auth/register', () => {
  it('should successfully register a new user with Supabase', async () => {
    const response = await request(app).post('/auth/register').send({
      email: TEST_USER.email,
      password: TEST_USER.password,
      username: TEST_USER.username,
      displayName: TEST_USER.displayName,
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('session');
  });
});
```

### 2) Database Integration Testing

```typescript
it('should automatically create profile when user registers', async () => {
  // Create user via Supabase Admin
  const { data: authData } = await supabaseAdmin.auth.admin.createUser({...});

  // Wait for trigger
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify profile creation
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', authData.user!.id)
    .maybeSingle();

  expect(profile).toBeDefined();
});
```

### 3) Error Contract Validation

```typescript
expect(response.status).toBe(400);
expect(response.body).toHaveProperty('error', 'invalid_payload');
expect(response.body).toHaveProperty('message');
```

## Test Isolation

- Each test file has independent setup/teardown
- Database cleanup prevents test interference
- No shared state between tests
- Deterministic test data

## CI Integration

Tests run in GitHub Actions with:

- `npm run lint` - Code quality
- `npm run typecheck` - TypeScript validation
- `npm test` - All test suites
- `npm run build` - Build verification

## Performance Notes

- Database tests have ~2s delays for trigger execution
- Individual test files run fast (< 10s each)
- Parallel execution can cause timing issues (expected)
- Tests are designed for reliability over speed

## Future Enhancements

- [ ] Socket.io integration tests
- [ ] Quiz/game module testing
- [ ] Performance benchmarking
- [ ] Mocked database tests for speed
- [ ] Test data factories
