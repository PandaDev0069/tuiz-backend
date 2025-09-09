-- Migration: Create Quiz System with Security-First RLS
-- Comprehensive quiz management system with strict security policies
-- Created: 2025-09-09

-- ============================================================================
-- STEP 1: CREATE ENUMS
-- ============================================================================

-- Quiz difficulty levels
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard', 'expert');

-- Quiz status states
CREATE TYPE quiz_status AS ENUM ('draft', 'published', 'archived');

-- Question types
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false');

-- ============================================================================
-- STEP 2: CREATE QUIZ_SETS TABLE
-- ============================================================================

CREATE TABLE public.quiz_sets (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to profiles (creator/owner)
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Basic quiz information
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    thumbnail_url TEXT,
    
    -- Visibility and categorization
    is_public BOOLEAN NOT NULL DEFAULT false,
    difficulty_level difficulty_level NOT NULL DEFAULT 'easy',
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    
    -- Statistics and metadata
    total_questions INTEGER NOT NULL DEFAULT 0,
    times_played INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Status and organization
    status quiz_status NOT NULL DEFAULT 'draft',
    tags TEXT[] DEFAULT '{}',
    last_played_at TIMESTAMPTZ,
    
    -- Play settings (JSON object)
    play_settings JSONB NOT NULL DEFAULT '{"code": 0, "show_question_only": true, "show_explanation": true, "time_bonus": false, "streak_bonus": false, "show_correct_answer": true, "max_players": 400}'::jsonb,
    
    -- Cloning support
    cloned_from UUID REFERENCES public.quiz_sets(id) ON DELETE SET NULL,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT quiz_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
    CONSTRAINT quiz_description_length CHECK (char_length(description) >= 1),
    CONSTRAINT quiz_total_questions_positive CHECK (total_questions >= 0),
    CONSTRAINT quiz_times_played_positive CHECK (times_played >= 0),
    CONSTRAINT quiz_max_players_valid CHECK ((play_settings->>'max_players')::integer BETWEEN 1 AND 400),
    CONSTRAINT quiz_code_valid CHECK ((play_settings->>'code')::integer BETWEEN 100000 AND 999999)
);

-- ============================================================================
-- STEP 3: CREATE QUESTIONS TABLE
-- ============================================================================

CREATE TABLE public.questions (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to quiz_sets
    question_set_id UUID NOT NULL REFERENCES public.quiz_sets(id) ON DELETE CASCADE,
    
    -- Question content
    question_text TEXT NOT NULL,
    question_type question_type NOT NULL,
    image_url TEXT,
    
    -- Timing settings (in seconds)
    show_question_time INTEGER NOT NULL DEFAULT 10,
    answering_time INTEGER NOT NULL DEFAULT 30,
    show_explanation_time INTEGER NOT NULL DEFAULT 5,
    
    -- Scoring and difficulty
    points INTEGER NOT NULL DEFAULT 1,
    difficulty difficulty_level NOT NULL DEFAULT 'easy',
    
    -- Ordering
    order_index INTEGER NOT NULL,
    
    -- Explanation content
    explanation_title VARCHAR(200),
    explanation_text TEXT,
    explanation_image_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT question_text_length CHECK (char_length(question_text) >= 1),
    CONSTRAINT question_timing_positive CHECK (
        show_question_time > 0 AND 
        answering_time > 0 AND 
        show_explanation_time >= 0
    ),
    CONSTRAINT question_points_positive CHECK (points > 0),
    CONSTRAINT question_order_positive CHECK (order_index >= 0),
    CONSTRAINT question_explanation_title_length CHECK (
        explanation_title IS NULL OR char_length(explanation_title) <= 200
    )
);

-- ============================================================================
-- STEP 4: CREATE ANSWERS TABLE
-- ============================================================================

CREATE TABLE public.answers (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to questions
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    
    -- Answer content
    answer_text TEXT NOT NULL,
    image_url TEXT,
    
    -- Answer properties
    is_correct BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT answer_text_length CHECK (char_length(answer_text) >= 1),
    CONSTRAINT answer_order_positive CHECK (order_index >= 0)
);

