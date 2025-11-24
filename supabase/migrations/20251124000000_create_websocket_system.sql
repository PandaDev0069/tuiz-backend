-- =============================================
-- WebSocket System Migration
-- =============================================
-- This migration creates tables for WebSocket connection tracking,
-- device session management, and game event logging for production
-- multi-server deployments and persistent state management.
--
-- Related to: WEBSOCKET_DATABASE_REQUIREMENTS.md
-- Dependencies: 20251017061513_create_game_system.sql (games, players tables)

-- =============================================
-- Create custom types/enums
-- =============================================

-- Connection status enum
DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM ('active', 'disconnected', 'timeout');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- Table: websocket_connections
-- =============================================
-- Tracks active and historical WebSocket connections for audit and analytics

CREATE TABLE IF NOT EXISTS public.websocket_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  socket_id varchar(255) NOT NULL,
  device_id varchar(255) NOT NULL,
  user_id uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  reconnect_count integer NOT NULL DEFAULT 0,
  ip_address varchar(45),
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  status connection_status NOT NULL DEFAULT 'active',
  PRIMARY KEY (id)
);

-- Indexes for websocket_connections
CREATE INDEX IF NOT EXISTS idx_ws_conn_device_id ON public.websocket_connections (device_id);
CREATE INDEX IF NOT EXISTS idx_ws_conn_user_id ON public.websocket_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_ws_conn_status ON public.websocket_connections (status);
CREATE INDEX IF NOT EXISTS idx_ws_conn_connected_at ON public.websocket_connections (connected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ws_conn_socket_id ON public.websocket_connections (socket_id);

-- Composite index for active connection lookups
CREATE INDEX IF NOT EXISTS idx_ws_conn_device_status ON public.websocket_connections (device_id, status)
  WHERE status = 'active';

-- =============================================
-- Table: device_sessions
-- =============================================
-- Tracks device session history for user identification and analytics

CREATE TABLE IF NOT EXISTS public.device_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id varchar(255) NOT NULL UNIQUE,
  user_id uuid,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  total_connections integer NOT NULL DEFAULT 0,
  total_reconnections integer NOT NULL DEFAULT 0,
  browser_fingerprint varchar(255),
  metadata jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

-- Indexes for device_sessions
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_sessions_device_id ON public.device_sessions (device_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id ON public.device_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_last_seen ON public.device_sessions (last_seen DESC);

-- =============================================
-- Table: game_events
-- =============================================
-- Logs game actions and events for replay, analytics, and debugging

CREATE TABLE IF NOT EXISTS public.game_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  socket_id varchar(255),
  device_id varchar(255),
  player_id uuid,
  user_id uuid,
  timestamp timestamptz NOT NULL DEFAULT now(),
  action varchar(255) NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  sequence_number integer NOT NULL,
  PRIMARY KEY (id)
);

-- Indexes for game_events
CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON public.game_events (game_id);
CREATE INDEX IF NOT EXISTS idx_game_events_timestamp ON public.game_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_game_events_event_type ON public.game_events (event_type);
CREATE INDEX IF NOT EXISTS idx_game_events_player_id ON public.game_events (player_id);

-- Composite index for ordered event replay by game
CREATE INDEX IF NOT EXISTS idx_game_events_game_sequence ON public.game_events (game_id, sequence_number);

-- =============================================
-- Table: room_participants (Extension of players table concept)
-- =============================================
-- Enhanced tracking of room membership with detailed connection history
-- Note: This complements the existing players table with additional metadata

CREATE TABLE IF NOT EXISTS public.room_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  socket_id varchar(255) NOT NULL,
  device_id varchar(255) NOT NULL,
  player_id uuid NOT NULL,
  user_id uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  role varchar(50) NOT NULL DEFAULT 'player',
  status connection_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

-- Indexes for room_participants
CREATE INDEX IF NOT EXISTS idx_room_part_game_id ON public.room_participants (game_id);
CREATE INDEX IF NOT EXISTS idx_room_part_device_id ON public.room_participants (device_id);
CREATE INDEX IF NOT EXISTS idx_room_part_socket_id ON public.room_participants (socket_id);
CREATE INDEX IF NOT EXISTS idx_room_part_player_id ON public.room_participants (player_id);
CREATE INDEX IF NOT EXISTS idx_room_part_status ON public.room_participants (status);

-- Composite index for active participant lookups
CREATE INDEX IF NOT EXISTS idx_room_part_game_status ON public.room_participants (game_id, status)
  WHERE status = 'active';

-- =============================================
-- Foreign Key Constraints
-- =============================================

-- Websocket connections -> auth.users (optional, for authenticated users)
ALTER TABLE public.websocket_connections
  ADD CONSTRAINT fk_ws_conn_users 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- Device sessions -> auth.users (optional)
ALTER TABLE public.device_sessions
  ADD CONSTRAINT fk_device_sessions_users 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- Game events -> games
ALTER TABLE public.game_events
  ADD CONSTRAINT fk_game_events_games 
  FOREIGN KEY (game_id) 
  REFERENCES public.games(id) 
  ON DELETE CASCADE;

-- Game events -> players (optional)
ALTER TABLE public.game_events
  ADD CONSTRAINT fk_game_events_players 
  FOREIGN KEY (player_id) 
  REFERENCES public.players(id) 
  ON DELETE SET NULL;

-- Room participants -> games
ALTER TABLE public.room_participants
  ADD CONSTRAINT fk_room_part_games 
  FOREIGN KEY (game_id) 
  REFERENCES public.games(id) 
  ON DELETE CASCADE;

-- Room participants -> players
ALTER TABLE public.room_participants
  ADD CONSTRAINT fk_room_part_players 
  FOREIGN KEY (player_id) 
  REFERENCES public.players(id) 
  ON DELETE CASCADE;

-- =============================================
-- Helper Functions
-- =============================================

-- Function to get reconnection count for a device
CREATE OR REPLACE FUNCTION public.get_device_reconnect_count(p_device_id varchar)
RETURNS integer AS $$
DECLARE
  reconnect_count integer;
BEGIN
  SELECT COUNT(*) INTO reconnect_count
  FROM public.websocket_connections
  WHERE device_id = p_device_id AND status = 'disconnected';
  
  RETURN COALESCE(reconnect_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get active connections count
CREATE OR REPLACE FUNCTION public.get_active_connections_count()
RETURNS integer AS $$
DECLARE
  active_count integer;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM public.websocket_connections
  WHERE status = 'active';
  
  RETURN COALESCE(active_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get game event sequence for replay
CREATE OR REPLACE FUNCTION public.get_game_event_sequence(p_game_id uuid)
RETURNS TABLE (
  event_id uuid,
  event_type varchar,
  action varchar,
  payload jsonb,
  event_timestamp timestamptz,
  sequence_number integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ge.id AS event_id,
    ge.event_type,
    ge.action,
    ge.payload,
    ge.timestamp AS event_timestamp,
    ge.sequence_number
  FROM public.game_events ge
  WHERE ge.game_id = p_game_id
  ORDER BY ge.sequence_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to update device session on connection
CREATE OR REPLACE FUNCTION public.update_device_session(
  p_device_id varchar,
  p_user_id uuid DEFAULT NULL,
  p_browser_fingerprint varchar DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  session_id uuid;
BEGIN
  -- Upsert device session
  INSERT INTO public.device_sessions (
    device_id,
    user_id,
    first_seen,
    last_seen,
    total_connections,
    total_reconnections,
    browser_fingerprint,
    metadata
  ) VALUES (
    p_device_id,
    p_user_id,
    now(),
    now(),
    1,
    0,
    p_browser_fingerprint,
    p_metadata
  )
  ON CONFLICT (device_id) DO UPDATE SET
    user_id = COALESCE(p_user_id, device_sessions.user_id),
    last_seen = now(),
    total_connections = device_sessions.total_connections + 1,
    browser_fingerprint = COALESCE(p_browser_fingerprint, device_sessions.browser_fingerprint),
    metadata = p_metadata
  RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to record reconnection
CREATE OR REPLACE FUNCTION public.record_reconnection(p_device_id varchar)
RETURNS void AS $$
BEGIN
  UPDATE public.device_sessions
  SET 
    total_reconnections = total_reconnections + 1,
    last_seen = now()
  WHERE device_id = p_device_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to log game event with auto-incrementing sequence
CREATE OR REPLACE FUNCTION public.log_game_event(
  p_game_id uuid,
  p_event_type varchar,
  p_action varchar,
  p_socket_id varchar DEFAULT NULL,
  p_device_id varchar DEFAULT NULL,
  p_player_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  event_id uuid;
  next_sequence integer;
BEGIN
  -- Get next sequence number for this game
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_sequence
  FROM public.game_events
  WHERE game_id = p_game_id;
  
  -- Insert event
  INSERT INTO public.game_events (
    game_id,
    event_type,
    socket_id,
    device_id,
    player_id,
    user_id,
    action,
    payload,
    sequence_number
  ) VALUES (
    p_game_id,
    p_event_type,
    p_socket_id,
    p_device_id,
    p_player_id,
    p_user_id,
    p_action,
    p_payload,
    next_sequence
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get daily connection stats
CREATE OR REPLACE FUNCTION public.get_daily_connection_stats(days_back integer DEFAULT 30)
RETURNS TABLE (
  date date,
  total_connections bigint,
  unique_devices bigint,
  unique_users bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(wc.connected_at) AS date,
    COUNT(*) AS total_connections,
    COUNT(DISTINCT wc.device_id) AS unique_devices,
    COUNT(DISTINCT wc.user_id) FILTER (WHERE wc.user_id IS NOT NULL) AS unique_users
  FROM public.websocket_connections wc
  WHERE wc.connected_at > now() - (days_back || ' days')::interval
  GROUP BY DATE(wc.connected_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get game completion rate by type
CREATE OR REPLACE FUNCTION public.get_game_completion_stats()
RETURNS TABLE (
  game_type varchar,
  total_games bigint,
  completed_games bigint,
  completion_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'quiz'::varchar AS game_type,
    COUNT(*) AS total_games,
    COUNT(*) FILTER (WHERE g.status = 'finished') AS completed_games,
    ROUND(
      (COUNT(*) FILTER (WHERE g.status = 'finished')::numeric / NULLIF(COUNT(*), 0)) * 100,
      2
    ) AS completion_rate
  FROM public.games g
  GROUP BY game_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to cleanup old connections (for background job)
CREATE OR REPLACE FUNCTION public.cleanup_old_websocket_connections(days_old integer DEFAULT 30)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.websocket_connections
    WHERE 
      status IN ('disconnected', 'timeout')
      AND connected_at < now() - (days_old || ' days')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to mark stale connections as timed out
CREATE OR REPLACE FUNCTION public.mark_stale_connections(timeout_minutes integer DEFAULT 5)
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.websocket_connections
    SET 
      status = 'timeout',
      disconnected_at = now()
    WHERE 
      status = 'active'
      AND last_heartbeat < now() - (timeout_minutes || ' minutes')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.websocket_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- WebSocket connections policies (service role only for security)
CREATE POLICY "Service role can manage websocket connections"
  ON public.websocket_connections FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own connections"
  ON public.websocket_connections FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Device sessions policies
CREATE POLICY "Service role can manage device sessions"
  ON public.device_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own device sessions"
  ON public.device_sessions FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Game events policies (viewable by game participants)
CREATE POLICY "Service role can manage game events"
  ON public.game_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Game participants can view events"
  ON public.game_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.game_id = game_events.game_id
      AND (
        p.device_id = current_setting('request.headers', true)::json->>'x-device-id'
        OR (auth.uid() IS NOT NULL AND p.device_id IN (
          SELECT device_id FROM public.device_sessions WHERE user_id = auth.uid()
        ))
      )
    )
    OR auth.role() = 'service_role'
  );

-- Room participants policies
CREATE POLICY "Service role can manage room participants"
  ON public.room_participants FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view room participants"
  ON public.room_participants FOR SELECT
  USING (true);

CREATE POLICY "Players can insert their own participation"
  ON public.room_participants FOR INSERT
  WITH CHECK (
    device_id = current_setting('request.headers', true)::json->>'x-device-id'
    OR auth.role() = 'service_role'
  );

-- =============================================
-- Triggers
-- =============================================

-- Trigger to auto-update device session on connection
CREATE OR REPLACE FUNCTION public.auto_update_device_session()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.update_device_session(
      NEW.device_id,
      NEW.user_id,
      NULL,
      NEW.metadata
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE TRIGGER trigger_auto_update_device_session
  AFTER INSERT ON public.websocket_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_device_session();

-- Trigger to record reconnection count
CREATE OR REPLACE FUNCTION public.auto_record_reconnection()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.reconnect_count > 0) THEN
    PERFORM public.record_reconnection(NEW.device_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE TRIGGER trigger_auto_record_reconnection
  AFTER INSERT ON public.websocket_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_record_reconnection();

-- =============================================
-- Comments and Documentation
-- =============================================

COMMENT ON TABLE public.websocket_connections IS 'Tracks active and historical WebSocket connections for audit, analytics, and reconnection handling';
COMMENT ON TABLE public.device_sessions IS 'Aggregates device session history for user identification and usage patterns';
COMMENT ON TABLE public.game_events IS 'Logs all game actions and events for replay, analytics, debugging, and cheat detection';
COMMENT ON TABLE public.room_participants IS 'Enhanced room membership tracking with detailed connection history (complements players table)';

COMMENT ON COLUMN public.websocket_connections.socket_id IS 'Socket.IO connection identifier';
COMMENT ON COLUMN public.websocket_connections.device_id IS 'Unique device identifier from localStorage (format: tuiz_device_{uuid})';
COMMENT ON COLUMN public.websocket_connections.reconnect_count IS 'Number of reconnections for this device in this session';
COMMENT ON COLUMN public.websocket_connections.metadata IS 'Additional connection metadata (browser info, screen size, etc.)';

COMMENT ON COLUMN public.device_sessions.browser_fingerprint IS 'Browser fingerprint hash for multi-device detection';
COMMENT ON COLUMN public.device_sessions.total_connections IS 'Total number of connections across all time';
COMMENT ON COLUMN public.device_sessions.total_reconnections IS 'Total number of reconnections across all time';

COMMENT ON COLUMN public.game_events.sequence_number IS 'Auto-incrementing sequence per game for ordered replay';
COMMENT ON COLUMN public.game_events.payload IS 'Event-specific data (answer submitted, move made, state change, etc.)';

COMMENT ON COLUMN public.room_participants.role IS 'Participant role: host, player, spectator, moderator';
COMMENT ON COLUMN public.room_participants.metadata IS 'Additional participant metadata (connection quality, permissions, etc.)';

-- =============================================
-- Indexes for Performance Optimization
-- =============================================

-- Additional composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ws_conn_device_user ON public.websocket_connections (device_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_events_game_type ON public.game_events (game_id, event_type);

CREATE INDEX IF NOT EXISTS idx_room_part_game_player ON public.room_participants (game_id, player_id);

-- =============================================
-- Initial Data/Seed (Optional)
-- =============================================

-- No seed data required for WebSocket tables as they are populated at runtime

-- =============================================
-- Migration Complete
-- =============================================

-- Add migration metadata
DO $$
BEGIN
  RAISE NOTICE 'WebSocket system migration completed successfully';
  RAISE NOTICE 'Tables created: websocket_connections, device_sessions, game_events, room_participants';
  RAISE NOTICE 'Helper functions: 12 created for connection tracking, analytics, and cleanup';
  RAISE NOTICE 'RLS policies: Configured for secure access control';
END $$;
