import React from 'react';
import { Star, X, Play } from 'lucide-react';

export interface ActionItem {
  id?: string;
  name: string;
  slug: string;
  moduleName: string;
  moduleSlug: string;
  colorTheme: string;
  iconName: string;
}

interface FavoritesBarProps {
  favorites: ActionItem[];
  onRemoveFavorite: (actionSlug: string) => void;
  onExecuteAction: (action: ActionItem) => void;
  onOpenManageModal?: () => void;
}

export const FavoritesBar: React.FC<FavoritesBarProps> = ({
  favorites,
  onRemoveFavorite,
  onExecuteAction,
  onOpenManageModal
}) => {
  return (
    <div style={{
      marginBottom: '1.75rem',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: '1rem',
      padding: '1rem 1.25rem',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Star size={17} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
          <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
            Accesos Rápidos Favoritos
          </span>
        </div>

        <button
          onClick={onOpenManageModal}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--brand-blue)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          ✏️ Editar accesos
        </button>
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.625rem',
        alignItems: 'center'
      }}>
        {favorites.map((fav) => (
          <div
            key={fav.slug}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--brand-light-bg)',
              border: '1px solid var(--theme-purple-border)',
              borderRadius: '9999px',
              padding: '0.4rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--brand-blue)',
              transition: 'all 0.15s ease'
            }}
          >
            <button
              onClick={() => onExecuteAction(fav)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: 'inherit',
                fontWeight: 'inherit'
              }}
            >
              <span style={{ fontSize: '0.7rem' }}>▷</span>
              <span>{fav.name}</span>
            </button>

            <button
              onClick={() => onRemoveFavorite(fav.slug)}
              title="Quitar favorito"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-blue)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                marginLeft: '4px'
              }}
            >
              <X size={13} />
            </button>
          </div>
        ))}

        <button
          onClick={onOpenManageModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-light)',
            borderRadius: '9999px',
            padding: '0.4rem 1rem',
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: 'var(--brand-blue)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          + Agregar favorito
        </button>
      </div>
    </div>
  );
};
