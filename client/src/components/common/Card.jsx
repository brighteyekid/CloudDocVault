import React from 'react';
import './Card.css';

const Card = ({ 
  children, 
  className = '',
  header,
  headerActions,
  ...props 
}) => {
  const classes = ['card', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {header && (
        <div className="card__header">
          <h3 className="card__title">{header}</h3>
          {headerActions && (
            <div className="card__actions">
              {headerActions}
            </div>
          )}
        </div>
      )}
      <div className="card__body">
        {children}
      </div>
    </div>
  );
};

export default Card;