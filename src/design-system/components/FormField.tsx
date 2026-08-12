import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  error,
  helperText,
  required = false,
  children,
  style
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', ...style }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 'var(--ds-font-size-sm, 0.8125rem)',
          fontWeight: 'var(--ds-font-weight-extrabold, 800)',
          color: 'var(--text-main)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--ds-status-error, #ef4444)' }}>*</span>}
      </label>

      {children}

      {error ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          color: 'var(--ds-status-error, #ef4444)',
          fontSize: 'var(--ds-font-size-xs, 0.75rem)',
          fontWeight: 'var(--ds-font-weight-bold, 700)',
          marginTop: '0.1rem'
        }}>
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      ) : helperText ? (
        <div style={{
          fontSize: 'var(--ds-font-size-xs, 0.75rem)',
          color: 'var(--text-muted)',
          marginTop: '0.1rem'
        }}>
          {helperText}
        </div>
      ) : null}
    </div>
  );
};
