-- Migration: Fix Quiz Deletion Image Cleanup
-- Add trigger for hard deletes and modify cleanup function to handle both cases
-- Created: 2025-09-14

-- ============================================================================
-- STEP 1: CREATE TRIGGER FOR HARD DELETES
-- ============================================================================

-- Trigger function to call image cleanup when quiz is hard deleted
CREATE OR REPLACE FUNCTION public.trigger_cleanup_quiz_images_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Call cleanup function for hard delete
    -- We use the OLD record since this is a BEFORE DELETE trigger
    PERFORM public.cleanup_quiz_images_hard_delete(OLD.id);
    
    RETURN OLD;
END;
$$;

-- ============================================================================
-- STEP 2: CREATE HARD DELETE CLEANUP FUNCTION
-- ============================================================================

-- Function to cleanup images for hard deleted quizzes
CREATE OR REPLACE FUNCTION public.cleanup_quiz_images_hard_delete(quiz_id UUID)
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
    -- Get quiz information (from the quiz that's about to be deleted)
    SELECT user_id, thumbnail_url
    INTO quiz_record
    FROM public.quiz_sets
    WHERE id = quiz_id;
    
    -- If quiz not found, nothing to clean up
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
    
    -- Get all question images (including soft-deleted questions since quiz is being hard deleted)
    FOR question_record IN
        SELECT image_url, explanation_image_url
        FROM public.questions
        WHERE question_set_id = quiz_id
        -- No deleted_at filter since we want to clean up all images
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
    
    -- Get all answer images (including soft-deleted answers)
    FOR answer_record IN
        SELECT a.image_url
        FROM public.answers a
        JOIN public.questions q ON q.id = a.question_id
        WHERE q.question_set_id = quiz_id
        -- No deleted_at filter since we want to clean up all images
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
        RAISE NOTICE 'Cleaned up % images for hard-deleted quiz %', array_length(image_paths, 1), quiz_id;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Failed to cleanup images for hard-deleted quiz %: %', quiz_id, SQLERRM;
END;
$$;

-- ============================================================================
-- STEP 3: CREATE TRIGGER FOR HARD DELETES
-- ============================================================================

-- Create trigger on quiz_sets table for BEFORE DELETE
CREATE TRIGGER on_quiz_hard_delete_cleanup_images
    BEFORE DELETE ON public.quiz_sets
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_cleanup_quiz_images_before_delete();

-- ============================================================================
-- STEP 4: UPDATE EXISTING SOFT DELETE CLEANUP FUNCTION
-- ============================================================================

-- Update the existing cleanup function to handle both soft-deleted and active images
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
    -- Get quiz information (check both soft-deleted and active quizzes)
    SELECT user_id, thumbnail_url, deleted_at
    INTO quiz_record
    FROM public.quiz_sets
    WHERE id = quiz_id;
    
    -- If quiz not found, nothing to clean up
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
    
    -- Get all question images (including soft-deleted questions if quiz is soft-deleted)
    FOR question_record IN
        SELECT image_url, explanation_image_url
        FROM public.questions
        WHERE question_set_id = quiz_id
        -- If quiz is soft-deleted, clean up all question images regardless of their deleted_at status
        AND (quiz_record.deleted_at IS NOT NULL OR deleted_at IS NULL)
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
    
    -- Get all answer images (including soft-deleted answers if quiz is soft-deleted)
    FOR answer_record IN
        SELECT a.image_url
        FROM public.answers a
        JOIN public.questions q ON q.id = a.question_id
        WHERE q.question_set_id = quiz_id
        -- If quiz is soft-deleted, clean up all answer images regardless of their deleted_at status
        AND (quiz_record.deleted_at IS NOT NULL OR (a.deleted_at IS NULL AND q.deleted_at IS NULL))
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
-- STEP 5: UPDATE EXISTING TRIGGER FUNCTION
-- ============================================================================

-- Update the existing trigger function for soft deletes
CREATE OR REPLACE FUNCTION public.trigger_cleanup_quiz_images()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only cleanup if quiz is being soft deleted (deleted_at is being set)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- Call cleanup function for soft delete
        PERFORM public.cleanup_quiz_images(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new cleanup functions
GRANT EXECUTE ON FUNCTION public.cleanup_quiz_images_hard_delete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_cleanup_quiz_images_before_delete() TO authenticated;

-- ============================================================================
-- STEP 7: UPDATE COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.cleanup_quiz_images_hard_delete(UUID) IS 'Cleans up all images related to a quiz being hard deleted';
COMMENT ON FUNCTION public.trigger_cleanup_quiz_images_before_delete() IS 'Trigger function that calls image cleanup when quiz is hard deleted';
COMMENT ON FUNCTION public.cleanup_quiz_images(UUID) IS 'Cleans up images related to a quiz (works for both soft and hard deletes)';
COMMENT ON FUNCTION public.trigger_cleanup_quiz_images() IS 'Trigger function that calls image cleanup when quiz is soft deleted';

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

-- Changes made:
-- 1. Added cleanup_quiz_images_hard_delete() function for hard deletes
-- 2. Added trigger_cleanup_quiz_images_before_delete() trigger function for BEFORE DELETE
-- 3. Added on_quiz_hard_delete_cleanup_images trigger for hard deletes
-- 4. Updated existing cleanup_quiz_images() function to handle both cases
-- 5. Updated existing trigger function for clarity
-- 6. Added proper permissions and documentation

-- Benefits:
-- 1. Images are now cleaned up for both hard and soft deletes
-- 2. Hard deletes trigger BEFORE DELETE to capture image URLs before cascade
-- 3. Soft deletes continue to work as before with AFTER UPDATE
-- 4. Comprehensive image cleanup regardless of deletion method
-- 5. Error handling prevents deletion failures due to storage issues

-- How it works:
-- - Hard delete: BEFORE DELETE trigger captures all image URLs and deletes them
-- - Soft delete: AFTER UPDATE trigger detects deleted_at change and cleans up
-- - Both methods handle questions/answers at any deletion state
-- - Storage errors are logged but don't prevent quiz deletion
