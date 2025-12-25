// src/services/websocket/ConnectionStore.ts

import { logger } from '../../utils/logger';

import { ClientConnection, GameRoom } from './types';

/**
 * In-memory store for WebSocket connections and game rooms
 * For production with multiple servers, this should be replaced with Redis or similar
 */
export class ConnectionStore {
  private connections: Map<string, ClientConnection> = new Map();
  private deviceToSocket: Map<string, string> = new Map();
  private rooms: Map<string, GameRoom> = new Map();
  private socketToRooms: Map<string, Set<string>> = new Map();

  // Connection management
  addConnection(connection: ClientConnection): void {
    this.connections.set(connection.socketId, connection);
    this.deviceToSocket.set(connection.deviceId, connection.socketId);
    logger.info(`Connection added: ${connection.socketId} (device: ${connection.deviceId})`);
  }

  removeConnection(socketId: string): ClientConnection | undefined {
    const connection = this.connections.get(socketId);
    if (connection) {
      this.connections.delete(socketId);
      this.deviceToSocket.delete(connection.deviceId);

      // Remove from all rooms
      const rooms = this.socketToRooms.get(socketId);
      if (rooms) {
        rooms.forEach((roomId) => {
          this.removeFromRoom(socketId, roomId);
        });
        this.socketToRooms.delete(socketId);
      }

      logger.info(`Connection removed: ${socketId}`);
    }
    return connection;
  }

  getConnection(socketId: string): ClientConnection | undefined {
    return this.connections.get(socketId);
  }

  getConnectionByDevice(deviceId: string): ClientConnection | undefined {
    const socketId = this.deviceToSocket.get(deviceId);
    return socketId ? this.connections.get(socketId) : undefined;
  }

  updateHeartbeat(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastHeartbeat = new Date();
    }
  }

  incrementReconnectCount(deviceId: string): number {
    const connection = this.getConnectionByDevice(deviceId);
    if (connection) {
      connection.reconnectCount++;
      return connection.reconnectCount;
    }
    return 0;
  }

  getAllConnections(): ClientConnection[] {
    return Array.from(this.connections.values());
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  // Room management
  createRoom(roomId: string, gameData?: Record<string, unknown>): GameRoom {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const room: GameRoom = {
      roomId,
      clients: new Set(),
      createdAt: new Date(),
      gameData,
    };

    this.rooms.set(roomId, room);
    logger.info(`Room created: ${roomId}`);
    return room;
  }

  addToRoom(socketId: string, roomId: string): boolean {
    let room = this.rooms.get(roomId);

    if (!room) {
      room = this.createRoom(roomId);
    }

    // Check if socket is already in the room to prevent duplicate joins
    if (room.clients.has(socketId)) {
      logger.debug(`Socket ${socketId} already in room ${roomId}, skipping duplicate join`);
      return false;
    }

    room.clients.add(socketId);

    // Track rooms per socket
    if (!this.socketToRooms.has(socketId)) {
      this.socketToRooms.set(socketId, new Set());
    }
    this.socketToRooms.get(socketId)!.add(roomId);

    logger.info(`Socket ${socketId} joined room ${roomId}`);
    return true;
  }

  removeFromRoom(socketId: string, roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.clients.delete(socketId);

    // Update socket's rooms
    const socketRooms = this.socketToRooms.get(socketId);
    if (socketRooms) {
      socketRooms.delete(roomId);
    }

    // Clean up empty rooms
    if (room.clients.size === 0) {
      this.rooms.delete(roomId);
      logger.info(`Room ${roomId} deleted (empty)`);
    } else {
      logger.info(`Socket ${socketId} left room ${roomId}`);
    }

    return true;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  getRoomsForSocket(socketId: string): string[] {
    const rooms = this.socketToRooms.get(socketId);
    return rooms ? Array.from(rooms) : [];
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  // Utility methods
  getStats() {
    return {
      connections: this.getConnectionCount(),
      rooms: this.getRoomCount(),
      totalRoomClients: Array.from(this.rooms.values()).reduce(
        (sum, room) => sum + room.clients.size,
        0,
      ),
    };
  }

  clear(): void {
    this.connections.clear();
    this.deviceToSocket.clear();
    this.rooms.clear();
    this.socketToRooms.clear();
    logger.info('Connection store cleared');
  }
}
