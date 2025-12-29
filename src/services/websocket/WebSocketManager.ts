// src/services/websocket/WebSocketManager.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../../utils/logger';

import { ConnectionStore } from './ConnectionStore';
import { ClientConnection, ConnectionInfo, WebSocketEvents, ServerEvents } from './types';
import { WebSocketPersistence } from './WebSocketPersistence';

// Lead time added to countdown start to absorb network jitter between clients.
const COUNTDOWN_LEAD_MS = 700;

type TypedSocket = Socket<WebSocketEvents, ServerEvents>;

export class WebSocketManager {
  private io: SocketIOServer<WebSocketEvents, ServerEvents>;
  private store: ConnectionStore;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60 seconds

  constructor(io: SocketIOServer<WebSocketEvents, ServerEvents>) {
    this.io = io;
    this.store = new ConnectionStore();
    this.initialize();
  }

  private initialize(): void {
    this.io.on('connection', (socket: TypedSocket) => {
      this.handleConnection(socket);
    });

    // Start heartbeat checker
    this.startHeartbeatChecker();

    logger.info('WebSocket Manager initialized');
  }

  private handleConnection(socket: TypedSocket): void {
    logger.info(`New socket connection: ${socket.id}`);

    // Wait for client to send connection info with device ID
    socket.on('ws:connect', (data: ConnectionInfo) => {
      this.registerClient(socket, data);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socket, reason);
    });

    // Handle heartbeat
    socket.on('ws:heartbeat', () => {
      this.handleHeartbeat(socket);
    });

    // Room events
    socket.on('room:join', (data) => {
      this.handleRoomJoin(socket, data.roomId);
    });

    socket.on('room:leave', (data) => {
      this.handleRoomLeave(socket, data.roomId);
    });

    socket.on('room:message', (data) => {
      this.handleRoomMessage(socket, data.roomId, data.message);
    });

    // Game lifecycle events
    socket.on('game:started', (data) => {
      this.handleGameStarted(socket, data.roomId ?? data.gameId ?? '', data.roomCode);
    });

    // Game events
    socket.on('game:action', (data) => {
      this.handleGameAction(socket, data.roomId, data.action, data.payload);
    });

    socket.on('game:state', (data) => {
      this.handleGameState(socket, data.roomId, data.state);
    });

    // Game flow events
    socket.on('game:flow:start', (data) => {
      this.handleGameFlowStart(
        socket,
        data.roomId,
        data.questionId,
        data.startsAt ?? 0,
        data.endsAt ?? 0,
        data.questionIndex ?? 0,
      );
    });

    socket.on('game:flow:next', (data) => {
      this.handleGameFlowNext(socket, data.roomId, data.nextQuestionId);
    });

    socket.on('game:flow:end', (data) => {
      this.handleGameFlowEnd(socket, data.roomId);
    });

    // Direct question events (aligned with frontend)
    socket.on('game:question:started', (data) => {
      this.handleQuestionStarted(socket, data.roomId, data.question, data.startsAt, data.endsAt);
    });

    socket.on('game:question:ended', (data) => {
      this.handleQuestionEnded(socket, data.roomId, data.questionId);
    });

    // Phase changes (leaderboard/explanation/countdown/podium)
    socket.on('game:phase:change', (data) => {
      this.handlePhaseChange(socket, data.roomId, data.phase);
    });

    // Answer events
    socket.on('game:answer:submit', (data) => {
      this.handleAnswerSubmit(socket, data.roomId, data.playerId, data.questionId, data.answer);
    });

