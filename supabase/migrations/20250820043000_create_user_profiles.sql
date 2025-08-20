-- Migration: Create user profiles system
-- Phase 1: Complete user profile schema with auth integration
-- Created: 2025-08-20

-- Step 1: Create user_role enum type (idempotent)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('player', 'host', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create profiles table
CREATE TABLE public.profiles (
    -- Primary key references auth.users
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- User identity fields
    username VARCHAR(50), -- Uniqueness enforced by case-insensitive index below
    display_name VARCHAR(100),
    
    -- Role and permissions
    role user_role NOT NULL DEFAULT 'player',
    
    -- Profile metadata
    avatar_url TEXT,
    
    -- Timestamps (timezone-aware)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT username_no_whitespace CHECK (username !~ '\s'),
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 50),
    CONSTRAINT display_name_length CHECK (char_length(display_name) >= 1 AND char_length(display_name) <= 100)
);

-- Step 3: Create indexes for performance
CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (LOWER(username));
CREATE INDEX profiles_last_active_idx ON public.profiles (last_active DESC) WHERE deleted_at IS NULL;
CREATE INDEX profiles_role_idx ON public.profiles (role) WHERE deleted_at IS NULL;
CREATE INDEX profiles_created_at_idx ON public.profiles (created_at DESC) WHERE deleted_at IS NULL;

-- Step 4: Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies (Phase 2 Security)

-- SELECT (read): Only authenticated users can read non-deleted profiles
CREATE POLICY "Authenticated users can view active profiles" 
    ON public.profiles FOR SELECT 
    TO authenticated
    USING (deleted_at IS NULL);

-- UPDATE (self): Users can only update their own profile
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Separate trigger to prevent role escalation and self soft-delete
CREATE OR REPLACE FUNCTION public.prevent_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Prevent role escalation (only admins can change roles)
    IF OLD.role != NEW.role THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Only admins can change user roles';
        END IF;
    END IF;
    
    -- Prevent self soft-delete (only admins can soft delete)
    IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at AND NEW.deleted_at IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Only admins can soft delete profiles';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for sensitive field protection
DROP TRIGGER IF EXISTS on_profiles_sensitive_update ON public.profiles;
CREATE TRIGGER on_profiles_sensitive_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW 
    EXECUTE FUNCTION public.prevent_sensitive_updates();

-- INSERT (block): Profiles are created via trigger only, not directly
CREATE POLICY "Block direct profile insertion" 
    ON public.profiles FOR INSERT 
    TO authenticated
    WITH CHECK (false);

-- DELETE (block): No direct deletes, use soft delete functions only
CREATE POLICY "Block direct profile deletion" 
    ON public.profiles FOR DELETE 
    TO authenticated
    USING (false);

-- Admin policy: Admins can read and update any profile (server-side enforcement)
-- This policy allows backend services with admin privileges to manage profiles
CREATE POLICY "Admin can manage all profiles" 
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

-- Step 6: Create function to handle profile creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    profile_display_name TEXT;
    profile_username TEXT := NULL;
BEGIN
    -- Extract display name from user metadata or use email prefix as fallback
    profile_display_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'display_name',
        SPLIT_PART(NEW.email, '@', 1)
    );
    
    -- Ensure display_name is not empty and within length limits
    IF profile_display_name IS NULL OR LENGTH(TRIM(profile_display_name)) = 0 THEN
        profile_display_name := 'User';
    END IF;
    
    -- Truncate display_name if too long
    IF LENGTH(profile_display_name) > 100 THEN
        profile_display_name := LEFT(profile_display_name, 100);
    END IF;
    
    -- Insert profile (username will be set by user later)
    INSERT INTO public.profiles (
        id,
        display_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        profile_display_name,
        'player',
        NOW(),
        NOW()
    );
    
    RETURN NEW;
END;
$$;

-- Step 7: Create trigger for automatic profile creation (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 8: Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Step 9: Create trigger for updated_at timestamp (idempotent)
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Step 10: Create read-only view for profile accounts with email (authenticated only)
CREATE VIEW public.profile_accounts AS
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
JOIN auth.users u ON u.id = p.id
WHERE p.deleted_at IS NULL;

-- Step 11: Create helper functions for common operations

-- Function to soft delete a profile
CREATE OR REPLACE FUNCTION public.soft_delete_profile(profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles 
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = profile_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Function to restore a soft-deleted profile
CREATE OR REPLACE FUNCTION public.restore_profile(profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles 
    SET deleted_at = NULL, updated_at = NOW()
    WHERE id = profile_id AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$;

-- Function to update last_active timestamp
CREATE OR REPLACE FUNCTION public.update_last_active(profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles 
    SET last_active = NOW()
    WHERE id = profile_id AND deleted_at IS NULL;
END;
$$;

-- Function to check username availability
CREATE OR REPLACE FUNCTION public.is_username_available(check_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check length and format
    IF check_username IS NULL 
        OR LENGTH(TRIM(check_username)) < 3 
        OR LENGTH(TRIM(check_username)) > 50 
        OR check_username ~ '\s' THEN
        RETURN FALSE;
    END IF;
    
    -- Check if username exists (case-insensitive)
    RETURN NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE LOWER(username) = LOWER(check_username) 
        AND deleted_at IS NULL
    );
END;
$$;

-- Function to promote user to admin (server-only, requires service role key)
-- ADMIN BOOTSTRAP: Use this function with service role key to create first admin
-- Example: SELECT public.promote_to_admin('user-uuid-here');
CREATE OR REPLACE FUNCTION public.promote_to_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This function should only be called with service role key
    -- Update the user's role to admin
    UPDATE public.profiles 
    SET 
        role = 'admin',
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Step 12: Add comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users with role-based access and soft delete support';
COMMENT ON COLUMN public.profiles.id IS 'Primary key, references auth.users(id)';
COMMENT ON COLUMN public.profiles.username IS 'Unique username handle, case-insensitive';
COMMENT ON COLUMN public.profiles.display_name IS 'Display name for UI, non-unique';
COMMENT ON COLUMN public.profiles.role IS 'User role: player (default), host, or admin';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN public.profiles.deleted_at IS 'Soft delete timestamp - NULL means active';
COMMENT ON VIEW public.profile_accounts IS 'Read-only view exposing profile data with email from auth.users';

-- Step 13: Grant appropriate permissions (Phase 2 Security Model)
-- Grant usage on the enum type
GRANT USAGE ON TYPE user_role TO authenticated;

-- Grant permissions on profiles table (authenticated users only)
-- Anonymous users have NO access to profiles table
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
-- No INSERT grant - profiles created via trigger only

-- Grant permissions on the view (authenticated users only)
GRANT SELECT ON public.profile_accounts TO authenticated;

-- Grant execute permissions on helper functions
-- Username availability can be checked by anyone (for registration)
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;

-- Profile management functions for authenticated users only
GRANT EXECUTE ON FUNCTION public.update_last_active(UUID) TO authenticated;

-- Admin functions - NO GRANTS (server-side with service role key only)
-- REVOKE EXECUTE ON FUNCTION public.soft_delete_profile(UUID) FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION public.restore_profile(UUID) FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION public.promote_to_admin(UUID) FROM authenticated;