-- ============================================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Quiz sets indexes
CREATE INDEX quiz_sets_user_id_idx ON public.quiz_sets (user_id) WHERE deleted_at IS NULL;
CREATE INDEX quiz_sets_status_idx ON public.quiz_sets (status) WHERE deleted_at IS NULL;
CREATE INDEX quiz_sets_public_idx ON public.quiz_sets (is_public) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX quiz_sets_category_idx ON public.quiz_sets (category) WHERE deleted_at IS NULL;
CREATE INDEX quiz_sets_difficulty_idx ON public.quiz_sets (difficulty_level) WHERE deleted_at IS NULL;
CREATE INDEX quiz_sets_created_at_idx ON public.quiz_sets (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX quiz_sets_times_played_idx ON public.quiz_sets (times_played DESC) WHERE deleted_at IS NULL;
CREATE INDEX quiz_sets_tags_idx ON public.quiz_sets USING GIN (tags) WHERE deleted_at IS NULL;

-- Questions indexes
CREATE INDEX questions_quiz_id_idx ON public.questions (question_set_id) WHERE deleted_at IS NULL;
CREATE INDEX questions_order_idx ON public.questions (question_set_id, order_index) WHERE deleted_at IS NULL;
CREATE INDEX questions_type_idx ON public.questions (question_type) WHERE deleted_at IS NULL;
CREATE INDEX questions_difficulty_idx ON public.questions (difficulty) WHERE deleted_at IS NULL;

-- Answers indexes
CREATE INDEX answers_question_id_idx ON public.answers (question_id) WHERE deleted_at IS NULL;
CREATE INDEX answers_order_idx ON public.answers (question_id, order_index) WHERE deleted_at IS NULL;
CREATE INDEX answers_correct_idx ON public.answers (question_id, is_correct) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.quiz_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: CREATE RLS POLICIES - QUIZ_SETS
-- ============================================================================

-- Users can read public published quizzes
CREATE POLICY "Users can read public published quizzes" 
    ON public.quiz_sets FOR SELECT 
    TO authenticated
    USING (
        deleted_at IS NULL 
        AND is_public = true 
        AND status = 'published'
    );

-- Users can read their own quizzes (any status)
CREATE POLICY "Users can read own quizzes" 
    ON public.quiz_sets FOR SELECT 
    TO authenticated
    USING (
        deleted_at IS NULL 
        AND user_id = auth.uid()
    );

-- Users can create their own quizzes
CREATE POLICY "Users can create own quizzes" 
    ON public.quiz_sets FOR INSERT 
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() 
        AND status = 'draft'  -- Only allow draft creation
    );

-- Users can update their own quizzes (with restrictions)
CREATE POLICY "Users can update own quizzes" 
    ON public.quiz_sets FOR UPDATE 
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL)
    WITH CHECK (
        user_id = auth.uid() 
        AND deleted_at IS NULL
        -- Prevent changing user_id
        AND user_id = (SELECT user_id FROM public.quiz_sets WHERE id = quiz_sets.id)
    );

-- Users can delete their own quizzes (soft delete)
CREATE POLICY "Users can delete own quizzes" 
    ON public.quiz_sets FOR UPDATE 
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL)
    WITH CHECK (
        user_id = auth.uid() 
        AND deleted_at IS NOT NULL  -- Only allow soft delete
    );

-- Admins can manage all quizzes
CREATE POLICY "Admins manage all quizzes" 
    ON public.quiz_sets FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- ============================================================================
-- STEP 8: CREATE RLS POLICIES - QUESTIONS
-- ============================================================================

-- Users can read questions from quizzes they can access
CREATE POLICY "Users can read accessible questions" 
    ON public.questions FOR SELECT 
    TO authenticated
    USING (
        deleted_at IS NULL 
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.deleted_at IS NULL
            AND (
                qs.user_id = auth.uid()  -- Own quiz
                OR (qs.is_public = true AND qs.status = 'published')  -- Public quiz
                OR EXISTS (  -- Admin access
                    SELECT 1 FROM public.profiles p 
                    WHERE p.id = auth.uid() 
                    AND p.role = 'admin' 
                    AND p.deleted_at IS NULL
                )
            )
        )
    );

