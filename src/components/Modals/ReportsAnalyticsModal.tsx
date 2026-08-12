import React, { useState, useEffect, useMemo } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import { initRealtimeMultiStoreChannels } from '../../services/RealtimeMultiStoreService';
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
  FileSpreadsheet,
  Building2,
  Award,
  Percent,
  ShoppingCart
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
  const { activeStore, stores } = useTenant();
  const { user, isDemoMode } = useAuth();

  const storeKey = activeStore?.id || 'demo-store';

  const [showExecutiveDashboard, setShowExecutiveDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales_period' | 'top_products' | 'profit_margin' | 'branch_comparison' | 'low_stock' | 'movements' | 'no_price'>('sales_period');
  const [articles, setArticles] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [salesRecords, setSalesRecords] = useState<any[]>([]);
  const [allStoresSales, setAllStoresSales] = useState<any[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (isOpen) {
      loadData();
    }

    if (isOpen && activeStore?.isRealDbStore && isValidUUID(activeStore.id) && user && !isDemoMode) {
      const manager = initRealtimeMultiStoreChannels({
        storeId: activeStore.id,
        onSalesChange: () => loadData(),
        onStockChange: () => loadData()
      });

      return () => {
        manager.unsubscribeAll();
      };
    }
  }, [isOpen, activeStore]);

  const loadData = async () => {
    setLoading(true);
    let loadedArticles: any[] = [];
    let loadedMovements: any[] = [];
    let loadedSales: any[] = [];
    let branchSalesData: any[] = [];

    // 1. Local Storage fallback
    try {
      const rawProds = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawProds) loadedArticles = JSON.parse(rawProds);

      const rawHist = localStorage.getItem(`pickingup_inventory_history_${storeKey}`);
      if (rawHist) loadedMovements = JSON.parse(rawHist);

      const rawSales = localStorage.getItem(`pickingup_sales_history_${storeKey}`);
      if (rawSales) loadedSales = JSON.parse(rawSales);
    } catch {}

    // 2. Supabase DB fetching
    if (user && !isDemoMode && activeStore?.isRealDbStore && isValidUUID(activeStore.id)) {
      try {
        // Articles
        const { data: dbArticles } = await supabase
          .from('articles')
          .select('*')
          .eq('store_id', activeStore.id);

        if (dbArticles && dbArticles.length > 0) {
          loadedArticles = dbArticles;
        }

        // Stock Movements
        const { data: dbMovements } = await supabase
          .from('stock_movements')
          .select('*, stock_movement_items(*)')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (dbMovements && dbMovements.length > 0) {
          loadedMovements = dbMovements;
        }

        // Sales & Sales Items
        const { data: dbSales } = await supabase
          .from('sales')
          .select('*, sales_items(*)')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (dbSales && dbSales.length > 0) {
          loadedSales = dbSales.map((s: any) => ({
            id: s.id,
            ticketNumber: s.ticket_number || s.id.slice(0, 8),
            date: s.created_at,
            total: Number(s.total_amount) || 0,
            paymentMethod: s.payment_method || 'Efectivo',
            cashierName: s.cashier_email || 'Operador POS',
            customerName: s.customer_name || 'Consumidor Final',
            items: (s.sales_items || []).map((si: any) => ({
              code: si.article_code,
              description: si.article_description,
              qty: Number(si.qty) || 1,
              unitPrice: Number(si.unit_price) || 0,
              costPrice: Number(si.cost_price) || 0,
              subtotal: Number(si.total_price) || (Number(si.qty) * Number(si.unit_price))
            }))
          }));
        }

        // Branch comparative sales
        const { data: globalSales } = await supabase
          .from('sales')
          .select('store_id, total_amount, created_at');

        if (globalSales) {
          branchSalesData = globalSales;
        }
      } catch (err) {
        console.warn('Error fetching analytics from Supabase:', err);
      }
    }

    setArticles(loadedArticles);
    setMovements(loadedMovements);
    setSalesRecords(loadedSales);
    setAllStoresSales(branchSalesData);
    setLoading(false);
  };

  // Filter Sales by Period
  const filteredSales = useMemo(() => {
    const now = new Date();
    return salesRecords.filter(s => {
      const sDate = new Date(s.date || s.created_at || Date.now());
      if (periodFilter === 'TODAY') {
        return sDate.toDateString() === now.toDateString();
      }
      if (periodFilter === 'WEEK') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return sDate >= weekAgo;
      }
      if (periodFilter === 'MONTH') {
        return sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [salesRecords, periodFilter]);

  // Real KPIs
  const totalSalesRevenue = useMemo(() => filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0), [filteredSales]);
  const totalTicketsCount = filteredSales.length;
  const avgTicketAmount = totalTicketsCount > 0 ? totalSalesRevenue / totalTicketsCount : 0;
  
  const totalArticlesCount = articles.length;
  const lowStockArticles = articles.filter(a => (Number(a.stock) || 0) <= (Number(a.min_stock) || 5));
  const noPriceArticles = articles.filter(a => Number(a.base_price ?? a.price) === 0);
  const totalInventoryValue = articles.reduce((sum, a) => sum + ((Number(a.stock) || 0) * (Number(a.cost) || 0)), 0);

  // Top 10 Products
  const top10Products = useMemo(() => {
    const pMap: Record<string, { code: string; description: string; qty: number; revenue: number; category: string }> = {};
    filteredSales.forEach(s => {
      (s.items || []).forEach((item: any) => {
        const key = item.code || item.description;
        if (!pMap[key]) {
          const matchedArt = articles.find(a => a.code === item.code);
          pMap[key] = {
            code: item.code || 'ART',
            description: item.description || item.code,
            qty: 0,
            revenue: 0,
            category: matchedArt?.category || 'General'
          };
        }
        pMap[key].qty += Number(item.qty) || 1;
        pMap[key].revenue += Number(item.subtotal) || (Number(item.qty || 1) * Number(item.unitPrice || 0));
      });
    });
    return Object.values(pMap).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [filteredSales, articles]);

  // Real Profit Margins Per Article
  const articleProfitMargins = useMemo(() => {
    return articles.map(art => {
      const sellPrice = Number(art.price || art.base_price) || 0;
      const costPrice = Number(art.cost) || 0;
      const marginAmount = sellPrice - costPrice;
      const marginPercent = sellPrice > 0 ? (marginAmount / sellPrice) * 100 : 0;

      // Calculate total units sold for this article in filtered sales
      let unitsSold = 0;
      let totalRevenue = 0;
      filteredSales.forEach(s => {
        (s.items || []).forEach((i: any) => {
          if (i.code === art.code) {
            unitsSold += Number(i.qty) || 0;
            totalRevenue += Number(i.subtotal) || 0;
          }
        });
      });

      const totalProfit = unitsSold * marginAmount;

      return {
        code: art.code,
        description: art.description,
        category: art.category || 'General',
        stock: Number(art.stock) || 0,
        sellPrice,
        costPrice,
        marginAmount,
        marginPercent,
        unitsSold,
        totalRevenue,
        totalProfit
      };
    }).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [articles, filteredSales]);

  // Branch Comparative Sales
  const branchComparisonData = useMemo(() => {
    if (stores && stores.length > 0) {
      return stores.map(st => {
        const storeSales = allStoresSales.filter(s => s.store_id === st.id);
        const totalRev = storeSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        return {
          id: st.id,
          name: st.name,
          slug: st.slug,
          totalSales: totalRev,
          ticketsCount: storeSales.length,
          avgTicket: storeSales.length > 0 ? totalRev / storeSales.length : 0,
          isActive: st.id === activeStore?.id
        };
      });
    }
    return [{
      id: activeStore?.id || 'main',
      name: activeStore?.name || 'Tienda Principal',
      slug: activeStore?.slug || 'main',
      totalSales: totalSalesRevenue,
      ticketsCount: totalTicketsCount,
      avgTicket: avgTicketAmount,
      isActive: true
    }];
  }, [stores, allStoresSales, activeStore, totalSalesRevenue, totalTicketsCount, avgTicketAmount]);

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

    if (activeTab === 'sales_period') {
      headers = ['Ticket', 'Fecha', 'Cliente', 'Cajero', 'Metodo_Pago', 'Total_Facturado'];
      rows = filteredSales.map(s => [
        s.ticketNumber,
        new Date(s.date).toLocaleString('es-AR'),
        `"${(s.customerName || 'Consumidor Final').replace(/"/g, '""')}"`,
        `"${(s.cashierName || 'Operador').replace(/"/g, '""')}"`,
        s.paymentMethod || 'Efectivo',
        (Number(s.total) || 0).toFixed(2)
      ]);
    } else if (activeTab === 'top_products') {
      headers = ['Ranking', 'Codigo', 'Descripcion', 'Rubro', 'Unidades_Vendidas', 'Facturacion_Total'];
      rows = top10Products.map((p, i) => [
        i + 1,
        p.code,
        `"${p.description.replace(/"/g, '""')}"`,
        `"${p.category.replace(/"/g, '""')}"`,
        p.qty,
        p.revenue.toFixed(2)
      ]);
    } else if (activeTab === 'profit_margin') {
      headers = ['Codigo', 'Descripcion', 'Rubro', 'Stock', 'Precio_Venta', 'Costo_Unitario', 'Margen_Unitario', 'Porcentaje_Margen', 'Unidades_Vendidas', 'Ganancia_Total_Acumulada'];
      rows = articleProfitMargins.map(a => [
        a.code,
        `"${a.description.replace(/"/g, '""')}"`,
        `"${a.category.replace(/"/g, '""')}"`,
        a.stock,
        a.sellPrice.toFixed(2),
        a.costPrice.toFixed(2),
        a.marginAmount.toFixed(2),
        `${a.marginPercent.toFixed(1)}%`,
        a.unitsSold,
        a.totalProfit.toFixed(2)
      ]);
    } else if (activeTab === 'branch_comparison') {
      headers = ['Sucursal', 'Facturacion_Total', 'Cantidad_Tickets', 'Ticket_Promedio', 'Estado'];
      rows = branchComparisonData.map(b => [
        `"${b.name.replace(/"/g, '""')}"`,
        b.totalSales.toFixed(2),
        b.ticketsCount,
        b.avgTicket.toFixed(2),
        b.isActive ? 'Sucursal Activa' : 'Sucursal Remota'
      ]);
    } else if (activeTab === 'low_stock') {
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
      headers = ['Fecha', 'Tipo_Movimiento', 'Observaciones', 'Total_Unidades'];
      rows = filteredMovements.map(m => [
        m.date || (m.created_at ? new Date(m.created_at).toLocaleString('es-AR') : 'Reciente'),
        m.movement_type || m.movementType || 'Movimiento',
        `"${(m.observations || '').replace(/"/g, '""')}"`,
        m.total_units || m.totalUnits || 0
      ]);
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
        maxWidth: '1240px',
        maxHeight: '94vh',
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
                CENTRO DE REPORTES Y ANALYTICS DE VENTAS REALES
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
              <Download size={15} /> Exportar CSV
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

        {/* Summary Real KPI Cards */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>FACTURACIÓN TOTAL VENTAS</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
              ${totalSalesRevenue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{totalTicketsCount} comprobantes</div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>TICKET PROMEDIO</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
              ${avgTicketAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Venta media por ticket</div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>VALORIZACIÓN STOCK</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#8b5cf6', marginTop: '2px' }}>
              ${totalInventoryValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{totalArticlesCount} artículos cargados</div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>STOCK CRÍTICO BAJO</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ef4444', marginTop: '2px' }}>
              {lowStockArticles.length} críticos
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{noPriceArticles.length} sin precio ($0)</div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-surface)',
          padding: '0 1.5rem',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => setActiveTab('sales_period')}
              style={{
                padding: '0.875rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'sales_period' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'sales_period' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'sales_period' ? 800 : 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap'
              }}
            >
              <TrendingUp size={16} /> Ventas por Período ({filteredSales.length})
            </button>

            <button
              onClick={() => setActiveTab('top_products')}
              style={{
                padding: '0.875rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'top_products' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'top_products' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'top_products' ? 800 : 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Award size={16} /> Top 10 Productos
            </button>

            <button
              onClick={() => setActiveTab('profit_margin')}
              style={{
                padding: '0.875rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'profit_margin' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'profit_margin' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'profit_margin' ? 800 : 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Percent size={16} /> Margen Ganancia Real
            </button>

            <button
              onClick={() => setActiveTab('branch_comparison')}
              style={{
                padding: '0.875rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'branch_comparison' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'branch_comparison' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'branch_comparison' ? 800 : 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Building2 size={16} /> Comparativa Sucursales
            </button>

            <button
              onClick={() => setActiveTab('low_stock')}
              style={{
                padding: '0.875rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'low_stock' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'low_stock' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'low_stock' ? 800 : 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap'
              }}
            >
              <AlertTriangle size={16} /> Stock Bajo ({lowStockArticles.length})
            </button>

            <button
              onClick={() => setActiveTab('movements')}
              style={{
                padding: '0.875rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'movements' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'movements' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === 'movements' ? 800 : 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Layers size={16} /> Movimientos ({filteredMovements.length})
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>

          {/* TAB: VENTAS POR PERÍODO */}
          {activeTab === 'sales_period' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      {p === 'ALL' ? 'Todos los comprobantes' : (p === 'TODAY' ? 'Hoy' : (p === 'WEEK' ? 'Últimos 7 días' : 'Este Mes'))}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0284c7' }}>
                  Total en Período: ${totalSalesRevenue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Ticket #</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Fecha y Hora</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Cajero / Operador</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Método de Pago</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Monto Total ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay ventas registradas para el período seleccionado.
                        </td>
                      </tr>
                    ) : (
                      filteredSales.map((s, idx) => (
                        <tr key={s.id || idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#0284c7' }}>
                            {s.ticketNumber}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {new Date(s.date).toLocaleString('es-AR')}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                            {s.customerName || 'Consumidor Final'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                            {s.cashierName}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              background: 'rgba(2, 132, 199, 0.15)',
                              color: '#0284c7',
                              fontWeight: 800,
                              fontSize: '0.75rem'
                            }}>
                              {s.paymentMethod}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#10b981' }}>
                            ${(Number(s.total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: TOP 10 PRODUCTOS */}
          {activeTab === 'top_products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Ranking</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Descripción del Producto</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Rubro / Categoría</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Unidades Vendidas</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Ingresos Totales ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Products.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay ventas registradas para generar el ranking de productos.
                        </td>
                      </tr>
                    ) : (
                      top10Products.map((p, idx) => (
                        <tr key={p.code + idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 900, color: '#0284c7' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>{p.code}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{p.description}</td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{p.category}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 900, color: '#0f172a' }}>
                            {p.qty} u.
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#10b981' }}>
                            ${p.revenue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: MARGEN DE GANANCIA REAL */}
          {activeTab === 'profit_margin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Producto</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Precio Venta ($)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Costo Unitario ($)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Margen ($)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>% Margen</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Ganancia Acumulada ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articleProfitMargins.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay productos registrados en el catálogo.
                        </td>
                      </tr>
                    ) : (
                      articleProfitMargins.map(a => (
                        <tr key={a.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>{a.code}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{a.description}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                            ${a.sellPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                            ${a.costPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: a.marginAmount >= 0 ? '#10b981' : '#ef4444' }}>
                            ${a.marginAmount.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              background: a.marginPercent >= 30 ? 'rgba(16, 185, 129, 0.15)' : (a.marginPercent > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                              color: a.marginPercent >= 30 ? '#10b981' : (a.marginPercent > 0 ? '#f59e0b' : '#ef4444'),
                              fontWeight: 900,
                              fontSize: '0.75rem'
                            }}>
                              {a.marginPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                            ${a.totalProfit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: COMPARATIVA INTER-SUCURSALES */}
          {activeTab === 'branch_comparison' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Sucursal / Comercio</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Facturación Acumulada ($)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Ventas Emitidas</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Ticket Promedio ($)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchComparisonData.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Building2 size={16} style={{ color: '#0284c7' }} />
                          {b.name}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#10b981' }}>
                          ${b.totalSales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                          {b.ticketsCount} tickets
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                          ${b.avgTicket.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '0.375rem',
                            background: b.isActive ? '#e0f2fe' : 'var(--bg-app)',
                            color: b.isActive ? '#0284c7' : 'var(--text-muted)',
                            fontWeight: 800,
                            fontSize: '0.75rem'
                          }}>
                            {b.isActive ? 'Sucursal Activa' : 'Sucursal Remota'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
