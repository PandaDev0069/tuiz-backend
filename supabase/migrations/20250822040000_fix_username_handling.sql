-- Fix: Update the trigger function to properly handle username
-- This will ensure username is stored in the profiles table

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
        updated_at,
        last_active
    ) VALUES (
        NEW.id,
        -- Extract username from metadata
        NEW.raw_user_meta_data->>'username',
        -- Display name fallback logic
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'username',
            NEW.raw_user_meta_data->>'name',
            SPLIT_PART(NEW.email, '@', 1),
            'User'
        ),
        'player',
        NOW(),
        NOW(),
        NOW() -- Set initial last_active
    );
    
    RETURN NEW;
END;
$$;
