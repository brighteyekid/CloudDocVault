import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Image, 
  Upload, 
  Download, 
  Trash2, 
  UserCheck, 
  ShieldAlert 
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import StatCard from '../components/common/StatCard';
import Card from '../components/common/Card';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './Dashboard.css';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await apiService.dashboard.getSummary();
      setData(response.data);
    } catch (error) {
      showError('Failed to load dashboard data');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <Image size={14} className="file-icon file-icon--image" />;
    }
    if (['pdf'].includes(ext)) {
      return <FileText size={14} className="file-icon file-icon--pdf" />;
    }
    return <FileText size={14} className="file-icon file-icon--default" />;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Stored':
        return <Badge variant="success">STORED</Badge>;
      case 'Processing':
        return <Badge variant="warning">PROCESSING</Badge>;
      case 'Failed':
        return <Badge variant="danger">FAILED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'Upload':
        return <Upload size={14} />;
      case 'Download':
        return <Download size={14} />;
      case 'Delete':
        return <Trash2 size={14} />;
      case 'Login':
        return <UserCheck size={14} />;
      case 'Access Denied':
        return <ShieldAlert size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  const getActivityIconColor = (type) => {
    switch (type) {
      case 'Upload':
        return 'var(--color-accent-primary)';
      case 'Download':
        return 'var(--color-accent-cyan)';
      case 'Delete':
        return 'var(--color-status-danger)';
      case 'Login':
        return 'var(--color-status-success)';
      case 'Access Denied':
        return 'var(--color-status-warning)';
      default:
        return 'var(--color-text-muted)';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const documentColumns = [
    {
      key: 'name',
      title: 'NAME',
      render: (name) => (
        <div className="document-name">
          {getFileIcon(name)}
          <span className="font-mono">{name}</span>
        </div>
      )
    },
    {
      key: 'type',
      title: 'TYPE',
      render: (_, doc) => {
        const ext = doc.name.split('.').pop()?.toUpperCase() || 'FILE';
        return <Badge variant="neutral">{ext}</Badge>;
      }
    },
    {
      key: 'size',
      title: 'SIZE',
      render: (size) => <span className="font-mono text-sm">{formatFileSize(size)}</span>
    },
    {
      key: 'uploadedAt',
      title: 'UPLOADED',
      render: (date) => <span className="text-sm">{formatRelativeTime(date)}</span>
    },
    {
      key: 'status',
      title: 'STATUS',
      render: (status) => getStatusBadge(status)
    }
  ];

  if (loading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="dashboard-loading">
          <div className="stats-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
          <div className="dashboard-grid">
            <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
            <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Dashboard">
      <div className="dashboard">
        <div className="stats-grid">
          <StatCard
            label="Total Documents"
            value={data?.stats?.totalDocuments || '0'}
            accentColor="primary"
          />
          <StatCard
            label="Storage Used"
            value={data?.stats?.storageUsed || '0 GB'}
            accentColor="cyan"
          />
          <StatCard
            label="Uploads Today"
            value={data?.stats?.uploadsToday || '0'}
            accentColor="success"
          />
          <StatCard
            label="Access Denied (24h)"
            value={data?.stats?.accessDenied24h || '0'}
            accentColor="danger"
          />
        </div>

        <div className="dashboard-grid">
          <Card
            header="Recent Documents"
            headerActions={
              <Link to="/documents" className="card-link">
                View all
              </Link>
            }
          >
            {data?.recentDocuments?.length > 0 ? (
              <Table
                columns={documentColumns}
                data={data.recentDocuments}
                onRowClick={(doc) => window.open(`/documents/${encodeURIComponent(doc.key)}`, '_blank')}
              />
            ) : (
              <div className="empty-state">
                <FileText size={48} />
                <p>No documents yet</p>
              </div>
            )}
          </Card>

          <Card header="Activity">
            <div className="activity-feed">
              {data?.recentActivity?.length > 0 ? (
                <>
                  {data.recentActivity.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div 
                        className="activity-icon"
                        style={{ color: getActivityIconColor(activity.type) }}
                      >
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="activity-content">
                        <span className="activity-description">{activity.description}</span>
                        <span className="activity-time font-mono">{formatRelativeTime(activity.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="activity-footer">
                    <Link to="/logs" className="activity-link">
                      View full audit log
                    </Link>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <ShieldAlert size={48} />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Dashboard;