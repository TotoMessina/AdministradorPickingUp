import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import {
  X,
  Box,
  Plus,
  Trash2,
  Save,
  Search,
  History,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Tag,
  Calendar,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  Filter,
  PackageCheck
} from 'lucide-react';

interface InventoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPriceLists?: () => void;
}

interface MovementLineItem {
  id: string;
  code: string;
  barcode: string;
  description: string;
  category: string;
  currentStock: number;
  qty: number;
  unitType: 'Unidades' | 'Bultos' | 'Cajas';
}

interface HistoricalMovement {
  id: string;
  movementType: 'Ingreso' | 'Egreso' | 'Ajuste de Stock' | 'Transferencia';
  date: string;
  transferDestination?: string;
  observations: string;
  totalUnits: number;
  itemsCount: number;
  items: MovementLineItem[];
}

export const InventoryManagementModal: React.FC<InventoryManagementModalProps> = ({ isOpen, onClose, onOpenPriceLists }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  const [activeTab, setActiveTab] = useState<'admin' | 'history'>('admin');
  const [loading, setLoading] = useState(false);
  const [catalogArticles, setCatalogArticles] = useState<any[]>([]);

  // Suggestion prompt state after Ingreso
  const [showPricePromptModal, setShowPricePromptModal] = useState(false);

  // Movement Form Header State
  const [movementType, setMovementType] = useState<'Ingreso' | 'Egreso' | 'Ajuste de Stock' | 'Transferencia'>('Ingreso');
  const [warehouseDestination, setWarehouseDestination] = useState('');
  const [observations, setObservations] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<MovementLineItem[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Historical Movements
  const [historyList, setHistoryList] = useState<HistoricalMovement[]>([]);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<HistoricalMovement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCatalogAndPriceLists();
      loadMovementHistory();
      if (lineItems.length === 0) {
        addNewLine();
      }
    }
  }, [isOpen, activeStore]);

  const loadCatalogAndPriceLists = async () => {
    // Catalog Articles
    let articles: any[] = [];
    try {
      const rawProds = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawProds) {
        articles = JSON.parse(rawProds);
      }
    } catch {}

    if (user && !isDemoMode && activeStore) {
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('store_id', activeStore.id);

        if (!error && data && data.length > 0) {
          articles = data;
        }
      } catch {}
    }

    setCatalogArticles(articles);
  };

  const loadMovementHistory = async () => {
    // Load local history cache
    const rawLocalHistory = localStorage.getItem(`pickingup_inventory_history_${storeKey}`);
    if (rawLocalHistory) {
      try {
        setHistoryList(JSON.parse(rawLocalHistory));
      } catch {}
    }

    // Load from Supabase DB if logged in
    if (user && !isDemoMode && activeStore?.isRealDbStore && isValidUUID(activeStore.id)) {
      try {
        const { data, error } = await supabase
          .from('stock_movements')
          .select('*, stock_movement_items(*)')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: HistoricalMovement[] = data.map(d => {
            const rawItems = d.stock_movement_items || [];
            const mappedItems: MovementLineItem[] = rawItems.map((smi: any) => ({
              id: smi.id,
              code: smi.article_code,
              barcode: smi.article_code,
              description: smi.article_description,
              category: 'General',
              currentStock: 0,
              qty: Number(smi.qty) || 1,
              unitType: 'Unidades'
            }));

            return {
              id: d.id,
              movementType: d.movement_type as any,
              date: new Date(d.created_at).toLocaleString('es-AR'),
              observations: d.observations || '',
              totalUnits: Number(d.total_units) || (mappedItems.length > 0 ? mappedItems.reduce((acc, i) => acc + i.qty, 0) : 0),
              itemsCount: mappedItems.length > 0 ? mappedItems.length : 1,
              items: mappedItems
            };
          });
          setHistoryList(mapped);
        }
      } catch (err) {
        console.error('Error fetching movement history with items:', err);
      }
    }
  };

  const addNewLine = (initialArt?: any) => {
    const newItem: MovementLineItem = {
      id: `line-${Date.now()}-${Math.random()}`,
      code: initialArt?.code || '',
      barcode: initialArt?.barcode || initialArt?.code || '',
      description: initialArt?.description || '',
      category: initialArt?.category || 'General',
      currentStock: initialArt?.stock !== undefined ? initialArt.stock : 0,
      qty: 1,
      unitType: 'Unidades'
    };
    setLineItems(prev => [...prev, newItem]);
  };

  const handleUpdateLine = (id: string, field: keyof MovementLineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleArticleSearch = (lineId: string, searchVal: string, searchField: 'code' | 'barcode' | 'description') => {
    if (!searchVal.trim()) return;

    const trimmed = searchVal.trim().toLowerCase();
    const matched = catalogArticles.find(a => {
      if (searchField === 'code') {
        return a.code?.toLowerCase() === trimmed || a.barcode?.toLowerCase() === trimmed;
      }
      if (searchField === 'barcode') {
        return a.barcode?.toLowerCase() === trimmed || a.code?.toLowerCase() === trimmed;
      }
      if (searchField === 'description') {
        return a.description?.toLowerCase() === trimmed || a.description?.toLowerCase().includes(trimmed);
      }
      return false;
    });

    if (matched) {
      setLineItems(prev => prev.map(item => {
        if (item.id === lineId) {
          const stock = matched.stock !== undefined ? matched.stock : 0;
          return {
            ...item,
            code: matched.code || item.code,
            barcode: matched.barcode || matched.code || item.barcode,
            description: matched.description || item.description,
            category: matched.category || 'General',
            currentStock: stock
          };
        }
        return item;
      }));
    } else {
      setLineItems(prev => prev.map(item => {
        if (item.id === lineId) {
          return { ...item, currentStock: 0 };
        }
        return item;
      }));
    }
  };

  const handleRemoveLine = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveMovement = async () => {
    const validLines = lineItems.filter(l => l.description.trim() !== '');
    if (validLines.length === 0) {
      alert('Por favor agregá al menos un artículo válido con descripción.');
      return;
    }

    setLoading(true);
    const totalUnits = validLines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
    const movementDate = new Date().toLocaleString('es-AR');

    // 1. Update or Insert Articles into Catalog
    let updatedCatalog = [...catalogArticles];
    let newArticlesCount = 0;

    for (const line of validLines) {
      const matchIdx = updatedCatalog.findIndex(a =>
        (line.code && a.code.toLowerCase() === line.code.toLowerCase()) ||
        (line.description && a.description.toLowerCase() === line.description.toLowerCase())
      );

      if (matchIdx >= 0) {
        // Article exists: update stock according to movement type
        const existing = updatedCatalog[matchIdx];
        const currentStock = existing.stock !== undefined ? existing.stock : 0;
        let newStock = currentStock;

        if (movementType === 'Ingreso') {
          // Add incoming qty to current stock
          newStock = currentStock + line.qty;
        } else if (movementType === 'Egreso') {
          // Subtract from stock, floor at 0
          newStock = Math.max(0, currentStock - line.qty);
        } else if (movementType === 'Ajuste de Stock') {
          // Force stock to the entered qty (manual correction)
          newStock = Math.max(0, line.qty);
        } else if (movementType === 'Transferencia') {
          // Transferencia: subtract from this store (destination is a separate store/deposit)
          newStock = Math.max(0, currentStock - line.qty);
        }

        updatedCatalog[matchIdx] = {
          ...existing,
          stock: newStock,
          updated_at: new Date().toISOString()
        };
      } else if (movementType === 'Ingreso') {
        // ONLY ON INGRESO: Create NEW Article & place at top priority for sales pricing
        const autoCode = line.code.trim() || `ART-${Date.now().toString().slice(-4)}`;
        const newArticle = {
          id: autoCode,
          code: autoCode,
          barcode: line.barcode || autoCode,
          description: line.description.trim(),
          category: line.category || 'General',
          stock: Math.max(0, line.qty),
          price: 0,
          base_price: 0,
          custom_prices: {},
          is_priority_pricing: true,
          created_at: new Date().toISOString()
        };
        updatedCatalog.unshift(newArticle);
        newArticlesCount++;
      }
    }

    setCatalogArticles(updatedCatalog);
    try {
      localStorage.setItem(`pickingup_prodprices_${storeKey}`, JSON.stringify(updatedCatalog));
    } catch {}

    // Save to Supabase Articles stock & catalog if logged in
    if (user && !isDemoMode && activeStore) {
      try {
        for (const line of validLines) {
          const target = updatedCatalog.find(a =>
            (line.code && a.code.toLowerCase() === line.code.toLowerCase()) ||
            (line.description && a.description.toLowerCase() === line.description.toLowerCase())
          );
          if (target) {
            await supabase
              .from('articles')
              .upsert({
                store_id: activeStore.id,
                code: target.code,
                description: target.description,
                category: target.category,
                price: target.price || 0,
                stock: target.stock
              }, { onConflict: 'store_id,code' });
          }
        }
      } catch (err) {
        console.error('Error persisting stock/articles in DB:', err);
      }
    }

    // 2. Persist movement header to Supabase
    if (user && !isDemoMode && activeStore?.isRealDbStore && isValidUUID(activeStore.id)) {
      try {
        await supabase.from('stock_movements').insert({
          store_id: activeStore.id,
          movement_type: movementType,
          observations: observations || null,
          total_units: totalUnits,
          created_by: user.id
        });
      } catch (err) {
        console.error('Error persisting stock_movement header:', err);
      }
    }

    // 3. Add to Historical Movements (local)
    const newMovement: HistoricalMovement = {
      id: `mov-${Date.now()}`,
      movementType,
      date: movementDate,
      transferDestination: movementType === 'Transferencia' ? warehouseDestination : undefined,
      observations: observations || 'Movimiento de inventario sin observaciones.',
      totalUnits,
      itemsCount: validLines.length,
      items: validLines
    };

    const updatedHistory = [newMovement, ...historyList];
    setHistoryList(updatedHistory);
    try {
      localStorage.setItem(`pickingup_inventory_history_${storeKey}`, JSON.stringify(updatedHistory));
    } catch {}

    setLoading(false);
    addNotification({
      title: `Movimiento de Inventario (${movementType})`,
      message: `Se procesó ${movementType} de ${validLines.length} ítems (${totalUnits} u. en total).`,
      type: 'success'
    });

    // Reset form
    setLineItems([]);
    setObservations('');
    setWarehouseDestination('');
    addNewLine();

    // Show suggestion prompt for Ingreso de Stock only
    if (movementType === 'Ingreso') {
      setShowPricePromptModal(true);
    } else {
      const msgs: Record<string, string> = {
        'Egreso': `¡Egreso procesado! Se restaron ${totalUnits} u. del stock.`,
        'Ajuste de Stock': `¡Ajuste de inventario aplicado! Stock corregido a los valores ingresados (${totalUnits} u. totales).`,
        'Transferencia': `¡Transferencia registrada! Se descontaron ${totalUnits} u. del depósito de origen.`
      };
      alert(msgs[movementType] || `¡${movementType} procesado con éxito! Total: ${totalUnits} unidades.`);
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

        {/* Modal Top Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
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
              <Box size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
                SISTEMA DE GESTIÓN DE INVENTARIOS v1.22
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                {activeStore?.name || 'Administración de Stock y Depósitos'}
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
              onClick={() => setActiveTab('admin')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'admin' ? '3px solid #a855f7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'admin' ? '#a855f7' : 'var(--text-muted)',
                fontWeight: activeTab === 'admin' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <PackageCheck size={16} /> 📦 Administrar Movimientos
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'history' ? '3px solid #a855f7' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'history' ? '#a855f7' : 'var(--text-muted)',
                fontWeight: activeTab === 'history' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <History size={16} /> 📜 Ver Histórico de Movimientos ({historyList.length})
            </button>
          </div>
        </div>

        {/* TAB 1: ADMINISTRAR MOVIMIENTO DE STOCK */}
        {activeTab === 'admin' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header Form Controls Panel */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Tipo de Movimiento *
                </label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: movementType === 'Ingreso' ? '#10b981' : (movementType === 'Egreso' ? '#ef4444' : '#a855f7'),
                    fontWeight: 900,
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="Ingreso">🟢 Ingreso de Stock (+)</option>
                  <option value="Egreso">🔴 Egreso de Stock (-)</option>
                  <option value="Ajuste de Stock">🟣 Ajuste de Inventario</option>
                  <option value="Transferencia">🔄 Transferencia entre Depósitos</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Fecha y Hora
                </label>
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-app)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                  {new Date().toLocaleString('es-AR')}
                </div>
              </div>

              {movementType === 'Transferencia' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Depósito / Sucursal Destino
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Sucursal Norte / Depósito Auxiliar"
                    value={warehouseDestination}
                    onChange={(e) => setWarehouseDestination(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      color: '#a855f7',
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              )}

              <div style={{ gridColumn: movementType === 'Transferencia' ? 'span 1' : 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Observaciones / Motivo del Movimiento
                </label>
                <input
                  type="text"
                  placeholder="ej. Reposición semanal de mercadería / Ajuste por vencimiento"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
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
            </div>

            {/* Line Items Table */}
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
                      <th style={{ padding: '0.65rem 0.75rem', width: '40px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '0.65rem 0.75rem', width: '140px' }}>Código Artículo</th>
                      <th style={{ padding: '0.65rem 0.75rem', width: '150px' }}>Código Barras</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Descripción del Artículo</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '90px' }}>Stock Actual</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '100px' }}>Cantidad</th>
                      <th style={{ padding: '0.65rem 0.75rem', width: '110px' }}>Unidades</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line, idx) => (
                      <tr key={line.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {idx + 1}
                        </td>

                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <input
                            type="text"
                            placeholder="CÓD..."
                            value={line.code}
                            onChange={(e) => {
                              handleUpdateLine(line.id, 'code', e.target.value);
                              handleArticleSearch(line.id, e.target.value, 'code');
                            }}
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              fontWeight: 800,
                              fontFamily: 'monospace'
                            }}
                          />
                        </td>

                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <input
                            type="text"
                            placeholder="BARRAS..."
                            value={line.barcode}
                            onChange={(e) => {
                              handleUpdateLine(line.id, 'barcode', e.target.value);
                              handleArticleSearch(line.id, e.target.value, 'barcode');
                            }}
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              fontFamily: 'monospace'
                            }}
                          />
                        </td>

                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <input
                            type="text"
                            placeholder="Buscar o escribir descripción..."
                            value={line.description}
                            onChange={(e) => {
                              handleUpdateLine(line.id, 'description', e.target.value);
                              handleArticleSearch(line.id, e.target.value, 'description');
                            }}
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              fontWeight: 700
                            }}
                          />
                        </td>

                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            background: 'var(--bg-app)',
                            color: 'var(--text-muted)',
                            fontWeight: 800,
                            fontSize: '0.75rem'
                          }}>
                            {line.currentStock} u.
                          </span>
                        </td>

                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={(e) => handleUpdateLine(line.id, 'qty', e.target.value)}
                            style={{
                              width: '75px',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid #a855f7',
                              background: 'var(--bg-surface)',
                              color: '#a855f7',
                              fontWeight: 900,
                              fontSize: '0.85rem',
                              textAlign: 'center'
                            }}
                          />
                        </td>

                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <select
                            value={line.unitType}
                            onChange={(e) => handleUpdateLine(line.id, 'unitType', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-main)'
                            }}
                          >
                            <option value="Unidades">Unidades</option>
                            <option value="Bultos">Bultos</option>
                            <option value="Cajas">Cajas</option>
                          </select>
                        </td>

                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => addNewLine()}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--brand-blue)',
                    fontWeight: 800,
                    fontSize: '0.78125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Plus size={15} /> Agregar Fila
                </button>

                <button
                  type="button"
                  onClick={() => setSearchModalOpen(true)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: '#a855f7',
                    fontWeight: 800,
                    fontSize: '0.78125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Search size={15} /> Buscar en Catálogo
                </button>
              </div>
            </div>

            {/* Modal Bottom Bar */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Ítems a procesar: <strong>{lineItems.filter(l => l.description).length} líneas</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Unidades</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#a855f7' }}>
                    {lineItems.reduce((sum, l) => sum + (Number(l.qty) || 0), 0)} u.
                  </div>
                </div>

                <button
                  onClick={handleSaveMovement}
                  disabled={loading}
                  style={{
                    padding: '0.625rem 1.75rem',
                    borderRadius: '0.625rem',
                    border: 'none',
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <Save size={16} /> Guardar Movimiento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VER HISTÓRICO DE MOVIMIENTOS */}
        {activeTab === 'history' && (
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
                    <th style={{ padding: '0.75rem 1rem' }}>Fecha y Hora</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Tipo de Movimiento</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Observaciones / Destino</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No se registraron movimientos de inventario aún en este comercio.
                      </td>
                    </tr>
                  ) : (
                    historyList.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {item.date}
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            background: item.movementType === 'Ingreso' ? 'rgba(16, 185, 129, 0.15)' : (item.movementType === 'Egreso' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(168, 85, 247, 0.15)'),
                            color: item.movementType === 'Ingreso' ? '#10b981' : (item.movementType === 'Egreso' ? '#ef4444' : '#a855f7'),
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            {item.movementType === 'Ingreso' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                            {item.movementType}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                          {item.observations}
                          {item.transferDestination && (
                            <span style={{ marginLeft: '0.5rem', color: '#a855f7', fontWeight: 700 }}>
                              → {item.transferDestination}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#a855f7', fontSize: '0.9rem' }}>
                          {item.totalUnits} u.
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

      {/* CATALOG SEARCH SUB-MODAL */}
      {searchModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1150,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '75vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Buscar Artículo en Catálogo</h3>
              <button onClick={() => setSearchModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
              <input
                type="text"
                placeholder="Buscar por código o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-app)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
              {catalogArticles.filter(a =>
                a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.description.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(art => (
                <div
                  key={art.code}
                  onClick={() => {
                    addNewLine(art);
                    setSearchModalOpen(false);
                  }}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-app)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>{art.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Código: {art.code} | Stock: {art.stock ?? 10} u.</div>
                  </div>
                  <div style={{ fontWeight: 900, color: '#a855f7' }}>
                    ${(art.price || art.base_price || 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRICE ASSIGNMENT SUGGESTION PROMPT MODAL */}
      {showPricePromptModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '500px',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center'
          }} className="animate-scale-in">
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto'
            }}>
              <Tag size={30} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
              ¡Ingreso de Stock Procesado!
            </h3>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Los productos ingresados ya forman parte de tu stock. ¿Deseás ir ahora a <strong>Listas de Precios</strong> para fijar o actualizar sus precios de venta al público?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowPricePromptModal(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.625rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Seguir en Inventario
              </button>

              <button
                onClick={() => {
                  setShowPricePromptModal(false);
                  if (onOpenPriceLists) {
                    onOpenPriceLists();
                  } else {
                    onClose();
                  }
                }}
                style={{
                  padding: '0.625rem 1.5rem',
                  borderRadius: '0.625rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <Tag size={16} /> 🏷️ Ir a Listas de Precios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
