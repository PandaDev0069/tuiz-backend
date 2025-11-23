// src/services/websocket/WebSocketManager.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../../utils/logger';

import { ConnectionStore } from './ConnectionStore';
import { ClientConnection, ConnectionInfo, WebSocketEvents, ServerEvents } from './types';

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

    // Game events
    socket.on('game:action', (data) => {
      this.handleGameAction(socket, data.roomId, data.action, data.payload);
    });

    socket.on('game:state', (data) => {
      this.handleGameState(socket, data.roomId, data.state);
    });
  }

  private registerClient(socket: TypedSocket, data: ConnectionInfo): void {
    const { deviceId, userId, metadata } = data;

    if (!deviceId) {
      socket.emit('ws:error', {
        error: 'invalid_device_id',
        message: 'Device ID is required',
      });
      return;
    }

    // Check if device was previously connected (reconnection)
    const existingConnection = this.store.getConnectionByDevice(deviceId);
    const reconnectCount = existingConnection ? existingConnection.reconnectCount + 1 : 0;

    const connection: ClientConnection = {
      socketId: socket.id,
      deviceId,
      userId,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      reconnectCount,
      metadata,
    };

    this.store.addConnection(connection);

    socket.emit('ws:connected', {
      socketId: socket.id,
      deviceId,
      reconnectCount,
      serverTime: new Date().toISOString(),
    });

    logger.info(
      `Client registered: socket=${socket.id}, device=${deviceId}, reconnects=${reconnectCount}`,
    );
  }

  private handleDisconnect(socket: TypedSocket, reason: string): void {
    logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
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

    // Add to Socket.IO room
    socket.join(roomId);

    // Track in store
    this.store.addToRoom(socket.id, roomId);

    const room = this.store.getRoom(roomId);
    const clientCount = room ? room.clients.size : 0;

    socket.emit('room:joined', { roomId, clients: clientCount });

    // Notify others in the room
    socket.to(roomId).emit('room:user-joined', {
      roomId,
      socketId: socket.id,
    });

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

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.store.clear();
    logger.info('WebSocket Manager shutdown');
  }
}
