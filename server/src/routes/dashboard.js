const express = require('express');
const s3Service = require('../services/s3');
const cloudtrailService = require('../services/cloudtrail');
const cloudwatchService = require('../services/cloudwatch');
const authGuard = require('../middleware/authGuard');

const router = express.Router();

// All routes require authentication
router.use(authGuard);

// GET /api/dashboard/summary
router.get('/summary', async (req, res, next) => {
  try {
    // Get data in parallel
    const [
      recentDocuments,
      recentActivity,
      metricsData
    ] = await Promise.allSettled([
      getRecentDocuments(req.user.sub),
      cloudtrailService.getRecentActivity(10),
      getDashboardMetrics()
    ]);

    const response = {
      stats: metricsData.status === 'fulfilled' ? metricsData.value : getDefaultStats(),
      recentDocuments: recentDocuments.status === 'fulfilled' ? recentDocuments.value : [],
      recentActivity: recentActivity.status === 'fulfilled' ? recentActivity.value : []
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

async function getRecentDocuments(userSub, limit = 8) {
  try {
    // Get user's documents
    const prefix = `users/${userSub}/`;
    const objects = await s3Service.listObjects(prefix, 50);
    
    if (objects.length === 0) {
      return [];
    }

    // Sort by last modified and take the most recent
    const sortedObjects = objects
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .slice(0, limit);

    // Get metadata for recent objects
    const keys = sortedObjects.map(obj => obj.Key);
    const metadataList = await s3Service.getObjectsMetadata(keys);

    return metadataList.map(metadata => {
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
        status: 'Stored' // Assume stored if we can read metadata
      };
    });
  } catch (error) {
    console.error('Error getting recent documents:', error);
    return [];
  }
}

async function getDashboardMetrics() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get CloudWatch metrics
    const metricsData = await cloudwatchService.getSummaryMetrics();

    // Get document counts from S3
    const allObjects = await s3Service.listObjects('', 1000);
    const totalDocuments = allObjects.length;

    // Calculate storage used
    const totalBytes = allObjects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
    const storageUsed = cloudwatchService.formatBytesToGB(totalBytes);

    // Get uploads today from CloudTrail
    const uploadsToday = await cloudtrailService.getUploadCount(oneDayAgo, now);

    // Get access denied count
    const accessDenied24h = await cloudtrailService.getAccessDeniedCount(oneDayAgo, now);

    return {
      totalDocuments: totalDocuments.toString(),
      storageUsed: `${storageUsed} GB`,
      uploadsToday: uploadsToday.toString(),
      accessDenied24h: accessDenied24h.toString()
    };
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    return getDefaultStats();
  }
}

function getDefaultStats() {
  return {
    totalDocuments: '0',
    storageUsed: '0 GB',
    uploadsToday: '0',
    accessDenied24h: '0'
  };
}

module.exports = router;