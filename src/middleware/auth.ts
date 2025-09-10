// src/middleware/auth.ts
import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'No valid session token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    // Use Supabase's built-in JWT verification
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.debug({ error }, 'JWT verification failed');
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid or expired token',
      });
    }

    // Inject user context into request
    req.user = {
      id: user.id,
      email: user.email!,
      username: user.user_metadata?.username,
      displayName: user.user_metadata?.display_name,
    };

    next();
  } catch (error) {
    logger.error({ error }, 'Authentication middleware error');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    });
  }
}
