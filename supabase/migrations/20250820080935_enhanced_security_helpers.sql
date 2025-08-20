-- Migration: Enhanced security policies and helper functions
-- Additional security layers and utility functions
-- Created: 2025-08-20

-- Step 1: Enhanced security policies

-- Prevent role escalation trigger (additional layer)
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Prevent role escalation (only admins can change roles)
    IF OLD.role != NEW.role THEN
        IF NOT public.is_admin(auth.uid()) THEN
            RAISE EXCEPTION 'Access denied: Only admins can change user roles';
        END IF;
    END IF;
    
    -- Prevent self soft-delete (only admins can soft delete)
    IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at AND NEW.deleted_at IS NOT NULL THEN
        IF NOT public.is_admin(auth.uid()) THEN
            RAISE EXCEPTION 'Access denied: Only admins can delete profiles';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for role escalation prevention
CREATE TRIGGER prevent_role_escalation_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW 
    EXECUTE FUNCTION public.prevent_role_escalation();

-- Step 2: Additional helper functions

-- Get current user profile
CREATE OR REPLACE FUNCTION public.get_current_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_record public.profiles;
BEGIN
    SELECT * INTO profile_record
    FROM public.profiles
    WHERE id = auth.uid() AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found for current user';
    END IF;
    
    RETURN profile_record;
END;
$$;

