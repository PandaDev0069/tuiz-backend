// ====================================================
// File Name   : server.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2026-01-03

// Description:
// - HTTP server with Socket.IO integration for real-time communication
// - Enhanced CORS security with protocol validation and suspicious pattern detection
// - Restricts localhost access and validates origin formats

// Notes:
// - Binds to 0.0.0.0 for local network device access
// - Wildcard origins blocked in production for security
// - Local network IPs require explicit CLIENT_ORIGINS configuration
// - Socket.IO configured with ping interval/timeout for connection stability
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { env, isProd, getAllowedOrigins } from './config/env';
import { WebSocketEvents, ServerEvents, initializeWebSocketManager } from './services/websocket';
import { logger } from './utils/logger';

//----------------------------------------------------
// 2. Helper Functions
//----------------------------------------------------
function hostnameOf(origin: string): string {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    return url.hostname.toLowerCase();
  } catch {
    logger.warn(`Invalid origin format: ${origin}`);
    return '';
  }
}

function originAllowed(origin: string, allowedList: string[]): boolean {
  const suspiciousPatterns = [/@/, /\s/, /[<>]/, /javascript:/i, /data:/i, /file:/i];
  if (suspiciousPatterns.some((p) => p.test(origin))) {
    logger.warn(`Suspicious origin pattern detected: ${origin}`);
    return false;
  }

  const host = hostnameOf(origin);
  if (!host) return false;

  for (const a of allowedList) {
    if (!a) continue;

    if (a === '*') {
      if (isProd) {
        logger.error('Wildcard origin (*) not allowed in production!');
        return false;
      }
      logger.warn('Wildcard origin (*) allowed in non-production environment');
      return true;
    }

    if (/^https?:\/\//i.test(a) && origin === a) return true;

    if (!a.includes('*') && host === hostnameOf(a)) return true;

    if (a.startsWith('*.')) {
      const domain = a.slice(2);
      if (host === domain || host.endsWith('.' + domain)) return true;
    }

    if (a.endsWith('*') && /^https?:\/\//i.test(a)) {
      const prefix = a.slice(0, -1);
      if (origin.startsWith(prefix)) return true;
    }
  }

  return false;
}

//----------------------------------------------------
// 3. Server Initialization
//----------------------------------------------------
const app = createApp();
const server = http.createServer(app);
const io = new SocketIOServer<WebSocketEvents, ServerEvents>(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowed = getAllowedOrigins();

      if (process.env.NODE_ENV !== 'production') {
        const host = hostnameOf(origin);
        const localhostPatterns = ['localhost', '127.0.0.1', '::1'];

        if (localhostPatterns.includes(host)) {
          return callback(null, true);
        }

        const localNetworkPatterns = [
          /^192\.168\.\d{1,3}\.\d{1,3}$/,
          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
          /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/,
        ];

        for (const pattern of localNetworkPatterns) {
          if (pattern.test(host)) {
            logger.warn(`Local network connection attempt from: ${origin}`);
            logger.info('Add this origin to CLIENT_ORIGINS env variable if needed');
            break;
          }
        }
      }

      if (originAllowed(origin, allowed)) {
        return callback(null, true);
      }

      logger.warn(`Socket.IO CORS blocked: ${origin}`);
      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

//----------------------------------------------------
// 4. WebSocket Initialization
//----------------------------------------------------
initializeWebSocketManager(io);

//----------------------------------------------------
// 5. Server Startup
//----------------------------------------------------
const host = '0.0.0.0';
server.listen(env.PORT, host, () => {
  logger.info(`api listening on http://${host}:${env.PORT} (${isProd ? 'prod' : 'dev'})`);
  logger.info(`Accessible on localhost: http://localhost:${env.PORT}`);
  logger.info(`Accessible on network: http://<your-ip>:${env.PORT}`);
});
