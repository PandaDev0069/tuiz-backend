import { supabaseAdmin } from '../../lib/supabase';
import { logger } from '../../utils/logger';

export class WebSocketPersistence {
  /**
   * Register a new WebSocket connection in the database
   * This updates the device session and creates a new connection record
   */
  static async registerConnection(
    deviceId: string,
    socketId: string,
    userId?: string,
    metadata: Record<string, unknown> = {},
  ): Promise<{ connectionId?: string; reconnectCount: number }> {
    try {
      // 1. Mark previous active connections as disconnected BEFORE counting reconnections
      // Ensures count reflects all prior sessions for this device
      const disconnectionTs = new Date().toISOString();
      const { error: cleanupError } = await supabaseAdmin
        .from('websocket_connections')
        .update({ status: 'disconnected', disconnected_at: disconnectionTs })
        .eq('device_id', deviceId)
        .eq('status', 'active');

      if (cleanupError) {
        logger.warn({ cleanupError, deviceId }, 'Failed to mark previous active connections');
      }

      // 2. Get reconnect count (number of prior disconnected sessions)
      const { data: reconnectCountRaw, error: countError } = await supabaseAdmin.rpc(
        'get_device_reconnect_count',
        { p_device_id: deviceId },
      );

      if (countError) {
        logger.error({ err: countError }, 'Failed to get reconnect count');
      }
      const reconnectCount = (reconnectCountRaw as number) || 0;

      // 3. Insert new connection INCLUDING reconnect_count so trigger can increment device_sessions
      const { data: connection, error: connError } = await supabaseAdmin
        .from('websocket_connections')
        .insert({
          device_id: deviceId,
          user_id: userId || null,
          socket_id: socketId,
          status: 'active',
          reconnect_count: reconnectCount,
          metadata,
        })
        .select('id')
        .single();

      if (connError) {
        logger.error({ err: connError }, 'Failed to create websocket connection record');
      }

      // 4. Reconcile device_sessions.total_reconnections if historical rows existed but trigger never fired previously
      if (reconnectCount > 0) {
        // Update total_reconnections to at least reconnectCount
        const { data: sessionRow } = await supabaseAdmin
          .from('device_sessions')
          .select('total_reconnections')
          .eq('device_id', deviceId)
          .maybeSingle();

        const currentTotal =
          (sessionRow as { total_reconnections: number } | null)?.total_reconnections ?? 0;
        if (currentTotal < reconnectCount) {
          const { error: reconcileError } = await supabaseAdmin
            .from('device_sessions')
            .update({ total_reconnections: reconnectCount })
            .eq('device_id', deviceId);
          if (reconcileError) {
            logger.warn({ reconcileError, deviceId }, 'Failed to reconcile total_reconnections');
          }
        }
      }

      return { connectionId: connection?.id, reconnectCount };
    } catch (err) {
      logger.error({ err }, 'Error in registerConnection');
      return { connectionId: undefined, reconnectCount: 0 };
    }
  }

  /**
   * Mark a connection as disconnected in the database
   */
  static async handleDisconnect(connectionId: string): Promise<void> {
    if (!connectionId) return;

    try {
      await supabaseAdmin
        .from('websocket_connections')
        .update({
          status: 'disconnected',
          disconnected_at: new Date().toISOString(),
        })
        .eq('id', connectionId);
    } catch (err) {
      logger.error({ err, connectionId }, 'Error handling disconnect persistence');
    }
  }

  /**
   * Update the last seen timestamp for a device
   * Should be called periodically, not on every heartbeat to save DB calls
   */
  static async updateHeartbeat(deviceId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('device_sessions')
        .update({
          last_seen: new Date().toISOString(),
        })
        .eq('device_id', deviceId);
    } catch (err) {
      logger.error({ err, deviceId }, 'Error updating heartbeat persistence');
    }
  }
}
