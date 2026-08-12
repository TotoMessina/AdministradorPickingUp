import React, { useState } from 'react';
import { X, Sparkles, Layers, Palette, Table, Layout, Check, AlertTriangle, AlertCircle, Info, TrendingUp, Search } from 'lucide-react';
import { StatusBadge, FormField, KpiCard, DataTable, Column } from './components';

interface DesignSystemCatalogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SampleItem {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'Activo' | 'Bajo Stock' | 'Sin Precio';
}

const sampleData: SampleItem[] = [
  { id: '1', code: 'ART-001', name: 'Aceite de Girasol 900ml', category: 'Almacén', price: 1450.00, stock: 150, status: 'Activo' },
  { id: '2', code: 'ART-002', name: 'Galletitas Dulces Vainilla 250g', category: 'Galletitas', price: 890.00, stock: 4, status: 'Bajo Stock' },
  { id: '3', code: 'ART-003', name: 'Gaseosa Cola 2.25L Retornable', category: 'Bebidas', price: 2100.00, stock: 85, status: 'Activo' },
  { id: '4', code: 'ART-004', name: 'Detergente Lavavajillas 500ml', category: 'Limpieza', price: 0.00, stock: 200, status: 'Sin Precio' },
  { id: '5', code: 'ART-005', name: 'Queso Cream Gourmet 300g', category: 'Lácteos', price: 3200.00, stock: 60, status: 'Activo' }
];

