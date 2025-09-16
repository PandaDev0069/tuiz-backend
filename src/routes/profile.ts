// src/routes/profile.ts
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const UpdateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

const UpdateDisplayNameSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters'),
});

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

// Configure multer for avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (same as database constraint)
  },
  fileFilter: (_req, file, cb) => {
    // Only allow image files
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});

// Extend the request type to include file
interface MulterRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract storage path from Supabase storage URL
 */
function extractStoragePathFromUrl(imageUrl: string): string | null {
  if (!imageUrl) return null;

  // Extract path from Supabase storage URL
  // URL format: https://[project].supabase.co/storage/v1/object/public/avatars/[path]
  const match = imageUrl.match(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/avatars\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Clean up old avatar before uploading new one
 */
async function cleanupOldAvatar(userId: string): Promise<void> {
  try {
    // Get current avatar URL
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (error || !profile?.avatar_url) {
      return; // No existing avatar to clean up
    }

    // Extract storage path and delete old avatar
    const oldAvatarPath = extractStoragePathFromUrl(profile.avatar_url);
    if (oldAvatarPath) {
      const { error: deleteError } = await supabaseAdmin.storage
        .from('avatars')
        .remove([oldAvatarPath]);

      if (deleteError) {
        logger.error({ error: deleteError, userId, oldAvatarPath }, 'Error deleting old avatar');
        // Don't fail the request if cleanup fails
      } else {
        logger.info({ userId, oldAvatarPath }, 'Old avatar deleted successfully');
      }
    }
  } catch (error) {
    logger.error({ error, userId }, 'Exception during old avatar cleanup');
    // Don't fail the request if cleanup fails
  }
}

// ============================================================================
// PROFILE ROUTES
// ============================================================================

/**
 * GET /profile
 * Get current user's profile
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('username, display_name, avatar_url, role, created_at, updated_at, last_active')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      logger.error({ error, userId }, 'Error fetching user profile');
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Profile not found',
      });
    }

    logger.info({ userId }, 'Profile fetched successfully');

    res.json({
      id: userId,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      role: profile.role,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      lastActive: profile.last_active,
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error fetching profile');
    res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
    });
  }
});

/**
 * PUT /profile/username
 * Update user's username
 */
router.put('/username', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // Validate request body
    const validation = UpdateUsernameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid username format',
        details: validation.error.issues,
      });
    }

    const { username } = validation.data;

    // Check if username is already taken
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is what we want
      logger.error({ error: checkError, userId, username }, 'Error checking username availability');
      return res.status(500).json({
        error: 'server_error',
        message: 'Failed to check username availability',
      });
    }

    if (existingProfile) {
      return res.status(409).json({
        error: 'username_taken',
        message: 'Username is already taken',
      });
    }

    // Update username
    const { data, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        username,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('username, updated_at')
      .single();

    if (updateError) {
      logger.error({ error: updateError, userId, username }, 'Error updating username');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to update username',
      });
    }

    logger.info({ userId, username }, 'Username updated successfully');

    res.json({
      username: data.username,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error updating username');
    res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
    });
  }
});

/**
 * PUT /profile/display-name
 * Update user's display name
 */
router.put('/display-name', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // Validate request body
    const validation = UpdateDisplayNameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid display name format',
        details: validation.error.issues,
      });
    }

    const { displayName } = validation.data;

    // Update display name
    const { data, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('display_name, updated_at')
      .single();

    if (updateError) {
      logger.error({ error: updateError, userId, displayName }, 'Error updating display name');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to update display name',
      });
    }

    logger.info({ userId, displayName }, 'Display name updated successfully');

    res.json({
      displayName: data.display_name,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error updating display name');
    res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
    });
  }
});

/**
 * POST /profile/avatar
 * Upload user's avatar
 */
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req: MulterRequest, res) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: 'no_file',
        message: 'No file provided',
      });
    }

    // Clean up old avatar first
    await cleanupOldAvatar(userId);

    // Generate file path using database function
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${timestamp}-${randomString}.${extension}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      logger.error({ error: uploadError, filePath, userId }, 'Failed to upload avatar');
      return res.status(500).json({
        error: 'upload_failed',
        message: 'Failed to upload avatar',
      });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(uploadData.path);

    // Update profile with avatar URL
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        avatar_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      logger.error({ error: updateError, userId }, 'Failed to update profile with avatar URL');
      // Don't fail the request - the upload succeeded
      logger.warn('Avatar upload succeeded but failed to update profile record');
    }

    logger.info({ userId, filePath }, 'Avatar uploaded successfully');

    res.status(200).json({
      url: urlData.publicUrl,
      path: uploadData.path,
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error uploading avatar');
    res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
    });
  }
});

/**
 * DELETE /profile/avatar
 * Delete user's avatar
 */
router.delete('/avatar', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get current avatar URL
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      logger.error({ error: fetchError, userId }, 'Error fetching profile for avatar deletion');
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Profile not found',
      });
    }

    if (!profile.avatar_url) {
      return res.status(404).json({
        error: 'no_avatar',
        message: 'No avatar to delete',
      });
    }

    // Extract storage path and delete avatar from storage
    const avatarPath = extractStoragePathFromUrl(profile.avatar_url);
    if (avatarPath) {
      const { error: deleteError } = await supabaseAdmin.storage
        .from('avatars')
        .remove([avatarPath]);

      if (deleteError) {
        logger.error(
          { error: deleteError, userId, avatarPath },
          'Error deleting avatar from storage',
        );
        // Continue with profile update even if storage deletion fails
      } else {
        logger.info({ userId, avatarPath }, 'Avatar deleted from storage');
      }
    }

    // Remove avatar URL from profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      logger.error({ error: updateError, userId }, 'Error removing avatar URL from profile');
      return res.status(500).json({
        error: 'update_failed',
        message: 'Failed to remove avatar from profile',
      });
    }

    logger.info({ userId }, 'Avatar deleted successfully');

    res.status(200).json({
      message: 'Avatar deleted successfully',
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Error deleting avatar');
    res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
    });
  }
});

export default router;
