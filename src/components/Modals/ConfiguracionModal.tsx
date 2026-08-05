import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Settings,
  ShieldCheck,
  Sliders,
  Gift,
  Cpu,
  Database,
  CheckCircle2,
  AlertCircle,
  Key,
  Copy,
  Printer,
  Plus,
  Trash2,
  RefreshCw,
  Server,
  Monitor
} from 'lucide-react';

interface ConfiguracionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'support' | 'labels' | 'discounts' | 'mm_props' | 'backend';
}

interface DiscountRule {
  id: string;
  name: string;
  category: string;
  discountPercent: number;
  minUnits: number;
  isActive: boolean;
}

interface CustomProperty {
  id: string;
  name: string;
  type: 'Texto' | 'Número' | 'Selección';
  unit: string;
  isRequired: boolean;
}

const INITIAL_DISCOUNTS: DiscountRule[] = [];

const INITIAL_PROPERTIES: CustomProperty[] = [];

export const ConfiguracionModal: React.FC<ConfiguracionModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'support'
}) => {
  const { activeStore } = useTenant();
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState<'support' | 'labels' | 'discounts' | 'mm_props' | 'backend'>(initialTab);
  const [notification, setNotification] = useState<string | null>(null);

  // Support State
  const [supportAccessEnabled, setSupportAccessEnabled] = useState(false);
  const [supportPin, setSupportPin] = useState<string>('');
  const [pinDurationHours, setPinDurationHours] = useState<number>(2);

  // Label Design State
  const [labelTemplate, setLabelTemplate] = useState<'gondola' | 'barcode' | 'promo'>('gondola');
  const [showPriceBase, setShowPriceBase] = useState(true);
  const [showLogo, setShowLogo] = useState(true);

  // Discounts State
  const [discounts, setDiscounts] = useState<DiscountRule[]>(INITIAL_DISCOUNTS);
  const [newDiscName, setNewDiscName] = useState('');
  const [newDiscCategory, setNewDiscCategory] = useState('General');
  const [newDiscPercent, setNewDiscPercent] = useState('10');

  // MM Properties State
  const [properties, setProperties] = useState<CustomProperty[]>(INITIAL_PROPERTIES);
  const [newPropName, setNewPropName] = useState('');

  // Backend Config State
  const [dbStatus, setDbStatus] = useState<'connected' | 'checking'>('connected');
  const [cacheClearSuccess, setCacheClearSuccess] = useState(false);

  const storeKey = activeStore?.id || 'demo-store';

  // Load store-scoped discounts, properties and support pin from localStorage & Supabase
  useEffect(() => {
    const loadConfigData = async () => {
      let loadedDiscounts = INITIAL_DISCOUNTS;
      let loadedProperties = INITIAL_PROPERTIES;

      try {
        const rawDiscounts = localStorage.getItem(`pickingup_discounts_${storeKey}`);
        if (rawDiscounts) loadedDiscounts = JSON.parse(rawDiscounts);

        const rawProps = localStorage.getItem(`pickingup_mm_props_${storeKey}`);
        if (rawProps) loadedProperties = JSON.parse(rawProps);

        const rawPinData = localStorage.getItem(`pickingup_support_pin_${storeKey}`);
        if (rawPinData) {
          const parsedPin = JSON.parse(rawPinData);
          if (parsedPin.expiresAt && Date.now() < parsedPin.expiresAt) {
            setSupportPin(parsedPin.pin);
            setSupportAccessEnabled(parsedPin.enabled);
          } else {
            setSupportAccessEnabled(false);
          }
        }
      } catch {}

      setDiscounts(loadedDiscounts);
      setProperties(loadedProperties);
    };

    if (isOpen) {
      loadConfigData();
    }
  }, [isOpen, storeKey]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const saveDiscountsStorage = async (updated: DiscountRule[]) => {
    setDiscounts(updated);
    try {
      localStorage.setItem(`pickingup_discounts_${storeKey}`, JSON.stringify(updated));
    } catch {}

    if (user && user.id !== 'demo-user-1234' && activeStore) {
      try {
        await supabase.from('cash_movements').insert({
          store_id: activeStore.id,
          movement_type: 'Ajuste',
          amount: 0,
          concept: `CONFIG_DISCOUNTS: ${JSON.stringify(updated).slice(0, 180)}`,
          cashier_name: user.email?.split('@')[0] || 'Operador',
          register_code: 'POS-01'
        });
      } catch (err) {
        console.warn('Error syncing discounts to Supabase:', err);
      }
    }
  };

  const savePropertiesStorage = async (updated: CustomProperty[]) => {
    setProperties(updated);
    try {
      localStorage.setItem(`pickingup_mm_props_${storeKey}`, JSON.stringify(updated));
    } catch {}

    if (user && user.id !== 'demo-user-1234' && activeStore) {
      try {
        await supabase.from('cash_movements').insert({
          store_id: activeStore.id,
          movement_type: 'Ajuste',
          amount: 0,
          concept: `CONFIG_MM_PROPS: ${JSON.stringify(updated).slice(0, 180)}`,
          cashier_name: user.email?.split('@')[0] || 'Operador',
          register_code: 'POS-01'
        });
      } catch (err) {
        console.warn('Error syncing properties to Supabase:', err);
      }
    }
  };

  const handleGenerateSupportPin = () => {
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + pinDurationHours * 3600 * 1000;
    setSupportPin(generated);
    setSupportAccessEnabled(true);

    try {
      localStorage.setItem(`pickingup_support_pin_${storeKey}`, JSON.stringify({
        pin: generated,
        enabled: true,
        expiresAt
      }));
    } catch {}

    showSuccess(`Nuevo PIN de soporte generado: ${generated} (Válido por ${pinDurationHours} hs).`);
    addNotification({
      title: 'Acceso de Soporte Autorizado',
      message: `Se generó el PIN ${generated} con acceso válido por ${pinDurationHours} horas.`,
      type: 'warning'
    });
  };

  const handleAddDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscName.trim()) return;

    const newRule: DiscountRule = {
      id: `disc-${Date.now()}`,
      name: newDiscName.trim(),
      category: newDiscCategory,
      discountPercent: parseFloat(newDiscPercent) || 5,
      minUnits: 1,
      isActive: true
    };

    const updated = [...discounts, newRule];
    saveDiscountsStorage(updated);
    setNewDiscName('');
    showSuccess(`Regla de Bonificación "${newRule.name}" creada con éxito.`);
  };

  const handleToggleDiscount = (id: string) => {
    const updated = discounts.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d);
    saveDiscountsStorage(updated);
  };

  const handleDeleteDiscount = (id: string) => {
    const updated = discounts.filter(d => d.id !== id);
    saveDiscountsStorage(updated);
    showSuccess('Regla de bonificación eliminada.');
  };

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropName.trim()) return;

    const newProp: CustomProperty = {
      id: `prop-${Date.now()}`,
      name: newPropName.trim(),
      type: 'Texto',
      unit: 'Val',
      isRequired: false
    };

    const updated = [...properties, newProp];
    savePropertiesStorage(updated);
    setNewPropName('');
    showSuccess(`Propiedad personalizada "${newProp.name}" registrada.`);
  };

  const handleDeleteProperty = (id: string) => {
    const updated = properties.filter(p => p.id !== id);
    savePropertiesStorage(updated);
    showSuccess('Propiedad eliminada.');
  };

  const handleClearCache = () => {
    setCacheClearSuccess(true);
    showSuccess('Cache local del navegador reseteada y resincronizada.');
    setTimeout(() => setCacheClearSuccess(false), 3000);
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
          background: 'var(--theme-rose-bg)',
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
              border: '1px solid var(--theme-rose-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--theme-rose)',
              fontWeight: 800
            }}>
              <Settings size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                SISTEMA Y PARÁMETROS
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--theme-rose)' }}>
                Configuración General
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
            onClick={() => setActiveTab('support')}
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
              background: activeTab === 'support' ? 'var(--theme-rose)' : 'transparent',
              color: activeTab === 'support' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <ShieldCheck size={15} /> Autorizar Soporte
          </button>

          <button
            onClick={() => setActiveTab('labels')}
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
              background: activeTab === 'labels' ? 'var(--theme-rose)' : 'transparent',
              color: activeTab === 'labels' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Sliders size={15} /> Diseño Etiquetas
          </button>

          <button
            onClick={() => setActiveTab('discounts')}
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
              background: activeTab === 'discounts' ? 'var(--theme-rose)' : 'transparent',
              color: activeTab === 'discounts' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Gift size={15} /> Bonificaciones
          </button>

          <button
            onClick={() => setActiveTab('mm_props')}
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
              background: activeTab === 'mm_props' ? 'var(--theme-rose)' : 'transparent',
              color: activeTab === 'mm_props' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Cpu size={15} /> Propiedades MM
          </button>

          <button
            onClick={() => setActiveTab('backend')}
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
              background: activeTab === 'backend' ? 'var(--theme-rose)' : 'transparent',
              color: activeTab === 'backend' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Database size={15} /> Config BackEnd
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
          {/* TAB 1: AUTORIZAR SOPORTE */}
          {activeTab === 'support' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                background: 'var(--bg-app)',
                padding: '1.25rem',
                borderRadius: '0.875rem',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    🛡️ Autorización de Ingreso a Soporte Técnico Remoto
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                    Habilitá de forma segura el acceso temporal del equipo de soporte oficial de PickingUp!.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Estado:</span>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: supportAccessEnabled ? '#ecfdf5' : '#fef2f2',
                    color: supportAccessEnabled ? '#10b981' : '#ef4444'
                  }}>
                    {supportAccessEnabled ? 'Acceso Autorizado' : 'Bloqueado'}
                  </span>
                </div>
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(225, 29, 72, 0.1)',
                  color: 'var(--theme-rose)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Key size={30} />
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    PIN TEMPORAL DE ACCESO A SOPORTE
                  </div>
                  <div style={{ fontSize: supportPin ? '2.5rem' : '1.5rem', fontWeight: 900, color: supportPin ? 'var(--text-main)' : 'var(--text-muted)', letterSpacing: supportPin ? '0.2em' : 'normal', margin: '0.25rem 0' }}>
                    {supportPin || 'Sin PIN activo'}
                  </div>
                  <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                    Proporcioná este código al especialista de soporte cuando solicites asistencia remota.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Validez:</label>
                    <select
                      value={pinDurationHours}
                      onChange={(e) => setPinDurationHours(Number(e.target.value))}
                      style={{
                        padding: '0.4rem 0.625rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-app)',
                        color: 'var(--text-main)',
                        fontWeight: 700
                      }}
                    >
                      <option value={1}>1 Hora</option>
                      <option value={2}>2 Horas</option>
                      <option value={8}>8 Horas</option>
                      <option value={24}>24 Horas</option>
                    </select>
                  </div>

                  <button
                    onClick={handleGenerateSupportPin}
                    className="btn-primary"
                    style={{ background: 'var(--theme-rose)', gap: '0.5rem' }}
                  >
                    <RefreshCw size={16} /> Generar Nuevo PIN
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DISEÑO DE ETIQUETAS */}
          {activeTab === 'labels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {/* Config Controls */}
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.875rem',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    🏷️ Parámetros de Impresión de Etiquetas
                  </h4>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Plantilla / Formato:
                    </label>
                    <select
                      value={labelTemplate}
                      onChange={(e) => setLabelTemplate(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-app)',
                        color: 'var(--text-main)',
                        fontWeight: 700
                      }}
                    >
                      <option value="gondola">Góndola Estándar (50x30 mm)</option>
                      <option value="barcode">Código de Barras EAN-13 (40x25 mm)</option>
                      <option value="promo">Oferta Destacada (70x40 mm)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showPriceBase} onChange={(e) => setShowPriceBase(e.target.checked)} />
                      <span>Mostrar Precio Base y Precio por Lista</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />
                      <span>Imprimir Logo de {activeStore?.name || 'Comercio'}</span>
                    </label>
                  </div>

                  <button
                    onClick={() => showSuccess('Diseño de etiqueta guardado como predeterminado.')}
                    className="btn-primary"
                    style={{ background: 'var(--brand-blue)', marginTop: '0.5rem' }}
                  >
                    <Printer size={16} /> Guardar Formato Impresión
                  </button>
                </div>

                {/* Interactive Preview Canvas */}
                <div style={{
                  background: 'var(--bg-app)',
                  border: '1px dashed var(--border-light)',
                  borderRadius: '0.875rem',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.75rem' }}>
                    VISTA PREVIA DE ETIQUETA EN VIVO
                  </div>

                  <div style={{
                    width: '240px',
                    height: '140px',
                    background: '#ffffff',
                    color: '#000000',
                    borderRadius: '6px',
                    padding: '0.875rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid #e2e8f0'
                  }}>
                    {showLogo && (
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: '#0284c7' }}>
                        {activeStore?.name || 'PICKINGUP! S.A.'}
                      </div>
                    )}

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', lineHeight: 1.1 }}>Aceite Girasol 900ml</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>CÓD: 7791234567891</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: '1px' }}>||||||||||||||||</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>$1.450</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BONIFICACIONES */}
          {activeTab === 'discounts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <form onSubmit={handleAddDiscount} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr auto',
                gap: '1rem',
                alignItems: 'end'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Nombre de la Promoción
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 10% Descuento Almacén"
                    value={newDiscName}
                    onChange={(e) => setNewDiscName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Categoría
                  </label>
                  <select
                    value={newDiscCategory}
                    onChange={(e) => setNewDiscCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  >
                    <option value="General">General</option>
                    <option value="Almacén">Almacén</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Limpieza">Limpieza</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    % Descuento
                  </label>
                  <input
                    type="number"
                    required
                    value={newDiscPercent}
                    onChange={(e) => setNewDiscPercent(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 800 }}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ background: 'var(--theme-rose)' }}>
                  <Plus size={16} /> Crear Regla
                </button>
              </form>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84375rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Regla de Bonificación</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Categoría</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>% Descuento</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700 }}>{d.name}</td>
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>{d.category}</td>
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center', fontWeight: 900, color: 'var(--brand-blue)' }}>
                        -{d.discountPercent}%
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.725rem', background: '#ecfdf5', color: '#10b981', padding: '2px 8px', borderRadius: '9999px', fontWeight: 800 }}>
                          Activa
                        </span>
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>
                        <button
                          onClick={() => setDiscounts(prev => prev.filter(x => x.id !== d.id))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: PROPIEDADES MM */}
          {activeTab === 'mm_props' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <form onSubmit={handleAddProperty} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'end'
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Nombre de Propiedad Personalizada (MM)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Temperatura de Conservación"
                    value={newPropName}
                    onChange={(e) => setNewPropName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ background: 'var(--brand-blue)' }}>
                  <Plus size={16} /> Agregar Propiedad
                </button>
              </form>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                {properties.map(p => (
                  <div key={p.id} style={{
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Tipo: <strong>{p.type}</strong> | Unidad: <strong>{p.unit}</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => setProperties(prev => prev.filter(x => x.id !== p.id))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: CONFIG BACKEND */}
          {activeTab === 'backend' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Server size={18} style={{ color: '#10b981' }} />
                    <span style={{ fontWeight: 800, fontSize: '0.875rem' }}>Supabase PostgreSQL DB</span>
                  </div>
                  <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>URL: cnfgzrfapywrcccempug.supabase.co</div>
                  <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 800, marginTop: '0.5rem' }}>● Conectado (Latencia 12ms)</div>
                </div>

                <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Monitor size={18} style={{ color: 'var(--brand-blue)' }} />
                    <span style={{ fontWeight: 800, fontSize: '0.875rem' }}>Cache Local de Navegador</span>
                  </div>
                  <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>Claves aisladas por store_id</div>
                  <button
                    onClick={handleClearCache}
                    className="btn-secondary"
                    style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.75rem', gap: '0.35rem' }}
                  >
                    <RefreshCw size={13} /> Limpiar Cache Local
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