-- Update user profile (self-service with validation)
CREATE OR REPLACE FUNCTION public.update_my_profile(
    new_username VARCHAR(50) DEFAULT NULL,
    new_display_name VARCHAR(100) DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_profile public.profiles;
BEGIN
    -- Validate username if provided
    IF new_username IS NOT NULL THEN
        IF NOT public.is_username_available(new_username) THEN
            RAISE EXCEPTION 'Username "%" is already taken', new_username;
        END IF;
    END IF;
    
    -- Update profile
    UPDATE public.profiles
    SET 
        username = COALESCE(new_username, username),
        display_name = COALESCE(new_display_name, display_name),
        updated_at = NOW()
    WHERE id = auth.uid() AND deleted_at IS NULL
    RETURNING * INTO updated_profile;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found for current user';
    END IF;
    
    RETURN updated_profile;
END;
$$;

-- Get user profile by ID (public info only)
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS TABLE (
    id UUID,
    username VARCHAR(50),
    display_name VARCHAR(100),
    role user_role,
    avatar_url TEXT,
    created_at TIMESTAMPTZ,
    last_active TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.display_name,
        p.role,
        p.avatar_url,
        p.created_at,
        p.last_active
    FROM public.profiles p
    WHERE p.id = user_id AND p.deleted_at IS NULL;
END;
$$;

-- Get paginated user list (for leaderboards, etc.)
CREATE OR REPLACE FUNCTION public.get_users_paginated(
    page_size INTEGER DEFAULT 20,
    page_offset INTEGER DEFAULT 0,
    role_filter user_role DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    username VARCHAR(50),
    display_name VARCHAR(100),
    role user_role,
    avatar_url TEXT,
    created_at TIMESTAMPTZ,
    last_active TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.display_name,
        p.role,
        p.avatar_url,
        p.created_at,
        p.last_active
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
        AND (role_filter IS NULL OR p.role = role_filter)
    ORDER BY p.created_at DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$;

-- Get active user count
CREATE OR REPLACE FUNCTION public.get_active_user_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.profiles
        WHERE deleted_at IS NULL
    );
END;
$$;

-- Search users by display name (pattern matching)
CREATE OR REPLACE FUNCTION public.search_users(
    search_term TEXT,
    search_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    username VARCHAR(50),
    display_name VARCHAR(100),
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.display_name,
        p.avatar_url
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
        AND (
            p.display_name ILIKE '%' || search_term || '%'
            OR p.username ILIKE '%' || search_term || '%'
        )
    ORDER BY 
        CASE 
            WHEN p.display_name ILIKE search_term || '%' THEN 1
            WHEN p.username ILIKE search_term || '%' THEN 2
            ELSE 3
        END,
        p.display_name
    LIMIT search_limit;
END;
$$;

-- Step 3: Utility functions for common operations

-- Bulk update last active (for session management)
CREATE OR REPLACE FUNCTION public.bulk_update_last_active(user_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Only admins or service role can bulk update
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Only admins can bulk update activity';
    END IF;
    
    UPDATE public.profiles
    SET last_active = NOW()
    WHERE id = ANY(user_ids) AND deleted_at IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- Get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role_result user_role;
BEGIN
    SELECT role INTO user_role_result
    FROM public.profiles
    WHERE id = user_id AND deleted_at IS NULL;
    
    RETURN user_role_result;
END;
$$;

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(check_role user_role, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id 
        AND role = check_role 
        AND deleted_at IS NULL
    );
END;
$$;

-- Step 4: Enhanced views for better data access

-- Public user directory (safe public info)
CREATE VIEW public.user_directory AS
SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.created_at,
    p.last_active,
    (p.last_active > NOW() - INTERVAL '30 days') as recently_active
FROM public.profiles p
WHERE p.deleted_at IS NULL
    AND p.username IS NOT NULL; -- Only show users with usernames

-- Role distribution stats
CREATE VIEW public.role_stats AS
SELECT 
    role,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.profiles
WHERE deleted_at IS NULL
GROUP BY role
ORDER BY count DESC;

-- Step 5: Grant permissions

-- Self-service functions
GRANT EXECUTE ON FUNCTION public.get_current_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(VARCHAR(50), VARCHAR(100)) TO authenticated;

-- Public data access functions
GRANT EXECUTE ON FUNCTION public.get_user_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_paginated(INTEGER, INTEGER, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_user_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(TEXT, INTEGER) TO authenticated;

-- Role checking functions
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(user_role, UUID) TO authenticated;

-- Admin-only functions
GRANT EXECUTE ON FUNCTION public.bulk_update_last_active(UUID[]) TO authenticated;

-- Public views
GRANT SELECT ON public.user_directory TO authenticated;
GRANT SELECT ON public.role_stats TO anon, authenticated;

-- Step 6: Security enhancements

-- Function to validate session
CREATE OR REPLACE FUNCTION public.validate_user_session()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user exists and is active
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND deleted_at IS NULL
    );
END;
$$;

-- Update session on access
CREATE OR REPLACE FUNCTION public.touch_user_session()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update last active timestamp
    UPDATE public.profiles
    SET last_active = NOW()
    WHERE id = auth.uid() AND deleted_at IS NULL;
END;
$$;

-- Grant session functions
GRANT EXECUTE ON FUNCTION public.validate_user_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_user_session() TO authenticated;

-- Step 7: Comments for documentation
COMMENT ON FUNCTION public.prevent_role_escalation() IS 'Trigger function to prevent unauthorized role changes';
COMMENT ON FUNCTION public.get_current_profile() IS 'Get the current authenticated user profile';
COMMENT ON FUNCTION public.update_my_profile(VARCHAR(50), VARCHAR(100)) IS 'Update current user profile with validation';
COMMENT ON FUNCTION public.get_user_profile(UUID) IS 'Get public profile information for any user';
COMMENT ON FUNCTION public.get_users_paginated(INTEGER, INTEGER, user_role) IS 'Get paginated list of users';
COMMENT ON FUNCTION public.get_active_user_count() IS 'Get count of active users';
COMMENT ON FUNCTION public.search_users(TEXT, INTEGER) IS 'Search users by display name or username';
COMMENT ON FUNCTION public.bulk_update_last_active(UUID[]) IS 'Bulk update last active timestamps (admin only)';
COMMENT ON FUNCTION public.get_user_role(UUID) IS 'Get user role by ID';
COMMENT ON FUNCTION public.has_role(user_role, UUID) IS 'Check if user has specific role';
COMMENT ON FUNCTION public.validate_user_session() IS 'Validate current user session';
COMMENT ON FUNCTION public.touch_user_session() IS 'Update last active timestamp for session';
COMMENT ON VIEW public.user_directory IS 'Public directory of users with usernames';
COMMENT ON VIEW public.role_stats IS 'Statistics of user role distribution';
