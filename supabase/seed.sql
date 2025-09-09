-- Seed data for TUIZ Quiz System
-- Sample quizzes, questions, and answers for testing and development

-- Note: Using existing user ID d08589f0-e42e-48ac-8a11-54723a69b3ae

-- Sample Quiz 1: JavaScript Fundamentals
INSERT INTO public.quiz_sets (
    id, user_id, title, description, is_public, difficulty_level, 
    category, total_questions, times_played, status, tags, play_settings
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'd08589f0-e42e-48ac-8a11-54723a69b3ae',
    'JavaScript Fundamentals',
    'Test your knowledge of JavaScript basics including variables, functions, and data types.',
    true, 'easy', 'Programming', 2, 15, 'published',
    ARRAY['javascript', 'programming', 'basics'],
    '{"code": 123456, "show_question_only": true, "show_explanation": true, "time_bonus": false, "streak_bonus": true, "show_correct_answer": true, "max_players": 50}'::jsonb
);

-- Sample Quiz 2: React Advanced
INSERT INTO public.quiz_sets (
    id, user_id, title, description, is_public, difficulty_level,
    category, total_questions, times_played, status, tags, play_settings
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    'd08589f0-e42e-48ac-8a11-54723a69b3ae',
    'React Advanced Concepts',
    'Advanced React patterns, hooks, and performance optimization techniques.',
    true, 'hard', 'Programming', 2, 8, 'published',
    ARRAY['react', 'hooks', 'performance'],
    '{"code": 234567, "show_question_only": false, "show_explanation": true, "time_bonus": true, "streak_bonus": true, "show_correct_answer": true, "max_players": 30}'::jsonb
);

-- Questions for JavaScript Quiz
INSERT INTO public.questions (
    id, question_set_id, question_text, question_type, show_question_time,
    answering_time, points, difficulty, order_index, explanation_title, explanation_text, show_explanation_time
) VALUES 
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001',
 'What is the correct way to declare a variable in JavaScript?', 'multiple_choice', 10, 30, 1, 'easy', 1,
 'Variable Declaration', 'In JavaScript, you can declare variables using var, let, or const. The let keyword is preferred for block-scoped variables.', 5),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001',
 'JavaScript is a statically typed language.', 'true_false', 8, 20, 1, 'easy', 2,
 'JavaScript Type System', 'JavaScript is dynamically typed, meaning variable types are determined at runtime.', 5);

-- Questions for React Quiz
INSERT INTO public.questions (
    id, question_set_id, question_text, question_type, show_question_time,
    answering_time, points, difficulty, order_index, explanation_title, explanation_text, show_explanation_time
) VALUES 
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002',
 'What is the purpose of useMemo hook in React?', 'multiple_choice', 15, 45, 3, 'hard', 1,
 'React useMemo Hook', 'useMemo is used to memoize expensive calculations and prevent unnecessary re-computations.', 10),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002',
 'React.memo() prevents all re-renders of a component.', 'true_false', 10, 30, 2, 'hard', 2,
 'React.memo Behavior', 'React.memo only prevents re-renders when props are shallowly equal.', 8);

-- Answers for JavaScript Questions
INSERT INTO public.answers (id, question_id, answer_text, is_correct, order_index) VALUES
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'let name = "John";', true, 1),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'var name = "John";', false, 2),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'const name = "John";', false, 3),
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', 'True', false, 1),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', 'False', true, 2);

-- Answers for React Questions
INSERT INTO public.answers (id, question_id, answer_text, is_correct, order_index) VALUES
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440003', 'To memoize expensive calculations', true, 1),
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440003', 'To create side effects', false, 2),
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440003', 'To manage component state', false, 3),
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440004', 'True', false, 1),
('770e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440004', 'False', true, 2);

-- Update quiz question counts
UPDATE public.quiz_sets 
SET total_questions = (
    SELECT COUNT(*) 
    FROM public.questions 
    WHERE question_set_id = quiz_sets.id 
    AND deleted_at IS NULL
)
WHERE id IN ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002');
