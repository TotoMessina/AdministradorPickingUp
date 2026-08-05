import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import { BaseModal } from './BaseModal';
import {
  Shield,
  Lock,
  CheckCircle2,
  Building2,
  Users,
  Plus,
  X,
  Key,
  ChevronRight,
  Zap,
  Check,
  Mail,
  User,
  Monitor,
  Tag,
  Save,
  Trash2,
  Edit2,
  Eye
} from 'lucide-react';

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface CashierUser {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  assignedRegisterName: string;
  defaultPriceListName: string;
  role: 'cajero' | 'supervisor' | 'admin';
  created_at: string;
}

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({ isOpen, onClose }) => {
  const { user, isDemoMode } = useAuth();
  const { activeStore } = useTenant();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  const [cashiers, setCashiers] = useState<CashierUser[]>([]);
  const [registers, setRegisters] = useState<string[]>([]);
  const [priceLists, setPriceLists] = useState<string[]>([]);

  // Modal Form State (Create/Edit Cashier User)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCashierId, setEditingCashierId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    fullName: string;
    assignedRegisterName: string;
    defaultPriceListName: string;
    role: 'cajero' | 'supervisor' | 'admin';
  }>({
    email: '',
    password: '',
    fullName: '',
    assignedRegisterName: 'Caja 01 - Principal',
    defaultPriceListName: 'Lista Base',
    role: 'cajero'
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCashiersAndConfig();
    }
  }, [isOpen, activeStore]);

  const loadCashiersAndConfig = async () => {
    let loadedCashiers: CashierUser[] = [];

    let loadedRegs: string[] = ['Caja 01 - Principal', 'Caja 02 - Express'];
    let loadedLists: string[] = ['Lista Base', 'Lista Mayorista'];

    // Load Local Storage
    try {
      const rawCashiers = localStorage.getItem(`pickingup_cashiers_${storeKey}`) || localStorage.getItem('pickingup_cashiers_global');
      if (rawCashiers) {
        const parsed = JSON.parse(rawCashiers);
        if (Array.isArray(parsed) && parsed.length > 0) loadedCashiers = parsed;
      }

      const rawRegs = localStorage.getItem(`pickingup_registers_${storeKey}`) || localStorage.getItem(`pickingup_cajas_config_${storeKey}`);
      if (rawRegs) {
        const parsed = JSON.parse(rawRegs);
        if (parsed.length > 0) loadedRegs = parsed.map((r: any) => r.name);
      }

      const rawLists = localStorage.getItem(`pickingup_pricelists_${storeKey}`);
      if (rawLists) {
        const parsed = JSON.parse(rawLists);
        if (parsed.length > 0) loadedLists = parsed.map((l: any) => l.name);
      }
    } catch {}

    // Load DB
    if (user && !isDemoMode && activeStore) {
      try {
        const { data: dbMembers } = await supabase
          .from('store_members')
          .select('*')
          .eq('store_id', activeStore.id);

        if (dbMembers && dbMembers.length > 0) {
          const dbMapped: CashierUser[] = dbMembers.map((m: any, idx: number) => ({
            id: m.id || `db-caj-${idx}`,
            email: m.email || `operador-${idx + 1}@comercio.com`,
            fullName: m.full_name || m.role?.toUpperCase() || `Cajero ${idx + 1}`,
            assignedRegisterName: m.assigned_register_name || loadedRegs[0] || 'Caja 01 - Principal',
            defaultPriceListName: m.default_price_list_name || loadedLists[0] || 'Lista Base',
            role: (m.role === 'owner' || m.role === 'admin') ? 'admin' : (m.role === 'supervisor' ? 'supervisor' : 'cajero'),
            created_at: m.created_at || new Date().toISOString()
          }));
          if (dbMapped.length > 0) {
            loadedCashiers = dbMapped;
          }
        }
      } catch (err) {
        console.error('Error fetching cashier members:', err);
      }
    }

    setCashiers(loadedCashiers);
    setRegisters(loadedRegs);
    setPriceLists(loadedLists);
  };

  const syncCashiers = (updated: CashierUser[]) => {
    setCashiers(updated);
    try {
      localStorage.setItem(`pickingup_cashiers_${storeKey}`, JSON.stringify(updated));
      localStorage.setItem('pickingup_cashiers_global', JSON.stringify(updated));
    } catch {}
  };

  const handleOpenCreateModal = () => {
    setEditingCashierId(null);
    setFormData({
      email: '',
      password: '',
      fullName: '',
      assignedRegisterName: registers[0] || 'Caja 01 - Principal',
      defaultPriceListName: priceLists[0] || 'Lista Base',
      role: 'cajero'
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (cashier: CashierUser) => {
    setEditingCashierId(cashier.id);
    setFormData({
      email: cashier.email,
      password: cashier.password || '••••••••',
      fullName: cashier.fullName,
      assignedRegisterName: cashier.assignedRegisterName || registers[0] || 'Caja 01 - Principal',
      defaultPriceListName: cashier.defaultPriceListName || priceLists[0] || 'Lista Base',
      role: cashier.role || 'cajero'
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('Ingrese un correo electrónico válido para el cajero.');
      return;
    }
    if (!formData.password || formData.password.length < 4) {
      setFormError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (!formData.fullName.trim()) {
      setFormError('Ingrese el nombre completo del cajero.');
      return;
    }

    const exists = cashiers.some(c => c.id !== editingCashierId && c.email.toLowerCase() === formData.email.trim().toLowerCase());
    if (exists) {
      setFormError('Este correo electrónico ya está asignado a otro cajero.');
      return;
    }

    let updated: CashierUser[];
    if (editingCashierId) {
      updated = cashiers.map(c => c.id === editingCashierId ? {
        ...c,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        assignedRegisterName: formData.assignedRegisterName,
        defaultPriceListName: formData.defaultPriceListName,
        role: formData.role
      } : c);
    } else {
      const newCashier: CashierUser = {
        id: `caj-${Date.now()}`,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        assignedRegisterName: formData.assignedRegisterName,
        defaultPriceListName: formData.defaultPriceListName,
        role: formData.role,
        created_at: new Date().toISOString()
      };
      updated = [newCashier, ...cashiers];
    }

    syncCashiers(updated);

    if (user && !isDemoMode && activeStore) {
      try {
        // Update cashier assignment in cash_registers for the active store
        await supabase
          .from('cash_registers')
          .update({ cashier_name: formData.fullName.trim() })
          .eq('store_id', activeStore.id)
          .eq('name', formData.assignedRegisterName);
      } catch (err) {
        console.error('Error updating cashier assignment in DB:', err);
      }
    }

    setIsFormOpen(false);
    setEditingCashierId(null);
    addNotification({
      title: editingCashierId ? 'Usuario Cajero Actualizado' : 'Usuario Cajero Creado',
      message: `${editingCashierId ? 'Se actualizaron los datos' : 'Se creó la cuenta'} para ${formData.fullName.trim()} (${formData.email.trim()}).`,
      type: 'success'
    });
  };

  const handleDeleteCashier = (id: string, name: string) => {
    if (!window.confirm(`¿Confirmás eliminar al cajero "${name}"?`)) return;
    const updated = cashiers.filter(c => c.id !== id);
    syncCashiers(updated);
    addNotification({
      title: 'Usuario Cajero Eliminado',
      message: `Se eliminó el usuario de ${name}.`,
      type: 'warning'
    });
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
        maxWidth: '900px',
        maxHeight: '90vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} className="animate-fade-in">

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
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
              <Users size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
                ADMINISTRACIÓN DE USUARIOS Y ASIGNACIÓN DE CAJAS
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                Usuarios Cajeros y Roles — {activeStore?.name || 'Mi Negocio'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleOpenCreateModal}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#ffffff',
                color: '#4f46e5',
                fontWeight: 900,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={16} /> + Crear Usuario Cajero
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

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                👥 Usuarios Cajeros Registrados ({cashiers.length})
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                Cada cajero ingresa con su email y contraseña. Tiene asignada su caja y lista de cobro predeterminada.
              </p>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Cajero / Nombre</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Email de Login</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Caja Asignada</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Lista Predeterminada</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cashiers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se han creado usuarios cajeros aún. Hacé clic en "+ Crear Usuario Cajero" arriba.
                    </td>
                  </tr>
                ) : (
                  cashiers.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        👤 {c.fullName}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        ✉️ {c.email}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(79, 70, 229, 0.12)', color: '#4f46e5', fontWeight: 800, fontSize: '0.75rem' }}>
                          🖥️ {c.assignedRegisterName}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', fontWeight: 800, fontSize: '0.75rem' }}>
                          🏷️ {c.defaultPriceListName}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          title="Editar Cajero"
                          style={{ padding: '0.35rem', borderRadius: '0.375rem', border: '1px solid var(--border-light)', background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', cursor: 'pointer' }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteCashier(c.id, c.fullName)}
                          title="Eliminar Cajero"
                          style={{ padding: '0.35rem', borderRadius: '0.375rem', border: '1px solid var(--border-light)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CREATE CASHIER MODAL */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '1rem', width: '100%', maxWidth: '550px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }} className="animate-fade-in">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', background: '#4f46e5', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                {editingCashierId ? '✏️ Editar Usuario Cajero' : '➕ Crear Usuario Cajero'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCashier} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formError && (
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 700 }}>
                  ⚠️ {formError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Nombre Completo del Cajero *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Carlos Rossi"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 700, color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Correo Electrónico de Login *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="cajero1@supermercado.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Contraseña de Acceso *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="cajero123"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Caja Registradora Asignada *
                  </label>
                  <select
                    value={formData.assignedRegisterName}
                    onChange={(e) => setFormData({ ...formData, assignedRegisterName: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 800, color: '#4f46e5' }}
                  >
                    {registers.map((r, i) => (
                      <option key={i} value={r}>🖥️ {r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Lista de Precios Predeterminada *
                  </label>
                  <select
                    value={formData.defaultPriceListName}
                    onChange={(e) => setFormData({ ...formData, defaultPriceListName: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 800, color: '#a855f7' }}
                  >
                    {priceLists.map((l, i) => (
                      <option key={i} value={l}>🏷️ {l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsFormOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#4f46e5', color: '#ffffff', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Save size={16} /> Crear Usuario Cajero
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
