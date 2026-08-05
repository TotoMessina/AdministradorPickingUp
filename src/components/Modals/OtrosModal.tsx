import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  LayoutGrid,
  Building2,
  Coins,
  ArrowUpDown,
  Folder,
  Ticket,
  Download,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  DollarSign
} from 'lucide-react';

interface OtrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'banks' | 'currency' | 'income_expense' | 'chart_of_accounts' | 'vouchers' | 'exports';
}

interface BankAccount {
  id: string;
  bankName: string;
  accountType: 'Cuenta Corriente' | 'Caja de Ahorro';
  accountNumber: string;
  cbu: string;
  balance: number;
}

interface CurrencyRate {
  id: string;
  currency: string;
  symbol: string;
  rate: number;
  lastUpdate: string;
}

interface CashFlowRecord {
  id: string;
  date: string;
  type: 'Ingreso Operativo' | 'Egreso / Gasto';
  category: string;
  concept: string;
  amount: number;
}

interface Voucher {
  id: string;
  code: string;
  customerName: string;
  amount: number;
  issueDate: string;
  status: 'Activo' | 'Canjeado' | 'Vencido';
}

const INITIAL_BANKS: BankAccount[] = [];

const INITIAL_CURRENCIES: CurrencyRate[] = [];

const INITIAL_FLOWS: CashFlowRecord[] = [];

const INITIAL_VOUCHERS: Voucher[] = [];

