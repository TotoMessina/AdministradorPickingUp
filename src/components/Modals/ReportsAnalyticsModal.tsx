import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import {
  X,
  PieChart,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Download,
  Calendar,
  Package,
  Layers,
  Search,
  Tag,
  TrendingUp,
  RefreshCw,
  Box,
  FileSpreadsheet
} from 'lucide-react';

const ExecutiveDashboardModal = React.lazy(() => import('./ExecutiveDashboardModal').then(m => ({ default: m.ExecutiveDashboardModal })));

interface ReportsAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInventory?: () => void;
  onOpenPriceLists?: () => void;
}

export const ReportsAnalyticsModal: React.FC<ReportsAnalyticsModalProps> = ({
  isOpen,
  onClose,
  onOpenInventory,
  onOpenPriceLists
}) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();

  const storeKey = activeStore?.id || 'demo-store';

  const [showExecutiveDashboard, setShowExecutiveDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'low_stock' | 'movements' | 'no_price'>('low_stock');
  const [articles, setArticles] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeStore]);

  const loadData = async () => {
    setLoading(true);
    let loadedArticles: any[] = [];
    let loadedMovements: any[] = [];

    // Local Storage Articles
    try {
      const rawProds = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawProds) loadedArticles = JSON.parse(rawProds);

      const rawHist = localStorage.getItem(`pickingup_inventory_history_${storeKey}`);
      if (rawHist) loadedMovements = JSON.parse(rawHist);
    } catch {}

    // Supabase DB
    if (user && !isDemoMode && activeStore?.isRealDbStore && isValidUUID(activeStore.id)) {
      try {
        const { data: dbArticles } = await supabase
          .from('articles')
          .select('*')
          .eq('store_id', activeStore.id);

        if (dbArticles && dbArticles.length > 0) {
          loadedArticles = dbArticles;
        }

        const { data: dbMovements } = await supabase
          .from('stock_movements')
          .select('*, stock_movement_items(*)')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (dbMovements && dbMovements.length > 0) {
          loadedMovements = dbMovements;
        }
      } catch {}
    }

    setArticles(loadedArticles);
    setMovements(loadedMovements);
    setLoading(false);
  };

  // KPIs
  const totalArticles = articles.length;
  const lowStockArticles = articles.filter(a => (Number(a.stock) || 0) <= (Number(a.min_stock) || 5));
  const noPriceArticles = articles.filter(a => Number(a.base_price ?? a.price) === 0);
  const totalInventoryValue = articles.reduce((sum, a) => sum + ((Number(a.stock) || 0) * (Number(a.cost) || 0)), 0);

  // Filtered Movements by period
  const filteredMovements = movements.filter(m => {
    const movDate = new Date(m.created_at || m.date || Date.now());
    const now = new Date();

    if (periodFilter === 'TODAY') {
      return movDate.toDateString() === now.toDateString();
    }
    if (periodFilter === 'WEEK') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return movDate >= weekAgo;
    }
    if (periodFilter === 'MONTH') {
      return movDate.getMonth() === now.getMonth() && movDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `reporte_${activeTab}_${activeStore?.slug || 'tienda'}.csv`;

    if (activeTab === 'low_stock') {
      headers = ['Codigo', 'EAN', 'Descripcion', 'Rubro', 'Stock_Actual', 'Stock_Minimo', 'Reponer_Unidades'];
      rows = lowStockArticles.map(a => [
        a.code,
        a.barcode || a.code,
        `"${a.description.replace(/"/g, '""')}"`,
        `"${(a.category || 'General').replace(/"/g, '""')}"`,
        a.stock || 0,
        a.min_stock || 5,
        Math.max(0, (a.min_stock || 5) - (a.stock || 0))
      ]);
    } else if (activeTab === 'movements') {
      headers = ['Fecha', 'Tipo_Movimiento', 'Observaciones', 'Total_Unidades', 'Codigo_Articulo', 'Descripcion_Articulo', 'Cantidad', 'Precio_Unitario', 'Subtotal'];
      rows = [];
      filteredMovements.forEach(m => {
        const mDate = m.date || (m.created_at ? new Date(m.created_at).toLocaleString('es-AR') : 'Reciente');
        const mType = m.movement_type || m.movementType || 'Movimiento';
        const mObs = `"${(m.observations || '').replace(/"/g, '""')}"`;
        const items = m.stock_movement_items || m.items || [];

        if (items && items.length > 0) {
          items.forEach((item: any) => {
            const qty = Number(item.qty) || 1;
            const uPrice = Number(item.unit_price || item.unitPrice) || 0;
            const subtotal = Number(item.total_price || item.total) || (qty * uPrice);
            rows.push([
              mDate,
              mType,
              mObs,
              m.total_units || m.totalUnits || qty,
              item.article_code || item.code || 'ART',
              `"${(item.article_description || item.description || 'Artículo').replace(/"/g, '""')}"`,
              qty,
              uPrice.toFixed(2),
              subtotal.toFixed(2)
            ]);
          });
        } else {
          rows.push([
            mDate,
            mType,
            mObs,
            m.total_units || m.totalUnits || 0,
            '-',
            '"General"',
            0,
            '0.00',
            '0.00'
          ]);
        }
      });
    } else if (activeTab === 'no_price') {
      headers = ['Codigo', 'Descripcion', 'Rubro', 'Precio_Base', 'Costo', 'Stock'];
      rows = noPriceArticles.map(a => [
        a.code,
        `"${a.description.replace(/"/g, '""')}"`,
        `"${(a.category || 'General').replace(/"/g, '""')}"`,
        a.price || 0,
        a.cost || 0,
        a.stock || 0
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '92vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} className="animate-fade-in">

        {/* Top Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <PieChart size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
                CENTRO DE REPORTES Y ANALYTICS EN TIEMPO REAL
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                Estadísticas e Informes — {activeStore?.name || 'Mi Negocio'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setShowExecutiveDashboard(true)}
              style={{
                background: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.875rem',
                color: '#0284c7',
                fontWeight: 900,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
            >
              <TrendingUp size={15} /> Tableros Ejecutivo (Recharts)
            </button>
            <button
              onClick={handleExportCSV}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.875rem',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Download size={15} /> Exportar Reporte CSV
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>VALORIZACIÓN TOTAL STOCK</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
              ${totalInventoryValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL PRODUCTOS EN CATÁLOGO</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
              {totalArticles} artículos
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>STOCK BAJO MÍNIMO</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ef4444', marginTop: '2px' }}>
              {lowStockArticles.length} críticos
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRODUCTOS SIN PRECIO ($0)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f59e0b', marginTop: '2px' }}>
              {noPriceArticles.length} sin precio
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-surface)',
          padding: '0 1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => setActiveTab('low_stock')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'low_stock' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'low_stock' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'low_stock' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <AlertTriangle size={16} /> ⚠️ Stock Bajo Mínimo ({lowStockArticles.length})
            </button>

            <button
              onClick={() => setActiveTab('movements')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'movements' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'movements' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'movements' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <TrendingUp size={16} /> 📊 Movimientos por Período ({filteredMovements.length})
            </button>

            <button
              onClick={() => setActiveTab('no_price')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'no_price' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'no_price' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'no_price' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <DollarSign size={16} /> 💲 Productos Sin Precio ({noPriceArticles.length})
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>

          {/* TAB 1: LOW STOCK */}
          {activeTab === 'low_stock' && (
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Descripción del Producto</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Rubro</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Stock Actual</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Stock Mínimo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Unidades a Reponer</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockArticles.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                        🎉 ¡Excelente! No hay ningún producto con stock por debajo del límite mínimo.
                      </td>
                    </tr>
                  ) : (
                    lowStockArticles.map(a => {
                      const needed = Math.max(0, (a.min_stock || 5) - (a.stock || 0));
                      return (
                        <tr key={a.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>{a.code}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{a.description}</td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{a.category || 'General'}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 900, color: '#ef4444' }}>
                            {a.stock || 0} u.
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {a.min_stock || 5} u.
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 900, fontSize: '0.75rem' }}>
                              +{needed} u.
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            {onOpenInventory && (
                              <button
                                onClick={onOpenInventory}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '0.375rem',
                                  border: 'none',
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  fontWeight: 800,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                              >
                                📦 Ingresar Stock
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: MOVEMENTS BY PERIOD */}
          {activeTab === 'movements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>Filtrar Período:</span>
                {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodFilter(p)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: periodFilter === p ? '#0284c7' : 'var(--bg-surface)',
                      color: periodFilter === p ? '#ffffff' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.78125rem',
                      cursor: 'pointer'
                    }}
                  >
                    {p === 'ALL' ? 'Todos los registros' : (p === 'TODAY' ? 'Hoy' : (p === 'WEEK' ? 'Últimos 7 días' : 'Este Mes'))}
                  </button>
                ))}
              </div>

              <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Fecha y Hora</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Tipo de Movimiento</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Observaciones</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay movimientos registrados para el período seleccionado.
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((m, idx) => (
                        <tr key={m.id || idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {m.date || new Date(m.created_at).toLocaleString('es-AR')}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              background: (m.movement_type || m.movementType) === 'Ingreso' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: (m.movement_type || m.movementType) === 'Ingreso' ? '#10b981' : '#ef4444',
                              fontWeight: 800,
                              fontSize: '0.75rem'
                            }}>
                              {m.movement_type || m.movementType}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)' }}>{m.observations || '-'}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#0284c7' }}>
                            {m.total_units || m.totalUnits || 0} u.
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MISSING PRICES */}
          {activeTab === 'no_price' && (
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Descripción del Producto</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Rubro</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Precio Base</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Costo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {noPriceArticles.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                        🎉 ¡Perfecto! Todos los productos del catálogo tienen un precio asignado mayor a $0.
                      </td>
                    </tr>
                  ) : (
                    noPriceArticles.map(a => (
                      <tr key={a.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>{a.code}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{a.description}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{a.category || 'General'}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>
                          $0.00 (SIN PRECIO)
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>
                          ${(Number(a.cost) || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {onOpenPriceLists && (
                            <button
                              onClick={onOpenPriceLists}
                              style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '0.375rem',
                                border: 'none',
                                background: '#10b981',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              🏷️ Fijar Precio
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showExecutiveDashboard && (
        <React.Suspense fallback={null}>
          <ExecutiveDashboardModal
            isOpen={true}
            onClose={() => setShowExecutiveDashboard(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
