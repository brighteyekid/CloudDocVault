const express = require('express');
const s3Service = require('../services/s3');
const { trackS3Operation } = require('../middleware/metrics');
const cloudtrailService = require('../services/cloudtrail');
const authGuard = require('../middleware/authGuard');

const router = express.Router();

// All routes require authentication
router.use(authGuard);

// GET /api/documents
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 24,
      type,
      sort = 'newest',
      scope = 'all'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Determine S3 prefix based on scope
    let prefix = '';
    if (scope === 'mine') {
      prefix = `users/${req.user.sub}/`;
    } else if (scope === 'shared') {
      prefix = 'shared/';
    }
    // 'all' scope uses no prefix (admin view)

    // List objects from S3
    const objects = await s3Service.listObjects(prefix, 1000);
    trackS3Operation('list', 'success');
    
    if (objects.length === 0) {
      return res.json({
        documents: [],
        total: 0,
        page: pageNum,
        totalPages: 0
      });
    }

    // Get metadata for all objects
    const keys = objects.map(obj => obj.Key);
    const metadataList = await s3Service.getObjectsMetadata(keys);

    // Transform to document format
    let documents = metadataList.map(metadata => {
      const parsedKey = s3Service.parseS3Key(metadata.key);
      const originalName = metadata.metadata['original-name'] || 
                          (parsedKey ? parsedKey.filename : metadata.key.split('/').pop());

      return {
        key: metadata.key,
        name: originalName,
        size: metadata.size,
        type: originalName.split('.').pop()?.toLowerCase() || 'unknown',
        uploadedAt: metadata.lastModified,
        uploadedBy: metadata.metadata['uploaded-by'] || 'Unknown',
        tags: metadata.metadata.tags ? metadata.metadata.tags.split(',') : [],
        description: metadata.metadata.description || '',
        accessLevel: metadata.metadata['access-level'] || 'private',
        storageClass: metadata.storageClass,
        etag: metadata.etag
      };
    });

    // Apply type filter
    if (type) {
      documents = documents.filter(doc => doc.type === type.toLowerCase());
    }

    // Apply sorting
    documents.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.uploadedAt) - new Date(b.uploadedAt);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'newest':
        default:
          return new Date(b.uploadedAt) - new Date(a.uploadedAt);
      }
    });

    // Apply pagination
    const total = documents.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginatedDocuments = documents.slice(offset, offset + limitNum);

    res.json({
      documents: paginatedDocuments,
      total,
      page: pageNum,
      totalPages
    });
  } catch (error) {
    trackS3Operation('list', 'error');
    next(error);
  }
});

// GET /api/documents/:id
router.get('/:id', async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params.id);
    
    // Get object metadata
    const metadata = await s3Service.getObjectMetadata(key);
    trackS3Operation('get', metadata ? 'success' : 'error');
    
    if (!metadata) {
      const notFoundError = new Error('Document not found');
      notFoundError.name = 'NotFoundError';
      return next(notFoundError);
    }

    // Generate presigned URL for download
    const presignedUrl = await s3Service.generatePresignedGetUrl(key, 900); // 15 minutes

    // Get access history from CloudTrail
    const bucketName = process.env.S3_BUCKET_PRIMARY;
    const accessHistory = await cloudtrailService.getObjectAccessHistory(bucketName, key, 5);

    const parsedKey = s3Service.parseS3Key(key);
    const originalName = metadata.metadata['original-name'] || 
                        (parsedKey ? parsedKey.filename : key.split('/').pop());

    const document = {
      key: metadata.key,
      name: originalName,
      size: metadata.size,
      type: originalName.split('.').pop()?.toLowerCase() || 'unknown',
      lastModified: metadata.lastModified,
      uploadedBy: metadata.metadata['uploaded-by'] || 'Unknown',
      tags: metadata.metadata.tags ? metadata.metadata.tags.split(',') : [],
      description: metadata.metadata.description || '',
      accessLevel: metadata.metadata['access-level'] || 'private',
      storageClass: metadata.storageClass,
      etag: metadata.etag,
      presignedUrl,
      accessHistory
    };

    res.json(document);
  } catch (error) {
    trackS3Operation('get', 'error');
    next(error);
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params.id);
    
    // Verify the document exists and user has access
    const metadata = await s3Service.getObjectMetadata(key);
    
    if (!metadata) {
      trackS3Operation('delete', 'error');
      const notFoundError = new Error('Document not found');
      notFoundError.name = 'NotFoundError';
      return next(notFoundError);
    }

    // Check if user owns the document (basic access control)
    const parsedKey = s3Service.parseS3Key(key);
    if (parsedKey && parsedKey.userSub !== req.user.sub) {
      trackS3Operation('delete', 'error');
      const forbiddenError = new Error('Access denied');
      forbiddenError.name = 'ForbiddenError';
      return next(forbiddenError);
    }

    // Delete from S3
    await s3Service.deleteObject(key);
    trackS3Operation('delete', 'success');

    // Log the deletion (CloudTrail will automatically log the S3 delete event)
    console.log(`[${new Date().toISOString()}] Document deleted: ${key} by user: ${req.user.sub}`);

    res.json({
      message: 'Document deleted successfully'
    });
  } catch (error) {
    trackS3Operation('delete', 'error');
    next(error);
  }
});

// GET /api/documents/:id/link
router.get('/:id/link', async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params.id);
    
    // Verify the document exists
    const metadata = await s3Service.getObjectMetadata(key);
    
    if (!metadata) {
      const notFoundError = new Error('Document not found');
      notFoundError.name = 'NotFoundError';
      return next(notFoundError);
    }

    // Generate presigned URL for sharing (1 hour expiry)
    const url = await s3Service.generatePresignedGetUrl(key, 3600);
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    res.json({
      url,
      expiresAt
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;