// ====================================================
// File Name   : rateLimit.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-10
// Last Update : 2025-12-11

// Description:
// - Rate limiting middleware for API endpoints
// - Prevents abuse and ensures fair usage of resources
// - Uses express-rate-limit for implementation
// - Provides multiple rate limit configurations for different endpoint types

// Notes:
// - Different rate limits for different operation types
// - Custom handler logs rate limit violations
// - Factory function for creating custom rate limiters
// - Standard headers enabled, legacy headers disabled
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Request, Response, NextFunction } from 'express';
// eslint-disable-next-line import/no-named-as-default
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

const MINUTES_TO_MILLISECONDS = 60 * 1000;
const WINDOW_15_MINUTES_MS = 15 * MINUTES_TO_MILLISECONDS;
const WINDOW_5_MINUTES_MS = 5 * MINUTES_TO_MILLISECONDS;

const MAX_REQUESTS_GENERAL = 100;
const MAX_REQUESTS_STRICT = 10;
const MAX_REQUESTS_AUTH = 5;
const MAX_REQUESTS_ANSWER = 20;
const MAX_REQUESTS_QUIZ = 30;
const MAX_REQUESTS_QUESTION = 25;
const MAX_REQUESTS_GAME_FLOW = 200;
const MAX_REQUESTS_WEBSOCKET_QUERY = 50;
const MAX_REQUESTS_DEVICE_SESSION = 40;

const ERROR_CODE_RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded';

const ERROR_MESSAGES = {
  TOO_MANY_REQUESTS_GENERAL: 'Too many requests from this IP, please try again later.',
  TOO_MANY_AUTH_ATTEMPTS: 'Too many authentication attempts, please try again later.',
  TOO_MANY_ANSWER_OPERATIONS: 'Too many answer operations, please try again later.',
  TOO_MANY_QUIZ_OPERATIONS: 'Too many quiz operations, please try again later.',
  TOO_MANY_QUESTION_OPERATIONS: 'Too many question operations, please try again later.',
  TOO_MANY_GAME_FLOW_OPERATIONS: 'Too many game flow operations, please slow down.',
  TOO_MANY_WEBSOCKET_QUERIES: 'Too many WebSocket connection queries, please try again later.',
  TOO_MANY_DEVICE_SESSION_OPERATIONS: 'Too many device session operations, please try again later.',
  TOO_MANY_REQUESTS_DEFAULT: 'Too many requests, please try again later.',
} as const;

const LOG_MESSAGES = {
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
} as const;

const HEADER_USER_AGENT = 'User-Agent';

