const express = require('express');
const cognitoService = require('../services/cognito');
const { cognitoActiveSessions } = require('../middleware/metrics');
const authGuard = require('../middleware/authGuard');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const result = await cognitoService.login(email, password);
    
    // Set refresh token as httpOnly cookie
    res.cookie('cdv_rt', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      signed: true
    });

    // Update active sessions metric
    cognitoActiveSessions.inc();

    // Return access token and user info (not refresh token)
    res.json({
      accessToken: result.accessToken,
      idToken: result.idToken,
      user: result.user
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.signedCookies.cdv_rt;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'No refresh token',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const result = await cognitoService.refreshToken(refreshToken);

    res.json({
      accessToken: result.accessToken,
      idToken: result.idToken
    });
  } catch (error) {
    // Clear the refresh token cookie on error
    res.clearCookie('cdv_rt');
    
    const authError = new Error('Session expired');
    authError.name = 'AuthError';
    next(authError);
  }
});

// POST /api/auth/logout
router.post('/logout', authGuard, async (req, res, next) => {
  try {
    // Attempt to sign out from Cognito
    await cognitoService.logout(req.accessToken);
    
    // Clear the refresh token cookie
    res.clearCookie('cdv_rt');
    
    // Update active sessions metric
    cognitoActiveSessions.dec();
    
    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    // Clear cookie even if Cognito logout fails
    res.clearCookie('cdv_rt');
    
    res.json({
      message: 'Logged out successfully'
    });
  }
});

module.exports = router;