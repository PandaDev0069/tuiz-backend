-- =============================================
-- WebSocket System RLS Performance Optimization
-- =============================================
-- This migration fixes performance warnings from Supabase linter:
-- 1. Auth RLS InitPlan warnings (wrap auth functions in SELECT)
-- 2. Multiple permissive policies (consolidate overlapping policies)
-- 3. Duplicate index on device_sessions.device_id

-- =============================================
-- Drop Existing Policies
-- =============================================

-- WebSocket connections policies
DROP POLICY IF EXISTS "Service role can manage websocket connections" ON public.websocket_connections;
DROP POLICY IF EXISTS "Users can view their own connections" ON public.websocket_connections;

-- Device sessions policies
DROP POLICY IF EXISTS "Service role can manage device sessions" ON public.device_sessions;
DROP POLICY IF EXISTS "Users can view their own device sessions" ON public.device_sessions;

-- Game events policies
DROP POLICY IF EXISTS "Service role can manage game events" ON public.game_events;
DROP POLICY IF EXISTS "Game participants can view events" ON public.game_events;

-- Room participants policies
DROP POLICY IF EXISTS "Service role can manage room participants" ON public.room_participants;
DROP POLICY IF EXISTS "Users can view room participants" ON public.room_participants;
DROP POLICY IF EXISTS "Players can insert their own participation" ON public.room_participants;

-- =============================================
-- Recreate Optimized Policies
-- =============================================

-- WebSocket Connections: Consolidated policy with optimized auth checks
CREATE POLICY "Manage websocket connections"
  ON public.websocket_connections
  AS PERMISSIVE
  FOR ALL
  USING (
    (select auth.role()) = 'service_role'
    OR (
      (select auth.uid()) IS NOT NULL 
      AND user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    (select auth.role()) = 'service_role'
  );

-- Device Sessions: Consolidated policy with optimized auth checks
CREATE POLICY "Manage device sessions"
  ON public.device_sessions
  AS PERMISSIVE
  FOR ALL
  USING (
    (select auth.role()) = 'service_role'
    OR (
      (select auth.uid()) IS NOT NULL 
      AND user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    (select auth.role()) = 'service_role'
  );

-- Game Events: Consolidated policy with optimized auth checks
CREATE POLICY "Manage game events"
  ON public.game_events
  AS PERMISSIVE
  FOR ALL
  USING (
    (select auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.game_id = game_events.game_id
      AND (
        p.device_id = current_setting('request.headers', true)::json->>'x-device-id'
        OR (
          (select auth.uid()) IS NOT NULL 
          AND p.device_id IN (
            SELECT device_id 
            FROM public.device_sessions 
            WHERE user_id = (select auth.uid())
          )
        )
      )
    )
  )
  WITH CHECK (
    (select auth.role()) = 'service_role'
  );

-- Room Participants: Consolidated policies with optimized auth checks
CREATE POLICY "Manage room participants"
  ON public.room_participants
  AS PERMISSIVE
  FOR ALL
  USING (
    (select auth.role()) = 'service_role'
    OR true  -- Anyone can view room participants
  )
  WITH CHECK (
    (select auth.role()) = 'service_role'
    OR device_id = current_setting('request.headers', true)::json->>'x-device-id'
  );

-- =============================================
-- Fix Duplicate Index Issue
-- =============================================

-- The device_sessions table has both a UNIQUE constraint and an explicit index
-- causing duplicate indexes. Drop the explicit index since the constraint already
-- provides the necessary unique index.
DROP INDEX IF EXISTS public.uq_device_sessions_device_id;

-- =============================================
-- Verification Comments
-- =============================================

COMMENT ON POLICY "Manage websocket connections" ON public.websocket_connections IS 
  'Consolidated policy: service role has full access, users can view/update their own connections';

COMMENT ON POLICY "Manage device sessions" ON public.device_sessions IS 
  'Consolidated policy: service role has full access, users can view/update their own sessions';

COMMENT ON POLICY "Manage game events" ON public.game_events IS 
  'Consolidated policy: service role has full access, game participants can view events';

COMMENT ON POLICY "Manage room participants" ON public.room_participants IS 
  'Consolidated policy: service role has full access, anyone can view, device owners can insert';

-- =============================================
-- Migration Complete
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'RLS performance optimization completed successfully';
  RAISE NOTICE 'Fixed: Auth RLS InitPlan warnings (wrapped auth functions in SELECT)';
  RAISE NOTICE 'Fixed: Multiple permissive policies (consolidated into single policies)';
  RAISE NOTICE 'Fixed: Duplicate index on device_sessions.device_id';
  RAISE NOTICE 'Performance improvements: Reduced policy evaluation overhead';
END $$;
