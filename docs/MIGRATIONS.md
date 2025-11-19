# Database Migrations

## Overview

This project uses Supabase CLI for database migrations. All migrations are stored in `supabase/migrations/` and are automatically applied in chronological order based on their timestamp prefix.

## Migration Workflow

### Local Development

```bash
# Start local Supabase (applies all migrations)
supabase start

# Create a new migration
supabase migration new <descriptive-name>

# Reset database (drops and recreates with all migrations)
supabase db reset

# Check migration status
supabase migration list

# Run linter to check for security issues
supabase db lint
```

### Production Deployment

```bash
# Push migrations to remote database
supabase db push

# Verify migration status
supabase migration list
```

## Recent Migrations

### 20251119025130_fix_current_setting_rls_warnings.sql

**Purpose**: Fix remaining `current_setting()` performance warnings in RLS policies

**Changes**:

- Wrapped all `current_setting('request.headers')` calls with `(SELECT current_setting('request.headers', true))` to prevent per-row re-evaluation
- Added `true` parameter to make setting retrieval non-failing if header is missing
- Affected policies:
  - `games`: "Users can update their own games"
  - `players`: "Players can update their own data"
  - `game_flows`: "Game hosts can insert/update/delete game flows" (3 policies)
  - `game_player_data`: "Players can insert/update their own data" (2 policies)

**Performance Impact**:

- Completes the RLS optimization by caching all function calls (auth + current_setting)
- Resolves all 7 remaining auth_rls_initplan warnings
- Prevents per-row re-evaluation of request headers in device-based authentication

**Reference**: [Supabase RLS Performance - Call Functions with SELECT](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)

### 20251119024857_fix_rls_performance_warnings.sql

**Purpose**: Fix RLS performance warnings from Supabase linter

**Changes**:

- Wrapped all `auth.uid()` and `auth.role()` calls with `(SELECT auth.uid())` to prevent per-row re-evaluation
- Consolidated duplicate SELECT policies on `game_flows` table into a single policy
- Split `game_flows` "ALL" policy into separate INSERT, UPDATE, DELETE policies for clarity
- Affected tables: `games`, `players`, `game_flows`, `game_player_data`

**Performance Impact**:

- Reduces query overhead by caching auth function results (prevents re-evaluation for each row)
- Eliminates redundant policy evaluations on `game_flows` table
- Resolves 13 linter warnings (8 auth_rls_initplan + 5 multiple_permissive_policies)

**Reference**: [Supabase RLS Performance - Call Functions with SELECT](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)

### 20251112030153_fix_function_search_path_security.sql

**Purpose**: Fix security warnings for function search_path mutability

**Changes**:

- Added `SET search_path = ''` to three functions to prevent privilege escalation attacks
- Functions updated:
  - `update_updated_at_column()` - Trigger function for updated_at timestamps
  - `update_game_player_count()` - Trigger function for player count maintenance
  - `get_game_leaderboard()` - Security definer function for leaderboard queries

**Security Impact**: Prevents malicious users from creating objects in their own schema that could be called instead of intended functions.

**Reference**: [Supabase Database Linter - Function Search Path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

### 20251017061513_create_game_system.sql

**Purpose**: Create real-time game system tables

**Changes**:

- Created `games`, `players`, `game_flows`, and `game_player_data` tables
- Added RLS policies for game access control
- Created helper functions for leaderboard and player count management
- Added triggers for automatic player count updates

## Best Practices

### Function Security

Always use `SET search_path = ''` in function definitions:

```sql
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- Prevents privilege escalation
AS $$
BEGIN
    -- Use fully qualified table names
    UPDATE public.my_table SET updated_at = NOW();
END;
$$;
```

### Storage Buckets

For Supabase CLI v2.34.3+, use simplified bucket creation:

```sql
-- Simple bucket creation (compatible with newer versions)
INSERT INTO storage.buckets (id, name)
VALUES ('bucket-name', 'bucket-name')
ON CONFLICT (id) DO NOTHING;
```

Avoid using deprecated columns: `public`, `file_size_limit`, `allowed_mime_types`

### Migration Naming

Use descriptive names with timestamp prefix:

- Format: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Example: `20251112030153_fix_function_search_path_security.sql`

### Testing Migrations

1. Test locally with `supabase db reset`
2. Run linter with `supabase db lint`
3. Review warnings and errors before pushing to production
4. Push to production with `supabase db push`

## Troubleshooting

### Port Conflicts (Windows)

If you encounter port conflicts, update `supabase/config.toml`:

```toml
[api]
port = 55321  # Default: 54321

[db]
port = 55432  # Default: 54322

[studio]
port = 55323  # Default: 54323
```

### Storage Container Issues

If storage service fails to start, temporarily disable it:

```toml
[storage]
enabled = false
```

Update Supabase CLI to the latest version for better storage support.

### Migration Conflicts

If migrations are out of sync between local and remote:

```bash
# Check status
supabase migration list

# Pull remote migrations
supabase db pull

# Or reset local to match remote
supabase db reset
```

## Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Database Linter Rules](https://supabase.com/docs/guides/database/database-linter)
- [Migration Best Practices](https://supabase.com/docs/guides/database/migrations)
