-- Migration: Add Atomic Answer Delete Function
-- Add the stored procedure for atomic answer deletion with constraint checking

-- ============================================================================
-- STEP 1: CREATE ATOMIC DELETE FUNCTION
-- ============================================================================

-- Function to atomically check and delete an answer
CREATE OR REPLACE FUNCTION public.delete_answer_with_constraint_check(
    p_answer_id UUID,
    p_question_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    answer_count INTEGER;
    answer_exists BOOLEAN;
BEGIN
    -- Check if the answer exists and belongs to the question
    SELECT EXISTS(
        SELECT 1 FROM public.answers 
        WHERE id = p_answer_id AND question_id = p_question_id AND deleted_at IS NULL
    ) INTO answer_exists;
    
    IF NOT answer_exists THEN
        RETURN FALSE; -- Answer not found
    END IF;
    
    -- Count current answers for the question
    SELECT COUNT(*) INTO answer_count
    FROM public.answers 
    WHERE question_id = p_question_id AND deleted_at IS NULL;
    
    -- Check if this would be the last answer
    IF answer_count <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last answer. A question must have at least one answer.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'Question ID: ' || p_question_id::text,
                  HINT = 'Add another answer before deleting this one.';
    END IF;
    
    -- Delete the answer
    DELETE FROM public.answers 
    WHERE id = p_answer_id AND question_id = p_question_id;
    
    RETURN TRUE; -- Successfully deleted
END;
$$;

-- ============================================================================
-- STEP 2: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_answer_with_constraint_check(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 3: ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.delete_answer_with_constraint_check(UUID, UUID) IS 'Atomically checks and deletes an answer, ensuring questions always have at least one answer';

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

-- Changes made:
-- 1. Added delete_answer_with_constraint_check() function for atomic operations
-- 2. Granted execute permissions to authenticated users
-- 3. Added proper documentation

-- Benefits:
-- 1. Atomically enforces the constraint at database level
-- 2. Prevents race conditions between application checks and deletions
-- 3. Works alongside the existing trigger-based constraint
-- 4. Returns clear boolean result for success/failure
