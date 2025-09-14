# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Quiz Image Cleanup Migration** (2025-01-15)
  - Automatic deletion of quiz images when quiz is soft deleted
  - Comprehensive cleanup of thumbnails, question images, explanation images, and answer images
  - Manual cleanup functions for maintenance
  - Bulk cleanup for all soft-deleted quizzes
  - Error handling and logging for cleanup operations
  - Performance optimizations with proper indexing

### Changed

- Enhanced quiz deletion process to include automatic image cleanup
- Improved storage management by preventing orphaned images

### Technical Details

- New migration: `20250115000000_add_quiz_image_cleanup.sql`
- Functions: `cleanup_quiz_images()`, `extract_storage_path_from_url()`, `manual_cleanup_quiz_images()`, `bulk_cleanup_deleted_quiz_images()`
- Trigger: `on_quiz_soft_delete_cleanup_images`
- Documentation: `docs/QUIZ_IMAGE_CLEANUP.md`

## Previous Changes

- [Previous changelog entries would go here]
