// src/server.ts
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { env, isProd, getAllowedOrigins } from './config/env';
import { WebSocketEvents, ServerEvents, initializeWebSocketManager } from './services/websocket';
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

      // In development, also allow local network IPs for WebSocket connections
      if (process.env.NODE_ENV !== 'production') {
        const host = hostnameOf(origin);
        const localNetworkPatterns = [
          /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.x.x
          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.x.x.x
          /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16-31.x.x
        ];

        for (const pattern of localNetworkPatterns) {
          if (pattern.test(host)) {
            return callback(null, true);
          }
        }
      }

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
initializeWebSocketManager(io);

// Bind to 0.0.0.0 to allow connections from local network devices
const host = '0.0.0.0';
server.listen(env.PORT, host, () => {
  logger.info(`api listening on http://${host}:${env.PORT} (${isProd ? 'prod' : 'dev'})`);
  logger.info(`Accessible on localhost: http://localhost:${env.PORT}`);
  logger.info(`Accessible on network: http://<your-ip>:${env.PORT}`);
});
