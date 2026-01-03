// ====================================================
// File Name   : profile.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-16
// Last Update : 2025-09-16

// Description:
// - Express routes for user profile management
// - Handles profile retrieval, username/display name updates, and avatar uploads/deletion
// - Validates user input and manages file uploads to Supabase Storage

// Notes:
// - All routes require authentication via authMiddleware
// - Avatar uploads are limited to 5MB and specific image types
// - Old avatars are automatically cleaned up when new ones are uploaded
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const TABLE_PROFILES = 'profiles';
const STORAGE_BUCKET_AVATARS = 'avatars';

const COLUMN_ID = 'id';
const COLUMN_USERNAME = 'username';
const SELECT_PROFILE_FIELDS =
  'username, display_name, avatar_url, role, created_at, updated_at, last_active';
const SELECT_AVATAR_URL = 'avatar_url';
const SELECT_ID = 'id';
const SELECT_USERNAME_UPDATED_AT = 'username, updated_at';
const SELECT_DISPLAY_NAME_UPDATED_AT = 'display_name, updated_at';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const DISPLAY_NAME_MIN_LENGTH = 1;
const DISPLAY_NAME_MAX_LENGTH = 50;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const RANDOM_STRING_START = 2;
const RANDOM_STRING_END = 15;
const CACHE_CONTROL_SECONDS = '3600';
const DEFAULT_FILE_EXTENSION = 'jpg';
const FILE_FIELD_NAME = 'avatar';

const SUPABASE_ERROR_CODE_NOT_FOUND = 'PGRST116';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const STORAGE_URL_REGEX = /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/avatars\/(.+)$/;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const ERROR_CODES = {
  PROFILE_NOT_FOUND: 'profile_not_found',
  VALIDATION_ERROR: 'validation_error',
  USERNAME_TAKEN: 'username_taken',
  SERVER_ERROR: 'server_error',
  UPDATE_FAILED: 'update_failed',
  NO_FILE: 'no_file',
  UPLOAD_FAILED: 'upload_failed',
  NO_AVATAR: 'no_avatar',
} as const;

const ERROR_MESSAGES = {
  PROFILE_NOT_FOUND: 'Profile not found',
  INVALID_USERNAME_FORMAT: 'Invalid username format',
  INVALID_DISPLAY_NAME_FORMAT: 'Invalid display name format',
  USERNAME_ALREADY_TAKEN: 'Username is already taken',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  FAILED_TO_CHECK_USERNAME_AVAILABILITY: 'Failed to check username availability',
  FAILED_TO_UPDATE_USERNAME: 'Failed to update username',
  FAILED_TO_UPDATE_DISPLAY_NAME: 'Failed to update display name',
  NO_FILE_PROVIDED: 'No file provided',
  FAILED_TO_UPLOAD_AVATAR: 'Failed to upload avatar',
  FAILED_TO_UPDATE_PROFILE_WITH_AVATAR_URL: 'Failed to update profile with avatar URL',
  AVATAR_UPLOAD_SUCCEEDED_BUT_FAILED_TO_UPDATE_PROFILE:
    'Avatar upload succeeded but failed to update profile record',
  ERROR_FETCHING_PROFILE_FOR_AVATAR_DELETION: 'Error fetching profile for avatar deletion',
  NO_AVATAR_TO_DELETE: 'No avatar to delete',
  FAILED_TO_REMOVE_AVATAR_FROM_PROFILE: 'Failed to remove avatar from profile',
  INVALID_FILE_TYPE: 'Invalid file type. Only images are allowed.',
} as const;

const VALIDATION_MESSAGES = {
  USERNAME_MIN_LENGTH: 'Username must be at least 3 characters',
  USERNAME_MAX_LENGTH: 'Username must be at most 20 characters',
  USERNAME_REGEX: 'Username can only contain letters, numbers, and underscores',
  DISPLAY_NAME_REQUIRED: 'Display name is required',
  DISPLAY_NAME_MAX_LENGTH: 'Display name must be at most 50 characters',
} as const;

const SUCCESS_MESSAGES = {
  AVATAR_DELETED_SUCCESSFULLY: 'Avatar deleted successfully',
} as const;

