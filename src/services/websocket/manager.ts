// src/services/websocket/manager.ts
// Singleton module for WebSocketManager instance
// This breaks the circular dependency between server.ts and routes

import { Server as SocketIOServer } from 'socket.io';
import { WebSocketEvents, ServerEvents } from './types';
import { WebSocketManager } from './WebSocketManager';

let wsManagerInstance: WebSocketManager | null = null;

/**
 * Initialize the WebSocket Manager instance
 * This should be called once from server.ts after creating the Socket.IO server
 */
export function initializeWebSocketManager(
  io: SocketIOServer<WebSocketEvents, ServerEvents>,
): WebSocketManager {
  if (wsManagerInstance) {
    throw new Error('WebSocketManager has already been initialized');
  }
  wsManagerInstance = new WebSocketManager(io);
  return wsManagerInstance;
}

/**
 * Get the WebSocket Manager instance
 * Returns null if not yet initialized (for testing scenarios)
 */
export function getWebSocketManager(): WebSocketManager | null {
  return wsManagerInstance;
}

/**
 * Get the WebSocket Manager instance (throws if not initialized)
 * Use this in routes that require wsManager to be available
 */
export function requireWebSocketManager(): WebSocketManager {
  if (!wsManagerInstance) {
    throw new Error(
      'WebSocketManager has not been initialized. Make sure server.ts has called initializeWebSocketManager()',
    );
  }
  return wsManagerInstance;
}
