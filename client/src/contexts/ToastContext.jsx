import React, { createContext, useContext, useReducer } from 'react';

const ToastContext = createContext();

const toastReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TOAST':
      return [...state, { ...action.payload, id: Date.now() + Math.random() }];
    case 'REMOVE_TOAST':
      return state.filter(toast => toast.id !== action.payload);
    case 'CLEAR_TOASTS':
      return [];
    default:
      return state;
  }
};

export const ToastProvider = ({ children }) => {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const addToast = (toast) => {
    dispatch({
      type: 'ADD_TOAST',
      payload: toast
    });
  };

  const removeToast = (id) => {
    dispatch({
      type: 'REMOVE_TOAST',
      payload: id
    });
  };

  const clearToasts = () => {
    dispatch({ type: 'CLEAR_TOASTS' });
  };

  // Convenience methods for different toast types
  const showSuccess = (message, title) => {
    addToast({ type: 'success', message, title });
  };

  const showError = (message, title) => {
    addToast({ type: 'error', message, title });
  };

  const showWarning = (message, title) => {
    addToast({ type: 'warning', message, title });
  };

  const showInfo = (message, title) => {
    addToast({ type: 'info', message, title });
  };

  const value = {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;