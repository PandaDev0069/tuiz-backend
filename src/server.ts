// src/server.ts
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { env, isProd, getAllowedOrigins } from './config/env';
import { WebSocketManager, WebSocketEvents, ServerEvents } from './services/websocket';
import { logger } from './utils/logger';

// CORS helper functions (same logic as cors.ts)
function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin.replace(/^https?:\/\//i, '').split(':')[0]; // crude fallback
  }
}

function originAllowed(origin: string, allowedList: string[]): boolean {
  const host = hostnameOf(origin);

  for (const a of allowedList) {
    if (!a) continue;
    if (a === '*') return true;

    // Exact full origin match (scheme + host)
    if (/^https?:\/\//i.test(a) && origin === a) return true;

    // Exact host match
    if (!a.includes('*') && host === hostnameOf(a)) return true;

    // Wildcard suffix: *.vercel.app
    if (a.startsWith('*.') && host.endsWith(a.slice(2))) return true;

    // Wildcard prefix: staging-* (hostname starts with "staging-")
    if (a.endsWith('*') && host.startsWith(a.slice(0, -1))) return true;
  }

  return false;
}

const app = createApp();
const server = http.createServer(app);
const io = new SocketIOServer<WebSocketEvents, ServerEvents>(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Same-origin requests

      const allowed = getAllowedOrigins();

      if (originAllowed(origin, allowed)) {
        return callback(null, true);
      }

      logger.warn(`Socket.IO CORS: ${origin} not allowed`);
      callback(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

// Initialize WebSocket Manager
const wsManager = new WebSocketManager(io);

// Export for potential use in routes
export { wsManager };

server.listen(env.PORT, () => {
  const host = isProd ? '0.0.0.0' : 'localhost';
  logger.info(`api listening on http://${host}:${env.PORT} (${isProd ? 'prod' : 'dev'})`);
});
