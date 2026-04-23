import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/common/Card';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './Logs.css';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startTime: '',
    endTime: '',
    action: '',
    user: ''
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 50,
        ...filters
      };

      const response = await apiService.logs.list(params);
      setLogs(response.data.events);
      setTotalPages(response.data.totalPages);
      setTotalEvents(response.data.total);
    } catch (error) {
      showError('Failed to load access logs');
      console.error('Logs error:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setPage(1);
    loadLogs();
  };

  const clearFilters = () => {
    setFilters({
      startTime: '',
      endTime: '',
      action: '',
      user: ''
    });
    setPage(1);
    setTimeout(loadLogs, 0);
  };

  const exportLogs = async (format) => {
    try {
      const response = await apiService.logs.export({
        ...filters,
        format
      });
      
      const blob = new Blob([response.data], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `access-logs.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showSuccess(`Logs exported as ${format.toUpperCase()}`);
    } catch (error) {
      showError('Failed to export logs');
    }
  };

  const getActionBadge = (action, result) => {
    if (result !== 'Success') {
      return <Badge variant="danger">{action}</Badge>;
    }
    
    switch (action) {
      case 'Upload':
        return <Badge variant="success">UPLOAD</Badge>;
      case 'Download':
        return <Badge variant="neutral">DOWNLOAD</Badge>;
      case 'Delete':
        return <Badge variant="warning">DELETE</Badge>;
      case 'Login':
        return <Badge variant="success">LOGIN</Badge>;
      default:
        return <Badge variant="neutral">{action}</Badge>;
    }
  };

  const getResultBadge = (result) => {
    return result === 'Success' 
      ? <Badge variant="success">SUCCESS</Badge>
      : <Badge variant="danger">FAILED</Badge>;
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateResource = (resource, maxLength = 30) => {
    if (!resource || resource.length <= maxLength) return resource;
    return resource.substring(0, maxLength) + '...';
  };

  const logColumns = [
    {
      key: 'timestamp',
      title: 'TIMESTAMP',
      render: (timestamp) => (
        <span className="font-mono text-sm">{formatTimestamp(timestamp)}</span>
      )
    },
    {
      key: 'user',
      title: 'USER',
      render: (user) => <span className="text-sm">{user}</span>
    },
    {
      key: 'action',
      title: 'ACTION',
      render: (action, log) => getActionBadge(action, log.result)
    },
    {
      key: 'resource',
      title: 'RESOURCE',
      render: (resource) => (
        <span 
          className="font-mono text-sm resource-cell" 
          title={resource}
        >
          {truncateResource(resource)}
        </span>
      )
    },
    {
      key: 'sourceIp',
      title: 'SOURCE IP',
      render: (ip) => <span className="font-mono text-sm">{ip}</span>
    },
    {
      key: 'result',
      title: 'RESULT',
      render: (result) => getResultBadge(result)
    }
  ];

  return (
    <PageWrapper title="Access Logs">
      <div className="logs-page">
        <div className="logs-filters">
          <div className="filter-row">
            <Input
              label="From"
              type="datetime-local"
              value={filters.startTime}
              onChange={(e) => setFilters(prev => ({ ...prev, startTime: e.target.value }))}
              className="filter-input"
            />
            <Input
              label="To"
              type="datetime-local"
              value={filters.endTime}
              onChange={(e) => setFilters(prev => ({ ...prev, endTime: e.target.value }))}
              className="filter-input"
            />
            <div className="form-field">
              <label className="form-label">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                className="filter-select"
              >
                <option value="">All actions</option>
                <option value="Upload">Upload</option>
                <option value="Download">Download</option>
                <option value="Delete">Delete</option>
                <option value="Access denied">Access denied</option>
                <option value="Login">Login</option>
              </select>
            </div>
            <Input
              label="User"
              placeholder="Filter by user"
              value={filters.user}
              onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
              className="filter-input"
            />
            <div className="filter-actions">
              <Button variant="primary" onClick={applyFilters}>
                Apply filters
              </Button>
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>
          
          <div className="logs-meta">
            <Badge variant="neutral">{totalEvents} events</Badge>
            <div className="export-actions">
              <span className="export-label">Export as</span>
              <Button variant="ghost" onClick={() => exportLogs('csv')}>
                CSV
              </Button>
              <Button variant="ghost" onClick={() => exportLogs('json')}>
                JSON
              </Button>
            </div>
          </div>
        </div>

        <Card>
          {loading ? (
            <div className="logs-loading">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '52px', margin: '0 var(--space-6) var(--space-2)' }} />
              ))}
            </div>
          ) : (
            <Table
              columns={logColumns}
              data={logs}
            />
          )}
        </Card>

        {totalPages > 1 && (
          <div className="pagination">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="pagination-info">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default Logs;