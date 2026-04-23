const express = require('express');
const cloudtrailService = require('../services/cloudtrail');
const { trackS3Operation } = require('../middleware/metrics');
const authGuard = require('../middleware/authGuard');

const router = express.Router();

// All routes require authentication
router.use(authGuard);

// GET /api/logs
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      startTime,
      endTime,
      action,
      user
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Set default time range if not provided (last 7 days)
    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime ? new Date(startTime) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Build filters
    const filters = {};
    if (action && action !== 'All actions') {
      // Map friendly action names to CloudTrail event names
      const actionMap = {
        'Upload': 'PutObject',
        'Download': 'GetObject',
        'Delete': 'DeleteObject',
        'Access denied': '', // Will filter by error code
        'Login': 'AssumeRoleWithWebIdentity'
      };
      filters.eventName = actionMap[action];
    }

    if (user) {
      filters.username = user;
    }

    // Get events from CloudTrail
    const events = await cloudtrailService.getAccessLogs(start, end, filters);
    trackS3Operation('cloudtrail_lookup', 'success');

    // Apply additional filtering for access denied
    let filteredEvents = events;
    if (action === 'Access denied') {
      filteredEvents = events.filter(event => event.result === 'Failed');
    }

    // Apply user filter if not already applied in CloudTrail query
    if (user && !filters.username) {
      filteredEvents = filteredEvents.filter(event => 
        event.user.toLowerCase().includes(user.toLowerCase())
      );
    }

    // Apply pagination
    const total = filteredEvents.length;
    const totalPages = Math.ceil(total / limitNum);
    const offset = (pageNum - 1) * limitNum;
    const paginatedEvents = filteredEvents.slice(offset, offset + limitNum);

    res.json({
      events: paginatedEvents,
      total,
      page: pageNum,
      totalPages
    });
  } catch (error) {
    trackS3Operation('cloudtrail_lookup', 'error');
    next(error);
  }
});

// GET /api/logs/export
router.get('/export', async (req, res, next) => {
  try {
    const {
      startTime,
      endTime,
      action,
      user,
      format = 'json'
    } = req.query;

    // Set default time range if not provided (last 7 days)
    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime ? new Date(startTime) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Build filters
    const filters = {};
    if (action && action !== 'All actions') {
      const actionMap = {
        'Upload': 'PutObject',
        'Download': 'GetObject',
        'Delete': 'DeleteObject',
        'Login': 'AssumeRoleWithWebIdentity'
      };
      filters.eventName = actionMap[action];
    }

    if (user) {
      filters.username = user;
    }

    // Export events
    const exportData = await cloudtrailService.exportEvents(start, end, filters, format);
    trackS3Operation('cloudtrail_export', 'success');

    // Set appropriate headers
    const filename = `access-logs-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.${format}`;
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error) {
    trackS3Operation('cloudtrail_export', 'error');
    next(error);
  }
});

module.exports = router;