-- Users can create questions in their own quizzes
CREATE POLICY "Users can create questions in own quizzes" 
    ON public.questions FOR INSERT 
    TO authenticated
    WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.user_id = auth.uid() 
            AND qs.deleted_at IS NULL
        )
    );

-- Users can update questions in their own quizzes
CREATE POLICY "Users can update questions in own quizzes" 
    ON public.questions FOR UPDATE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.user_id = auth.uid() 
            AND qs.deleted_at IS NULL
        )
    )
    WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.user_id = auth.uid() 
            AND qs.deleted_at IS NULL
        )
    );

-- Users can delete questions in their own quizzes (soft delete)
CREATE POLICY "Users can delete questions in own quizzes" 
    ON public.questions FOR UPDATE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.user_id = auth.uid() 
            AND qs.deleted_at IS NULL
        )
    )
    WITH CHECK (
        deleted_at IS NOT NULL  -- Only allow soft delete
        AND EXISTS (
            SELECT 1 FROM public.quiz_sets qs 
            WHERE qs.id = question_set_id 
            AND qs.user_id = auth.uid() 
            AND qs.deleted_at IS NULL
        )
    );

-- Admins can manage all questions
CREATE POLICY "Admins manage all questions" 
    ON public.questions FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- ============================================================================
-- STEP 9: CREATE RLS POLICIES - ANSWERS
-- ============================================================================

-- Users can read answers from questions they can access
CREATE POLICY "Users can read accessible answers" 
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
                qs.user_id = auth.uid()  -- Own quiz
                OR (qs.is_public = true AND qs.status = 'published')  -- Public quiz
                OR EXISTS (  -- Admin access
                    SELECT 1 FROM public.profiles p 
                    WHERE p.id = auth.uid() 
                    AND p.role = 'admin' 
                    AND p.deleted_at IS NULL
                )
            )
        )
    );

-- Users can create answers in their own quizzes
CREATE POLICY "Users can create answers in own quizzes" 
    ON public.answers FOR INSERT 
    TO authenticated
    WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND qs.user_id = auth.uid() 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
        )
    );

-- Users can update answers in their own quizzes
CREATE POLICY "Users can update answers in own quizzes" 
    ON public.answers FOR UPDATE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND qs.user_id = auth.uid() 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
        )
    )
    WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND qs.user_id = auth.uid() 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
        )
    );

-- Users can delete answers in their own quizzes (soft delete)
CREATE POLICY "Users can delete answers in own quizzes" 
    ON public.answers FOR UPDATE 
    TO authenticated
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND qs.user_id = auth.uid() 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
        )
    )
    WITH CHECK (
        deleted_at IS NOT NULL  -- Only allow soft delete
        AND EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quiz_sets qs ON qs.id = q.question_set_id
            WHERE q.id = question_id 
            AND qs.user_id = auth.uid() 
            AND q.deleted_at IS NULL
            AND qs.deleted_at IS NULL
        )
    );

-- Admins can manage all answers
CREATE POLICY "Admins manage all answers" 
    ON public.answers FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- ============================================================================
-- STEP 10: CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Auto-update updated_at timestamp for quiz_sets
CREATE TRIGGER on_quiz_sets_updated
    BEFORE UPDATE ON public.quiz_sets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at timestamp for questions
CREATE TRIGGER on_questions_updated
    BEFORE UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at timestamp for answers
CREATE TRIGGER on_answers_updated
    BEFORE UPDATE ON public.answers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- STEP 11: CREATE QUIZ STORAGE BUCKET
-- ============================================================================

-- Create quiz images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'quiz-images',
    'quiz-images',
    true, -- Public read access for quiz images
    10485760, -- 10MB limit for quiz images
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
);

-- ============================================================================
-- STEP 12: CREATE STORAGE POLICIES FOR QUIZ IMAGES
-- ============================================================================

