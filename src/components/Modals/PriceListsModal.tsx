import React, { useState, useEffect, useRef } from 'react';
import { supabase, isValidUUID } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { BaseModal } from './BaseModal';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  DollarSign,
  List,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  CheckSquare,
  Square,
  ArrowUpDown,
  Sparkles
} from 'lucide-react';

const AIPriceRecommendationsModal = React.lazy(() => import('./AIPriceRecommendationsModal').then(m => ({ default: m.AIPriceRecommendationsModal })));

export interface PriceList {
  id: string;
  code: number;
  name: string;
  type: 'normal' | 'porcentual';
  discount_percent: number;
  base_list_name?: string;
  generate_labels: boolean;
  visible_in_pos: boolean;
  round_prices: boolean;
  is_default?: boolean;
}

interface PriceListsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ProductPriceItem {
  code: string;
  description: string;
  category: string;
  base_price: number;
  custom_prices: Record<string, number>;
}

const DEFAULT_PRICE_LISTS: PriceList[] = [];

export const PriceListsModal: React.FC<PriceListsModalProps> = ({ isOpen, onClose }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();

  const [priceLists, setPriceLists] = useState<PriceList[]>(DEFAULT_PRICE_LISTS);
  const [priceListSortBy, setPriceListSortBy] = useState<'CODE_ASC' | 'NAME_ASC' | 'NAME_DESC' | 'DISCOUNT_DESC'>('CODE_ASC');
  const [editingList, setEditingList] = useState<Partial<PriceList> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  // Storage key for per-store persistence
  const storeKey = activeStore?.id || 'demo-store';

  // Load price lists and items from Supabase & localStorage
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      // 1. Try local cache
      try {
        const rawLists = localStorage.getItem(`pickingup_pricelists_${storeKey}`);
        if (rawLists) setPriceLists(JSON.parse(rawLists));
      } catch {
        // ignore
      }

      // 2. Fetch from Supabase if logged in
      if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
        try {
          const { data, error } = await supabase
            .from('price_lists')
            .select('*')
            .eq('store_id', activeStore.id)
            .order('code', { ascending: true });

          if (!error && data && data.length > 0) {
            const mapped: PriceList[] = data.map(d => ({
              id: d.id,
              code: d.code,
              name: d.name,
              type: d.type === 'porcentual' ? 'porcentual' : 'normal',
              discount_percent: Number(d.discount_percent) || 0,
              base_list_name: d.base_list_name,
              generate_labels: Boolean(d.generate_labels),
              visible_in_pos: Boolean(d.visible_in_pos),
              round_prices: d.round_prices ?? true,
              is_default: Boolean(d.is_default)
            }));
            setPriceLists(mapped);
          }
        } catch (err) {
          console.error('Error fetching price_lists from DB:', err);
        }
      }
    };

    loadData();
  }, [isOpen, activeStore, user, isDemoMode]);

  const saveListsToStorage = (updated: PriceList[]) => {
    setPriceLists(updated);
    try {
      localStorage.setItem(`pickingup_pricelists_${storeKey}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };


  // Create or Update Price List
  const handleSavePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList || !editingList.name) return;

    let updated: PriceList[];

    if (editingList.id) {
      // Update
      updated = priceLists.map(l => l.id === editingList.id ? { ...l, ...editingList } as PriceList : l);
    } else {
      // Create new
      const nextCode = priceLists.length > 0 ? Math.max(...priceLists.map(l => l.code)) + 1 : 1;
      const newList: PriceList = {
        id: `list-${Date.now()}`,
        code: editingList.code || nextCode,
        name: editingList.name.toUpperCase(),
        type: editingList.type || 'normal',
        discount_percent: editingList.discount_percent || 0,
        base_list_name: editingList.type === 'porcentual' ? (editingList.base_list_name || priceLists[0]?.name) : undefined,
        generate_labels: editingList.generate_labels ?? true,
        visible_in_pos: editingList.visible_in_pos ?? true,
        round_prices: editingList.round_prices ?? false,
        is_default: false
      };
      updated = [...priceLists, newList];
    }

    saveListsToStorage(updated);

    // Save to Supabase DB if logged in
    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        await supabase.from('price_lists').upsert({
          store_id: activeStore.id,
          code: editingList.code || (priceLists.length + 1),
          name: editingList.name.toUpperCase(),
          type: editingList.type || 'normal',
          discount_percent: editingList.discount_percent || 0,
          base_list_name: editingList.base_list_name,
          generate_labels: editingList.generate_labels ?? true,
          visible_in_pos: editingList.visible_in_pos ?? true,
          round_prices: editingList.round_prices ?? false
        });
      } catch (err) {
        console.error('Error persisting price_list in DB:', err);
      }
    }

    setEditingList(null);
    setIsCreatingNew(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Template & Full Catalog CSV Download
  const handleDownloadTemplate = () => {
    // 1. Load existing articles from local cache
    let existingProds: any[] = [];
    try {
      const rawProds = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawProds) {
        existingProds = JSON.parse(rawProds);
      }
    } catch {}

    const secondaryLists = priceLists.filter(l => l.name.toUpperCase() !== 'LISTA BASE');
    const listHeaders = secondaryLists.map(l => l.name).join(';');
    const headerLine = `Código;Descripción;Categoría;Precio Base${listHeaders ? ';' + listHeaders : ''}`;

    let rows: string[] = [headerLine];

    if (existingProds && existingProds.length > 0) {
      for (const prod of existingProds) {
        const baseP = prod.base_price !== undefined ? Number(prod.base_price).toFixed(2) : (prod.price !== undefined ? Number(prod.price).toFixed(2) : '0.00');
        const secPrices = secondaryLists.map(l => {
          const customP = prod.custom_prices?.[l.id] || prod.custom_prices?.[l.name];
          return customP !== undefined && customP !== null ? Number(customP).toFixed(2) : '';
        }).join(';');

        rows.push(`${prod.code || ''};${prod.description || ''};${prod.category || 'General'};${baseP}${secPrices ? ';' + secPrices : ''}`);
      }
    } else {
      // Clean template rows if no products exist yet
      rows.push("ART-001;Ejemplo Producto 1;General;100.00");
    }

    const csvContent = "\uFEFF" + rows.join('\n') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Plantilla_Productos_Precios_${activeStore?.slug || 'comercio'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV/Excel file import handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          alert('El archivo no contiene filas de datos.');
          return;
        }

        // Auto detect delimiter (; or , or \t)
        const headerLine = lines[0];
        const delimiter = headerLine.includes(';') ? ';' : (headerLine.includes('\t') ? '\t' : ',');
        const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

        // Header 0: Código, 1: Descripción, 2: Categoría, 3: Precio Base
        const customListHeaders = headers.slice(4);

        // Ensure price lists exist or create them
        const newLists: PriceList[] = [...priceLists];
        const headerToListId: Record<string, string> = {};

        customListHeaders.forEach((listName, idx) => {
          if (!listName) return;
          let existing = newLists.find(l => l.name.toLowerCase() === listName.toLowerCase());
          if (!existing) {
            const nextCode = newLists.length > 0 ? Math.max(...newLists.map(l => l.code)) + 1 : idx + 1;
            existing = {
              id: `list-${Date.now()}-${idx}`,
              code: nextCode,
              name: listName.toUpperCase(),
              type: 'normal',
              discount_percent: 0,
              generate_labels: true,
              visible_in_pos: true,
              round_prices: true
            };
            newLists.push(existing);
          }
          headerToListId[listName] = existing.id;
        });

        saveListsToStorage(newLists);

        // Process products
        const importedProds: ProductPriceItem[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (!cols[0] && !cols[1]) continue;

          const code = cols[0] || `ART-${Date.now()}-${i}`;
          const description = cols[1] || 'Producto sin descripción';
          const category = cols[2] || 'General';
          const basePrice = parseFloat(cols[3]?.replace(',', '.')) || 0;

          const customPrices: Record<string, number> = {};
          customListHeaders.forEach((headerName, hIdx) => {
            const listId = headerToListId[headerName];
            if (listId) {
              const val = parseFloat(cols[4 + hIdx]?.replace(',', '.'));
              customPrices[listId] = isNaN(val) ? basePrice : val;
            }
          });

          importedProds.push({
            code,
            description,
            category,
            base_price: basePrice,
            custom_prices: customPrices
          });
        }

        // Persist to localStorage
        try {
          localStorage.setItem(`pickingup_prodprices_${storeKey}`, JSON.stringify(
            importedProds.map(p => ({
              code: p.code,
              description: p.description,
              category: p.category,
              base_price: p.base_price,
              custom_prices: p.custom_prices
            }))
          ));
        } catch { /* ignore */ }

        // Persist to Supabase DB if logged in
        if (user && !isDemoMode && activeStore) {
          for (const list of newLists) {
            await supabase.from('price_lists').upsert({
              store_id: activeStore.id,
              code: list.code,
              name: list.name,
              type: list.type,
              discount_percent: list.discount_percent,
              generate_labels: list.generate_labels,
              visible_in_pos: list.visible_in_pos,
              round_prices: list.round_prices
            });
          }

          for (const prod of importedProds) {
            await supabase.from('articles').upsert({
              store_id: activeStore.id,
              code: prod.code,
              description: prod.description,
              category: prod.category,
              price: prod.base_price
            });
          }
        }

        setImportStatus(`¡Éxito! Se cargaron ${importedProds.length} productos y ${newLists.length} listas de precios.`);
        setTimeout(() => setImportStatus(null), 6000);
      } catch (err) {
        console.error('Error importing CSV/Excel:', err);
        alert('Error al leer el archivo. Verificá que las columnas sean: Código, Descripción, Categoría, Precio Base, Lista 1...');
      }
    };

    reader.readAsText(file, 'UTF-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeletePriceList = async (id: string) => {
    const target = priceLists.find(l => l.id === id);
    const updated = priceLists.filter(l => l.id !== id);
    saveListsToStorage(updated);

    if (user && !isDemoMode && activeStore && target) {
      try {
        await supabase
          .from('price_lists')
          .delete()
          .eq('store_id', activeStore.id)
          .eq('code', target.code);
      } catch {
        // ignore
      }
    }
  };

  if (!isOpen) return null;

  const sortedPriceLists = [...priceLists].sort((a, b) => {
    if (priceListSortBy === 'NAME_ASC') {
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    }
    if (priceListSortBy === 'NAME_DESC') {
      return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
    }
    if (priceListSortBy === 'DISCOUNT_DESC') {
      return (Number(b.discount_percent) || 0) - (Number(a.discount_percent) || 0);
    }
    return (Number(a.code) || 0) - (Number(b.code) || 0);
  });

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
        maxWidth: '1000px',
        maxHeight: '90vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Top Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
          color: '#ffffff'
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
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <DollarSign size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                  Gestión de Listas de Precios
                </h3>
                <span style={{
                  fontSize: '0.7rem',
                  background: 'rgba(255, 255, 255, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontWeight: 800
                }}>
                  {activeStore?.name || 'Comercio Activo'}
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', margin: '2px 0 0 0' }}>
                Configurá múltiples listas de precios independientes y asigná valores por producto
              </p>
            </div>
          </div>

          <button
            id="btn-close-price-lists-modal"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
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

        {/* Modal Action Toolbar */}
        <div style={{
          padding: '0.875rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Listas Activas: <strong style={{ color: 'var(--text-main)' }}>{sortedPriceLists.length}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Sort Order Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowUpDown size={14} /> Ordenar:
              </span>
              <select
                id="select-listas-orden"
                value={priceListSortBy}
                onChange={(e) => setPriceListSortBy(e.target.value as any)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #6366f1',
                  background: 'rgba(99, 102, 241, 0.08)',
                  color: '#4f46e5',
                  fontWeight: 800,
                  fontSize: '0.8125rem'
                }}
              >
                <option value="CODE_ASC">🔢 Código Predeterminado</option>
                <option value="NAME_ASC">🔤 Nombre Lista (A-Z)</option>
                <option value="NAME_DESC">🔤 Nombre Lista (Z-A)</option>
                <option value="DISCOUNT_DESC">💲 Mayor Descuento %</option>
              </select>
            </div>

            <button
              onClick={() => setShowAIModal(true)}
              title="Obtener sugerencias inteligentes de precios impulsadas por IA"
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)',
                color: '#ffffff',
                fontSize: '0.78125rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
              }}
            >
              <Sparkles size={15} style={{ color: '#38bdf8' }} /> Asistente IA Precios
            </button>

            <button
              onClick={handleDownloadTemplate}
              title="Descargar plantilla CSV con todos los artículos y precios"
              style={{
                padding: '0.4rem 0.875rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: '0.78125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <FileSpreadsheet size={15} style={{ color: 'var(--brand-blue)' }} /> Planilla CSV
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Importar lista inicial de productos y precios desde Excel o CSV"
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontSize: '0.78125rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Upload size={15} /> Cargar Excel / CSV
            </button>
          </div>
        </div>

        {importStatus && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            padding: '0.625rem 1.5rem',
            fontSize: '0.8125rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Check size={16} /> {importStatus}
          </div>
        )}

        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Administrá los tipos de lista (General, Mayorista, Empleados, Especial Picking UP)
              </span>

              <button
                id="btn-new-price-list"
                onClick={() => {
                  setEditingList({
                    name: '',
                    type: 'normal',
                    discount_percent: 0,
                    generate_labels: true,
                    visible_in_pos: true
                  });
                  setIsCreatingNew(true);
                }}
                style={{
                  background: 'var(--brand-blue)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.625rem',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <Plus size={16} /> Nueva Lista de Precios
              </button>
            </div>

            {/* Form modal for creating/editing list */}
            {(isCreatingNew || editingList) && (
              <form onSubmit={handleSavePriceList} style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                padding: '1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <h4 id="form-title-price-list" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {editingList?.id ? 'Editar Lista de Precios' : 'Crear Nueva Lista de Precios'}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Descripción de la Lista *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: LISTA MAYORISTA 2"
                      value={editingList?.name || ''}
                      onChange={(e) => setEditingList(prev => ({ ...prev, name: e.target.value }))}
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
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Tipo de Lista
                    </label>
                    <select
                      value={editingList?.type || 'normal'}
                      onChange={(e) => setEditingList(prev => ({ ...prev, type: e.target.value as any }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="normal">NORMAL (Precios Fijos Directos)</option>
                      <option value="porcentual">PORCENTUAL (Descuento sobre Base)</option>
                    </select>
                  </div>

                  {editingList?.type === 'porcentual' && (
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        % Descuento Aplicado (Ej: -10)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="-10"
                        value={editingList?.discount_percent || 0}
                        onChange={(e) => setEditingList(prev => ({ ...prev, discount_percent: parseFloat(e.target.value) || 0 }))}
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
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editingList?.generate_labels ?? true}
                      onChange={(e) => setEditingList(prev => ({ ...prev, generate_labels: e.target.checked }))}
                    />
                    Generar Etiquetas al Modificar
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editingList?.visible_in_pos ?? true}
                      onChange={(e) => setEditingList(prev => ({ ...prev, visible_in_pos: e.target.checked }))}
                    />
                    Visible en Cajas (POS)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', color: 'var(--brand-blue)' }}>
                    <input
                      type="checkbox"
                      checked={editingList?.round_prices ?? false}
                      onChange={(e) => setEditingList(prev => ({ ...prev, round_prices: e.target.checked }))}
                    />
                    🔢 Redondear Precios (sin decimales)
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingList(null);
                      setIsCreatingNew(false);
                    }}
                    style={{
                      padding: '0.4rem 1rem',
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
                    id="form-submit-price-list"
                    type="submit"
                    style={{
                      padding: '0.4rem 1.25rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: 'var(--brand-blue)',
                      color: '#ffffff',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Guardar Lista
                  </button>
                </div>
              </form>
            )}

            {/* Table of Price Lists */}
            <div style={{
              border: '1px solid var(--border-light)',
              borderRadius: '0.875rem',
              overflow: 'hidden',
              background: 'var(--bg-surface)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                    color: '#ffffff',
                    fontWeight: 800
                  }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Descripción</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Tipo</th>
                    <th style={{ padding: '0.75rem 1rem' }}>% Descuento</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Lista Base</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Redondeo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Etiquetas</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Visible en Caja</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPriceLists.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <FileSpreadsheet size={36} style={{ color: 'var(--brand-blue)', marginBottom: '0.5rem' }} />
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>No tenés listas de precios creadas todavía</div>
                        <p style={{ fontSize: '0.8125rem', marginTop: '4px', marginBottom: '1rem' }}>
                          Podés crear una nueva manualmente o cargar una planilla CSV/Excel con tus productos y precios.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                          <button
                            onClick={() => {
                              setEditingList({ name: '', type: 'normal', discount_percent: 0, generate_labels: true, visible_in_pos: true, round_prices: true });
                              setIsCreatingNew(true);
                            }}
                            style={{
                              padding: '0.45rem 1rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              background: 'var(--brand-blue)',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.8125rem',
                              cursor: 'pointer'
                            }}
                          >
                            + Crear Primera Lista
                          </button>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              padding: '0.45rem 1rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              background: '#10b981',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.8125rem',
                              cursor: 'pointer'
                            }}
                          >
                            📤 Cargar Excel / CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedPriceLists.map((list, idx) => (
                      <tr
                        key={list.id}
                        style={{
                          borderBottom: idx === sortedPriceLists.length - 1 ? 'none' : '1px solid var(--border-light)',
                          background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-app)'
                        }}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                          {list.code}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {list.name}
                          {list.is_default && (
                            <span style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.65rem',
                              background: 'var(--brand-light-bg)',
                              color: 'var(--brand-blue)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 800
                            }}>
                              PRINCIPAL
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontWeight: 700 }}>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: list.type === 'porcentual' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: list.type === 'porcentual' ? '#d97706' : '#2563eb',
                            fontWeight: 800
                          }}>
                            {list.type}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: list.discount_percent < 0 ? '#dc2626' : 'var(--text-muted)' }}>
                          {list.discount_percent ? `${list.discount_percent}%` : '-'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                          {list.base_list_name || '-'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.6875rem',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: list.round_prices ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: list.round_prices ? '#10b981' : '#64748b',
                            fontWeight: 800
                          }}>
                            {list.round_prices ? 'Sin decimales' : 'Con decimales'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {list.generate_labels ? <CheckSquare size={16} style={{ color: '#10b981' }} /> : <Square size={16} style={{ color: 'var(--text-muted)' }} />}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {list.visible_in_pos ? <CheckSquare size={16} style={{ color: '#10b981' }} /> : <Square size={16} style={{ color: 'var(--text-muted)' }} />}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              onClick={() => {
                                setEditingList(list);
                                setIsCreatingNew(true);
                              }}
                              title="Editar Lista"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--brand-blue)',
                                cursor: 'pointer',
                                padding: '2px'
                              }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeletePriceList(list.id)}
                              title="Eliminar Lista"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '2px'
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
            <span>Los cambios de precios por lista se guardan en tiempo real para {activeStore?.name || 'su negocio'}.</span>
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

      {showAIModal && (
        <React.Suspense fallback={null}>
          <AIPriceRecommendationsModal
            isOpen={true}
            onClose={() => setShowAIModal(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
