// src/middleware/error.ts
import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorMw: ErrorRequestHandler = (err, _req, res, _next) => {
  const appError = err as AppError;
  const status = appError.statusCode ?? 500;
  const requestId = res.getHeader('x-request-id') || undefined;

  logger.error({ err, requestId }, 'unhandled_error');

  res.status(status).json({
    error: status === 500 ? 'server_error' : (appError.code ?? 'error'),
    message: appError.message,
    requestId,
  });
};
