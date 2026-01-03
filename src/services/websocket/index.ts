// ====================================================
// File Name   : index.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-11-23
// Last Update : 2026-01-03

// Description:
// - Barrel export file for WebSocket service module
// - Re-exports all public APIs from WebSocket service
// - Provides centralized access point for WebSocket functionality

// Notes:
// - Exports WebSocketManager class and ConnectionStore
// - Exports all type definitions from types module
// - Exports manager singleton functions
// ====================================================

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export { WebSocketManager } from './WebSocketManager';
export { ConnectionStore } from './ConnectionStore';
export * from './types';
export {
  initializeWebSocketManager,
  getWebSocketManager,
  requireWebSocketManager,
} from './manager';
