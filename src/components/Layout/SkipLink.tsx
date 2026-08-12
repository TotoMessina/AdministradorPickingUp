import React from 'react';

export const SkipLink: React.FC = () => {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        background: '#4f46e5',
        color: '#ffffff',
        padding: '0.75rem 1.25rem',
        borderRadius: '0 0 0.5rem 0.5rem',
        fontWeight: 800,
        fontSize: '0.875rem',
        textDecoration: 'none',
        zIndex: 10000,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        transition: 'top 0.15s ease'
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = '0px';
        e.currentTarget.style.left = '1rem';
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = '-9999px';
        e.currentTarget.style.left = '-9999px';
      }}
    >
      Saltar al contenido principal (Skip to main content)
    </a>
  );
};
