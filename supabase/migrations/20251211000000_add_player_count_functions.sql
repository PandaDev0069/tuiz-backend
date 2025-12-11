-- Migration: Add player count management functions
-- Helper functions for safely updating game player counts
-- Created: 2025-12-11

-- Function to increment game player count
CREATE OR REPLACE FUNCTION public.increment_game_players(p_game_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.games
  SET current_players = current_players + 1
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement game player count
CREATE OR REPLACE FUNCTION public.decrement_game_players(p_game_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.games
  SET current_players = GREATEST(current_players - 1, 0)
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION public.increment_game_players IS 'Safely increment the current_players count for a game';
COMMENT ON FUNCTION public.decrement_game_players IS 'Safely decrement the current_players count for a game (never goes below 0)';
