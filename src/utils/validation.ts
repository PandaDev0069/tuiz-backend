// ====================================================
// File Name   : validation.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-22
// Last Update : 2025-08-22

// Description:
// - Zod validation schemas for authentication endpoints
// - Enforces data integrity and domain rules for user input
// - Type-safe validation with automatic type inference

// Notes:
// - RegisterSchema: Optional username/displayName with format constraints
// - LoginSchema: Email/password with optional rememberMe flag
// - Inferred types exported for use in route handlers
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_REQUIRED_MIN_LENGTH = 1;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const DISPLAY_NAME_MIN_LENGTH = 1;
const DISPLAY_NAME_MAX_LENGTH = 50;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

const ERROR_MESSAGES = {
  INVALID_EMAIL_FORMAT: 'Invalid email format',
  PASSWORD_MIN_LENGTH: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  PASSWORD_REQUIRED: 'Password is required',
  USERNAME_MIN_LENGTH: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
  USERNAME_MAX_LENGTH: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
  USERNAME_PATTERN: 'Username can only contain letters, numbers, and underscores',
  DISPLAY_NAME_REQUIRED: 'Display name is required',
  DISPLAY_NAME_MAX_LENGTH: `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
} as const;

//----------------------------------------------------
// 3. Core Logic
//----------------------------------------------------
export const RegisterSchema = z.object({
  email: z.string().email(ERROR_MESSAGES.INVALID_EMAIL_FORMAT),
  password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_MESSAGES.PASSWORD_MIN_LENGTH),
  username: z
    .string()
    .min(USERNAME_MIN_LENGTH, ERROR_MESSAGES.USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH, ERROR_MESSAGES.USERNAME_MAX_LENGTH)
    .regex(USERNAME_PATTERN, ERROR_MESSAGES.USERNAME_PATTERN)
    .optional(),
  displayName: z
    .string()
    .min(DISPLAY_NAME_MIN_LENGTH, ERROR_MESSAGES.DISPLAY_NAME_REQUIRED)
    .max(DISPLAY_NAME_MAX_LENGTH, ERROR_MESSAGES.DISPLAY_NAME_MAX_LENGTH)
    .optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(ERROR_MESSAGES.INVALID_EMAIL_FORMAT),
  password: z.string().min(PASSWORD_REQUIRED_MIN_LENGTH, ERROR_MESSAGES.PASSWORD_REQUIRED),
  rememberMe: z.boolean().optional(),
});

export type RegisterData = z.infer<typeof RegisterSchema>;
export type LoginData = z.infer<typeof LoginSchema>;
