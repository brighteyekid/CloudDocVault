const axios = require('axios');

class PrometheusService {
  constructor() {
    this.baseURL = process.env.PROMETHEUS_URL;
    this.enabled = !!this.baseURL;
  }

  async query(query) {
    if (!this.enabled) {
      throw new Error('Prometheus not configured');
    }

    try {
      const response = await axios.get(`${this.baseURL}/api/v1/query`, {
        params: { query },
        timeout: 10000
      });

      if (response.data.status !== 'success') {
        throw new Error('Prometheus query failed');
      }

      return response.data.data.result;
    } catch (error) {
      console.error('Prometheus query error:', error);
      throw new Error('Failed to query Prometheus');
    }
  }

  async queryRange(query, start, end, step = '1m') {
    if (!this.enabled) {
      throw new Error('Prometheus not configured');
    }

    try {
      const response = await axios.get(`${this.baseURL}/api/v1/query_range`, {
        params: {
          query,
          start: Math.floor(start.getTime() / 1000),
          end: Math.floor(end.getTime() / 1000),
          step
        },
        timeout: 15000
      });

      if (response.data.status !== 'success') {
        throw new Error('Prometheus range query failed');
      }

      return response.data.data.result;
    } catch (error) {
      console.error('Prometheus range query error:', error);
      throw new Error('Failed to query Prometheus range');
    }
  }

  async getAlerts() {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await axios.get(`${this.baseURL}/api/v1/alerts`, {
        timeout: 10000
      });

      if (response.data.status !== 'success') {
        return [];
      }

      return response.data.data.alerts
        .filter(alert => alert.state === 'firing')
        .map(alert => ({
          name: alert.labels.alertname,
          description: alert.annotations.description || alert.annotations.summary,
          severity: this.mapSeverity(alert.labels.severity),
          triggeredAt: new Date(alert.activeAt),
          source: 'Prometheus'
        }));
    } catch (error) {
      console.error('Prometheus alerts error:', error);
      return [];
    }
  }

  async getActiveSessions() {
    if (!this.enabled) {
      return null;
    }

    try {
      // Example query - adjust based on your metrics
      const result = await this.query('sum(cognito_active_sessions)');
      
      if (result.length > 0 && result[0].value) {
        return parseInt(result[0].value[1]);
      }
      
      return null;
    } catch (error) {
      console.error('Prometheus active sessions error:', error);
      return null;
    }
  }

  async getAPILatency() {
    if (!this.enabled) {
      return null;
    }

    try {
      // Example query for 95th percentile latency
      const result = await this.query('histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))');
      
      if (result.length > 0 && result[0].value) {
        return parseFloat(result[0].value[1]) * 1000; // Convert to milliseconds
      }
      
      return null;
    } catch (error) {
      console.error('Prometheus API latency error:', error);
      return null;
    }
  }

  async getErrorRate() {
    if (!this.enabled) {
      return null;
    }

    try {
      // Example query for error rate
      const result = await this.query('rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100');
      
      if (result.length > 0 && result[0].value) {
        return parseFloat(result[0].value[1]);
      }
      
      return null;
    } catch (error) {
      console.error('Prometheus error rate error:', error);
      return null;
    }
  }

  async getTimeSeriesData(metric, range) {
    if (!this.enabled) {
      return [];
    }

    const now = new Date();
    let start, step;

    switch (range) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        step = '1m';
        break;
      case '6h':
        start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        step = '5m';
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        step = '15m';
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        step = '1h';
        break;
      default:
        start = new Date(now.getTime() - 60 * 60 * 1000);
        step = '1m';
    }

    try {
      const query = this.getMetricQuery(metric);
      const result = await this.queryRange(query, start, now, step);
      
      if (result.length > 0 && result[0].values) {
        return result[0].values.map(([timestamp, value]) => ({
          timestamp: new Date(timestamp * 1000),
          value: parseFloat(value)
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Prometheus time series error:', error);
      return [];
    }
  }

  getMetricQuery(metric) {
    const queries = {
      'operations': 'rate(s3_operations_total[5m])',
      'bucketsize': 's3_bucket_size_bytes',
      'latency': 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
      'errors': 'rate(http_requests_total{status=~"5.."}[5m])'
    };

    return queries[metric] || queries['operations'];
  }

  mapSeverity(severity) {
    const severityMap = {
      'critical': 'Critical',
      'warning': 'Warning',
      'info': 'Info'
    };

    return severityMap[severity?.toLowerCase()] || 'Info';
  }

  isEnabled() {
    return this.enabled;
  }
}

module.exports = new PrometheusService();