/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting for API endpoints to prevent abuse and ensure
 * fair usage of resources. Uses express-rate-limit for implementation.
 */

import { Request, Response, NextFunction } from 'express';
// eslint-disable-next-line import/no-named-as-default
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  // General API rate limit
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Strict rate limit for sensitive operations
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Auth operations rate limit
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 auth requests per windowMs
    message: {
      error: 'rate_limit_exceeded',
      message: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
};

// Custom rate limit handler
const rateLimitHandler = (req: Request, res: Response, _next: NextFunction) => {
  logger.warn(
    {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
    },
    'Rate limit exceeded',
  );

  res.status(429).json({
    error: 'rate_limit_exceeded',
    message: 'Too many requests from this IP, please try again later.',
  });
};

// General rate limiter
export const generalRateLimit = rateLimit({
  ...RATE_LIMIT_CONFIG.general,
  handler: rateLimitHandler,
});

// Strict rate limiter for sensitive operations
export const strictRateLimit = rateLimit({
  ...RATE_LIMIT_CONFIG.strict,
  handler: rateLimitHandler,
});

// Auth rate limiter
export const authRateLimit = rateLimit({
  ...RATE_LIMIT_CONFIG.auth,
  handler: rateLimitHandler,
});

// Custom rate limiter for specific endpoints
export const createRateLimit = (config: { windowMs: number; max: number; message?: string }) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: 'rate_limit_exceeded',
      message: config.message || 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
};

// Rate limiter for answer operations (POST/PUT)
export const answerRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 answer operations per windowMs
  message: 'Too many answer operations, please try again later.',
});

// Rate limiter for quiz operations
export const quizRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 quiz operations per windowMs
  message: 'Too many quiz operations, please try again later.',
});

// Rate limiter for question operations
export const questionRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Limit each IP to 25 question operations per windowMs
  message: 'Too many question operations, please try again later.',
});
