// ====================================================
// File Name   : cors.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2025-12-29

// Description:
// - CORS (Cross-Origin Resource Sharing) configuration
// - Validates and allows requests from configured origins
// - Supports wildcard patterns and local network access in development
// - Provides secure origin validation for API endpoints

// Notes:
// - Allows local network IPs in development/test environments
// - Supports wildcard patterns (*.domain.com, prefix-*)
// - Validates exact origin and hostname matches
// - Credentials enabled for authenticated requests
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import cors from 'cors';
import { getAllowedOrigins } from './env';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const ENV_PRODUCTION = 'production';

const WILDCARD_ALL = '*';
const WILDCARD_PREFIX = '*';
const WILDCARD_SUFFIX = '*.';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];
const EXPOSED_HEADERS = ['X-Request-Id'];
const OPTIONS_SUCCESS_STATUS = 204;

const LOCALHOST = 'localhost';
const LOCALHOST_IP = '127.0.0.1';

const LOCAL_NETWORK_PATTERNS = [
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/,
] as const;

const PROTOCOL_REGEX = /^https?:\/\//i;
const URL_PROTOCOL_REPLACE_REGEX = /^https?:\/\//i;
const URL_PORT_SEPARATOR = ':';

const ERROR_MESSAGES = {
  CORS_ORIGIN_NOT_ALLOWED: (origin: string) => `CORS: ${origin} not allowed`,
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types - using imported types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Middleware: corsMw
 * Description:
 * - CORS middleware for Express application
 * - Validates origin against allowed list
 * - Supports wildcard patterns and local network access
 *
 * Configuration:
 * - credentials: true (allows cookies/auth headers)
 * - methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - allowedHeaders: Content-Type, Authorization, X-Requested-With
 * - exposedHeaders: X-Request-Id
 * - optionsSuccessStatus: 204
 */
export const corsMw = cors({
  origin: (origin, cb) => {
    if (!origin) {
      return cb(null, true);
    }

    const allowed = getAllowedOrigins();

    if (originAllowed(origin, allowed)) {
      return cb(null, true);
    }

    cb(new Error(ERROR_MESSAGES.CORS_ORIGIN_NOT_ALLOWED(origin)));
  },
  credentials: true,
  methods: [...HTTP_METHODS],
  allowedHeaders: ALLOWED_HEADERS,
  exposedHeaders: EXPOSED_HEADERS,
  optionsSuccessStatus: OPTIONS_SUCCESS_STATUS,
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: hostnameOf
 * Description:
 * - Extracts hostname from origin URL
 * - Uses URL API with fallback parsing
 *
 * Parameters:
 * - origin (string): Origin URL string
 *
 * Returns:
 * - string: Hostname extracted from origin
 */
function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin.replace(URL_PROTOCOL_REPLACE_REGEX, '').split(URL_PORT_SEPARATOR)[0];
  }
}

/**
 * Function: isLocalNetworkHost
 * Description:
 * - Checks if hostname matches local network patterns
 * - Only active in non-production environments
 *
 * Parameters:
 * - host (string): Hostname to check
 *
 * Returns:
 * - boolean: True if host matches local network pattern, false otherwise
 */
function isLocalNetworkHost(host: string): boolean {
  if (process.env.NODE_ENV === ENV_PRODUCTION) {
    return false;
  }

  if (host === LOCALHOST || host === LOCALHOST_IP) {
    return true;
  }

  return LOCAL_NETWORK_PATTERNS.some((pattern) => pattern.test(host));
}

/**
 * Function: matchesExactOrigin
 * Description:
 * - Checks if origin exactly matches allowed pattern
 * - Handles full URL patterns (scheme + host)
 *
 * Parameters:
 * - origin (string): Origin to check
 * - allowedPattern (string): Allowed pattern to match against
 *
 * Returns:
 * - boolean: True if exact match, false otherwise
 */
function matchesExactOrigin(origin: string, allowedPattern: string): boolean {
  return PROTOCOL_REGEX.test(allowedPattern) && origin === allowedPattern;
}

/**
 * Function: matchesExactHost
 * Description:
 * - Checks if hostname exactly matches allowed pattern
 * - Handles patterns without wildcards
 *
 * Parameters:
 * - host (string): Hostname to check
 * - allowedPattern (string): Allowed pattern to match against
 *
 * Returns:
 * - boolean: True if exact host match, false otherwise
 */
function matchesExactHost(host: string, allowedPattern: string): boolean {
  if (allowedPattern.includes(WILDCARD_ALL)) {
    return false;
  }
  return host === hostnameOf(allowedPattern);
}

/**
 * Function: matchesWildcardSuffix
 * Description:
 * - Checks if hostname matches wildcard suffix pattern (e.g., *.vercel.app)
 *
 * Parameters:
 * - host (string): Hostname to check
 * - allowedPattern (string): Wildcard suffix pattern
 *
 * Returns:
 * - boolean: True if matches wildcard suffix, false otherwise
 */
function matchesWildcardSuffix(host: string, allowedPattern: string): boolean {
  if (!allowedPattern.startsWith(WILDCARD_SUFFIX)) {
    return false;
  }
  const suffix = allowedPattern.slice(2);
  return host.endsWith(suffix);
}

/**
 * Function: matchesWildcardPrefix
 * Description:
 * - Checks if hostname matches wildcard prefix pattern (e.g., staging-*)
 *
 * Parameters:
 * - host (string): Hostname to check
 * - allowedPattern (string): Wildcard prefix pattern
 *
 * Returns:
 * - boolean: True if matches wildcard prefix, false otherwise
 */
function matchesWildcardPrefix(host: string, allowedPattern: string): boolean {
  if (!allowedPattern.endsWith(WILDCARD_PREFIX)) {
    return false;
  }
  const prefix = allowedPattern.slice(0, -1);
  return host.startsWith(prefix);
}

/**
 * Function: matchesAllowedPattern
 * Description:
 * - Checks if origin matches a specific allowed pattern
 * - Tries multiple matching strategies
 *
 * Parameters:
 * - origin (string): Origin to check
 * - host (string): Hostname extracted from origin
 * - allowedPattern (string): Allowed pattern to match against
 *
 * Returns:
 * - boolean: True if matches any pattern, false otherwise
 */
function matchesAllowedPattern(origin: string, host: string, allowedPattern: string): boolean {
  if (allowedPattern === WILDCARD_ALL) {
    return true;
  }

  if (matchesExactOrigin(origin, allowedPattern)) {
    return true;
  }

  if (matchesExactHost(host, allowedPattern)) {
    return true;
  }

  if (matchesWildcardSuffix(host, allowedPattern)) {
    return true;
  }

  if (matchesWildcardPrefix(host, allowedPattern)) {
    return true;
  }

  return false;
}

/**
 * Function: originAllowed
 * Description:
 * - Main function to check if origin is allowed
 * - Checks local network patterns first (in development)
 * - Then checks against allowed list patterns
 *
 * Parameters:
 * - origin (string): Origin URL to validate
 * - allowedList (string[]): Array of allowed origin patterns
 *
 * Returns:
 * - boolean: True if origin is allowed, false otherwise
 */
function originAllowed(origin: string, allowedList: string[]): boolean {
  const host = hostnameOf(origin);

  if (isLocalNetworkHost(host)) {
    return true;
  }

  for (const allowedPattern of allowedList) {
    if (!allowedPattern) {
      continue;
    }

    if (matchesAllowedPattern(origin, host, allowedPattern)) {
      return true;
    }
  }

  return false;
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
// Export is in Core Logic section
