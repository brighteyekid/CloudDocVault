import React from 'react';
import './Badge.css';

const Badge = ({ 
  children, 
  variant = 'neutral',
  className = '',
  ...props 
}) => {
  const baseClass = 'badge';
  const variantClass = `badge--${variant}`;
  
  const classes = [baseClass, variantClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export default Badge;