-- Anyone can read quiz images (public)
CREATE POLICY "Public quiz image access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'quiz-images');

-- Users can upload to their own quiz folder
CREATE POLICY "Users upload own quiz images" 
    ON storage.objects FOR INSERT 
    TO authenticated
    WITH CHECK (
        bucket_id = 'quiz-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own quiz images
CREATE POLICY "Users update own quiz images" 
    ON storage.objects FOR UPDATE 
    TO authenticated
    USING (
        bucket_id = 'quiz-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own quiz images
CREATE POLICY "Users delete own quiz images" 
    ON storage.objects FOR DELETE 
    TO authenticated
    USING (
        bucket_id = 'quiz-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Admins can manage all quiz images
CREATE POLICY "Admins manage all quiz images" 
    ON storage.objects FOR ALL 
    TO authenticated
    USING (
        bucket_id = 'quiz-images' 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    )
    WITH CHECK (
        bucket_id = 'quiz-images' 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND deleted_at IS NULL
        )
    );

-- ============================================================================
-- STEP 13: CREATE QUIZ HELPER FUNCTIONS
-- ============================================================================

-- Generate quiz code (6 digits)
CREATE OR REPLACE FUNCTION public.generate_quiz_code()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_code INTEGER;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate random 6-digit code
        new_code := floor(random() * 900000) + 100000;
        
        -- Check if code already exists
        SELECT EXISTS (
            SELECT 1 FROM public.quiz_sets 
            WHERE (play_settings->>'code')::integer = new_code
            AND deleted_at IS NULL
        ) INTO code_exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN new_code;
END;
$$;

-- Update quiz total_questions count
CREATE OR REPLACE FUNCTION public.update_quiz_question_count(quiz_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.quiz_sets
    SET 
        total_questions = (
            SELECT COUNT(*) 
            FROM public.questions 
            WHERE question_set_id = quiz_id 
            AND deleted_at IS NULL
        ),
        updated_at = NOW()
    WHERE id = quiz_id AND deleted_at IS NULL;
END;
$$;

-- Increment quiz play count
CREATE OR REPLACE FUNCTION public.increment_quiz_play_count(quiz_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.quiz_sets
    SET 
        times_played = times_played + 1,
        last_played_at = NOW(),
        updated_at = NOW()
    WHERE id = quiz_id AND deleted_at IS NULL;
END;
$$;

-- Validate quiz before publishing
CREATE OR REPLACE FUNCTION public.validate_quiz_for_publishing(quiz_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    question_count INTEGER;
    has_questions BOOLEAN;
    has_valid_answers BOOLEAN;
BEGIN
    -- Check if quiz exists and user owns it
    IF NOT EXISTS (
        SELECT 1 FROM public.quiz_sets 
        WHERE id = quiz_id 
        AND user_id = auth.uid() 
        AND deleted_at IS NULL
    ) THEN
        RETURN FALSE;
    END IF;
    
    -- Count questions
    SELECT COUNT(*) INTO question_count
    FROM public.questions 
    WHERE question_set_id = quiz_id 
    AND deleted_at IS NULL;
    
    -- Must have at least 1 question
    IF question_count = 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if all questions have valid answers
    SELECT NOT EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.question_set_id = quiz_id 
        AND q.deleted_at IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.answers a
            WHERE a.question_id = q.id 
            AND a.deleted_at IS NULL
            AND a.is_correct = true
        )
    ) INTO has_valid_answers;
    
    RETURN has_valid_answers;
END;
$$;

-- Get quiz with questions and answers (for playing)
CREATE OR REPLACE FUNCTION public.get_quiz_for_play(input_quiz_id UUID)
RETURNS TABLE (
    quiz_id UUID,
    quiz_title VARCHAR(200),
    quiz_description TEXT,
    quiz_settings JSONB,
    questions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if quiz is accessible
    IF NOT EXISTS (
        SELECT 1 FROM public.quiz_sets qs
        WHERE qs.id = input_quiz_id 
        AND qs.deleted_at IS NULL
        AND qs.status = 'published'
        AND (
            qs.is_public = true 
            OR qs.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND p.role = 'admin' 
                AND p.deleted_at IS NULL
            )
        )
    ) THEN
        RAISE EXCEPTION 'Quiz not found or not accessible';
    END IF;
    
    RETURN QUERY
    SELECT 
        qs.id,
        qs.title,
        qs.description,
        qs.play_settings,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', q.id,
                        'question_text', q.question_text,
                        'question_type', q.question_type,
                        'image_url', q.image_url,
                        'show_question_time', q.show_question_time,
                        'answering_time', q.answering_time,
                        'points', q.points,
                        'difficulty', q.difficulty,
                        'order_index', q.order_index,
                        'explanation_title', q.explanation_title,
                        'explanation_text', q.explanation_text,
                        'explanation_image_url', q.explanation_image_url,
                        'show_explanation_time', q.show_explanation_time,
                        'answers', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', a.id,
                                        'answer_text', a.answer_text,
                                        'image_url', a.image_url,
                                        'is_correct', a.is_correct,
                                        'order_index', a.order_index
                                    ) ORDER BY a.order_index
                                )
                                FROM public.answers a
                                WHERE a.question_id = q.id 
                                AND a.deleted_at IS NULL
                            ),
                            '[]'::jsonb
                        )
                    ) ORDER BY q.order_index
                )
                FROM public.questions q
                WHERE q.question_set_id = qs.id 
                AND q.deleted_at IS NULL
            ),
            '[]'::jsonb
        )
    FROM public.quiz_sets qs
    WHERE qs.id = input_quiz_id;
