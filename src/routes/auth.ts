// src/routes/auth.ts
import express from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase';
import type { AuthResponse, AuthError } from '../types/auth';
import { logger } from '../utils/logger';
import { RegisterSchema, LoginSchema } from '../utils/validation';

const router = express.Router();

// Helper function to get user profile data
async function getUserProfile(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('username, display_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.error({ error, userId }, 'Error fetching user profile');
    return null;
  }

  return profile;
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    // Validate request body
    const validation = RegisterSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Invalid request data',
      } as AuthError);
    }

    const { email, password, username, displayName } = validation.data;

    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || null,
          display_name: displayName || username || null,
        },
      },
    });

    if (authError) {
      // Log the specific Supabase error for debugging (skip in test environment to reduce noise)
      if (process.env.NODE_ENV !== 'test') {
        logger.error(`Supabase registration error: ${authError.message}`);
      }

      // Handle specific Supabase errors
      if (authError.message.includes('already registered')) {
        return res.status(409).json({
          error: 'duplicate_email',
          message: 'An account with this email already exists',
        } as AuthError);
      }

      return res.status(400).json({
        error: 'registration_failed',
        message: 'Registration failed',
      } as AuthError);
    }

    if (!authData.user || !authData.session) {
      return res.status(400).json({
        error: 'registration_failed',
        message: 'Registration failed',
      } as AuthError);
    }

    // Get user profile data to ensure we have the complete information
    const profile = await getUserProfile(authData.user.id);

    // Return success response
    const response: AuthResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        username: profile?.username || authData.user.user_metadata?.username || null,
        displayName: profile?.display_name || authData.user.user_metadata?.display_name || null,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in || 3600,
        expires_at: authData.session.expires_at || Date.now() / 1000 + 3600,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error({ error }, 'Registration error');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as AuthError);
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    // Validate request body
    const validation = LoginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Invalid request data',
      } as AuthError);
    }

    const { email, password } = validation.data;

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Generic error message to avoid leaking information
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password',
      } as AuthError);
    }

    if (!authData.user || !authData.session) {
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password',
      } as AuthError);
    }

    // Get user profile data and update last_active
    const profile = await getUserProfile(authData.user.id);

    // Update last_active timestamp
    try {
      await supabaseAdmin.rpc('update_last_active', { user_id: authData.user.id });
    } catch (updateError) {
      logger.error({ error: updateError, userId: authData.user.id }, 'Error updating last_active');
      // Don't fail the login if we can't update last_active
    }

    // Return success response
    const response: AuthResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        username: profile?.username || authData.user.user_metadata?.username || null,
        displayName: profile?.display_name || authData.user.user_metadata?.display_name || null,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in || 3600,
        expires_at: authData.session.expires_at || Date.now() / 1000 + 3600,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'Login error');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as AuthError);
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'No valid session token provided',
      } as AuthError);
    }

    const token = authHeader.split(' ')[1];

    // Sign out the user session using admin client
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(token);

    if (signOutError) {
      // Log different levels based on error type
      if (signOutError.name === 'AuthSessionMissingError') {
        logger.debug(
          { error: signOutError },
          'Session already invalidated or missing during logout',
        );
      } else {
        logger.error({ error: signOutError }, 'Logout error');
      }
      // Don't fail the logout if Supabase signOut fails - client should clear local storage anyway
    }

    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Logout error');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    } as AuthError);
  }
});

export default router;
