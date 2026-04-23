import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import Button from './Button';
import './Toast.css';

const Toast = ({ 
  id,
  type = 'info',
  title,
  message,
  onClose,
  autoClose = true,
  duration = 4000
}) => {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, onClose, autoClose, duration]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={16} />;
      case 'error':
        return <AlertCircle size={16} />;
      case 'warning':
        return <AlertTriangle size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const classes = [
    'toast',
    `toast--${type}`
  ].join(' ');

  return (
    <div className={classes}>
      <div className="toast__icon">
        {getIcon()}
      </div>
      <div className="toast__content">
        {title && <div className="toast__title">{title}</div>}
        <div className="toast__message">{message}</div>
      </div>
      <Button
        variant="ghost"
        onClick={() => onClose(id)}
        className="toast__close"
      >
        <X size={14} />
      </Button>
    </div>
  );
};

export default Toast;