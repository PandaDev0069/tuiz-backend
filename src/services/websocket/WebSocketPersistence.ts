// ====================================================
// File Name   : WebSocketPersistence.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-11-24
// Last Update : 2025-12-01

// Description:
// - Service class for persisting WebSocket connection state to database
// - Manages connection registration, disconnection, and heartbeat updates
// - Tracks device sessions and reconnection counts

// Notes:
// - Handles cleanup of previous active connections before registering new ones
// - Reconciles reconnection counts to ensure data consistency
// - Heartbeat updates should be called periodically, not on every heartbeat
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { supabaseAdmin } from '../../lib/supabase';
import { logger } from '../../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_WEBSOCKET_CONNECTIONS = 'websocket_connections';
const TABLE_DEVICE_SESSIONS = 'device_sessions';

const COLUMN_ID = 'id';
const COLUMN_DEVICE_ID = 'device_id';
const COLUMN_USER_ID = 'user_id';
const COLUMN_SOCKET_ID = 'socket_id';
const COLUMN_STATUS = 'status';
const COLUMN_DISCONNECTED_AT = 'disconnected_at';
const COLUMN_RECONNECT_COUNT = 'reconnect_count';
const COLUMN_METADATA = 'metadata';
const COLUMN_TOTAL_RECONNECTIONS = 'total_reconnections';
const COLUMN_LAST_SEEN = 'last_seen';

const STATUS_ACTIVE = 'active';
const STATUS_DISCONNECTED = 'disconnected';

const RPC_GET_DEVICE_RECONNECT_COUNT = 'get_device_reconnect_count';
const RPC_PARAM_DEVICE_ID = 'p_device_id';

const DEFAULT_RECONNECT_COUNT = 0;
const DEFAULT_EMPTY_METADATA = {};

