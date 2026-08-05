import React, { useState } from 'react';
import { useTenant, Store } from '../../context/TenantContext';
import { APP_CONFIG } from '../../config/appConfig';
import {
  Building2,
  CheckCircle2,
  Search,
  Plus,
  Shield,
  Layers,
  ArrowRight,
  X,
  Sparkles,
  Check,
  Store as StoreIcon
} from 'lucide-react';

interface StoreSelectorProps {
  isModal?: boolean;
  onClose?: () => void;
}

export const StoreSelector: React.FC<StoreSelectorProps> = ({ isModal = false, onClose }) => {
  const { stores, activeStore, setActiveStore, createNewStore } = useTenant();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStorePlan, setNewStorePlan] = useState<'standard' | 'pro' | 'enterprise'>('enterprise');
  const [isSubmittingStore, setIsSubmittingStore] = useState(false);

  const filteredStores = stores.filter(
    s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectStore = (store: Store) => {
    setActiveStore(store);
    if (onClose) onClose();
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    setIsSubmittingStore(true);
    try {
      await createNewStore(newStoreName, newStoreCode, newStorePlan);
    } catch (err) {
      console.error('Error creating store:', err);
    } finally {
      setIsSubmittingStore(false);
      setShowCreateModal(false);
      setNewStoreName('');
      setNewStoreCode('');
      if (onClose) onClose();
    }
  };

  const getPlanBadge = (plan: Store['plan']) => {
    switch (plan) {
      case 'enterprise':
        return { label: 'ENTERPRISE', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' };
      case 'pro':
        return { label: 'PRO', bg: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.3)' };
      default:
        return { label: 'STANDARD', bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', border: 'rgba(100, 116, 139, 0.3)' };
    }
  };

  const content = (
    <div style={{
      width: '100%',
      maxWidth: isModal ? '680px' : '900px',
      margin: '0 auto',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: '1.25rem',
      padding: '2rem',
      boxShadow: 'var(--shadow-lg)',
      backdropFilter: 'blur(16px)',
      position: 'relative',
      fontFamily: 'var(--font-main)'
    }}>
      {/* Modal Close Button */}
      {isModal && onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-light)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          <X size={18} />
        </button>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '1rem',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
          border: '1px solid rgba(2, 132, 199, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--brand-blue)',
          margin: '0 auto 1rem'
        }}>
          <Building2 size={28} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
          Selecciona tu Comercio
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Tenés acceso a {stores.length} comercios configurados en tu cuenta corporativa.
        </p>
      </div>

      {/* Search & Actions Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o código de sucursal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.75rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.75rem',
              color: 'var(--text-main)',
              fontSize: '0.875rem',
              outline: 'none'
            }}
          />
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: 'linear-gradient(135deg, var(--brand-blue) 0%, #0369a1 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.75rem',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
          }}
        >
          <Plus size={16} />
          Nuevo Comercio
        </button>
      </div>

      {/* Store Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
        maxHeight: '400px',
        overflowY: 'auto',
        paddingRight: '4px'
      }}>
        {filteredStores.map(store => {
          const isActive = activeStore?.id === store.id;
          const planBadge = getPlanBadge(store.plan);

          return (
            <div
              key={store.id}
              onClick={() => handleSelectStore(store)}
              style={{
                padding: '1.25rem',
                borderRadius: '1rem',
                background: isActive ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-card)',
                border: isActive
                  ? '2px solid var(--brand-blue)'
                  : '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              {/* Card Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '0.625rem',
                    background: isActive ? 'var(--brand-blue)' : 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? '#ffffff' : 'var(--brand-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1rem'
                  }}>
                    {store.name.charAt(0)}
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '9999px',
                      background: planBadge.bg,
                      color: planBadge.color,
                      border: `1px solid ${planBadge.border}`
                    }}>
                      {planBadge.label}
                    </span>

                    {isActive && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#10b981',
                        color: '#ffffff'
                      }}>
                        <Check size={14} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Store Name & Code */}
                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.25rem', color: 'var(--text-main)' }}>
                  {store.name}
                </h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>CÓD: {store.code}</span>
                  <span>•</span>
                  <span style={{ color: 'var(--brand-blue)' }}>{store.user_role || 'Administrador'}</span>
                </div>
              </div>

              {/* Card Footer Button */}
              <div style={{
                marginTop: '1.25rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: isActive ? 'var(--brand-blue)' : 'var(--text-muted)'
              }}>
                <span>{isActive ? 'COMERCIO ACTIVO' : 'SELECCIONAR'}</span>
                <ArrowRight size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: New Store Form */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            padding: '1.75rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Alta de Nuevo Comercio</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateStore}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                  NOMBRE DEL COMERCIO / RAZÓN SOCIAL *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: SUPERMERCADO EL SOL S.R.L."
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-main)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                  CÓDIGO INTERNO DE SUCURSAL
                </label>
                <input
                  type="text"
                  placeholder="Ej: SOL-001"
                  value={newStoreCode}
                  onChange={(e) => setNewStoreCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-main)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                  PLAN ENTERPRISE / LICENCIA
                </label>
                <select
                  value={newStorePlan}
                  onChange={(e: any) => setNewStorePlan(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-main)',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="enterprise">Enterprise (Todos los Módulos {APP_CONFIG.shortName})</option>
                  <option value="pro">Pro (Precios, Inventario, Caja, Proveedores)</option>
                  <option value="standard">Standard (Básico Precios & Inventario)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'none',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'var(--brand-blue)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Crear e Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 90,
        padding: '1.5rem'
      }}>
        {content}
      </div>
    );
  }

  return content;
};
