// ====================================================
// File Name   : error.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2025-08-19

// Description:
// - Global error handling middleware for Express
// - Catches unhandled errors and formats error responses
// - Logs errors with request context
// - Provides consistent error response format

// Notes:
// - Must be registered as the last middleware
// - Handles both application errors and unexpected errors
// - Includes request ID in error responses for tracing
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const HEADER_REQUEST_ID = 'x-request-id';

const ERROR_CODES = {
  SERVER_ERROR: 'server_error',
  DEFAULT_ERROR: 'error',
} as const;

const LOG_MESSAGES = {
  UNHANDLED_ERROR: 'unhandled_error',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Middleware: errorMw
 * Description:
 * - Global error handler for Express application
 * - Catches all unhandled errors
 * - Formats error responses with appropriate status codes
 * - Logs errors with request context
 *
 * Parameters:
 * - err (Error): The error object
 * - _req (Request): Express request object (unused)
 * - res (Response): Express response object
 * - _next (NextFunction): Express next function (unused)
 *
 * Returns:
 * - void: Sends error response
 */
export const errorMw: ErrorRequestHandler = (err, _req, res, _next) => {
  const appError = err as AppError;
  const status = appError.statusCode ?? HTTP_STATUS_INTERNAL_SERVER_ERROR;
  const requestId = (res.getHeader(HEADER_REQUEST_ID) as string) || undefined;

  logger.error({ err, requestId }, LOG_MESSAGES.UNHANDLED_ERROR);

  res.status(status).json({
    error:
      status === HTTP_STATUS_INTERNAL_SERVER_ERROR
        ? ERROR_CODES.SERVER_ERROR
        : (appError.code ?? ERROR_CODES.DEFAULT_ERROR),
    message: appError.message,
    requestId,
  });
};

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
// No helper functions - all logic in Core Logic section

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
// Export is in Core Logic section
