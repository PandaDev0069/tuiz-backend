// ====================================================
// File Name   : upload.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-09-11
// Last Update : 2025-09-13

// Description:
// - Express routes for file upload operations
// - Handles quiz thumbnail, question image, and answer image uploads
// - Validates file types and quiz ownership before upload

// Notes:
// - All routes require authentication via authMiddleware
// - Files are uploaded to Supabase Storage
// - Only image files are allowed (JPEG, PNG, WebP, GIF)
// - Maximum file size is 10MB
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Router } from 'express';
import type { Response } from 'express';
import multer from 'multer';

import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const RANDOM_STRING_START = 2;
const RANDOM_STRING_END = 15;
const RANDOM_STRING_BASE = 36;
const DEFAULT_EXTENSION = 'jpg';
const CACHE_CONTROL_SECONDS = '3600';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_OK = 200;

const TABLE_QUIZ_SETS = 'quiz_sets';
const COLUMN_USER_ID = 'user_id';
const COLUMN_ID = 'id';
const COLUMN_THUMBNAIL_URL = 'thumbnail_url';
const STORAGE_BUCKET_QUIZ_IMAGES = 'quiz-images';

const FILE_FIELD_THUMBNAIL = 'thumbnail';
const FILE_FIELD_IMAGE = 'image';

const PATH_SEGMENT_THUMBNAILS = 'thumbnails';
const PATH_SEGMENT_QUESTIONS = 'questions';
const PATH_SEGMENT_ANSWERS = 'answers';

const ERROR_CODES = {
  NO_FILE: 'no_file',
  QUIZ_NOT_FOUND: 'quiz_not_found',
  NOT_AUTHORIZED: 'not_authorized',
  UPLOAD_FAILED: 'upload_failed',
  SERVER_ERROR: 'server_error',
} as const;

const ERROR_MESSAGES = {
  INVALID_FILE_TYPE: 'Invalid file type. Only images are allowed.',
  NO_FILE_PROVIDED: 'No file provided',
  QUIZ_NOT_FOUND: 'Quiz not found',
  NOT_AUTHORIZED_TO_UPLOAD: 'Not authorized to upload to this quiz',
  FAILED_TO_UPLOAD_IMAGE: 'Failed to upload image',
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;

const LOG_MESSAGES = {
  QUIZ_NOT_FOUND: 'Quiz not found',
  USER_NOT_AUTHORIZED: 'User not authorized to upload to this quiz',
  FAILED_TO_UPLOAD_IMAGE: 'Failed to upload image',
  FAILED_TO_UPDATE_QUIZ: 'Failed to update quiz with thumbnail URL',
  UPLOAD_SUCCEEDED_UPDATE_FAILED: 'Upload succeeded but failed to update quiz record',
  QUIZ_THUMBNAIL_UPLOADED: 'Quiz thumbnail uploaded successfully',
  QUESTION_IMAGE_UPLOADED: 'Question image uploaded successfully',
  ANSWER_IMAGE_UPLOADED: 'Answer image uploaded successfully',
  ERROR_UPLOADING_THUMBNAIL: 'Error uploading quiz thumbnail',
  ERROR_UPLOADING_QUESTION_IMAGE: 'Error uploading question image',
  ERROR_UPLOADING_ANSWER_IMAGE: 'Error uploading answer image',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
interface MulterRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

interface UploadOptions {
  updateQuizRecord?: boolean;
  pathSegment: string;
  uploadSuccessMessage: string;
  uploadErrorMessage: string;
}

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = Router();

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

/**
 * Route: POST /quiz-thumbnail/:quizId
 * Description:
 * - Upload thumbnail image for a quiz
 * - Updates quiz record with thumbnail URL after successful upload
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.file: Uploaded thumbnail file
 *
 * Returns:
 * - JSON response with public URL and file path
 */
router.post(
  '/quiz-thumbnail/:quizId',
  authMiddleware,
  upload.single(FILE_FIELD_THUMBNAIL),
  async (req: MulterRequest, res) => {
    try {
      await handleImageUpload(req, res, {
        updateQuizRecord: true,
        pathSegment: PATH_SEGMENT_THUMBNAILS,
        uploadSuccessMessage: LOG_MESSAGES.QUIZ_THUMBNAIL_UPLOADED,
        uploadErrorMessage: ERROR_MESSAGES.FAILED_TO_UPLOAD_IMAGE,
      });
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.ERROR_UPLOADING_THUMBNAIL);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      });
    }
  },
);

