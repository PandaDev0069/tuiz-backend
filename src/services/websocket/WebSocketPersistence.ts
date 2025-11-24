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
      // 1. Get reconnect count
      // We do this first to return it to the client
      const { data: reconnectCount, error: countError } = await supabaseAdmin.rpc(
        'get_device_reconnect_count',
        { p_device_id: deviceId },
      );

      if (countError) {
        logger.error({ err: countError }, 'Failed to get reconnect count');
      }

      // 2. Mark previous active connections for this device as disconnected
      // This prevents "dangling" active connections and keeps the active count accurate
      // We don't await this to avoid blocking the new connection
      supabaseAdmin
        .from('websocket_connections')
        .update({
          status: 'disconnected',
          disconnected_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId)
        .eq('status', 'active')
        .then(({ error }) => {
          if (error) logger.warn({ error, deviceId }, 'Failed to cleanup old connections');
        });

      // 3. Insert into websocket_connections
      // NOTE: The database has a trigger 'trigger_auto_update_device_session'
      // that will automatically update the device_sessions table.
      // We don't need to call update_device_session explicitly here.
      const { data: connection, error: connError } = await supabaseAdmin
        .from('websocket_connections')
        .insert({
          device_id: deviceId,
          user_id: userId || null,
          socket_id: socketId,
          status: 'active',
          metadata,
        })
        .select('id')
        .single();

      if (connError) {
        logger.error({ err: connError }, 'Failed to create websocket connection record');
      }

      return {
        connectionId: connection?.id,
        reconnectCount: (reconnectCount as number) || 0,
      };
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
