// tests/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '../src/lib/supabase';
import { logger } from '../src/utils/logger';

// Generate unique test user data for each test run to avoid conflicts
export function createTestUser(suffix: string = '') {
  const uniqueId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
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
  try {
    // Get test users by email
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
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

    // Delete users with delay to avoid rate limiting
    for (const user of testUsers) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      await delayBetweenRequests(200); // Add small delay between deletions
    }

    // Wait longer to ensure cleanup completes
    if (testUsers.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    logger.warn({ error }, 'Error during test user cleanup');
  }
}

// Setup before all tests
beforeAll(async () => {
  // Clean up any existing test data only at the start
  await cleanupTestUsers();
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up test data
  await cleanupTestUsers();
});
