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
// 1. Query Builder Types
//----------------------------------------------------
export interface SupabaseQueryBuilder {
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  or: (filter: string) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  range: (start: number, end: number) => Promise<SupabaseResponse>;
  maybeSingle: () => Promise<SupabaseResponse>;
  single: () => Promise<SupabaseResponse>;
  then: (resolve: (value: SupabaseResponse) => void) => Promise<SupabaseResponse>;
}

export interface SupabaseResponse {
  data: unknown[] | null;
  error: Error | null;
  count?: number;
}

//----------------------------------------------------
// 2. Insert Builder Types
//----------------------------------------------------
export interface SupabaseInsertBuilder {
  select: (columns?: string) => {
    single: () => Promise<SupabaseResponse>;
  };
}

//----------------------------------------------------
// 3. Update Builder Types
//----------------------------------------------------
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

//----------------------------------------------------
// 4. Delete Builder Types
//----------------------------------------------------
export interface SupabaseDeleteBuilder {
  eq: (
    column: string,
    value: unknown,
  ) => {
    eq: (column: string, value: unknown) => Promise<SupabaseResponse>;
  };
}

//----------------------------------------------------
// 5. Client Interface
//----------------------------------------------------
export interface SupabaseTable {
  select: (columns?: string, options?: { count?: string }) => SupabaseQueryBuilder;
  insert: (data: unknown) => SupabaseInsertBuilder;
  update: (data: unknown) => SupabaseUpdateBuilder;
  delete: () => SupabaseDeleteBuilder;
}

export interface SupabaseClient {
  from: (table: string) => SupabaseTable;
  rpc: (functionName: string, params?: unknown) => Promise<SupabaseResponse>;
}
