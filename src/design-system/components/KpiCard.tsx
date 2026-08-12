import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type KpiTrend = 'up' | 'down' | 'neutral';

export interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: KpiTrend;
  subtitle?: string;
  icon?: React.ReactNode;
  colorTheme?: 'blue' | 'green' | 'purple' | 'orange' | 'rose' | 'sky';
  style?: React.CSSProperties;
}

const themeColors: Record<string, { accent: string; bg: string }> = {
  blue: { accent: '#4f46e5', bg: 'rgba(79, 70, 229, 0.12)' },
  green: { accent: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  purple: { accent: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  orange: { accent: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  rose: { accent: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)' },
  sky: { accent: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)' }
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  change,
  trend = 'neutral',
  subtitle,
  icon,
  colorTheme = 'blue',
  style
}) => {
  const theme = themeColors[colorTheme] || themeColors.blue;

  const isUp = trend === 'up';
  const isDown = trend === 'down';

  const trendBg = isUp ? 'rgba(16, 185, 129, 0.15)' : isDown ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-app)';
  const trendColor = isUp ? '#10b981' : isDown ? '#ef4444' : 'var(--text-muted)';
  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--ds-radius-lg, 0.75rem)',
        padding: '1.25rem',
        boxShadow: 'var(--ds-shadow-sm, 0 2px 8px rgba(0,0,0,0.04))',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--ds-font-size-sm, 0.8125rem)', fontWeight: 'var(--ds-font-weight-bold, 700)', color: 'var(--text-muted)' }}>
          {title}
        </span>
        {icon && (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--ds-radius-md, 0.5rem)',
              background: theme.bg,
              color: theme.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ fontSize: 'var(--ds-font-size-2xl, 1.5rem)', fontWeight: 'var(--ds-font-weight-black, 900)', color: 'var(--text-main)' }}>
          {value}
        </div>

        {change && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              padding: '0.15rem 0.5rem',
              borderRadius: 'var(--ds-radius-full, 9999px)',
              background: trendBg,
              color: trendColor,
              fontWeight: 'var(--ds-font-weight-extrabold, 800)',
              fontSize: 'var(--ds-font-size-xs, 0.75rem)'
            }}
          >
            <TrendIcon size={12} />
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <div style={{ fontSize: 'var(--ds-font-size-xs, 0.75rem)', color: 'var(--text-muted)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};
