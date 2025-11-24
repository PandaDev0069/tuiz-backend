// src/services/websocket/types.ts

export interface ClientConnection {
  socketId: string;
  deviceId: string;
  userId?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  reconnectCount: number;
  metadata?: Record<string, unknown>;
  connectionId?: string; // Database ID for the connection
}

export interface ConnectionInfo {
  deviceId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface GameRoom {
  roomId: string;
  clients: Set<string>; // socket IDs
  createdAt: Date;
  gameData?: Record<string, unknown>;
}

export interface WebSocketEvents {
  // Connection events
  'ws:connect': (data: ConnectionInfo) => void;
  'ws:disconnect': () => void;
  'ws:heartbeat': () => void;

  // Room events
  'room:join': (data: { roomId: string }) => void;
  'room:leave': (data: { roomId: string }) => void;
  'room:message': (data: { roomId: string; message: unknown }) => void;

  // Game events (extensible for future game development)
  'game:action': (data: { roomId: string; action: string; payload: unknown }) => void;
  'game:state': (data: { roomId: string; state: unknown }) => void;
}

export interface ServerEvents {
  // Connection responses
  'ws:connected': (data: {
    socketId: string;
    deviceId: string;
    reconnectCount: number;
    serverTime: string;
  }) => void;
  'ws:error': (data: { error: string; message: string }) => void;
  'ws:pong': () => void;

  // Room responses
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

  // Game responses
  'game:action': (data: {
    roomId: string;
    from: string;
    action: string;
    payload: unknown;
    timestamp: string;
  }) => void;
  'game:state': (data: { roomId: string; state: unknown }) => void;
}
