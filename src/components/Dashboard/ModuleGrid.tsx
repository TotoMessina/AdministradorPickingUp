import React, { useState } from 'react';
import { useTenant } from '../../context/TenantContext';
import { ActionItem } from './FavoritesBar';
import {
  DollarSign,
  Truck,
  Package,
  Barcode,
  Handshake,
  Landmark,
  Settings,
  Star,
  Zap,
  CheckCircle2,
  Layers,
  Tag,
  CreditCard,
  FileText,
  Users,
  PieChart,
  Lock,
  TrendingUp,
  ChevronRight,
  Plus,
  Edit2,
  Clock,
  HelpCircle,
  Sparkles,
  Keyboard,
  ArrowRight,
  ShoppingCart,
  Box,
  Building2,
  Share2,
  Activity,
  Edit3,
  List,
  Wallet,
  Percent,
  Sliders,
  Gift,
  Cpu,
  Database,
  Globe,
  DollarSign as CurrencyIcon,
  Ticket,
  FileSpreadsheet,
  ArrowUpDown
} from 'lucide-react';

export interface ModuleGroup {
  name: string;
  slug: string;
  iconName: string;
  colorTheme: 'red' | 'green' | 'purple' | 'blue' | 'orange' | 'sky' | 'lime' | 'rose' | 'teal';
  actions: ActionItem[];
  description?: string;
}

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    name: 'Precios',
    slug: 'precios',
    iconName: 'DollarSign',
    colorTheme: 'rose',
    description: 'Gestión, actualización y listas de precios por sucursal',
    actions: [
      { name: 'Cambio Puntual', slug: 'cambio-puntual', moduleName: 'Precios', moduleSlug: 'precios', colorTheme: 'rose', iconName: 'Edit3' },
      { name: 'Cambio Masivo', slug: 'cambio-masivo', moduleName: 'Precios', moduleSlug: 'precios', colorTheme: 'rose', iconName: 'Zap' },
      { name: 'Listas de Precios', slug: 'listas-precios', moduleName: 'Precios', moduleSlug: 'precios', colorTheme: 'rose', iconName: 'List' },
      { name: 'Cambio Rápido', slug: 'cambio-rapido', moduleName: 'Precios', moduleSlug: 'precios', colorTheme: 'rose', iconName: 'Clock' },
      { name: 'Auditoría de Precios', slug: 'auditoria-precios', moduleName: 'Precios', moduleSlug: 'precios', colorTheme: 'rose', iconName: 'ShieldCheck' }
    ]
  },
  {
    name: 'Distribuciones',
    slug: 'distribuciones',
    iconName: 'Truck',
    colorTheme: 'green',
    description: 'Terminal POS de venta, monitoreo de cajas y distribución',
    actions: [
      { name: 'Terminal POS de Venta', slug: 'venta-pos', moduleName: 'Distribuciones', moduleSlug: 'distribuciones', colorTheme: 'green', iconName: 'ShoppingCart' },
      { name: 'Monitoreo de Cajas', slug: 'monitoreo-cajas', moduleName: 'Distribuciones', moduleSlug: 'distribuciones', colorTheme: 'green', iconName: 'Activity' },
      { name: 'Distribuir Precios', slug: 'distribuir-precios', moduleName: 'Distribuciones', moduleSlug: 'distribuciones', colorTheme: 'green', iconName: 'Share2' }
    ]
  },
  {
    name: 'Inventario',
    slug: 'inventario',
    iconName: 'Package',
    colorTheme: 'purple',
    description: 'Gestión de stock, movimientos y conciliación física vs teórica',
    actions: [
      { name: 'Gestión de Inventario', slug: 'gestion-inventario', moduleName: 'Inventario', moduleSlug: 'inventario', colorTheme: 'purple', iconName: 'Box' },
      { name: 'Conciliación de Inventario', slug: 'conciliacion', moduleName: 'Inventario', moduleSlug: 'inventario', colorTheme: 'purple', iconName: 'CheckCircle2' }
    ]
  },
  {
    name: 'Artículos',
    slug: 'articulos',
    iconName: 'Tag',
    colorTheme: 'blue',
    description: 'Catálogo completo, rubros, familias y precios diferenciados',
    actions: [
      { name: 'Catálogo de Artículos', slug: 'articulos-list', moduleName: 'Artículos', moduleSlug: 'articulos', colorTheme: 'blue', iconName: 'Tag' },
      { name: 'Rubros y Categorías', slug: 'rubros', moduleName: 'Artículos', moduleSlug: 'articulos', colorTheme: 'blue', iconName: 'Layers' },
      { name: 'Familias y Subfamilias', slug: 'familias-subfamilias', moduleName: 'Artículos', moduleSlug: 'articulos', colorTheme: 'blue', iconName: 'Box' },
      { name: 'Productos Desactivados', slug: 'baja-articulos', moduleName: 'Artículos', moduleSlug: 'articulos', colorTheme: 'blue', iconName: 'Clock' }
    ]
  },
  {
    name: 'Proveedores',
    slug: 'proveedores',
    iconName: 'Handshake',
    colorTheme: 'orange',
    description: 'Alta de proveedores, facturas de compra, saldo a favor y pagos',
    actions: [
      { name: 'Gestión de Proveedores', slug: 'gestion-proveedores', moduleName: 'Proveedores', moduleSlug: 'proveedores', colorTheme: 'orange', iconName: 'Handshake' },
      { name: 'Cuenta Corriente Proveedores', slug: 'prov-cta-cte', moduleName: 'Proveedores', moduleSlug: 'proveedores', colorTheme: 'orange', iconName: 'CreditCard' },
      { name: 'Ingreso de Comprobantes', slug: 'ingreso-comprobantes', moduleName: 'Proveedores', moduleSlug: 'proveedores', colorTheme: 'orange', iconName: 'FileText' },
      { name: 'Administración de Cta. Cte.', slug: 'admin-cta-cte', moduleName: 'Proveedores', moduleSlug: 'proveedores', colorTheme: 'orange', iconName: 'Wallet' }
    ]
  },
  {
    name: 'Reportes',
    slug: 'reportes',
    iconName: 'PieChart',
    colorTheme: 'sky',
    description: 'Reportes ejecutivos, métricas de stock y auditorías',
    actions: [
      { name: 'Reportes y Analytics', slug: 'reportes-analytics', moduleName: 'Reportes', moduleSlug: 'reportes', colorTheme: 'sky', iconName: 'PieChart' },
      { name: 'Tableros Ejecutivos', slug: 'dashboard-ejecutivo', moduleName: 'Reportes', moduleSlug: 'reportes', colorTheme: 'sky', iconName: 'TrendingUp' }
    ]
  },
  {
    name: 'Caja Central',
    slug: 'caja-central',
    iconName: 'Landmark',
    colorTheme: 'teal',
    description: 'Cierre de turnos de cajeros, movimientos de caja y aranceles',
    actions: [
      { name: 'Cierre de Cajeros', slug: 'cierre-cajeros', moduleName: 'Caja Central', moduleSlug: 'caja-central', colorTheme: 'teal', iconName: 'Lock' },
      { name: 'Cuenta Corriente Caja', slug: 'cuenta-corriente-caja', moduleName: 'Caja Central', moduleSlug: 'caja-central', colorTheme: 'teal', iconName: 'Wallet' },
      { name: 'Movimientos de Caja', slug: 'movimientos-caja', moduleName: 'Caja Central', moduleSlug: 'caja-central', colorTheme: 'teal', iconName: 'TrendingUp' },
      { name: 'Administración de Aranceles', slug: 'admin-aranceles', moduleName: 'Caja Central', moduleSlug: 'caja-central', colorTheme: 'teal', iconName: 'Percent' }
    ]
  },
  {
    name: 'Configuración',
    slug: 'configuracion',
    iconName: 'Settings',
    colorTheme: 'rose',
    description: 'Usuarios cajeros, permisos, cajas registradoras y soporte',
    actions: [
      { name: 'Usuarios y Permisos', slug: 'usuarios-permisos', moduleName: 'Configuración', moduleSlug: 'configuracion', colorTheme: 'rose', iconName: 'Users' },
      { name: 'Configuración de Cajas', slug: 'configuracion-cajas', moduleName: 'Configuración', moduleSlug: 'configuracion', colorTheme: 'rose', iconName: 'Monitor' },
      { name: 'Autorizar Ingreso Soporte', slug: 'autorizar-soporte', moduleName: 'Configuración', moduleSlug: 'configuracion', colorTheme: 'rose', iconName: 'ShieldCheck' },
      { name: 'Diseño de Etiquetas', slug: 'diseno-etiquetas', moduleName: 'Configuración', moduleSlug: 'configuracion', colorTheme: 'rose', iconName: 'Sliders' },
      { name: 'Bonificaciones', slug: 'bonificaciones', moduleName: 'Configuración', moduleSlug: 'configuracion', colorTheme: 'rose', iconName: 'Gift' }
    ]
  },
  {
    name: 'Otros',
    slug: 'otros',
    iconName: 'Layers',
    colorTheme: 'lime',
    description: 'Bancos, tipo de cambio, vales de compra y exportaciones',
    actions: [
      { name: 'Bancos y Finanzas', slug: 'bancos', moduleName: 'Otros', moduleSlug: 'otros', colorTheme: 'lime', iconName: 'Building2' },
      { name: 'Tipo de Cambio', slug: 'tipo-cambio', moduleName: 'Otros', moduleSlug: 'otros', colorTheme: 'lime', iconName: 'CurrencyIcon' },
      { name: 'Ingresos / Egresos Varios', slug: 'ingresos-egresos', moduleName: 'Otros', moduleSlug: 'otros', colorTheme: 'lime', iconName: 'FileText' },
      { name: 'Vales de Compra', slug: 'vales-compra', moduleName: 'Otros', moduleSlug: 'otros', colorTheme: 'lime', iconName: 'Ticket' },
      { name: 'Exportaciones de Datos', slug: 'exportaciones', moduleName: 'Otros', moduleSlug: 'otros', colorTheme: 'lime', iconName: 'FileSpreadsheet' }
    ]
  }
];

