-- =============================================
-- Game System Migration
-- =============================================
-- This migration creates tables for the real-time quiz game flow:
-- - players: lightweight identity per-session (guest friendly)
-- - games: session lifecycle & settings
-- - game_flows: pointer to per-game state
-- - game_player_data: per-player per-game stats (score + analytics)

-- =============================================
-- Create custom types/enums
-- =============================================

-- Game status enum
DO $$ BEGIN
  CREATE TYPE game_status AS ENUM ('waiting', 'active', 'paused', 'finished');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- Table: games
-- =============================================
-- Session lifecycle & settings only (no heavy counters)

CREATE TABLE IF NOT EXISTS public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_set_id uuid NOT NULL,
  game_code varchar(10) NOT NULL,
  current_players integer DEFAULT 0,
  status game_status DEFAULT 'waiting',
  current_question_index integer DEFAULT 0,
  current_question_start_time timestamptz,
  game_settings jsonb DEFAULT '{}'::jsonb,
  locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  paused_at timestamptz,
  resumed_at timestamptz,
  ended_at timestamptz,
  PRIMARY KEY (id)
);

-- Add unique constraint for game codes (quick lookups)
CREATE UNIQUE INDEX IF NOT EXISTS uq_games_game_code ON public.games (game_code);

-- Add index for quiz_set_id lookups
CREATE INDEX IF NOT EXISTS idx_games_quiz_set_id ON public.games (quiz_set_id);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games (status);

-- =============================================
-- Table: players
-- =============================================
-- Lightweight identity per-session (guest friendly)

CREATE TABLE IF NOT EXISTS public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id varchar(100),
  game_id uuid NOT NULL,
  player_name varchar(100) NOT NULL,
  is_logged_in boolean NOT NULL DEFAULT false,
  is_host boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Indexes for players
CREATE INDEX IF NOT EXISTS idx_players_game_id ON public.players (game_id);
CREATE INDEX IF NOT EXISTS idx_players_device_id ON public.players (device_id);
CREATE INDEX IF NOT EXISTS idx_players_game_device ON public.players (game_id, device_id);

-- =============================================
-- Table: game_flows
-- =============================================
-- Pointer to per-game state (minimal)

CREATE TABLE IF NOT EXISTS public.game_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  quiz_set_id uuid NOT NULL,
  total_questions integer NOT NULL DEFAULT 0,
  current_question_id uuid,
  next_question_id uuid,
  current_question_index integer DEFAULT 0,
  current_question_start_time timestamptz,
  current_question_end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Index for game_flows
CREATE INDEX IF NOT EXISTS idx_game_flows_game_id ON public.game_flows (game_id);
CREATE INDEX IF NOT EXISTS idx_game_flows_quiz_set_id ON public.game_flows (quiz_set_id);

-- =============================================
-- Table: game_player_data
-- =============================================
-- Per-player per-game final/ongoing stats (score + json report)

CREATE TABLE IF NOT EXISTS public.game_player_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  player_device_id varchar(100) NOT NULL,
  game_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  answer_report jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Indexes for leaderboard queries and lookups
CREATE INDEX IF NOT EXISTS idx_gpd_game_score ON public.game_player_data (game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_gpd_player_game ON public.game_player_data (player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_gpd_device_game ON public.game_player_data (player_device_id, game_id);

-- =============================================
-- Foreign Key Constraints
-- =============================================

-- Players -> Games
ALTER TABLE public.players
  ADD CONSTRAINT fk_players_games 
  FOREIGN KEY (game_id) 
  REFERENCES public.games(id) 
  ON DELETE CASCADE;

-- Game Flows -> Games
ALTER TABLE public.game_flows
  ADD CONSTRAINT fk_game_flows_games 
  FOREIGN KEY (game_id) 
  REFERENCES public.games(id) 
  ON DELETE CASCADE;

-- Game Player Data -> Players
ALTER TABLE public.game_player_data
  ADD CONSTRAINT fk_gpd_players 
  FOREIGN KEY (player_id) 
  REFERENCES public.players(id) 
  ON DELETE CASCADE;

-- Game Player Data -> Games
ALTER TABLE public.game_player_data
  ADD CONSTRAINT fk_gpd_games 
  FOREIGN KEY (game_id) 
  REFERENCES public.games(id) 
  ON DELETE CASCADE;

-- =============================================
-- Triggers for updated_at
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all game tables
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_flows_updated_at
  BEFORE UPDATE ON public.game_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_player_data_updated_at
  BEFORE UPDATE ON public.game_player_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_player_data ENABLE ROW LEVEL SECURITY;

-- Games policies
CREATE POLICY "Games are viewable by everyone"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Game hosts can update their games"
  ON public.games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = games.id
      AND players.is_host = true
      AND (
        players.device_id = current_setting('request.headers')::json->>'x-device-id'
        OR auth.uid() IS NOT NULL
      )
    )
    OR auth.role() = 'service_role'
  );

-- Players policies
CREATE POLICY "Players are viewable by everyone"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create a player"
  ON public.players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update their own data"
  ON public.players FOR UPDATE
  USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
    OR auth.role() = 'service_role'
  );

-- Game flows policies
CREATE POLICY "Game flows are viewable by everyone"
  ON public.game_flows FOR SELECT
  USING (true);

CREATE POLICY "Game hosts can manage game flows"
  ON public.game_flows FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = game_flows.game_id
      AND players.is_host = true
      AND (
        players.device_id = current_setting('request.headers')::json->>'x-device-id'
        OR auth.uid() IS NOT NULL
      )
    )
    OR auth.role() = 'service_role'
  );

-- Game player data policies
CREATE POLICY "Game player data is viewable by everyone"
  ON public.game_player_data FOR SELECT
  USING (true);

CREATE POLICY "Players can insert their own data"
  ON public.game_player_data FOR INSERT
  WITH CHECK (
    player_device_id = current_setting('request.headers')::json->>'x-device-id'
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Players can update their own data"
  ON public.game_player_data FOR UPDATE
  USING (
    player_device_id = current_setting('request.headers')::json->>'x-device-id'
    OR auth.role() = 'service_role'
  );

-- =============================================
-- Helper Functions
-- =============================================

-- Function to get leaderboard for a game
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update player count in game
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
$$ LANGUAGE plpgsql;

-- Trigger to auto-update player count
CREATE TRIGGER update_game_player_count_trigger
  AFTER INSERT OR DELETE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_game_player_count();

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE public.games IS 'Stores game sessions with lifecycle management';
COMMENT ON TABLE public.players IS 'Lightweight player identity (supports guest players)';
COMMENT ON TABLE public.game_flows IS 'Tracks current question state for each game';
COMMENT ON TABLE public.game_player_data IS 'Stores player scores and answer analytics';

COMMENT ON COLUMN public.games.game_code IS 'Unique 10-character code for joining games';
COMMENT ON COLUMN public.games.game_settings IS 'JSON config for game rules and timing';
COMMENT ON COLUMN public.players.device_id IS 'Browser device ID for guest reconnection';
COMMENT ON COLUMN public.game_player_data.answer_report IS 'JSON analytics: {q1: {answer: "B", is_correct: true, time_taken: 4200}}';
