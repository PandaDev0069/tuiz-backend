-- Migration: Optimize Quiz RLS Performance
-- Fix auth function calls and consolidate multiple permissive policies
-- Created: 2025-09-09

-- ============================================================================
-- STEP 1: DROP EXISTING POLICIES TO REPLACE THEM
-- ============================================================================

-- Drop all existing quiz-related policies
DROP POLICY IF EXISTS "Admins manage all quizzes" ON public.quiz_sets;
DROP POLICY IF EXISTS "Users can create own quizzes" ON public.quiz_sets;
DROP POLICY IF EXISTS "Users can delete own quizzes" ON public.quiz_sets;
DROP POLICY IF EXISTS "Users can read own quizzes" ON public.quiz_sets;
DROP POLICY IF EXISTS "Users can read public published quizzes" ON public.quiz_sets;
DROP POLICY IF EXISTS "Users can update own quizzes" ON public.quiz_sets;

DROP POLICY IF EXISTS "Admins manage all questions" ON public.questions;
DROP POLICY IF EXISTS "Users can create questions in own quizzes" ON public.questions;
DROP POLICY IF EXISTS "Users can delete questions in own quizzes" ON public.questions;
DROP POLICY IF EXISTS "Users can read accessible questions" ON public.questions;
DROP POLICY IF EXISTS "Users can update questions in own quizzes" ON public.questions;

DROP POLICY IF EXISTS "Admins manage all answers" ON public.answers;
DROP POLICY IF EXISTS "Users can create answers in own quizzes" ON public.answers;
DROP POLICY IF EXISTS "Users can delete answers in own quizzes" ON public.answers;
DROP POLICY IF EXISTS "Users can read accessible answers" ON public.answers;
DROP POLICY IF EXISTS "Users can update answers in own quizzes" ON public.answers;

-- ============================================================================
-- STEP 2: CREATE OPTIMIZED RLS POLICIES - QUIZ_SETS
-- ============================================================================

-- Single optimized policy for quiz_sets SELECT (combines all SELECT policies)
CREATE POLICY "quiz_sets_select_policy" 
    ON public.quiz_sets FOR SELECT 
    TO authenticated
    USING (
        deleted_at IS NULL 
        AND (
            -- Own quizzes (any status)
            user_id = (SELECT auth.uid())
            OR 
            -- Public published quizzes
            (is_public = true AND status = 'published')
            OR
            -- Admin access
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = (SELECT auth.uid()) 
                AND role = 'admin' 
                AND deleted_at IS NULL
            )
        )
    );

-- Single optimized policy for quiz_sets INSERT (combines admin + user policies)
CREATE POLICY "quiz_sets_insert_policy" 
    ON public.quiz_sets FOR INSERT 
    TO authenticated
    WITH CHECK (
        deleted_at IS NULL
        AND status = 'draft'  -- Only allow draft creation
        AND (
            -- Own quizzes
            user_id = (SELECT auth.uid())
            OR
            -- Admin access
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = (SELECT auth.uid()) 
                AND role = 'admin' 
                AND deleted_at IS NULL
            )
        )
    );

-- Single optimized policy for quiz_sets UPDATE (combines admin + user policies)
CREATE POLICY "quiz_sets_update_policy" 
    ON public.quiz_sets FOR UPDATE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND (
            -- Own quizzes
            user_id = (SELECT auth.uid())
            OR
            -- Admin access
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = (SELECT auth.uid()) 
                AND role = 'admin' 
                AND deleted_at IS NULL
            )
        )
    )
    WITH CHECK (
        -- Prevent changing user_id
        user_id = (SELECT user_id FROM public.quiz_sets WHERE id = quiz_sets.id)
        AND (
            -- Own quizzes
            user_id = (SELECT auth.uid())
            OR
            -- Admin access
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = (SELECT auth.uid()) 
                AND role = 'admin' 
                AND deleted_at IS NULL
            )
        )
    );

-- ============================================================================
-- STEP 3: CREATE OPTIMIZED RLS POLICIES - QUESTIONS
-- ============================================================================

