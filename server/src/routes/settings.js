const express = require('express');
const crypto = require('crypto');
const cognitoService = require('../services/cognito');
const s3Service = require('../services/s3');
const authGuard = require('../middleware/authGuard');

const router = express.Router();

// All routes require authentication
router.use(authGuard);

// GET /api/settings/profile
router.get('/profile', async (req, res, next) => {
  try {
    // Return user info from the JWT token
    const profile = {
      sub: req.user.sub,
      email: req.user.email,
      name: req.user.name || req.user.email,
      groups: req.user.groups || []
    };

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/profile
router.put('/profile', async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Name is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Update user attributes in Cognito
    await cognitoService.updateUserAttributes(req.accessToken, {
      name: name
    });

    res.json({
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/sessions
router.get('/sessions', async (req, res, next) => {
  try {
    const devices = await cognitoService.listDevices(req.accessToken);
    
    const sessions = devices.map(device => ({
      deviceKey: device.DeviceKey,
      deviceName: device.DeviceAttributes?.find(attr => attr.Name === 'device_name')?.Value || 'Unknown Device',
      lastSeen: device.DeviceLastModifiedDate,
      lastIP: device.DeviceAttributes?.find(attr => attr.Name === 'last_ip_used')?.Value || 'Unknown'
    }));

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/settings/sessions/:deviceKey
router.delete('/sessions/:deviceKey', async (req, res, next) => {
  try {
    const { deviceKey } = req.params;

    await cognitoService.forgetDevice(req.accessToken, deviceKey);

    res.json({
      message: 'Session revoked successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/apikeys
router.get('/apikeys', async (req, res, next) => {
  try {
    const apiKeysKey = `config/apikeys/${req.user.sub}.json`;
    
    try {
      const metadata = await s3Service.getObjectMetadata(apiKeysKey);
      if (!metadata) {
        return res.json({ apiKeys: [] });
      }

      // In a real implementation, you'd fetch and parse the JSON
      // For now, return empty array
      res.json({ apiKeys: [] });
    } catch (error) {
      // File doesn't exist
      res.json({ apiKeys: [] });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/settings/apikeys
router.post('/apikeys', async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'API key name is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Generate a new API key
    const rawKey = crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    
    const keyId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // In a real implementation, you'd store this in S3 or a database
    // For now, just return the key
    
    console.log(`[${new Date().toISOString()}] API key created: ${keyId} for user: ${req.user.sub}`);

    res.json({
      keyId,
      name,
      key: rawKey, // Only returned once
      createdAt,
      message: 'API key created successfully. Save this key - it will not be shown again.'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/settings/apikeys/:keyId
router.delete('/apikeys/:keyId', async (req, res, next) => {
  try {
    const { keyId } = req.params;

    // In a real implementation, you'd delete from S3 or database
    console.log(`[${new Date().toISOString()}] API key deleted: ${keyId} by user: ${req.user.sub}`);

    res.json({
      message: 'API key deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;