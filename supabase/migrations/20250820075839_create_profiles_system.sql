-- Migration: Create clean profiles system
-- Simple, focused profile system with auth integration
-- Created: 2025-08-20

-- Step 1: Create user_role enum
CREATE TYPE user_role AS ENUM ('player', 'host', 'admin');

-- Step 2: Create profiles table
CREATE TABLE public.profiles (
    -- Primary key links to auth.users
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- User identity
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    
    -- Role system
    role user_role NOT NULL DEFAULT 'player',
    
    -- Avatar
    avatar_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT username_length CHECK (char_length(username) >= 3),
    CONSTRAINT display_name_length CHECK (char_length(display_name) >= 1)
);

-- Step 3: Create indexes
CREATE INDEX profiles_username_idx ON public.profiles (username) WHERE deleted_at IS NULL;
CREATE INDEX profiles_role_idx ON public.profiles (role) WHERE deleted_at IS NULL;
CREATE INDEX profiles_created_at_idx ON public.profiles (created_at DESC) WHERE deleted_at IS NULL;

-- Step 4: Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create basic RLS policies
-- Users can read active profiles
CREATE POLICY "Users can read profiles" 
    ON public.profiles FOR SELECT 
    TO authenticated
    USING (deleted_at IS NULL);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Only allow profile creation via trigger
CREATE POLICY "Block direct inserts" 
    ON public.profiles FOR INSERT 
    WITH CHECK (false);

-- Block direct deletes
CREATE POLICY "Block direct deletes" 
    ON public.profiles FOR DELETE 
    USING (false);

-- Step 6: Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        display_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'name',
            SPLIT_PART(NEW.email, '@', 1),
            'User'
        ),
        'player',
        NOW(),
        NOW()
    );
    
    RETURN NEW;
END;
$$;

-- Step 7: Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 8: Auto-update timestamp trigger
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

CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Step 9: Basic helper functions
CREATE OR REPLACE FUNCTION public.is_username_available(check_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF check_username IS NULL OR LENGTH(TRIM(check_username)) < 3 THEN
        RETURN FALSE;
    END IF;
    
    RETURN NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE username = check_username 
        AND deleted_at IS NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_last_active(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles 
    SET last_active = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
END;
$$;

-- Step 10: Grant permissions
GRANT USAGE ON TYPE user_role TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_last_active(UUID) TO authenticated;

-- Step 11: Comments
COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users';
COMMENT ON COLUMN public.profiles.username IS 'Unique username handle';
COMMENT ON COLUMN public.profiles.display_name IS 'Display name for UI';
COMMENT ON COLUMN public.profiles.role IS 'User role: player, host, or admin';
COMMENT ON COLUMN public.profiles.deleted_at IS 'Soft delete timestamp';