const LOG_MESSAGES = {
  ERROR_FETCHING_USER_PROFILE: 'Error fetching user profile',
  PROFILE_FETCHED_SUCCESSFULLY: 'Profile fetched successfully',
  ERROR_FETCHING_PROFILE: 'Error fetching profile',
  ERROR_CHECKING_USERNAME_AVAILABILITY: 'Error checking username availability',
  USERNAME_UPDATED_SUCCESSFULLY: 'Username updated successfully',
  ERROR_UPDATING_USERNAME: 'Error updating username',
  ERROR_UPDATING_USERNAME_GENERAL: 'Error updating username',
  DISPLAY_NAME_UPDATED_SUCCESSFULLY: 'Display name updated successfully',
  ERROR_UPDATING_DISPLAY_NAME: 'Error updating display name',
  ERROR_UPDATING_DISPLAY_NAME_GENERAL: 'Error updating display name',
  FAILED_TO_UPLOAD_AVATAR: 'Failed to upload avatar',
  AVATAR_UPLOADED_SUCCESSFULLY: 'Avatar uploaded successfully',
  ERROR_UPLOADING_AVATAR: 'Error uploading avatar',
  ERROR_FETCHING_PROFILE_FOR_AVATAR_DELETION: 'Error fetching profile for avatar deletion',
  ERROR_DELETING_AVATAR_FROM_STORAGE: 'Error deleting avatar from storage',
  AVATAR_DELETED_FROM_STORAGE: 'Avatar deleted from storage',
  ERROR_REMOVING_AVATAR_URL_FROM_PROFILE: 'Error removing avatar URL from profile',
  AVATAR_DELETED_SUCCESSFULLY: 'Avatar deleted successfully',
  ERROR_DELETING_AVATAR: 'Error deleting avatar',
  ERROR_DELETING_OLD_AVATAR: 'Error deleting old avatar',
  OLD_AVATAR_DELETED_SUCCESSFULLY: 'Old avatar deleted successfully',
  EXCEPTION_DURING_OLD_AVATAR_CLEANUP: 'Exception during old avatar cleanup',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
interface MulterRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

const UpdateUsernameSchema = z.object({
  username: z
    .string()
    .min(USERNAME_MIN_LENGTH, VALIDATION_MESSAGES.USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH, VALIDATION_MESSAGES.USERNAME_MAX_LENGTH)
    .regex(USERNAME_REGEX, VALIDATION_MESSAGES.USERNAME_REGEX),
});

const UpdateDisplayNameSchema = z.object({
  displayName: z
    .string()
    .min(DISPLAY_NAME_MIN_LENGTH, VALIDATION_MESSAGES.DISPLAY_NAME_REQUIRED)
    .max(DISPLAY_NAME_MAX_LENGTH, VALIDATION_MESSAGES.DISPLAY_NAME_MAX_LENGTH),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(null, true);
    } else {
      cb(new Error(ERROR_MESSAGES.INVALID_FILE_TYPE));
    }
  },
});

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = Router();

/**
 * Route: GET /
 * Description:
 * - Get current authenticated user's profile
 * - Returns profile information including username, display name, avatar, and metadata
 *
 * Parameters:
 * - None (uses authenticated user from middleware)
 *
 * Returns:
 * - JSON response with user profile data
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const { data: profile, error } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .select(SELECT_PROFILE_FIELDS)
      .eq(COLUMN_ID, userId)
      .single();

    if (error || !profile) {
      logger.error({ error, userId }, LOG_MESSAGES.ERROR_FETCHING_USER_PROFILE);
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.PROFILE_NOT_FOUND,
        message: ERROR_MESSAGES.PROFILE_NOT_FOUND,
      });
    }

    logger.info({ userId }, LOG_MESSAGES.PROFILE_FETCHED_SUCCESSFULLY);

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
    logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.ERROR_FETCHING_PROFILE);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
});

/**
 * Route: PUT /username
 * Description:
 * - Update user's username
 * - Validates username format and checks for uniqueness
 *
 * Parameters:
 * - req.body.username: New username (validated by UpdateUsernameSchema)
 *
 * Returns:
 * - JSON response with updated username and timestamp
 */
