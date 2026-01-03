// ====================================================
// File Name   : websocket.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-12-11
// Last Update : 2025-12-11

// Description:
// - WebSocket connection and device session type definitions
// - Zod validation schemas for WebSocket API endpoints
// - Database-aligned interfaces for real-time connection tracking

// Notes:
// - ConnectionStatus: 'active' | 'disconnected' | 'timeout'
// - Tracks reconnection count and heartbeat timestamps
// - Supports browser fingerprinting for device identification
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const CONNECTION_STATUS_ACTIVE = 'active';
const CONNECTION_STATUS_DISCONNECTED = 'disconnected';
const CONNECTION_STATUS_TIMEOUT = 'timeout';

const PAGINATION_LIMIT_MIN = 1;
const PAGINATION_LIMIT_MAX = 100;
const PAGINATION_LIMIT_DEFAULT = 50;
const PAGINATION_OFFSET_MIN = 0;
const PAGINATION_OFFSET_DEFAULT = 0;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Type: ConnectionStatus
 * Description:
 * - Represents the current state of a WebSocket connection
 * - Used for tracking connection lifecycle and health
 */
export type ConnectionStatus =
  | typeof CONNECTION_STATUS_ACTIVE
  | typeof CONNECTION_STATUS_DISCONNECTED
  | typeof CONNECTION_STATUS_TIMEOUT;

/**
 * Interface: WebSocketConnection
 * Description:
 * - Represents a WebSocket connection record in the database
 * - Tracks connection metadata, heartbeat, and reconnection count
 * - Supports user association and device identification
 */
export interface WebSocketConnection {
  id: string;
  socket_id: string;
  device_id: string;
  user_id: string | null;
  connected_at: string;
  disconnected_at: string | null;
  last_heartbeat: string;
  reconnect_count: number;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  status: ConnectionStatus;
}

/**
 * Interface: DeviceSession
 * Description:
 * - Represents a device session record tracking device usage over time
 * - Aggregates connection statistics and browser fingerprinting data
 * - Used for device identification and session management
 */
export interface DeviceSession {
  id: string;
  device_id: string;
  user_id: string | null;
  first_seen: string;
  last_seen: string;
  total_connections: number;
  total_reconnections: number;
  browser_fingerprint: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Schema: GetWebSocketConnectionsSchema
 * Description:
 * - Validation schema for querying WebSocket connections
 * - Supports filtering by device_id, user_id, and connection status
 * - Includes pagination with limit (1-100, default 50) and offset (min 0, default 0)
 */
export const GetWebSocketConnectionsSchema = z.object({
  device_id: z.string().optional(),
  user_id: z.string().uuid().optional(),
  status: z
    .enum([CONNECTION_STATUS_ACTIVE, CONNECTION_STATUS_DISCONNECTED, CONNECTION_STATUS_TIMEOUT])
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_LIMIT_MIN)
    .max(PAGINATION_LIMIT_MAX)
    .default(PAGINATION_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(PAGINATION_OFFSET_MIN).default(PAGINATION_OFFSET_DEFAULT),
});

/**
 * Type: GetWebSocketConnectionsQuery
 * Description:
 * - Inferred type from GetWebSocketConnectionsSchema
 * - Represents validated query parameters for fetching WebSocket connections
 */
export type GetWebSocketConnectionsQuery = z.infer<typeof GetWebSocketConnectionsSchema>;

/**
 * Schema: GetDeviceSessionSchema
 * Description:
 * - Validation schema for querying a single device session by device_id
 * - Requires device_id as a required string parameter
 */
export const GetDeviceSessionSchema = z.object({
  device_id: z.string(),
});

/**
 * Type: GetDeviceSessionQuery
 * Description:
 * - Inferred type from GetDeviceSessionSchema
 * - Represents validated query parameters for fetching a device session
 */
export type GetDeviceSessionQuery = z.infer<typeof GetDeviceSessionSchema>;

/**
 * Schema: GetDeviceSessionsSchema
 * Description:
 * - Validation schema for querying multiple device sessions
 * - Supports filtering by user_id and pagination
 * - Includes pagination with limit (1-100, default 50) and offset (min 0, default 0)
 */
export const GetDeviceSessionsSchema = z.object({
  user_id: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_LIMIT_MIN)
    .max(PAGINATION_LIMIT_MAX)
    .default(PAGINATION_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(PAGINATION_OFFSET_MIN).default(PAGINATION_OFFSET_DEFAULT),
});

/**
 * Type: GetDeviceSessionsQuery
 * Description:
 * - Inferred type from GetDeviceSessionsSchema
 * - Represents validated query parameters for fetching device sessions
 */
export type GetDeviceSessionsQuery = z.infer<typeof GetDeviceSessionsSchema>;

/**
 * Schema: UpdateDeviceSessionSchema
 * Description:
 * - Validation schema for updating device session metadata
 * - Supports optional metadata and browser_fingerprint updates
 */
export const UpdateDeviceSessionSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  browser_fingerprint: z.string().optional(),
});

/**
 * Type: UpdateDeviceSessionRequest
 * Description:
 * - Inferred type from UpdateDeviceSessionSchema
 * - Represents validated request body for updating a device session
 */
export type UpdateDeviceSessionRequest = z.infer<typeof UpdateDeviceSessionSchema>;

/**
 * Interface: WebSocketConnectionsResponse
 * Description:
 * - Response structure for WebSocket connections query endpoint
 * - Includes pagination metadata (total, limit, offset)
 */
export interface WebSocketConnectionsResponse {
  connections: WebSocketConnection[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Interface: DeviceSessionsResponse
 * Description:
 * - Response structure for device sessions query endpoint
 * - Includes pagination metadata (total, limit, offset)
 */
export interface DeviceSessionsResponse {
  sessions: DeviceSession[];
  total: number;
  limit: number;
  offset: number;
}
