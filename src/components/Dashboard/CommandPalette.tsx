import React, { useState, useEffect } from 'react';
import { ActionItem } from './FavoritesBar';
import { MODULE_GROUPS } from './ModuleGrid';
import { APP_CONFIG } from '../../config/appConfig';
import { Search, Command, X, ArrowRight, CornerDownLeft } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: ActionItem) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectAction
}) => {
  const [query, setQuery] = useState('');

  // Collect all actions from all groups
  const allActions: ActionItem[] = MODULE_GROUPS.flatMap(g => g.actions);

  const filtered = allActions.filter(act =>
    act.name.toLowerCase().includes(query.toLowerCase()) ||
    act.moduleName.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or state
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '10vh',
      zIndex: 100
    }} onClick={onClose}>
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: '1.25rem',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <Search size={20} style={{ color: 'var(--brand-blue)' }} />
          <input
            type="text"
            autoFocus
            placeholder="Escriba un comando o busque una función (ej: Precios, Cierre)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              color: 'var(--text-main)',
              fontWeight: 500
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-app)',
              border: 'none',
              borderRadius: '0.375rem',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{
          maxHeight: '380px',
          overflowY: 'auto',
          padding: '0.5rem'
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No se encontraron coincidencias para "{query}"
            </div>
          ) : (
            filtered.map((act) => (
              <div
                key={act.slug}
                onClick={() => {
                  onSelectAction(act);
                  onClose();
                }}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.625rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-app)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '0.375rem',
                    background: `var(--theme-${act.colorTheme}-bg)`,
                    color: `var(--theme-${act.colorTheme})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 700
                  }}>
                    {act.moduleName.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {act.name}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      Módulo: {act.moduleName}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  <span>Ejecutar</span>
                  <CornerDownLeft size={13} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '0.625rem 1.25rem',
          background: 'var(--bg-app)',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.725rem',
          color: 'var(--text-muted)'
        }}>
          <span>Navegación rápida de {APP_CONFIG.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <kbd style={{ background: 'var(--bg-surface)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>ESC</kbd> para cerrar
          </span>
        </div>
      </div>
    </div>
  );
};
