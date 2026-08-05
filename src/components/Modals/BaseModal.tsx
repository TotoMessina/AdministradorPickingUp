import React, { useEffect, useState, useRef } from 'react';
import { X, AlertCircle, Trash2, CheckCircle2, SlidersHorizontal, ChevronRight, Barcode, Calendar } from 'lucide-react';

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  variant?: 'default' | 'creation' | 'confirmation' | 'filters' | 'info' | 'options';
  maxWidth?: string; // e.g. '640px'
  children?: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  variant = 'default',
  maxWidth = '640px',
  children,
  footer,
  icon
}) => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    try {
      return window.innerWidth < 768;
    } catch {
      return false;
    }
  });

  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Touch drag handle for mobile bottom sheet
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 100) {
      onClose();
    }
    setStartY(null);
    setCurrentY(0);
  };

  if (!isOpen) return null;

  // --- Mobile View: Bottom Sheet Layout ---
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(6px)',
          zIndex: 1300,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}
        onClick={onClose}
        className="animate-fade-in"
      >
        <div
          ref={sheetRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxHeight: '90vh',
            background: '#ffffff',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transform: `translateY(${currentY}px)`,
            transition: startY === null ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
          }}
        >
          {/* Top Drag Handle Pill */}
          <div style={{
            width: '36px',
            height: '4px',
            borderRadius: '99px',
            background: '#cbd5e1',
            margin: '8px auto 4px auto',
            flexShrink: 0
          }} />

          {/* Mobile Header */}
          <div style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {icon}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  {title}
                </h3>
                {subtitle && (
                  <p style={{ fontSize: '0.725rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Scrollable Body */}
          <div style={{
            padding: '1.25rem',
            overflowY: 'auto',
            flex: 1,
            WebkitOverflowScrolling: 'touch'
          }}>
            {children}
          </div>

          {/* Mobile Footer */}
          {footer && (
            <div style={{
              padding: '1rem 1.25rem',
              background: '#ffffff',
              borderTop: '1px solid #f1f5f9',
              flexShrink: 0
            }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Web View: Centered Modal Layout (Max width 640px) ---
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
      onClick={onClose}
      className="animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: maxWidth || '640px',
          maxHeight: '88vh',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalScale 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style>{`
          @keyframes modalScale {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* Web Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {icon}
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {title}
              </h3>
              {subtitle && (
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            className="hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Web Scrollable Content */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1
        }}>
          {children}
        </div>

        {/* Web Footer */}
        {footer && (
          <div style={{
            padding: '1rem 1.5rem',
            background: '#ffffff',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            flexShrink: 0
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
