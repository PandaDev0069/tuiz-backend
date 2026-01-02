-- =============================================
-- Fix RLS Performance with Security Definer Functions
-- =============================================
-- This migration completely eliminates current_setting() calls from RLS policies
-- by using security definer functions that are evaluated once per query.
--
-- Tables affected: game_events, room_participants

-- =============================================
-- Create Helper Functions
-- =============================================

-- Function to get device_id from request headers (evaluated once per query)
CREATE OR REPLACE FUNCTION public.get_request_device_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    current_setting('request.headers', true)::json->>'x-device-id',
    ''
  );
$$;

-- =============================================
-- Drop Existing Policies
-- =============================================

DROP POLICY IF EXISTS "Manage game events" ON public.game_events;
DROP POLICY IF EXISTS "Manage room participants" ON public.room_participants;

-- =============================================
-- Recreate Policies Using Helper Functions
-- =============================================

-- Game Events: Use helper function to avoid per-row evaluation
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
        p.device_id = (select public.get_request_device_id())
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

-- Room Participants: Use helper function to avoid per-row evaluation
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
    OR device_id = (select public.get_request_device_id())
  );

-- =============================================
-- Function Comments
-- =============================================

COMMENT ON FUNCTION public.get_request_device_id() IS 
  'Returns device_id from request headers. STABLE + SECURITY DEFINER ensures single evaluation per query.';

-- =============================================
-- Policy Comments
-- =============================================

COMMENT ON POLICY "Manage game events" ON public.game_events IS 
  'Fully optimized: Uses security definer function to eliminate per-row current_setting() evaluation';

COMMENT ON POLICY "Manage room participants" ON public.room_participants IS 
  'Fully optimized: Uses security definer function to eliminate per-row current_setting() evaluation';

-- =============================================
-- Migration Complete
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'RLS policies optimized with security definer helper functions';
  RAISE NOTICE 'Eliminated current_setting() per-row evaluation for game_events and room_participants';
  RAISE NOTICE 'Helper function get_request_device_id() created for reusable device_id extraction';
END $$;