    // Leaderboard
    socket.on('game:leaderboard:request', (data) => {
      this.handleLeaderboardRequest(socket, data.roomId);
    });
  }

  private async registerClient(socket: TypedSocket, data: ConnectionInfo): Promise<void> {
    const { deviceId, userId, metadata } = data;

    if (!deviceId) {
      socket.emit('ws:error', {
        error: 'invalid_device_id',
        message: 'Device ID is required',
      });
      return;
    }

    // Persist connection to DB and get history
    const { connectionId, reconnectCount } = await WebSocketPersistence.registerConnection(
      deviceId,
      socket.id,
      userId,
      metadata,
    );

    const connection: ClientConnection = {
      socketId: socket.id,
      deviceId,
      userId,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      reconnectCount,
      metadata,
      connectionId,
    };

    this.store.addConnection(connection);

    socket.emit('ws:connected', {
      socketId: socket.id,
      deviceId,
      reconnectCount,
      serverTime: new Date().toISOString(),
    });

    logger.info(
      `Client registered: socket=${socket.id}, device=${deviceId}, reconnects=${reconnectCount}, dbId=${connectionId}`,
    );
  }

  private handleDisconnect(socket: TypedSocket, reason: string): void {
    logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);

    const connection = this.store.getConnection(socket.id);
    if (connection && connection.connectionId) {
      // Update DB asynchronously
      WebSocketPersistence.handleDisconnect(connection.connectionId).catch((err) => {
        logger.error({ err }, 'Failed to update disconnect status');
      });
    }

    this.store.removeConnection(socket.id);
  }

  private handleHeartbeat(socket: TypedSocket): void {
    this.store.updateHeartbeat(socket.id);
    socket.emit('ws:pong');
  }

  private handleRoomJoin(socket: TypedSocket, roomId: string): void {
    const connection = this.store.getConnection(socket.id);
    if (!connection) {
      socket.emit('ws:error', {
        error: 'not_registered',
        message: 'Please connect with device ID first',
      });
      return;
    }

    // Check if already in room before joining
    const room = this.store.getRoom(roomId);
    const wasAlreadyInRoom = room?.clients.has(socket.id) || false;

    // Add to Socket.IO room (idempotent, but we check our store first)
    if (!wasAlreadyInRoom) {
      socket.join(roomId);
    }

    // Track in store (returns false if already in room)
    const added = this.store.addToRoom(socket.id, roomId);

    // If already in room, just emit confirmation without notifying others
    if (!added || wasAlreadyInRoom) {
      const currentRoom = this.store.getRoom(roomId);
      const clientCount = currentRoom ? currentRoom.clients.size : 0;
      socket.emit('room:joined', { roomId, clients: clientCount });
      logger.debug(`Socket ${socket.id} already in room ${roomId} (${clientCount} clients)`);
      return;
    }

    const updatedRoom = this.store.getRoom(roomId);
    const clientCount = updatedRoom ? updatedRoom.clients.size : 0;

    socket.emit('room:joined', { roomId, clients: clientCount });

    // Notify others in the room (only if this was a new join)
    socket.to(roomId).emit('room:user-joined', {
      roomId,
      socketId: socket.id,
    });

    // Send current phase to new joiner if game has started (for late joiners)
    if (room) {
      const currentPhase = room.gameData?.currentPhase as string | undefined;
      if (currentPhase) {
        const phaseData: { roomId: string; phase: string; startedAt?: number } = {
          roomId,
          phase: currentPhase,
        };

        // If countdown is active, send the start timestamp so client can sync
        if (currentPhase === 'countdown' && room.gameData?.countdownStartedAt) {
          phaseData.startedAt = room.gameData.countdownStartedAt as number;
        }

        socket.emit('game:phase:change', phaseData);
        logger.debug(`Sent current phase ${currentPhase} to new joiner ${socket.id}`);
      }
    }

    logger.info(`Socket ${socket.id} joined room ${roomId} (${clientCount} clients)`);
  }

  private handleRoomLeave(socket: TypedSocket, roomId: string): void {
    // Leave Socket.IO room
    socket.leave(roomId);

    // Remove from store
    this.store.removeFromRoom(socket.id, roomId);

    socket.emit('room:left', { roomId });

    // Notify others in the room
    socket.to(roomId).emit('room:user-left', {
      roomId,
      socketId: socket.id,
    });

    logger.info(`Socket ${socket.id} left room ${roomId}`);
  }

  private handleRoomMessage(socket: TypedSocket, roomId: string, message: unknown): void {
    const connection = this.store.getConnection(socket.id);
    if (!connection) return;

    // Broadcast to all clients in the room (including sender)
    this.io.to(roomId).emit('room:message', {
      roomId,
      from: socket.id,
      message,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Message in room ${roomId} from ${socket.id}`);
  }

  private handleGameAction(
    socket: TypedSocket,
    roomId: string,
    action: string,
    payload: unknown,
  ): void {
    const connection = this.store.getConnection(socket.id);
    if (!connection) return;

    // Broadcast game action to all clients in the room
    this.io.to(roomId).emit('game:action', {
      roomId,
      from: socket.id,
      action,
      payload,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Game action in room ${roomId} from ${socket.id}: ${action}`);
  }

  private handleGameState(socket: TypedSocket, roomId: string, state: unknown): void {
    const connection = this.store.getConnection(socket.id);
    if (!connection) return;

    // Update room game data
    const room = this.store.getRoom(roomId);
    if (room) {
      room.gameData = { ...(room.gameData || {}), state };
    }

    // Broadcast state to all clients in the room
    this.io.to(roomId).emit('game:state', {
      roomId,
      state,
    });

    logger.info(`Game state updated in room ${roomId}`);
  }

  private handleGameFlowStart(
    socket: TypedSocket,
    roomId: string,
    questionId: string,
    startsAt: number,
    endsAt: number,
    questionIndex?: number,
  ): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    room.gameData = {
      ...(room.gameData || {}),
      currentQuestionId: questionId,
      questionWindow: { startsAt, endsAt },
      answerCounts: new Map<string, number>(),
      scores: room.gameData?.scores || {},
    };

    this.io.to(roomId).emit('game:question:started', {
      roomId,
      question: { id: questionId, index: questionIndex },
      startsAt,
      endsAt,
    });

    logger.info(`Question started in room ${roomId}: ${questionId}`);
  }

  private handleGameFlowNext(socket: TypedSocket, roomId: string, nextQuestionId: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    room.gameData = {
      ...(room.gameData || {}),
      currentQuestionId: nextQuestionId,
      answerCounts: new Map<string, number>(),
    };

    this.io.to(roomId).emit('game:question:changed', {
      roomId,
      question: { id: nextQuestionId },
    });

    logger.info(`Question changed in room ${roomId}: ${nextQuestionId}`);
  }

  private handleGameFlowEnd(socket: TypedSocket, roomId: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    if (room.gameData) {
      delete room.gameData.questionWindow;
      delete room.gameData.currentQuestionId;
    }

    this.io.to(roomId).emit('game:question:ended', { roomId, questionId: undefined });
    logger.info(`Question ended in room ${roomId}`);
  }

  private handleQuestionStarted(
    socket: TypedSocket,
    roomId: string,
    question: { id: string; index?: number },
    startsAt?: number,
    endsAt?: number,
  ): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    room.gameData = {
      ...(room.gameData || {}),
      currentQuestionId: question.id,
      questionWindow:
        startsAt && endsAt ? { startsAt, endsAt } : room.gameData?.questionWindow || undefined,
      answerCounts: room.gameData?.answerCounts || new Map<string, number>(),
      scores: room.gameData?.scores || {},
    };

    this.io.to(roomId).emit('game:question:started', {
      roomId,
      question,
      startsAt,
      endsAt,
    });

    logger.info(`Question started (direct) in room ${roomId}: ${question.id}`);
  }

  private handleQuestionEnded(socket: TypedSocket, roomId: string, questionId?: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    if (room.gameData) {
      delete room.gameData.questionWindow;
      delete room.gameData.currentQuestionId;
    }

    this.io.to(roomId).emit('game:question:ended', { roomId, questionId });
    logger.info(`Question ended (direct) in room ${roomId}: ${questionId || 'unknown'}`);
  }

  private handlePhaseChange(socket: TypedSocket, roomId: string, phase: string): void {
    // Store current phase in room state for late joiners
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const gameData = room.gameData || {};
    gameData.currentPhase = phase;

    // If countdown phase, reuse existing server timestamp if available to keep all clients in sync
    const phaseData: { roomId: string; phase: string; startedAt?: number } = { roomId, phase };
    if (phase === 'countdown') {
      const startedAt =
        (gameData.countdownStartedAt as number | undefined) ?? Date.now() + COUNTDOWN_LEAD_MS;
      gameData.countdownStartedAt = startedAt;
      phaseData.startedAt = startedAt;
    }

    room.gameData = gameData;

    this.io.to(roomId).emit('game:phase:change', phaseData);
    logger.info(`Phase change in room ${roomId}: ${phase}`);
  }

  private handleGameStarted(socket: TypedSocket, roomId: string, roomCode?: string): void {
    if (!roomId) return;
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const gameData = room.gameData || {};
    // Set countdown start timestamp once and reuse for all events
    const startedAt =
      (gameData.countdownStartedAt as number | undefined) ?? Date.now() + COUNTDOWN_LEAD_MS;
    gameData.countdownStartedAt = startedAt;
    gameData.currentPhase = gameData.currentPhase || 'countdown';
    room.gameData = gameData;

    this.io.to(roomId).emit('game:started', { roomId, roomCode, gameId: roomId, startedAt });
    logger.info(`Game started broadcast to room ${roomId}`);
  }

  private handleAnswerSubmit(
    socket: TypedSocket,
    roomId: string,
    playerId: string,
    questionId: string,
    answer: string | number,
  ): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const gd = (room.gameData = { ...(room.gameData || {}) });
    const counts =
      (gd.answerCounts as Map<string, number> | undefined) || new Map<string, number>();
    gd.answerCounts = counts;
    const key = String(answer);
    const nextCount = (counts.get(key) ?? 0) + 1;
    counts.set(key, nextCount);

    // Acknowledge to the submitter
    socket.emit('game:answer:accepted', {
      roomId,
      playerId,
      questionId,
      submittedAt: new Date().toISOString(),
    });

    // Broadcast aggregate stats
    const answerCounts = Object.fromEntries(counts);
    this.io.to(roomId).emit('game:answer:stats:update', {
      roomId,
      questionId,
      counts: answerCounts,
    });

    logger.info(`Answer submitted in room ${roomId} by ${playerId} for ${questionId}`);
  }

  private handleLeaderboardRequest(socket: TypedSocket, roomId: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const scores = (room.gameData?.scores as Record<string, number>) || {};
    const rankings = Object.entries(scores)
      .map(([playerId, score]) => ({ playerId, score }))
      .sort((a, b) => b.score - a.score)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    socket.emit('game:leaderboard:update', { roomId, rankings });
    logger.info(`Leaderboard requested for room ${roomId}`);
  }

  private startHeartbeatChecker(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const connections = this.store.getAllConnections();

      connections.forEach((connection) => {
        const timeSinceHeartbeat = now - connection.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT) {
          logger.warn(
            `Connection ${connection.socketId} timed out (no heartbeat for ${timeSinceHeartbeat}ms)`,
          );

          // Disconnect the socket
          const socket = this.io.sockets.sockets.get(connection.socketId);
          if (socket) {
            socket.disconnect(true);
          }

          this.store.removeConnection(connection.socketId);
        }
      });
    }, this.HEARTBEAT_CHECK_INTERVAL);

    logger.info('Heartbeat checker started');
  }

  // Public API for manual operations
  public getStore(): ConnectionStore {
    return this.store;
  }

  public getStats() {
    return {
      ...this.store.getStats(),
      uptime: process.uptime(),
    };
  }

  public disconnect(socketId: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect(true);
    }
  }

  public broadcastToRoom<K extends keyof ServerEvents>(
    roomId: string,
    event: K,
    ...args: Parameters<ServerEvents[K]>
  ): void {
    this.io.to(roomId).emit(event, ...args);
  }

  /**
   * Broadcast phase change with proper handling (adds startedAt for countdown)
   */
  public broadcastPhaseChange(roomId: string, phase: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const gameData = room.gameData || {};
    gameData.currentPhase = phase;

    // If countdown phase, reuse existing server timestamp if available to keep all clients in sync
    const phaseData: { roomId: string; phase: string; startedAt?: number } = { roomId, phase };
    if (phase === 'countdown') {
      const startedAt =
        (gameData.countdownStartedAt as number | undefined) ?? Date.now() + COUNTDOWN_LEAD_MS;
      gameData.countdownStartedAt = startedAt;
      phaseData.startedAt = startedAt;
    }

    room.gameData = gameData;
    this.io.to(roomId).emit('game:phase:change', phaseData);
    logger.info(`Phase change broadcast in room ${roomId}: ${phase}`);
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.store.clear();
    logger.info('WebSocket Manager shutdown');
  }
}
