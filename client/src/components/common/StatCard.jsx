import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import './StatCard.css';

const StatCard = ({ 
  label,
  value,
  trend,
  trendValue,
  accentColor = 'primary',
  className = '',
  ...props 
}) => {
  const classes = [
    'stat-card', 
    `stat-card--${accentColor}`,
    className
  ].filter(Boolean).join(' ');

  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const trendClass = trend === 'up' ? 'stat-card__trend--up' : 'stat-card__trend--down';

  return (
    <div className={classes} {...props}>
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        {trend && trendValue && (
          <div className={`stat-card__trend ${trendClass}`}>
            <TrendIcon size={12} />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className="stat-card__value">
        {value}
      </div>
    </div>
  );
};

export default StatCard;