/**
 * Route: POST /question-image/:quizId
 * Description:
 * - Upload image for a question
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.file: Uploaded image file
 *
 * Returns:
 * - JSON response with public URL and file path
 */
router.post(
  '/question-image/:quizId',
  authMiddleware,
  upload.single(FILE_FIELD_IMAGE),
  async (req: MulterRequest, res) => {
    try {
      await handleImageUpload(req, res, {
        updateQuizRecord: false,
        pathSegment: PATH_SEGMENT_QUESTIONS,
        uploadSuccessMessage: LOG_MESSAGES.QUESTION_IMAGE_UPLOADED,
        uploadErrorMessage: ERROR_MESSAGES.FAILED_TO_UPLOAD_IMAGE,
      });
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.ERROR_UPLOADING_QUESTION_IMAGE);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      });
    }
  },
);

/**
 * Route: POST /answer-image/:quizId
 * Description:
 * - Upload image for an answer
 *
 * Parameters:
 * - req.params.quizId: Quiz identifier
 * - req.file: Uploaded image file
 *
 * Returns:
 * - JSON response with public URL and file path
 */
router.post(
  '/answer-image/:quizId',
  authMiddleware,
  upload.single(FILE_FIELD_IMAGE),
  async (req: MulterRequest, res) => {
    try {
      await handleImageUpload(req, res, {
        updateQuizRecord: false,
        pathSegment: PATH_SEGMENT_ANSWERS,
        uploadSuccessMessage: LOG_MESSAGES.ANSWER_IMAGE_UPLOADED,
        uploadErrorMessage: ERROR_MESSAGES.FAILED_TO_UPLOAD_IMAGE,
      });
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, LOG_MESSAGES.ERROR_UPLOADING_ANSWER_IMAGE);
      res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      });
    }
  },
);

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
/**
 * Function: handleImageUpload
 * Description:
 * - Handles the common image upload logic for all upload routes
 * - Validates file, verifies quiz ownership, uploads to storage, and optionally updates quiz record
 *
 * Parameters:
 * - req (MulterRequest): Express request with file
 * - res (express.Response): Express response object
 * - options (UploadOptions): Upload configuration options
 *
 * Returns:
 * - void: Sends response via res parameter
 */
async function handleImageUpload(
  req: MulterRequest,
  res: Response,
  options: UploadOptions,
): Promise<void> {
  const { quizId } = req.params;
  const userId = req.user!.id;
  const file = req.file;

  if (!file) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({
      error: ERROR_CODES.NO_FILE,
      message: ERROR_MESSAGES.NO_FILE_PROVIDED,
    });
    return;
  }

  const quiz = await verifyQuizOwnership(quizId, userId, res);
  if (!quiz) {
    return;
  }

  const filePath = generateFilePath(userId, quizId, options.pathSegment, file);
  const uploadResult = await uploadToStorage(filePath, file, userId);

  if (!uploadResult) {
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.UPLOAD_FAILED,
      message: options.uploadErrorMessage,
    });
    return;
  }

  const publicUrl = getPublicUrl(uploadResult.path);

  if (options.updateQuizRecord) {
    await updateQuizThumbnail(quizId, publicUrl, userId);
  }

  logger.info({ quizId, userId, filePath }, options.uploadSuccessMessage);

  res.status(HTTP_STATUS_OK).json({
    url: publicUrl,
    path: uploadResult.path,
  });
}

/**
 * Function: verifyQuizOwnership
 * Description:
 * - Verifies that the quiz exists and the user owns it
 * - Sends error response if verification fails
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - userId (string): User identifier
 * - res (Response): Express response object
 *
 * Returns:
 * - object | null: Quiz data if ownership verified, null otherwise (sends error response)
 */
