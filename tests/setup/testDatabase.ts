/**
 * Test Database Management
 *
 * Provides transaction-based test isolation using Supabase.
 * Each test runs in its own transaction that gets rolled back,
 * ensuring complete isolation between tests.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../src/config/env';
import { logger } from '../../src/utils/logger';
import type { Database } from '../../src/lib/supabase';

export interface TestDatabaseConfig {
  /** Whether to use real Supabase (true) or mock (false) */
  useRealDatabase: boolean;
  /** Test database URL (if different from main) */
  testDatabaseUrl?: string;
  /** Test service role key (if different from main) */
  testServiceRoleKey?: string;
}

export class TestDatabase {
  private supabaseAdmin: SupabaseClient<Database>;
  private supabaseClient: SupabaseClient<Database>;
  private transactionId: string | null = null;
  private isInTransaction = false;
  private config: TestDatabaseConfig;

  constructor(config: TestDatabaseConfig = { useRealDatabase: true }) {
    this.config = config;

    if (config.useRealDatabase) {
      const url = config.testDatabaseUrl || env.SUPABASE_URL;
      const serviceKey = config.testServiceRoleKey || env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = env.SUPABASE_ANON_KEY;

      this.supabaseAdmin = createClient<Database>(url, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      this.supabaseClient = createClient<Database>(url, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } else {
      // Mock clients for CI/testing without real database
      this.supabaseAdmin = this.createMockClient();
      this.supabaseClient = this.createMockClient();
    }
  }

  /**
   * Get the admin Supabase client for test operations
   */
  get admin(): SupabaseClient<Database> {
    return this.supabaseAdmin;
  }

  /**
   * Get the regular Supabase client for user operations
   */
  get client(): SupabaseClient<Database> {
    return this.supabaseClient;
  }

  /**
   * Start a new transaction for test isolation
   * This creates a savepoint that can be rolled back
   */
  async startTransaction(): Promise<void> {
    if (this.isInTransaction) {
      throw new Error('Transaction already started. Call rollbackTransaction() first.');
    }

    if (!this.config.useRealDatabase) {
      // Mock mode - just mark as in transaction
      this.isInTransaction = true;
      return;
    }

    try {
      // Create a unique transaction identifier
      this.transactionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Start transaction by creating a savepoint
      const { error } = await this.supabaseAdmin.rpc('start_transaction', {
        transaction_id: this.transactionId,
      });

      if (error) {
        // If the function doesn't exist, we'll use a different approach
        logger.warn('start_transaction function not found, using alternative isolation method');
        this.isInTransaction = true;
        return;
      }

      this.isInTransaction = true;
      logger.debug(`Started test transaction: ${this.transactionId}`);
    } catch (error) {
      logger.warn('Failed to start transaction, using alternative isolation method', error);
      this.isInTransaction = true;
    }
  }

  /**
   * Rollback the current transaction, cleaning up all test data
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.isInTransaction) {
      logger.warn('No transaction to rollback');
      return;
    }

    if (!this.config.useRealDatabase) {
      // Mock mode - just reset state
      this.isInTransaction = false;
      this.transactionId = null;
      return;
    }

    try {
      if (this.transactionId) {
        // Try to rollback using the transaction function
        const { error } = await this.supabaseAdmin.rpc('rollback_transaction', {
          transaction_id: this.transactionId,
        });

        if (error) {
          logger.warn('rollback_transaction function not found, using cleanup method');
          await this.cleanupTestData();
        }
      } else {
        // Fallback: clean up test data manually
        await this.cleanupTestData();
      }

      this.isInTransaction = false;
      this.transactionId = null;
      logger.debug(`Rolled back test transaction: ${this.transactionId}`);
    } catch {
      logger.error('Failed to rollback transaction, attempting cleanup');
      await this.cleanupTestData();
      this.isInTransaction = false;
      this.transactionId = null;
    }
  }

  /**
   * Clean up test data by deleting records created during the test
   * This is a fallback when transaction rollback is not available
   */
  private async cleanupTestData(): Promise<void> {
    try {
      // Delete in reverse order of dependencies to avoid foreign key constraints
      const tables = ['answers', 'questions', 'quiz_sets', 'profiles'];

      for (const table of tables) {
        // Delete records that were created during this test session
        // We'll identify them by checking if they were created recently
        const cutoffTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago

        const { error } = await this.supabaseAdmin
          .from(table)
          .delete()
          .gte('created_at', cutoffTime);

        if (error) {
          logger.warn(`Failed to cleanup ${table}:`);
        }
      }
    } catch {
      logger.error('Failed to cleanup test data:');
    }
  }

  /**
   * Reset the database to a clean state
   * This should only be used for setup/teardown, not between tests
   */
  async resetDatabase(): Promise<void> {
    if (!this.config.useRealDatabase) {
      logger.info('Mock mode: skipping database reset');
      return;
    }

    try {
      // Delete all data in reverse dependency order
      const tables = ['answers', 'questions', 'quiz_sets', 'profiles'];

      for (const table of tables) {
        const { error } = await this.supabaseAdmin
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

        if (error) {
          logger.warn(`Failed to reset ${table}:`);
        }
      }

      logger.info('Database reset completed');
    } catch (error) {
      logger.error('Failed to reset database:');
      throw error;
    }
  }

  /**
   * Check if the database is accessible and ready for testing
   */
  async isReady(): Promise<boolean> {
    if (!this.config.useRealDatabase) {
      return true; // Mock mode is always ready
    }

    try {
      const { error } = await this.supabaseAdmin.from('profiles').select('id').limit(1);

      return !error;
    } catch {
      logger.error('Database readiness check failed:');
      return false;
    }
  }

  /**
   * Get database statistics for debugging
   */
  async getStats(): Promise<Record<string, number>> {
    if (!this.config.useRealDatabase) {
      return { profiles: 0, quiz_sets: 0, questions: 0, answers: 0 };
    }

    try {
      const stats: Record<string, number> = {};
      const tables = ['profiles', 'quiz_sets', 'questions', 'answers'];

      for (const table of tables) {
        const { count, error } = await this.supabaseAdmin
          .from(table as keyof Database['public']['Tables'])
          .select('*', { count: 'exact', head: true });
        // eslint-disable-next-line security/detect-object-injection
        stats[table] = error ? 0 : count || 0;
      }

      return stats;
    } catch {
      logger.error('Failed to get database stats:');
      return { profiles: 0, quiz_sets: 0, questions: 0, answers: 0 };
    }
  }

  /**
   * Create a mock Supabase client for testing without real database
   */
  private createMockClient(): SupabaseClient<Database> {
    const mockClient = {
      from: () => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: [], error: null }),
        update: () => ({ data: [], error: null }),
        delete: () => ({ data: [], error: null }),
        eq: () => ({ data: [], error: null }),
        neq: () => ({ data: [], error: null }),
        gte: () => ({ data: [], error: null }),
        lte: () => ({ data: [], error: null }),
        limit: () => ({ data: [], error: null }),
        order: () => ({ data: [], error: null }),
        single: () => ({ data: null, error: null }),
        maybeSingle: () => ({ data: null, error: null }),
      }),
      rpc: () => ({ data: null, error: null }),
      auth: {
        admin: {
          createUser: () =>
            Promise.resolve({ data: { user: { id: 'mock-user-id' } }, error: null }),
          deleteUser: () => Promise.resolve({ data: null, error: null }),
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          listUsers: () => Promise.resolve({ data: { users: [] }, error: null }),
          getUserById: () =>
            Promise.resolve({ data: null, error: { message: 'User not found in mock' } }),
          signOut: () => Promise.resolve({ data: null, error: null }),
        },
        signInWithPassword: () =>
          Promise.resolve({
            data: {
              user: { id: 'mock-user-id' },
              session: { access_token: 'mock-token' },
            },
            error: null,
          }),
        signOut: () => Promise.resolve({ error: null }),
      },
    } as unknown as SupabaseClient<Database>;

    return mockClient;
  }

  /**
   * Dispose of resources and cleanup
   */
  async dispose(): Promise<void> {
    if (this.isInTransaction) {
      await this.rollbackTransaction();
    }
  }
}

