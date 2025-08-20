-- Reset database to blank state
-- Remove all custom functions, triggers, policies, tables, and schemas

-- Drop triggers first
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists trg_profiles_updated on app.profiles;

-- Drop functions
drop function if exists app.handle_new_user();
drop function if exists app.touch_updated_at();

-- Drop policies
drop policy if exists "profiles_select_public" on app.profiles;
drop policy if exists "profiles_insert_self" on app.profiles;
drop policy if exists "profiles_update_self" on app.profiles;

-- Drop tables
drop table if exists app.profiles cascade;

-- Drop schema
drop schema if exists app cascade;

-- Note: Extensions are left intact as they don't contain data
-- and may be needed for future use
