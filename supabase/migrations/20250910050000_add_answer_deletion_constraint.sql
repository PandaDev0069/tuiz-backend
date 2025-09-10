-- Migration: Add Answer Deletion Constraint
-- Ensure questions always have at least one answer using database constraints

-- ============================================================================
-- STEP 1: CREATE CONSTRAINT FUNCTION
-- ============================================================================

-- Function to check if deleting an answer would leave question with no answers
CREATE OR REPLACE FUNCTION public.check_minimum_answers_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if this would be the last answer for the question
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
-- STEP 2: CREATE CONSTRAINT TRIGGER
-- ============================================================================

-- Add constraint trigger to enforce minimum answers
CREATE CONSTRAINT TRIGGER enforce_minimum_answers_per_question
    AFTER DELETE ON public.answers
    DEFERRABLE INITIALLY IMMEDIATE
    FOR EACH ROW
    EXECUTE FUNCTION public.check_minimum_answers_before_delete();

-- ============================================================================
-- STEP 3: ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.check_minimum_answers_before_delete() IS 'Enforces that questions always have at least one answer by preventing deletion of the last answer';
COMMENT ON TRIGGER enforce_minimum_answers_per_question ON public.answers IS 'Constraint trigger that prevents deletion of the last answer for a question';

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

-- Changes made:
-- 1. Added check_minimum_answers_before_delete() function
-- 2. Added constraint trigger to enforce minimum answers per question
-- 3. Uses database-level enforcement for data integrity
-- 4. Provides detailed error messages for failed deletions

-- Benefits:
-- 1. Atomically enforces the constraint at database level
-- 2. Prevents race conditions between application checks and deletions
-- 3. Consistent enforcement regardless of application logic
-- 4. Proper error handling with custom error codes
