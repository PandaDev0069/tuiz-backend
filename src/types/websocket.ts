// src/types/websocket.ts
import { z } from 'zod';

// ============================================================================
// ENUMS (matching database)
// ============================================================================

export type ConnectionStatus = 'active' | 'disconnected' | 'timeout';

// ============================================================================
// INTERFACES (matching database schema)
// ============================================================================

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

// ============================================================================
// REQUEST SCHEMAS & TYPES
// ============================================================================

// Get WebSocket connections (query filters)
export const GetWebSocketConnectionsSchema = z.object({
  device_id: z.string().optional(),
  user_id: z.string().uuid().optional(),
  status: z.enum(['active', 'disconnected', 'timeout']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetWebSocketConnectionsQuery = z.infer<typeof GetWebSocketConnectionsSchema>;

// Get Device session query
export const GetDeviceSessionSchema = z.object({
  device_id: z.string(),
});

export type GetDeviceSessionQuery = z.infer<typeof GetDeviceSessionSchema>;

// Get Device sessions (query filters)
export const GetDeviceSessionsSchema = z.object({
  user_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetDeviceSessionsQuery = z.infer<typeof GetDeviceSessionsSchema>;

// Update Device session metadata
export const UpdateDeviceSessionSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  browser_fingerprint: z.string().optional(),
});

export type UpdateDeviceSessionRequest = z.infer<typeof UpdateDeviceSessionSchema>;

// ============================================================================
// RESPONSE INTERFACES
// ============================================================================

export interface WebSocketConnectionsResponse {
  connections: WebSocketConnection[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeviceSessionsResponse {
  sessions: DeviceSession[];
  total: number;
  limit: number;
  offset: number;
}
