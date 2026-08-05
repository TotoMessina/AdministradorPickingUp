import React from 'react';
import {
  X,
  Home,
  Zap,
  Grid,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { MobileTab } from './MobileBottomBar';
import { useTenant } from '../../context/TenantContext';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  onOpenAction?: (slug: string) => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onOpenAction
}) => {
  const { activeStore } = useTenant();

  if (!isOpen) return null;

  const menuItems = [
    { id: 'dashboard' as MobileTab, label: 'Dashboard', icon: <Home size={18} /> },
    { id: 'operaciones' as MobileTab, label: 'Operaciones', icon: <Zap size={18} /> },
    { id: 'modulos' as MobileTab, label: 'Módulos', icon: <Grid size={18} /> },
    { id: 'reportes' as MobileTab, label: 'Reportes', icon: <BarChart3 size={18} /> },
    { id: 'config' as const, label: 'Configuración', icon: <Settings size={18} />, slug: 'configuracion-cajas' },
    { id: 'ayuda' as const, label: 'Ayuda', icon: <HelpCircle size={18} />, slug: 'autorizar-soporte' }
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.5)',
      backdropFilter: 'blur(4px)',
      zIndex: 1200,
      display: 'flex',
      justifyContent: 'flex-end'
    }} onClick={onClose} className="animate-fade-in">
      <div
        style={{
          width: '82%',
          maxWidth: '320px',
          height: '100%',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.25rem 1rem',
          boxShadow: '-10px 0 25px rgba(0,0,0,0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Top Title & Close Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '1rem',
            borderBottom: '1px solid #e8ecf4',
            marginBottom: '1.25rem'
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>
              Menú
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={22} />
            </button>
          </div>

          {/* Menu Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {menuItems.map((item) => {
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.slug && onOpenAction) {
                      onOpenAction(item.slug);
                    } else if (item.id) {
                      onSelectTab(item.id as MobileTab);
                    }
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    background: isSelected ? '#eef2ff' : 'transparent',
                    color: isSelected ? '#6366f1' : '#475569',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.925rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ color: isSelected ? '#6366f1' : '#94a3b8' }}>
                      {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight size={16} style={{ color: isSelected ? '#6366f1' : '#cbd5e1' }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          paddingTop: '1rem',
          borderTop: '1px solid #e8ecf4',
          fontSize: '0.75rem',
          color: '#94a3b8',
          textAlign: 'center'
        }}>
          <div>Versión 1.0.0</div>
          <div style={{ fontWeight: 700, color: '#64748b', marginTop: '2px' }}>
            {activeStore?.name || 'TotoSuper'}
          </div>
        </div>
      </div>
    </div>
  );
};
