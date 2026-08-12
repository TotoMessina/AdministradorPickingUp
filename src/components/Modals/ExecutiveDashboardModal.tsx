import React, { useState, useEffect, useMemo } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import { initRealtimeMultiStoreChannels } from '../../services/RealtimeMultiStoreService';
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
  Inbox,
  AlertTriangle,
  Clock,
  PieChart as PieIcon,
  Percent,
  Flame,
  Zap,
  Layers,
  ChevronRight
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
  costPrice?: number;
  subtotal: number;
  category?: string;
}

interface RealSaleRecord {
  id: string;
  ticketNumber: string | number;
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

const CHART_COLORS = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#ef4444'];
const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export const ExecutiveDashboardModal: React.FC<ExecutiveDashboardModalProps> = ({ isOpen, onClose }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const storeKey = activeStore?.id || 'demo-store';

  const [activeTab, setActiveTab] = useState<'sales' | 'category_roi' | 'heatmap' | 'stock_alerts' | 'sellers' | 'cash'>('sales');
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

    if (isOpen && activeStore?.isRealDbStore && isValidUUID(activeStore.id) && user && !isDemoMode) {
      const manager = initRealtimeMultiStoreChannels({
        storeId: activeStore.id,
        onSalesChange: () => loadStrictRealData(),
        onStockChange: () => loadStrictRealData()
      });

      return () => {
        manager.unsubscribeAll();
      };
    }
  }, [isOpen, activeStore]);

  const loadStrictRealData = async () => {
    let loadedArticles: any[] = [];
    let loadedSales: RealSaleRecord[] = [];
    let loadedRegisters: any[] = [];
    let loadedCashMovs: any[] = [];

    // 1. Read Supabase Live Records first for Authenticated Users
    if (user && !isDemoMode && activeStore?.isRealDbStore && isValidUUID(activeStore.id)) {
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

        // Query public.sales & public.sales_items
        const { data: dbSales } = await supabase
          .from('sales')
          .select('*, sales_items(*)')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (dbSales && dbSales.length > 0) {
          loadedSales = dbSales.map((s: any, idx: number) => {
            const items: RealSaleItem[] = (s.sales_items || []).map((si: any) => {
              const matchedArt = loadedArticles.find(a => a.code === si.article_code);
              return {
                code: si.article_code || 'ART',
                description: si.article_description || 'Artículo',
                qty: Number(si.qty) || 1,
                unitPrice: Number(si.unit_price) || 0,
                costPrice: Number(si.cost_price ?? matchedArt?.cost) || 0,
                subtotal: Number(si.total_price) || (Number(si.qty || 1) * Number(si.unit_price || 0)),
                category: matchedArt?.category || 'General'
              };
            });
            const calculatedTotal = Number(s.total_amount) || items.reduce((sum, item) => sum + item.subtotal, 0);

            return {
              id: s.id || `db-sale-${idx}`,
              ticketNumber: s.ticket_number || (100 + idx),
              date: s.created_at || new Date().toISOString(),
              total: calculatedTotal,
              subtotal: calculatedTotal,
              paymentMethod: s.payment_method || 'Efectivo',
              cashierName: s.cashier_email || user.email?.split('@')[0] || 'Operador POS',
              registerName: 'Caja POS',
              items,
              storeId: activeStore.id
            };
          });
        } else {
          // Fallback: Stock Movements Egreso if sales table was empty
          const { data: dbMovements } = await supabase
            .from('stock_movements')
            .select('*, stock_movement_items(*)')
            .eq('store_id', activeStore.id)
            .eq('movement_type', 'Egreso')
            .order('created_at', { ascending: false });

          if (dbMovements && dbMovements.length > 0) {
            loadedSales = dbMovements.map((sm: any, idx: number) => {
              const items: RealSaleItem[] = (sm.stock_movement_items || []).map((smi: any) => {
                const matchedArt = loadedArticles.find(a => a.code === smi.article_code);
                return {
                  code: smi.article_code || 'ART',
                  description: smi.article_description || 'Artículo',
                  qty: Number(smi.qty) || 1,
                  unitPrice: Number(smi.unit_price) || 0,
                  costPrice: Number(matchedArt?.cost) || 0,
                  subtotal: Number(smi.total_price) || (Number(smi.qty || 1) * Number(smi.unit_price || 0)),
                  category: matchedArt?.category || 'General'
                };
              });
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

  // Real KPIs
  const totalSalesAmount = useMemo(() => filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0), [filteredSales]);
  const totalTransactionsCount = filteredSales.length;
  const averageTicketValue = totalTransactionsCount > 0 ? Math.round(totalSalesAmount / totalTransactionsCount) : 0;

  // 1. Daily / Monthly Revenue Time Series Data
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

  // 2. Category ROI Analysis Data
  const categoryROIData = useMemo(() => {
    const catMap: Record<string, { category: string; revenue: number; cost: number; units: number }> = {};

    filteredSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const cat = item.category || 'General';
        if (!catMap[cat]) {
          catMap[cat] = { category: cat, revenue: 0, cost: 0, units: 0 };
        }
        const qty = Number(item.qty) || 1;
        const sub = Number(item.subtotal) || (qty * Number(item.unitPrice || 0));
        const matchedArt = articles.find(a => a.code === item.code);
        const unitCost = Number(item.costPrice ?? matchedArt?.cost) || 0;
        const totalCost = qty * unitCost;

        catMap[cat].revenue += sub;
        catMap[cat].cost += totalCost;
        catMap[cat].units += qty;
      });
    });

    return Object.values(catMap).map(c => {
      const grossProfit = c.revenue - c.cost;
      const roiPercent = c.cost > 0 ? (grossProfit / c.cost) * 100 : (c.revenue > 0 ? 100 : 0);
      const profitMarginPercent = c.revenue > 0 ? (grossProfit / c.revenue) * 100 : 0;
      return {
        ...c,
        grossProfit,
        roiPercent,
        profitMarginPercent
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, articles]);

  // 3. Rush Hours Heatmap Matrix Data (Days x Hours)
  const heatmapMatrix = useMemo(() => {
    // 7 days x 15 hour slots (8 to 22)
    const grid: number[][] = Array.from({ length: 7 }, () => Array(HOURS_SLOTS.length).fill(0));
    let maxCount = 1;

    filteredSales.forEach(sale => {
      const d = new Date(sale.date);
      const dayIdx = d.getDay(); // 0 = Dom, 6 = Sáb
      const hour = d.getHours();
      const hourIdx = HOURS_SLOTS.indexOf(hour);
      if (hourIdx >= 0) {
        grid[dayIdx][hourIdx] += 1;
        if (grid[dayIdx][hourIdx] > maxCount) {
          maxCount = grid[dayIdx][hourIdx];
        }
      }
    });

    return { grid, maxCount };
  }, [filteredSales]);

  // 4. Automatic Low Stock Alerts
  const lowStockAlerts = useMemo(() => {
    return articles.filter(a => {
      const stock = Number(a.stock) || 0;
      const minStock = Number(a.min_stock) || 5;
      return stock <= minStock;
    }).map(a => {
      const stock = Number(a.stock) || 0;
      const minStock = Number(a.min_stock) || 5;
      const needed = Math.max(1, minStock - stock);
      const isCritical = stock === 0;
      return {
        code: a.code,
        description: a.description,
        category: a.category || 'General',
        stock,
        minStock,
        needed,
        isCritical
      };
    }).sort((a, b) => a.stock - b.stock);
  }, [articles]);

  // 5. Payment Methods Distribution
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

  // 6. Salesperson Performance
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

  // 7. Cash Control
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

  // Catalog Valuation
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
    } else if (activeTab === 'category_roi') {
      csvRows.push('Categoria,Facturacion_Total ($),Costo_Estimado ($),Utilidad_Bruta ($),ROI_Porcentaje');
      categoryROIData.forEach(row => {
        csvRows.push(`"${row.category}",${row.revenue.toFixed(2)},${row.cost.toFixed(2)},${row.grossProfit.toFixed(2)},${row.roiPercent.toFixed(1)}%`);
      });
    } else if (activeTab === 'stock_alerts') {
      csvRows.push('Codigo,Descripcion,Rubro,Stock_Actual,Stock_Minimo,Unidades_A_Reponer,Estado');
      lowStockAlerts.forEach(row => {
        csvRows.push(`"${row.code}","${row.description}","${row.category}",${row.stock},${row.minStock},${row.needed},"${row.isCritical ? 'AGOTADO' : 'CRITICO'}"`);
      });
    } else if (activeTab === 'sellers') {
      csvRows.push('Vendedor/Cajero,Total Ventas ($),Tickets Emitidos,Ticket Promedio ($),Meta %');
      sellersPerformanceData.forEach(row => {
        csvRows.push(`"${row.name}",${row.ventas},${row.tickets},${row.ticketProm},${row.meta}%`);
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
                <Sparkles size={13} /> TABLERO EJECUTIVO COMPLETO — VENTAS REALES
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
            { id: 'category_roi', label: 'ROI por Categoría', icon: <Percent size={16} /> },
            { id: 'heatmap', label: 'Mapa Horarios Pico', icon: <Flame size={16} /> },
            { id: 'stock_alerts', label: `Alertas Stock (${lowStockAlerts.length})`, icon: <AlertTriangle size={16} /> },
            { id: 'sellers', label: 'Rendimiento Vendedores', icon: <Users size={16} /> },
            { id: 'cash', label: 'Control de Caja & Tesorería', icon: <Landmark size={16} /> }
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
                <span>STOCK BAJO MÍNIMO</span>
                <div style={{ background: lowStockAlerts.length > 0 ? '#fee2e2' : '#dcfce7', color: lowStockAlerts.length > 0 ? '#dc2626' : '#166534', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 800 }}>
                  {lowStockAlerts.length} Críticos
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: lowStockAlerts.length > 0 ? '#ef4444' : '#10b981', margin: '0.5rem 0 0.25rem 0' }}>
                {lowStockAlerts.length} alértas
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                Artículos que requieren reposición
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

          {/* TAB 2: ROI POR CATEGORÍA */}
          {activeTab === 'category_roi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0', color: '#0f172a' }}>
                  Retorno de Inversión (ROI) y Utilidad Bruta por Categoría de Producto
                </h3>

                {categoryROIData.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                    <Percent size={40} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 800, color: '#475569', fontSize: '1rem' }}>No hay ventas registradas por categoría</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontSize: '0.75rem', color: '#64748b' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Categoría / Rubro</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>Unidades Vendidas</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right' }}>Facturación Total ($)</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right' }}>Costo Estimado ($)</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right' }}>Utilidad Bruta ($)</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>ROI %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryROIData.map((c, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.875rem 0.75rem', fontWeight: 800, color: '#0f172a' }}>
                              {c.category}
                            </td>
                            <td style={{ padding: '0.875rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>
                              {c.units} u.
                            </td>
                            <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                              ${c.revenue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', color: '#64748b' }}>
                              ${c.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.875rem 0.75rem', textAlign: 'right', fontWeight: 900, color: c.grossProfit >= 0 ? '#10b981' : '#ef4444' }}>
                              ${c.grossProfit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.875rem 0.75rem', textAlign: 'center' }}>
                              <span style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '9999px',
                                background: c.roiPercent >= 50 ? '#dcfce7' : (c.roiPercent > 0 ? '#fef3c7' : '#fee2e2'),
                                color: c.roiPercent >= 50 ? '#15803d' : (c.roiPercent > 0 ? '#b45309' : '#dc2626'),
                                fontWeight: 900,
                                fontSize: '0.78125rem'
                              }}>
                                {c.roiPercent.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MAPA DE CALOR DE HORARIOS PICO */}
          {activeTab === 'heatmap' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Flame style={{ color: '#f59e0b' }} /> Mapa de Calor de Horarios Pico de Venta
                    </h3>
                    <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '4px' }}>
                      Intensidad de afluencia y operaciones comerciales por día de la semana y franja horaria.
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: '700px' }}>
                    {/* Header Hours Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(15, 1fr)', gap: '4px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Día / Hora</div>
                      {HOURS_SLOTS.map(h => (
                        <div key={h} style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>
                          {h}:00
                        </div>
                      ))}
                    </div>

                    {/* Matrix Rows */}
                    {DAYS_OF_WEEK.map((dayName, dayIdx) => (
                      <div key={dayName} style={{ display: 'grid', gridTemplateColumns: '80px repeat(15, 1fr)', gap: '4px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center' }}>
                          {dayName}
                        </div>
                        {HOURS_SLOTS.map((h, hIdx) => {
                          const count = heatmapMatrix.grid[dayIdx][hIdx];
                          const intensity = heatmapMatrix.maxCount > 0 ? count / heatmapMatrix.maxCount : 0;
                          
                          let bg = '#f1f5f9';
                          let textColor = '#64748b';
                          if (count > 0) {
                            if (intensity > 0.7) {
                              bg = '#ef4444';
                              textColor = '#ffffff';
                            } else if (intensity > 0.4) {
                              bg = '#f59e0b';
                              textColor = '#ffffff';
                            } else {
                              bg = '#38bdf8';
                              textColor = '#ffffff';
                            }
                          }

                          return (
                            <div
                              key={h}
                              title={`${dayName} ${h}:00 hs - ${count} ventas`}
                              style={{
                                height: '38px',
                                borderRadius: '0.375rem',
                                background: bg,
                                color: textColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {count > 0 ? count : ''}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '1.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                  <span style={{ fontWeight: 800 }}>Leyenda de Intensidad:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#f1f5f9' }} /> Sin ventas
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#38bdf8' }} /> Moderado
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#f59e0b' }} /> Concurrencia Alta
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#ef4444' }} /> Horario Pico Máximo
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ALERTAS AUTOMÁTICAS DE STOCK BAJO */}
          {activeTab === 'stock_alerts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle style={{ color: '#ef4444' }} /> Alertas Automáticas de Reposición Urgente
                    </h3>
                    <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '4px' }}>
                      Detección inteligente de artículos por debajo de la reserva mínima calculada.
                    </div>
                  </div>
                  <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontWeight: 900, fontSize: '0.8125rem' }}>
                    {lowStockAlerts.length} Productos Críticos
                  </div>
                </div>

                {lowStockAlerts.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                    <CheckCircle2 size={40} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 800, color: '#166534', fontSize: '1rem' }}>¡Excelente! Todo el stock está en niveles óptimos.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {lowStockAlerts.map(art => (
                      <div
                        key={art.code}
                        style={{
                          background: art.isCritical ? '#fef2f2' : '#ffffff',
                          border: art.isCritical ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                          borderRadius: '0.875rem',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: art.isCritical ? '#dc2626' : '#b45309', background: art.isCritical ? '#fee2e2' : '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: '0.375rem' }}>
                              {art.isCritical ? 'AGOTADO (0 u.)' : 'STOCK BAJO'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Código: {art.code}</span>
                          </div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#0f172a' }}>
                            {art.description}
                          </h4>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Rubro: {art.category}</div>
                        </div>

                        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Stock / Mínimo</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                              {art.stock} u. / {art.minStock} u.
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Reponer Mínimo</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#dc2626' }}>
                              +{art.needed} u.
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: RENDIMIENTO VENDEDORES */}
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

          {/* TAB 6: CONTROL DE CAJA */}
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
            Conectado a datos de ventas reales de Supabase ({activeStore?.name || 'Tienda Principal'})
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
