import React, { useState, useEffect, useRef } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import { BaseModal } from './BaseModal';
import {
  Sliders,
  X,
  Printer,
  Save,
  Plus,
  Trash2,
  Move,
  Tag,
  DollarSign,
  Barcode,
  Type,
  Building,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Copy,
  Eye
} from 'lucide-react';
import { printDirectToUSB } from '../../services/ThermalPrinterService';

export interface LabelElement {
  id: string;
  type: 'barcode' | 'price' | 'description' | 'store_name' | 'code';
  label: string;
  x: number; // in mm
  y: number; // in mm
  fontSize: number; // in pt/px
  fontWeight: 'normal' | 'bold' | '900';
  textAlign: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface LabelTemplate {
  id?: string;
  name: string;
  width_mm: number;
  height_mm: number;
  elements: LabelElement[];
  is_default?: boolean;
}

const PRESET_SIZES = [
  { name: '50 x 30 mm (Góndola Estándar)', width: 50, height: 30 },
  { name: '58 x 40 mm (Supermercado / Balanza)', width: 58, height: 40 },
  { name: '80 x 50 mm (Enterprise Envíos)', width: 80, height: 50 },
  { name: 'Personalizado', width: 50, height: 30 }
];

const DEFAULT_ELEMENTS: LabelElement[] = [
  { id: 'el-store', type: 'store_name', label: 'Nombre del Comercio', x: 2, y: 3, fontSize: 10, fontWeight: 'bold', textAlign: 'center', visible: true },
  { id: 'el-desc', type: 'description', label: 'Descripción del Producto', x: 2, y: 8, fontSize: 12, fontWeight: '900', textAlign: 'center', visible: true },
  { id: 'el-price', type: 'price', label: 'Precio de Venta', x: 2, y: 15, fontSize: 20, fontWeight: '900', textAlign: 'center', visible: true },
  { id: 'el-barcode', type: 'barcode', label: 'Código de Barras', x: 5, y: 22, fontSize: 10, fontWeight: 'normal', textAlign: 'center', visible: true },
  { id: 'el-code', type: 'code', label: 'Código SKU', x: 2, y: 27, fontSize: 8, fontWeight: 'normal', textAlign: 'right', visible: false }
];

interface LabelDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LabelDesignModal: React.FC<LabelDesignModalProps> = ({ isOpen, onClose }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  // Label Dimension & Template State
  const [templateName, setTemplateName] = useState<string>('Plantilla Estándar Góndola');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [labelWidthMM, setLabelWidthMM] = useState<number>(50);
  const [labelHeightMM, setLabelHeightMM] = useState<number>(30);

  const [elements, setElements] = useState<LabelElement[]>(DEFAULT_ELEMENTS);
  const [selectedElementId, setSelectedElementId] = useState<string>('el-price');
  const [savedTemplates, setSavedTemplates] = useState<LabelTemplate[]>([]);

  // Sample Product Selection for Live Preview
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedArticleCode, setSelectedArticleCode] = useState<string>('');
  const [printQuantity, setPrintQuantity] = useState<number>(1);

  // Dragging State on Canvas
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const MM_TO_PX_SCALE = 6; // 1mm = 6px scale for editor

  // Load Store Articles & Saved Templates
  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      // 1. Fetch Articles for live preview
      let loadedProds: any[] = [];
      try {
        const rawLocal = localStorage.getItem(`pickingup_articles_${storeKey}`) || localStorage.getItem(`pickingup_prodprices_${storeKey}`);
        if (rawLocal) loadedProds = JSON.parse(rawLocal);
      } catch {}

