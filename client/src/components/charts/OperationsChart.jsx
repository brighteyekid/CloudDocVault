import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Charts.css';

const OperationsChart = ({ data, timeRange }) => {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>No data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="chart-tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-accent-primary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-accent-primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-accent-cyan)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-accent-cyan)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis 
          dataKey="timestamp" 
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => value}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="uploads"
          stroke="var(--color-accent-primary)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorUploads)"
        />
        <Area
          type="monotone"
          dataKey="downloads"
          stroke="var(--color-accent-cyan)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorDownloads)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default OperationsChart;