const LOG_MESSAGES = {
  FAILED_MARK_PREVIOUS_CONNECTIONS: 'Failed to mark previous active connections',
  FAILED_GET_RECONNECT_COUNT: 'Failed to get reconnect count',
  FAILED_CREATE_CONNECTION: 'Failed to create websocket connection record',
  FAILED_RECONCILE_RECONNECTIONS: 'Failed to reconcile total_reconnections',
  ERROR_REGISTER_CONNECTION: 'Error in registerConnection',
  ERROR_HANDLE_DISCONNECT: 'Error handling disconnect persistence',
  ERROR_UPDATE_HEARTBEAT: 'Error updating heartbeat persistence',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Interface: RegisterConnectionResult
 * Description:
 * - Result structure for connection registration operations
 * - Contains connection ID (if successful) and reconnect count
 */
export interface RegisterConnectionResult {
  connectionId?: string;
  reconnectCount: number;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Class: WebSocketPersistence
 * Description:
 * - Static service class for WebSocket connection persistence
 * - Manages database operations for connection lifecycle
 */
export class WebSocketPersistence {
  /**
   * Method: registerConnection
   * Description:
   * - Registers a new WebSocket connection in the database
   * - Marks previous active connections as disconnected
   * - Calculates and tracks reconnection count
   * - Creates new connection record with metadata
   * - Reconciles device session reconnection totals
   *
   * Parameters:
   * - deviceId (string): Device identifier
   * - socketId (string): WebSocket socket identifier
   * - userId (string | undefined): Optional user identifier
   * - metadata (Record<string, unknown>): Optional connection metadata
   *
   * Returns:
   * - Promise<RegisterConnectionResult>: Result with connection ID and reconnect count
   *
   * Throws:
   * - Logs errors but returns safe default values instead of throwing
   */
  static async registerConnection(
    deviceId: string,
    socketId: string,
    userId?: string,
    metadata: Record<string, unknown> = DEFAULT_EMPTY_METADATA,
  ): Promise<RegisterConnectionResult> {
    try {
      const disconnectionTs = new Date().toISOString();
      const { error: cleanupError } = await supabaseAdmin
        .from(TABLE_WEBSOCKET_CONNECTIONS)
        .update({ [COLUMN_STATUS]: STATUS_DISCONNECTED, [COLUMN_DISCONNECTED_AT]: disconnectionTs })
        .eq(COLUMN_DEVICE_ID, deviceId)
        .eq(COLUMN_STATUS, STATUS_ACTIVE);

      if (cleanupError) {
        logger.warn({ cleanupError, deviceId }, LOG_MESSAGES.FAILED_MARK_PREVIOUS_CONNECTIONS);
      }

      const { data: reconnectCountRaw, error: countError } = await supabaseAdmin.rpc(
        RPC_GET_DEVICE_RECONNECT_COUNT,
        { [RPC_PARAM_DEVICE_ID]: deviceId },
      );

      if (countError) {
        logger.error({ err: countError }, LOG_MESSAGES.FAILED_GET_RECONNECT_COUNT);
      }
      const reconnectCount = (reconnectCountRaw as number) || DEFAULT_RECONNECT_COUNT;

      const { data: connection, error: connError } = await supabaseAdmin
        .from(TABLE_WEBSOCKET_CONNECTIONS)
        .insert({
          [COLUMN_DEVICE_ID]: deviceId,
          [COLUMN_USER_ID]: userId || null,
          [COLUMN_SOCKET_ID]: socketId,
          [COLUMN_STATUS]: STATUS_ACTIVE,
          [COLUMN_RECONNECT_COUNT]: reconnectCount,
          [COLUMN_METADATA]: metadata,
        })
        .select(COLUMN_ID)
        .single();

      if (connError) {
        logger.error({ err: connError }, LOG_MESSAGES.FAILED_CREATE_CONNECTION);
      }

      if (reconnectCount > DEFAULT_RECONNECT_COUNT) {
        const { data: sessionRow } = await supabaseAdmin
          .from(TABLE_DEVICE_SESSIONS)
          .select(COLUMN_TOTAL_RECONNECTIONS)
          .eq(COLUMN_DEVICE_ID, deviceId)
          .maybeSingle();

        const currentTotal =
          (sessionRow as { total_reconnections: number } | null)?.total_reconnections ??
          DEFAULT_RECONNECT_COUNT;
        if (currentTotal < reconnectCount) {
          const { error: reconcileError } = await supabaseAdmin
            .from(TABLE_DEVICE_SESSIONS)
            .update({ [COLUMN_TOTAL_RECONNECTIONS]: reconnectCount })
            .eq(COLUMN_DEVICE_ID, deviceId);
          if (reconcileError) {
            logger.warn({ reconcileError, deviceId }, LOG_MESSAGES.FAILED_RECONCILE_RECONNECTIONS);
          }
        }
      }

      return { connectionId: connection?.id, reconnectCount };
    } catch (err) {
      logger.error({ err }, LOG_MESSAGES.ERROR_REGISTER_CONNECTION);
      return { connectionId: undefined, reconnectCount: DEFAULT_RECONNECT_COUNT };
    }
  }

  /**
   * Method: handleDisconnect
   * Description:
   * - Marks a WebSocket connection as disconnected in the database
   * - Updates connection status and disconnected timestamp
   *
   * Parameters:
   * - connectionId (string): Connection identifier to mark as disconnected
   *
   * Returns:
   * - Promise<void>: No return value
   *
   * Throws:
   * - Logs errors but does not throw
   */
  static async handleDisconnect(connectionId: string): Promise<void> {
    if (!connectionId) return;

    try {
      await supabaseAdmin
        .from(TABLE_WEBSOCKET_CONNECTIONS)
        .update({
          [COLUMN_STATUS]: STATUS_DISCONNECTED,
          [COLUMN_DISCONNECTED_AT]: new Date().toISOString(),
        })
        .eq(COLUMN_ID, connectionId);
    } catch (err) {
      logger.error({ err, connectionId }, LOG_MESSAGES.ERROR_HANDLE_DISCONNECT);
    }
  }

  /**
   * Method: updateHeartbeat
   * Description:
   * - Updates the last seen timestamp for a device session
   * - Should be called periodically, not on every heartbeat to save database calls
   *
   * Parameters:
   * - deviceId (string): Device identifier to update heartbeat for
   *
   * Returns:
   * - Promise<void>: No return value
   *
   * Throws:
   * - Logs errors but does not throw
   */
  static async updateHeartbeat(deviceId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from(TABLE_DEVICE_SESSIONS)
        .update({
          [COLUMN_LAST_SEEN]: new Date().toISOString(),
        })
        .eq(COLUMN_DEVICE_ID, deviceId);
    } catch (err) {
      logger.error({ err, deviceId }, LOG_MESSAGES.ERROR_UPDATE_HEARTBEAT);
    }
  }
}
