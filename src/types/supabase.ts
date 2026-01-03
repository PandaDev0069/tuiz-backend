// ====================================================
// File Name   : supabase.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2025-09-10

// Description:
// - Type definitions for Supabase client operations
// - Provides type-safe wrappers for Supabase query builders
// - Eliminates 'any' types in database operations

// Notes:
// - Covers select, insert, update, delete operations
// - Supports chained query methods (eq, or, order, range)
// - Includes RPC function call types
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
// No external dependencies - pure type definitions

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Interface: SupabaseResponse
 * Description:
 * - Standard response structure for all Supabase operations
 * - Contains data array, error object, and optional count
 * - Used as return type for queries, inserts, updates, and deletes
 */
export interface SupabaseResponse {
  data: unknown[] | null;
  error: Error | null;
  count?: number;
}

/**
 * Interface: SupabaseQueryBuilder
 * Description:
 * - Type-safe query builder for SELECT operations
 * - Supports chained methods: eq, or, order, range
 * - Provides single, maybeSingle, and then methods for result handling
 * - Methods can be chained to build complex queries
 */
export interface SupabaseQueryBuilder {
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  or: (filter: string) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  range: (start: number, end: number) => Promise<SupabaseResponse>;
  maybeSingle: () => Promise<SupabaseResponse>;
  single: () => Promise<SupabaseResponse>;
  then: (resolve: (value: SupabaseResponse) => void) => Promise<SupabaseResponse>;
}

/**
 * Interface: SupabaseInsertBuilder
 * Description:
 * - Type-safe builder for INSERT operations
 * - Supports optional column selection after insert
 * - Returns single result via select().single() chain
 */
export interface SupabaseInsertBuilder {
  select: (columns?: string) => {
    single: () => Promise<SupabaseResponse>;
  };
}

/**
 * Interface: SupabaseUpdateBuilder
 * Description:
 * - Type-safe builder for UPDATE operations
 * - Supports chained eq() calls for WHERE conditions
 * - Supports optional column selection after update
 * - Can chain multiple eq() calls for complex WHERE clauses
 */
export interface SupabaseUpdateBuilder {
  eq: (
    column: string,
    value: unknown,
  ) => {
    eq: (
      column: string,
      value: unknown,
    ) => {
      select: (columns?: string) => {
        single: () => Promise<SupabaseResponse>;
      };
    };
    select: (columns?: string) => {
      single: () => Promise<SupabaseResponse>;
    };
  };
}

/**
 * Interface: SupabaseDeleteBuilder
 * Description:
 * - Type-safe builder for DELETE operations
 * - Supports chained eq() calls for WHERE conditions
 * - Returns promise with SupabaseResponse on execution
 * - Can chain multiple eq() calls for complex WHERE clauses
 */
export interface SupabaseDeleteBuilder {
  eq: (
    column: string,
    value: unknown,
  ) => {
    eq: (column: string, value: unknown) => Promise<SupabaseResponse>;
  };
}

/**
 * Interface: SupabaseTable
 * Description:
 * - Represents a Supabase table with CRUD operations
 * - Provides select, insert, update, and delete methods
 * - Entry point for all table-level operations
 */
export interface SupabaseTable {
  select: (columns?: string, options?: { count?: string }) => SupabaseQueryBuilder;
  insert: (data: unknown) => SupabaseInsertBuilder;
  update: (data: unknown) => SupabaseUpdateBuilder;
  delete: () => SupabaseDeleteBuilder;
}

/**
 * Interface: SupabaseClient
 * Description:
 * - Main Supabase client interface
 * - Provides table access via from() method
 * - Supports RPC function calls for stored procedures
 * - Entry point for all Supabase database operations
 */
export interface SupabaseClient {
  from: (table: string) => SupabaseTable;
  rpc: (functionName: string, params?: unknown) => Promise<SupabaseResponse>;
}
