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
// 2. Logger Configuration
//----------------------------------------------------
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  },
});