router.put('/username', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const validation = UpdateUsernameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.INVALID_USERNAME_FORMAT,
        details: validation.error.issues,
      });
    }

    const { username } = validation.data;

    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .select(SELECT_ID)
      .eq(COLUMN_USERNAME, username)
      .neq(COLUMN_ID, userId)
      .single();

    if (checkError && checkError.code !== SUPABASE_ERROR_CODE_NOT_FOUND) {
      logger.error(
        { error: checkError, userId, username },
        LOG_MESSAGES.ERROR_CHECKING_USERNAME_AVAILABILITY,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.FAILED_TO_CHECK_USERNAME_AVAILABILITY,
      });
    }

    if (existingProfile) {
      return res.status(HTTP_STATUS_CONFLICT).json({
        error: ERROR_CODES.USERNAME_TAKEN,
        message: ERROR_MESSAGES.USERNAME_ALREADY_TAKEN,
      });
    }

    const { data, error: updateError } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .update({
        username,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, userId)
      .select(SELECT_USERNAME_UPDATED_AT)
      .single();

    if (updateError) {
      logger.error({ error: updateError, userId, username }, LOG_MESSAGES.ERROR_UPDATING_USERNAME);
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UPDATE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_UPDATE_USERNAME,
      });
    }

    logger.info({ userId, username }, LOG_MESSAGES.USERNAME_UPDATED_SUCCESSFULLY);

    res.json({
      username: data.username,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.ERROR_UPDATING_USERNAME_GENERAL);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
});

/**
 * Route: PUT /display-name
 * Description:
 * - Update user's display name
 * - Validates display name format
 *
 * Parameters:
 * - req.body.displayName: New display name (validated by UpdateDisplayNameSchema)
 *
 * Returns:
 * - JSON response with updated display name and timestamp
 */
router.put('/display-name', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const validation = UpdateDisplayNameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.INVALID_DISPLAY_NAME_FORMAT,
        details: validation.error.issues,
      });
    }

    const { displayName } = validation.data;

    const { data, error: updateError } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .update({
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, userId)
      .select(SELECT_DISPLAY_NAME_UPDATED_AT)
      .single();

    if (updateError) {
      logger.error(
        { error: updateError, userId, displayName },
        LOG_MESSAGES.ERROR_UPDATING_DISPLAY_NAME,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UPDATE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_UPDATE_DISPLAY_NAME,
      });
    }

    logger.info({ userId, displayName }, LOG_MESSAGES.DISPLAY_NAME_UPDATED_SUCCESSFULLY);

    res.json({
      displayName: data.display_name,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.ERROR_UPDATING_DISPLAY_NAME_GENERAL);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
});

/**
 * Route: POST /avatar
 * Description:
 * - Upload user's avatar image
 * - Cleans up old avatar before uploading new one
 * - Uploads to Supabase Storage and updates profile
 *
 * Parameters:
 * - req.file: Avatar image file (via multer middleware)
 *
 * Returns:
 * - JSON response with avatar URL and storage path
 */
