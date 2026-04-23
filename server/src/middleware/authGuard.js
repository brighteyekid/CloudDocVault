const cognitoService = require('../services/cognito');

const authGuard = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        requestId: req.id || 'unknown'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'INVALID_TOKEN',
        requestId: req.id || 'unknown'
      });
    }

    // Verify the token with Cognito
    const user = await cognitoService.verifyToken(token);
    
    // Attach user info to request
    req.user = user;
    req.accessToken = token;
    
    next();
  } catch (error) {
    console.error('Auth guard error:', error);
    
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'TOKEN_VERIFICATION_FAILED',
      requestId: req.id || 'unknown'
    });
  }
};

module.exports = authGuard;