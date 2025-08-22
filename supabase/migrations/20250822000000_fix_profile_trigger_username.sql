-- Migration: Fix profile trigger to extract username from user metadata
-- The current trigger doesn't extract username, only display_name
-- Created: 2025-08-22

-- Update the profile creation trigger to handle username extraction
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        username,
        display_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'username',
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'username',
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

-- Add a comment explaining the fix
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates user profile on auth.users insert. Extracts username and display_name from raw_user_meta_data.';
