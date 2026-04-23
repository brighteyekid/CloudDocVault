import { useState, useEffect } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import StatCard from '../components/common/StatCard';
import Card from '../components/common/Card';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import OperationsChart from '../components/charts/OperationsChart';
import BucketSizeChart from '../components/charts/BucketSizeChart';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './Observability.css';

const Observability = () => {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const { showError } = useToast();

  useEffect(() => {
    loadObservabilityData();
  }, [timeRange]);

  const loadObservabilityData = async () => {
    try {
      setLoading(true);
      const [metricsResponse, alertsResponse] = await Promise.all([
        apiService.metrics.getSummary(),
        apiService.metrics.getAlerts()
      ]);
      setMetrics(metricsResponse.data);
      setAlerts(alertsResponse.data.alerts || []);
    } catch (error) {
      showError('Failed to load observability data');
      console.error('Observability error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getErrorRateColor = (rate) => {
    const numRate = parseFloat(rate) || 0;
    if (numRate < 1) return 'success';
    if (numRate <= 5) return 'warning';
    return 'danger';
  };

  const formatBytesToGB = (bytes) => {
    if (!bytes) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const formatPercentage = (value) => {
    if (!value) return '0%';
    const num = parseFloat(value);
    return `${num.toFixed(1)}%`;
  };

  // Mock chart data
  const operationsData = [
    { timestamp: '00:00', uploads: 12, downloads: 8 },
    { timestamp: '04:00', uploads: 18, downloads: 12 },
    { timestamp: '08:00', uploads: 24, downloads: 16 },
    { timestamp: '12:00', uploads: 32, downloads: 22 },
    { timestamp: '16:00', uploads: 28, downloads: 19 },
    { timestamp: '20:00', uploads: 22, downloads: 14 },
    { timestamp: '23:59', uploads: 16, downloads: 10 }
  ];

  const bucketSizeData = [
    { timestamp: '00:00', size: 45 },
    { timestamp: '06:00', size: 46 },
    { timestamp: '12:00', size: 48 },
    { timestamp: '18:00', size: 50 },
    { timestamp: '23:59', size: 52 }
  ];

  const alertColumns = [
    {
      key: 'severity',
      title: 'SEVERITY',
      render: (severity) => {
        const variant = severity === 'Critical' ? 'danger' : severity === 'Warning' ? 'warning' : 'neutral';
        return <Badge variant={variant}>{severity}</Badge>;
      }
    },
    {
      key: 'name',
      title: 'ALERT NAME',
      render: (name) => <span className="font-body text-sm">{name}</span>
    },
    {
      key: 'triggeredAt',
      title: 'TRIGGERED',
      render: (timestamp) => (
        <span className="font-mono text-xs">{new Date(timestamp).toLocaleString()}</span>
      )
    },
    {
      key: 'duration',
      title: 'DURATION',
      render: (duration) => <span className="font-mono text-xs">{duration || 'N/A'}</span>
    },
    {
      key: 'source',
      title: 'SOURCE',
      render: (source) => <span className="font-body text-sm">{source || 'CloudWatch'}</span>
    }
  ];

  if (loading) {
    return (
      <PageWrapper title="Observability">
        <div className="observability-loading">
          <div className="metrics-grid">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
          <div className="charts-grid">
            <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
            <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
          </div>
          <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Observability">
      <div className="observability-page">
        {/* Section A - Metric stat row */}
        <div className="metrics-grid">
          <StatCard
            label="API P95 Latency"
            value={metrics?.apiP95Latency || '0 ms'}
            accentColor="primary"
          />
          <StatCard
            label="Upload Error Rate"
            value={formatPercentage(metrics?.uploadErrorRate)}
            accentColor={getErrorRateColor(metrics?.uploadErrorRate)}
          />
          <StatCard
            label="Lambda Errors (24h)"
            value={metrics?.lambdaErrors24h || '0'}
            accentColor="cyan"
          />
          <StatCard
            label="CloudFront Cache Hit"
            value={formatPercentage(metrics?.cloudFrontCacheHit)}
            accentColor="success"
          />
          <StatCard
            label="Active Sessions"
            value={metrics?.activeSessions || '0'}
            accentColor="primary"
          />
        </div>

        {/* Section B - Two charts side by side */}
        <div className="charts-grid">
          <Card
            header="Document Operations"
            headerActions={
              <div className="time-range-toggle">
                {['1h', '6h', '24h', '7d'].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'primary' : 'ghost'}
                    onClick={() => setTimeRange(range)}
                    className="time-range-btn"
                  >
                    {range}
                  </Button>
                ))}
              </div>
            }
          >
            <OperationsChart data={operationsData} timeRange={timeRange} />
          </Card>

          <Card
            header="S3 Bucket Size"
            headerActions={
              <div className="time-range-toggle">
                {['1h', '6h', '24h', '7d'].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'primary' : 'ghost'}
                    onClick={() => setTimeRange(range)}
                    className="time-range-btn"
                  >
                    {range}
                  </Button>
                ))}
              </div>
            }
          >
            <BucketSizeChart data={bucketSizeData} />
          </Card>
        </div>

        {/* Section C - Alerts table */}
        <Card header="Active Alerts">
          {alerts.length === 0 ? (
            <div className="empty-state">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="empty-state__text">No active alerts</p>
            </div>
          ) : (
            <Table columns={alertColumns} data={alerts} />
          )}
        </Card>
      </div>
    </PageWrapper>
  );
};

export default Observability;
