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
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_PROTOCOL = 'http:';
const HTTPS_PROTOCOL = 'https:';
const ALLOWED_PROTOCOLS = [HTTP_PROTOCOL, HTTPS_PROTOCOL] as const;

const SOCKET_PING_INTERVAL_MS = 25000;
const SOCKET_PING_TIMEOUT_MS = 20000;

const SERVER_HOST = '0.0.0.0';

const LOCALHOST_PATTERNS = ['localhost', '127.0.0.1', '::1'] as const;

const LOCAL_NETWORK_PATTERNS = [
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/,
] as const;

const SUSPICIOUS_ORIGIN_PATTERNS = [/@/, /\s/, /[<>]/, /javascript:/i, /data:/i, /file:/i] as const;

const WILDCARD_ORIGIN = '*';
const WILDCARD_DOMAIN_PREFIX = '*.';
const WILDCARD_URL_SUFFIX = '*';
const DOMAIN_PREFIX_SLICE_OFFSET = 2;
const URL_SUFFIX_SLICE_OFFSET = -1;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

const ALLOWED_CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'] as const;

const NODE_ENV_PRODUCTION = 'production';

const ERROR_MESSAGES = {
  INVALID_PROTOCOL: 'Invalid protocol',
  ORIGIN_NOT_ALLOWED: 'Origin not allowed by CORS policy',
  WILDCARD_NOT_ALLOWED_IN_PRODUCTION: 'Wildcard origin (*) not allowed in production!',
} as const;

const LOG_MESSAGES = {
  INVALID_ORIGIN_FORMAT: (origin: string) => `Invalid origin format: ${origin}`,
  SUSPICIOUS_ORIGIN_PATTERN: (origin: string) => `Suspicious origin pattern detected: ${origin}`,
  WILDCARD_ALLOWED_NON_PROD: 'Wildcard origin (*) allowed in non-production environment',
  LOCAL_NETWORK_CONNECTION: (origin: string) => `Local network connection attempt from: ${origin}`,
  ADD_TO_CLIENT_ORIGINS: 'Add this origin to CLIENT_ORIGINS env variable if needed',
  CORS_BLOCKED: (origin: string) => `Socket.IO CORS blocked: ${origin}`,
} as const;

//----------------------------------------------------
// 3. Core Logic
//----------------------------------------------------
const app = createApp();
const server = http.createServer(app);
const io = new SocketIOServer<WebSocketEvents, ServerEvents>(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowed = getAllowedOrigins();

      if (process.env.NODE_ENV !== NODE_ENV_PRODUCTION) {
        const host = hostnameOf(origin);

        if ((LOCALHOST_PATTERNS as readonly string[]).includes(host)) {
          return callback(null, true);
        }

        for (const pattern of LOCAL_NETWORK_PATTERNS) {
          if (pattern.test(host)) {
            logger.warn(LOG_MESSAGES.LOCAL_NETWORK_CONNECTION(origin));
            logger.info(LOG_MESSAGES.ADD_TO_CLIENT_ORIGINS);
            break;
          }
        }
      }

      if (originAllowed(origin, allowed)) {
        return callback(null, true);
      }

      logger.warn(LOG_MESSAGES.CORS_BLOCKED(origin));
      callback(new Error(ERROR_MESSAGES.ORIGIN_NOT_ALLOWED));
    },
    credentials: true,
    methods: [...HTTP_METHODS],
    allowedHeaders: [...ALLOWED_CORS_HEADERS],
  },
  pingInterval: SOCKET_PING_INTERVAL_MS,
  pingTimeout: SOCKET_PING_TIMEOUT_MS,
});

initializeWebSocketManager(io);

server.listen(env.PORT, SERVER_HOST, () => {
  logger.info(`api listening on http://${SERVER_HOST}:${env.PORT} (${isProd ? 'prod' : 'dev'})`);
  logger.info(`Accessible on localhost: http://localhost:${env.PORT}`);
  logger.info(`Accessible on network: http://<your-ip>:${env.PORT}`);
});

//----------------------------------------------------
// 4. Helper Functions
//----------------------------------------------------
/**
 * Function: hostnameOf
 * Description:
 * - Extracts and validates hostname from origin URL
 * - Validates protocol is http or https
 * - Returns empty string if URL is invalid or protocol is not allowed
 *
 * @param origin - The origin URL to parse
 *
 * @returns Lowercase hostname or empty string if invalid
 */
function hostnameOf(origin: string): string {
  try {
    const url = new URL(origin);
    if (!(ALLOWED_PROTOCOLS as readonly string[]).includes(url.protocol)) {
      throw new Error(ERROR_MESSAGES.INVALID_PROTOCOL);
    }
    return url.hostname.toLowerCase();
  } catch {
    logger.warn(LOG_MESSAGES.INVALID_ORIGIN_FORMAT(origin));
    return '';
  }
}

/**
 * Function: originAllowed
 * Description:
 * - Validates if origin is allowed based on allowed list
 * - Checks for suspicious patterns before validation
 * - Supports wildcard domains (*.example.com) and URL prefixes (https://example.com/*)
 * - Blocks wildcard origins in production environment
 *
 * @param origin - The origin to validate
 * @param allowedList - List of allowed origin patterns
 *
 * @returns true if origin is allowed, false otherwise
 */
function originAllowed(origin: string, allowedList: string[]): boolean {
  if (SUSPICIOUS_ORIGIN_PATTERNS.some((p) => p.test(origin))) {
    logger.warn(LOG_MESSAGES.SUSPICIOUS_ORIGIN_PATTERN(origin));
    return false;
  }

  const host = hostnameOf(origin);
  if (!host) return false;

  for (const allowed of allowedList) {
    if (!allowed) continue;

    if (allowed === WILDCARD_ORIGIN) {
      if (isProd) {
        logger.error(ERROR_MESSAGES.WILDCARD_NOT_ALLOWED_IN_PRODUCTION);
        return false;
      }
      logger.warn(LOG_MESSAGES.WILDCARD_ALLOWED_NON_PROD);
      return true;
    }

    if (/^https?:\/\//i.test(allowed) && origin === allowed) return true;

    if (!allowed.includes(WILDCARD_ORIGIN) && host === hostnameOf(allowed)) return true;

    if (allowed.startsWith(WILDCARD_DOMAIN_PREFIX)) {
      const domain = allowed.slice(DOMAIN_PREFIX_SLICE_OFFSET);
      if (host === domain || host.endsWith('.' + domain)) return true;
    }

    if (allowed.endsWith(WILDCARD_URL_SUFFIX) && /^https?:\/\//i.test(allowed)) {
      const prefix = allowed.slice(URL_SUFFIX_SLICE_OFFSET);
      if (origin.startsWith(prefix)) return true;
    }
  }

  return false;
}
