import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Download, Link as LinkIcon, Trash2, ArrowLeft } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './DocumentDetail.css';

const DocumentDetail = () => {
  const location = useLocation();
  // Extract the key from the path after /documents/
  const id = decodeURIComponent(location.pathname.replace('/documents/', ''));
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await apiService.documents.get(id);
      setDocument(response.data);
    } catch (error) {
      showError('Failed to load document');
      console.error('Document detail error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const response = await apiService.documents.getShareLink(id);
      await navigator.clipboard.writeText(response.data.url);
      showSuccess('Link copied to clipboard');
    } catch (error) {
      showError('Failed to copy link');
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await apiService.documents.delete(id);
      showSuccess('Document deleted successfully');
      // Navigate back to documents list
      window.history.back();
    } catch (error) {
      showError('Failed to delete document');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <PageWrapper title="Document Details">
        <div className="document-detail-loading">
          <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </PageWrapper>
    );
  }

  if (!document) {
    return (
      <PageWrapper title="Document Not Found">
        <Card>
          <div className="empty-state">
            <h3>Document not found</h3>
            <p>The requested document could not be found.</p>
            <Link to="/documents">
              <Button variant="primary">Back to Documents</Button>
            </Link>
          </div>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title={document.name}>
      <div className="document-detail">
        <div className="document-detail__header">
          <Link to="/documents" className="back-link">
            <ArrowLeft size={16} />
            Back to Documents
          </Link>
        </div>

        <div className="document-detail__grid">
          <Card
            header={document.name}
            headerActions={
              <div className="document-actions">
                <Button 
                  variant="primary" 
                  onClick={() => window.open(document.presignedUrl)}
                >
                  <Download size={16} />
                  Download
                </Button>
                <Button variant="ghost" onClick={handleCopyLink}>
                  <LinkIcon size={16} />
                  Copy link
                </Button>
              </div>
            }
          >
            <div className="document-preview">
              {document.type === 'pdf' ? (
                <iframe
                  src={document.presignedUrl}
                  className="document-preview__iframe"
                  title="Document Preview"
                />
              ) : document.type && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(document.type) ? (
                <img
                  src={document.presignedUrl}
                  alt={document.name}
                  className="document-preview__image"
                />
              ) : (
                <div className="document-preview__placeholder">
                  <div className="preview-unavailable">
                    <div className="preview-unavailable__icon">📄</div>
                    <p>Preview not available</p>
                    <Button variant="secondary" onClick={() => window.open(document.presignedUrl)}>
                      Download to view
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="document-sidebar">
            <Card header="File Information">
              <div className="document-info">
                <div className="info-row">
                  <span className="info-label">File name</span>
                  <span className="info-value font-mono">{document.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Type</span>
                  <span className="info-value font-mono">{document.type?.toUpperCase() || 'UNKNOWN'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Size</span>
                  <span className="info-value font-mono">{formatFileSize(document.size)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Uploaded</span>
                  <span className="info-value font-mono">{formatDate(document.lastModified)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Uploaded by</span>
                  <span className="info-value font-mono">{document.uploadedBy}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">S3 Key</span>
                  <span className="info-value font-mono" title={document.key}>
                    {document.key.length > 30 ? document.key.substring(0, 30) + '...' : document.key}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Storage class</span>
                  <span className="info-value font-mono">{document.storageClass}</span>
                </div>
              </div>
            </Card>

            <Card header="Access History">
              <div className="access-history">
                {document.accessHistory && document.accessHistory.length > 0 ? (
                  document.accessHistory.map((event, index) => (
                    <div key={index} className="access-event">
                      <div className="access-event__time font-mono">
                        {formatDate(event.timestamp)}
                      </div>
                      <div className="access-event__action">
                        {event.action}
                      </div>
                      <div className="access-event__user">
                        {event.user}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-access">
                    <p>No access history available</p>
                  </div>
                )}
              </div>
            </Card>

            <Button 
              variant="danger" 
              className="delete-button"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 size={16} />
              Delete document
            </Button>
          </div>
        </div>

        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete document"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button 
                variant="danger" 
                onClick={handleDelete}
                loading={deleting}
              >
                Yes, delete
              </Button>
            </>
          }
        >
          <p>
            This action cannot be undone. The file will be permanently deleted from S3 
            and all versions will be removed.
          </p>
        </Modal>
      </div>
    </PageWrapper>
  );
};

export default DocumentDetail;