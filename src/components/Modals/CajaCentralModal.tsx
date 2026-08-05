import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Lock,
  Wallet,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Search,
  Plus,
  Building2,
  CreditCard,
  Sliders,
  DollarSign
} from 'lucide-react';

interface CajaCentralModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'closing' | 'checking_account' | 'movements' | 'tariffs';
}

interface CardTariff {
  id: string;
  name: string;
  code: string;
  type: 'Credito' | 'Debito' | 'QR / Transferencia';
  feePercent: number;
  accreditationDays: number;
  isActive: boolean;
}

interface CashMovement {
  id: string;
  date: string;
  type: 'Ingreso' | 'Retiro Tesorería' | 'Pago Gasto' | 'Ajuste';
  amount: number;
  cashierName: string;
  concept: string;
  registerCode: string;
}

const INITIAL_TARIFFS: CardTariff[] = [
  { id: 'tar-1', name: 'Visa Crédito', code: 'VISA-CR', type: 'Credito', feePercent: 1.8, accreditationDays: 2, isActive: true },
  { id: 'tar-2', name: 'Visa Débito', code: 'VISA-DB', type: 'Debito', feePercent: 0.8, accreditationDays: 1, isActive: true },
  { id: 'tar-3', name: 'Mastercard Crédito', code: 'MC-CR', type: 'Credito', feePercent: 1.9, accreditationDays: 2, isActive: true },
  { id: 'tar-4', name: 'MercadoPago QR', code: 'MP-QR', type: 'QR / Transferencia', feePercent: 0.6, accreditationDays: 0, isActive: true },
  { id: 'tar-5', name: 'Tarjeta Naranja', code: 'NARANJA', type: 'Credito', feePercent: 2.1, accreditationDays: 3, isActive: true }
];

const INITIAL_MOVEMENTS: CashMovement[] = [];