const RATE_LIMIT_CONFIG = {
  general: {
    windowMs: WINDOW_15_MINUTES_MS,
    max: MAX_REQUESTS_GENERAL,
    message: {
      error: ERROR_CODE_RATE_LIMIT_EXCEEDED,
      message: ERROR_MESSAGES.TOO_MANY_REQUESTS_GENERAL,
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
  strict: {
    windowMs: WINDOW_15_MINUTES_MS,
    max: MAX_REQUESTS_STRICT,
    message: {
      error: ERROR_CODE_RATE_LIMIT_EXCEEDED,
      message: ERROR_MESSAGES.TOO_MANY_REQUESTS_GENERAL,
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
  auth: {
    windowMs: WINDOW_15_MINUTES_MS,
    max: MAX_REQUESTS_AUTH,
    message: {
      error: ERROR_CODE_RATE_LIMIT_EXCEEDED,
      message: ERROR_MESSAGES.TOO_MANY_AUTH_ATTEMPTS,
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Function: rateLimitHandler
 * Description:
 * - Custom handler for rate limit violations
 * - Logs rate limit violations with request details
 * - Returns 429 status with error message
 *
 * Parameters:
 * - req (Request): Express request object
 * - res (Response): Express response object
 * - _next (NextFunction): Express next function (unused)
 *
 * Returns:
 * - void: Sends JSON response and does not call next
 */
const rateLimitHandler = (req: Request, res: Response, _next: NextFunction): void => {
  logger.warn(
    {
      ip: req.ip,
      userAgent: req.get(HEADER_USER_AGENT),
      path: req.path,
      method: req.method,
    },
    LOG_MESSAGES.RATE_LIMIT_EXCEEDED,
  );

  res.status(HTTP_STATUS_TOO_MANY_REQUESTS).json({
    error: ERROR_CODE_RATE_LIMIT_EXCEEDED,
    message: ERROR_MESSAGES.TOO_MANY_REQUESTS_GENERAL,
  });
};

/**
 * Function: createRateLimit
 * Description:
 * - Factory function for creating custom rate limiters
 * - Configures rate limiter with provided settings
 * - Uses standard headers and custom handler
 *
 * Parameters:
 * - config (RateLimitConfig): Rate limit configuration
 *   - windowMs (number): Time window in milliseconds
 *   - max (number): Maximum number of requests per window
 *   - message (string, optional): Custom error message
 *
 * Returns:
 * - RateLimit: Configured rate limiter middleware
 */
export const createRateLimit = (config: RateLimitConfig) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: ERROR_CODE_RATE_LIMIT_EXCEEDED,
      message: config.message || ERROR_MESSAGES.TOO_MANY_REQUESTS_DEFAULT,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
};

/**
 * Rate Limiter: generalRateLimit
 * Description:
 * - General API rate limiter
 * - 100 requests per 15 minutes per IP
 */
export const generalRateLimit = rateLimit({
  ...RATE_LIMIT_CONFIG.general,
  handler: rateLimitHandler,
});

/**
 * Rate Limiter: strictRateLimit
 * Description:
 * - Strict rate limiter for sensitive operations
 * - 10 requests per 15 minutes per IP
 */
export const strictRateLimit = rateLimit({
  ...RATE_LIMIT_CONFIG.strict,
  handler: rateLimitHandler,
});

/**
 * Rate Limiter: authRateLimit
 * Description:
 * - Rate limiter for authentication operations
 * - 5 requests per 15 minutes per IP
 */
export const authRateLimit = rateLimit({
  ...RATE_LIMIT_CONFIG.auth,
  handler: rateLimitHandler,
});

/**
 * Rate Limiter: answerRateLimit
 * Description:
 * - Rate limiter for answer operations (POST/PUT)
 * - 20 requests per 15 minutes per IP
 */
export const answerRateLimit = createRateLimit({
  windowMs: WINDOW_15_MINUTES_MS,
  max: MAX_REQUESTS_ANSWER,
  message: ERROR_MESSAGES.TOO_MANY_ANSWER_OPERATIONS,
});

/**
 * Rate Limiter: quizRateLimit
 * Description:
 * - Rate limiter for quiz operations
 * - 30 requests per 15 minutes per IP
 */
export const quizRateLimit = createRateLimit({
  windowMs: WINDOW_15_MINUTES_MS,
  max: MAX_REQUESTS_QUIZ,
  message: ERROR_MESSAGES.TOO_MANY_QUIZ_OPERATIONS,
});

/**
 * Rate Limiter: questionRateLimit
 * Description:
 * - Rate limiter for question operations
 * - 25 requests per 15 minutes per IP
 */
export const questionRateLimit = createRateLimit({
  windowMs: WINDOW_15_MINUTES_MS,
  max: MAX_REQUESTS_QUESTION,
  message: ERROR_MESSAGES.TOO_MANY_QUESTION_OPERATIONS,
});

/**
 * Rate Limiter: gameFlowRateLimit
 * Description:
 * - Rate limiter for game flow operations (real-time gameplay)
 * - 100 requests per 5 minutes per IP (high frequency for real-time)
 */
export const gameFlowRateLimit = createRateLimit({
  windowMs: WINDOW_5_MINUTES_MS,
  max: MAX_REQUESTS_GAME_FLOW,
  message: ERROR_MESSAGES.TOO_MANY_GAME_FLOW_OPERATIONS,
});

/**
 * Rate Limiter: websocketQueryRateLimit
 * Description:
 * - Rate limiter for WebSocket connection queries
 * - 50 requests per 15 minutes per IP
 */
export const websocketQueryRateLimit = createRateLimit({
  windowMs: WINDOW_15_MINUTES_MS,
  max: MAX_REQUESTS_WEBSOCKET_QUERY,
  message: ERROR_MESSAGES.TOO_MANY_WEBSOCKET_QUERIES,
});

/**
 * Rate Limiter: deviceSessionRateLimit
 * Description:
 * - Rate limiter for device session operations
 * - 40 requests per 15 minutes per IP
 */
export const deviceSessionRateLimit = createRateLimit({
  windowMs: WINDOW_15_MINUTES_MS,
  max: MAX_REQUESTS_DEVICE_SESSION,
  message: ERROR_MESSAGES.TOO_MANY_DEVICE_SESSION_OPERATIONS,
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
// No additional helper functions - all logic in Core Logic section

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
// All exports are in Core Logic section