async function verifyQuizOwnership(
  quizId: string,
  userId: string,
  res: Response,
): Promise<{ user_id: string } | null> {
  const { data: quiz, error: quizError } = await supabaseAdmin
    .from(TABLE_QUIZ_SETS)
    .select(COLUMN_USER_ID)
    .eq(COLUMN_ID, quizId)
    .single();

  if (quizError || !quiz) {
    logger.error({ error: quizError, quizId, userId }, LOG_MESSAGES.QUIZ_NOT_FOUND);
    res.status(404).json({
      error: ERROR_CODES.QUIZ_NOT_FOUND,
      message: ERROR_MESSAGES.QUIZ_NOT_FOUND,
    });
    return null;
  }

  if (quiz.user_id !== userId) {
    logger.warn({ quizId, userId, ownerId: quiz.user_id }, LOG_MESSAGES.USER_NOT_AUTHORIZED);
    res.status(403).json({
      error: ERROR_CODES.NOT_AUTHORIZED,
      message: ERROR_MESSAGES.NOT_AUTHORIZED_TO_UPLOAD,
    });
    return null;
  }

  return quiz;
}

/**
 * Function: generateFilePath
 * Description:
 * - Generates a unique file path for the uploaded image
 *
 * Parameters:
 * - userId (string): User identifier
 * - quizId (string): Quiz identifier
 * - pathSegment (string): Path segment (thumbnails/questions/answers)
 * - file (Express.Multer.File): Uploaded file
 *
 * Returns:
 * - string: Generated file path
 */
function generateFilePath(
  userId: string,
  quizId: string,
  pathSegment: string,
  file: Express.Multer.File,
): string {
  const timestamp = Date.now();
  const randomString = Math.random()
    .toString(RANDOM_STRING_BASE)
    .substring(RANDOM_STRING_START, RANDOM_STRING_END);
  const extension = file.originalname.split('.').pop()?.toLowerCase() || DEFAULT_EXTENSION;
  const fileName = `${timestamp}-${randomString}.${extension}`;
  return `${userId}/quiz-${quizId}/${pathSegment}/${fileName}`;
}

/**
 * Function: uploadToStorage
 * Description:
 * - Uploads file to Supabase Storage
 *
 * Parameters:
 * - filePath (string): Destination file path
 * - file (Express.Multer.File): File to upload
 * - userId (string): User identifier for logging
 *
 * Returns:
 * - object | null: Upload data if successful, null otherwise
 */
async function uploadToStorage(
  filePath: string,
  file: Express.Multer.File,
  userId: string,
): Promise<{ path: string } | null> {
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET_QUIZ_IMAGES)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      cacheControl: CACHE_CONTROL_SECONDS,
      upsert: false,
    });

  if (uploadError) {
    logger.error({ error: uploadError, filePath, userId }, LOG_MESSAGES.FAILED_TO_UPLOAD_IMAGE);
    return null;
  }

  return uploadData;
}

/**
 * Function: getPublicUrl
 * Description:
 * - Gets the public URL for an uploaded file
 *
 * Parameters:
 * - filePath (string): File path in storage
 *
 * Returns:
 * - string: Public URL for the file
 */
function getPublicUrl(filePath: string): string {
  const { data: urlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET_QUIZ_IMAGES)
    .getPublicUrl(filePath);
  return urlData.publicUrl;
}

/**
 * Function: updateQuizThumbnail
 * Description:
 * - Updates quiz record with thumbnail URL
 * - Logs warning if update fails but doesn't throw error
 *
 * Parameters:
 * - quizId (string): Quiz identifier
 * - thumbnailUrl (string): Thumbnail public URL
 * - userId (string): User identifier for logging
 *
 * Returns:
 * - void: No return value
 */
async function updateQuizThumbnail(
  quizId: string,
  thumbnailUrl: string,
  userId: string,
): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from(TABLE_QUIZ_SETS)
    .update({ [COLUMN_THUMBNAIL_URL]: thumbnailUrl })
    .eq(COLUMN_ID, quizId);

  if (updateError) {
    logger.error({ error: updateError, quizId, userId }, LOG_MESSAGES.FAILED_TO_UPDATE_QUIZ);
    logger.warn(LOG_MESSAGES.UPLOAD_SUCCEEDED_UPDATE_FAILED);
  }
}

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
