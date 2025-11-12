-- Migration: Create avatar storage system
-- Clean avatar storage with file management
-- Created: 2025-08-20

-- Step 1: Create avatars storage bucket
INSERT INTO storage.buckets (id, name)
VALUES ('avatars', 'avatars')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create storage policies

-- Anyone can read avatar files (public)
CREATE POLICY "Public avatar access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'avatars');

-- Users can upload to their own folder
CREATE POLICY "Users upload own avatars" 
    ON storage.objects FOR INSERT 
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own avatar files
CREATE POLICY "Users update own avatars" 
    ON storage.objects FOR UPDATE 
    TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own avatar files
CREATE POLICY "Users delete own avatars" 
    ON storage.objects FOR DELETE 
    TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Step 3: Avatar helper functions

-- Generate avatar file path: avatars/{user_id}/{uuid}.{ext}
CREATE OR REPLACE FUNCTION public.generate_avatar_path(user_id UUID, file_extension TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    file_uuid UUID;
    clean_ext TEXT;
BEGIN
    -- Generate UUID for file
    file_uuid := gen_random_uuid();
    
    -- Clean extension
    clean_ext := LOWER(TRIM(LEADING '.' FROM file_extension));
    
    -- Validate extension
    IF clean_ext NOT IN ('jpg', 'jpeg', 'png', 'webp', 'gif') THEN
        RAISE EXCEPTION 'Invalid file extension: %', file_extension;
    END IF;
    
    -- Return path
    RETURN FORMAT('avatars/%s/%s.%s', user_id::text, file_uuid::text, clean_ext);
END;
$$;

-- Update user's avatar URL
CREATE OR REPLACE FUNCTION public.update_avatar_url(user_id UUID, storage_path TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        avatar_url = storage_path,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found for user: %', user_id;
    END IF;
END;
$$;

-- Remove avatar from profile
CREATE OR REPLACE FUNCTION public.remove_avatar(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        avatar_url = NULL,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found for user: %', user_id;
    END IF;
END;
$$;

-- Validate avatar file
CREATE OR REPLACE FUNCTION public.validate_avatar_file(
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    -- Check file size (5MB limit)
    IF file_size > 5242880 THEN
        RAISE EXCEPTION 'File too large. Max 5MB, got % bytes', file_size;
    END IF;
    
    -- Check MIME type
    IF mime_type NOT IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif') THEN
        RAISE EXCEPTION 'Invalid MIME type: %', mime_type;
    END IF;
    
    -- Check file extension
    IF NOT (file_name ~* '\.(jpe?g|png|webp|gif)$') THEN
        RAISE EXCEPTION 'Invalid file extension: %', file_name;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Step 4: Create user avatars view
CREATE VIEW public.user_avatars AS
SELECT 
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.updated_at as avatar_updated_at,
    (p.avatar_url IS NOT NULL) as has_avatar
FROM public.profiles p
WHERE p.deleted_at IS NULL;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_avatar_path(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_avatar_url(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_avatar(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_avatar_file(TEXT, BIGINT, TEXT) TO anon, authenticated;
GRANT SELECT ON public.user_avatars TO authenticated;

-- Step 6: Comments
COMMENT ON FUNCTION public.generate_avatar_path(UUID, TEXT) IS 'Generate storage path: avatars/{user_id}/{uuid}.{ext}';
COMMENT ON FUNCTION public.update_avatar_url(UUID, TEXT) IS 'Update user avatar URL after upload';
COMMENT ON FUNCTION public.remove_avatar(UUID) IS 'Remove avatar URL from profile';
COMMENT ON FUNCTION public.validate_avatar_file(TEXT, BIGINT, TEXT) IS 'Validate avatar file constraints';
COMMENT ON VIEW public.user_avatars IS 'User avatars with metadata';
