const crypto = require('crypto');

const errorHandler = (err, req, res, next) => {
  // Generate unique request ID for tracking
  const requestId = req.id || crypto.randomUUID();
  
  // Log the full error with stack trace
  console.error(`[${new Date().toISOString()}] Error ${requestId}:`, {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    user: req.user?.sub || 'anonymous'
  });

  // Determine status code and error code
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';

  // Map specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'AuthError' || err.message.includes('Unauthorized')) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (err.name === 'ForbiddenError' || err.message.includes('Forbidden')) {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = 'Access denied';
  } else if (err.name === 'NotFoundError' || err.message.includes('Not found')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = 'Resource not found';
  } else if (err.message.includes('Invalid credentials')) {
    statusCode = 401;
    errorCode = 'INVALID_CREDENTIALS';
    message = 'Invalid credentials';
  } else if (err.message.includes('Session expired')) {
    statusCode = 401;
    errorCode = 'SESSION_EXPIRED';
    message = 'Session expired';
  } else if (err.message.includes('File too large')) {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'File size exceeds limit';
  } else if (err.message.includes('Unsupported file type')) {
    statusCode = 415;
    errorCode = 'UNSUPPORTED_MEDIA_TYPE';
    message = 'Unsupported file type';
  }

  // Send error response (never expose stack traces)
  res.status(statusCode).json({
    error: message,
    code: errorCode,
    requestId
  });
};

module.exports = errorHandler;