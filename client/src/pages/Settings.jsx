import React, { useState, useEffect } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Badge from '../components/common/Badge';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './Settings.css';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const [profileResponse, sessionsResponse, apiKeysResponse] = await Promise.all([
        apiService.settings.getProfile(),
        apiService.settings.getSessions(),
        apiService.settings.getApiKeys()
      ]);
      setProfileData(profileResponse.data);
      setSessions(sessionsResponse.data.sessions || []);
      setApiKeys(apiKeysResponse.data.apiKeys || []);
    } catch (error) {
      showError('Failed to load settings');
      console.error('Settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    try {
      await apiService.settings.updateProfile({ name: profileData.name });
      showSuccess('Profile updated successfully');
    } catch (error) {
      showError('Failed to update profile');
    }
  };

  const handleRevokeSession = async (deviceKey) => {
    try {
      await apiService.settings.revokeSession(deviceKey);
      setSessions(prev => prev.filter(s => s.deviceKey !== deviceKey));
      showSuccess('Session revoked successfully');
    } catch (error) {
      showError('Failed to revoke session');
    }
  };

  const handleGenerateApiKey = async () => {
    try {
      const response = await apiService.settings.generateApiKey({ name: 'New API Key' });
      setNewKeyData(response.data);
      setShowNewKeyModal(true);
      showSuccess('API key generated successfully');
    } catch (error) {
      showError('Failed to generate API key');
    }
  };

  const handleRevokeApiKey = async (keyId) => {
    try {
      await apiService.settings.revokeApiKey(keyId);
      setApiKeys(prev => prev.filter(k => k.keyId !== keyId));
      showSuccess('API key revoked successfully');
    } catch (error) {
      showError('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard');
  };

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'storage', label: 'Storage Preferences' },
    { id: 'apikeys', label: 'API Keys' }
  ];

  if (loading) {
    return (
      <PageWrapper title="Settings">
        <div className="settings-loading">
          <div className="settings-grid">
            <div className="skeleton" style={{ width: '220px', height: '400px', borderRadius: 'var(--radius-lg)' }} />
            <div className="skeleton" style={{ flex: 1, height: '400px', borderRadius: 'var(--radius-lg)' }} />
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Settings">
      <div className="settings-page">
        <div className="settings-grid">
          {/* Left column - Settings nav */}
          <div className="settings-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`settings-nav__item ${activeTab === tab.id ? 'settings-nav__item--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right column - Setting panels */}
          <div className="settings-content">
            {activeTab === 'profile' && (
              <Card header="Profile">
                <div className="profile-form">
                  <Input
                    label="Display name"
                    value={profileData?.name || ''}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your display name"
                  />
                  <Input
                    label="Email"
                    value={profileData?.email || ''}
                    disabled
                    placeholder="Read-only"
                  />
                  <div className="form-actions">
                    <Button variant="primary" onClick={handleProfileSave}>
                      Save changes
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card header="Security">
                <div className="security-panel">
                  <div className="security-row">
                    <div className="security-info">
                      <span className="security-label">Multi-factor authentication</span>
                      <span className="security-sublabel">Require MFA for all sign-ins</span>
                    </div>
                    <div className="toggle-switch">
                      <div className="toggle-switch__track">
                        <div className="toggle-switch__thumb" />
                      </div>
                    </div>
                  </div>

                  <div className="security-section">
                    <span className="security-section-label">Active sessions</span>
                    {sessions.length > 0 ? (
                      <div className="sessions-list">
                        {sessions.map((session) => (
                          <div key={session.deviceKey} className="session-item">
                            <div className="session-info">
                              <span className="session-device">{session.deviceName}</span>
                              <span className="session-ip font-mono">{session.lastIP}</span>
                              <span className="session-time font-mono">
                                Last seen: {new Date(session.lastSeen).toLocaleString()}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              onClick={() => handleRevokeSession(session.deviceKey)}
                              className="session-revoke"
                            >
                              Revoke
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <p>No active sessions</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card header="Notifications">
                <div className="notifications-list">
                  {[
                    { id: 'upload', label: 'Upload complete', sublabel: 'Receive notification when upload completes' },
                    { id: 'download', label: 'Download by another user', sublabel: 'Notify when someone downloads your document' },
                    { id: 'access-denied', label: 'Access denied event', sublabel: 'Alert when access is denied' },
                    { id: 'storage', label: 'Storage threshold reached', sublabel: 'Notify when storage usage exceeds 80%' },
                    { id: 'system', label: 'System alerts', sublabel: 'Important system notifications' }
                  ].map((notification) => (
                    <div key={notification.id} className="notification-item">
                      <div className="notification-info">
                        <span className="notification-label">{notification.label}</span>
                        <span className="notification-sublabel">{notification.sublabel}</span>
                      </div>
                      <div className="toggle-switch">
                        <div className="toggle-switch__track">
                          <div className="toggle-switch__thumb" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === 'storage' && (
              <Card header="Storage Preferences">
                <div className="storage-preferences">
                  <div className="storage-info">
                    <span className="storage-label">Current usage</span>
                    <span className="storage-value font-mono">
                      {profileData?.storageUsed || '0 GB'} / 100 GB
                    </span>
                  </div>
                  <div className="storage-progress">
                    <div 
                      className="storage-progress__bar"
                      style={{ width: '25%' }}
                    />
                  </div>
                  <p className="storage-sublabel">
                    Upgrade your storage plan in the billing section
                  </p>
                </div>
              </Card>
            )}

            {activeTab === 'apikeys' && (
              <Card header="API Keys">
                <div className="api-keys-panel">
                  {apiKeys.length > 0 ? (
                    <div className="api-keys-list">
                      <div className="api-keys-header">
                        <span className="api-keys-name">Name</span>
                        <span className="api-keys-created">Created</span>
                        <span className="api-keys-last-used">Last used</span>
                        <span className="api-keys-actions">Action</span>
                      </div>
                      {apiKeys.map((key) => (
                        <div key={key.keyId} className="api-key-item">
                          <span className="api-keys-name">{key.name}</span>
                          <span className="api-keys-created font-mono">
                            {new Date(key.createdAt).toLocaleDateString()}
                          </span>
                          <span className="api-keys-last-used font-mono">
                            {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                          </span>
                          <Button
                            variant="ghost"
                            onClick={() => handleRevokeApiKey(key.keyId)}
                            className="api-keys-revoke"
                          >
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No API keys yet</p>
                    </div>
                  )}
                  <div className="api-keys-actions">
                    <Button variant="primary" onClick={handleGenerateApiKey}>
                      Generate new key
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Modal for new API key */}
        {showNewKeyModal && newKeyData && (
          <Modal
            title="API Key Generated"
            onClose={() => setShowNewKeyModal(false)}
            footer={
              <>
                <Button variant="secondary" onClick={() => setShowNewKeyModal(false)}>
                  Close
                </Button>
                <Button variant="primary" onClick={() => copyToClipboard(newKeyData.key)}>
                  Copy
                </Button>
              </>
            }
          >
            <div className="new-key-modal">
              <div className="new-key-warning">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="new-key-warning__text">
                  This key will only be shown once. Please copy it now.
                </p>
              </div>
              <div className="new-key-display">
                <code className="new-key-code">{newKeyData.key}</code>
              </div>
              <p className="new-key-note">
                Store this key securely. You can use it to authenticate API requests.
              </p>
            </div>
          </Modal>
        )}
      </div>
    </PageWrapper>
  );
};

export default Settings;
