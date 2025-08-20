-- Migration: Drop all existing objects for clean slate
-- This will remove all tables, functions, views, policies, and types we created
-- Created: 2025-08-20

-- Step 1: Drop all views first (they depend on tables)
DROP VIEW IF EXISTS public.user_avatars CASCADE;
DROP VIEW IF EXISTS public.profile_accounts CASCADE;

-- Step 2: Drop all functions (remove dependencies)
DROP FUNCTION IF EXISTS public.generate_avatar_path(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_avatar_url(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.remove_avatar(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.validate_avatar_file(TEXT, BIGINT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_sensitive_updates() CASCADE;
DROP FUNCTION IF EXISTS public.soft_delete_profile(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.restore_profile(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_last_active(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_username_available(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.promote_to_admin(UUID) CASCADE;

-- Step 3: Drop all storage policies
DROP POLICY IF EXISTS "Avatar files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all avatars" ON storage.objects;

-- Step 4: Drop storage buckets
DELETE FROM storage.buckets WHERE id = 'avatars';

-- Step 5: Drop all RLS policies on profiles table
DROP POLICY IF EXISTS "Authenticated users can view active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Block direct profile insertion" ON public.profiles;
DROP POLICY IF EXISTS "Block direct profile deletion" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON public.profiles;

-- Step 6: Drop the profiles table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Step 7: Drop custom types
DROP TYPE IF EXISTS user_role CASCADE;

-- Step 8: Clean up any remaining triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Confirmation message
DO $$ 
BEGIN 
    RAISE NOTICE 'All custom objects dropped successfully. Ready for clean rebuild.';
END $$;
