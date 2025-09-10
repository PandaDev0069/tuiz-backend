// tests/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '../src/lib/supabase';
import { logger } from '../src/utils/logger';
import { isTestWithDummyCredentials } from '../src/config/env';

// Generate unique test user data for each test run to avoid conflicts
export function createTestUser(suffix: string = '') {
  const uniqueId = Date.now().toString() + randomBytes(4).toString('hex');
  const shortId = uniqueId.slice(-8); // Use last 8 characters to keep username short

  // Clean suffix to be alphanumeric and underscore only for username
  const cleanSuffix = suffix ? suffix.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 6) : 'test';

  return {
    email: `test-${suffix ? suffix.slice(0, 6) : 'default'}-${shortId}@tuiz.example.com`,
    password: 'testpassword123',
    username: `${cleanSuffix}${shortId}`.slice(0, 20), // Ensure max 20 characters
    displayName: `Test User ${shortId}`,
    uniqueId: shortId,
  };
}

// Helper to add delay between requests to avoid rate limiting
export const delayBetweenRequests = (ms: number = 500) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Legacy test user constants for backward compatibility (but not recommended for parallel tests)
export const TEST_USER = {
  email: 'test@tuiz.example.com',
  password: 'testpassword123',
  username: 'testuser',
  displayName: 'Test User',
};

export const TEST_USER_2 = {
  email: 'test2@tuiz.example.com',
  password: 'testpassword456',
  username: 'testuser2',
  displayName: 'Test User 2',
};

// Enhanced cleanup function that can target specific users or clean all test users
export async function cleanupTestUsers(specificUserIds: string[] = []) {
  // Skip cleanup in CI with dummy credentials
  if (isTestWithDummyCredentials) {
    return;
  }

  try {
    // Get test users by email with timeout
    const { data: users, error } = (await Promise.race([
      supabaseAdmin.auth.admin.listUsers(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('User list timeout')), 10000),
      ),
    ])) as { data: { users: Array<{ id: string; email?: string }> }; error: unknown };

    if (error) {
      logger.warn({ error }, 'Error fetching users for cleanup');
      return;
    }

    let testUsers;
    if (specificUserIds.length > 0) {
      // Clean up specific users
      testUsers = users.users.filter((user) => specificUserIds.includes(user.id));
    } else {
      // Clean up all test domain users
      testUsers = users.users.filter(
        (user) => user.email && user.email.includes('@tuiz.example.com'),
      );
    }

    if (testUsers.length === 0) {
      return;
    }

    logger.info({ count: testUsers.length }, 'Cleaning up test users');

    // Delete users in parallel batches to avoid rate limiting but be faster
    const batchSize = 3;
    for (let i = 0; i < testUsers.length; i += batchSize) {
      const batch = testUsers.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (user) => {
          try {
            await supabaseAdmin.auth.admin.deleteUser(user.id);
            logger.debug({ userId: user.id }, 'User deleted successfully');
          } catch (error) {
            // Ignore errors for already deleted users or rate limiting
            logger.debug({ error, userId: user.id }, 'User cleanup error (likely already deleted)');
          }
        }),
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < testUsers.length) {
        await delayBetweenRequests(100);
      }
    }

    logger.info({ count: testUsers.length }, 'Test user cleanup completed');
  } catch (error) {
    logger.warn({ error }, 'Error during test user cleanup');
  }
}

// Setup before all tests
beforeAll(async () => {
  // Clean up any existing test data only at the start
  await cleanupTestUsers();
}, 30000); // 30 second timeout

// Cleanup after all tests
afterAll(async () => {
  // Clean up test data
  await cleanupTestUsers();
}, 30000); // 30 second timeout
