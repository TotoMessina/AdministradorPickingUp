import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { MobileHeader } from './MobileHeader';
import { MobileBottomBar, MobileTab } from './MobileBottomBar';
import { MobileDrawer } from './MobileDrawer';
import { MODULE_GROUPS } from '../Dashboard/ModuleGrid';
import { ActionItem } from '../Dashboard/FavoritesBar';
import {
  Wifi,
  Battery,
  Signal,
  Store,
  Star,
  Edit2,
  X,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  PieChart,
  Box,
  Landmark,
  Handshake,
  Settings,
  Users,
  Building2,
  RefreshCw,
  HelpCircle,
  LogOut,
  Zap,
  Tag,
  FileText,
  Lock,
  ArrowRight,
  ShieldCheck,
  Percent,
  Layers,
  CreditCard,
  Monitor
} from 'lucide-react';

interface MobileAppViewProps {
  favorites: ActionItem[];
  setFavorites: React.Dispatch<React.SetStateAction<ActionItem[]>>;
  onOpenAction: (action: ActionItem) => void;
  onOpenActionBySlug: (slug: string) => void;
  realOpsTodayCount: number;
  realOpsTodayAmount: number;
  realActiveCajasText: string;
  realLastUpdate: string;
  serverLatency: string;
  onOpenPOS: () => void;
}

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  favorites,
  setFavorites,
  onOpenAction,
  onOpenActionBySlug,
  realOpsTodayCount,
  realOpsTodayAmount,
  realActiveCajasText,
  realLastUpdate,
  serverLatency,
  onOpenPOS
}) => {
  const { user, signOut } = useAuth();
  const { activeStore } = useTenant();

  const [activeTab, setActiveTab] = useState<MobileTab>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Detail Submodule State
  const [selectedModuleSlug, setSelectedModuleSlug] = useState<string | null>(null);

  // Operaciones Period Filter State
  const [opPeriod, setOpPeriod] = useState<'hoy' | 'ayer' | 'semana'>('hoy');

  // Search Terms
  const [moduleSearch, setModuleSearch] = useState('');
  const [submoduleSearch, setSubmoduleSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');

  // Favorites editing mode
  const [isEditingFavorites, setIsEditingFavorites] = useState(false);

  const initialLetter = (activeStore?.name || user?.email || 'T').charAt(0).toUpperCase();
  const storeName = activeStore?.name || 'TotoSuper';
  const storeCode = activeStore?.code || 'SUC-994';

  const selectedModuleObj = MODULE_GROUPS.find(g => g.slug === selectedModuleSlug) || MODULE_GROUPS[0];

  const handleRemoveFavorite = (slug: string) => {
    setFavorites(prev => prev.filter(f => f.slug !== slug));
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f3f4f8',
      color: '#1e293b',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      paddingBottom: '80px',
      maxWidth: '500px',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,0.08)',
      position: 'relative',
      overflowX: 'hidden'
    }}>

      {/* Top iOS Status Bar */}
      <div style={{
        height: '36px',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        fontSize: '0.8125rem',
        fontWeight: 800,
        color: '#0f172a',
        letterSpacing: '-0.02em'
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Signal size={13} />
          <Wifi size={13} />
          <Battery size={15} />
        </div>
      </div>

      {/* Screen 1: Dashboard View */}
      {activeTab === 'dashboard' && (
        <div className="animate-fade-in">
          <MobileHeader
            title="Dashboard"
            onOpenMenu={() => setIsDrawerOpen(true)}
          />

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Store Gradient Card */}
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              borderRadius: '1.25rem',
              padding: '1.25rem',
              color: '#ffffff',
              boxShadow: '0 12px 25px -5px rgba(99, 102, 241, 0.35)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Store size={22} style={{ color: '#ffffff' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#ffffff' }}>
                      {storeName}
                    </h2>
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      letterSpacing: '0.05em'
                    }}>
                      {storeCode}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '2px', fontWeight: 500 }}>
                    Mercado baja san juan, córdoba 4401
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.6875rem',
                fontWeight: 700,
                opacity: 0.95
              }}>
                <span>Tenant • License ENTERPRISE</span>
              </div>
            </div>

            {/* 2x2 Metric Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem'
            }}>
              {/* Metric 1 */}
              <div style={{
                background: '#ffffff',
                borderRadius: '1rem',
                padding: '1rem',
                border: '1px solid #e8ecf4',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700 }}>
                  Operaciones hoy
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px 0' }}>
                  {realOpsTodayCount}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981' }}>
                  ${realOpsTodayAmount.toLocaleString('es-AR')}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
                  Transacciones
                </div>
              </div>

              {/* Metric 2 */}
              <div style={{
                background: '#ffffff',
                borderRadius: '1rem',
                padding: '1rem',
                border: '1px solid #e8ecf4',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700 }}>
                  Cajas activas
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px 0' }}>
                  {realActiveCajasText}
                </div>
                <div style={{
                  display: 'inline-block',
                  background: '#fee2e2',
                  color: '#ef4444',
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px'
                }}>
                  Sin cajas
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
                  Terminales POS
                </div>
              </div>

              {/* Metric 3 */}
              <div style={{
                background: '#ffffff',
                borderRadius: '1rem',
                padding: '1rem',
                border: '1px solid #e8ecf4',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700 }}>
                  Actualización
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px 0' }}>
                  {realLastUpdate || '12:19 p. m.'}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                  Sincronización en tiempo real
                </div>
              </div>

              {/* Metric 4 */}
              <div style={{
                background: '#ffffff',
                borderRadius: '1rem',
                padding: '1rem',
                border: '1px solid #e8ecf4',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700 }}>
                  Estado servidor
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981', margin: '4px 0 2px 0' }}>
                  99.99%
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                  Uptime 30d 3h
                </div>
              </div>
            </div>

            {/* Acciones Rápidas (Favorites) Section */}
            <div style={{
              background: '#ffffff',
              borderRadius: '1.25rem',
              padding: '1.25rem',
              border: '1px solid #e8ecf4',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.875rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 800, color: '#1e293b' }}>
                  <Star size={16} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                  <span>Acciones Rápidas</span>
                </div>

                <button
                  onClick={() => setIsEditingFavorites(!isEditingFavorites)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#6366f1',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Edit2 size={12} /> {isEditingFavorites ? 'Listo' : 'Editar'}
                </button>
              </div>

              {/* Removable Chips matching exact reference */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {favorites.map((fav) => (
                  <div
                    key={fav.slug}
                    onClick={() => !isEditingFavorites && onOpenAction(fav)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      padding: '0.45rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{fav.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(fav.slug);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setActiveTab('modulos')}
                  style={{
                    background: '#eef2ff',
                    border: '1px dashed #6366f1',
                    borderRadius: '0.75rem',
                    padding: '0.45rem 0.75rem',
                    color: '#6366f1',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={14} /> Agregar favorito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Módulos View */}
      {activeTab === 'modulos' && (
        <div className="animate-fade-in">
          <MobileHeader
            title="Módulos"
            showBack={true}
            onBack={() => setActiveTab('dashboard')}
            showSearch={true}
            onOpenSearch={() => {}}
          />

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {MODULE_GROUPS.map((mod) => (
              <div
                key={mod.slug}
                onClick={() => {
                  setSelectedModuleSlug(mod.slug);
                  setActiveTab('submodulo');
                }}
                style={{
                  background: '#ffffff',
                  borderRadius: '1rem',
                  padding: '1rem 1.15rem',
                  border: '1px solid #e8ecf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '0.75rem',
                    background: `var(--theme-${mod.colorTheme}-bg)`,
                    color: `var(--theme-${mod.colorTheme})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {mod.slug === 'precios' && <Tag size={20} />}
                    {mod.slug === 'distribuciones' && <Building2 size={20} />}
                    {mod.slug === 'inventario' && <Box size={20} />}
                    {mod.slug === 'articulos' && <Layers size={20} />}
                    {mod.slug === 'proveedores' && <Handshake size={20} />}
                    {mod.slug === 'reportes' && <PieChart size={20} />}
                    {mod.slug === 'caja-central' && <Landmark size={20} />}
                    {mod.slug === 'configuracion' && <Settings size={20} />}
                    {mod.slug === 'otros' && <Zap size={20} />}
                  </div>

                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      {mod.name}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                      {mod.actions.length} {mod.actions.length === 1 ? 'acción disponible' : 'acciones disponibles'}
                    </p>
                  </div>
                </div>

                <ChevronRight size={18} style={{ color: '#cbd5e1' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screen 3: Submódulo Detail View */}
      {activeTab === 'submodulo' && (
        <div className="animate-fade-in">
          <MobileHeader
            title={selectedModuleObj.name}
            showBack={true}
            onBack={() => setActiveTab('modulos')}
          />

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              border: '1px solid #e8ecf4',
              borderRadius: '0.75rem',
              padding: '0.6rem 0.875rem'
            }}>
              <Search size={18} style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder={`Buscar en ${selectedModuleObj.name.toLowerCase()}...`}
                value={submoduleSearch}
                onChange={(e) => setSubmoduleSearch(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.8125rem',
                  color: '#1e293b'
                }}
              />
              <SlidersHorizontal size={18} style={{ color: '#94a3b8', cursor: 'pointer' }} />
            </div>

            {/* Action Item Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selectedModuleObj.actions
                .filter(a => a.name.toLowerCase().includes(submoduleSearch.toLowerCase()))
                .map((act) => (
                  <div
                    key={act.slug}
                    onClick={() => onOpenAction(act)}
                    style={{
                      background: '#ffffff',
                      borderRadius: '1rem',
                      padding: '1rem 1.15rem',
                      border: '1px solid #e8ecf4',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
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

                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.925rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                        {act.name}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                        Acceder y gestionar {act.name.toLowerCase()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button
                onClick={() => setActiveTab('modulos')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6366f1',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Ver todas las acciones <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 4: Operaciones View */}
      {activeTab === 'operaciones' && (
        <div className="animate-fade-in">
          <MobileHeader
            title="Operaciones"
            onOpenMenu={() => setIsDrawerOpen(true)}
          />

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Filter Pills: Hoy, Ayer, Esta semana */}
            <div style={{
              display: 'flex',
              background: '#ffffff',
              padding: '0.25rem',
              borderRadius: '0.75rem',
              border: '1px solid #e8ecf4'
            }}>
              {[
                { id: 'hoy', label: 'Hoy' },
                { id: 'ayer', label: 'Ayer' },
                { id: 'semana', label: 'Esta semana' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setOpPeriod(p.id as any)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: opPeriod === p.id ? '#6366f1' : 'transparent',
                    color: opPeriod === p.id ? '#ffffff' : '#64748b',
                    fontWeight: opPeriod === p.id ? 800 : 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Action list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'Cambio Puntual', slug: 'listas-precios', desc: 'Realizar cambio de precios', color: 'blue' },
                { name: 'Cambio Masivo', slug: 'cambio-masivo', desc: 'Cambios en lote de precios', color: 'red' },
                { name: 'Lista de Precios', slug: 'listas-precios', desc: 'Gestionar listas de precios', color: 'blue' },
                { name: 'Cierre de Cajeros', slug: 'cierre-cajeros', desc: 'Cerrar sesión de cajeros', color: 'lime' },
                { name: 'Ingreso de Comprobantes', slug: 'ingreso-comprobantes', desc: 'Registrar comprobantes', color: 'orange' },
                { name: 'Distribuir Precios', slug: 'distribuir-precios', desc: 'Distribuir precios a sucursales', color: 'teal' },
                { name: 'Monitoreo de Cajas', slug: 'monitoreo-cajas', desc: 'Ver estado de cajas en tiempo real', color: 'teal' }
              ].map((act, i) => (
                <div
                  key={i}
                  onClick={() => onOpenActionBySlug(act.slug)}
                  style={{
                    background: '#ffffff',
                    borderRadius: '1rem',
                    padding: '1rem',
                    border: '1px solid #e8ecf4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '0.75rem',
                    background: `var(--theme-${act.color}-bg)`,
                    color: `var(--theme-${act.color})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Zap size={18} />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      {act.name}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                      {act.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Screen 5: Reportes View */}
      {activeTab === 'reportes' && (
        <div className="animate-fade-in">
          <MobileHeader
            title="Reportes"
            showBack={true}
            onBack={() => setActiveTab('dashboard')}
          />

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              border: '1px solid #e8ecf4',
              borderRadius: '0.75rem',
              padding: '0.6rem 0.875rem'
            }}>
              <Search size={18} style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar reportes..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.8125rem',
                  color: '#1e293b'
                }}
              />
            </div>

            {/* Category Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'Ventas', desc: 'Reportes de ventas y facturación (Recharts)', slug: 'dashboard-ejecutivo', color: 'sky' },
                { name: 'Productos', desc: 'Reportes de productos', slug: 'reportes-analytics', color: 'blue' },
                { name: 'Inventario', desc: 'Reportes de inventario', slug: 'reportes-analytics', color: 'purple' },
                { name: 'Cajas', desc: 'Reportes de cajas', slug: 'cierre-cajeros', color: 'lime' },
                { name: 'Proveedores', desc: 'Reportes de proveedores', slug: 'prov-cta-cte', color: 'orange' },
                { name: 'Personalizados', desc: 'Crear reporte personalizado con Recharts', slug: 'dashboard-ejecutivo', color: 'teal' }
              ].map((rep, i) => (
                <div
                  key={i}
                  onClick={() => onOpenActionBySlug(rep.slug)}
                  style={{
                    background: '#ffffff',
                    borderRadius: '1rem',
                    padding: '1rem',
                    border: '1px solid #e8ecf4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '0.75rem',
                    background: `var(--theme-${rep.color}-bg)`,
                    color: `var(--theme-${rep.color})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <PieChart size={18} />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      {rep.name}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                      {rep.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Screen 6: Más / Perfil View */}
      {activeTab === 'mas' && (
        <div className="animate-fade-in">
          <MobileHeader
            title="Ajustes & Cuenta"
            showBack={true}
            onBack={() => setActiveTab('dashboard')}
          />

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* User Profile Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '1.25rem',
              padding: '1.25rem',
              border: '1px solid #e8ecf4',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {initialLetter}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: '#1e293b' }}>
                    {storeName}
                  </h3>
                  <span style={{
                    background: '#eef2ff',
                    color: '#6366f1',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.6875rem',
                    fontWeight: 800
                  }}>
                    {storeCode}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  Tenant • License ENTERPRISE
                </div>
              </div>
            </div>

            {/* Setting Options */}
            <div style={{
              background: '#ffffff',
              borderRadius: '1.25rem',
              border: '1px solid #e8ecf4',
              overflow: 'hidden'
            }}>
              {[
                { label: 'Configuración', desc: 'Ajustes del sistema', icon: <Settings size={18} />, slug: 'configuracion-cajas' },
                { label: 'Usuarios', desc: 'Gestión de usuarios', icon: <Users size={18} />, slug: 'usuarios-permisos' },
                { label: 'Sucursales', desc: 'Gestión de sucursales', icon: <Building2 size={18} />, slug: 'distribuir-precios' },
                { label: 'Sincronización', desc: 'Sincronizar datos', icon: <RefreshCw size={18} />, slug: 'reportes-analytics' },
                { label: 'Ayuda', desc: 'Centro de ayuda', icon: <HelpCircle size={18} />, slug: 'autorizar-soporte' }
              ].map((opt, i) => (
                <div
                  key={i}
                  onClick={() => onOpenActionBySlug(opt.slug)}
                  style={{
                    padding: '0.875rem 1.25rem',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{ color: '#6366f1' }}>{opt.icon}</div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e293b' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{opt.desc}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
                </div>
              ))}

              {/* Logout Option */}
              <div
                onClick={() => signOut()}
                style={{
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  color: '#ef4444'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <LogOut size={18} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 800 }}>Cerrar sesión</div>
                    <div style={{ fontSize: '0.725rem', opacity: 0.8 }}>Salir del sistema</div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ opacity: 0.5 }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <MobileBottomBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenFAB={onOpenPOS}
      />

      {/* Screen 7: Slide-Over Drawer */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAction={onOpenActionBySlug}
      />

    </div>
  );
};
