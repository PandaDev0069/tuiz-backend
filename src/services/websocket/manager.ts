// ====================================================
// File Name   : manager.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-01-03
// Last Update : 2025-01-03

// Description:
// - Singleton module for WebSocketManager instance
// - Provides initialization and accessor functions for WebSocketManager
// - Breaks circular dependency between server.ts and routes

// Notes:
// - Manager instance is initialized once from server.ts
// - Provides null-safe and required accessor functions
// - Used to avoid circular dependencies in module imports
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Server as SocketIOServer } from 'socket.io';

import type { WebSocketEvents, ServerEvents } from './types';

import { WebSocketManager } from './WebSocketManager';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const ERROR_MESSAGES = {
  ALREADY_INITIALIZED: 'WebSocketManager has already been initialized',
  NOT_INITIALIZED:
    'WebSocketManager has not been initialized. Make sure server.ts has called initializeWebSocketManager()',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
let wsManagerInstance: WebSocketManager | null = null;

/**
 * Function: initializeWebSocketManager
 * Description:
 * - Initializes the WebSocket Manager singleton instance
 * - Should be called once from server.ts after creating Socket.IO server
 * - Throws error if already initialized
 *
 * Parameters:
 * - io (SocketIOServer<WebSocketEvents, ServerEvents>): Socket.IO server instance
 *
 * Returns:
 * - WebSocketManager: The initialized WebSocketManager instance
 *
 * Throws:
 * - Error: If WebSocketManager has already been initialized
 */
export function initializeWebSocketManager(
  io: SocketIOServer<WebSocketEvents, ServerEvents>,
): WebSocketManager {
  if (wsManagerInstance) {
    throw new Error(ERROR_MESSAGES.ALREADY_INITIALIZED);
  }
  wsManagerInstance = new WebSocketManager(io);
  return wsManagerInstance;
}

/**
 * Function: getWebSocketManager
 * Description:
 * - Returns the WebSocket Manager instance
 * - Returns null if not yet initialized
 * - Safe for testing scenarios where manager may not be initialized
 *
 * Returns:
 * - WebSocketManager | null: The WebSocketManager instance or null if not initialized
 */
export function getWebSocketManager(): WebSocketManager | null {
  return wsManagerInstance;
}

/**
 * Function: requireWebSocketManager
 * Description:
 * - Returns the WebSocket Manager instance
 * - Throws error if not initialized
 * - Use in routes that require wsManager to be available
 *
 * Returns:
 * - WebSocketManager: The WebSocketManager instance
 *
 * Throws:
 * - Error: If WebSocketManager has not been initialized
 */
export function requireWebSocketManager(): WebSocketManager {
  if (!wsManagerInstance) {
    throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
  }
  return wsManagerInstance;
}
