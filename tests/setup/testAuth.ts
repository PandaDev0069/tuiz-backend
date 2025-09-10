/**
 * Test Authentication Management
 *
 * Provides real JWT token management using Supabase Auth Admin API.
 * Creates, manages, and cleans up test users with proper authentication.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../src/utils/logger';
import { randomBytes } from 'crypto';
// Note: RateLimitHelper import removed as it's not used in this file
import type { Database } from '../../src/lib/supabase';
import type { TestDatabase } from './testDatabase';

export interface TestUser {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  role: 'user' | 'admin';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface CreateTestUserOptions {
  email?: string;
  username?: string;
  displayName?: string;
  role?: 'user' | 'admin';
  password?: string;
}

export class TestAuth {
  private supabaseAdmin: SupabaseClient<Database>;
  private supabaseClient: SupabaseClient<Database>;
  private testUsers: Map<string, TestUser> = new Map();
  private testDatabase: TestDatabase;

  constructor(testDatabase: TestDatabase) {
    this.testDatabase = testDatabase;
    this.supabaseAdmin = testDatabase.admin;
    this.supabaseClient = testDatabase.client;
  }

  /**
   * Create a new test user with real authentication
   */
  async createTestUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
    const {
      email = `test-${Date.now()}-${randomBytes(6).toString('hex')}@example.com`,
      username = `testuser_${Date.now()}`,
      displayName = `Test User ${Date.now()}`,
      role = 'user',
      password = 'TestPassword123!',
    } = options;

    try {
      // Create user via Supabase Auth Admin API
      const { data: authData, error: authError } = await this.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Skip email confirmation for tests
        user_metadata: {
          username,
          display_name: displayName,
        },
      });

      if (authError) {
        throw new Error(`Failed to create test user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('User creation returned no user data');
      }

      // Profile is automatically created by the handle_new_user() trigger
      // No need to manually insert into profiles table

      // Wait a moment for the profile creation trigger to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Sign in the user to get access token with retry
      let signInData, signInError;
      let retryCount = 0;
      const maxRetries = 3;

      do {
        const signInResult = await this.supabaseClient.auth.signInWithPassword({
          email,
          password,
        });
        signInData = signInResult.data;
        signInError = signInResult.error;

        if (signInError || !signInData.session) {
          retryCount++;
          if (retryCount < maxRetries) {
            logger.debug(`Sign in attempt ${retryCount} failed, retrying in 2 seconds...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      } while ((signInError || !signInData.session) && retryCount < maxRetries);

      if (signInError || !signInData.session) {
        // Clean up the user if sign in fails
        await this.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(
          `Failed to sign in test user after ${maxRetries} attempts: ${signInError?.message || 'No session data'}`,
        );
      }

      const testUser: TestUser = {
        id: authData.user.id,
        email,
        username,
        displayName,
        role,
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
        expiresAt: signInData.session.expires_at
          ? signInData.session.expires_at * 1000
          : Date.now() + 3600000,
      };

      this.testUsers.set(testUser.id, testUser);
      logger.debug(`Created test user: ${testUser.email} (${testUser.id})`);

      return testUser;
    } catch (error) {
      logger.error('Failed to create test user:', error);
      throw error;
    }
  }

  /**
   * Create multiple test users at once
   */
  async createMultipleTestUsers(
    count: number,
    options: CreateTestUserOptions = {},
  ): Promise<TestUser[]> {
    const users: TestUser[] = [];

    for (let i = 0; i < count; i++) {
      const userOptions = {
        ...options,
        email:
          options.email || `test-${Date.now()}-${i}-${randomBytes(6).toString('hex')}@example.com`,
        username: options.username || `testuser_${Date.now()}_${i}`,
        displayName: options.displayName || `Test User ${Date.now()} ${i}`,
      };

      const user = await this.createTestUser(userOptions);
      users.push(user);
    }

    return users;
  }

  /**
   * Get a test user by ID
   */
  getTestUser(userId: string): TestUser | undefined {
    return this.testUsers.get(userId);
  }

  /**
   * Get all test users
   */
  getAllTestUsers(): TestUser[] {
    return Array.from(this.testUsers.values());
  }

  /**
   * Refresh a user's access token
   */
  async refreshUserToken(userId: string): Promise<TestUser> {
    const user = this.testUsers.get(userId);
    if (!user) {
      throw new Error(`Test user not found: ${userId}`);
    }

    try {
      const { data, error } = await this.supabaseClient.auth.refreshSession({
        refresh_token: user.refreshToken,
      });

      if (error || !data.session) {
        throw new Error(`Failed to refresh token: ${error?.message || 'No session data'}`);
      }

      // Update user with new tokens
      user.accessToken = data.session.access_token;
      user.refreshToken = data.session.refresh_token;
      user.expiresAt = data.session.expires_at
        ? data.session.expires_at * 1000
        : Date.now() + 3600000;

      this.testUsers.set(userId, user);
      logger.debug(`Refreshed token for user: ${user.email}`);

      return user;
    } catch (error) {
      logger.error('Failed to refresh user token:', error);
      throw error;
    }
  }

  /**
   * Check if a user's token is expired
   */
  isTokenExpired(userId: string): boolean {
    const user = this.testUsers.get(userId);
    if (!user) return true;

    return Date.now() >= user.expiresAt - 60000; // 1 minute buffer
  }

  /**
   * Get a valid access token for a user (refreshes if needed)
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const user = this.testUsers.get(userId);
    if (!user) {
      throw new Error(`Test user not found: ${userId}`);
    }

    if (this.isTokenExpired(userId)) {
      await this.refreshUserToken(userId);
    }

    return this.testUsers.get(userId)!.accessToken;
  }

  /**
   * Sign out a test user
   */
  async signOutUser(userId: string): Promise<void> {
    const user = this.testUsers.get(userId);
    if (!user) {
      logger.warn(`Test user not found for sign out: ${userId}`);
      return;
    }

    try {
      await this.supabaseClient.auth.signOut();
      logger.debug(`Signed out test user: ${user.email}`);
    } catch (error) {
      logger.warn('Failed to sign out user:', error);
    }
  }

  /**
   * Delete a test user completely
   */
  async deleteTestUser(userId: string): Promise<void> {
    const user = this.testUsers.get(userId);
    if (!user) {
      logger.warn(`Test user not found for deletion: ${userId}`);
      return;
    }

    try {
      // Delete from auth
      const { error: authError } = await this.supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) {
        logger.warn(`Failed to delete auth user: ${authError.message}`);
      }

      // Remove from our tracking
      this.testUsers.delete(userId);
      logger.debug(`Deleted test user: ${user.email}`);
    } catch (error) {
      logger.error('Failed to delete test user:', error);
      throw error;
    }
  }

  /**
   * Clean up all test users
   */
  async cleanupAllUsers(): Promise<void> {
    const userIds = Array.from(this.testUsers.keys());

    for (const userId of userIds) {
      try {
        await this.deleteTestUser(userId);
      } catch (error) {
        logger.warn(`Failed to cleanup user ${userId}:`, error);
      }
    }

    this.testUsers.clear();
    logger.info(`Cleaned up ${userIds.length} test users`);
  }

  /**
   * Create a test user with admin role
   */
  async createAdminUser(options: Omit<CreateTestUserOptions, 'role'> = {}): Promise<TestUser> {
    return this.createTestUser({ ...options, role: 'admin' });
  }

  /**
   * Create a test user with regular user role
   */
  async createRegularUser(options: Omit<CreateTestUserOptions, 'role'> = {}): Promise<TestUser> {
    return this.createTestUser({ ...options, role: 'user' });
  }

  /**
   * Get authorization header for a test user
   */
  async getAuthHeader(userId: string): Promise<{ Authorization: string }> {
    const token = await this.getValidAccessToken(userId);
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Verify a user's token is valid
   */
  async verifyToken(userId: string): Promise<boolean> {
    try {
      const token = await this.getValidAccessToken(userId);
      const { data, error } = await this.supabaseAdmin.auth.getUser(token);
      return !error && !!data.user;
    } catch (error) {
      logger.warn('Token verification failed:', error);
      return false;
    }
  }

  /**
   * Get user info from token
   */
  async getUserFromToken(token: string): Promise<{ id: string; email: string } | null> {
    try {
      const { data, error } = await this.supabaseAdmin.auth.getUser(token);
      if (error || !data.user) return null;

      return {
        id: data.user.id,
        email: data.user.email || '',
      };
    } catch (error) {
      logger.warn('Failed to get user from token:', error);
      return null;
    }
  }

  /**
   * Dispose of resources and cleanup
   */
  async dispose(): Promise<void> {
    await this.cleanupAllUsers();
  }
}

/**
 * Global test auth instance
 */
let globalTestAuth: TestAuth | null = null;

/**
 * Get or create the global test auth instance
 */
export function getTestAuth(testDatabase: TestDatabase): TestAuth {
  if (!globalTestAuth) {
    globalTestAuth = new TestAuth(testDatabase);
  }
  return globalTestAuth;
}

/**
 * Dispose of the global test auth instance
 */
export async function disposeTestAuth(): Promise<void> {
  if (globalTestAuth) {
    await globalTestAuth.dispose();
    globalTestAuth = null;
  }
}

/**
 * Test auth helper for Vitest setup/teardown
 */
export const testAuthHelpers = {
  /**
   * Setup before all tests
   */
  async beforeAll(testDatabase: TestDatabase): Promise<TestAuth> {
    return getTestAuth(testDatabase);
  },

  /**
   * Teardown after all tests
   */
  async afterAll(): Promise<void> {
    await disposeTestAuth();
  },
};
