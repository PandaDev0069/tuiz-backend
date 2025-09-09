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

-- Sample Quiz 3: Database Design
INSERT INTO public.quiz_sets (
    id, user_id, title, description, is_public, difficulty_level,
    category, total_questions, times_played, status, tags, play_settings
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'd08589f0-e42e-48ac-8a11-54723a69b3ae',
    'Database Design Principles',
    'Learn about normalization, relationships, and best practices in database design.',
    true, 'medium', 'Database', 3, 22, 'published',
    ARRAY['database', 'sql', 'normalization'],
    '{"code": 345678, "show_question_only": true, "show_explanation": true, "time_bonus": false, "streak_bonus": false, "show_correct_answer": true, "max_players": 100}'::jsonb
);

-- Sample Quiz 4: World Geography
INSERT INTO public.quiz_sets (
    id, user_id, title, description, is_public, difficulty_level,
    category, total_questions, times_played, status, tags, play_settings
) VALUES (
    '550e8400-e29b-41d4-a716-446655440004',
    'd08589f0-e42e-48ac-8a11-54723a69b3ae',
    'World Geography Trivia',
    'Test your knowledge of countries, capitals, and geographical features around the world.',
    true, 'medium', 'Geography', 4, 45, 'published',
    ARRAY['geography', 'world', 'countries'],
    '{"code": 456789, "show_question_only": false, "show_explanation": true, "time_bonus": true, "streak_bonus": true, "show_correct_answer": true, "max_players": 200}'::jsonb
);

-- Sample Quiz 5: Python Data Science (Draft)
INSERT INTO public.quiz_sets (
    id, user_id, title, description, is_public, difficulty_level,
    category, total_questions, times_played, status, tags, play_settings
) VALUES (
    '550e8400-e29b-41d4-a716-446655440005',
    'd08589f0-e42e-48ac-8a11-54723a69b3ae',
    'Python Data Science',
    'A work in progress quiz about Python libraries for data science and machine learning.',
    false, 'expert', 'Programming', 0, 0, 'draft',
    ARRAY['python', 'data-science', 'machine-learning'],
    '{"code": 789012, "show_question_only": true, "show_explanation": true, "time_bonus": true, "streak_bonus": false, "show_correct_answer": true, "max_players": 25}'::jsonb
);

-- Sample Quiz 6: TypeScript Fundamentals
INSERT INTO public.quiz_sets (
    id, user_id, title, description, is_public, difficulty_level,
    category, total_questions, times_played, status, tags, play_settings
) VALUES (
    '550e8400-e29b-41d4-a716-446655440006',
    'd08589f0-e42e-48ac-8a11-54723a69b3ae',
    'TypeScript Fundamentals',
    'Learn TypeScript basics including types, interfaces, and generics.',
    true, 'easy', 'Programming', 3, 12, 'published',
    ARRAY['typescript', 'types', 'interfaces'],
    '{"code": 567890, "show_question_only": true, "show_explanation": true, "time_bonus": false, "streak_bonus": true, "show_correct_answer": true, "max_players": 75}'::jsonb
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

-- Questions for Database Design Quiz
INSERT INTO public.questions (
    id, question_set_id, question_text, question_type, show_question_time,
    answering_time, points, difficulty, order_index, explanation_title, explanation_text, show_explanation_time
) VALUES 
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003',
 'What is the primary purpose of database normalization?', 'multiple_choice', 15, 35, 2, 'medium', 1,
 'Database Normalization', 'Normalization reduces data redundancy and improves data integrity by organizing data into related tables.', 8),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003',
 'A foreign key must reference a primary key in another table.', 'true_false', 10, 25, 1, 'medium', 2,
 'Foreign Key Constraints', 'A foreign key must reference either a primary key or a unique key in another table.', 6),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003',
 'Which normal form eliminates partial dependencies?', 'multiple_choice', 12, 30, 2, 'medium', 3,
 'Second Normal Form (2NF)', 'Second Normal Form (2NF) eliminates partial dependencies by ensuring all non-key attributes are fully dependent on the primary key.', 8);

-- Questions for World Geography Quiz
INSERT INTO public.questions (
    id, question_set_id, question_text, question_type, show_question_time,
    answering_time, points, difficulty, order_index, explanation_title, explanation_text, show_explanation_time
) VALUES 
('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004',
 'What is the capital of Australia?', 'multiple_choice', 8, 20, 1, 'medium', 1,
 'Australian Capital', 'Canberra is the capital of Australia, not Sydney or Melbourne.', 5),
('660e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440004',
 'The Amazon River is the longest river in the world.', 'true_false', 10, 25, 1, 'medium', 2,
 'World Rivers', 'The Nile River is the longest river in the world at approximately 6,650 km.', 6),
('660e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440004',
 'Which country has the most time zones?', 'multiple_choice', 12, 30, 2, 'medium', 3,
 'Time Zones Around the World', 'France has the most time zones with 12, due to its overseas territories.', 8),
('660e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440004',
 'Mount Everest is located in Nepal.', 'true_false', 8, 20, 1, 'medium', 4,
 'Mount Everest Location', 'Mount Everest is located on the border between Nepal and China (Tibet).', 5);

