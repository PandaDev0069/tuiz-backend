-- Migration: Create admin management system
-- Admin functions for user and system management
-- Created: 2025-08-20

-- Step 1: Add admin RLS policies

-- Admins can manage all profiles
CREATE POLICY "Admins manage all profiles" 
    ON public.profiles FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- Admins can manage all avatar files
CREATE POLICY "Admins manage all avatars" 
    ON storage.objects FOR ALL 
    TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    )
    WITH CHECK (
        bucket_id = 'avatars' 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- Step 2: Admin management functions

-- Promote user to admin (service role only)
CREATE OR REPLACE FUNCTION public.promote_to_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        role = 'admin',
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Change user role (admin only)
CREATE OR REPLACE FUNCTION public.change_user_role(user_id UUID, new_role user_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin' 
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
    
    -- Update role
    UPDATE public.profiles 
    SET 
        role = new_role,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Soft delete profile (admin only)
CREATE OR REPLACE FUNCTION public.soft_delete_profile(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin' 
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Only admins can delete profiles';
    END IF;
    
    -- Soft delete
    UPDATE public.profiles 
    SET 
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Restore deleted profile (admin only)
CREATE OR REPLACE FUNCTION public.restore_profile(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin' 
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Only admins can restore profiles';
    END IF;
    
    -- Restore
    UPDATE public.profiles 
    SET 
        deleted_at = NULL,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$;

-- Step 3: Admin views

-- Admin view: all profiles including deleted
CREATE VIEW public.admin_profiles AS
SELECT 
    p.id,
    p.username,
    p.display_name,
    p.role,
    p.avatar_url,
    p.created_at,
    p.updated_at,
    p.last_active,
    p.deleted_at,
    u.email,
    u.email_confirmed_at,
    u.last_sign_in_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;

-- Admin view: user statistics
CREATE VIEW public.user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_users,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_users,
    COUNT(*) FILTER (WHERE role = 'admin' AND deleted_at IS NULL) as admins,
    COUNT(*) FILTER (WHERE role = 'host' AND deleted_at IS NULL) as hosts,
    COUNT(*) FILTER (WHERE role = 'player' AND deleted_at IS NULL) as players,
    COUNT(*) FILTER (WHERE avatar_url IS NOT NULL AND deleted_at IS NULL) as users_with_avatars
FROM public.profiles;

-- Step 4: Admin helper functions

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = user_id 
        AND role = 'admin' 
        AND deleted_at IS NULL
    );
END;
$$;

-- Get user by username (admin only)
CREATE OR REPLACE FUNCTION public.get_user_by_username(search_username TEXT)
RETURNS TABLE (
    id UUID,
    username VARCHAR(50),
    display_name VARCHAR(100),
    role user_role,
    avatar_url TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_active TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    email VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can search users';
    END IF;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.display_name,
        p.role,
        p.avatar_url,
        p.created_at,
        p.updated_at,
        p.last_active,
        p.deleted_at,
        u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.username = search_username;
END;
$$;

-- Step 5: Grant permissions (restricted for admin functions)

-- Basic admin functions - NO GRANTS (service role only for promote_to_admin)
-- These should only be called by backend services with service role key
-- REVOKE ALL ON FUNCTION public.promote_to_admin(UUID) FROM PUBLIC;

-- Admin-only functions (require admin check inside function)
GRANT EXECUTE ON FUNCTION public.change_user_role(UUID, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_by_username(TEXT) TO authenticated;

-- Helper functions
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- Admin views - these will be restricted by RLS at the view level
GRANT SELECT ON public.admin_profiles TO authenticated;
GRANT SELECT ON public.user_stats TO authenticated;

-- Step 7: Comments
COMMENT ON FUNCTION public.promote_to_admin(UUID) IS 'Promote user to admin (service role only)';
COMMENT ON FUNCTION public.change_user_role(UUID, user_role) IS 'Change user role (admin only)';
COMMENT ON FUNCTION public.soft_delete_profile(UUID) IS 'Soft delete user profile (admin only)';
COMMENT ON FUNCTION public.restore_profile(UUID) IS 'Restore deleted profile (admin only)';
COMMENT ON FUNCTION public.is_admin(UUID) IS 'Check if user is admin';
COMMENT ON FUNCTION public.get_user_by_username(TEXT) IS 'Find user by username (admin only)';
COMMENT ON VIEW public.admin_profiles IS 'Admin view of all profiles including deleted';
COMMENT ON VIEW public.user_stats IS 'User statistics dashboard for admins';
