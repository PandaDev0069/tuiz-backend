// ====================================================
// File Name   : types.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-11-23
// Last Update : 2025-12-30

// Description:
// - Type definitions for WebSocket connections and events
// - Defines client connection structures and event signatures
// - Provides type safety for Socket.IO event handlers

// Notes:
// - WebSocketEvents defines client-to-server events
// - ServerEvents defines server-to-client events
// - All interfaces are exported for use across the WebSocket service
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
// No external imports - pure type definitions

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Interface: ClientConnection
 * Description:
 * - Represents an active WebSocket client connection
 * - Tracks connection metadata, heartbeat, and reconnection history
 * - Used for in-memory connection management
 */
export interface ClientConnection {
  socketId: string;
  deviceId: string;
  userId?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  reconnectCount: number;
  metadata?: Record<string, unknown>;
  connectionId?: string;
}

/**
 * Interface: ConnectionInfo
 * Description:
 * - Information required to establish a WebSocket connection
 * - Sent by client during initial connection handshake
 * - Contains device and user identification
 */
export interface ConnectionInfo {
  deviceId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Interface: GameRoom
 * Description:
 * - Represents a game room with connected clients
 * - Tracks room state and game data
 * - Used for room-based message broadcasting
 */
export interface GameRoom {
  roomId: string;
  clients: Set<string>;
  createdAt: Date;
  gameData?: Record<string, unknown>;
}

/**
 * Interface: WebSocketEvents
 * Description:
 * - Defines all client-to-server WebSocket events
 * - Maps event names to their handler function signatures
 * - Used for type-safe Socket.IO event handling
 */
export interface WebSocketEvents {
  'ws:connect': (data: ConnectionInfo) => void;
  'ws:disconnect': () => void;
  'ws:heartbeat': () => void;

  'room:join': (data: { roomId: string }) => void;
  'room:leave': (data: { roomId: string }) => void;
  'room:message': (data: { roomId: string; message: unknown }) => void;

  'game:action': (data: { roomId: string; action: string; payload: unknown }) => void;
  'game:state': (data: { roomId: string; state: unknown }) => void;

  'game:flow:start': (data: {
    roomId: string;
    questionId: string;
    questionIndex?: number;
    startsAt: number;
    endsAt: number;
  }) => void;
  'game:flow:next': (data: { roomId: string; nextQuestionId: string }) => void;
  'game:flow:end': (data: { roomId: string }) => void;

  'game:question:started': (data: {
    roomId: string;
    question: { id: string; index?: number };
    startsAt?: number;
    endsAt?: number;
  }) => void;
  'game:question:ended': (data: { roomId: string; questionId?: string }) => void;

  'game:phase:change': (data: { roomId: string; phase: string; startedAt?: number }) => void;

  'game:started': (data: {
    roomId?: string;
    gameId?: string;
    roomCode?: string;
    startedAt?: number;
  }) => void;

  'game:answer:submit': (data: {
    roomId: string;
    playerId: string;
    questionId: string;
    answer: string | number;
  }) => void;

  'game:leaderboard:request': (data: { roomId: string }) => void;
}

/**
 * Interface: ServerEvents
 * Description:
 * - Defines all server-to-client WebSocket events
 * - Maps event names to their payload data structures
 * - Used for type-safe Socket.IO event emission
 */
export interface ServerEvents {
  'ws:connected': (data: {
    socketId: string;
    deviceId: string;
    reconnectCount: number;
    serverTime: string;
  }) => void;
  'ws:error': (data: { error: string; message: string }) => void;
  'ws:pong': () => void;

  'room:joined': (data: { roomId: string; clients: number }) => void;
  'room:left': (data: { roomId: string }) => void;
  'room:message': (data: {
    roomId: string;
    from: string;
    message: unknown;
    timestamp: string;
  }) => void;
  'room:user-joined': (data: { roomId: string; socketId: string }) => void;
  'room:user-left': (data: { roomId: string; socketId: string }) => void;

  'game:action': (data: {
    roomId: string;
    from: string;
    action: string;
    payload: unknown;
    timestamp: string;
  }) => void;
  'game:state': (data: { roomId: string; state: unknown }) => void;

  'game:question:started': (data: {
    roomId: string;
    question: { id: string; index?: number };
    endsAt?: number;
    startsAt?: number;
  }) => void;
  'game:question:changed': (data: { roomId: string; question: { id: string } }) => void;
  'game:question:ended': (data: { roomId: string; questionId?: string }) => void;

  'game:phase:change': (data: { roomId: string; phase: string; startedAt?: number }) => void;

  'game:started': (data: {
    roomId?: string;
    gameId?: string;
    roomCode?: string;
    startedAt?: number;
  }) => void;

  'game:answer:accepted': (data: {
    roomId: string;
    playerId: string;
    questionId: string;
    submittedAt: string;
  }) => void;
  'game:answer:stats': (data: {
    roomId: string;
    questionId: string;
    counts: Record<string, number>;
  }) => void;
  'game:answer:stats:update': (data: {
    roomId: string;
    questionId: string;
    counts: Record<string, number>;
  }) => void;
  'game:answer:locked': (data: {
    roomId: string;
    questionId: string;
    counts?: Record<string, number>;
  }) => void;

  'game:leaderboard:update': (data: {
    roomId: string;
    rankings?: Array<{ playerId: string; score: number; rank: number }>;
    leaderboard?: {
      game_id: string;
      entries: Array<{
        player_id: string;
        player_name: string;
        device_id: string;
        score: number;
        rank: number;
        total_answers: number;
        correct_answers: number;
        accuracy: number;
        is_host: boolean;
        is_logged_in: boolean;
      }>;
      total: number;
      updated_at: string;
    };
  }) => void;

  'game:explanation:show': (data: {
    roomId: string;
    questionId: string;
    explanation: {
      title: string | null;
      text: string | null;
      image_url: string | null;
      show_time: number | null;
    };
  }) => void;
  'game:explanation:hide': (data: { roomId: string; questionId: string }) => void;

  'game:player-kicked': (data: {
    player_id: string;
    player_name: string;
    game_id: string;
    kicked_by: string;
    timestamp: string;
  }) => void;
}
