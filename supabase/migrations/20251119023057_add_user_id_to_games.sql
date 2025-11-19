-- =============================================
-- Update games table to add user_id column
-- =============================================
-- This migration adds a new column 'user_id' to the 'games' table
-- to associate each game with a specific user. This column is of type UUID
-- and allows NULL values to accommodate existing records without a user association.

ALTER TABLE public.games
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for user_id lookups (performance optimization)
CREATE INDEX IF NOT EXISTS idx_games_user_id ON public.games (user_id);

-- =============================================
-- Update RLS Policies
-- =============================================
-- Drop old policies that conflict with user-based access control
DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
DROP POLICY IF EXISTS "Game hosts can update their games" ON public.games;

-- Create new user-based policies
-- Policy: Users can view games they created OR games that are public (NULL user_id = guest games)
CREATE POLICY "Users can view their own or public games"
  ON public.games
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL OR auth.role() = 'service_role');

-- Policy: Authenticated users can create games with their user_id
CREATE POLICY "Authenticated users can create games"
  ON public.games
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
    OR auth.role() = 'service_role'
  );

-- Policy: Users can update their own games OR game hosts can update via device_id
CREATE POLICY "Users can update their own games"
  ON public.games
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = games.id
      AND players.is_host = true
      AND players.device_id = current_setting('request.headers')::json->>'x-device-id'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

-- Policy: Users can delete their own games
CREATE POLICY "Users can delete their own games"
  ON public.games
  FOR DELETE
  USING (user_id = auth.uid() OR auth.role() = 'service_role');