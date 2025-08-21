-- Backfill existing users with missing username and last_active data
-- This will fix any users created before the username handling fix

-- Update existing profiles that have NULL username but have username in auth.users metadata
UPDATE public.profiles 
SET 
    username = auth_users.raw_user_meta_data->>'username',
    last_active = COALESCE(last_active, NOW())
FROM auth.users AS auth_users
WHERE 
    profiles.id = auth_users.id 
    AND profiles.username IS NULL 
    AND auth_users.raw_user_meta_data->>'username' IS NOT NULL
    AND profiles.deleted_at IS NULL;

-- Update profiles that still have NULL last_active
UPDATE public.profiles 
SET last_active = COALESCE(created_at, NOW())
WHERE last_active IS NULL AND deleted_at IS NULL;
