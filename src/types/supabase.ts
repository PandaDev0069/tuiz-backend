// src/types/supabase.ts
// Type definitions for Supabase operations to avoid 'any' types

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

export interface SupabaseInsertBuilder {
  select: (columns?: string) => {
    single: () => Promise<SupabaseResponse>;
  };
}

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

export interface SupabaseDeleteBuilder {
  eq: (
    column: string,
    value: unknown,
  ) => {
    eq: (column: string, value: unknown) => Promise<SupabaseResponse>;
  };
}

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