export const DesignSystemCatalog: React.FC<DesignSystemCatalogProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'badges' | 'kpis' | 'forms' | 'table'>('tokens');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleError, setSampleError] = useState<string | null>('El código ingresado ya existe');

  React.useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const columns: Column<SampleItem>[] = [
    { key: 'code', header: 'Código', sortable: true, width: '120px' },
    { key: 'name', header: 'Descripción', sortable: true },
    { key: 'category', header: 'Categoría', sortable: true },
    {
      key: 'price',
      header: 'Precio',
      sortable: true,
      align: 'right',
      render: (row) => `$${row.price.toFixed(2)}`
    },
    {
      key: 'stock',
      header: 'Stock',
      sortable: true,
      align: 'center',
      render: (row) => `${row.stock} u.`
    },
    {
      key: 'status',
      header: 'Estado',
      align: 'center',
      render: (row) => {
        if (row.status === 'Activo') return <StatusBadge status="success" label="Activo" size="sm" />;
        if (row.status === 'Bajo Stock') return <StatusBadge status="warning" label="Bajo Stock" size="sm" />;
        return <StatusBadge status="error" label="Sin Precio" size="sm" />;
      }
    }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Catálogo del Design System"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem'
      }}
      className="animate-fade-in"
    >
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--ds-radius-xl, 1rem)',
        width: '100%',
        maxWidth: '1100px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--ds-shadow-lg)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--ds-radius-lg)',
              background: 'linear-gradient(135deg, #4f46e5 0%, #a855f7 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                Design System Catalog & Storybook
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                Librería de Componentes Base y Tokens de Diseño de PickingUp!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar catálogo"
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--ds-radius-md)',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-app)',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1.75rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)'
        }}>
          <button
            onClick={() => setActiveTab('tokens')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--ds-radius-md)',
              border: 'none',
              background: activeTab === 'tokens' ? '#2563eb' : 'transparent',
              color: activeTab === 'tokens' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Palette size={15} /> Design Tokens
          </button>

          <button
            onClick={() => setActiveTab('badges')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--ds-radius-md)',
              border: 'none',
              background: activeTab === 'badges' ? '#2563eb' : 'transparent',
              color: activeTab === 'badges' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Layers size={15} /> Status Badges
          </button>

          <button
            onClick={() => setActiveTab('kpis')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--ds-radius-md)',
              border: 'none',
              background: activeTab === 'kpis' ? '#2563eb' : 'transparent',
              color: activeTab === 'kpis' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <TrendingUp size={15} /> KPI Cards
          </button>

          <button
            onClick={() => setActiveTab('forms')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--ds-radius-md)',
              border: 'none',
              background: activeTab === 'forms' ? '#2563eb' : 'transparent',
              color: activeTab === 'forms' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Layout size={15} /> Form Fields
          </button>

          <button
            onClick={() => setActiveTab('table')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--ds-radius-md)',
              border: 'none',
              background: activeTab === 'table' ? '#2563eb' : 'transparent',
              color: activeTab === 'table' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Table size={15} /> Data Table
          </button>
        </div>

        {/* Catalog Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
          {/* TAB 1: TOKENS */}
          {activeTab === 'tokens' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                🎨 Paletas de Color y Variables CSS (`tokens.css`)
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'var(--brand-blue)', padding: '1rem', borderRadius: '0.5rem', color: '#fff', fontWeight: 800 }}>
                  --brand-blue (#4f46e5)
                </div>
                <div style={{ background: 'var(--brand-accent)', padding: '1rem', borderRadius: '0.5rem', color: '#fff', fontWeight: 800 }}>
                  --brand-accent (#6366f1)
                </div>
                <div style={{ background: 'var(--ds-status-success)', padding: '1rem', borderRadius: '0.5rem', color: '#fff', fontWeight: 800 }}>
                  --ds-status-success (#10b981)
                </div>
                <div style={{ background: 'var(--ds-status-warning)', padding: '1rem', borderRadius: '0.5rem', color: '#fff', fontWeight: 800 }}>
                  --ds-status-warning (#f59e0b)
                </div>
                <div style={{ background: 'var(--ds-status-error)', padding: '1rem', borderRadius: '0.5rem', color: '#fff', fontWeight: 800 }}>
                  --ds-status-error (#ef4444)
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STATUS BADGES */}
          {activeTab === 'badges' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                🏷️ Componente &lt;StatusBadge&gt;
              </h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <StatusBadge status="success" label="Completado / Activo" />
                <StatusBadge status="warning" label="Pendiente / Alerta" />
                <StatusBadge status="error" label="Rechazado / Inactivo" />
                <StatusBadge status="info" label="Información / Procesando" />
                <StatusBadge status="purple" label="Destacado / IA" />
                <StatusBadge status="neutral" label="Borrador / Desconocido" />
              </div>
            </div>
          )}

          {/* TAB 3: KPI CARDS */}
          {activeTab === 'kpis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                📊 Componente &lt;KpiCard&gt;
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                <KpiCard
                  title="Ventas Totales Hoy"
                  value="$452.890"
                  change="+14.2%"
                  trend="up"
                  subtitle="vs. ayer ($396.500)"
                  colorTheme="green"
                />
                <KpiCard
                  title="Artículos Bajo Stock"
                  value="12 u."
                  change="-3 u."
                  trend="down"
                  subtitle="Requiere reorden inmediata"
                  colorTheme="rose"
                />
                <KpiCard
                  title="Ticket Promedio POS"
                  value="$8.450"
                  change="0.0%"
                  trend="neutral"
                  subtitle="Basado en 54 transacciones"
                  colorTheme="blue"
                />
              </div>
            </div>
          )}

          {/* TAB 4: FORM FIELDS */}
          {activeTab === 'forms' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                ✍️ Componente &lt;FormField&gt;
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormField label="Nombre del Producto" required helperText="Ingresá la descripción comercial">
                  <input
                    type="text"
                    placeholder="Ej: Aceite de Girasol 900ml"
                    value={sampleInput}
                    onChange={(e) => setSampleInput(e.target.value)}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-main)'
                    }}
                  />
                </FormField>

                <FormField label="Código de Artículo" required error={sampleError}>
                  <input
                    type="text"
                    value="ART-001"
                    onChange={(e) => setSampleError(e.target.value ? null : 'Campo requerido')}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--ds-status-error)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-main)'
                    }}
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* TAB 5: DATA TABLE */}
          {activeTab === 'table' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                📑 Componente &lt;DataTable&gt;
              </h3>

              <DataTable
                columns={columns}
                data={sampleData}
                onRowClick={(row) => alert(`Fila seleccionada: ${row.name} (${row.code})`)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
