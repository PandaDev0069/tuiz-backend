// ====================================================
// File Name   : ConnectionStore.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-11-23
// Last Update : 2025-12-26

// Description:
// - In-memory store for WebSocket connections and game rooms
// - Manages connection lifecycle and room membership
// - Provides statistics and utility methods

// Notes:
// - For production with multiple servers, should be replaced with Redis or similar
// - Uses Map data structures for efficient lookups
// - Automatically cleans up empty rooms
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { logger } from '../../utils/logger';

import type { ClientConnection, GameRoom } from './types';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const DEFAULT_RECONNECT_COUNT = 0;
const EMPTY_ROOM_SIZE = 0;
const REDUCE_INITIAL_VALUE = 0;

const LOG_MESSAGES = {
  CONNECTION_ADDED: 'Connection added',
  CONNECTION_REMOVED: 'Connection removed',
  ROOM_CREATED: 'Room created',
  SOCKET_ALREADY_IN_ROOM: 'Socket already in room, skipping duplicate join',
  SOCKET_JOINED_ROOM: 'Socket joined room',
  ROOM_DELETED_EMPTY: 'Room deleted (empty)',
  SOCKET_LEFT_ROOM: 'Socket left room',
  STORE_CLEARED: 'Connection store cleared',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Class: ConnectionStore
 * Description:
 * - In-memory store for WebSocket connections and game rooms
 * - Manages connection lifecycle and room membership tracking
 * - Provides efficient lookups using Map data structures
 */
export class ConnectionStore {
  private connections: Map<string, ClientConnection> = new Map();
  private deviceToSocket: Map<string, string> = new Map();
  private rooms: Map<string, GameRoom> = new Map();
  private socketToRooms: Map<string, Set<string>> = new Map();

  /**
   * Method: addConnection
   * Description:
   * - Adds a new connection to the store
   * - Maps socket ID to connection and device ID to socket ID
   *
   * Parameters:
   * - connection (ClientConnection): Connection to add
   *
   * Returns:
   * - void: No return value
   */
  addConnection(connection: ClientConnection): void {
    this.connections.set(connection.socketId, connection);
    this.deviceToSocket.set(connection.deviceId, connection.socketId);
    logger.info(
      {
        socketId: connection.socketId,
        deviceId: connection.deviceId,
      },
      LOG_MESSAGES.CONNECTION_ADDED,
    );
  }

  /**
   * Method: removeConnection
   * Description:
   * - Removes a connection from the store
   * - Removes from all rooms and cleans up mappings
   *
   * Parameters:
   * - socketId (string): Socket identifier to remove
   *
   * Returns:
   * - ClientConnection | undefined: Removed connection or undefined if not found
   */
  removeConnection(socketId: string): ClientConnection | undefined {
    const connection = this.connections.get(socketId);
    if (connection) {
      this.connections.delete(socketId);
      this.deviceToSocket.delete(connection.deviceId);

      const rooms = this.socketToRooms.get(socketId);
      if (rooms) {
        rooms.forEach((roomId) => {
          this.removeFromRoom(socketId, roomId);
        });
        this.socketToRooms.delete(socketId);
      }

      logger.info({ socketId }, LOG_MESSAGES.CONNECTION_REMOVED);
    }
    return connection;
  }

  /**
   * Method: getConnection
   * Description:
   * - Retrieves a connection by socket ID
   *
   * Parameters:
   * - socketId (string): Socket identifier
   *
   * Returns:
   * - ClientConnection | undefined: Connection or undefined if not found
   */
  getConnection(socketId: string): ClientConnection | undefined {
    return this.connections.get(socketId);
  }

  /**
   * Method: getConnectionByDevice
   * Description:
   * - Retrieves a connection by device ID
   *
   * Parameters:
   * - deviceId (string): Device identifier
   *
   * Returns:
   * - ClientConnection | undefined: Connection or undefined if not found
   */
  getConnectionByDevice(deviceId: string): ClientConnection | undefined {
    const socketId = this.deviceToSocket.get(deviceId);
    return socketId ? this.connections.get(socketId) : undefined;
  }

  /**
   * Method: updateHeartbeat
   * Description:
   * - Updates the last heartbeat timestamp for a connection
   *
   * Parameters:
   * - socketId (string): Socket identifier
   *
   * Returns:
   * - void: No return value
   */
  updateHeartbeat(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastHeartbeat = new Date();
    }
  }

  /**
   * Method: incrementReconnectCount
   * Description:
   * - Increments the reconnect count for a device
   *
   * Parameters:
   * - deviceId (string): Device identifier
   *
   * Returns:
   * - number: New reconnect count, or 0 if device not found
   */
  incrementReconnectCount(deviceId: string): number {
    const connection = this.getConnectionByDevice(deviceId);
    if (connection) {
      connection.reconnectCount++;
      return connection.reconnectCount;
    }
    return DEFAULT_RECONNECT_COUNT;
  }

  /**
   * Method: getAllConnections
   * Description:
   * - Returns all active connections
   *
   * Returns:
   * - ClientConnection[]: Array of all connections
   */
  getAllConnections(): ClientConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Method: getConnectionCount
   * Description:
   * - Returns the total number of active connections
   *
   * Returns:
   * - number: Total connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Method: createRoom
   * Description:
   * - Creates a new game room or returns existing room
   * - Initializes room with empty client set and optional game data
   *
   * Parameters:
   * - roomId (string): Room identifier
   * - gameData (Record<string, unknown> | undefined): Optional initial game data
   *
   * Returns:
   * - GameRoom: Created or existing room
   */
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
    logger.info({ roomId }, LOG_MESSAGES.ROOM_CREATED);
    return room;
  }

  /**
   * Method: addToRoom
   * Description:
   * - Adds a socket to a room
   * - Creates room if it doesn't exist
   * - Prevents duplicate joins
   *
   * Parameters:
   * - socketId (string): Socket identifier
   * - roomId (string): Room identifier
   *
   * Returns:
   * - boolean: True if added, false if already in room
   */
  addToRoom(socketId: string, roomId: string): boolean {
    let room = this.rooms.get(roomId);

    if (!room) {
      room = this.createRoom(roomId);
    }

    if (room.clients.has(socketId)) {
      logger.debug(
        {
          socketId,
          roomId,
        },
        LOG_MESSAGES.SOCKET_ALREADY_IN_ROOM,
      );
      return false;
    }

    room.clients.add(socketId);

    if (!this.socketToRooms.has(socketId)) {
      this.socketToRooms.set(socketId, new Set());
    }
    this.socketToRooms.get(socketId)!.add(roomId);

    logger.info({ socketId, roomId }, LOG_MESSAGES.SOCKET_JOINED_ROOM);
    return true;
  }

  /**
   * Method: removeFromRoom
   * Description:
   * - Removes a socket from a room
   * - Cleans up empty rooms automatically
   *
   * Parameters:
   * - socketId (string): Socket identifier
   * - roomId (string): Room identifier
   *
   * Returns:
   * - boolean: True if removed, false if room not found
   */
  removeFromRoom(socketId: string, roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.clients.delete(socketId);

    const socketRooms = this.socketToRooms.get(socketId);
    if (socketRooms) {
      socketRooms.delete(roomId);
    }

    if (room.clients.size === EMPTY_ROOM_SIZE) {
      this.rooms.delete(roomId);
      logger.info({ roomId }, LOG_MESSAGES.ROOM_DELETED_EMPTY);
    } else {
      logger.info({ socketId, roomId }, LOG_MESSAGES.SOCKET_LEFT_ROOM);
    }

    return true;
  }

  /**
   * Method: getRoom
   * Description:
   * - Retrieves a room by ID
   *
   * Parameters:
   * - roomId (string): Room identifier
   *
   * Returns:
   * - GameRoom | undefined: Room or undefined if not found
   */
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Method: getRoomsForSocket
   * Description:
   * - Returns all room IDs that a socket is in
   *
   * Parameters:
   * - socketId (string): Socket identifier
   *
   * Returns:
   * - string[]: Array of room IDs
   */
  getRoomsForSocket(socketId: string): string[] {
    const rooms = this.socketToRooms.get(socketId);
    return rooms ? Array.from(rooms) : [];
  }

  /**
   * Method: getAllRooms
   * Description:
   * - Returns all active rooms
   *
   * Returns:
   * - GameRoom[]: Array of all rooms
   */
  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Method: getRoomCount
   * Description:
   * - Returns the total number of active rooms
   *
   * Returns:
   * - number: Total room count
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Method: getStats
   * Description:
   * - Returns statistics about connections and rooms
   *
   * Returns:
   * - object: Statistics object with connection count, room count, and total room clients
   */
  getStats() {
    return {
      connections: this.getConnectionCount(),
      rooms: this.getRoomCount(),
      totalRoomClients: Array.from(this.rooms.values()).reduce(
        (sum, room) => sum + room.clients.size,
        REDUCE_INITIAL_VALUE,
      ),
    };
  }

  /**
   * Method: clear
   * Description:
   * - Clears all connections, rooms, and mappings
   * - Used for cleanup and testing
   *
   * Returns:
   * - void: No return value
   */
  clear(): void {
    this.connections.clear();
    this.deviceToSocket.clear();
    this.rooms.clear();
    this.socketToRooms.clear();
    logger.info(LOG_MESSAGES.STORE_CLEARED);
  }
}
