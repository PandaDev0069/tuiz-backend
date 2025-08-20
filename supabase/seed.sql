-- Create a demo user (you still need to login with Supabase Auth to actually test in app)
-- Use a fixed UUID to avoid conflicts on re-seeding
DO $$
DECLARE
    demo_user_id uuid := '550e8400-e29b-41d4-a716-446655440000';
BEGIN
    -- Insert demo user only if it doesn't exist
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    VALUES (
        demo_user_id,
        'demo@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        'authenticated',
        'authenticated'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insert a matching profile only if it doesn't exist
    INSERT INTO app.profiles (id, username, display_name, avatar_url, role)
    VALUES (
        demo_user_id,
        'demo_user',
        'Demo Player',
        null,
        'user'
    )
    ON CONFLICT (id) DO NOTHING;
END $$;
