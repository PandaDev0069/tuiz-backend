// ====================================================
// File Name   : logger.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2025-08-19

// Description:
// - Pino logger instance with pretty printing for development
// - Structured logging with configurable log levels
// - Colorized output with timestamp formatting

// Notes:
// - Log level controlled via LOG_LEVEL environment variable
// - Pretty printing enabled for better readability
// - Timestamp format: SYS:standard for consistent output
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import pino from 'pino';

import { env } from '../config/env';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const PINO_PRETTY_TARGET = 'pino-pretty';
const TIMESTAMP_FORMAT = 'SYS:standard';

const PRETTY_PRINT_OPTIONS = {
  colorize: true,
  translateTime: TIMESTAMP_FORMAT,
} as const;

//----------------------------------------------------
// 3. Core Logic
//----------------------------------------------------
/**
 * Logger: logger
 * Description:
 * - Pino logger instance configured for development and production use
 * - Provides structured logging with configurable log levels
 * - Pretty printing enabled for better readability during development
 * - Colorized output with standardized timestamp formatting
 * - Log level controlled via LOG_LEVEL environment variable
 *
 * @example
 * ```typescript
 * logger.info('Application started');
 * logger.error({ error }, 'Operation failed');
 * logger.debug({ data }, 'Debug information');
 * ```
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: PINO_PRETTY_TARGET,
    options: PRETTY_PRINT_OPTIONS,
  },
});
