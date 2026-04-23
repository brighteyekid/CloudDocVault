const { Counter, Histogram, Gauge, register } = require('prom-client');

// Create metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

const s3OperationsTotal = new Counter({
  name: 's3_operations_total',
  help: 'Total number of S3 operations',
  labelNames: ['operation', 'status']
});

const cognitoActiveSessions = new Gauge({
  name: 'cognito_active_sessions',
  help: 'Number of active Cognito sessions'
});

// Expose metrics endpoint
const metricsMiddleware = (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
};

// Request duration middleware
const requestDurationMiddleware = (req, res, next) => {
  const end = httpRequestDuration.startTimer({ method: req.method, path: req.path });
  
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      path: req.path,
      status: res.statusCode
    });
    end();
  });
  
  next();
};

// S3 operation tracking
const trackS3Operation = (operation, status) => {
  s3OperationsTotal.inc({ operation, status });
};

// Export
module.exports = {
  metricsMiddleware,
  requestDurationMiddleware,
  trackS3Operation,
  cognitoActiveSessions,
  register
};
