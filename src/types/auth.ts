// src/types/auth.ts
import { Request } from 'express';

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
