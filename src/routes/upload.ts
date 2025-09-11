// src/routes/upload.ts
import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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
// UPLOAD QUIZ THUMBNAIL
// ============================================================================

/**
 * POST /upload/quiz-thumbnail/:quizId
 * Upload thumbnail image for a quiz
 */
router.post(
  '/quiz-thumbnail/:quizId',
  authMiddleware,
  upload.single('thumbnail'),
  async (req: MulterRequest, res) => {
    try {
      const { quizId } = req.params;
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          error: 'no_file',
          message: 'No file provided',
        });
      }

      // Verify quiz ownership
      const { data: quiz, error: quizError } = await supabaseAdmin
        .from('quiz_sets')
        .select('user_id')
        .eq('id', quizId)
        .single();

      if (quizError || !quiz) {
        logger.error({ error: quizError, quizId, userId }, 'Quiz not found');
        return res.status(404).json({
          error: 'quiz_not_found',
          message: 'Quiz not found',
        });
      }

      if (quiz.user_id !== userId) {
        logger.warn(
          { quizId, userId, ownerId: quiz.user_id },
          'User not authorized to upload to this quiz',
        );
        return res.status(403).json({
          error: 'not_authorized',
          message: 'Not authorized to upload to this quiz',
        });
      }

      // Generate file path
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${timestamp}-${randomString}.${extension}`;
      const filePath = `${userId}/quiz-${quizId}/thumbnails/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('quiz-images')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        logger.error({ error: uploadError, filePath, userId }, 'Failed to upload image');
        return res.status(500).json({
          error: 'upload_failed',
          message: 'Failed to upload image',
        });
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('quiz-images')
        .getPublicUrl(uploadData.path);

      // Update quiz with thumbnail URL
      const { error: updateError } = await supabaseAdmin
        .from('quiz_sets')
        .update({ thumbnail_url: urlData.publicUrl })
        .eq('id', quizId);

      if (updateError) {
        logger.error(
          { error: updateError, quizId, userId },
          'Failed to update quiz with thumbnail URL',
        );
        // Don't fail the request - the upload succeeded
        logger.warn('Upload succeeded but failed to update quiz record');
      }

      logger.info({ quizId, userId, filePath }, 'Quiz thumbnail uploaded successfully');

      res.status(200).json({
        url: urlData.publicUrl,
        path: uploadData.path,
      });
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, 'Error uploading quiz thumbnail');
      res.status(500).json({
        error: 'server_error',
        message: 'Internal server error',
      });
    }
  },
);

export default router;
