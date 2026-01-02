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
// 2. Type Definitions
//----------------------------------------------------
export type ConnectionStatus = 'active' | 'disconnected' | 'timeout';

//----------------------------------------------------
// 3. Core Interfaces
//----------------------------------------------------
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

//----------------------------------------------------
// 4. Request Validation Schemas
//----------------------------------------------------
export const GetWebSocketConnectionsSchema = z.object({
  device_id: z.string().optional(),
  user_id: z.string().uuid().optional(),
  status: z.enum(['active', 'disconnected', 'timeout']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetWebSocketConnectionsQuery = z.infer<typeof GetWebSocketConnectionsSchema>;

export const GetDeviceSessionSchema = z.object({
  device_id: z.string(),
});

export type GetDeviceSessionQuery = z.infer<typeof GetDeviceSessionSchema>;

export const GetDeviceSessionsSchema = z.object({
  user_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetDeviceSessionsQuery = z.infer<typeof GetDeviceSessionsSchema>;

export const UpdateDeviceSessionSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  browser_fingerprint: z.string().optional(),
});

export type UpdateDeviceSessionRequest = z.infer<typeof UpdateDeviceSessionSchema>;

//----------------------------------------------------
// 5. Response Interfaces
//----------------------------------------------------
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
