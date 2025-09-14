-- Migration: Add Quiz Image Cleanup on Deletion
-- Automatically deletes all images related to a quiz when the quiz is deleted
-- Created: 2025-01-15

-- ============================================================================
-- STEP 1: CREATE IMAGE CLEANUP FUNCTION
-- ============================================================================

-- Function to extract image paths from URLs and delete them from storage
CREATE OR REPLACE FUNCTION public.cleanup_quiz_images(quiz_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    quiz_record RECORD;
    question_record RECORD;
    answer_record RECORD;
    image_paths TEXT[] := '{}';
    path TEXT;
    bucket_name TEXT := 'quiz-images';
BEGIN
    -- Get quiz information
    SELECT user_id, thumbnail_url
    INTO quiz_record
    FROM public.quiz_sets
    WHERE id = quiz_id AND deleted_at IS NOT NULL;
    
    -- Only proceed if quiz is soft deleted
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Add thumbnail image path if exists
    IF quiz_record.thumbnail_url IS NOT NULL THEN
        path := public.extract_storage_path_from_url(quiz_record.thumbnail_url);
        IF path IS NOT NULL THEN
            image_paths := array_append(image_paths, path);
        END IF;
    END IF;
    
    -- Get all question images
    FOR question_record IN
        SELECT image_url, explanation_image_url
        FROM public.questions
        WHERE question_set_id = quiz_id
        AND deleted_at IS NULL
    LOOP
        -- Add question image path if exists
        IF question_record.image_url IS NOT NULL THEN
            path := public.extract_storage_path_from_url(question_record.image_url);
            IF path IS NOT NULL THEN
                image_paths := array_append(image_paths, path);
            END IF;
        END IF;
        
        -- Add explanation image path if exists
        IF question_record.explanation_image_url IS NOT NULL THEN
            path := public.extract_storage_path_from_url(question_record.explanation_image_url);
            IF path IS NOT NULL THEN
                image_paths := array_append(image_paths, path);
            END IF;
        END IF;
    END LOOP;
    
    -- Get all answer images
    FOR answer_record IN
        SELECT a.image_url
        FROM public.answers a
        JOIN public.questions q ON q.id = a.question_id
        WHERE q.question_set_id = quiz_id
        AND a.deleted_at IS NULL
        AND q.deleted_at IS NULL
    LOOP
        -- Add answer image path if exists
        IF answer_record.image_url IS NOT NULL THEN
            path := public.extract_storage_path_from_url(answer_record.image_url);
            IF path IS NOT NULL THEN
                image_paths := array_append(image_paths, path);
            END IF;
        END IF;
    END LOOP;
    
    -- Delete all collected image paths from storage
    IF array_length(image_paths, 1) > 0 THEN
        PERFORM storage.delete_object(bucket_name, unnest(image_paths));
        
        -- Log the cleanup
        RAISE NOTICE 'Cleaned up % images for quiz %', array_length(image_paths, 1), quiz_id;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Failed to cleanup images for quiz %: %', quiz_id, SQLERRM;
END;
$$;

-- ============================================================================
-- STEP 2: CREATE URL PATH EXTRACTION FUNCTION
-- ============================================================================

-- Function to extract storage path from Supabase public URL
CREATE OR REPLACE FUNCTION public.extract_storage_path_from_url(image_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    path_match TEXT;
BEGIN
    -- Extract path from Supabase storage URL
    -- URL format: https://[project].supabase.co/storage/v1/object/public/quiz-images/[path]
    SELECT regexp_replace(
        image_url,
        '^https?://[^/]+/storage/v1/object/public/quiz-images/(.+)$',
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
-- STEP 3: CREATE TRIGGER FUNCTION
-- ============================================================================

-- Trigger function to call image cleanup when quiz is soft deleted
CREATE OR REPLACE FUNCTION public.trigger_cleanup_quiz_images()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only cleanup if quiz is being soft deleted (deleted_at is being set)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- Call cleanup function asynchronously to avoid blocking the delete operation
        PERFORM pg_notify('cleanup_quiz_images', NEW.id::text);
        
        -- Also call cleanup directly for immediate cleanup
        PERFORM public.cleanup_quiz_images(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 4: CREATE TRIGGER
-- ============================================================================

-- Create trigger on quiz_sets table
CREATE TRIGGER on_quiz_soft_delete_cleanup_images
    AFTER UPDATE ON public.quiz_sets
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_cleanup_quiz_images();

-- ============================================================================
-- STEP 5: CREATE MANUAL CLEANUP FUNCTION
-- ============================================================================

-- Function to manually cleanup images for a specific quiz (useful for maintenance)
CREATE OR REPLACE FUNCTION public.manual_cleanup_quiz_images(quiz_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    images_deleted INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    quiz_exists BOOLEAN;
    images_count INTEGER := 0;
    cleanup_result RECORD;
BEGIN
    -- Check if quiz exists
    SELECT EXISTS(
        SELECT 1 FROM public.quiz_sets 
        WHERE id = quiz_id
    ) INTO quiz_exists;
    
    IF NOT quiz_exists THEN
        RETURN QUERY SELECT FALSE, 'Quiz not found', 0;
        RETURN;
    END IF;
    
    -- Count images before cleanup
    SELECT COUNT(*) INTO images_count
    FROM (
        SELECT 1 FROM public.quiz_sets WHERE id = quiz_id AND thumbnail_url IS NOT NULL
        UNION ALL
        SELECT 1 FROM public.questions WHERE question_set_id = quiz_id AND image_url IS NOT NULL
        UNION ALL
        SELECT 1 FROM public.questions WHERE question_set_id = quiz_id AND explanation_image_url IS NOT NULL
        UNION ALL
        SELECT 1 FROM public.answers a
        JOIN public.questions q ON q.id = a.question_id
        WHERE q.question_set_id = quiz_id AND a.image_url IS NOT NULL
    ) AS image_count;
    
    -- Perform cleanup
    PERFORM public.cleanup_quiz_images(quiz_id);
    
    RETURN QUERY SELECT TRUE, 'Images cleanup completed', images_count;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT FALSE, 'Cleanup failed: ' || SQLERRM, 0;
END;
$$;

-- ============================================================================
-- STEP 6: CREATE BULK CLEANUP FUNCTION
-- ============================================================================

-- Function to cleanup images for all soft-deleted quizzes (maintenance function)
CREATE OR REPLACE FUNCTION public.bulk_cleanup_deleted_quiz_images()
RETURNS TABLE (
    quiz_id UUID,
    success BOOLEAN,
    message TEXT,
    images_deleted INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    quiz_record RECORD;
    cleanup_result RECORD;
BEGIN
    -- Process all soft-deleted quizzes
    FOR quiz_record IN
        SELECT id FROM public.quiz_sets
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
    LOOP
        -- Get cleanup result for this quiz
        SELECT * INTO cleanup_result
        FROM public.manual_cleanup_quiz_images(quiz_record.id);
        
        -- Return the result
        quiz_id := quiz_record.id;
        success := cleanup_result.success;
        message := cleanup_result.message;
        images_deleted := cleanup_result.images_deleted;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- ============================================================================
-- STEP 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on cleanup functions
GRANT EXECUTE ON FUNCTION public.cleanup_quiz_images(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extract_storage_path_from_url(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manual_cleanup_quiz_images(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_cleanup_deleted_quiz_images() TO authenticated;

-- ============================================================================
-- STEP 8: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.cleanup_quiz_images(UUID) IS 'Automatically deletes all images related to a soft-deleted quiz from storage';
COMMENT ON FUNCTION public.extract_storage_path_from_url(TEXT) IS 'Extracts storage path from Supabase public URL';
COMMENT ON FUNCTION public.trigger_cleanup_quiz_images() IS 'Trigger function that calls image cleanup when quiz is soft deleted';
COMMENT ON FUNCTION public.manual_cleanup_quiz_images(UUID) IS 'Manually cleanup images for a specific quiz (maintenance function)';
COMMENT ON FUNCTION public.bulk_cleanup_deleted_quiz_images() IS 'Cleanup images for all soft-deleted quizzes (maintenance function)';

-- ============================================================================
-- STEP 9: CREATE INDEX FOR PERFORMANCE
-- ============================================================================

-- Create index to improve performance of cleanup queries
CREATE INDEX IF NOT EXISTS quiz_sets_deleted_at_idx ON public.quiz_sets (deleted_at) WHERE deleted_at IS NOT NULL;
