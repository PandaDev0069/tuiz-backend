-- Allow service role to bypass RLS policies for testing and admin operations
-- This is necessary for tests to work properly with the admin client

-- Add policy to allow service role to select profiles
CREATE POLICY "Service role can access all profiles"
    ON public.profiles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant necessary permissions to service role
GRANT ALL ON public.profiles TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
