-- =============================================
-- Fix RLS Performance Warnings
-- =============================================
-- This migration addresses Supabase linter warnings:
-- 1. Auth RLS Initialization Plan (auth_rls_initplan) - Prevents re-evaluation of auth functions for each row
-- 2. Multiple Permissive Policies - Consolidates duplicate SELECT policies on game_flows
--
-- Performance Impact:
-- - Reduces query overhead by caching auth function results
-- - Eliminates redundant policy evaluations
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =============================================
-- Table: games
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own or public games" ON public.games;
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;
DROP POLICY IF EXISTS "Users can update their own games" ON public.games;
DROP POLICY IF EXISTS "Users can delete their own games" ON public.games;

-- Recreate with optimized auth function calls (wrapped in SELECT)
CREATE POLICY "Users can view their own or public games"
  ON public.games
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid()) 
    OR user_id IS NULL 
    OR (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "Authenticated users can create games"
  ON public.games
  FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid())) 
    OR (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "Users can update their own games"
  ON public.games
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = games.id
      AND players.is_host = true
      AND players.device_id = current_setting('request.headers')::json->>'x-device-id'
    )
    OR (SELECT auth.role()) = 'service_role'
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "Users can delete their own games"
  ON public.games
  FOR DELETE
  USING (
    user_id = (SELECT auth.uid()) 
    OR (SELECT auth.role()) = 'service_role'
  );

-- =============================================
-- Table: players
-- =============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Players can update their own data" ON public.players;

-- Recreate with optimized auth function calls
CREATE POLICY "Players can update their own data"
  ON public.players
  FOR UPDATE
  USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
    OR (SELECT auth.role()) = 'service_role'
  );

-- =============================================
-- Table: game_flows
-- =============================================

-- Drop existing policies (including duplicates)
DROP POLICY IF EXISTS "Game flows are viewable by everyone" ON public.game_flows;
DROP POLICY IF EXISTS "Game hosts can manage game flows" ON public.game_flows;

-- Create single consolidated SELECT policy (fixes multiple permissive policies warning)
-- This merges the "everyone can view" and "hosts can manage" SELECT permissions
CREATE POLICY "Game flows are viewable"
  ON public.game_flows
  FOR SELECT
  USING (true);

-- Separate policies for INSERT, UPDATE, DELETE (host-only operations)
CREATE POLICY "Game hosts can insert game flows"
  ON public.game_flows
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.game_id = game_flows.game_id
      AND players.is_host = true
      AND (
        players.device_id = current_setting('request.headers')::json->>'x-device-id'
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
        players.device_id = current_setting('request.headers')::json->>'x-device-id'
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
        players.device_id = current_setting('request.headers')::json->>'x-device-id'
        OR (SELECT auth.uid()) IS NOT NULL
      )
    )
    OR (SELECT auth.role()) = 'service_role'
  );

-- =============================================
-- Table: game_player_data
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Players can insert their own data" ON public.game_player_data;
DROP POLICY IF EXISTS "Players can update their own data" ON public.game_player_data;

-- Recreate with optimized auth function calls
CREATE POLICY "Players can insert their own data"
  ON public.game_player_data
  FOR INSERT
  WITH CHECK (
    player_device_id = current_setting('request.headers')::json->>'x-device-id'
    OR (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "Players can update their own data"
  ON public.game_player_data
  FOR UPDATE
  USING (
    player_device_id = current_setting('request.headers')::json->>'x-device-id'
    OR (SELECT auth.role()) = 'service_role'
  );

-- =============================================
-- Comments
-- =============================================

COMMENT ON POLICY "Users can view their own or public games" ON public.games 
  IS 'Optimized: auth.uid() wrapped in SELECT to prevent per-row re-evaluation';

COMMENT ON POLICY "Game flows are viewable" ON public.game_flows 
  IS 'Consolidated policy: Replaces duplicate SELECT policies to improve performance';

-- =============================================
-- Verification
-- =============================================
-- After applying this migration, run:
-- supabase db lint
-- 
-- Expected result: All auth_rls_initplan and multiple_permissive_policies warnings should be resolved.
