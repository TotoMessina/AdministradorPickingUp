import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Sparkles, HelpCircle } from 'lucide-react';

export type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'purple' | 'neutral';

export interface StatusBadgeProps {
  status: StatusBadgeVariant;
  label: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

const variantStyles: Record<StatusBadgeVariant, { bg: string; color: string; border: string; defaultIcon: React.ReactNode }> = {
  success: {
    bg: 'var(--ds-status-success-bg, rgba(16, 185, 129, 0.12))',
    color: 'var(--ds-status-success, #10b981)',
    border: 'var(--ds-status-success-border, rgba(16, 185, 129, 0.3))',
    defaultIcon: <CheckCircle2 size={13} />
  },
  warning: {
    bg: 'var(--ds-status-warning-bg, rgba(245, 158, 11, 0.12))',
    color: 'var(--ds-status-warning, #f59e0b)',
    border: 'var(--ds-status-warning-border, rgba(245, 158, 11, 0.3))',
    defaultIcon: <AlertTriangle size={13} />
  },
  error: {
    bg: 'var(--ds-status-error-bg, rgba(239, 68, 68, 0.12))',
    color: 'var(--ds-status-error, #ef4444)',
    border: 'var(--ds-status-error-border, rgba(239, 68, 68, 0.3))',
    defaultIcon: <AlertCircle size={13} />
  },
  info: {
    bg: 'var(--ds-status-info-bg, rgba(59, 130, 246, 0.12))',
    color: 'var(--ds-status-info, #3b82f6)',
    border: 'var(--ds-status-info-border, rgba(59, 130, 246, 0.3))',
    defaultIcon: <Info size={13} />
  },
  purple: {
    bg: 'var(--ds-status-purple-bg, rgba(139, 92, 246, 0.12))',
    color: 'var(--ds-status-purple, #8b5cf6)',
    border: 'var(--ds-status-purple-border, rgba(139, 92, 246, 0.3))',
    defaultIcon: <Sparkles size={13} />
  },
  neutral: {
    bg: 'var(--ds-status-neutral-bg, rgba(100, 116, 139, 0.12))',
    color: 'var(--ds-status-neutral, #64748b)',
    border: 'var(--ds-status-neutral-border, rgba(100, 116, 139, 0.3))',
    defaultIcon: <HelpCircle size={13} />
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  icon,
  size = 'md',
  style
}) => {
  const config = variantStyles[status] || variantStyles.neutral;
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '0.25rem' : '0.35rem',
        padding: isSm ? '0.15rem 0.5rem' : '0.25rem 0.65rem',
        borderRadius: 'var(--ds-radius-full, 9999px)',
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        fontSize: isSm ? 'var(--ds-font-size-xs, 0.75rem)' : 'var(--ds-font-size-sm, 0.8125rem)',
        fontWeight: 'var(--ds-font-weight-extrabold, 800)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      {icon !== undefined ? icon : config.defaultIcon}
      {label}
    </span>
  );
};
