-- Migration: Fix Search Path Security for extract_storage_path_from_url Function
-- Adds SET search_path = public to prevent potential SQL injection attacks
-- Created: 2025-09-14

-- ============================================================================
-- FIX SEARCH PATH SECURITY ISSUE
-- ============================================================================

-- Re-create the function with proper search_path setting
CREATE OR REPLACE FUNCTION public.extract_storage_path_from_url(image_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    path_match TEXT;
BEGIN
    -- Extract path from Supabase storage URL
    -- URL format: https://[project].supabase.co/storage/v1/object/public/quiz-images/[path]
    SELECT regexp_replace(
        image_url,
        '^.*?/storage/v1/object/public/quiz-images/(.+)$',
        '\1'
    ) INTO path_match;
    
    -- Return the path if it was extracted, otherwise return NULL
    IF path_match = image_url THEN
        RETURN NULL; -- No match found
    ELSE
        RETURN path_match;
    END IF;
END;
$$;

-- ============================================================================
-- UPDATE FUNCTION COMMENT
-- ============================================================================

COMMENT ON FUNCTION public.extract_storage_path_from_url(TEXT) IS 
'Extracts storage path from Supabase public URL - SECURITY: Fixed search_path';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Ensure proper permissions are still in place
GRANT EXECUTE ON FUNCTION public.extract_storage_path_from_url(TEXT) TO authenticated;
