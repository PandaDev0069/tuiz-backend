-- Migration: Fix Answer Deletion Constraint Logic
-- Fix the trigger logic to properly allow deletion when there are 2+ answers

-- ============================================================================
-- STEP 1: DROP EXISTING TRIGGER AND FUNCTION
-- ============================================================================

-- Drop the existing trigger and function to recreate with correct logic
DROP TRIGGER IF EXISTS enforce_minimum_answers_per_question ON public.answers;
DROP FUNCTION IF EXISTS public.check_minimum_answers_before_delete();

-- ============================================================================
-- STEP 2: CREATE CORRECTED CONSTRAINT FUNCTION
-- ============================================================================

-- Function to check if deleting an answer would leave question with no answers
CREATE OR REPLACE FUNCTION public.check_minimum_answers_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if this would leave the question with no answers
    -- Use BEFORE DELETE trigger and check if count would be < 1 after deletion
    IF (SELECT COUNT(*) FROM public.answers WHERE question_id = OLD.question_id AND deleted_at IS NULL) <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last answer. A question must have at least one answer.'
            USING ERRCODE = 'P0001', -- Custom error code
                  DETAIL = 'Question ID: ' || OLD.question_id::text,
                  HINT = 'Add another answer before deleting this one.';
    END IF;
    
    RETURN OLD;
END;
$$;

-- ============================================================================
-- STEP 3: CREATE CORRECTED CONSTRAINT TRIGGER
-- ============================================================================

-- Add constraint trigger to enforce minimum answers - using BEFORE DELETE
CREATE TRIGGER enforce_minimum_answers_per_question
    BEFORE DELETE ON public.answers
    FOR EACH ROW
    EXECUTE FUNCTION public.check_minimum_answers_before_delete();

-- ============================================================================
-- STEP 4: ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.check_minimum_answers_before_delete() IS 'Enforces that questions always have at least one answer by preventing deletion of the last answer';
COMMENT ON TRIGGER enforce_minimum_answers_per_question ON public.answers IS 'Constraint trigger that prevents deletion of the last answer for a question';

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

-- Changes made:
-- 1. Changed trigger from AFTER DELETE to BEFORE DELETE
-- 2. Fixed logic to properly check answer count before deletion
-- 3. Kept same error handling and constraint logic

-- Benefits:
-- 1. Properly allows deletion when there are 2+ answers
-- 2. Only prevents deletion when there's exactly 1 answer
-- 3. Works correctly with the stored procedure
-- 4. Maintains data integrity at database level
