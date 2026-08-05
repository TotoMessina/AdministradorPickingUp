import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Tag,
  Barcode,
  DollarSign,
  ShoppingCart,
  Award,
  BookOpen,
  Plus,
  Play,
  Zap,
  List
} from 'lucide-react';

interface OnboardingTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [notification, setNotification] = useState<string | null>(null);

  // Step 2: Create Price List State
  const [listName, setListName] = useState<string>('Lista Mayorista 15%');
  const [discountPercent, setDiscountPercent] = useState<number>(15);
  const [createdListId, setCreatedListId] = useState<string>('list-demo-mayorista');

  // Step 3: Create Product State
  const [prodCode, setProdCode] = useState<string>('7791234990001');
  const [prodDescription, setProdDescription] = useState<string>('Yerba Mate Selección Especial 500g');
  const [prodCategory, setProdCategory] = useState<string>('Almacén');
  const [prodBasePrice, setProdBasePrice] = useState<number>(2400);
  const [prodCost, setProdCost] = useState<number>(1600);

  // Step 4: Custom Price State
  const [customListPrice, setCustomListPrice] = useState<number>(2040); // 2400 - 15% = 2040

  const storeKey = activeStore?.id || 'demo-store';

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Handler Step 2: Create Price List in DB + localStorage
  const handleStep2CreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;

    const newCode = Math.floor(2 + Math.random() * 90);
    const newId = `list-${Date.now()}`;
    setCreatedListId(newId);

    const newListObj = {
      id: newId,
      store_id: activeStore?.id,
      code: newCode,
      name: listName.trim(),
      type: 'porcentual',
      discount_percent: discountPercent,
      base_list_name: 'Lista Base',
      generate_labels: true,
      visible_in_pos: true,
      round_prices: true
    };

    // Save to localStorage
    try {
      const rawLists = localStorage.getItem(`pickingup_pricelists_${storeKey}`);
      const listsArr = rawLists ? JSON.parse(rawLists) : [];
      listsArr.push(newListObj);
      localStorage.setItem(`pickingup_pricelists_${storeKey}`, JSON.stringify(listsArr));
    } catch {}

    // Save to Supabase
    if (user && !isDemoMode && activeStore) {
      try {
        const { data } = await supabase
          .from('price_lists')
          .insert({
            store_id: activeStore.id,
            code: newCode,
            name: listName.trim(),
            type: 'porcentual',
            discount_percent: discountPercent,
            base_list_name: 'Lista Base'
          })
          .select()
          .single();

        if (data) setCreatedListId(data.id);
      } catch {}
    }

    showFeedback(`¡Lista de precios "${listName}" creada exitosamente!`);
    addNotification({
      title: 'Tutorial: Lista Creada',
      message: `Creaste la lista "${listName}" (${discountPercent}% desc.) para ${activeStore?.name}.`,
      type: 'success'
    });

    setCurrentStep(3);
  };

  // Handler Step 3: Create Article in DB + localStorage
  const handleStep3CreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodDescription.trim() || !prodCode.trim()) return;

    const newArticleObj = {
      code: prodCode.trim(),
      barcode: prodCode.trim(),
      description: prodDescription.trim(),
      category: prodCategory,
      price: prodBasePrice,
      cost: prodCost,
      stock: 100,
      min_stock: 10,
      is_active: true
    };

    // Save to localStorage
    try {
      const rawProds = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      const prodsArr = rawProds ? JSON.parse(rawProds) : [];
      prodsArr.unshift({
        code: prodCode.trim(),
        description: prodDescription.trim(),
        category: prodCategory,
        base_price: prodBasePrice,
        custom_prices: {}
      });
      localStorage.setItem(`pickingup_prodprices_${storeKey}`, JSON.stringify(prodsArr));
    } catch {}

    // Save to Supabase
    if (user && !isDemoMode && activeStore) {
      try {
        await supabase
          .from('articles')
          .upsert({
            store_id: activeStore.id,
            code: prodCode.trim(),
            barcode: prodCode.trim(),
            description: prodDescription.trim(),
            category: prodCategory,
            price: prodBasePrice,
            cost: prodCost,
            stock: 100,
            min_stock: 10,
            is_active: true
          }, { onConflict: 'store_id,code' });
      } catch {}
    }

    showFeedback(`¡Producto "${prodDescription}" agregado al catálogo!`);
    addNotification({
      title: 'Tutorial: Producto Registrado',
      message: `Registraste el producto "${prodDescription}" con Precio Base $${prodBasePrice}.`,
      type: 'success'
    });

    setCurrentStep(4);
  };

  // Handler Step 4: Assign Custom Price to List
  const handleStep4AssignCustomPrice = async (e: React.FormEvent) => {
    e.preventDefault();

    // Save custom price in localStorage prodprices
    try {
      const rawProds = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawProds) {
        const prodsArr = JSON.parse(rawProds);
        const updated = prodsArr.map((p: any) => {
          if (p.code === prodCode) {
            return {
              ...p,
              custom_prices: { ...(p.custom_prices || {}), [createdListId]: customListPrice }
            };
          }
          return p;
        });
        localStorage.setItem(`pickingup_prodprices_${storeKey}`, JSON.stringify(updated));
      }
    } catch {}

    // Save custom price in Supabase price_list_items if list ID is real UUID
    if (user && !isDemoMode && activeStore && createdListId && !createdListId.startsWith('list-')) {
      try {
        await supabase
          .from('price_list_items')
          .upsert({
            price_list_id: createdListId,
            article_code: prodCode,
            custom_price: customListPrice
          }, { onConflict: 'price_list_id,article_code' });
      } catch {}
    }

    showFeedback(`¡Precio especial de $${customListPrice} asignado a la lista "${listName}"!`);
    addNotification({
      title: 'Tutorial: Precio Asignado',
      message: `Asignaste $${customListPrice} al producto "${prodDescription}" en la lista "${listName}".`,
      type: 'success'
    });

    setCurrentStep(5);
  };

  // Complete onboarding
  const handleFinishOnboarding = () => {
    try {
      localStorage.setItem(`pickingup_onboarding_done_${storeKey}`, 'true');
    } catch {}

    addNotification({
      title: '🎉 Onboarding Completado',
      message: `¡Felicitaciones! Tu sucursal ${activeStore?.name || ''} está lista para operar al 100%.`,
      type: 'success'
    });

    if (onComplete) onComplete();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      zIndex: 100
    }}>
      <div style={{
        width: '100%',
        maxWidth: '840px',
        maxHeight: '90vh',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }} className="animate-fade-in">
        {/* Modal Top Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '0.875rem',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Sparkles size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)' }}>
                TUTORIAL INTERACTIVO — GUÍA DE INICIO RÁPIDO
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Paso {currentStep} de 6: {
                  currentStep === 1 ? 'Bienvenido a la Plataforma' :
                  currentStep === 2 ? 'Crear una Lista de Precios' :
                  currentStep === 3 ? 'Crear un Producto en Catálogo' :
                  currentStep === 4 ? 'Asignar Precio en Lista' :
                  currentStep === 5 ? 'Probar Terminal de Caja POS' :
                  '¡Comercio Listo para Operar!'
                }
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '0.5rem',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div style={{
          background: 'var(--bg-app)',
          padding: '0.75rem 1.75rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {[1, 2, 3, 4, 5, 6].map((st) => (
            <div
              key={st}
              onClick={() => { if (st < currentStep) setCurrentStep(st); }}
              style={{
                flex: 1,
                height: '8px',
                borderRadius: '9999px',
                background: st <= currentStep ? '#0284c7' : 'var(--border-light)',
                cursor: st < currentStep ? 'pointer' : 'default',
                transition: 'all 0.3s ease'
              }}
              title={`Paso ${st}`}
            />
          ))}
        </div>

        {/* Dynamic Feedback Banner */}
        {notification && (
          <div style={{
            margin: '1rem 1.75rem 0',
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: '0.84375rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={18} /> {notification}
          </div>
        )}

        {/* Step Body Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>

          {/* STEP 1: WELCOME */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: 'var(--bg-app)',
                padding: '1.5rem',
                borderRadius: '1rem',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '1rem',
                  background: 'var(--brand-light-bg)',
                  color: 'var(--brand-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <BookOpen size={28} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    ¡Aprende a configurar tu comercio en 5 minutos!
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                    Este tutorial te guiara paso a paso para crear lo minimo e indispensable: una <strong>Lista de Precios</strong>, un <strong>Producto</strong> y su <strong>Precio Personalizado</strong> para empezar a vender en el POS.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--brand-blue)', fontSize: '0.9375rem' }}>
                    <Tag size={18} /> 1. Listas de Precios
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Configura múltiples listas (Base, Mayorista, POS) con descuentos automáticos.
                  </div>
                </div>

                <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#10b981', fontSize: '0.9375rem' }}>
                    <Barcode size={18} /> 2. Catálogo de Artículos
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Registra tus productos con códigos EAN, categorías y precios base.
                  </div>
                </div>

                <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#8b5cf6', fontSize: '0.9375rem' }}>
                    <ShoppingCart size={18} /> 3. Terminal POS
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Vende desde cajas aisladas con sincronización en tiempo real.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="btn-primary"
                  style={{ background: '#0284c7', gap: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '0.9375rem' }}
                >
                  Comenzar Tutorial Paso 1 <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CREATE PRICE LIST */}
          {currentStep === 2 && (
            <form onSubmit={handleStep2CreateList} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', padding: '1.25rem', borderRadius: '0.875rem', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Tag size={18} style={{ color: '#0284c7' }} /> Paso 2: Crea tu primera Lista de Precios
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Las listas de precios te permiten tener valores diferenciados (ej. Mayorista, Minorista, POS) sobre el precio base de tus artículos.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Nombre de la Lista
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Lista Mayorista 15%"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.875rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Descuento Automático (%)
                  </label>
                  <input
                    type="number"
                    required
                    value={discountPercent}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDiscountPercent(val);
                      setCustomListPrice(Math.round(prodBasePrice * (1 - val / 100)));
                    }}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-app)',
                      color: 'var(--brand-blue)',
                      fontWeight: 900,
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <button type="button" onClick={() => setCurrentStep(1)} className="btn-secondary" style={{ gap: '0.5rem' }}>
                  <ArrowLeft size={16} /> Atrás
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#0284c7', gap: '0.5rem' }}>
                  <Plus size={16} /> Crear Lista y Continuar <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: CREATE PRODUCT */}
          {currentStep === 3 && (
            <form onSubmit={handleStep3CreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', padding: '1.25rem', borderRadius: '0.875rem', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Barcode size={18} style={{ color: '#10b981' }} /> Paso 3: Agrega tu primer Producto al Catálogo
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Ingresa los datos esenciales del producto. Este tendrá un <strong>Precio Base (Lista 1)</strong> de referencia.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Código / EAN
                  </label>
                  <input
                    type="text"
                    required
                    value={prodCode}
                    onChange={(e) => setProdCode(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Descripción del Producto
                  </label>
                  <input
                    type="text"
                    required
                    value={prodDescription}
                    onChange={(e) => setProdDescription(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 800 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Rubro / Categoría
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  >
                    <option value="Almacén">Almacén</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Limpieza">Limpieza</option>
                    <option value="Lácteos">Lácteos</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Precio Base ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={prodBasePrice}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setProdBasePrice(val);
                      setCustomListPrice(Math.round(val * (1 - discountPercent / 100)));
                    }}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: '#10b981', fontWeight: 900 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Costo ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={prodCost}
                    onChange={(e) => setProdCost(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <button type="button" onClick={() => setCurrentStep(2)} className="btn-secondary" style={{ gap: '0.5rem' }}>
                  <ArrowLeft size={16} /> Atrás
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#10b981', gap: '0.5rem' }}>
                  <Plus size={16} /> Guardar Producto y Continuar <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: ASSIGN CUSTOM PRICE TO LIST */}
          {currentStep === 4 && (
            <form onSubmit={handleStep4AssignCustomPrice} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', padding: '1.25rem', borderRadius: '0.875rem', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={18} style={{ color: '#8b5cf6' }} /> Paso 4: Asigna el Precio Personalizado para la Lista
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Observa cómo el sistema calcula automáticamente el precio para la lista <strong>"{listName}"</strong> aplicando el {discountPercent}% de descuento. Puedes personalizar este valor.
                </p>
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-main)' }}>{prodDescription}</div>
                  <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    CÓD: <code style={{ fontWeight: 800 }}>{prodCode}</code> | Categoría: <strong>{prodCategory}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRECIO BASE (LISTA 1)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>${prodBasePrice.toFixed(2)}</div>
                  </div>

                  <div style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>→</div>

                  <div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--brand-blue)', fontWeight: 800 }}>PRECIO EN "{listName.toUpperCase()}"</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                      <span style={{ fontWeight: 900, color: 'var(--brand-blue)' }}>$</span>
                      <input
                        type="number"
                        required
                        value={customListPrice}
                        onChange={(e) => setCustomListPrice(Number(e.target.value))}
                        style={{
                          width: '110px',
                          padding: '0.4rem 0.5rem',
                          borderRadius: '0.5rem',
                          border: '1.5px solid var(--brand-blue)',
                          background: 'var(--bg-surface)',
                          color: 'var(--brand-blue)',
                          fontWeight: 900,
                          fontSize: '1rem',
                          textAlign: 'right'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <button type="button" onClick={() => setCurrentStep(3)} className="btn-secondary" style={{ gap: '0.5rem' }}>
                  <ArrowLeft size={16} /> Atrás
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#8b5cf6', gap: '0.5rem' }}>
                  <Zap size={16} /> Guardar Precio y Continuar <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: TEST POS CHECKOUT */}
          {currentStep === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', padding: '1.25rem', borderRadius: '0.875rem', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingCart size={18} style={{ color: '#0284c7' }} /> Paso 5: Simulador de Venta en Terminal POS
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Comprueba cómo la caja registradora vende automáticamente utilizando la lista de precios creada.
                </p>
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800 }}>TICKET SIMULADO — CAJA 01 EXPRESS</div>
                  <div style={{ fontSize: '0.75rem', background: 'rgba(2, 132, 199, 0.15)', color: 'var(--brand-blue)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 800 }}>
                    LISTA: {listName}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>1x {prodDescription}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CÓD: {prodCode}</div>
                  </div>
                  <div style={{ fontWeight: 900, color: 'var(--text-main)' }}>
                    ${customListPrice.toFixed(2)}
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 900, fontSize: '1rem' }}>TOTAL TICKET:</span>
                  <span style={{ fontWeight: 900, fontSize: '1.35rem', color: '#10b981' }}>${customListPrice.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <button type="button" onClick={() => setCurrentStep(4)} className="btn-secondary" style={{ gap: '0.5rem' }}>
                  <ArrowLeft size={16} /> Atrás
                </button>
                <button onClick={() => setCurrentStep(6)} className="btn-primary" style={{ background: '#0284c7', gap: '0.5rem' }}>
                  Finalizar Simulación <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: CONGRATULATIONS & SLASH COMMANDS */}
          {currentStep === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
              }}>
                <Award size={38} />
              </div>

              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  ¡Felicitaciones! Tu comercio está listo
                </h3>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', maxWidth: '560px', margin: '0 auto' }}>
                  Completaste la configuración mínima indispensable para <strong>{activeStore?.name || 'tu negocio'}</strong>. Ya tienes tu primera lista de precios, producto registrado y terminal de venta sincronizada.
                </p>
              </div>

              {/* Checklist Badges */}
              <div style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-light)',
                borderRadius: '1rem',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.875rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#10b981' }}>
                  <CheckCircle2 size={16} /> Lista "{listName}" creada
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#10b981' }}>
                  <CheckCircle2 size={16} /> Producto "{prodDescription}" en catálogo
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#10b981' }}>
                  <CheckCircle2 size={16} /> Precio ${customListPrice} asignado
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#10b981' }}>
                  <CheckCircle2 size={16} /> Terminal POS Lista
                </div>
              </div>

              {/* Slash Commands Tip */}
              <div style={{
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: '0.875rem',
                padding: '1rem 1.25rem',
                textAlign: 'left',
                fontSize: '0.8125rem',
                color: 'var(--text-main)'
              }}>
                <div style={{ fontWeight: 800, color: 'var(--brand-blue)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  💡 Recomendaciones de Slash Commands:
                </div>
                <div>
                  • Usa <code>/goal</code> para encomendar tareas complejas de larga duración.<br />
                  • Usa <code>/learn</code> si deseas personalizar o enseñar patrones de uso específicos.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  onClick={handleFinishOnboarding}
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    padding: '0.875rem 2rem',
                    fontSize: '1rem',
                    fontWeight: 900,
                    borderRadius: '9999px',
                    boxShadow: '0 8px 20px -4px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  🚀 ¡Empezar a Operar Ahora!
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
