-- Migration: Fix Remaining Security Definer Views
-- Fix user_stats and role_stats views that still have SECURITY DEFINER property
-- Created: 2025-09-09

-- ============================================================================
-- STEP 1: DROP AND RECREATE VIEWS WITHOUT SECURITY DEFINER
-- ============================================================================

-- Drop the existing views that have SECURITY DEFINER property
DROP VIEW IF EXISTS public.user_stats CASCADE;
DROP VIEW IF EXISTS public.role_stats CASCADE;

-- ============================================================================
-- STEP 2: CREATE SECURE REPLACEMENT VIEWS
-- ============================================================================

-- Recreate user_stats view without SECURITY DEFINER
-- This view aggregates data from profiles table only
CREATE VIEW public.user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN role = 'host' THEN 1 END) as host_count,
    COUNT(CASE WHEN role = 'player' THEN 1 END) as player_count,
    COUNT(CASE WHEN last_active > NOW() - INTERVAL '30 days' THEN 1 END) as active_users_30d,
    COUNT(CASE WHEN last_active > NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d
FROM public.profiles
WHERE deleted_at IS NULL;

-- Recreate role_stats view without SECURITY DEFINER
-- This view provides role-based statistics
CREATE VIEW public.role_stats AS
SELECT 
    p.role,
    COUNT(*) as user_count,
    COUNT(CASE WHEN p.last_active > NOW() - INTERVAL '30 days' THEN 1 END) as active_users_30d,
    COUNT(CASE WHEN p.last_active > NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d
FROM public.profiles p
WHERE p.deleted_at IS NULL
GROUP BY p.role;

-- ============================================================================
-- STEP 3: CONFIGURE VIEW SECURITY
-- ============================================================================

-- Set views to use security_invoker (not SECURITY DEFINER)
-- This ensures views run with the permissions of the querying user
ALTER VIEW public.user_stats SET (security_invoker = true);
ALTER VIEW public.role_stats SET (security_invoker = true);

-- ============================================================================
-- STEP 4: GRANT APPROPRIATE PERMISSIONS
-- ============================================================================

-- Grant select permissions to authenticated users
GRANT SELECT ON public.user_stats TO authenticated;
GRANT SELECT ON public.role_stats TO authenticated;

-- ============================================================================
-- STEP 5: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON VIEW public.user_stats IS 'General user statistics - aggregated from profiles table, uses security_invoker';
COMMENT ON VIEW public.role_stats IS 'Role-based user statistics - aggregated from profiles table, uses security_invoker';

-- ============================================================================
-- STEP 6: VERIFY SECURITY CONFIGURATION
-- ============================================================================

-- Verify that views are configured with security_invoker
-- This can be checked with:
-- SELECT schemaname, viewname, viewowner, definition 
-- FROM pg_views 
-- WHERE schemaname = 'public' 
-- AND viewname IN ('user_stats', 'role_stats');

-- ============================================================================
-- STEP 7: SECURITY NOTES
-- ============================================================================

-- This migration ensures that:
-- 1. All views use security_invoker = true (not SECURITY DEFINER)
-- 2. Views respect the RLS policies of the querying user
-- 3. No privilege escalation through view definitions
-- 4. Proper permission inheritance from underlying tables
-- 5. All data access goes through the profiles table RLS policies
