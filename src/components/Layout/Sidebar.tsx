import React from 'react';
import {
  Home,
  Package,
  ShoppingCart,
  Truck,
  Landmark,
  BarChart3,
  Users,
  Settings,
  User,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Activity,
  CheckCircle2,
  Zap,
  Handshake,
  Box,
  Tag,
  DollarSign,
  Layers
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  selectedCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  onOpenActionBySlug?: (slug: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  isCollapsed,
  setIsCollapsed,
  onOpenActionBySlug
}) => {
  const { activeStore } = useTenant();
  const { user } = useAuth();

  const storeName = activeStore?.name || 'Mi Comercio';

  const menuItems = [
    { name: 'Inicio', slug: null, actionSlug: null, icon: <Home size={19} /> },
    { name: 'Precios', slug: 'precios', actionSlug: 'listas-precios', icon: <DollarSign size={19} /> },
    { name: 'Distribuciones', slug: 'distribuciones', actionSlug: 'venta-pos', icon: <Truck size={19} /> },
    { name: 'Inventario', slug: 'inventario', actionSlug: 'gestion-inventario', icon: <Package size={19} /> },
    { name: 'Artículos', slug: 'articulos', actionSlug: 'articulos-list', icon: <Tag size={19} /> },
    { name: 'Proveedores', slug: 'proveedores', actionSlug: 'gestion-proveedores', icon: <Handshake size={19} /> },
    { name: 'Reportes', slug: 'reportes', actionSlug: 'reportes-analytics', icon: <BarChart3 size={19} /> },
    { name: 'Caja Central', slug: 'caja-central', actionSlug: 'cierre-cajeros', icon: <Landmark size={19} /> },
    { name: 'Configuración', slug: 'configuracion', actionSlug: 'configuracion-cajas', icon: <Settings size={19} /> },
    { name: 'Otros', slug: 'otros', actionSlug: 'bancos', icon: <Layers size={19} /> }
  ];

  const handleMenuClick = (item: typeof menuItems[0]) => {
    if (item.slug === null) {
      onSelectCategory(null);
    } else {
      onSelectCategory(item.slug);
      if (item.actionSlug && onOpenActionBySlug) {
        onOpenActionBySlug(item.actionSlug);
      }
    }
  };

  return (
    <aside style={{
      width: isCollapsed ? '76px' : '230px',
      minHeight: 'calc(100vh - 68px)',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '1.25rem 0.75rem',
      transition: 'width 0.25s ease, background 0.2s ease, border-color 0.2s ease',
      position: 'sticky',
      top: '68px',
      zIndex: 30,
      userSelect: 'none'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Brand Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0 0.5rem 0.75rem 0.5rem',
          borderBottom: '1px solid var(--border-light)'
        }}>
          {/* Isotipo Purple P Box */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '0.625rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.35)',
            flexShrink: 0
          }}>
            P
          </div>

          {!isCollapsed && (
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {storeName}
            </span>
          )}
        </div>

        {/* Navigation Items List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {menuItems.map((item) => {
            const isSelected = selectedCategory === item.slug || (item.slug === null && selectedCategory === null);
            return (
              <button
                key={item.name}
                onClick={() => handleMenuClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: isCollapsed ? '0.7rem 0' : '0.65rem 0.875rem',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: '0.625rem',
                  border: 'none',
                  background: isSelected ? 'var(--brand-light-bg)' : 'transparent',
                  color: isSelected ? 'var(--brand-blue)' : 'var(--text-muted)',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%'
                }}
                title={isCollapsed ? item.name : undefined}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSelected ? 'var(--brand-blue)' : 'var(--text-muted)'
                }}>
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.name}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Server Status Card & Collapse Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {!isCollapsed && (
          <div style={{
            background: 'var(--bg-sidebar-hover)',
            border: '1px solid var(--border-light)',
            borderRadius: '0.875rem',
            padding: '0.875rem',
            fontSize: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#10b981' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Servidor Operativo
            </div>
            <div style={{ color: 'var(--text-muted)', fontWeight: 700, marginTop: '4px' }}>
              Supabase Multi-Tenant
            </div>
            <a
              href="#server"
              onClick={(e) => { e.preventDefault(); if (onOpenActionBySlug) onOpenActionBySlug('monitoreo-cajas'); }}
              style={{ color: 'var(--brand-blue)', fontWeight: 800, textDecoration: 'none', display: 'inline-block', marginTop: '6px' }}
            >
              Ver detalles →
            </a>
          </div>
        )}

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.5rem',
            padding: '0.6rem 0.75rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderRadius: '0.5rem',
            transition: 'background 0.15s ease'
          }}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /> <span>Colapsar</span></>}
        </button>
      </div>
    </aside>
  );
};
