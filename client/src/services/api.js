import axios from 'axios';
import { authService } from './auth';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = authService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await authService.refresh();
        const token = authService.getAccessToken();
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API endpoints
export const apiService = {
  // Auth endpoints
  auth: {
    login: (email, password) => api.post('/auth/login', { email, password }),
    logout: () => api.post('/auth/logout'),
    refresh: () => api.post('/auth/refresh')
  },

  // Dashboard endpoints
  dashboard: {
    getSummary: () => api.get('/dashboard/summary')
  },

  // Documents endpoints
  documents: {
    list: (params = {}) => api.get('/documents', { params }),
    get: (id) => api.get(`/documents/${encodeURIComponent(id)}`),
    delete: (id) => api.delete(`/documents/${encodeURIComponent(id)}`),
    getShareLink: (id) => api.get(`/documents/${encodeURIComponent(id)}/link`)
  },

  // Upload endpoints
  upload: {
    getPresignedUrl: (data) => api.post('/upload/presign', data),
    confirm: (key) => api.post('/upload/confirm', { key }),
    uploadToS3: (url, file, metadata) => {
      return axios.put(url, file, {
        headers: {
          'Content-Type': file.type,
          ...metadata
        }
      });
    }
  },

  // Logs endpoints
  logs: {
    list: (params = {}) => api.get('/logs', { params }),
    export: (params = {}) => api.get('/logs/export', { 
      params,
      responseType: 'blob'
    })
  },

  // Metrics endpoints
  metrics: {
    getSummary: () => api.get('/metrics/summary'),
    getTimeseries: (params = {}) => api.get('/metrics/timeseries', { params }),
    getAlerts: () => api.get('/metrics/alerts')
  },

  // Settings endpoints
  settings: {
    getProfile: () => api.get('/settings/profile'),
    updateProfile: (data) => api.put('/settings/profile', data),
    getSessions: () => api.get('/settings/sessions'),
    revokeSession: (deviceKey) => api.delete(`/settings/sessions/${deviceKey}`),
    getApiKeys: () => api.get('/settings/apikeys'),
    generateApiKey: (data) => api.post('/settings/apikeys', data),
    revokeApiKey: (keyId) => api.delete(`/settings/apikeys/${keyId}`)
  },

  // Health check
  health: () => api.get('/health')
};

export default api;