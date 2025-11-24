-- =============================================
-- Fix Remaining current_setting() RLS Performance Issues
-- =============================================
-- This migration fixes the remaining Auth RLS InitPlan warnings
-- by wrapping current_setting() calls in SELECT subqueries.
--
-- Tables affected: game_events, room_participants

-- =============================================
-- Drop Existing Policies
-- =============================================

DROP POLICY IF EXISTS "Manage game events" ON public.game_events;
DROP POLICY IF EXISTS "Manage room participants" ON public.room_participants;

-- =============================================
-- Recreate Policies with Optimized current_setting()
-- =============================================

-- Game Events: Fix current_setting() performance issue
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
        p.device_id = (select current_setting('request.headers', true)::json->>'x-device-id')
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

-- Room Participants: Fix current_setting() performance issue
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
    OR device_id = (select current_setting('request.headers', true)::json->>'x-device-id')
  );

-- =============================================
-- Verification Comments
-- =============================================

COMMENT ON POLICY "Manage game events" ON public.game_events IS 
  'Optimized policy: service role full access, game participants can view. All auth/setting calls wrapped in SELECT.';

COMMENT ON POLICY "Manage room participants" ON public.room_participants IS 
  'Optimized policy: service role full access, anyone can view, device owners can insert. All auth/setting calls wrapped in SELECT.';

-- =============================================
-- Migration Complete
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'Fixed remaining current_setting() RLS performance warnings';
  RAISE NOTICE 'Wrapped current_setting() in SELECT subqueries for game_events and room_participants';
  RAISE NOTICE 'All RLS policies now optimized for performance at scale';
END $$;
