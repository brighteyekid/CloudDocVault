import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import AuthGuard from './components/layout/AuthGuard';
import ToastContainer from './components/common/ToastContainer';
import { useToast } from './contexts/ToastContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentDetail from './pages/DocumentDetail';
import Upload from './pages/Upload';
import Logs from './pages/Logs';
import Observability from './pages/Observability';
import Settings from './pages/Settings';
import './styles/global.css';

function AppContent() {
  const { toasts, removeToast } = useToast();
  
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          } />
          <Route path="/documents" element={
            <AuthGuard>
              <Documents />
            </AuthGuard>
          } />
          <Route path="/documents/*" element={
            <AuthGuard>
              <DocumentDetail />
            </AuthGuard>
          } />
          <Route path="/upload" element={
            <AuthGuard>
              <Upload />
            </AuthGuard>
          } />
          <Route path="/logs" element={
            <AuthGuard>
              <Logs />
            </AuthGuard>
          } />
          <Route path="/observability" element={
            <AuthGuard>
              <Observability />
            </AuthGuard>
          } />
          <Route path="/settings" element={
            <AuthGuard>
              <Settings />
            </AuthGuard>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;