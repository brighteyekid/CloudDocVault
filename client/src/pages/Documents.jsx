import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Image, 
  Grid3X3, 
  List, 
  Download, 
  Link as LinkIcon, 
  Trash2, 
  MoreHorizontal,
  FolderOpen
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/common/Card';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './Documents.css';

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [filter, setFilter] = useState('all'); // 'all', 'mine', 'shared'
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    loadDocuments();
  }, [filter, typeFilter, sortBy, page]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: view === 'grid' ? 24 : 20,
        scope: filter,
        sort: sortBy
      };
      
      if (typeFilter) {
        params.type = typeFilter;
      }

      const response = await apiService.documents.list(params);
      setDocuments(response.data.documents);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      showError('Failed to load documents');
      console.error('Documents error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await apiService.documents.delete(documentId);
      showSuccess('Document deleted successfully');
      loadDocuments();
    } catch (error) {
      showError('Failed to delete document');
    }
  };

  const handleCopyLink = async (documentId) => {
    try {
      const response = await apiService.documents.getShareLink(documentId);
      await navigator.clipboard.writeText(response.data.url);
      showSuccess('Link copied to clipboard');
    } catch (error) {
      showError('Failed to copy link');
    }
  };

  const getFileIcon = (filename, size = 40) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <Image size={size} className="file-icon file-icon--image" />;
    }
    if (['pdf'].includes(ext)) {
      return <FileText size={size} className="file-icon file-icon--pdf" />;
    }
    return <FileText size={size} className="file-icon file-icon--default" />;
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
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const documentColumns = [
    {
      key: 'select',
      title: '',
      width: '40px',
      render: () => <input type="checkbox" />
    },
    {
      key: 'name',
      title: 'NAME',
      render: (name, doc) => (
        <Link to={`/documents/${encodeURIComponent(doc.key)}`} className="document-link">
          <div className="document-name">
            {getFileIcon(name, 16)}
            <span className="font-mono">{name}</span>
          </div>
        </Link>
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
      key: 'uploadedBy',
      title: 'UPLOADED BY',
      render: (user) => <span className="text-sm">{user}</span>
    },
    {
      key: 'lastAccessed',
      title: 'LAST ACCESSED',
      render: (date) => <span className="text-sm">{date ? formatRelativeTime(date) : 'Never'}</span>
    },
    {
      key: 'actions',
      title: 'ACTIONS',
      width: '120px',
      render: (_, doc) => (
        <div className="document-actions">
          <Button variant="ghost" onClick={() => window.open(doc.downloadUrl)}>
            <Download size={16} />
          </Button>
          <Button variant="ghost" onClick={() => handleCopyLink(doc.key)}>
            <LinkIcon size={16} />
          </Button>
          <Button variant="ghost" onClick={() => handleDelete(doc.key)} className="text-danger">
            <Trash2 size={16} />
          </Button>
        </div>
      )
    }
  ];

  if (loading && documents.length === 0) {
    return (
      <PageWrapper title="Documents">
        <div className="documents-loading">
          <div className="documents-toolbar">
            <div className="skeleton" style={{ width: '200px', height: '36px' }} />
            <div className="skeleton" style={{ width: '300px', height: '36px' }} />
          </div>
          <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Documents">
      <div className="documents">
        <div className="documents-toolbar">
          <div className="documents-filters">
            <div className="filter-group">
              <button
                className={`filter-button ${filter === 'all' ? 'filter-button--active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-button ${filter === 'mine' ? 'filter-button--active' : ''}`}
                onClick={() => setFilter('mine')}
              >
                Mine
              </button>
              <button
                className={`filter-button ${filter === 'shared' ? 'filter-button--active' : ''}`}
                onClick={() => setFilter('shared')}
              >
                Shared
              </button>
            </div>
          </div>

          <div className="documents-controls">
            <select
              className="control-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All types</option>
              <option value="pdf">PDF</option>
              <option value="doc">Documents</option>
              <option value="img">Images</option>
              <option value="zip">Archives</option>
            </select>

            <select
              className="control-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="name">Sort: Name</option>
              <option value="size">Sort: Size</option>
            </select>

            <div className="view-toggle">
              <button
                className={`view-button ${view === 'grid' ? 'view-button--active' : ''}`}
                onClick={() => setView('grid')}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                className={`view-button ${view === 'list' ? 'view-button--active' : ''}`}
                onClick={() => setView('list')}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {documents.length === 0 ? (
          <Card>
            <div className="empty-state">
              <FolderOpen size={64} />
              <h3>No documents yet</h3>
              <p>Upload your first document to get started.</p>
              <Link to="/upload">
                <Button variant="primary">Upload document</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            {view === 'grid' ? (
              <div className="documents-grid">
                {documents.map((doc) => (
                  <Link
                    key={doc.key}
                    to={`/documents/${encodeURIComponent(doc.key)}`}
                    className="document-card"
                  >
                    <div className="document-card__icon">
                      {getFileIcon(doc.name)}
                    </div>
                    <div className="document-card__name font-mono">
                      {doc.name}
                    </div>
                    <div className="document-card__size font-mono">
                      {formatFileSize(doc.size)}
                    </div>
                    <div className="document-card__footer">
                      <span className="document-card__date">
                        {formatRelativeTime(doc.uploadedAt)}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          // Show dropdown menu
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <Table
                  columns={documentColumns}
                  data={documents}
                />
              </Card>
            )}

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
          </>
        )}
      </div>
    </PageWrapper>
  );
};

export default Documents;