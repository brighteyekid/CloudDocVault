const express = require('express');
const s3Service = require('../services/s3');
const { trackS3Operation } = require('../middleware/metrics');
const authGuard = require('../middleware/authGuard');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(authGuard);

// Apply upload rate limiting
router.use(rateLimiter.upload);

// Supported file types
const SUPPORTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/zip',
  'text/plain'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

// POST /api/upload/presign
router.post('/presign', async (req, res, next) => {
  try {
    const { filename, contentType, size, metadata = {} } = req.body;

    // Validation
    if (!filename || !contentType || size === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: filename, contentType, size',
        code: 'VALIDATION_ERROR'
      });
    }

    // Check file size
    if (size > MAX_FILE_SIZE) {
      const error = new Error('File too large');
      error.name = 'ValidationError';
      return next(error);
    }

    // Check content type
    if (!SUPPORTED_TYPES.includes(contentType)) {
      const error = new Error('Unsupported file type');
      error.name = 'ValidationError';
      return next(error);
    }

    // Generate S3 key
    const key = s3Service.generateS3Key(req.user.sub, filename);

    // Prepare metadata for S3
    const s3Metadata = {
      'uploaded-by': req.user.email || req.user.sub,
      'original-name': filename,
      'access-level': metadata.accessLevel || 'private'
    };

    if (metadata.tags) {
      s3Metadata.tags = Array.isArray(metadata.tags) 
        ? metadata.tags.join(',') 
        : metadata.tags;
    }

    if (metadata.description) {
      s3Metadata.description = metadata.description;
    }

    // Generate presigned PUT URL
    const uploadUrl = await s3Service.generatePresignedPutUrl(
      key, 
      contentType, 
      s3Metadata,
      1800 // 30 minutes
    );

    const expiresAt = new Date(Date.now() + 1800 * 1000);

    res.json({
      uploadUrl,
      key,
      expiresAt
    });
  } catch (error) {
    trackS3Operation('presign_put', 'error');
    next(error);
  }
});

// POST /api/upload/confirm
router.post('/confirm', async (req, res, next) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({
        error: 'Missing required field: key',
        code: 'VALIDATION_ERROR'
      });
    }

    // Verify the object exists in S3
    const metadata = await s3Service.getObjectMetadata(key);

    if (!metadata) {
      trackS3Operation('confirm', 'error');
      return res.status(404).json({
        error: 'Upload not confirmed — object not found',
        code: 'UPLOAD_NOT_FOUND'
      });
    }

    // Verify the user owns this upload
    const parsedKey = s3Service.parseS3Key(key);
    if (!parsedKey || parsedKey.userSub !== req.user.sub) {
      trackS3Operation('confirm', 'error');
      const forbiddenError = new Error('Access denied');
      forbiddenError.name = 'ForbiddenError';
      return next(forbiddenError);
    }

    const originalName = metadata.metadata['original-name'] || parsedKey.filename;

    const document = {
      key: metadata.key,
      name: originalName,
      size: metadata.size,
      uploadedAt: metadata.lastModified,
      uploadedBy: metadata.metadata['uploaded-by'] || req.user.email,
      type: originalName.split('.').pop()?.toLowerCase() || 'unknown'
    };

    // Log successful upload
    console.log(`[${new Date().toISOString()}] Upload confirmed: ${key} by user: ${req.user.sub}`);
    trackS3Operation('confirm', 'success');

    res.json({
      document
    });
  } catch (error) {
    trackS3Operation('confirm', 'error');
    next(error);
  }
});

module.exports = router;