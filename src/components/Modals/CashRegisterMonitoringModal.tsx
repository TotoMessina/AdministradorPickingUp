import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Activity,
  DollarSign,
  ShoppingCart,
  Clock,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Eye,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Tag,
  CreditCard,
  User,
  Zap,
  Building2,
  Download,
  Settings,
  PieChart,
  Users
} from 'lucide-react';

interface CashRegisterMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConfig?: () => void;
}

interface SaleItem {
  id: string;
  ticketNum: string;
  timestamp: string;
  cashier: string;
  priceListName: string;
  priceListType: string;
  paymentMethod: 'Efectivo' | 'Débito' | 'Crédito' | 'MercadoPago';
  items: { code: string; description: string; qty: number; unitPrice: number; total: number }[];
  totalAmount: number;
}

interface CashRegister {
  id: string;
  code: string;
  name: string;
  version: string;
  config: string;
  status: 'online' | 'offline' | 'busy';
  activePriceList: string;
  lastConsultation: string;
  availableSince: string;
  totalSales: number;
  transactionCount: number;
  cashierName: string;
  salesHistory: SaleItem[];
}

interface StoreGroup {
  id: string;
  name: string;
  code: string;
  isExpanded: boolean;
  registers: CashRegister[];
}

export const CashRegisterMonitoringModal: React.FC<CashRegisterMonitoringModalProps> = ({ isOpen, onClose, onOpenConfig }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();

  const storeKey = activeStore?.id || 'demo-store';

  const [activeTab, setActiveTab] = useState<'monitoring' | 'audit_cashiers'>('monitoring');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Store Groups with Cash Registers
  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);

  const loadMonitoringData = async () => {
    const storeName = activeStore?.name || 'Supermercado Central';

    // 1. Fetch real registers from DB or localStorage
    let configuredRegs: any[] = [];
    try {
      const rawCfg = localStorage.getItem(`pickingup_registers_${storeKey}`) || localStorage.getItem(`pickingup_cajas_config_${storeKey}`);
      if (rawCfg) {
        configuredRegs = JSON.parse(rawCfg);
      }
    } catch {}

    if (user && !isDemoMode && activeStore) {
      try {
        const { data: dbRegs } = await supabase
          .from('cash_registers')
          .select('*')
          .eq('store_id', activeStore.id);

        if (dbRegs && dbRegs.length > 0) {
          configuredRegs = dbRegs.map(r => ({
            id: r.id,
            code: r.code || 'CAJA-01',
            name: r.name || 'Caja 01',
            version: r.version || 'v2.4.0-POS',
            defaultPriceListName: r.default_price_list_name || 'Lista Base',
            isActive: r.is_active !== false,
            cashierName: r.assigned_cashier || 'Cajero Operador'
          }));
        }
      } catch (err) {
        console.error('Error fetching cash_registers from DB:', err);
      }
    }

    if (configuredRegs.length === 0) {
      configuredRegs = [
        { id: 'caja-1', code: 'POS-01', name: 'Caja 01 - Principal', version: 'v2.4.0-POS', defaultPriceListName: 'Lista Base', isActive: true, cashierName: user?.email?.split('@')[0] || 'Cajero Principal' }
      ];
    }

    // 2. Fetch real sales history from localStorage and Supabase stock_movements
    let realSales: any[] = [];
    try {
      const rawSales = localStorage.getItem(`pickingup_sales_history_${storeKey}`);
      if (rawSales) realSales = JSON.parse(rawSales);
    } catch {}

    if (user && !isDemoMode && activeStore) {
      try {
        const { data: dbMovements } = await supabase
          .from('stock_movements')
          .select('*, stock_movement_items(*)')
          .eq('store_id', activeStore.id)
          .eq('movement_type', 'Egreso')
          .order('created_at', { ascending: false });

        if (dbMovements && dbMovements.length > 0) {
          const mappedDbSales = dbMovements.map((sm: any, idx: number) => ({
            id: sm.id || `db-sale-${idx}`,
            ticketNum: sm.ticket_number ? `TK-${sm.ticket_number}` : `TK-${1000 + idx}`,
            timestamp: sm.created_at ? new Date(sm.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Reciente',
            cashier: sm.created_by_email || user.email?.split('@')[0] || 'Operador',
            priceListName: 'Lista Base',
            priceListType: 'Normal',
            paymentMethod: sm.payment_method || 'Efectivo',
            registerName: sm.register_name || 'Caja 01 - Principal',
            items: (sm.stock_movement_items || []).map((smi: any) => ({
              code: smi.article_code || 'ART',
              description: smi.article_description || 'Artículo',
              qty: Number(smi.qty) || 1,
              unitPrice: Number(smi.unit_price) || 0,
              total: Number(smi.total_price) || (Number(smi.qty || 1) * Number(smi.unit_price || 0))
            })),
            totalAmount: (sm.stock_movement_items || []).reduce((acc: number, smi: any) => acc + (Number(smi.total_price) || 0), 0)
          }));
          realSales = mappedDbSales;
        }
      } catch (err) {
        console.error('Error fetching real sales for monitoring:', err);
      }
    }

    const registeredList: CashRegister[] = configuredRegs.map((reg: any, idx: number) => {
      const regSales = realSales.filter((s: any) => 
        (s.registerName && s.registerName.toLowerCase().includes(reg.name.toLowerCase())) ||
        (s.registerCode && s.registerCode === reg.code) ||
        idx === 0
      );

      const calculatedTotal = regSales.reduce((acc: number, s: any) => acc + (s.totalAmount || s.total || 0), 0);

      const formattedHistory: SaleItem[] = regSales.slice(0, 10).map((s: any, sIdx: number) => ({
        id: s.id || `s-${idx}-${sIdx}`,
        ticketNum: s.ticketNum || s.ticketNumber || `TK-${4800 + sIdx}`,
        timestamp: s.timestamp || (s.date ? new Date(s.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Reciente'),
        cashier: s.cashier || s.cashierName || reg.cashierName || 'Cajero',
        priceListName: s.priceListName || reg.defaultPriceListName || 'Lista Base',
        priceListType: s.priceListType || 'Normal',
        paymentMethod: s.paymentMethod || 'Efectivo',
        items: s.items || [],
        totalAmount: s.totalAmount || s.total || 0
      }));

      const latestSale = regSales[0];
      const lastConsultText = latestSale
        ? (latestSale.timestamp ? `Última venta: ${latestSale.timestamp}` : 'Reciente')
        : 'Sin actividad hoy';

      return {
        id: reg.id || `reg-${idx + 1}`,
        code: reg.code || `CAJA-0${idx + 1}`,
        name: reg.name || `Caja ${idx + 1}`,
        version: reg.version || 'v2.4.0-POS',
        config: reg.defaultPriceListName || 'Lista Base',
        status: reg.isActive ? 'online' : 'offline',
        activePriceList: reg.defaultPriceListName || 'Lista Base',
        lastConsultation: lastConsultText,
        availableSince: new Date().toLocaleDateString('es-AR'),
        totalSales: calculatedTotal,
        transactionCount: regSales.length,
        cashierName: reg.cashierName || user?.email?.split('@')[0] || 'Cajero Operador',
        salesHistory: formattedHistory
      };
    });

    setStoreGroups([
      {
        id: activeStore?.id || 'store-1',
        name: storeName,
        code: activeStore?.code || 'SUP-001',
        isExpanded: true,
        registers: registeredList
      }
    ]);
  };

  useEffect(() => {
    if (isOpen) {
      loadMonitoringData();
    }

    if (isOpen && activeStore?.id && user && !isDemoMode) {
      const channel = supabase
        .channel(`realtime_monitoring_${activeStore.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'stock_movements',
          filter: `store_id=eq.${activeStore.id}`
        }, () => {
          loadMonitoringData();
          setLastSyncTime(new Date().toLocaleTimeString('es-AR'));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, activeStore?.id, user, isDemoMode]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadMonitoringData();
    setLastSyncTime(new Date().toLocaleTimeString('es-AR'));
    setIsRefreshing(false);
  };

  // Calculate Cashier Sales Audit Breakdown
  const cashierAuditMap: Record<string, { cashierName: string; totalSales: number; ticketCount: number; listBreakdown: Record<string, { amount: number; count: number }> }> = {};

  storeGroups.forEach(grp => {
    grp.registers.forEach(reg => {
      const cashier = reg.cashierName || 'Cajero';
      if (!cashierAuditMap[cashier]) {
        cashierAuditMap[cashier] = { cashierName: cashier, totalSales: 0, ticketCount: 0, listBreakdown: {} };
      }

      reg.salesHistory.forEach(sale => {
        cashierAuditMap[cashier].totalSales += sale.totalAmount;
        cashierAuditMap[cashier].ticketCount += 1;

        const listName = sale.priceListName || 'Lista Base';
        if (!cashierAuditMap[cashier].listBreakdown[listName]) {
          cashierAuditMap[cashier].listBreakdown[listName] = { amount: 0, count: 0 };
        }
        cashierAuditMap[cashier].listBreakdown[listName].amount += sale.totalAmount;
        cashierAuditMap[cashier].listBreakdown[listName].count += 1;
      });
    });
  });

  const cashierAuditList = Object.values(cashierAuditMap);

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

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
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
              <Activity size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
                AUDITORÍA DE VENTAS Y MONITOREO DE CAJAS
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                Cajas y Desglose por Cajero y Lista — {activeStore?.name || 'Mi Negocio'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleRefresh}
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
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} /> Actualizar
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

        {/* Dynamic Navigation Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          padding: '0 1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => setActiveTab('monitoring')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'monitoring' ? '3px solid #10b981' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'monitoring' ? '#10b981' : 'var(--text-muted)',
                fontWeight: activeTab === 'monitoring' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Activity size={16} /> 🖥️ Monitoreo de Cajas en Vivo
            </button>

            <button
              onClick={() => setActiveTab('audit_cashiers')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'audit_cashiers' ? '3px solid #10b981' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'audit_cashiers' ? '#10b981' : 'var(--text-muted)',
                fontWeight: activeTab === 'audit_cashiers' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Users size={16} /> 📊 Auditoría por Cajero y Lista ({cashierAuditList.length})
            </button>
          </div>
        </div>

        {/* TAB 1: CASH REGISTER MONITORING */}
        {activeTab === 'monitoring' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {storeGroups[0]?.registers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-app)', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                <AlertCircle size={48} style={{ color: '#ea580c', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Sin cajas configuradas para este local</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.25rem' }}>
                  No se encontraron terminales de caja configuradas para {activeStore?.name || 'este negocio'}.
                </p>
                {onOpenConfig && (
                  <button
                    onClick={onOpenConfig}
                    style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#10b981', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                  >
                    ⚙️ Ir a Configuración de Cajas
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {storeGroups[0]?.registers.map(reg => (
                  <div
                    key={reg.id}
                    style={{
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '0.875rem',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.875rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        🖥️ {reg.name} ({reg.code})
                      </div>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        background: reg.status === 'online' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: reg.status === 'online' ? '#10b981' : '#ef4444',
                        fontWeight: 800,
                        fontSize: '0.75rem'
                      }}>
                        {reg.status === 'online' ? '🟢 OPERATIVA' : '🔴 INACTIVA'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      👤 Cajero: <strong style={{ color: 'var(--text-main)' }}>{reg.cashierName}</strong>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      🏷️ Lista Aplicada: <strong style={{ color: '#a855f7' }}>{reg.activePriceList}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Vendido:</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
                        ${reg.totalSales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AUDIT SALES BY CASHIER & PRICE LIST */}
        {activeTab === 'audit_cashiers' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  📊 Auditoría de Ventas por Cajero y Lista de Precios
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Desglose exacto de lo vendido por cada usuario cajero y con qué lista emitieron las ventas.
                </p>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Cajero</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Desglose por Lista de Precios</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Total Tickets</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Acumulado ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierAuditList.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay registros de ventas para auditar por cajero en este turno.
                      </td>
                    </tr>
                  ) : (
                    cashierAuditList.map((audit, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>👤 {audit.cashierName}</div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {Object.entries(audit.listBreakdown).map(([listName, val], lIdx) => (
                              <div key={lIdx} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', fontSize: '0.75rem' }}>
                                <span style={{ fontWeight: 800, color: '#a855f7' }}>🏷️ {listName}: </span>
                                <strong style={{ color: '#10b981' }}>${val.amount.toFixed(2)}</strong> ({val.count} tks)
                              </div>
                            ))}
                          </div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>
                          {audit.ticketCount} tickets
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: '1rem' }}>
                          ${audit.totalSales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
  );
};