export const CajaCentralModal: React.FC<CajaCentralModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'checking_account'
}) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  const [activeTab, setActiveTab] = useState<'closing' | 'checking_account' | 'movements' | 'tariffs'>(initialTab);
  const [notification, setNotification] = useState<string | null>(null);

  // Closing State
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [declaredCash, setDeclaredCash] = useState<number>(0);
  const [realSystemCash, setRealSystemCash] = useState<number>(0);

  // Checking Account / Transfer State
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferConcept, setTransferConcept] = useState<string>('');

  // Movements State
  const [movements, setMovements] = useState<CashMovement[]>(INITIAL_MOVEMENTS);
  const [moveSearch, setMoveSearch] = useState<string>('');
  const [moveFilterType, setMoveFilterType] = useState<string>('all');

  // Tariffs State
  const [tariffs, setTariffs] = useState<CardTariff[]>(INITIAL_TARIFFS);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Unified loader for tariffs, movements, opening balance and cash calculations
  useEffect(() => {
    const loadCajaCentralData = async () => {
      let loadedTariffs: CardTariff[] = INITIAL_TARIFFS;
      let loadedMovements: CashMovement[] = INITIAL_MOVEMENTS;
      let cashSalesToday = 0;
      let initBalance = 0;

      // 1. Read Local Storage
      try {
        const rawSales = localStorage.getItem(`pickingup_sales_history_${storeKey}`);
        if (rawSales) {
          const sales = JSON.parse(rawSales);
          cashSalesToday = sales
            .filter((s: any) => s.paymentMethod === 'Efectivo')
            .reduce((sum: number, s: any) => sum + (s.total || 0), 0);
        }

        const rawInitBalance = localStorage.getItem(`pickingup_opening_balance_${storeKey}`);
        if (rawInitBalance) initBalance = Number(rawInitBalance) || 0;

        const rawTariffs = localStorage.getItem(`pickingup_tariffs_${storeKey}`);
        if (rawTariffs) loadedTariffs = JSON.parse(rawTariffs);

        const rawMovs = localStorage.getItem(`pickingup_cash_movs_${storeKey}`);
        if (rawMovs) loadedMovements = JSON.parse(rawMovs);
      } catch {}

      // 2. Fetch live tariffs and cash movements from Supabase DB if logged in
      if (user && !isDemoMode && activeStore) {
        try {
          const { data: dbTariffs } = await supabase
            .from('card_tariffs')
            .select('*')
            .eq('store_id', activeStore.id);

          if (dbTariffs && dbTariffs.length > 0) {
            loadedTariffs = dbTariffs.map((t: any) => ({
              id: t.id,
              name: t.name,
              code: t.code,
              type: t.type,
              feePercent: Number(t.fee_percent) || 0,
              accreditationDays: Number(t.accreditation_days) || 1,
              isActive: t.is_active
            }));
          }

          const { data: dbMovs } = await supabase
            .from('cash_movements')
            .select('*')
            .eq('store_id', activeStore.id)
            .order('created_at', { ascending: false });

          if (dbMovs && dbMovs.length > 0) {
            loadedMovements = dbMovs.map((m: any) => ({
              id: m.id,
              date: m.created_at,
              type: m.movement_type,
              amount: Number(m.amount) || 0,
              cashierName: m.cashier_name || 'Operador',
              concept: m.concept || 'Movimiento de caja',
              registerCode: m.register_code || 'POS-01'
            }));
          }
        } catch (err) {
          console.error('Error loading cash data from Supabase DB:', err);
        }
      }

      setOpeningBalance(initBalance);
      setRealSystemCash(cashSalesToday);
      setDeclaredCash(initBalance + cashSalesToday);
      setTariffs(loadedTariffs);
      setMovements(loadedMovements);
    };

    if (isOpen) {
      loadCajaCentralData();
    }
  }, [user, isDemoMode, activeStore, storeKey, isOpen]);

  const systemCash = openingBalance + realSystemCash;

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCloseCashRegister = async () => {
    const diff = declaredCash - systemCash;
    const diffFormatted = `${diff >= 0 ? '+' : ''}$${diff.toLocaleString('es-AR')}`;

    const newMov: CashMovement = {
      id: `mov-cierre-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'Ajuste',
      amount: declaredCash,
      cashierName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operador',
      concept: `Arqueo y Cierre de Turno (Sistema: $${systemCash.toLocaleString('es-AR')} | Declarado: $${declaredCash.toLocaleString('es-AR')} | Dif: ${diffFormatted})`,
      registerCode: 'POS-01'
    };

    const updated = [newMov, ...movements];
    setMovements(updated);
    try {
      localStorage.setItem(`pickingup_cash_movs_${storeKey}`, JSON.stringify(updated));
    } catch {}

    if (user && !isDemoMode && activeStore) {
      try {
        await supabase.from('cash_movements').insert({
          store_id: activeStore.id,
          movement_type: 'Ajuste',
          amount: declaredCash,
          concept: newMov.concept,
          cashier_name: newMov.cashierName,
          register_code: newMov.registerCode
        });
      } catch (err) {
        console.error('Error persisting cash register closing in Supabase:', err);
      }
    }

    showSuccess(`Arqueo finalizado exitosamente. Diferencia: ${diffFormatted}`);
    addNotification({
      title: 'Arqueo de Caja Central',
      message: `Cierre de turno registrado para ${activeStore?.name || 'su negocio'}. Diferencia: ${diffFormatted}.`,
      type: diff === 0 ? 'success' : 'warning'
    });
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) return;

    const newMov: CashMovement = {
      id: `mov-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'Retiro Tesorería',
      amount: amt,
      cashierName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operador',
      concept: transferConcept || 'Transferencia a Tesorería Central',
      registerCode: 'POS-01'
    };

    const updated = [newMov, ...movements];
    setMovements(updated);
    try {
      localStorage.setItem(`pickingup_cash_movs_${storeKey}`, JSON.stringify(updated));
    } catch {}

    if (user && !isDemoMode && activeStore) {
      try {
        await supabase.from('cash_movements').insert({
          store_id: activeStore.id,
          movement_type: 'Retiro Tesorería',
          amount: amt,
          concept: newMov.concept,
          cashier_name: newMov.cashierName,
          register_code: newMov.registerCode
        });
      } catch (err) {
        console.error('Error persisting transfer to Supabase DB:', err);
      }
    }

    setTransferAmount('');
    setTransferConcept('');
    showSuccess(`Transferencia de $${amt.toLocaleString('es-AR')} a Tesorería registrada.`);
    addNotification({
      title: 'Retiro a Tesorería',
      message: `Se transfirieron $${amt.toLocaleString('es-AR')} a Tesorería Central.`,
      type: 'info'
    });
  };

  const handleUpdateTariff = (id: string, newFee: number, newDays: number) => {
    const updated = tariffs.map(t => t.id === id ? { ...t, feePercent: newFee, accreditationDays: newDays } : t);
    setTariffs(updated);
    try {
      localStorage.setItem(`pickingup_tariffs_${storeKey}`, JSON.stringify(updated));
    } catch {}
    setEditingTariffId(null);
    showSuccess('Arancel de tarjeta actualizado.');
  };

  const filteredMovements = movements.filter(m => {
    const matchesSearch = m.concept.toLowerCase().includes(moveSearch.toLowerCase()) ||
                          m.cashierName.toLowerCase().includes(moveSearch.toLowerCase()) ||
                          m.registerCode.toLowerCase().includes(moveSearch.toLowerCase());
    const matchesType = moveFilterType === 'all' || m.type === moveFilterType;
    return matchesSearch && matchesType;
  });

  const totalVaultCash = movements.reduce((acc, m) => {
    if (m.type === 'Retiro Tesorería' || m.type === 'Ingreso') return acc + m.amount;
    if (m.type === 'Pago Gasto') return acc - m.amount;
    return acc;
  }, 125000);

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
          background: 'var(--theme-lime-bg)',
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
              border: '1px solid var(--theme-lime-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--theme-lime)',
              fontWeight: 800
            }}>
              <LandmarkIcon />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                MÓDULO ADMINISTRATIVO
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--theme-lime)' }}>
                Caja Central y Tesorería
              </h2>
            </div>
          </div>

          <button
            id="btn-close-caja-modal"
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
            onClick={() => setActiveTab('closing')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: activeTab === 'closing' ? 'var(--theme-lime)' : 'transparent',
              color: activeTab === 'closing' ? '#000000' : 'var(--text-muted)'
            }}
          >
            <Lock size={15} /> Cierre de Cajeros
          </button>

          <button
            onClick={() => setActiveTab('checking_account')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: activeTab === 'checking_account' ? 'var(--theme-lime)' : 'transparent',
              color: activeTab === 'checking_account' ? '#000000' : 'var(--text-muted)'
            }}
          >
            <Wallet size={15} /> Cuenta Corriente Caja
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: activeTab === 'movements' ? 'var(--theme-lime)' : 'transparent',
              color: activeTab === 'movements' ? '#000000' : 'var(--text-muted)'
            }}
          >
            <TrendingUp size={15} /> Movimientos de Tesorería
          </button>

          <button
            onClick={() => setActiveTab('tariffs')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: activeTab === 'tariffs' ? 'var(--theme-lime)' : 'transparent',
              color: activeTab === 'tariffs' ? '#000000' : 'var(--text-muted)'
            }}
          >
            <Percent size={15} /> Admin. Aranceles Tarjetas
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
          {/* TAB 1: CIERRE DE CAJEROS */}
          {activeTab === 'closing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                background: 'var(--bg-app)',
                padding: '1.25rem',
                borderRadius: '0.875rem',
                border: '1px solid var(--border-light)'
              }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  🔒 Arqueo y Cierre de Turno de Cajero
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Ingresá el efectivo físico contado en la caja para comparar contra el saldo teórico registrado por las ventas POS.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.125rem', borderRadius: '0.875rem', background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>FONDO INICIAL / APERTURA ($)</div>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setOpeningBalance(val);
                      try {
                        localStorage.setItem(`pickingup_opening_balance_${storeKey}`, String(val));
                      } catch {}
                    }}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      padding: '0.4rem 0.625rem',
                      fontSize: '1.35rem',
                      fontWeight: 900,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '0.5rem',
                      color: 'var(--brand-blue)'
                    }}
                  />
                </div>

                <div style={{ padding: '1.125rem', borderRadius: '0.875rem', background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>EFECTIVO SEGÚN SISTEMA</div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                    ${systemCash.toLocaleString('es-AR')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    (Fondo: ${openingBalance.toLocaleString('es-AR')} + Ventas: ${realSystemCash.toLocaleString('es-AR')})
                  </div>
                </div>

                <div style={{ padding: '1.125rem', borderRadius: '0.875rem', background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>DECLARADO EN CAJA ($)</div>
                  <input
                    type="number"
                    value={declaredCash}
                    onChange={(e) => setDeclaredCash(Number(e.target.value))}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      padding: '0.4rem 0.625rem',
                      fontSize: '1.35rem',
                      fontWeight: 900,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '0.5rem',
                      color: 'var(--text-main)'
                    }}
                  />
                </div>

                <div style={{
                  padding: '1.125rem',
                  borderRadius: '0.875rem',
                  background: declaredCash - systemCash >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${declaredCash - systemCash >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>DIFERENCIA</div>
                  <div style={{
                    fontSize: '1.65rem',
                    fontWeight: 900,
                    color: declaredCash - systemCash >= 0 ? '#10b981' : '#ef4444',
                    marginTop: '4px'
                  }}>
                    {declaredCash - systemCash >= 0 ? '+' : ''}${(declaredCash - systemCash).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={handleCloseCashRegister}
                  className="btn-primary"
                  style={{ background: 'var(--theme-lime)', color: '#000000', gap: '0.5rem' }}
                >
                  <Lock size={16} /> Confirmar Cierre de Caja
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CUENTA CORRIENTE CAJA */}
          {activeTab === 'checking_account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>FONDO TESORERÍA CENTRAL</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--brand-blue)', marginTop: '4px' }}>
                    ${totalVaultCash.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '2px' }}>● Resguardo de valores activo</div>
                </div>

                <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>RETIROS DEL DÍA</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                    $35,000.00
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>1 transferencia registrada</div>
                </div>
              </div>

              {/* Formulario de Retiro a Tesorería */}
              <form onSubmit={handleCreateTransfer} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  💸 Registrar Retiro de Caja POS hacia Tesorería Central
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Monto a Retirar ($)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-app)',
                        color: 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '0.9375rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Concepto / Observación
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Retiro de exceso de efectivo acumulado"
                      value={transferConcept}
                      onChange={(e) => setTransferConcept(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-app)',
                        color: 'var(--text-main)',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn-primary" style={{ background: 'var(--brand-blue)' }}>
                    <Plus size={16} /> Transferir a Tesorería
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: MOVIMIENTOS DE TESORERÍA */}
          {activeTab === 'movements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Buscar movimiento por concepto, operador o caja..."
                    value={moveSearch}
                    onChange={(e) => setMoveSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontSize: '0.84375rem'
                    }}
                  />
                </div>

                <select
                  value={moveFilterType}
                  onChange={(e) => setMoveFilterType(e.target.value)}
                  style={{
                    padding: '0.5rem 0.875rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.84375rem',
                    fontWeight: 700
                  }}
                >
                  <option value="all">Todos los tipos</option>
                  <option value="Retiro Tesorería">Retiro Tesorería</option>
                  <option value="Ingreso">Ingreso</option>
                  <option value="Pago Gasto">Pago Gasto</option>
                </select>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84375rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Fecha/Hora</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Tipo</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Caja</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Concepto</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Operador</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(m.date).toLocaleDateString('es-AR')} {new Date(m.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem' }}>
                        <span style={{
                          fontSize: '0.725rem',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontWeight: 800,
                          background: m.type === 'Ingreso' ? '#ecfdf5' : m.type === 'Retiro Tesorería' ? '#eff6ff' : '#fef2f2',
                          color: m.type === 'Ingreso' ? '#10b981' : m.type === 'Retiro Tesorería' ? '#3b82f6' : '#ef4444'
                        }}>
                          {m.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700 }}>{m.registerCode}</td>
                      <td style={{ padding: '0.625rem 0.75rem' }}>{m.concept}</td>
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>{m.cashierName}</td>
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', fontWeight: 900, color: 'var(--text-main)' }}>
                        ${m.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: ARANCELES DE TARJETAS */}
          {activeTab === 'tariffs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                background: 'var(--bg-app)',
                padding: '1.25rem',
                borderRadius: '0.875rem',
                border: '1px solid var(--border-light)'
              }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  💳 Administración de Aranceles y Comisiones por Tarjetas
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Configurá el porcentaje de comisión y el plazo de acreditación por cada medio de pago electrónico.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {tariffs.map(t => (
                  <div key={t.id} style={{
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
                        <CreditCard size={18} style={{ color: 'var(--brand-blue)' }} />
                        <span style={{ fontWeight: 800, fontSize: '0.9375rem' }}>{t.name}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', background: 'var(--brand-light-bg)', color: 'var(--brand-blue)', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        {t.code}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--bg-app)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>COMISIÓN (%)</div>
                        {editingTariffId === t.id ? (
                          <input
                            type="number"
                            step="0.1"
                            defaultValue={t.feePercent}
                            id={`fee-${t.id}`}
                            style={{ width: '100%', padding: '0.2rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 800 }}
                          />
                        ) : (
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>{t.feePercent}%</div>
                        )}
                      </div>

                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ACREDITACIÓN</div>
                        {editingTariffId === t.id ? (
                          <input
                            type="number"
                            defaultValue={t.accreditationDays}
                            id={`days-${t.id}`}
                            style={{ width: '100%', padding: '0.2rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 800 }}
                          />
                        ) : (
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>{t.accreditationDays} días</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {editingTariffId === t.id ? (
                        <button
                          onClick={() => {
                            const feeEl = document.getElementById(`fee-${t.id}`) as HTMLInputElement;
                            const daysEl = document.getElementById(`days-${t.id}`) as HTMLInputElement;
                            handleUpdateTariff(t.id, parseFloat(feeEl.value) || t.feePercent, parseInt(daysEl.value) || t.accreditationDays);
                          }}
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78125rem' }}
                        >
                          Guardar
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingTariffId(t.id)}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78125rem' }}
                        >
                          Editar Arancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LandmarkIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="22" x2="21" y2="22"></line>
    <line x1="6" y1="18" x2="6" y2="11"></line>
    <line x1="10" y1="18" x2="10" y2="11"></line>
    <line x1="14" y1="18" x2="14" y2="11"></line>
    <line x1="18" y1="18" x2="18" y2="11"></line>
    <polygon points="12 2 20 7 4 7 12 2"></polygon>
  </svg>
);
