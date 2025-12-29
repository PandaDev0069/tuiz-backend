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

  // Game flow
  'game:flow:start': (data: {
    roomId: string;
    questionId: string;
    questionIndex?: number;
    startsAt: number;
    endsAt: number;
  }) => void;
  'game:flow:next': (data: { roomId: string; nextQuestionId: string }) => void;
  'game:flow:end': (data: { roomId: string }) => void;

  // Aligned question events (direct from host)
  'game:question:started': (data: {
    roomId: string;
    question: { id: string; index?: number };
    startsAt?: number;
    endsAt?: number;
  }) => void;
  'game:question:ended': (data: { roomId: string; questionId?: string }) => void;

  // Phase change broadcast
  'game:phase:change': (data: { roomId: string; phase: string; startedAt?: number }) => void;

  // Game lifecycle
  'game:started': (data: {
    roomId?: string;
    gameId?: string;
    roomCode?: string;
    startedAt?: number;
  }) => void;

  // Answers
  'game:answer:submit': (data: {
    roomId: string;
    playerId: string;
    questionId: string;
    answer: string | number;
  }) => void;

  // Leaderboard
  'game:leaderboard:request': (data: { roomId: string }) => void;
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

  // Game flow broadcasts
  'game:question:started': (data: {
    roomId: string;
    question: { id: string; index?: number };
    endsAt?: number;
    startsAt?: number;
  }) => void;
  'game:question:changed': (data: { roomId: string; question: { id: string } }) => void;
  'game:question:ended': (data: { roomId: string; questionId?: string }) => void;

  // Phase change broadcast
  'game:phase:change': (data: { roomId: string; phase: string; startedAt?: number }) => void;

  // Game lifecycle
  'game:started': (data: {
    roomId?: string;
    gameId?: string;
    roomCode?: string;
    startedAt?: number;
  }) => void;

  // Answer responses/broadcasts
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

  // Leaderboard
  'game:leaderboard:update': (data: {
    roomId: string;
    rankings: Array<{ playerId: string; score: number; rank: number }>;
  }) => void;

  // Player management
  'game:player-kicked': (data: {
    player_id: string;
    player_name: string;
    game_id: string;
    kicked_by: string;
    timestamp: string;
  }) => void;
}