-- Questions for TypeScript Quiz
INSERT INTO public.questions (
    id, question_set_id, question_text, question_type, show_question_time,
    answering_time, points, difficulty, order_index, explanation_title, explanation_text, show_explanation_time
) VALUES 
('660e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440006',
 'What is the main benefit of using TypeScript over JavaScript?', 'multiple_choice', 10, 25, 1, 'easy', 1,
 'TypeScript Benefits', 'TypeScript provides static type checking, which helps catch errors at compile time.', 5),
('660e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440006',
 'TypeScript is a superset of JavaScript.', 'true_false', 8, 20, 1, 'easy', 2,
 'TypeScript and JavaScript', 'TypeScript is indeed a superset of JavaScript, meaning all valid JavaScript is also valid TypeScript.', 5),
('660e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440006',
 'What keyword is used to define an interface in TypeScript?', 'multiple_choice', 10, 25, 1, 'easy', 3,
 'TypeScript Interfaces', 'The "interface" keyword is used to define interfaces in TypeScript.', 5);

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

-- Answers for Database Design Questions
INSERT INTO public.answers (id, question_id, answer_text, is_correct, order_index) VALUES
('770e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440005', 'To reduce data redundancy', true, 1),
('770e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440005', 'To increase storage space', false, 2),
('770e8400-e29b-41d4-a716-446655440013', '660e8400-e29b-41d4-a716-446655440005', 'To make queries slower', false, 3),
('770e8400-e29b-41d4-a716-446655440014', '660e8400-e29b-41d4-a716-446655440006', 'True', true, 1),
('770e8400-e29b-41d4-a716-446655440015', '660e8400-e29b-41d4-a716-446655440006', 'False', false, 2),
('770e8400-e29b-41d4-a716-446655440016', '660e8400-e29b-41d4-a716-446655440007', 'Second Normal Form (2NF)', true, 1),
('770e8400-e29b-41d4-a716-446655440017', '660e8400-e29b-41d4-a716-446655440007', 'First Normal Form (1NF)', false, 2),
('770e8400-e29b-41d4-a716-446655440018', '660e8400-e29b-41d4-a716-446655440007', 'Third Normal Form (3NF)', false, 3);

-- Answers for World Geography Questions
INSERT INTO public.answers (id, question_id, answer_text, is_correct, order_index) VALUES
('770e8400-e29b-41d4-a716-446655440019', '660e8400-e29b-41d4-a716-446655440008', 'Canberra', true, 1),
('770e8400-e29b-41d4-a716-446655440020', '660e8400-e29b-41d4-a716-446655440008', 'Sydney', false, 2),
('770e8400-e29b-41d4-a716-446655440021', '660e8400-e29b-41d4-a716-446655440008', 'Melbourne', false, 3),
('770e8400-e29b-41d4-a716-446655440022', '660e8400-e29b-41d4-a716-446655440009', 'True', false, 1),
('770e8400-e29b-41d4-a716-446655440023', '660e8400-e29b-41d4-a716-446655440009', 'False', true, 2),
('770e8400-e29b-41d4-a716-446655440024', '660e8400-e29b-41d4-a716-446655440010', 'France', true, 1),
('770e8400-e29b-41d4-a716-446655440025', '660e8400-e29b-41d4-a716-446655440010', 'United States', false, 2),
('770e8400-e29b-41d4-a716-446655440026', '660e8400-e29b-41d4-a716-446655440010', 'Russia', false, 3),
('770e8400-e29b-41d4-a716-446655440027', '660e8400-e29b-41d4-a716-446655440011', 'True', false, 1),
('770e8400-e29b-41d4-a716-446655440028', '660e8400-e29b-41d4-a716-446655440011', 'False', true, 2);

-- Answers for TypeScript Questions
INSERT INTO public.answers (id, question_id, answer_text, is_correct, order_index) VALUES
('770e8400-e29b-41d4-a716-446655440029', '660e8400-e29b-41d4-a716-446655440012', 'Static type checking', true, 1),
('770e8400-e29b-41d4-a716-446655440030', '660e8400-e29b-41d4-a716-446655440012', 'Faster execution', false, 2),
('770e8400-e29b-41d4-a716-446655440031', '660e8400-e29b-41d4-a716-446655440012', 'Smaller file size', false, 3),
('770e8400-e29b-41d4-a716-446655440032', '660e8400-e29b-41d4-a716-446655440013', 'True', true, 1),
('770e8400-e29b-41d4-a716-446655440033', '660e8400-e29b-41d4-a716-446655440013', 'False', false, 2),
('770e8400-e29b-41d4-a716-446655440034', '660e8400-e29b-41d4-a716-446655440014', 'interface', true, 1),
('770e8400-e29b-41d4-a716-446655440035', '660e8400-e29b-41d4-a716-446655440014', 'class', false, 2),
('770e8400-e29b-41d4-a716-446655440036', '660e8400-e29b-41d4-a716-446655440014', 'type', false, 3);

-- Update quiz question counts
UPDATE public.quiz_sets 
SET total_questions = (
    SELECT COUNT(*) 
    FROM public.questions 
    WHERE question_set_id = quiz_sets.id 
    AND deleted_at IS NULL
)
WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440001', 
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440006'
);