      if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
        try {
          const { data: dbArticles } = await supabase
            .from('articles')
            .select('*')
            .eq('store_id', activeStore.id)
            .limit(50);
          if (dbArticles && dbArticles.length > 0) loadedProds = dbArticles;
        } catch {}
      }

      if (loadedProds.length === 0) {
        loadedProds = [
          { code: 'ART-1001', barcode: '7791234567890', description: 'Aceite de Girasol 900ml', price: 1250.00 },
          { code: 'ART-1002', barcode: '7799876543210', description: 'Gaseosa Cola 1.5L', price: 950.00 }
        ];
      }

      setArticles(loadedProds);
      if (loadedProds.length > 0) {
        setSelectedArticleCode(loadedProds[0].code);
      }

      // 2. Fetch Templates from Supabase & LocalStorage
      let loadedTemplates: LabelTemplate[] = [];
      try {
        const rawTpls = localStorage.getItem(`pickingup_label_templates_${storeKey}`);
        if (rawTpls) loadedTemplates = JSON.parse(rawTpls);
      } catch {}

      if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
        try {
          const { data: dbTemplates } = await supabase
            .from('label_templates')
            .select('*')
            .eq('store_id', activeStore.id);

          if (dbTemplates && dbTemplates.length > 0) {
            loadedTemplates = dbTemplates.map(t => ({
              id: t.id,
              name: t.name,
              width_mm: Number(t.width_mm) || 50,
              height_mm: Number(t.height_mm) || 30,
              elements: t.elements || DEFAULT_ELEMENTS,
              is_default: Boolean(t.is_default)
            }));
          }
        } catch {}
      }

      setSavedTemplates(loadedTemplates);
    };

    loadInitialData();
  }, [isOpen, activeStore]);

  if (!isOpen) return null;

  const currentArticle = articles.find(a => a.code === selectedArticleCode) || {
    code: 'ART-1001',
    barcode: '7791234567890',
    description: 'Producto Ejemplo 500g',
    price: 1250.00
  };

  const selectedElement = elements.find(e => e.id === selectedElementId);

  // Preset Selection Handler
  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    const preset = PRESET_SIZES[idx];
    setLabelWidthMM(preset.width);
    setLabelHeightMM(preset.height);
  };

  // Update Selected Element Attribute
  const updateSelectedElement = (key: keyof LabelElement, val: any) => {
    if (!selectedElementId) return;
    setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, [key]: val } : el));
  };

  // Drag and Drop Canvas Interaction
  const handleCanvasMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    setSelectedElementId(elementId);
    setIsDragging(true);

    const targetEl = elements.find(el => el.id === elementId);
    if (targetEl && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickXMM = (e.clientX - rect.left) / MM_TO_PX_SCALE;
      const clickYMM = (e.clientY - rect.top) / MM_TO_PX_SCALE;
      setDragOffset({
        x: clickXMM - targetEl.x,
        y: clickYMM - targetEl.y
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElementId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const currentXMM = (e.clientX - rect.left) / MM_TO_PX_SCALE - dragOffset.x;
    const currentYMM = (e.clientY - rect.top) / MM_TO_PX_SCALE - dragOffset.y;

    const clampedX = Math.max(0, Math.min(labelWidthMM - 10, Math.round(currentXMM * 10) / 10));
    const clampedY = Math.max(0, Math.min(labelHeightMM - 5, Math.round(currentYMM * 10) / 10));

    setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, x: clampedX, y: clampedY } : el));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  // Save Template to Supabase & LocalStorage
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('Ingresá un nombre para la plantilla de etiqueta.');
      return;
    }

    const newTpl: LabelTemplate = {
      name: templateName.trim(),
      width_mm: labelWidthMM,
      height_mm: labelHeightMM,
      elements
    };

    const updatedTemplates = [newTpl, ...savedTemplates.filter(t => t.name !== newTpl.name)];
    setSavedTemplates(updatedTemplates);
    try {
      localStorage.setItem(`pickingup_label_templates_${storeKey}`, JSON.stringify(updatedTemplates));
    } catch {}

    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        await supabase.from('label_templates').upsert({
          store_id: activeStore.id,
          name: newTpl.name,
          width_mm: newTpl.width_mm,
          height_mm: newTpl.height_mm,
          elements: newTpl.elements,
          is_default: true
        }, { onConflict: 'store_id,name' });
      } catch (err) {
        console.error('Error saving label template to DB:', err);
      }
    }

    addNotification({
      title: 'Plantilla Guardada',
      message: `La plantilla de etiqueta "${newTpl.name}" (${labelWidthMM}x${labelHeightMM}mm) se guardó con éxito.`,
      type: 'success'
    });
  };

  // Direct Print Labels via Thermal Printer Service or Window Print
  const handlePrintLabels = async () => {
    addNotification({
      title: 'Enviando a Impresora Térmica',
      message: `Imprimiendo ${printQuantity} etiqueta(s) para "${currentArticle.description}".`,
      type: 'info'
    });

    // 1. Try Direct USB Print via ThermalPrinterService
    try {
      const usbSuccess = await printDirectToUSB({
        ticketNumber: 'ETIQ-001',
        date: new Date().toLocaleDateString('es-AR'),
        storeName: activeStore?.name || 'Comercio',
        registerName: 'Impresora Etiquetas',
        cashierName: 'Operador',
        customerName: '',
        invoiceType: '',
        cuit: '',
        items: [{
          description: currentArticle.description,
          qty: printQuantity,
          unitPrice: Number(currentArticle.price) || 0,
          subtotal: Number(currentArticle.price) || 0
        }],
        priceListName: 'Lista Base',
        rawSubtotal: Number(currentArticle.price) || 0,
        discountAmount: 0,
        discountPercent: 0,
        finalTotal: Number(currentArticle.price) || 0,
        paymentMethod: 'Efectivo',
        cashGiven: 0,
        changeDue: 0
      });

      if (usbSuccess) return;
    } catch {}

    // 2. Fallback to Browser Label Window Printing
    const printWin = window.open('', '_blank', 'width=600,height=600');
    if (!printWin) return;

    const labelHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impresión de Etiqueta - ${currentArticle.code}</title>
          <style>
            @page { size: ${labelWidthMM}mm ${labelHeightMM}mm; margin: 0; }
            body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
            .label-box {
              width: ${labelWidthMM}mm;
              height: ${labelHeightMM}mm;
              position: relative;
              box-sizing: border-box;
              overflow: hidden;
              page-break-after: always;
            }
          </style>
        </head>
        <body>
          ${Array.from({ length: printQuantity }).map(() => `
            <div class="label-box">
              ${elements.filter(e => e.visible).map(e => {
                let content = '';
                if (e.type === 'store_name') content = activeStore?.name || 'PickingUp! Comercio';
                else if (e.type === 'description') content = currentArticle.description;
                else if (e.type === 'price') content = `$${(Number(currentArticle.price) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                else if (e.type === 'barcode') content = `||| | |||| ||| ${currentArticle.barcode || currentArticle.code}`;
                else if (e.type === 'code') content = `SKU: ${currentArticle.code}`;

                return `
                  <div style="
                    position: absolute;
                    left: ${e.x}mm;
                    top: ${e.y}mm;
                    font-size: ${e.fontSize}pt;
                    font-weight: ${e.fontWeight};
                    text-align: ${e.textAlign};
                    font-family: ${e.type === 'barcode' ? 'monospace' : 'inherit'};
                    line-height: 1.1;
                  ">
                    ${content}
                  </div>
                `;
              }).join('')}
            </div>
          `).join('')}
          <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
        </body>
      </html>
    `;

    printWin.document.write(labelHTML);
    printWin.document.close();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '1100px',
        maxHeight: '92vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
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
              <Sliders size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, color: '#ffffff' }}>
                Editor Visual de Diseño de Etiquetas (diseno-etiquetas)
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', margin: '2px 0 0 0' }}>
                Posicioná elementos en tiempo real e imprimí directo a impresoras térmicas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
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

        {/* Editor Main Content: Canvas & Sidebar Controls */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left Panel: Interactive Visual Canvas */}
          <div
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            style={{
              flex: 1,
              padding: '1.5rem',
              background: 'var(--bg-app)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              overflow: 'auto'
            }}
          >
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Lienzo de Etiqueta: <span style={{ color: '#e11d48' }}>{labelWidthMM} x {labelHeightMM} mm</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                (Arrastrá los elementos para posicionar)
              </span>
            </div>

            {/* Interactive Thermal Label Canvas Box */}
            <div
              ref={canvasRef}
              style={{
                width: `${labelWidthMM * MM_TO_PX_SCALE}px`,
                height: `${labelHeightMM * MM_TO_PX_SCALE}px`,
                background: '#ffffff',
                border: '2px dashed #e11d48',
                borderRadius: '0.5rem',
                position: 'relative',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden'
              }}
            >
              {elements.filter(el => el.visible).map(el => {
                const isSelected = el.id === selectedElementId;
                let contentText = '';
                if (el.type === 'store_name') contentText = activeStore?.name || 'PickingUp! Comercio';
                else if (el.type === 'description') contentText = currentArticle.description;
                else if (el.type === 'price') contentText = `$${(Number(currentArticle.price) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                else if (el.type === 'barcode') contentText = `||| | |||| ||| ${currentArticle.barcode || currentArticle.code}`;
                else if (el.type === 'code') contentText = `SKU: ${currentArticle.code}`;

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleCanvasMouseDown(e, el.id)}
                    style={{
                      position: 'absolute',
                      left: `${el.x * MM_TO_PX_SCALE}px`,
                      top: `${el.y * MM_TO_PX_SCALE}px`,
                      fontSize: `${el.fontSize * 1.3}px`,
                      fontWeight: el.fontWeight,
                      textAlign: el.textAlign,
                      color: isSelected ? '#e11d48' : '#000000',
                      border: isSelected ? '1px dashed #e11d48' : '1px transparent solid',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      background: isSelected ? 'rgba(225, 29, 72, 0.08)' : 'transparent',
                      cursor: 'move',
                      fontFamily: el.type === 'barcode' ? 'monospace' : 'inherit',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {contentText}
                  </div>
                );
              })}
            </div>

            {/* Live Sample Product Controls */}
            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-surface)', padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
              <Eye size={16} style={{ color: '#e11d48' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)' }}>Previsualizar Producto:</span>
              <select
                value={selectedArticleCode}
                onChange={(e) => setSelectedArticleCode(e.target.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '0.8125rem',
                  fontWeight: 600
                }}
              >
                {articles.map(a => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.description} (${(Number(a.price) || 0).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Panel: Controls & Settings */}
          <div style={{
            width: '380px',
            borderLeft: '1px solid var(--border-light)',
            background: 'var(--bg-surface)',
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>

            {/* Preset Label Size Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.375rem' }}>
                Medida de Etiqueta Térmica:
              </label>
              <select
                value={selectedPresetIndex}
                onChange={(e) => handleSelectPreset(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '0.8125rem',
                  fontWeight: 700
                }}
              >
                {PRESET_SIZES.map((p, idx) => (
                  <option key={idx} value={idx}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Custom Dimension Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Ancho (mm)</label>
                <input
                  type="number"
                  value={labelWidthMM}
                  onChange={(e) => setLabelWidthMM(Number(e.target.value) || 50)}
                  style={{ width: '100%', padding: '0.375rem', borderRadius: '0.375rem', border: '1px solid var(--border-light)', fontSize: '0.8125rem', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Alto (mm)</label>
                <input
                  type="number"
                  value={labelHeightMM}
                  onChange={(e) => setLabelHeightMM(Number(e.target.value) || 30)}
                  style={{ width: '100%', padding: '0.375rem', borderRadius: '0.375rem', border: '1px solid var(--border-light)', fontSize: '0.8125rem', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Element Inspector & Editor Controls */}
            {selectedElement && (
              <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 900, color: '#e11d48', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Type size={16} /> Ajustar: {selectedElement.label}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tamaño de Fuente ({selectedElement.fontSize} pt)</label>
                    <input
                      type="range"
                      min="6"
                      max="36"
                      value={selectedElement.fontSize}
                      onChange={(e) => updateSelectedElement('fontSize', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Posición X (mm)</label>
                      <input
                        type="number"
                        value={selectedElement.x}
                        onChange={(e) => updateSelectedElement('x', Number(e.target.value))}
                        style={{ width: '100%', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-light)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Posición Y (mm)</label>
                      <input
                        type="number"
                        value={selectedElement.y}
                        onChange={(e) => updateSelectedElement('y', Number(e.target.value))}
                        style={{ width: '100%', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-light)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedElement.fontWeight === '900' || selectedElement.fontWeight === 'bold'}
                        onChange={(e) => updateSelectedElement('fontWeight', e.target.checked ? '900' : 'normal')}
                      /> Negrita / Destacado
                    </label>

                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedElement.visible}
                        onChange={(e) => updateSelectedElement('visible', e.target.checked)}
                      /> Visible
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Template Save Section */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.375rem' }}>
                Guardar Plantilla:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Nombre de la plantilla"
                  style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', fontSize: '0.8125rem' }}
                />
                <button
                  onClick={handleSaveTemplate}
                  style={{
                    background: '#e11d48',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.875rem',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Save size={15} /> Guardar
                </button>
              </div>
            </div>

            {/* Print Quantity & Action Button */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)' }}>Cantidad de Copias:</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={printQuantity}
                  onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ width: '70px', padding: '0.375rem', borderRadius: '0.375rem', border: '1px solid var(--border-light)', textAlign: 'center', fontWeight: 800 }}
                />
              </div>

              <button
                onClick={handlePrintLabels}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  padding: '0.75rem',
                  fontWeight: 900,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                <Printer size={18} /> Imprimir Etiquetas ({printQuantity})
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
