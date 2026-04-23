const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const { requestDurationMiddleware, metricsMiddleware } = require('./middleware/metrics');

// Import routes
const authRoutes = require('./routes/auth');
const documentsRoutes = require('./routes/documents');
const uploadRoutes = require('./routes/upload');
const logsRoutes = require('./routes/logs');
const metricsRoutes = require('./routes/metrics');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');

const app = express();

// Trust proxy - required when behind nginx
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Cookie parsing
app.use(cookieParser(process.env.JWT_COOKIE_SECRET));

// Rate limiting
app.use(rateLimiter.global);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Metrics endpoint (no auth required)
app.get('/metrics', metricsMiddleware);

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'CloudDocVault API'
  });
});

// Request duration middleware
app.use(requestDurationMiddleware);

// API routes
app.use('/api/auth', rateLimiter.auth, authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    requestId: req.id || 'unknown'
  });
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;