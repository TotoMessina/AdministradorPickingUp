import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Download,
  Filter,
  Save,
  Box,
  Layers,
  ArrowUpDown,
  Zap,
  TrendingDown,
  TrendingUp,
  Check
} from 'lucide-react';

export interface ReconciliationItem {
  code: string;
  barcode: string;
  description: string;
  category: string;
  cost: number;
  price: number;
  theoreticalStock: number;
  realStock: number;
  diff: number;
}

interface InventoryReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInventory?: () => void;
}

export const InventoryReconciliationModal: React.FC<InventoryReconciliationModalProps> = ({
  isOpen,
  onClose,
  onOpenInventory
}) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['ALL']);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCatalog();
    }
  }, [isOpen, activeStore]);

  const loadCatalog = async () => {
    setLoading(true);
    let catalog: any[] = [];

    // Local Storage
    try {
      const rawLocal = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawLocal) {
        catalog = JSON.parse(rawLocal);
      }
    } catch {}

    // Supabase DB
    if (user && !isDemoMode && activeStore) {
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('store_id', activeStore.id);

        if (!error && data && data.length > 0) {
          catalog = data;
        }
      } catch {}
    }

    const mapped: ReconciliationItem[] = catalog.map((a: any) => {
      const stock = Number(a.stock) || 0;
      return {
        code: a.code,
        barcode: a.barcode || a.code,
        description: a.description,
        category: a.category || 'General',
        cost: Number(a.cost) || 0,
        price: Number(a.base_price ?? a.price) || 0,
        theoreticalStock: stock,
        realStock: stock,
        diff: 0
      };
    });

    setItems(mapped);

    const cats = Array.from(new Set(mapped.map(i => i.category).filter(Boolean)));
    setCategories(['ALL', ...cats]);
    setLoading(false);
  };

  const handleRealStockChange = (code: string, newRealVal: number) => {
    const validReal = Math.max(0, newRealVal);
    setItems(prev => prev.map(item => {
      if (item.code === code) {
        const diff = validReal - item.theoreticalStock;
        return {
          ...item,
          realStock: validReal,
          diff
        };
      }
      return item;
    }));
  };

  const handleApplyAdjustments = async () => {
    const itemsWithDiff = items.filter(i => i.diff !== 0);
    if (itemsWithDiff.length === 0) {
      alert('No se detectaron diferencias entre el stock teórico y el contado físico.');
      return;
    }

    if (!window.confirm(`¿Confirmás el ajuste de stock para ${itemsWithDiff.length} artículos con diferencias? Se actualizará el inventario teórico con los valores físicos.`)) {
      return;
    }

    setIsApplying(true);

    // 1. Update Articles local & DB
    try {
      const rawLocal = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      let localCatalog: any[] = rawLocal ? JSON.parse(rawLocal) : [];

      items.forEach(item => {
        const idx = localCatalog.findIndex(c => c.code === item.code);
        if (idx >= 0) {
          localCatalog[idx] = {
            ...localCatalog[idx],
            stock: item.realStock
          };
        }
      });
      localStorage.setItem(`pickingup_prodprices_${storeKey}`, JSON.stringify(localCatalog));
    } catch {}

    if (user && !isDemoMode && activeStore) {
      try {
        for (const item of itemsWithDiff) {
          await supabase
            .from('articles')
            .update({ stock: item.realStock })
            .eq('store_id', activeStore.id)
            .eq('code', item.code);
        }

        // Create Stock Movement header
        await supabase.from('stock_movements').insert({
          store_id: activeStore.id,
          movement_type: 'Ajuste de Stock',
          observations: `Conciliación de inventario físico. ${itemsWithDiff.length} productos ajustados.`,
          total_units: itemsWithDiff.reduce((sum, i) => sum + Math.abs(i.diff), 0),
          created_by: user.id
        });
      } catch (err) {
        console.error('Error applying reconciliation adjustments to DB:', err);
      }
    }

    setIsApplying(false);
    addNotification({
      title: 'Conciliación Aplicada Exitosamente',
      message: `Se ajustó el stock de ${itemsWithDiff.length} productos según el conteo real.`,
      type: 'success'
    });
    alert(`¡Conciliación finalizada con éxito! ${itemsWithDiff.length} productos actualizados.`);
    
    // Reload theoretical stock to match newly applied real stock
    setItems(prev => prev.map(i => ({ ...i, theoreticalStock: i.realStock, diff: 0 })));
  };

  const handleExportCSV = () => {
    const headers = ['Codigo', 'EAN', 'Descripcion', 'Rubro', 'Stock_Teorico', 'Stock_Real', 'Diferencia_Unidades', 'Diferencia_Costo_Valor'];
    const rows = items.map(i => [
      i.code,
      i.barcode || i.code,
      `"${i.description.replace(/"/g, '""')}"`,
      `"${i.category.replace(/"/g, '""')}"`,
      i.theoreticalStock,
      i.realStock,
      i.diff,
      (i.diff * i.cost).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `conciliacion_inventario_${activeStore?.slug || 'tienda'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const itemsWithDiscrepancy = items.filter(i => i.diff !== 0);
  const totalShortage = items.filter(i => i.diff < 0).reduce((sum, i) => sum + Math.abs(i.diff), 0);
  const totalSurplus = items.filter(i => i.diff > 0).reduce((sum, i) => sum + i.diff, 0);
  const netFinancialDiff = items.reduce((sum, i) => sum + (i.diff * i.cost), 0);

  // Filtered
  const filteredItems = items.filter(item => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch = !term ||
      item.code.toLowerCase().includes(term) ||
      (item.barcode && item.barcode.toLowerCase().includes(term)) ||
      item.description.toLowerCase().includes(term);

    const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchDisc = !showDiscrepanciesOnly || item.diff !== 0;

    return matchSearch && matchCat && matchDisc;
  });

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
          background: 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)',
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
              <RefreshCw size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
                CONCILIACIÓN Y CONTEO FÍSICO DE INVENTARIO
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                Comparativa Stock Teórico vs. Real — {activeStore?.name || 'Mi Negocio'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleExportCSV}
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
              <Download size={15} /> Exportar Planilla CSV
            </button>
            <button
              id="btn-close-conciliacion-modal"
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

        {/* Filter Bar */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: '300px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por código, EAN o producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '0.5rem 0.875rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                color: '#a855f7',
                fontWeight: 800,
                fontSize: '0.85rem'
              }}
            >
              <option value="ALL">🏷️ Todos los Rubros</option>
              {categories.filter(c => c !== 'ALL').map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: showDiscrepanciesOnly ? '#a855f7' : 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={showDiscrepanciesOnly}
              onChange={(e) => setShowDiscrepanciesOnly(e.target.checked)}
              style={{ accentColor: '#a855f7', width: '16px', height: '16px' }}
            />
            ⚠️ Mostrar solo con diferencias ({itemsWithDiscrepancy.length})
          </label>
        </div>

        {/* Main Grid Table */}
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
                  <th style={{ padding: '0.75rem 1rem' }}>Código / EAN</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Descripción</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Rubro</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Stock Teórico</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Stock Real (Físico)</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Diferencia</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Valor Dif. ($)</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay artículos para listar en este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const isShortage = item.diff < 0;
                    const isSurplus = item.diff > 0;
                    const valDiff = item.diff * item.cost;

                    return (
                      <tr key={item.code} style={{ borderBottom: '1px solid var(--border-light)', background: item.diff !== 0 ? 'rgba(168, 85, 247, 0.04)' : 'transparent' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{item.code}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.barcode}</div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {item.description}
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--bg-app)', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {item.category}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-muted)' }}>
                          {item.theoreticalStock} u.
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            value={item.realStock}
                            onChange={(e) => handleRealStockChange(item.code, parseInt(e.target.value) || 0)}
                            style={{
                              width: '90px',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: item.diff !== 0 ? '2px solid #a855f7' : '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              color: '#a855f7',
                              fontWeight: 900,
                              fontSize: '0.9rem',
                              textAlign: 'center'
                            }}
                          />
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '0.5rem',
                            background: isShortage ? 'rgba(239, 68, 68, 0.15)' : (isSurplus ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.12)'),
                            color: isShortage ? '#ef4444' : (isSurplus ? '#10b981' : 'var(--text-muted)'),
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            {isShortage && <TrendingDown size={13} />}
                            {isSurplus && <TrendingUp size={13} />}
                            {!isShortage && !isSurplus && <Check size={13} />}
                            {item.diff > 0 ? `+${item.diff}` : item.diff} u.
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: isShortage ? '#ef4444' : (isSurplus ? '#10b981' : 'var(--text-muted)') }}>
                          {valDiff === 0 ? '$0.00' : `${valDiff > 0 ? '+' : ''}$${valDiff.toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Bar Summary & Action */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Faltantes: </span>
              <strong style={{ color: '#ef4444' }}>-{totalShortage} u.</strong>
            </div>
            <div style={{ fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sobrantes: </span>
              <strong style={{ color: '#10b981' }}>+{totalSurplus} u.</strong>
            </div>
            <div style={{ fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Diferencia Monetaria Neta: </span>
              <strong style={{ color: netFinancialDiff < 0 ? '#ef4444' : '#10b981' }}>
                {netFinancialDiff >= 0 ? '+' : ''}${netFinancialDiff.toFixed(2)}
              </strong>
            </div>
          </div>

          <button
            onClick={handleApplyAdjustments}
            disabled={isApplying || itemsWithDiscrepancy.length === 0}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '0.625rem',
              border: 'none',
              background: itemsWithDiscrepancy.length > 0 ? 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)' : 'var(--border-light)',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '0.875rem',
              cursor: itemsWithDiscrepancy.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Zap size={16} /> ⚡ Aplicar Ajuste Automático ({itemsWithDiscrepancy.length})
          </button>
        </div>

      </div>
    </div>
  );
};