router.post(
  '/avatar',
  authMiddleware,
  upload.single(FILE_FIELD_NAME),
  async (req: MulterRequest, res) => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: ERROR_CODES.NO_FILE,
          message: ERROR_MESSAGES.NO_FILE_PROVIDED,
        });
      }

      await cleanupOldAvatar(userId);

      const timestamp = Date.now();
      const randomString = Math.random()
        .toString(36)
        .substring(RANDOM_STRING_START, RANDOM_STRING_END);
      const extension = file.originalname.split('.').pop()?.toLowerCase() || DEFAULT_FILE_EXTENSION;
      const fileName = `${timestamp}-${randomString}.${extension}`;
      const filePath = `${userId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_AVATARS)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: CACHE_CONTROL_SECONDS,
          upsert: false,
        });

      if (uploadError) {
        logger.error(
          { error: uploadError, filePath, userId },
          LOG_MESSAGES.FAILED_TO_UPLOAD_AVATAR,
        );
        return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          error: ERROR_CODES.UPLOAD_FAILED,
          message: ERROR_MESSAGES.FAILED_TO_UPLOAD_AVATAR,
        });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET_AVATARS)
        .getPublicUrl(uploadData.path);

      const { error: updateError } = await supabaseAdmin
        .from(TABLE_PROFILES)
        .update({
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq(COLUMN_ID, userId);

      if (updateError) {
        logger.error(
          { error: updateError, userId },
          ERROR_MESSAGES.FAILED_TO_UPDATE_PROFILE_WITH_AVATAR_URL,
        );
        logger.warn(ERROR_MESSAGES.AVATAR_UPLOAD_SUCCEEDED_BUT_FAILED_TO_UPDATE_PROFILE);
      }

      logger.info({ userId, filePath }, LOG_MESSAGES.AVATAR_UPLOADED_SUCCESSFULLY);

      res.status(HTTP_STATUS_OK).json({
        url: urlData.publicUrl,
        path: uploadData.path,
      });
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.ERROR_UPLOADING_AVATAR);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      });
    }
  },
);

/**
 * Route: DELETE /avatar
 * Description:
 * - Delete user's avatar
 * - Removes avatar from storage and updates profile
 *
 * Parameters:
 * - None (uses authenticated user from middleware)
 *
 * Returns:
 * - JSON response with success message
 */
router.delete('/avatar', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .select(SELECT_AVATAR_URL)
      .eq(COLUMN_ID, userId)
      .single();

    if (fetchError || !profile) {
      logger.error(
        { error: fetchError, userId },
        LOG_MESSAGES.ERROR_FETCHING_PROFILE_FOR_AVATAR_DELETION,
      );
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.PROFILE_NOT_FOUND,
        message: ERROR_MESSAGES.PROFILE_NOT_FOUND,
      });
    }

    if (!profile.avatar_url) {
      return res.status(HTTP_STATUS_NOT_FOUND).json({
        error: ERROR_CODES.NO_AVATAR,
        message: ERROR_MESSAGES.NO_AVATAR_TO_DELETE,
      });
    }

    const avatarPath = extractStoragePathFromUrl(profile.avatar_url);
    if (avatarPath) {
      const { error: deleteError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_AVATARS)
        .remove([avatarPath]);

      if (deleteError) {
        logger.error(
          { error: deleteError, userId, avatarPath },
          LOG_MESSAGES.ERROR_DELETING_AVATAR_FROM_STORAGE,
        );
      } else {
        logger.info({ userId, avatarPath }, LOG_MESSAGES.AVATAR_DELETED_FROM_STORAGE);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq(COLUMN_ID, userId);

    if (updateError) {
      logger.error(
        { error: updateError, userId },
        LOG_MESSAGES.ERROR_REMOVING_AVATAR_URL_FROM_PROFILE,
      );
      return res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.UPDATE_FAILED,
        message: ERROR_MESSAGES.FAILED_TO_REMOVE_AVATAR_FROM_PROFILE,
      });
    }

    logger.info({ userId }, LOG_MESSAGES.AVATAR_DELETED_SUCCESSFULLY);

    res.status(HTTP_STATUS_OK).json({
      message: SUCCESS_MESSAGES.AVATAR_DELETED_SUCCESSFULLY,
    });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.ERROR_DELETING_AVATAR);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: extractStoragePathFromUrl
 * Description:
 * - Extract storage path from Supabase storage URL
 * - Parses URL format to extract the file path
 *
 * Parameters:
 * - imageUrl (string): Full Supabase storage URL
 *
 * Returns:
 * - string | null: Extracted storage path or null if URL is invalid
 */
function extractStoragePathFromUrl(imageUrl: string): string | null {
  if (!imageUrl) return null;

  const match = imageUrl.match(STORAGE_URL_REGEX);
  return match ? match[1] : null;
}

/**
 * Function: cleanupOldAvatar
 * Description:
 * - Clean up old avatar before uploading new one
 * - Fetches current avatar URL and deletes it from storage
 *
 * Parameters:
 * - userId (string): User identifier
 *
 * Returns:
 * - void: No return value
 */
async function cleanupOldAvatar(userId: string): Promise<void> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from(TABLE_PROFILES)
      .select(SELECT_AVATAR_URL)
      .eq(COLUMN_ID, userId)
      .single();

    if (error || !profile?.avatar_url) {
      return;
    }

    const oldAvatarPath = extractStoragePathFromUrl(profile.avatar_url);
    if (oldAvatarPath) {
      const { error: deleteError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_AVATARS)
        .remove([oldAvatarPath]);

      if (deleteError) {
        logger.error(
          { error: deleteError, userId, oldAvatarPath },
          LOG_MESSAGES.ERROR_DELETING_OLD_AVATAR,
        );
      } else {
        logger.info({ userId, oldAvatarPath }, LOG_MESSAGES.OLD_AVATAR_DELETED_SUCCESSFULLY);
      }
    }
  } catch (error) {
    logger.error({ error, userId }, LOG_MESSAGES.EXCEPTION_DURING_OLD_AVATAR_CLEANUP);
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
