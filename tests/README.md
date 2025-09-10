# TUIZ Backend Testing Strategy

## Overview

This testing suite is optimized for the **Supabase Free Plan** with intelligent rate limiting, user pooling, and test prioritization to maximize coverage while respecting API limits.

## 🚨 Rate Limiting Considerations

### Supabase Free Plan Limits

- **Auth API**: ~10 requests/minute
- **Database**: ~20 requests/minute
- **User Creation**: ~5 users/minute

### Our Conservative Limits

- **Auth API**: 8 requests/minute
- **Database**: 15 requests/minute
- **User Creation**: 3 users/minute

## 📁 Test Structure

```
tests/
├── setup/                    # Core infrastructure
│   ├── testDatabase.ts       # Database management
│   ├── testAuth.ts          # Authentication helpers
│   ├── testData.ts          # Data factories
│   ├── testUtils.ts         # Common utilities
│   └── rateLimitHelper.ts   # Rate limiting logic
├── unit/                    # Fast, isolated tests
│   ├── auth-optimized.test.ts
│   ├── validation.test.ts
│   └── utils.test.ts
├── integration/             # API endpoint tests
│   └── quiz-optimized.test.ts
├── config/                  # Test configuration
│   └── testConfig.ts
└── README.md               # This file
```

## 🎯 Test Strategy

### 1. User Pooling

- **Reuse users** across tests to minimize creation
- **Maximum 2 users** in pool at any time
- **Automatic cleanup** after test suites

### 2. Test Prioritization

- **Critical**: Auth flows, basic CRUD
- **Important**: Validation, error handling
- **Optional**: Advanced features, edge cases

### 3. Rate Limit Awareness

- **Automatic delays** between operations
- **Retry logic** for rate limit errors
- **Skip tests** when limits are exceeded

## 🚀 Running Tests

### Development

```bash
# Run all tests with rate limiting
npm test

# Run only unit tests (no API calls)
npm run test:unit

# Run with debug logging
TEST_DEBUG=true npm test
```

### CI/CD

```bash
# Run with conservative limits
CI=true npm test
```

## 📊 Test Categories

### Unit Tests (No API Calls)

- ✅ **Validation schemas**
- ✅ **Utility functions**
- ✅ **Data factories**
- ✅ **Input sanitization**

### Integration Tests (Minimal API Calls)

- ✅ **Critical auth flows**
- ✅ **Basic CRUD operations**
- ✅ **Error handling**
- ✅ **Rate limit monitoring**

### Optimized Tests

- ✅ **User pooling**
- ✅ **Test prioritization**
- ✅ **Graceful degradation**
- ✅ **Resource management**

## 🔧 Configuration

### Environment Variables

```bash
# Enable debug logging
TEST_DEBUG=true

# Set test timeout
TEST_TIMEOUT=30000

# Enable user pooling
ENABLE_USER_POOLING=true
```

### Rate Limit Configuration

```typescript
const RATE_LIMITS = {
  AUTH_REQUESTS_PER_MINUTE: 8,
  USER_CREATION_PER_MINUTE: 3,
  DATABASE_REQUESTS_PER_MINUTE: 15,
  DELAY_BETWEEN_USER_CREATION: 3000,
  DELAY_BETWEEN_AUTH_REQUESTS: 1500,
  DELAY_BETWEEN_DATABASE_REQUESTS: 1000,
};
```

## 📈 Monitoring

### Rate Limit Status

```typescript
const status = RateLimitHelper.getStatus();
console.log('Rate limits:', {
  auth: `${status.auth.current}/${status.auth.limit}`,
  userCreation: `${status.userCreation.current}/${status.userCreation.limit}`,
  database: `${status.database.current}/${status.database.limit}`,
});
```

### Test Execution Order

1. **Critical tests** (auth, basic CRUD)
2. **Important tests** (validation, errors)
3. **Optional tests** (advanced features)

## 🛠️ Best Practices

### 1. Minimize API Calls

- Use **mock data** for unit tests
- **Reuse users** across tests
- **Batch operations** when possible

### 2. Handle Rate Limits

- **Check limits** before operations
- **Wait gracefully** when limits hit
- **Skip tests** if necessary

### 3. Test Prioritization

- **Run critical tests first**
- **Skip optional tests** if limits exceeded
- **Monitor execution time**

## 🚨 Troubleshooting

### Rate Limit Exceeded

```bash
# Wait for limits to reset
await RateLimitHelper.waitForAllRateLimitsReset();

# Check current status
const status = RateLimitHelper.getStatus();
```

### Test Failures

```bash
# Run with debug logging
TEST_DEBUG=true npm test

# Check rate limit status
console.log(RateLimitHelper.getStatus());
```

### User Creation Issues

```bash
# Clear user pool
RateLimitHelper.clearUserPool();

# Check user creation limits
const canCreate = RateLimitHelper.canCreateUser();
```

## 📝 Test Examples

### Optimized Auth Test

```typescript
it('should handle user login with rate limiting', async () => {
  if (!sharedTestUser) {
    console.log('Skipping - no user available');
    expect(true).toBe(true);
    return;
  }

  const response = await RateLimitHelper.executeWithRateLimit('auth', async () => {
    return request(app)
      .post('/auth/login')
      .send({ email: sharedTestUser.email, password: 'TestPassword123!' });
  });

  expect(response.status).toBe(200);
});
```

### Rate Limit Monitoring

```typescript
it('should monitor rate limit status', () => {
  const status = RateLimitHelper.getStatus();
  expect(status.auth.canProceed).toBeDefined();
  expect(status.userCreation.canProceed).toBeDefined();
  expect(status.database.canProceed).toBeDefined();
});
```

## 🎯 Success Metrics

- ✅ **Zero rate limit errors**
- ✅ **Test execution time < 5 minutes**
- ✅ **User creation < 3 per minute**
- ✅ **API calls < 15 per minute**
- ✅ **Test coverage > 80%**

## 🔄 Continuous Improvement

1. **Monitor rate limits** during test execution
2. **Adjust delays** based on actual limits
3. **Optimize test order** for efficiency
4. **Add more mock data** to reduce API calls
5. **Implement test batching** for better performance

---

**Remember**: The goal is to maximize test coverage while respecting Supabase free plan limits. When in doubt, prioritize critical functionality and use mock data for non-essential tests.
