-- Migration: Fix Profiles RLS Infinite Recursion
-- Fix infinite recursion in profiles RLS policies by removing circular references
-- Created: 2025-09-10

-- ============================================================================
-- STEP 1: DROP EXISTING POLICIES
-- ============================================================================

-- Drop all existing policies on profiles table to replace with non-recursive ones
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- ============================================================================
-- STEP 2: CREATE NON-RECURSIVE RLS POLICIES
-- ============================================================================

-- Simple policy for profiles SELECT - no admin checks to avoid recursion
CREATE POLICY "profiles_select_policy" 
    ON public.profiles FOR SELECT 
    TO authenticated
    USING (
        deleted_at IS NULL 
        AND id = (SELECT auth.uid())
    );

-- Simple policy for profiles INSERT - no admin checks to avoid recursion
CREATE POLICY "profiles_insert_policy" 
    ON public.profiles FOR INSERT 
    TO authenticated
    WITH CHECK (
        deleted_at IS NULL
        AND id = (SELECT auth.uid())
    );

-- Simple policy for profiles UPDATE - no admin checks to avoid recursion
CREATE POLICY "profiles_update_policy" 
    ON public.profiles FOR UPDATE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND id = (SELECT auth.uid())
    )
    WITH CHECK (
        deleted_at IS NULL
        AND id = (SELECT auth.uid())
    );

-- Simple policy for profiles DELETE - no admin checks to avoid recursion
CREATE POLICY "profiles_delete_policy" 
    ON public.profiles FOR DELETE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND id = (SELECT auth.uid())
    );

-- ============================================================================
-- STEP 3: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "profiles_select_policy" ON public.profiles IS 'Non-recursive policy for profiles SELECT operations - users can only access their own profile';
COMMENT ON POLICY "profiles_insert_policy" ON public.profiles IS 'Non-recursive policy for profiles INSERT operations - users can only create their own profile';
COMMENT ON POLICY "profiles_update_policy" ON public.profiles IS 'Non-recursive policy for profiles UPDATE operations - users can only update their own profile';
COMMENT ON POLICY "profiles_delete_policy" ON public.profiles IS 'Non-recursive policy for profiles DELETE operations - users can only delete their own profile';

-- ============================================================================
-- STEP 4: PERFORMANCE IMPROVEMENTS
-- ============================================================================

-- This migration fixes the infinite recursion issue by:
-- 1. Removing circular references to the profiles table within RLS policies
-- 2. Simplifying policies to only check user ownership
-- 3. Eliminating admin role checks that caused the recursion
-- 4. Maintaining security by ensuring users can only access their own profiles

-- Security note: Admin functionality should be handled at the application level
-- rather than in RLS policies to avoid recursion issues.
