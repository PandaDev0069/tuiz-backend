// ====================================================
// File Name   : auth.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-14
// Last Update : 2025-08-22

// Description:
// - Authentication type definitions for user registration and login
// - Extended Express Request interface for authenticated routes
// - Session management types with JWT tokens

// Notes:
// - AuthenticatedRequest adds user and validatedQuery to Express Request
// - Session tokens expire based on expires_in and expires_at fields
// - Username and displayName are optional for flexibility
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Request } from 'express';

//----------------------------------------------------
// 2. Core Interfaces
//----------------------------------------------------
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username?: string;
    displayName?: string;
  };
  validatedQuery?: Record<string, string | string[] | undefined>;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username?: string;
    displayName?: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
  };
}

export interface AuthError {
  error: string;
  message: string;
  code?: string;
}
