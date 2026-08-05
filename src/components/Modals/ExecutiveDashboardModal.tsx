import React, { useState, useEffect, useMemo } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  TrendingUp,
  Users,
  ShoppingBag,
  Download,
  Award,
  Sparkles,
  ArrowUpRight,
  Landmark,
  CheckCircle2,
  PackageCheck,
  Inbox
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface ExecutiveDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RealSaleItem {
  code: string;
  description: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  category?: string;
}

interface RealSaleRecord {
  id: string;
  ticketNumber: number;
  date: string;
  total: number;
  subtotal: number;
  discountAmount?: number;
  paymentMethod: string;
  cashierName: string;
  registerName: string;
  items: RealSaleItem[];
  storeId?: string;
}

const CHART_COLORS = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export const ExecutiveDashboardModal: React.FC<ExecutiveDashboardModalProps> = ({ isOpen, onClose }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const storeKey = activeStore?.id || 'demo-store';

  const [activeTab, setActiveTab] = useState<'sales' | 'sellers' | 'products' | 'cash' | 'intelligence'>('sales');
  const [periodFilter, setPeriodFilter] = useState<'TODAY' | '7D' | '30D' | 'MONTH' | 'ALL'>('ALL');

  // Strictly Real Data State
  const [articles, setArticles] = useState<any[]>([]);
  const [salesHistory, setSalesHistory] = useState<RealSaleRecord[]>([]);
  const [cashRegisters, setCashRegisters] = useState<any[]>([]);
  const [cashMovements, setCashMovements] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadStrictRealData();
    }
  }, [isOpen, activeStore]);

  const loadStrictRealData = async () => {
    let loadedArticles: any[] = [];
    let loadedSales: RealSaleRecord[] = [];
    let loadedRegisters: any[] = [];
    let loadedCashMovs: any[] = [];

    // 1. Read Supabase Live Records first for Authenticated Users
    if (user && !isDemoMode && activeStore) {
      try {
        const { data: dbArticles } = await supabase
          .from('articles')
          .select('*')
          .eq('store_id', activeStore.id);
        if (dbArticles && dbArticles.length > 0) loadedArticles = dbArticles;

        const { data: dbRegisters } = await supabase
          .from('cash_registers')
          .select('*')
          .eq('store_id', activeStore.id);
        if (dbRegisters && dbRegisters.length > 0) loadedRegisters = dbRegisters;

        const { data: dbMovements } = await supabase
          .from('stock_movements')
          .select('*, stock_movement_items(*)')
          .eq('store_id', activeStore.id)
          .eq('movement_type', 'Egreso')
          .order('created_at', { ascending: false });

        if (dbMovements && dbMovements.length > 0) {
          loadedSales = dbMovements.map((sm: any, idx: number) => {
            const items: RealSaleItem[] = (sm.stock_movement_items || []).map((smi: any) => ({
              code: smi.article_code || 'ART',
              description: smi.article_description || 'Artículo',
              qty: Number(smi.qty) || 1,
              unitPrice: Number(smi.unit_price) || 0,
              subtotal: Number(smi.total_price) || (Number(smi.qty || 1) * Number(smi.unit_price || 0)),
              category: 'General'
            }));
            const calculatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

            return {
              id: sm.id || `db-sale-${idx}`,
              ticketNumber: sm.ticket_number || (100 + idx),
              date: sm.created_at || new Date().toISOString(),
              total: calculatedTotal,
              subtotal: calculatedTotal,
              paymentMethod: sm.payment_method || 'Efectivo',
              cashierName: sm.created_by_email || user.email?.split('@')[0] || 'Operador',
              registerName: sm.register_name || 'Caja POS',
              items,
              storeId: activeStore.id
            };
          });
        }
      } catch (e) {
        console.warn('Error fetching Supabase db records:', e);
      }
    }

    // 2. Read LocalStorage Records (Fallback or Offline Supplement)
    try {
      if (loadedArticles.length === 0) {
        const rawProds = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
        if (rawProds) loadedArticles = JSON.parse(rawProds);
      }

      const rawSales = localStorage.getItem(`pickingup_sales_history_${storeKey}`);
      if (rawSales) {
        const parsedSales = JSON.parse(rawSales);
        const pureSales = parsedSales.filter((s: any) => s && !s.id?.toString().startsWith('seed-sale-'));
        if (loadedSales.length === 0) {
          loadedSales = pureSales;
        } else {
          const existingIds = new Set(loadedSales.map(s => s.id));
          const newFromLocal = pureSales.filter((s: any) => !existingIds.has(s.id));
          loadedSales = [...loadedSales, ...newFromLocal];
        }
      }

      if (loadedRegisters.length === 0) {
        const rawRegs = localStorage.getItem(`pickingup_registers_${storeKey}`) || localStorage.getItem(`pickingup_cajas_config_${storeKey}`);
        if (rawRegs) loadedRegisters = JSON.parse(rawRegs);
      }

      const rawMovs = localStorage.getItem(`pickingup_cash_movs_${storeKey}`);
      if (rawMovs) loadedCashMovs = JSON.parse(rawMovs);
    } catch (e) {
      console.warn('Error reading local storage records:', e);
    }

    setArticles(loadedArticles);
    setSalesHistory(loadedSales);
    setCashRegisters(loadedRegisters);
    setCashMovements(loadedCashMovs);
  };

  // --- Strict Filtering by Period ---
  const filteredSales = useMemo(() => {
    const now = new Date();
    return salesHistory.filter(sale => {
      const sDate = new Date(sale.date);
      if (periodFilter === 'TODAY') {
        return sDate.toDateString() === now.toDateString();
      }
      if (periodFilter === '7D') {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        return sDate >= sevenDaysAgo;
      }
      if (periodFilter === '30D') {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return sDate >= thirtyDaysAgo;
      }
      if (periodFilter === 'MONTH') {
        return sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [salesHistory, periodFilter]);

  // Real KPIs (Zero when no sales)
  const totalSalesAmount = useMemo(() => filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0), [filteredSales]);
  const totalTransactionsCount = filteredSales.length;
  const averageTicketValue = totalTransactionsCount > 0 ? Math.round(totalSalesAmount / totalTransactionsCount) : 0;

  // 1. Strict Sales Time Series Data
  const salesTimeSeriesData = useMemo(() => {
    if (filteredSales.length === 0) return [];

    if (periodFilter === 'TODAY') {
      const hoursMap: Record<string, { ventas: number; tickets: number }> = {};
      for (let h = 8; h <= 20; h += 2) {
        const label = `${h.toString().padStart(2, '0')}:00`;
        hoursMap[label] = { ventas: 0, tickets: 0 };
      }
      filteredSales.forEach(s => {
        const h = new Date(s.date).getHours();
        const slot = `${(Math.floor(h / 2) * 2).toString().padStart(2, '0')}:00`;
        if (hoursMap[slot]) {
          hoursMap[slot].ventas += Number(s.total) || 0;
          hoursMap[slot].tickets += 1;
        }
      });
      return Object.entries(hoursMap).map(([time, data]) => ({
        time,
        ventas: data.ventas,
        tickets: data.tickets,
        promedio: data.tickets > 0 ? Math.round(data.ventas / data.tickets) : 0
      }));
    }

    const daysMap: Record<string, { ventas: number; tickets: number }> = {};
    filteredSales.forEach(s => {
      const dayLabel = new Date(s.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
      if (!daysMap[dayLabel]) {
        daysMap[dayLabel] = { ventas: 0, tickets: 0 };
      }
      daysMap[dayLabel].ventas += Number(s.total) || 0;
      daysMap[dayLabel].tickets += 1;
    });

    return Object.entries(daysMap).map(([time, data]) => ({
      time,
      ventas: data.ventas,
      tickets: data.tickets,
      promedio: data.tickets > 0 ? Math.round(data.ventas / data.tickets) : 0
    }));
  }, [filteredSales, periodFilter]);

  // 2. Strict Payment Methods Distribution
  const paymentMethodsData = useMemo(() => {
    if (filteredSales.length === 0) return [];
    const pMap: Record<string, number> = {};
    filteredSales.forEach(s => {
      const method = s.paymentMethod || 'Efectivo';
      pMap[method] = (pMap[method] || 0) + (Number(s.total) || 0);
    });

    const totalVal = Object.values(pMap).reduce((sum, v) => sum + v, 0) || 1;
    return Object.entries(pMap).map(([name, amount]) => ({
      name,
      amount,
      value: Math.round((amount / totalVal) * 100)
    }));
  }, [filteredSales]);

  // 3. Strict Salesperson / Cashier Performance
  const sellersPerformanceData = useMemo(() => {
    if (filteredSales.length === 0) return [];
    const sellerMap: Record<string, { ventas: number; tickets: number }> = {};
    filteredSales.forEach(s => {
      const name = s.cashierName || 'Cajero Principal';
      if (!sellerMap[name]) {
        sellerMap[name] = { ventas: 0, tickets: 0 };
      }
      sellerMap[name].ventas += Number(s.total) || 0;
      sellerMap[name].tickets += 1;
    });

    const maxSales = Math.max(...Object.values(sellerMap).map(v => v.ventas), 1);
    return Object.entries(sellerMap).map(([name, data]) => ({
      name,
      ventas: data.ventas,
      tickets: data.tickets,
      ticketProm: data.tickets > 0 ? Math.round(data.ventas / data.tickets) : 0,
      meta: Math.min(100, Math.round((data.ventas / maxSales) * 100))
    })).sort((a, b) => b.ventas - a.ventas);
  }, [filteredSales]);

  // 4. Strict Top Products
  const topProductsData = useMemo(() => {
    if (filteredSales.length === 0) return [];
    const prodMap: Record<string, { name: string; unidades: number; ingresos: number; rubro: string }> = {};

    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        const key = item.code || item.description;
        if (!prodMap[key]) {
          prodMap[key] = {
            name: item.description || item.code,
            unidades: 0,
            ingresos: 0,
            rubro: item.category || 'General'
          };
        }
        prodMap[key].unidades += Number(item.qty) || 1;
        prodMap[key].ingresos += Number(item.subtotal) || (Number(item.qty || 1) * Number(item.unitPrice || 0));
      });
    });

    return Object.values(prodMap).sort((a, b) => b.unidades - a.unidades).slice(0, 10);
  }, [filteredSales]);

  // 5. Strict Cash Register Control
  const cashControlData = useMemo(() => {
    if (cashRegisters.length === 0 && filteredSales.length === 0) return [];

    if (cashRegisters.length > 0) {
      return cashRegisters.map((reg) => {
        const regSales = filteredSales.filter(s => s.registerName === reg.name || s.paymentMethod === 'Efectivo');
        const totalCashSales = regSales.reduce((sum, s) => sum + (s.paymentMethod === 'Efectivo' ? Number(s.total) || 0 : 0), 0);
        const inicial = Number(reg.initial_cash || reg.opening_balance || 0);
        const egresos = cashMovements
          .filter(m => m.register_id === reg.id || m.type === 'egreso')
          .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
        const saldoActual = inicial + totalCashSales - egresos;

        return {
          caja: reg.name || `Caja ${reg.code || ''}`,
          inicial,
          ventasEfectivo: totalCashSales,
          egresos,
          saldoActual,
          estado: 'Activa'
        };
      });
    }

    const cashSalesTotal = filteredSales
      .filter(s => s.paymentMethod === 'Efectivo')
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    const totalEgresos = cashMovements
      .filter(m => m.type === 'egreso')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    return [
      {
        caja: 'Caja Principal POS',
        inicial: 0,
        ventasEfectivo: cashSalesTotal,
        egresos: totalEgresos,
        saldoActual: cashSalesTotal - totalEgresos,
        estado: 'Activa'
      }
    ];
  }, [cashRegisters, filteredSales, cashMovements]);

  // Strict Real Catalog Valuation
  const inventoryValuation = useMemo(() => {
    return articles.reduce((sum, a) => {
      const stock = Number(a.stock) || 0;
      const price = Number(a.price || a.base_price || a.cost) || 0;
      return sum + (stock * price);
    }, 0);
  }, [articles]);

  const handleExportCSV = () => {
    let csvRows: string[] = [];
    csvRows.push(`Reporte Ejecutivo - ${activeTab.toUpperCase()} - ${activeStore?.name || 'Comercio'}`);
    csvRows.push(`Fecha Generacion: ${new Date().toLocaleString('es-AR')}`);
    csvRows.push('');

    if (activeTab === 'sales') {
      csvRows.push('Periodo,Ventas Totales ($),Cantidad Tickets,Ticket Promedio ($)');
      salesTimeSeriesData.forEach(row => {
        csvRows.push(`"${row.time}",${row.ventas},${row.tickets},${row.promedio}`);
      });
    } else if (activeTab === 'sellers') {
      csvRows.push('Vendedor/Cajero,Total Ventas ($),Tickets Emitidos,Ticket Promedio ($),Meta %');
      sellersPerformanceData.forEach(row => {
        csvRows.push(`"${row.name}",${row.ventas},${row.tickets},${row.ticketProm},${row.meta}%`);
      });
    } else if (activeTab === 'products') {
      csvRows.push('Producto,Rubro,Unidades Vendidas,Ingresos Generados ($)');
      topProductsData.forEach(row => {
        csvRows.push(`"${row.name}","${row.rubro}",${row.unidades},${row.ingresos}`);
      });
    } else if (activeTab === 'cash') {
      csvRows.push('Caja Terminal,Fondo Inicial,Ventas Efectivo,Egresos,Saldo Actual,Estado');
      cashControlData.forEach(row => {
        csvRows.push(`"${row.caja}",${row.inicial},${row.ventasEfectivo},${row.egresos},${row.saldoActual},${row.estado}`);
      });
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tablero_ejecutivo_${activeTab}_${Date.now()}.csv`;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '1280px',
        maxHeight: '94vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} className="animate-fade-in">

        {/* Top Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '0.875rem',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
            }}>
              <TrendingUp size={24} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#38bdf8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                <Sparkles size={13} /> TABLERO EJECUTIVO REAL — RECHARTS & ANALYTICS
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: '2px 0 0 0', color: '#ffffff' }}>
                Métricas de Mi Comercio — {activeStore?.name || 'Mi Negocio'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Period Selector */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '0.25rem',
              borderRadius: '0.625rem',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              {(['TODAY', '7D', '30D', 'MONTH'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: periodFilter === p ? '#0284c7' : 'transparent',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p === 'TODAY' ? 'Hoy' : p === '7D' ? '7 Días' : p === '30D' ? '30 Días' : 'Este Mes'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCSV}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '0.625rem',
                padding: '0.5rem 0.875rem',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
              }}
            >
              <Download size={15} /> Exportar CSV
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                borderRadius: '0.625rem',
                width: '36px',
                height: '36px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.875rem 1.75rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          overflowX: 'auto'
        }}>
          {[
            { id: 'sales', label: 'Ventas & Facturación Real', icon: <TrendingUp size={16} /> },
            { id: 'sellers', label: 'Rendimiento Vendedores', icon: <Users size={16} /> },
            { id: 'products', label: 'Productos Más Vendidos', icon: <ShoppingBag size={16} /> },
            { id: 'cash', label: 'Control de Caja & Tesorería', icon: <Landmark size={16} /> },
            { id: 'intelligence', label: 'Inteligencia de Negocio', icon: <Sparkles size={16} /> }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.625rem',
                  border: isActive ? '1px solid #0284c7' : '1px solid transparent',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0284c7' : '#64748b',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(2, 132, 199, 0.12)' : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div style={{
          padding: '1.5rem 1.75rem',
          overflowY: 'auto',
          flex: 1,
          background: '#f8fafc'
        }}>

          {/* Real KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
            marginBottom: '1.75rem'
          }}>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8125rem', fontWeight: 700 }}>
                <span>FACTURACIÓN TOTAL ({periodFilter})</span>
                <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 800 }}>
                  Real
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '0.5rem 0 0.25rem 0' }}>
                ${totalSalesAmount.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                {totalTransactionsCount} {totalTransactionsCount === 1 ? 'venta registrada' : 'ventas registradas'}
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8125rem', fontWeight: 700 }}>
                <span>TICKETS / OPERACIONES</span>
                <div style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 800 }}>
                  Real POS
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '0.5rem 0 0.25rem 0' }}>
                {totalTransactionsCount} ops
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                Transacciones cobradas en cajas
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8125rem', fontWeight: 700 }}>
                <span>TICKET PROMEDIO ($)</span>
                <div style={{ background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 800 }}>
                  Promedio
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '0.5rem 0 0.25rem 0' }}>
                ${averageTicketValue.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                Importe medio por venta cobrada
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8125rem', fontWeight: 700 }}>
                <span>VALOR DE CATÁLOGO</span>
                <div style={{ background: '#dcfce7', color: '#15803d', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 800 }}>
                  {articles.length} Artículos
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981', margin: '0.5rem 0 0.25rem 0' }}>
                ${inventoryValuation.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                Valor de stock activo en tienda
              </div>
            </div>
          </div>

          {/* TAB 1: VENTAS & FACTURACIÓN */}
          {activeTab === 'sales' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0', color: '#0f172a' }}>
                  Evolución Real de Facturación ($)
                </h3>

                {salesTimeSeriesData.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                    <Inbox size={40} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 800, color: '#475569', fontSize: '1rem' }}>Sin ventas registradas en este periodo</div>
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>
                      Realizá cobranzas desde el módulo <strong>Venta POS</strong> para comenzar a visualizar la curva de ventas aquí.
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesTimeSeriesData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="realSalesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(value: any) => [`$${Number(value).toLocaleString('es-AR')}`, 'Ventas Reales']}
                          contentStyle={{ background: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#ffffff' }}
                        />
                        <Area type="monotone" dataKey="ventas" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#realSalesGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1rem',
                  padding: '1.5rem'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#0f172a' }}>
                    Distribución por Medio de Pago Real
                  </h3>
                  {paymentMethodsData.length === 0 ? (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontWeight: 700, color: '#64748b' }}>Sin pagos procesados</div>
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentMethodsData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {paymentMethodsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any, name: any, props: any) => [
                              `${value}% ($${props.payload.amount.toLocaleString('es-AR')})`,
                              props.payload.name
                            ]}
                            contentStyle={{ background: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#ffffff' }}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1rem',
                  padding: '1.5rem'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#0f172a' }}>
                    Operaciones por Intervalo
                  </h3>
                  {salesTimeSeriesData.length === 0 ? (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontWeight: 700, color: '#64748b' }}>Sin operaciones en este periodo</div>
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesTimeSeriesData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#ffffff' }} />
                          <Bar dataKey="tickets" fill="#10b981" radius={[6, 6, 0, 0]} name="Tickets Reales" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RENDIMIENTO VENDEDORES */}
          {activeTab === 'sellers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0', color: '#0f172a' }}>
                  Ranking de Ventas por Vendedor Real
                </h3>
                {sellersPerformanceData.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                    <Users size={36} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 700, color: '#475569' }}>No se registraron ventas por operador en este periodo</div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sellersPerformanceData} layout="vertical" margin={{ left: 40, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <YAxis dataKey="name" type="category" stroke="#0f172a" fontSize={12} fontWeight={700} width={140} />
                        <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString('es-AR')}`, 'Facturación Real']} contentStyle={{ background: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#ffffff' }} />
                        <Bar dataKey="ventas" fill="#8b5cf6" radius={[0, 8, 8, 0]} name="Facturación ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {sellersPerformanceData.length > 0 && (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  overflowX: 'auto'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#0f172a' }}>
                    Desglose Detallado por Operador Real
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontSize: '0.75rem', color: '#64748b' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Vendedor / Cajero</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Facturado ($)</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Tickets Emitidos</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ticket Promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellersPerformanceData.map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.875rem 0.75rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Award size={18} style={{ color: idx === 0 ? '#f59e0b' : '#94a3b8' }} />
                            {s.name}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                            ${s.ventas.toLocaleString('es-AR')}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                            {s.tickets}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                            ${s.ticketProm.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRODUCTOS MÁS VENDIDOS */}
          {activeTab === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0', color: '#0f172a' }}>
                  Top Productos Reales por Unidades Vendidas
                </h3>
                {topProductsData.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                    <ShoppingBag size={36} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 700, color: '#475569' }}>No hay ventas de productos en este periodo</div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProductsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                        <Tooltip formatter={(v: any) => [`${v} unidades`, 'Volumen Real']} contentStyle={{ background: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#ffffff' }} />
                        <Bar dataKey="unidades" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Unidades Vendidas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {topProductsData.length > 0 && (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  overflowX: 'auto'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#0f172a' }}>
                    Ranking de Facturación Real por Producto
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontSize: '0.75rem', color: '#64748b' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Descripción de Producto</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Rubro</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Unidades</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Facturación Acumulada ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProductsData.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.875rem 0.75rem', fontWeight: 800, color: '#0284c7' }}>
                            #{i + 1}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', fontWeight: 700, color: '#0f172a' }}>
                            {p.name}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', color: '#64748b' }}>
                            <span style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700 }}>
                              {p.rubro}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                            {p.unidades}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 900, color: '#10b981' }}>
                            ${p.ingresos.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CONTROL DE CAJA */}
          {activeTab === 'cash' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem',
                overflowX: 'auto'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0', color: '#0f172a' }}>
                  Estado Real de Cajas Registradoras & Terminales POS
                </h3>
                {cashControlData.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                    <Landmark size={36} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 700, color: '#475569' }}>Sin cajas activas o cobranzas registradas</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontSize: '0.75rem', color: '#64748b' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Terminal de Caja</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Fondo Inicial ($)</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ventas Efectivo Real ($)</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Egresos Registrados ($)</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Saldo en Caja ($)</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashControlData.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.875rem 0.75rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Landmark size={18} style={{ color: '#0284c7' }} />
                            {c.caja}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                            ${c.inicial.toLocaleString('es-AR')}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                            +${c.ventasEfectivo.toLocaleString('es-AR')}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                            -${c.egresos.toLocaleString('es-AR')}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                            ${c.saldoActual.toLocaleString('es-AR')}
                          </td>
                          <td style={{ padding: '0.875rem 0.75rem', textAlign: 'center' }}>
                            <span style={{
                              background: '#dcfce7',
                              color: '#166534',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: 800
                            }}>
                              {c.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: INTELIGENCIA DE NEGOCIO */}
          {activeTab === 'intelligence' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <Sparkles style={{ color: '#0284c7' }} />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Proyección Real al Cierre de Mes
                  </h3>
                </div>
                {totalTransactionsCount === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Sin ventas registradas en el periodo seleccionado para proyectar el cierre.
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
                      Basado en las <strong>{totalTransactionsCount} ventas reales</strong> capturadas con un promedio de <strong>${Math.round(totalSalesAmount / Math.max(1, salesTimeSeriesData.length)).toLocaleString('es-AR')}/día</strong>.
                    </p>
                    <div style={{ background: '#e0f2fe', borderRadius: '0.75rem', padding: '1rem', marginTop: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 800, textTransform: 'uppercase' }}>Proyección Estimada</div>
                      <div style={{ fontSize: '1.25rem', color: '#0c4a6e', fontWeight: 900, marginTop: '4px' }}>
                        ${Math.round((totalSalesAmount / Math.max(1, salesTimeSeriesData.length)) * 30).toLocaleString('es-AR')}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <PackageCheck style={{ color: '#10b981' }} />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Valor de Catálogo Real
                  </h3>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                  ${inventoryValuation.toLocaleString('es-AR')}
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '4px 0 1rem 0' }}>
                  Valor total del stock físico cargado en {articles.length} artículos en la tienda.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            Conectado a datos reales del POS y Supabase ({activeStore?.name || 'Tienda Principal'})
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.625rem',
              padding: '0.6rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Cerrar Tablero
          </button>
        </div>

      </div>
    </div>
  );
};
