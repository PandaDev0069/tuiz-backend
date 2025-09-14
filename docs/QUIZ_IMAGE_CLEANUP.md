# Quiz Image Cleanup Migration

## Overview

This migration automatically deletes all images related to a quiz when the quiz is soft deleted. It ensures that storage space is not wasted by orphaned images.

## What it does

1. **Automatic Cleanup**: When a quiz is soft deleted (deleted_at is set), all related images are automatically removed from Supabase Storage
2. **Comprehensive Coverage**: Cleans up all image types:
   - Quiz thumbnail images
   - Question images
   - Question explanation images
   - Answer images
3. **Safe Operation**: Only deletes images from soft-deleted quizzes, not active ones
4. **Error Handling**: Gracefully handles errors without breaking the deletion process

## Image Storage Structure

Images are stored in the `quiz-images` bucket with the following structure:

```
quiz-images/
├── {userId}/
│   └── quiz-{quizId}/
│       ├── thumbnails/
│       │   └── {timestamp}-{random}.{ext}
│       ├── questions/
│       │   └── {timestamp}-{random}.{ext}
│       └── answers/
│           └── {timestamp}-{random}.{ext}
```

## Functions Created

### 1. `cleanup_quiz_images(quiz_id UUID)`

- Main cleanup function
- Extracts image paths from database URLs
- Deletes images from Supabase Storage
- Only works on soft-deleted quizzes

### 2. `extract_storage_path_from_url(image_url TEXT)`

- Utility function to extract storage path from Supabase public URL
- Handles URL format: `https://[project].supabase.co/storage/v1/object/public/quiz-images/[path]`

### 3. `trigger_cleanup_quiz_images()`

- Trigger function called when quiz is soft deleted
- Calls cleanup function automatically

### 4. `manual_cleanup_quiz_images(quiz_id UUID)`

- Manual cleanup function for maintenance
- Returns cleanup status and count of deleted images

### 5. `bulk_cleanup_deleted_quiz_images()`

- Bulk cleanup for all soft-deleted quizzes
- Useful for maintenance and cleanup of existing data

## Trigger

The migration creates a trigger `on_quiz_soft_delete_cleanup_images` that:

- Fires AFTER UPDATE on the `quiz_sets` table
- Only triggers when `deleted_at` changes from NULL to a timestamp
- Calls the cleanup function automatically

## Usage Examples

### Automatic Cleanup

```sql
-- When a quiz is soft deleted, images are automatically cleaned up
UPDATE quiz_sets
SET deleted_at = NOW()
WHERE id = 'quiz-uuid-here';
```

### Manual Cleanup

```sql
-- Clean up images for a specific quiz
SELECT * FROM manual_cleanup_quiz_images('quiz-uuid-here');
```

### Bulk Cleanup

```sql
-- Clean up images for all soft-deleted quizzes
SELECT * FROM bulk_cleanup_deleted_quiz_images();
```

## Security

- All functions use `SECURITY DEFINER` to run with elevated privileges
- Functions are granted to `authenticated` role
- Only processes soft-deleted quizzes
- Graceful error handling prevents data corruption

## Performance

- Creates index on `deleted_at` for efficient querying
- Uses array operations for bulk image deletion
- Asynchronous notification system for non-blocking operations

## Testing

To test the migration:

1. Create a quiz with images
2. Soft delete the quiz
3. Verify images are removed from storage
4. Check cleanup logs

## Maintenance

The migration includes maintenance functions for:

- Manual cleanup of specific quizzes
- Bulk cleanup of all soft-deleted quizzes
- Monitoring cleanup operations

## Error Handling

- Functions include comprehensive error handling
- Errors are logged but don't prevent quiz deletion
- Graceful degradation ensures system stability