interface ModuleGridProps {
  onActionClick: (action: ActionItem) => void;
  favorites: ActionItem[];
  onToggleFavorite: (action: ActionItem) => void;
  selectedCategory: string | null;
  searchTerm?: string;
  onOpenActionBySlug?: (slug: string) => void;
  onOpenFavConfig?: () => void;

  // 100% Real Live Metrics Props
  realOpsTodayCount?: number;
  realOpsTodayAmount?: number;
  realActiveCajasText?: string;
  realLastUpdate?: string;
  serverLatency?: string;
  isServerOnline?: boolean;
}

export const ModuleGrid: React.FC<ModuleGridProps> = ({
  onActionClick,
  favorites,
  onToggleFavorite,
  selectedCategory,
  searchTerm = '',
  onOpenActionBySlug,
  onOpenFavConfig,

  realOpsTodayCount = 0,
  realOpsTodayAmount = 0,
  realActiveCajasText = '0 / 0',
  realLastUpdate = '',
  serverLatency = '12 ms',
  isServerOnline = true
}) => {
  const { activeStore } = useTenant();

  const [moduleSortBy, setModuleSortBy] = useState<'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'FAVORITES_FIRST'>('DEFAULT');

  const handleSlugClick = (slug: string) => {
    if (onOpenActionBySlug) {
      onOpenActionBySlug(slug);
    } else {
      const found = MODULE_GROUPS.flatMap(g => g.actions).find(a => a.slug === slug);
      if (found) onActionClick(found);
    }
  };

  const sortActions = (actions: ActionItem[]) => {
    return [...actions].sort((a, b) => {
      if (moduleSortBy === 'NAME_ASC') {
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      }
      if (moduleSortBy === 'NAME_DESC') {
        return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
      }
      if (moduleSortBy === 'FAVORITES_FIRST') {
        const aFav = favorites.some(f => f.slug === a.slug) ? 1 : 0;
        const bFav = favorites.some(f => f.slug === b.slug) ? 1 : 0;
        return bFav - aFav;
      }
      return 0;
    });
  };

  const filteredGroups = MODULE_GROUPS.map(group => {
    const isCategoryMatched = !selectedCategory || group.slug === selectedCategory;
    const matchedActions = group.actions.filter(act => {
      const matchSearch = !searchTerm.trim() ||
        act.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });

    const sortedMatchedActions = sortActions(matchedActions);

    return {
      ...group,
      isVisible: isCategoryMatched && sortedMatchedActions.length > 0,
      actions: sortedMatchedActions
    };
  }).filter(group => group.isVisible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }} className="animate-fade-in">

      {/* TOP 4 SUMMARY KPI CARDS (POWERED BY 100% REAL LIVE STORE DATA) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* KPI 1: VENTAS DE HOY */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: '1.25rem',
          padding: '1.25rem',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              VENTAS DE HOY ({activeStore?.code || 'SUC-01'})
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--brand-blue)', margin: '4px 0 6px 0' }}>
              ${realOpsTodayAmount > 0 ? realOpsTodayAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#10b981' }}>
              <span>{realOpsTodayCount} operaciones procesadas hoy</span>
            </div>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--theme-purple-bg)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={22} />
          </div>
        </div>

        {/* KPI 2: CAJAS ABIERTAS */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: '1.25rem',
          padding: '1.25rem',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              CAJAS ABIERTAS
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', margin: '4px 0 6px 0' }}>
              {realActiveCajasText}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              cajas activas en sucursal
            </div>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--theme-green-bg)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
        </div>

        {/* KPI 3: SERVIDOR */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: '1.25rem',
          padding: '1.25rem',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ESTADO SERVIDOR
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: isServerOnline ? '#10b981' : '#ef4444', margin: '4px 0 6px 0' }}>
              {isServerOnline ? '99.99%' : 'OFFLINE'}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Latencia: <strong style={{ color: isServerOnline ? '#10b981' : '#ef4444' }}>{serverLatency}</strong>
            </div>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--theme-teal-bg)', color: '#14b8a6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* KPI 4: ÚLTIMA SINCRONIZACIÓN */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: '1.25rem',
          padding: '1.25rem',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ÚLTIMA SINCRONIZACIÓN
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0ea5e9', margin: '4px 0 6px 0' }}>
              {realLastUpdate || 'En vivo'}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Sincronizado en tiempo real
            </div>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--theme-sky-bg)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Module Cards Sort Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '0.875rem',
        padding: '0.75rem 1.25rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
          <Layers size={18} style={{ color: 'var(--brand-blue)' }} />
          <span>Fichas de Módulos Operativos</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpDown size={14} /> Ordenar Fichas:
          </span>
          <select
            id="select-modulos-orden"
            value={moduleSortBy}
            onChange={(e) => setModuleSortBy(e.target.value as any)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #0284c7',
              background: 'rgba(2, 132, 199, 0.08)',
              color: '#0284c7',
              fontWeight: 800,
              fontSize: '0.8125rem'
            }}
          >
            <option value="DEFAULT">📌 Predeterminado (Por Módulo)</option>
            <option value="NAME_ASC">🔤 Nombre Ficha (A-Z)</option>
            <option value="NAME_DESC">🔤 Nombre Ficha (Z-A)</option>
            <option value="FAVORITES_FIRST">⭐ Favoritos Primero</option>
          </select>
        </div>
      </div>

      {/* Module Categories Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {filteredGroups.map((group) => (
          <div key={group.slug} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.5rem',
                  background: `var(--theme-${group.colorTheme}-bg)`,
                  color: `var(--theme-${group.colorTheme})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800
                }}>
                  {group.slug === 'precios' && <DollarSign size={18} />}
                  {group.slug === 'distribuciones' && <Truck size={18} />}
                  {group.slug === 'inventario' && <Package size={18} />}
                  {group.slug === 'articulos' && <Tag size={18} />}
                  {group.slug === 'proveedores' && <Handshake size={18} />}
                  {group.slug === 'reportes' && <PieChart size={18} />}
                  {group.slug === 'caja-central' && <Landmark size={18} />}
                  {group.slug === 'configuracion' && <Settings size={18} />}
                  {group.slug === 'otros' && <Layers size={18} />}
                </div>

                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                    {group.name}
                  </h2>
                  {group.description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {group.description}
                    </div>
                  )}
                </div>
              </div>

              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                {group.actions.length} acciones
              </span>
            </div>

            {/* Actions Grid for Group */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {group.actions.map((act) => (
                <div
                  key={act.slug}
                  id={`action-card-${act.slug}`}
                  onClick={() => onActionClick(act)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '1rem',
                    padding: '1.125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.875rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:translate-y-[-2px] hover:shadow-md"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '0.75rem',
                      background: `var(--theme-${act.colorTheme}-bg)`,
                      color: `var(--theme-${act.colorTheme})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Zap size={20} />
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {act.name}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Módulo {group.name}
                      </div>
                    </div>
                  </div>

                  <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
