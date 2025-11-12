-- =============================================
-- Fix Function Search Path Security Warnings
-- =============================================
-- This migration fixes the search_path security warnings by setting
-- an explicit search_path for all functions to prevent privilege escalation attacks.
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- =============================================
-- Fix: update_updated_at_column
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path = '';

-- =============================================
-- Fix: update_game_player_count
-- =============================================
CREATE OR REPLACE FUNCTION public.update_game_player_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.games
    SET current_players = current_players + 1
    WHERE id = NEW.game_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.games
    SET current_players = GREATEST(current_players - 1, 0)
    WHERE id = OLD.game_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =============================================
-- Fix: get_game_leaderboard
-- =============================================
CREATE OR REPLACE FUNCTION public.get_game_leaderboard(game_uuid uuid, limit_count integer DEFAULT 10)
RETURNS TABLE (
  player_id uuid,
  player_name varchar,
  score integer,
  rank bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS player_id,
    p.player_name,
    gpd.score,
    ROW_NUMBER() OVER (ORDER BY gpd.score DESC) AS rank
  FROM public.game_player_data gpd
  JOIN public.players p ON gpd.player_id = p.id
  WHERE gpd.game_id = game_uuid
  ORDER BY gpd.score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = '';

-- =============================================
-- Comments
-- =============================================
COMMENT ON FUNCTION public.update_updated_at_column IS 'Trigger function to automatically update updated_at timestamp. Uses empty search_path for security.';
COMMENT ON FUNCTION public.update_game_player_count IS 'Trigger function to maintain player count in games table. Uses empty search_path for security.';
COMMENT ON FUNCTION public.get_game_leaderboard IS 'Returns ranked leaderboard for a game. Uses empty search_path for security.';
