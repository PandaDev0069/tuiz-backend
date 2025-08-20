-- Migration: Create avatars storage bucket
-- Phase 3: Avatar storage with public read, authenticated write
-- Created: 2025-08-20

-- Step 1: Create the avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true, -- Public read access
    5242880, -- 5MB file size limit
    ARRAY[
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/gif'
    ]
);

-- Step 2: Create storage policies for avatars bucket

-- Policy 1: Anyone can view/read avatar files (public read)
CREATE POLICY "Avatar files are publicly accessible" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'avatars');

-- Policy 2: Authenticated users can upload avatars to their own folder
CREATE POLICY "Users can upload own avatars" 
    ON storage.objects FOR INSERT 
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
        AND (storage.foldername(name))[1] IS NOT NULL
    );

-- Policy 3: Users can update/replace their own avatar files
CREATE POLICY "Users can update own avatars" 
    ON storage.objects FOR UPDATE 
    TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy 4: Users can delete their own avatar files
CREATE POLICY "Users can delete own avatars" 
    ON storage.objects FOR DELETE 
    TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy 5: Admin can manage all avatar files (server-side enforcement)
CREATE POLICY "Admins can manage all avatars" 
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

-- Step 3: Create helper functions for avatar management

-- Function to generate avatar file path following convention: avatars/{user_id}/{uuid}.{ext}
CREATE OR REPLACE FUNCTION public.generate_avatar_path(user_id UUID, file_extension TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    file_uuid UUID;
    clean_extension TEXT;
BEGIN
    -- Generate a new UUID for the file
    file_uuid := gen_random_uuid();
    
    -- Clean the extension (remove leading dot if present)
    clean_extension := LOWER(TRIM(LEADING '.' FROM file_extension));
    
    -- Validate extension
    IF clean_extension NOT IN ('jpg', 'jpeg', 'png', 'webp', 'gif') THEN
        RAISE EXCEPTION 'Invalid file extension: %', file_extension;
    END IF;
    
    -- Return the path following convention: avatars/{user_id}/{uuid}.{ext}
    RETURN FORMAT('avatars/%s/%s.%s', user_id::text, file_uuid::text, clean_extension);
END;
$$;

-- Function to update user's avatar URL in profiles table
CREATE OR REPLACE FUNCTION public.update_avatar_url(user_id UUID, storage_path TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    avatar_url TEXT;
BEGIN
    -- Construct the full public URL for the avatar using the storage path
    -- The client will handle the full URL construction with their Supabase URL
    avatar_url := storage_path;
    
    -- Update the user's profile with the new avatar URL
    UPDATE public.profiles 
    SET 
        avatar_url = avatar_url,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or deleted for user: %', user_id;
    END IF;
END;
$$;

-- Function to remove avatar (soft delete from profile, actual file should be deleted via storage API)
CREATE OR REPLACE FUNCTION public.remove_avatar(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Remove avatar URL from profile
    UPDATE public.profiles 
    SET 
        avatar_url = NULL,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or deleted for user: %', user_id;
    END IF;
END;
$$;

-- Function to validate avatar file constraints
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
    -- Check file size (5MB limit = 5242880 bytes)
    IF file_size > 5242880 THEN
        RAISE EXCEPTION 'File size too large. Maximum allowed: 5MB, received: % bytes', file_size;
    END IF;
    
    -- Check MIME type
    IF mime_type NOT IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif') THEN
        RAISE EXCEPTION 'Invalid MIME type: %. Allowed types: JPEG, PNG, WebP, GIF', mime_type;
    END IF;
    
    -- Check file extension from name
    IF NOT (file_name ~* '\.(jpe?g|png|webp|gif)$') THEN
        RAISE EXCEPTION 'Invalid file extension in name: %', file_name;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Step 4: Create a view for avatar management
CREATE VIEW public.user_avatars AS
SELECT 
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.updated_at as avatar_updated_at,
    CASE 
        WHEN p.avatar_url IS NOT NULL THEN true 
        ELSE false 
    END as has_avatar
FROM public.profiles p
WHERE p.deleted_at IS NULL;

-- Step 5: Grant permissions for avatar functions

-- Avatar path generation (authenticated users only)
GRANT EXECUTE ON FUNCTION public.generate_avatar_path(UUID, TEXT) TO authenticated;

-- Avatar URL update (authenticated users only - self-service via RLS)
GRANT EXECUTE ON FUNCTION public.update_avatar_url(UUID, TEXT) TO authenticated;

-- Avatar removal (authenticated users only)
GRANT EXECUTE ON FUNCTION public.remove_avatar(UUID) TO authenticated;

-- Avatar validation (public function for client-side validation)
GRANT EXECUTE ON FUNCTION public.validate_avatar_file(TEXT, BIGINT, TEXT) TO anon, authenticated;

-- Avatar view access
GRANT SELECT ON public.user_avatars TO authenticated;

-- Step 6: Add comments for documentation
COMMENT ON FUNCTION public.generate_avatar_path(UUID, TEXT) IS 'Generate storage path following convention: avatars/{user_id}/{uuid}.{ext}';
COMMENT ON FUNCTION public.update_avatar_url(UUID, TEXT) IS 'Update user profile with new avatar URL after successful upload';
COMMENT ON FUNCTION public.remove_avatar(UUID) IS 'Remove avatar URL from user profile (file deletion handled separately)';
COMMENT ON FUNCTION public.validate_avatar_file(TEXT, BIGINT, TEXT) IS 'Validate avatar file constraints: size, type, and format';
COMMENT ON VIEW public.user_avatars IS 'Read-only view of user avatars with metadata';
