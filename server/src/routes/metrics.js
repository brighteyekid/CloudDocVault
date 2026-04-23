const express = require('express');
const cloudwatchService = require('../services/cloudwatch');
const prometheusService = require('../services/prometheus');
const authGuard = require('../middleware/authGuard');

const router = express.Router();

// All routes require authentication
router.use(authGuard);

// GET /api/metrics/summary
router.get('/summary', async (req, res, next) => {
  try {
    const [
      cloudwatchMetrics,
      prometheusMetrics
    ] = await Promise.allSettled([
      cloudwatchService.getSummaryMetrics(),
      getPrometheusMetrics()
    ]);

    const cwData = cloudwatchMetrics.status === 'fulfilled' ? cloudwatchMetrics.value : {};
    const promData = prometheusMetrics.status === 'fulfilled' ? prometheusMetrics.value : {};

    // Combine and format metrics
    const metrics = {
      // API P95 Latency
      apiP95Latency: promData.apiLatency || extractLatestValue(cwData.lambdaDuration) || '0',
      
      // Upload Error Rate
      uploadErrorRate: promData.errorRate || calculateErrorRate(cwData.lambdaErrors) || '0.0',
      
      // Lambda Errors (24h)
      lambdaErrors24h: extractSum(cwData.lambdaErrors) || '0',
      
      // CloudFront Cache Hit Rate
      cloudFrontCacheHit: extractLatestValue(cwData.cloudFrontCacheHit) || '0',
      
      // Active Sessions
      activeSessions: promData.activeSessions || '0',
      
      // Storage metrics
      bucketSize: formatBucketSize(cwData.bucketSize) || '0 GB',
      numberOfObjects: extractLatestValue(cwData.numberOfObjects) || '0'
    };

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// GET /api/metrics/timeseries
router.get('/timeseries', async (req, res, next) => {
  try {
    const { metric, range = '1h' } = req.query;

    if (!metric) {
      return res.status(400).json({
        error: 'Missing required parameter: metric',
        code: 'VALIDATION_ERROR'
      });
    }

    let datapoints = [];

    // Try Prometheus first if available
    if (prometheusService.isEnabled()) {
      try {
        datapoints = await prometheusService.getTimeSeriesData(metric, range);
      } catch (error) {
        console.warn('Prometheus query failed, falling back to CloudWatch:', error.message);
      }
    }

    // Fallback to CloudWatch if Prometheus unavailable or failed
    if (datapoints.length === 0) {
      datapoints = await getCloudWatchTimeSeries(metric, range);
    }

    res.json({ datapoints });
  } catch (error) {
    next(error);
  }
});

// GET /api/metrics/alerts
router.get('/alerts', async (req, res, next) => {
  try {
    const [
      cloudwatchAlerts,
      prometheusAlerts
    ] = await Promise.allSettled([
      cloudwatchService.getActiveAlarms(),
      prometheusService.getAlerts()
    ]);

    const cwAlerts = cloudwatchAlerts.status === 'fulfilled' ? cloudwatchAlerts.value : [];
    const promAlerts = prometheusAlerts.status === 'fulfilled' ? prometheusAlerts.value : [];

    const alerts = [...cwAlerts, ...promAlerts];

    res.json({ alerts });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function getPrometheusMetrics() {
  if (!prometheusService.isEnabled()) {
    return {};
  }

  const [activeSessions, apiLatency, errorRate] = await Promise.allSettled([
    prometheusService.getActiveSessions(),
    prometheusService.getAPILatency(),
    prometheusService.getErrorRate()
  ]);

  return {
    activeSessions: activeSessions.status === 'fulfilled' ? activeSessions.value : null,
    apiLatency: apiLatency.status === 'fulfilled' ? apiLatency.value : null,
    errorRate: errorRate.status === 'fulfilled' ? errorRate.value : null
  };
}

async function getCloudWatchTimeSeries(metric, range) {
  const now = new Date();
  let start, period;

  switch (range) {
    case '1h':
      start = new Date(now.getTime() - 60 * 60 * 1000);
      period = 300; // 5 minutes
      break;
    case '6h':
      start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      period = 900; // 15 minutes
      break;
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      period = 3600; // 1 hour
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      period = 86400; // 1 day
      break;
    default:
      start = new Date(now.getTime() - 60 * 60 * 1000);
      period = 300;
  }

  try {
    let datapoints = [];

    if (metric === 'operations') {
      // Get S3 operations from CloudWatch
      const s3Requests = await cloudwatchService.getMetricStatistics({
        Namespace: 'AWS/S3',
        MetricName: 'NumberOfObjects',
        Dimensions: [
          {
            Name: 'BucketName',
            Value: process.env.S3_BUCKET_PRIMARY
          }
        ],
        StartTime: start,
        EndTime: now,
        Period: period,
        Statistics: ['Average']
      });

      datapoints = s3Requests.map(point => ({
        timestamp: point.Timestamp,
        value: point.Average || 0
      }));
    } else if (metric === 'bucketsize') {
      const bucketSize = await cloudwatchService.getS3BucketSize(
        process.env.S3_BUCKET_PRIMARY,
        start,
        now,
        period
      );

      datapoints = bucketSize.map(point => ({
        timestamp: point.Timestamp,
        value: cloudwatchService.formatBytesToGB(point.Average || 0)
      }));
    }

    return datapoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } catch (error) {
    console.error('CloudWatch timeseries error:', error);
    return [];
  }
}

function extractLatestValue(datapoints) {
  if (!datapoints || datapoints.length === 0) return null;
  const latest = datapoints.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))[0];
  return latest.Average || latest.Sum || latest.Maximum || 0;
}

function extractSum(datapoints) {
  if (!datapoints || datapoints.length === 0) return 0;
  return datapoints.reduce((sum, point) => sum + (point.Sum || 0), 0);
}

function calculateErrorRate(errorDatapoints) {
  if (!errorDatapoints || errorDatapoints.length === 0) return '0.0';
  const totalErrors = extractSum(errorDatapoints);
  // This is a simplified calculation - in practice you'd need total requests too
  return totalErrors > 0 ? '1.0' : '0.0';
}

function formatBucketSize(datapoints) {
  const bytes = extractLatestValue(datapoints);
  if (!bytes) return null;
  return `${cloudwatchService.formatBytesToGB(bytes)} GB`;
}

module.exports = router;