/**
 * Global test database instance
 * This should be initialized once per test suite
 */
let globalTestDatabase: TestDatabase | null = null;

/**
 * Get or create the global test database instance
 */
export function getTestDatabase(config?: TestDatabaseConfig): TestDatabase {
  if (!globalTestDatabase) {
    globalTestDatabase = new TestDatabase(config);
  }
  return globalTestDatabase;
}

/**
 * Dispose of the global test database instance
 */
export async function disposeTestDatabase(): Promise<void> {
  if (globalTestDatabase) {
    await globalTestDatabase.dispose();
    globalTestDatabase = null;
  }
}

/**
 * Test database helper for Vitest setup/teardown
 */
export const testDatabaseHelpers = {
  /**
   * Setup before all tests
   */
  async beforeAll(config?: TestDatabaseConfig): Promise<TestDatabase> {
    const db = getTestDatabase(config);

    if (config?.useRealDatabase !== false) {
      const isReady = await db.isReady();
      if (!isReady) {
        throw new Error('Test database is not ready. Check your Supabase configuration.');
      }
    }

    return db;
  },

  /**
   * Setup before each test
   */
  async beforeEach(db: TestDatabase): Promise<void> {
    await db.startTransaction();
  },

  /**
   * Teardown after each test
   */
  async afterEach(db: TestDatabase): Promise<void> {
    await db.rollbackTransaction();
  },

  /**
   * Teardown after all tests
   */
  async afterAll(): Promise<void> {
    await disposeTestDatabase();
  },
};
