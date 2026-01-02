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
// 2. Validation Schemas
//----------------------------------------------------
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

//----------------------------------------------------
// 3. Type Exports
//----------------------------------------------------
export type RegisterData = z.infer<typeof RegisterSchema>;
export type LoginData = z.infer<typeof LoginSchema>;
