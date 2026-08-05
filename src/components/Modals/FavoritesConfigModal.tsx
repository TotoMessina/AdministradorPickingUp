import React, { useState } from 'react';
import { ActionItem } from '../Dashboard/FavoritesBar';
import { MODULE_GROUPS } from '../Dashboard/ModuleGrid';
import { Star, X, Check, Search, Save, Sparkles, Plus } from 'lucide-react';

interface FavoritesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: ActionItem[];
  onToggleFavorite: (action: ActionItem) => void;
}

export const FavoritesConfigModal: React.FC<FavoritesConfigModalProps> = ({
  isOpen,
  onClose,
  favorites,
  onToggleFavorite
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const favoriteSlugs = new Set(favorites.map(f => f.slug));

  const allActions = MODULE_GROUPS.flatMap(g => g.actions.map(act => ({
    ...act,
    groupName: g.name
  })));

  const filteredActions = allActions.filter(act =>
    act.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    act.moduleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    act.groupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '85vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--text-main)'
      }} className="animate-fade-in">

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Star size={24} style={{ fill: '#ffffff' }} />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>⚙️ Configurar Accesos Rápidos Favoritos</h2>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Seleccioná las acciones que deseás tener en la barra superior</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Search & Counter Bar */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filtrar acciones por nombre o módulo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: '0.85rem'
              }}
            />
          </div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--brand-blue)', whiteSpace: 'nowrap' }}>
            ⭐ {favorites.length} accesos activos
          </div>
        </div>

        {/* Actions Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {filteredActions.map(act => {
            const isFav = favoriteSlugs.has(act.slug);
            return (
              <div
                key={act.slug}
                onClick={() => onToggleFavorite(act)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  border: isFav ? '2px solid #f59e0b' : '1px solid var(--border-light)',
                  background: isFav ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isFav ? '#d97706' : 'var(--text-main)' }}>
                    {act.name}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    {act.groupName}
                  </div>
                </div>

                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: isFav ? '#f59e0b' : 'var(--bg-app)',
                  color: isFav ? '#ffffff' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isFav ? 'none' : '1px solid var(--border-light)'
                }}>
                  {isFav ? <Star size={14} style={{ fill: '#ffffff' }} /> : <Plus size={14} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-app)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#f59e0b',
              color: '#ffffff',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Check size={16} /> Guardar Configuración
          </button>
        </div>

      </div>
    </div>
  );
};
