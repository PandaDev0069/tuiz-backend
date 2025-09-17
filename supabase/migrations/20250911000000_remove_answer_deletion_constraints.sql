-- Migration: Remove Answer Deletion Constraints
-- Remove all constraints that prevent deletion of the last answer from questions
-- This allows more flexible answer management in the quiz editor

-- ============================================================================
-- STEP 1: DROP CONSTRAINT TRIGGER
-- ============================================================================

-- Drop the trigger that prevents deletion of the last answer
DROP TRIGGER IF EXISTS enforce_minimum_answers_per_question ON public.answers;

-- ============================================================================
-- STEP 2: DROP CONSTRAINT FUNCTION
-- ============================================================================

-- Drop the function that checks minimum answers
DROP FUNCTION IF EXISTS public.check_minimum_answers_before_delete();

-- ============================================================================
-- STEP 3: DROP ATOMIC DELETE FUNCTION
-- ============================================================================

-- Drop the atomic delete function that also enforces the constraint
DROP FUNCTION IF EXISTS public.delete_answer_with_constraint_check(UUID, UUID);

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

-- Changes made:
-- 1. Removed enforce_minimum_answers_per_question trigger
-- 2. Removed check_minimum_answers_before_delete() function  
-- 3. Removed delete_answer_with_constraint_check() function
-- 4. Questions can now have zero answers temporarily

-- Benefits:
-- 1. Allows flexible answer management in quiz editor
-- 2. Removes database-level constraints that were too restrictive
-- 3. Application-level validation can still enforce business rules when needed
-- 4. Enables better user experience when editing questions

-- Note: Applications should still validate that published quizzes have proper answers
-- but this allows more flexibility during the editing process.