export const OtrosModal: React.FC<OtrosModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'banks'
}) => {
  const { activeStore } = useTenant();
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  // Load banks, currencies, cashflows and vouchers from store scoped localStorage & Supabase
  useEffect(() => {
    const loadOtrosData = async () => {
      let loadedBanks: BankAccount[] = INITIAL_BANKS;
      let loadedCurrencies: CurrencyRate[] = INITIAL_CURRENCIES;
      let loadedFlows: CashFlowRecord[] = INITIAL_FLOWS;
      let loadedVouchers: Voucher[] = INITIAL_VOUCHERS;

      try {
        const rawBanks = localStorage.getItem(`pickingup_banks_${storeKey}`);
        if (rawBanks) loadedBanks = JSON.parse(rawBanks);

        const rawCurrencies = localStorage.getItem(`pickingup_currencies_${storeKey}`);
        if (rawCurrencies) loadedCurrencies = JSON.parse(rawCurrencies);

        const rawFlows = localStorage.getItem(`pickingup_flows_${storeKey}`);
        if (rawFlows) loadedFlows = JSON.parse(rawFlows);

        const rawVouchers = localStorage.getItem(`pickingup_vouchers_${storeKey}`);
        if (rawVouchers) loadedVouchers = JSON.parse(rawVouchers);
      } catch {}

      if (user && user.id !== 'demo-user-1234' && activeStore) {
        try {
          const { data: dbFlows } = await supabase
            .from('cash_movements')
            .select('*')
            .eq('store_id', activeStore.id);

          if (dbFlows && dbFlows.length > 0) {
            const mappedFlows: CashFlowRecord[] = dbFlows.map((f: any) => ({
              id: f.id,
              date: f.created_at,
              type: f.movement_type === 'Ingreso' ? 'Ingreso Operativo' : 'Egreso / Gasto',
              category: f.concept || 'General',
              concept: f.concept || 'Movimiento de caja',
              amount: Number(f.amount) || 0
            }));
            loadedFlows = [...mappedFlows, ...loadedFlows.filter(lf => !mappedFlows.some(mf => mf.id === lf.id))];
          }
        } catch (err) {
          console.error('Error loading DB cash flows in OtrosModal:', err);
        }
      }

      setBanks(loadedBanks);
      setCurrencies(loadedCurrencies);
      setFlows(loadedFlows);
      setVouchers(loadedVouchers);
    };

    if (isOpen) {
      loadOtrosData();
    }
  }, [storeKey, user, activeStore, isOpen]);

  const [activeTab, setActiveTab] = useState<'banks' | 'currency' | 'income_expense' | 'chart_of_accounts' | 'vouchers' | 'exports'>(initialTab);
  const [notification, setNotification] = useState<string | null>(null);

  // Banks State
  const [banks, setBanks] = useState<BankAccount[]>(INITIAL_BANKS);
  const [newBankName, setNewBankName] = useState('');
  const [newBankCbu, setNewBankCbu] = useState('');

  // Currencies State
  const [currencies, setCurrencies] = useState<CurrencyRate[]>(INITIAL_CURRENCIES);
  const [editingCurrId, setEditingCurrId] = useState<string | null>(null);

  // Cash Flows State
  const [flows, setFlows] = useState<CashFlowRecord[]>(INITIAL_FLOWS);
  const [flowConcept, setFlowConcept] = useState('');
  const [flowAmount, setFlowAmount] = useState('');
  const [flowType, setFlowType] = useState<'Ingreso Operativo' | 'Egreso / Gasto'>('Egreso / Gasto');

  // Vouchers State
  const [vouchers, setVouchers] = useState<Voucher[]>(INITIAL_VOUCHERS);
  const [vchCustomer, setVchCustomer] = useState('');
  const [vchAmount, setVchAmount] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const saveStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(`pickingup_${key}_${storeKey}`, JSON.stringify(data));
    } catch {}
  };

  const syncOtrosToSupabase = async (key: string, data: any) => {
    if (user && user.id !== 'demo-user-1234' && activeStore) {
      try {
        await supabase.from('cash_movements').insert({
          store_id: activeStore.id,
          movement_type: 'Ajuste',
          amount: 0,
          concept: `CONFIG_${key.toUpperCase()}: ${JSON.stringify(data).slice(0, 180)}`,
          cashier_name: user.email?.split('@')[0] || 'Operador',
          register_code: 'POS-01'
        });
      } catch (err) {
        console.warn(`Error persisting ${key} to Supabase:`, err);
      }
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return;

    const newBank: BankAccount = {
      id: `bkn-${Date.now()}`,
      bankName: newBankName.trim(),
      accountType: 'Cuenta Corriente',
      accountNumber: `CC-${Math.floor(1000 + Math.random() * 9000)}`,
      cbu: newBankCbu || '0000000000000000000000',
      balance: 0
    };

    const updated = [...banks, newBank];
    setBanks(updated);
    saveStorage('banks', updated);
    await syncOtrosToSupabase('banks', updated);
    setNewBankName('');
    setNewBankCbu('');
    showSuccess(`Cuenta de "${newBank.bankName}" registrada.`);
  };

  const handleUpdateRate = async (id: string, newRate: number) => {
    const updated = currencies.map(c => c.id === id ? { ...c, rate: newRate, lastUpdate: 'Recién' } : c);
    setCurrencies(updated);
    saveStorage('currencies', updated);
    await syncOtrosToSupabase('currencies', updated);
    setEditingCurrId(null);
    showSuccess('Cotización de moneda actualizada.');
  };

  const handleAddFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(flowAmount);
    if (isNaN(amt) || amt <= 0 || !flowConcept.trim()) return;

    const newRecord: CashFlowRecord = {
      id: `flow-${Date.now()}`,
      date: new Date().toISOString(),
      type: flowType,
      category: flowType === 'Egreso / Gasto' ? 'Gastos Varios' : 'Otros Ingresos',
      concept: flowConcept.trim(),
      amount: amt
    };

    const updated = [newRecord, ...flows];
    setFlows(updated);
    saveStorage('flows', updated);

    // Save to Supabase cash_movements if authenticated
    if (user && user.id !== 'demo-user-1234' && activeStore) {
      try {
        await supabase.from('cash_movements').insert({
          store_id: activeStore.id,
          movement_type: flowType === 'Ingreso Operativo' ? 'Ingreso' : 'Pago Gasto',
          amount: amt,
          concept: flowConcept.trim(),
          cashier_name: user.email?.split('@')[0] || 'Operador',
          register_code: 'POS-01'
        });
      } catch (err) {
        console.error('Error inserting flow to Supabase DB:', err);
      }
    }

    setFlowConcept('');
    setFlowAmount('');
    showSuccess(`Movimiento de ${flowType} por $${amt.toLocaleString('es-AR')} registrado.`);
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(vchAmount);
    if (isNaN(amt) || amt <= 0 || !vchCustomer.trim()) return;

    const newVoucher: Voucher = {
      id: `vch-${Date.now()}`,
      code: `VALE-${Math.floor(10000 + Math.random() * 90000)}`,
      customerName: vchCustomer.trim(),
      amount: amt,
      issueDate: new Date().toISOString(),
      status: 'Activo'
    };

    const updated = [newVoucher, ...vouchers];
    setVouchers(updated);
    saveStorage('vouchers', updated);

    if (user && user.id !== 'demo-user-1234' && activeStore) {
      try {
        await supabase.from('cash_movements').insert({
          store_id: activeStore.id,
          movement_type: 'Ingreso',
          amount: amt,
          concept: `Emisión de Vale ${newVoucher.code} para ${newVoucher.customerName}`,
          cashier_name: user.email?.split('@')[0] || 'Operador',
          register_code: 'POS-01'
        });
      } catch (err) {
        console.error('Error saving voucher to Supabase DB:', err);
      }
    }

    setVchCustomer('');
    setVchAmount('');
    showSuccess(`Vale ${newVoucher.code} emitido a favor de ${newVoucher.customerName}.`);
  };

  const handleExportCSV = (entity: string) => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `${entity.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${activeStore?.slug || 'tienda'}.csv`;

    if (entity.toLowerCase().includes('banco')) {
      headers = ['ID', 'Banco', 'Tipo_Cuenta', 'Numero_Cuenta', 'CBU', 'Saldo'];
      rows = banks.map(b => [
        b.id,
        `"${b.bankName.replace(/"/g, '""')}"`,
        b.accountType,
        b.accountNumber,
        b.cbu,
        b.balance.toFixed(2)
      ]);
    } else if (entity.toLowerCase().includes('cambio') || entity.toLowerCase().includes('moneda')) {
      headers = ['ID', 'Moneda', 'Simbolo', 'Cotizacion', 'Ultima_Actualizacion'];
      rows = currencies.map(c => [
        c.id,
        c.currency,
        c.symbol,
        c.rate.toFixed(2),
        c.lastUpdate
      ]);
    } else if (entity.toLowerCase().includes('vale')) {
      headers = ['ID', 'Codigo', 'Cliente', 'Monto', 'Fecha_Emision', 'Estado'];
      rows = vouchers.map(v => [
        v.id,
        v.code,
        `"${v.customerName.replace(/"/g, '""')}"`,
        v.amount.toFixed(2),
        v.issueDate,
        v.status
      ]);
    } else {
      headers = ['ID', 'Fecha', 'Tipo', 'Categoria', 'Concepto', 'Monto'];
      rows = flows.map(f => [
        f.id,
        f.date,
        f.type,
        `"${(f.category || 'General').replace(/"/g, '""')}"`,
        `"${(f.concept || '').replace(/"/g, '""')}"`,
        f.amount.toFixed(2)
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

    showSuccess(`Archivo CSV de ${entity} generado y descargado.`);
    addNotification({
      title: 'Exportación de Datos',
      message: `Se descargó el reporte de ${entity} (${rows.length} filas) en formato CSV.`,
      type: 'success'
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      zIndex: 95
    }}>
      <div style={{
        width: '100%',
        maxWidth: '960px',
        maxHeight: '88vh',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }} className="animate-fade-in">
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--theme-teal-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--theme-teal-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--theme-teal)',
              fontWeight: 800
            }}>
              <LayoutGrid size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                HERRAMIENTAS ADICIONALES
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--theme-teal)' }}>
                Módulo de Otros y Utilidades
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.5rem',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('banks')}
            style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeTab === 'banks' ? 'var(--theme-teal)' : 'transparent',
              color: activeTab === 'banks' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Building2 size={15} /> Bancos
          </button>

          <button
            onClick={() => setActiveTab('currency')}
            style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeTab === 'currency' ? 'var(--theme-teal)' : 'transparent',
              color: activeTab === 'currency' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Coins size={15} /> Tipo de Cambio
          </button>

          <button
            onClick={() => setActiveTab('income_expense')}
            style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeTab === 'income_expense' ? 'var(--theme-teal)' : 'transparent',
              color: activeTab === 'income_expense' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <ArrowUpDown size={15} /> Ingresos/Egresos
          </button>

          <button
            onClick={() => setActiveTab('chart_of_accounts')}
            style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeTab === 'chart_of_accounts' ? 'var(--theme-teal)' : 'transparent',
              color: activeTab === 'chart_of_accounts' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Folder size={15} /> Cuentas
          </button>

          <button
            onClick={() => setActiveTab('vouchers')}
            style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeTab === 'vouchers' ? 'var(--theme-teal)' : 'transparent',
              color: activeTab === 'vouchers' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Ticket size={15} /> Vales de Compra
          </button>

          <button
            onClick={() => setActiveTab('exports')}
            style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeTab === 'exports' ? 'var(--theme-teal)' : 'transparent',
              color: activeTab === 'exports' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Download size={15} /> Exportaciones
          </button>
        </div>

        {/* Alert Notification */}
        {notification && (
          <div style={{
            margin: '1rem 1.5rem 0',
            padding: '0.75rem 1rem',
            borderRadius: '0.625rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: '0.84375rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={16} /> {notification}
          </div>
        )}

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {/* TAB 1: BANCOS */}
          {activeTab === 'banks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <form onSubmit={handleAddBank} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: '2fr 2fr auto',
                gap: '1rem',
                alignItems: 'end'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Entidad Bancaria
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Banco Galicia"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    CBU / ALIAS
                  </label>
                  <input
                    type="text"
                    placeholder="0070049220000038491029"
                    value={newBankCbu}
                    onChange={(e) => setNewBankCbu(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ background: 'var(--theme-teal)' }}>
                  <Plus size={16} /> Registrar Cuenta
                </button>
              </form>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {banks.map(b => (
                  <div key={b.id} style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.875rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building2 size={20} style={{ color: 'var(--theme-teal)' }} />
                        <span style={{ fontWeight: 800, fontSize: '0.9375rem' }}>{b.bankName}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', background: 'rgba(20, 184, 166, 0.12)', color: 'var(--theme-teal)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 800 }}>
                        {b.accountType}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-app)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                      <div>N° Cuenta: <strong>{b.accountNumber}</strong></div>
                      <div>CBU: <code style={{ fontSize: '0.725rem' }}>{b.cbu}</code></div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SALDO ACTUAL</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
                        ${b.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: TIPO DE CAMBIO */}
          {activeTab === 'currency' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                background: 'var(--bg-app)',
                padding: '1.25rem',
                borderRadius: '0.875rem',
                border: '1px solid var(--border-light)'
              }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  🪙 Cotización de Monedas Extranjeras para Cobro POS
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Establecé el tipo de cambio oficial de referencia para ventas multimoneda en {activeStore?.name || 'su negocio'}.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                {currencies.map(c => (
                  <div key={c.id} style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.875rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9375rem' }}>{c.currency}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--theme-teal)' }}>{c.symbol}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-app)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>VALOR EN ARS</span>
                      {editingCurrId === c.id ? (
                        <input
                          type="number"
                          step="0.5"
                          defaultValue={c.rate}
                          id={`rate-${c.id}`}
                          style={{ width: '100px', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 900, textAlign: 'right' }}
                        />
                      ) : (
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
                          ${c.rate.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Actualizado: {c.lastUpdate}</span>
                      {editingCurrId === c.id ? (
                        <button
                          onClick={() => {
                            const rateEl = document.getElementById(`rate-${c.id}`) as HTMLInputElement;
                            handleUpdateRate(c.id, parseFloat(rateEl.value) || c.rate);
                          }}
                          className="btn-primary"
                          style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                        >
                          Guardar
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingCurrId(c.id)}
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: INGRESOS/EGRESOS */}
          {activeTab === 'income_expense' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <form onSubmit={handleAddFlow} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 1fr auto',
                gap: '1rem',
                alignItems: 'end'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Tipo Movimiento
                  </label>
                  <select
                    value={flowType}
                    onChange={(e) => setFlowType(e.target.value as any)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  >
                    <option value="Egreso / Gasto">Egreso / Gasto</option>
                    <option value="Ingreso Operativo">Ingreso Operativo</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Concepto / Detalle
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pago servicio de internet fibra óptica"
                    value={flowConcept}
                    onChange={(e) => setFlowConcept(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Monto ($)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={flowAmount}
                    onChange={(e) => setFlowAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 800 }}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ background: 'var(--theme-teal)' }}>
                  <Plus size={16} /> Cargar
                </button>
              </form>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84375rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Fecha</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Tipo</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Concepto</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(f.date).toLocaleDateString('es-AR')}
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem' }}>
                        <span style={{
                          fontSize: '0.725rem',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontWeight: 800,
                          background: f.type === 'Ingreso Operativo' ? '#ecfdf5' : '#fef2f2',
                          color: f.type === 'Ingreso Operativo' ? '#10b981' : '#ef4444'
                        }}>
                          {f.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem' }}>{f.concept}</td>
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', fontWeight: 900, color: 'var(--text-main)' }}>
                        ${f.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: CUENTAS */}
          {activeTab === 'chart_of_accounts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-app)', padding: '1.25rem', borderRadius: '0.875rem', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  📁 Plan de Cuentas Contable Estandarizado
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Estructura jerárquica de cuentas de activo, pasivo, ingresos y egresos de {activeStore?.name || 'su empresa'}.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <AccountNode code="1.0.0" name="ACTIVO CORRIENTE" balance="$ 740.000,00" level={1} />
                <AccountNode code="1.1.0" name="Caja y Bancos (Efectivo / Tesorería)" balance="$ 530.000,00" level={2} />
                <AccountNode code="1.2.0" name="Créditos por Ventas (Cuentas Corrientes)" balance="$ 210.000,00" level={2} />
                <AccountNode code="2.0.0" name="PASIVO CORRIENTE" balance="$ 320.000,00" level={1} />
                <AccountNode code="2.1.0" name="Deudas Comerciales (Proveedores)" balance="$ 320.000,00" level={2} />
                <AccountNode code="3.0.0" name="RESULTADOS" balance="$ 1.250.000,00" level={1} />
              </div>
            </div>
          )}

          {/* TAB 5: VALES DE COMPRA */}
          {activeTab === 'vouchers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <form onSubmit={handleCreateVoucher} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr auto',
                gap: '1rem',
                alignItems: 'end'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Nombre del Cliente Destinatario
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Gómez"
                    value={vchCustomer}
                    onChange={(e) => setVchCustomer(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Monto del Vale ($)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={vchAmount}
                    onChange={(e) => setVchAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 800 }}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ background: 'var(--theme-teal)' }}>
                  <Plus size={16} /> Emitir Vale
                </button>
              </form>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84375rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Código Vale</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Fecha Emisión</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>Monto ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.625rem 0.75rem', fontWeight: 800, fontFamily: 'monospace' }}>{v.code}</td>
                      <td style={{ padding: '0.625rem 0.75rem' }}>{v.customerName}</td>
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(v.issueDate).toLocaleDateString('es-AR')}
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.725rem',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontWeight: 800,
                          background: v.status === 'Activo' ? '#ecfdf5' : '#f1f5f9',
                          color: v.status === 'Activo' ? '#10b981' : '#64748b'
                        }}>
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', fontWeight: 900, color: 'var(--text-main)' }}>
                        ${v.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 6: EXPORTACIONES */}
          {activeTab === 'exports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', padding: '1.25rem', borderRadius: '0.875rem', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  📥 Centro de Descarga y Exportaciones Multi-Formato
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Generá reportes completos en formato CSV / Excel listos para contabilidad y análisis externo.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <ExportCard title="Catálogo de Productos" count="245 productos" onExport={() => handleExportCSV('Catálogo de Productos')} />
                <ExportCard title="Movimientos de Inventario" count="1.482 registros" onExport={() => handleExportCSV('Movimientos de Inventario')} />
                <ExportCard title="Padrón de Proveedores" count="14 proveedores" onExport={() => handleExportCSV('Padrón de Proveedores')} />
                <ExportCard title="Histórico de Ventas POS" count="3.840 tickets" onExport={() => handleExportCSV('Histórico de Ventas POS')} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AccountNode: React.FC<{ code: string; name: string; balance: string; level: number }> = ({ code, name, balance, level }) => (
  <div style={{
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    background: level === 1 ? 'var(--bg-app)' : 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    marginLeft: `${(level - 1) * 1.25}rem`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontWeight: level === 1 ? 800 : 600,
    fontSize: '0.84375rem'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ fontFamily: 'monospace', color: 'var(--brand-blue)', fontWeight: 800 }}>{code}</span>
      <span>{name}</span>
    </div>
    <span style={{ fontWeight: 900 }}>{balance}</span>
  </div>
);

const ExportCard: React.FC<{ title: string; count: string; onExport: () => void }> = ({ title, count, onExport }) => (
  <div style={{
    padding: '1.25rem',
    borderRadius: '0.875rem',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '1rem'
  }}>
    <div>
      <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-main)' }}>{title}</div>
      <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', marginTop: '2px' }}>{count}</div>
    </div>

    <button onClick={onExport} className="btn-primary" style={{ background: 'var(--theme-teal)', gap: '0.5rem', fontSize: '0.8125rem' }}>
      <Download size={15} /> Exportar CSV
    </button>
  </div>
);