-- Single optimized policy for questions SELECT
CREATE POLICY "questions_select_policy" 
    ON public.questions FOR SELECT 
    TO authenticated
    USING (
        deleted_at IS NULL 
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.deleted_at IS NULL
            AND (
                -- Own quiz
                qs.user_id = (SELECT auth.uid())
                OR 
                -- Public published quiz
                (qs.is_public = true AND qs.status = 'published')
                OR
                -- Admin access
                EXISTS (
                    SELECT 1 FROM public.profiles p 
                    WHERE p.id = (SELECT auth.uid()) 
                    AND p.role = 'admin' 
                    AND p.deleted_at IS NULL
                )
            )
        )
    );

-- Single optimized policy for questions INSERT
CREATE POLICY "questions_insert_policy" 
    ON public.questions FOR INSERT 
    TO authenticated
    WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.user_id = (SELECT auth.uid()) 
            AND qs.deleted_at IS NULL
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- Single optimized policy for questions UPDATE
CREATE POLICY "questions_update_policy" 
    ON public.questions FOR UPDATE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.user_id = (SELECT auth.uid()) 
            AND qs.deleted_at IS NULL
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    )
    WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.user_id = (SELECT auth.uid()) 
            AND qs.deleted_at IS NULL
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- ============================================================================
-- STEP 4: CREATE OPTIMIZED RLS POLICIES - ANSWERS
-- ============================================================================

-- Single optimized policy for answers SELECT
CREATE POLICY "answers_select_policy" 
    ON public.answers FOR SELECT 
    TO authenticated
    USING (
        deleted_at IS NULL 
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
            AND (
                -- Own quiz
                qs.user_id = (SELECT auth.uid())
                OR 
                -- Public published quiz
                (qs.is_public = true AND qs.status = 'published')
                OR
                -- Admin access
                EXISTS (
                    SELECT 1 FROM public.profiles p 
                    WHERE p.id = (SELECT auth.uid()) 
                    AND p.role = 'admin' 
                    AND p.deleted_at IS NULL
                )
            )
        )
    );

-- Single optimized policy for answers INSERT
CREATE POLICY "answers_insert_policy" 
    ON public.answers FOR INSERT 
    TO authenticated
    WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND qs.user_id = (SELECT auth.uid()) 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- Single optimized policy for answers UPDATE
CREATE POLICY "answers_update_policy" 
    ON public.answers FOR UPDATE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND qs.user_id = (SELECT auth.uid()) 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    )
    WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND qs.user_id = (SELECT auth.uid()) 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- ============================================================================
-- STEP 5: ADD MISSING INDEX FOR FOREIGN KEY
-- ============================================================================

-- Add index for cloned_from foreign key to improve performance
CREATE INDEX IF NOT EXISTS quiz_sets_cloned_from_idx ON public.quiz_sets (cloned_from) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 6: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "quiz_sets_select_policy" ON public.quiz_sets IS 'Optimized single policy for all quiz_sets SELECT operations';
COMMENT ON POLICY "quiz_sets_insert_policy" ON public.quiz_sets IS 'Optimized single policy for all quiz_sets INSERT operations';
COMMENT ON POLICY "quiz_sets_update_policy" ON public.quiz_sets IS 'Optimized single policy for all quiz_sets UPDATE operations';

COMMENT ON POLICY "questions_select_policy" ON public.questions IS 'Optimized single policy for all questions SELECT operations';
COMMENT ON POLICY "questions_insert_policy" ON public.questions IS 'Optimized single policy for all questions INSERT operations';
COMMENT ON POLICY "questions_update_policy" ON public.questions IS 'Optimized single policy for all questions UPDATE operations';

COMMENT ON POLICY "answers_select_policy" ON public.answers IS 'Optimized single policy for all answers SELECT operations';
COMMENT ON POLICY "answers_insert_policy" ON public.answers IS 'Optimized single policy for all answers INSERT operations';
COMMENT ON POLICY "answers_update_policy" ON public.answers IS 'Optimized single policy for all answers UPDATE operations';
