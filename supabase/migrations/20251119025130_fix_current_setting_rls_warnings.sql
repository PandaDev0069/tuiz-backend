-- =============================================
-- Fix Remaining current_setting() RLS Performance Warnings
-- =============================================
-- This migration wraps all current_setting() calls in SELECT subqueries
-- to prevent per-row re-evaluation, improving query performance at scale.
--
-- Affected policies:
-- - games: "Users can update their own games"
-- - players: "Players can update their own data"
-- - game_flows: "Game hosts can insert/update/delete game flows" (3 policies)
-- - game_player_data: "Players can insert/update their own data" (2 policies)
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =============================================
-- Table: games - Fix current_setting() in UPDATE policy
-- =============================================

DROP POLICY IF EXISTS "Users can update their own games" ON public.games;

CREATE POLICY "Users can update their own games"
  ON public.games
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = games.id
      AND players.is_host = true
      AND players.device_id = (SELECT current_setting('request.headers', true))::json->>'x-device-id'
    )
    OR (SELECT auth.role()) = 'service_role'
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (SELECT auth.role()) = 'service_role'
  );

-- =============================================
-- Table: players - Fix current_setting() in UPDATE policy
-- =============================================

DROP POLICY IF EXISTS "Players can update their own data" ON public.players;

CREATE POLICY "Players can update their own data"
  ON public.players
  FOR UPDATE
  USING (
    device_id = (SELECT current_setting('request.headers', true))::json->>'x-device-id'
    OR (SELECT auth.role()) = 'service_role'
  );

-- =============================================
-- Table: game_flows - Fix current_setting() in all policies
-- =============================================

DROP POLICY IF EXISTS "Game hosts can insert game flows" ON public.game_flows;
DROP POLICY IF EXISTS "Game hosts can update game flows" ON public.game_flows;
DROP POLICY IF EXISTS "Game hosts can delete game flows" ON public.game_flows;

CREATE POLICY "Game hosts can insert game flows"
  ON public.game_flows
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = game_flows.game_id
      AND players.is_host = true
      AND (
        players.device_id = (SELECT current_setting('request.headers', true))::json->>'x-device-id'
        OR (SELECT auth.uid()) IS NOT NULL
      )
    )
    OR (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "Game hosts can update game flows"
  ON public.game_flows
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = game_flows.game_id
      AND players.is_host = true
      AND (
        players.device_id = (SELECT current_setting('request.headers', true))::json->>'x-device-id'
        OR (SELECT auth.uid()) IS NOT NULL
      )
    )
    OR (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "Game hosts can delete game flows"
  ON public.game_flows
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = game_flows.game_id
      AND players.is_host = true
      AND (
        players.device_id = (SELECT current_setting('request.headers', true))::json->>'x-device-id'
        OR (SELECT auth.uid()) IS NOT NULL
      )
    )
    OR (SELECT auth.role()) = 'service_role'
  );

-- =============================================
-- Table: game_player_data - Fix current_setting() in INSERT/UPDATE policies
-- =============================================

DROP POLICY IF EXISTS "Players can insert their own data" ON public.game_player_data;
DROP POLICY IF EXISTS "Players can update their own data" ON public.game_player_data;

CREATE POLICY "Players can insert their own data"
  ON public.game_player_data
  FOR INSERT
  WITH CHECK (
    player_device_id = (SELECT current_setting('request.headers', true))::json->>'x-device-id'
    OR (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "Players can update their own data"
  ON public.game_player_data
  FOR UPDATE
  USING (
    player_device_id = (SELECT current_setting('request.headers', true))::json->>'x-device-id'
    OR (SELECT auth.role()) = 'service_role'
  );

-- =============================================
-- Comments
-- =============================================

COMMENT ON POLICY "Users can update their own games" ON public.games 
  IS 'Optimized: current_setting() wrapped in SELECT to prevent per-row re-evaluation';

COMMENT ON POLICY "Players can update their own data" ON public.players 
  IS 'Optimized: current_setting() wrapped in SELECT to prevent per-row re-evaluation';

COMMENT ON POLICY "Game hosts can insert game flows" ON public.game_flows 
  IS 'Optimized: current_setting() and auth.uid() wrapped in SELECT to prevent per-row re-evaluation';

COMMENT ON POLICY "Game hosts can update game flows" ON public.game_flows 
  IS 'Optimized: current_setting() and auth.uid() wrapped in SELECT to prevent per-row re-evaluation';

COMMENT ON POLICY "Game hosts can delete game flows" ON public.game_flows 
  IS 'Optimized: current_setting() and auth.uid() wrapped in SELECT to prevent per-row re-evaluation';

COMMENT ON POLICY "Players can insert their own data" ON public.game_player_data 
  IS 'Optimized: current_setting() wrapped in SELECT to prevent per-row re-evaluation';

COMMENT ON POLICY "Players can update their own data" ON public.game_player_data 
  IS 'Optimized: current_setting() wrapped in SELECT to prevent per-row re-evaluation';

-- =============================================
-- Verification
-- =============================================
-- After applying this migration, run:
-- supabase db lint
-- 
-- Expected result: All remaining auth_rls_initplan warnings for current_setting() should be resolved.