END;
$$;

-- ============================================================================
-- STEP 14: CREATE TRIGGERS FOR AUTOMATIC COUNTS
-- ============================================================================

-- Auto-update question count when questions are added/removed
CREATE OR REPLACE FUNCTION public.handle_question_count_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update quiz question count
    PERFORM public.update_quiz_question_count(COALESCE(NEW.question_set_id, OLD.question_set_id));
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_questions_count_change
    AFTER INSERT OR UPDATE OR DELETE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.handle_question_count_change();

-- ============================================================================
-- STEP 15: GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on types
GRANT USAGE ON TYPE difficulty_level TO authenticated;
GRANT USAGE ON TYPE quiz_status TO authenticated;
GRANT USAGE ON TYPE question_type TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.quiz_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.answers TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.generate_quiz_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quiz_question_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_quiz_play_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_quiz_for_publishing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_for_play(UUID) TO authenticated;

-- ============================================================================
-- STEP 16: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.quiz_sets IS 'Main quiz container with metadata and play settings';
COMMENT ON TABLE public.questions IS 'Individual questions within quizzes';
COMMENT ON TABLE public.answers IS 'Answer options for each question';

COMMENT ON COLUMN public.quiz_sets.play_settings IS 'JSON object containing quiz play configuration';
COMMENT ON COLUMN public.quiz_sets.cloned_from IS 'ID of original quiz if this is a clone';
COMMENT ON COLUMN public.quiz_sets.tags IS 'Array of tags for categorization and search';

COMMENT ON COLUMN public.questions.show_question_time IS 'Time in seconds to show question before answering';
COMMENT ON COLUMN public.questions.answering_time IS 'Time in seconds allowed for answering';
COMMENT ON COLUMN public.questions.show_explanation_time IS 'Time in seconds to show explanation after answering';

COMMENT ON FUNCTION public.generate_quiz_code() IS 'Generate unique 6-digit quiz code';
COMMENT ON FUNCTION public.update_quiz_question_count(UUID) IS 'Update total_questions count for a quiz';
COMMENT ON FUNCTION public.increment_quiz_play_count(UUID) IS 'Increment play count and update last_played_at';
COMMENT ON FUNCTION public.validate_quiz_for_publishing(UUID) IS 'Validate quiz has questions and correct answers before publishing';
COMMENT ON FUNCTION public.get_quiz_for_play(UUID) IS 'Get complete quiz data for playing (questions + answers)';
