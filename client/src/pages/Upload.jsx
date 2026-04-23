import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileText, 
  Image, 
  X, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './Upload.css';

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [metadata, setMetadata] = useState({
    tags: [],
    description: '',
    accessLevel: 'private'
  });
  const [dragOver, setDragOver] = useState(false);
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const supportedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/zip',
    'text/plain'
  ];

  const maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB

  const validateFile = (file) => {
    if (!supportedTypes.includes(file.type)) {
      return 'Unsupported file type';
    }
    if (file.size > maxFileSize) {
      return 'File too large (max 5GB)';
    }
    return null;
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    const validFiles = newFiles.map(file => {
      const error = validateFile(file);
      return {
        file,
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        status: error ? 'error' : 'pending',
        progress: 0,
        error
      };
    });

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setMetadata({
      tags: [],
      description: '',
      accessLevel: 'private'
    });
  };

  const addTag = (tag) => {
    if (tag && !metadata.tags.includes(tag)) {
      setMetadata(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const removeTag = (tagToRemove) => {
    setMetadata(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagInput = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(e.target.value.trim());
      e.target.value = '';
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const validFiles = files.filter(f => f.status !== 'error');

    try {
      for (const fileItem of validFiles) {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, status: 'uploading', progress: 0 }
            : f
        ));

        // Get presigned URL
        const presignResponse = await apiService.upload.getPresignedUrl({
          filename: fileItem.name,
          contentType: fileItem.type,
          size: fileItem.size,
          metadata: {
            tags: metadata.tags.join(','),
            description: metadata.description,
            accessLevel: metadata.accessLevel
          }
        });

        const { uploadUrl, key } = presignResponse.data;

        // Upload to S3 (metadata already included in presigned URL)
        await apiService.upload.uploadToS3(uploadUrl, fileItem.file, {});

        // Update progress
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, progress: 100 }
            : f
        ));

        // Confirm upload
        await apiService.upload.confirm(key);

        // Update status to complete
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, status: 'complete' }
            : f
        ));
      }

      setUploadComplete(true);
      showSuccess('All files uploaded successfully');
    } catch (error) {
      showError('Upload failed: ' + (error.message || 'Unknown error'));
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) {
      return <Image size={24} className="file-icon file-icon--image" />;
    }
    return <FileText size={24} className="file-icon file-icon--default" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle size={16} className="status-icon status-icon--success" />;
      case 'error':
        return <AlertCircle size={16} className="status-icon status-icon--error" />;
      default:
        return null;
    }
  };

  if (uploadComplete) {
    return (
      <PageWrapper title="Upload Document">
        <div className="upload-success">
          <Card>
            <div className="upload-success__content">
              <CheckCircle size={48} className="upload-success__icon" />
              <h2 className="upload-success__title">Upload complete</h2>
              <p className="upload-success__subtitle">
                All files have been securely stored.
              </p>
              <div className="upload-success__actions">
                <Button 
                  variant="primary" 
                  onClick={() => navigate('/documents')}
                >
                  View documents
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setUploadComplete(false);
                    clearAll();
                  }}
                >
                  Upload more
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Upload Document">
      <div className="upload-page">
        <div className="upload-container">
          <div
            className={`drop-zone ${dragOver ? 'drop-zone--active' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <UploadCloud size={48} className="drop-zone__icon" />
            <h3 className="drop-zone__title">Drag and drop files here</h3>
            <p className="drop-zone__subtitle">or</p>
            <Button variant="secondary" onClick={() => document.getElementById('file-input').click()}>
              Browse files
            </Button>
            <input
              id="file-input"
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept={supportedTypes.join(',')}
            />
          </div>

          <p className="upload-formats">
            PDF, DOCX, XLSX, PNG, JPG, ZIP — max 5 GB per file
          </p>

          {files.length > 0 && (
            <Card header={`Selected files (${files.length})`}>
              <div className="file-queue">
                {files.map((fileItem) => (
                  <div key={fileItem.id} className="file-item">
                    <div className="file-item__icon">
                      {getFileIcon(fileItem.type)}
                    </div>
                    <div className="file-item__info">
                      <div className="file-item__name font-mono">
                        {fileItem.name}
                      </div>
                      <div className="file-item__size font-mono">
                        {formatFileSize(fileItem.size)}
                      </div>
                      {fileItem.error && (
                        <div className="file-item__error">
                          {fileItem.error}
                        </div>
                      )}
                    </div>
                    <div className="file-item__progress">
                      {fileItem.status === 'uploading' && (
                        <div className="progress-bar">
                          <div 
                            className="progress-bar__fill"
                            style={{ width: `${fileItem.progress}%` }}
                          />
                        </div>
                      )}
                      <div className="file-item__status">
                        {getStatusIcon(fileItem.status)}
                        {fileItem.status === 'uploading' && (
                          <span className="font-mono text-xs">{fileItem.progress}%</span>
                        )}
                      </div>
                    </div>
                    {fileItem.status === 'pending' && (
                      <Button
                        variant="ghost"
                        onClick={() => removeFile(fileItem.id)}
                        className="file-item__remove"
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {files.length > 0 && (
            <Card header="Document metadata">
              <div className="metadata-form">
                <div className="form-field">
                  <label className="form-label">Tags</label>
                  <div className="tag-input">
                    <div className="tag-list">
                      {metadata.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="tag__remove"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Type and press Enter to add tags"
                      onKeyDown={handleTagInput}
                      className="tag-input__field"
                    />
                  </div>
                </div>

                <Input
                  label="Description"
                  value={metadata.description}
                  onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />

                <div className="form-field">
                  <label className="form-label">Access level</label>
                  <select
                    value={metadata.accessLevel}
                    onChange={(e) => setMetadata(prev => ({ ...prev, accessLevel: e.target.value }))}
                    className="form-select"
                  >
                    <option value="private">Private (only me)</option>
                    <option value="team">Team</option>
                    <option value="organisation">Organisation</option>
                  </select>
                </div>
              </div>
            </Card>
          )}

          {files.length > 0 && (
            <div className="upload-actions">
              <Button variant="secondary" onClick={clearAll}>
                Clear all
              </Button>
              <Button 
                variant="primary" 
                onClick={uploadFiles}
                loading={uploading}
                disabled={uploading || files.every(f => f.status === 'error')}
              >
                Upload now
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
};

export default Upload;