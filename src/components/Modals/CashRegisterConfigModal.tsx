import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Tag,
  Monitor,
  User,
  AlertCircle,
  Save,
  CheckSquare,
  Square,
  Building2,
  RefreshCw
} from 'lucide-react';

export interface ConfiguredCashRegister {
  id: string;
  code: string;
  name: string;
  cashierName: string;
  version: string;
  defaultPriceListName: string;
  allowedPriceListNames: string[];
  isActive: boolean;
}

interface CashRegisterConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashRegisterConfigModal: React.FC<CashRegisterConfigModalProps> = ({ isOpen, onClose }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();

  const storeKey = activeStore?.id || 'demo-store';

  const [registers, setRegisters] = useState<ConfiguredCashRegister[]>([]);
  const [priceListOptions, setPriceListOptions] = useState<string[]>(['Lista Base']);
  const [editingReg, setEditingReg] = useState<Partial<ConfiguredCashRegister> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPriceLists();
      loadRegisters();
    }
  }, [isOpen, activeStore]);

  const loadPriceLists = async () => {
    let listNames = ['Lista Base'];

    // Local Storage
    try {
      const rawLists = localStorage.getItem(`pickingup_pricelists_${storeKey}`);
      if (rawLists) {
        const parsed = JSON.parse(rawLists);
        if (parsed.length > 0) {
          listNames = parsed.map((p: any) => p.name);
        }
      }
    } catch {}

    // Supabase DB
    if (user && !isDemoMode && activeStore) {
      try {
        const { data, error } = await supabase
          .from('price_lists')
          .select('name')
          .eq('store_id', activeStore.id);

        if (!error && data && data.length > 0) {
          const names = data.map(d => d.name);
          listNames = Array.from(new Set(['Lista Base', ...names]));
        }
      } catch {}
    }

    setPriceListOptions(listNames);
  };

  const loadRegisters = async () => {
    // Local Cache
    const rawLocal = localStorage.getItem(`pickingup_cajas_config_${storeKey}`);
    if (rawLocal) {
      try {
        setRegisters(JSON.parse(rawLocal));
      } catch {
        setRegisters([]);
      }
    } else {
      setRegisters([]);
    }

    // Supabase DB
    if (user && !isDemoMode && activeStore) {
      try {
        const { data, error } = await supabase
          .from('cash_registers')
          .select('*')
          .eq('store_id', activeStore.id)
          .order('code', { ascending: true });

        if (!error && data && data.length > 0) {
          const mapped: ConfiguredCashRegister[] = data.map(d => ({
            id: d.id,
            code: d.code,
            name: d.name,
            cashierName: d.cashier_name || 'Operador General',
            version: d.version || 'v10.3.20 (iPOS-Android)',
            defaultPriceListName: d.default_price_list_name || 'Lista Base',
            allowedPriceListNames: d.allowed_price_list_names || [d.default_price_list_name || 'Lista Base'],
            isActive: Boolean(d.is_active)
          }));
          setRegisters(mapped);
          try {
            localStorage.setItem(`pickingup_cajas_config_${storeKey}`, JSON.stringify(mapped));
          } catch {}
        }
      } catch {}
    }
  };

  const saveRegistersToStorage = (updated: ConfiguredCashRegister[]) => {
    setRegisters(updated);
    try {
      localStorage.setItem(`pickingup_cajas_config_${storeKey}`, JSON.stringify(updated));
      localStorage.setItem(`pickingup_registers_${storeKey}`, JSON.stringify(updated));
    } catch {}
  };

  const handleSaveRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReg || !editingReg.name || !editingReg.code) return;

    const allowed = editingReg.allowedPriceListNames && editingReg.allowedPriceListNames.length > 0
      ? editingReg.allowedPriceListNames
      : ['Lista Base'];
    const defName = editingReg.defaultPriceListName && allowed.includes(editingReg.defaultPriceListName)
      ? editingReg.defaultPriceListName
      : allowed[0];

    let updated: ConfiguredCashRegister[];

    if (editingReg.id) {
      // Update
      updated = registers.map(r => r.id === editingReg.id ? {
        ...r,
        ...editingReg,
        defaultPriceListName: defName,
        allowedPriceListNames: allowed
      } as ConfiguredCashRegister : r);
    } else {
      // Create
      const newReg: ConfiguredCashRegister = {
        id: `reg-${Date.now()}`,
        code: editingReg.code.trim(),
        name: editingReg.name.trim().toUpperCase(),
        cashierName: editingReg.cashierName?.trim() || 'Operador General',
        version: editingReg.version?.trim() || 'v10.3.20 (iPOS-Android)',
        defaultPriceListName: defName,
        allowedPriceListNames: allowed,
        isActive: editingReg.isActive ?? true
      };
      updated = [...registers, newReg];
    }

    saveRegistersToStorage(updated);

    // Save to Supabase DB if logged in
    if (user && !isDemoMode && activeStore) {
      try {
        await supabase.from('cash_registers').upsert({
          store_id: activeStore.id,
          code: editingReg.code,
          name: editingReg.name.trim().toUpperCase(),
          cashier_name: editingReg.cashierName || 'Operador General',
          version: editingReg.version || 'v10.3.20 (iPOS-Android)',
          default_price_list_name: defName,
          allowed_price_list_names: allowed,
          is_active: editingReg.isActive ?? true
        }, { onConflict: 'store_id,code' });
      } catch (err) {
        console.error('Error persisting cash register in DB:', err);
      }
    }

    setStatusMsg(`¡Caja "${editingReg.name}" guardada correctamente!`);
    setTimeout(() => setStatusMsg(null), 4000);
    setEditingReg(null);
    setIsCreatingNew(false);
  };

  const handleDeleteRegister = async (regId: string) => {
    const target = registers.find(r => r.id === regId);
    const updated = registers.filter(r => r.id !== regId);
    saveRegistersToStorage(updated);

    if (user && !isDemoMode && activeStore && target) {
      try {
        await supabase
          .from('cash_registers')
          .delete()
          .eq('store_id', activeStore.id)
          .eq('code', target.code);
      } catch {}
    }
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
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '950px',
        maxHeight: '90vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} className="animate-fade-in">

        {/* Modal Top Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
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
              <Monitor size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
                CONFIGURACIÓN DE PUNTOS DE VENTA (POS)
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                {activeStore?.name || 'Administración de Cajas del Comercio'}
              </h2>
            </div>
          </div>

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

        {/* Modal Body Notification */}
        {statusMsg && (
          <div style={{
            margin: '1rem 1.5rem 0',
            padding: '0.75rem 1rem',
            borderRadius: '0.625rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: '0.84375rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Check size={16} /> {statusMsg}
          </div>
        )}

        {/* Create / Edit Drawer Form */}
        {(isCreatingNew || editingReg) && (
          <form onSubmit={handleSaveRegister} style={{
            background: 'var(--bg-app)',
            borderBottom: '1px solid var(--border-light)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit2 size={16} style={{ color: 'var(--brand-blue)' }} />
              {editingReg?.id ? `Editar Caja: ${editingReg.name}` : 'Crear Nueva Caja para este Comercio'}
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  N° de Caja *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. 1, 2, 100"
                  value={editingReg?.code || ''}
                  onChange={(e) => setEditingReg({ ...editingReg, code: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Nombre / Descripción de Caja *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. CAJA 1 - PRINCIPAL"
                  value={editingReg?.name || ''}
                  onChange={(e) => setEditingReg({ ...editingReg, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Cajero / Operador Asignado
                </label>
                <input
                  type="text"
                  placeholder="ej. Juan Pérez"
                  value={editingReg?.cashierName || ''}
                  onChange={(e) => setEditingReg({ ...editingReg, cashierName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Lista Predeterminada (Inicio de Turno) *
                </label>
                <select
                  value={editingReg?.defaultPriceListName || priceListOptions[0] || 'Lista Base'}
                  onChange={(e) => setEditingReg({ ...editingReg, defaultPriceListName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--brand-blue)',
                    fontSize: '0.85rem',
                    fontWeight: 800
                  }}
                >
                  {(editingReg?.allowedPriceListNames || priceListOptions).map((name, idx) => (
                    <option key={idx} value={name}>⭐ {name}</option>
                  ))}
                </select>
              </div>

              {/* Multi-Select Checkboxes for Allowed Price Lists */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Listas de Precios Habilitadas para esta Caja (Permite alternar listas durante la jornada) *
                </label>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.625rem',
                  background: 'var(--bg-surface)',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.625rem',
                  border: '1px solid var(--border-light)'
                }}>
                  {priceListOptions.map((name, idx) => {
                    const isChecked = (editingReg?.allowedPriceListNames || [editingReg?.defaultPriceListName || 'Lista Base']).includes(name);
                    return (
                      <label
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          padding: '0.3rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: isChecked ? '1px solid var(--brand-blue)' : '1px solid var(--border-light)',
                          background: isChecked ? 'var(--brand-light-bg)' : 'var(--bg-app)',
                          color: isChecked ? 'var(--brand-blue)' : 'var(--text-main)',
                          userSelect: 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = editingReg?.allowedPriceListNames || [editingReg?.defaultPriceListName || 'Lista Base'];
                            let updatedLists: string[];
                            if (e.target.checked) {
                              updatedLists = Array.from(new Set([...current, name]));
                            } else {
                              updatedLists = current.filter(n => n !== name);
                              if (updatedLists.length === 0) updatedLists = ['Lista Base'];
                            }
                            const currentDef = editingReg?.defaultPriceListName || 'Lista Base';
                            const nextDef = updatedLists.includes(currentDef) ? currentDef : updatedLists[0];
                            setEditingReg({
                              ...editingReg,
                              allowedPriceListNames: updatedLists,
                              defaultPriceListName: nextDef
                            });
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        🏷️ {name} {editingReg?.defaultPriceListName === name && '(Predeterminada)'}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <label
                onClick={() => setEditingReg({ ...editingReg, isActive: !(editingReg?.isActive ?? true) })}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}
              >
                {editingReg?.isActive ?? true ? (
                  <CheckSquare size={18} style={{ color: 'var(--brand-blue)' }} />
                ) : (
                  <Square size={18} style={{ color: 'var(--text-muted)' }} />
                )}
                Caja Activa para Venta en POS
              </label>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingReg(null);
                    setIsCreatingNew(false);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: 'var(--brand-blue)',
                    color: '#ffffff',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Save size={15} /> Guardar Caja
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Modal Dynamic Action Toolbar */}
        <div style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)'
        }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Cajas Configuradas ({registers.length})
            </h3>
            <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Cada caja puede tener su propia lista de precios y cajero asignado para {activeStore?.name || 'su sucursal'}.
            </p>
          </div>

          {!isCreatingNew && !editingReg && (
            <button
              onClick={() => {
                setIsCreatingNew(true);
                setEditingReg({
                  code: String(registers.length > 0 ? Math.max(...registers.map(r => Number(r.code) || 0)) + 1 : 1),
                  name: `CAJA ${registers.length + 1}`,
                  cashierName: 'Operador General',
                  defaultPriceListName: priceListOptions[0] || 'Lista Base',
                  isActive: true
                });
              }}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'var(--brand-blue)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={16} /> ➕ Configurar Nueva Caja
            </button>
          )}
        </div>

        {/* Modal Main Body Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          <div style={{
            border: '1px solid var(--border-light)',
            borderRadius: '0.875rem',
            overflow: 'hidden',
            background: 'var(--bg-surface)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{
                  background: 'var(--bg-app)',
                  borderBottom: '1px solid var(--border-light)',
                  fontWeight: 800,
                  color: 'var(--text-main)'
                }}>
                  <th style={{ padding: '0.75rem 1rem', width: '90px' }}>N° Caja</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Nombre / Descripción</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cajero Asignado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Lista de Precios Asignada</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Versión POS</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay cajas configuradas en este comercio. Hacé clic en "Configurar Nueva Caja" para comenzar.
                    </td>
                  </tr>
                ) : (
                  registers.map((reg, idx) => (
                    <tr
                      key={reg.id}
                      style={{
                        borderBottom: idx === registers.length - 1 ? 'none' : '1px solid var(--border-light)',
                        background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-app)'
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 900, fontFamily: 'monospace', color: 'var(--brand-blue)' }}>
                        #{reg.code}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {reg.name}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <User size={13} /> {reg.cashierName}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {(reg.allowedPriceListNames || [reg.defaultPriceListName || 'Lista Base']).map((listName, lIdx) => {
                            const isDefault = listName === reg.defaultPriceListName;
                            return (
                              <span
                                key={lIdx}
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '9999px',
                                  background: isDefault ? 'var(--brand-light-bg)' : 'var(--bg-app)',
                                  color: isDefault ? 'var(--brand-blue)' : 'var(--text-main)',
                                  border: isDefault ? '1px solid var(--brand-blue)' : '1px solid var(--border-light)',
                                  fontWeight: 800,
                                  fontSize: '0.72rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                <Tag size={11} /> {listName} {isDefault && '⭐'}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {reg.version}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          background: reg.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: reg.isActive ? '#10b981' : '#ef4444',
                          fontWeight: 800,
                          fontSize: '0.72rem'
                        }}>
                          {reg.isActive ? 'ACTIVA' : 'INACTIVA'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              setIsCreatingNew(false);
                              setEditingReg(reg);
                            }}
                            title="Editar Caja"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--brand-blue)',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => handleDeleteRegister(reg.id)}
                            title="Eliminar Caja"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
            <AlertCircle size={15} style={{ color: 'var(--brand-blue)' }} />
            <span>Los cambios de cajas y listas de precios asignadas se sincronizan automáticamente con la sucursal {activeStore?.name || 'activa'}.</span>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '0.625rem',
              border: 'none',
              background: 'var(--brand-blue)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer'
            }}
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
