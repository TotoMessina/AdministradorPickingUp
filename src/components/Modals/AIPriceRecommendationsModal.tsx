import React, { useState, useEffect, useMemo } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  fetchAIPriceRecommendations,
  applyPriceRecommendation,
  AIPriceRecommendationItem,
  AIPriceRecommendationsResponse
} from '../../services/PriceRecommendationsService';
import {
  X,
  Sparkles,
  TrendingUp,
  Tag,
  Percent,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Filter,
  CheckSquare,
  Square,
  HelpCircle,
  Zap
} from 'lucide-react';

interface AIPriceRecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPricesUpdated?: () => void;
}

export const AIPriceRecommendationsModal: React.FC<AIPriceRecommendationsModalProps> = ({
  isOpen,
  onClose,
  onPricesUpdated
}) => {
  const { activeStore } = useTenant();
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<AIPriceRecommendationsResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'AUMENTAR' | 'DESCUENTO' | 'AJUSTAR_MARGEN'>('ALL');
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isApplyingBatch, setIsApplyingBatch] = useState<boolean>(false);
  const [applyingSingleCode, setApplyingSingleCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRecommendations();
    }
  }, [isOpen, activeStore, periodDays]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetchAIPriceRecommendations(storeKey, { periodDays, targetMarginPercent: 30 });
      setData(res);
      // Auto select non-MANTENER recommendations
      const actionable = (res.recommendations || []).filter(r => r.action !== 'MANTENER');
      setSelectedCodes(new Set(actionable.map(r => r.article_code)));
    } catch (err) {
      console.error('Error loading AI price recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecommendations = useMemo(() => {
    if (!data?.recommendations) return [];
    if (activeFilter === 'ALL') {
      return data.recommendations.filter(r => r.action !== 'MANTENER');
    }
    return data.recommendations.filter(r => r.action === activeFilter);
  }, [data, activeFilter]);

  const handleToggleSelect = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelectedCodes(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedCodes.size === filteredRecommendations.length) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(filteredRecommendations.map(r => r.article_code)));
    }
  };

  const handleApplySingle = async (rec: AIPriceRecommendationItem) => {
    setApplyingSingleCode(rec.article_code);
    try {
      await applyPriceRecommendation(storeKey, rec, user?.email || 'Operador IA');
      addNotification({
        title: '🤖 Precio Actualizado por IA',
        message: `Se actualizó el precio de ${rec.description} de $${rec.current_price} a $${rec.suggested_price}.`,
        type: 'success'
      });

      // Reload recommendations and trigger callback
      await loadRecommendations();
      if (onPricesUpdated) onPricesUpdated();
    } catch (err: any) {
      addNotification({
        title: 'Error al aplicar precio',
        message: err?.message || String(err),
        type: 'error'
      });
    } finally {
      setApplyingSingleCode(null);
    }
  };

  const handleApplySelectedBatch = async () => {
    if (selectedCodes.size === 0) {
      alert('Seleccioná al menos un artículo para aplicar los ajustes.');
      return;
    }

    const itemsToApply = (data?.recommendations || []).filter(r => selectedCodes.has(r.article_code));
    if (itemsToApply.length === 0) return;

    if (!confirm(`¿Confirmás aplicar los ajustes de precio sugeridos para ${itemsToApply.length} productos?`)) {
      return;
    }

    setIsApplyingBatch(true);
    let count = 0;
    for (const item of itemsToApply) {
      try {
        await applyPriceRecommendation(storeKey, item, user?.email || 'Operador IA');
        count++;
      } catch (e) {
        console.error('Error applying batch recommendation for:', item.article_code, e);
      }
    }

    setIsApplyingBatch(false);
    addNotification({
      title: '✨ Sugerencias IA Aplicadas',
      message: `Se actualizaron ${count} precios y se registraron en el historial de auditoría (price_audit_logs).`,
      type: 'success'
    });

    await loadRecommendations();
    if (onPricesUpdated) onPricesUpdated();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '1240px',
        maxHeight: '94vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} className="animate-fade-in">

        {/* Top Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '0.875rem',
              background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.35)'
            }}>
              <Sparkles size={24} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#38bdf8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                <Zap size={13} /> SUPABASE EDGE FUNCTION / V1 / PRICE-RECOMMENDATIONS
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: '2px 0 0 0', color: '#ffffff' }}>
                Asistente de Inteligencia Artificial — Optimización de Precios
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Period Selector */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '0.25rem',
              borderRadius: '0.625rem',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}>
              {[30, 60, 90].map(days => (
                <button
                  key={days}
                  onClick={() => setPeriodDays(days)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: periodDays === days ? '#0284c7' : 'transparent',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {days} Días
                </button>
              ))}
            </div>

            <button
              onClick={loadRecommendations}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '0.625rem',
                padding: '0.55rem 0.875rem',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Re-analizar Catálogo
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                borderRadius: '0.625rem',
                width: '36px',
                height: '36px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* AI Summary KPI Cards */}
        <div style={{
          padding: '1.25rem 1.75rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1.25rem'
        }}>
          <div style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '0.875rem', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>PRODUCTOS ANALIZADOS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              {data?.metrics_summary?.total_analyzed || 0} ítems
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Últimos {periodDays} días de ventas</div>
          </div>

          <div style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '0.875rem', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 800, textTransform: 'uppercase' }}>SUGERENCIAS AUMENTO</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
              {data?.metrics_summary?.suggested_increases || 0} productos
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Alta demanda / rotación</div>
          </div>

          <div style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '0.875rem', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.725rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase' }}>OFERTAS / DESCUENTOS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b', marginTop: '2px' }}>
              {data?.metrics_summary?.suggested_discounts || 0} productos
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Stock inmovilizado</div>
          </div>

          <div style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '0.875rem', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.725rem', color: '#dc2626', fontWeight: 800, textTransform: 'uppercase' }}>MARGEN CRÍTICO ($0 / BAJO)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>
              {data?.metrics_summary?.suggested_margin_fixes || 0} productos
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Por debajo de la meta (30%)</div>
          </div>

          <div style={{ background: '#f0fdf4', padding: '1rem 1.25rem', borderRadius: '0.875rem', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>PROYECTADO UPLIFT PROVECHO</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
              +${(data?.metrics_summary?.estimated_profit_uplift || 0).toLocaleString('es-AR')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '2px' }}>Ganancia estimada adicional</div>
          </div>
        </div>

        {/* Filters & Batch Action Bar */}
        <div style={{
          padding: '0.875rem 1.75rem',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveFilter('ALL')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.5rem',
                border: activeFilter === 'ALL' ? '1px solid #0284c7' : '1px solid #e2e8f0',
                background: activeFilter === 'ALL' ? '#e0f2fe' : '#ffffff',
                color: activeFilter === 'ALL' ? '#0284c7' : '#64748b',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }}
            >
              Todas las Recomendaciones ({data?.recommendations?.filter(r => r.action !== 'MANTENER').length || 0})
            </button>

            <button
              onClick={() => setActiveFilter('AUMENTAR')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.5rem',
                border: activeFilter === 'AUMENTAR' ? '1px solid #0284c7' : '1px solid #e2e8f0',
                background: activeFilter === 'AUMENTAR' ? '#e0f2fe' : '#ffffff',
                color: activeFilter === 'AUMENTAR' ? '#0284c7' : '#64748b',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }}
            >
              📈 Aumentar ({data?.metrics_summary?.suggested_increases || 0})
            </button>

            <button
              onClick={() => setActiveFilter('DESCUENTO')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.5rem',
                border: activeFilter === 'DESCUENTO' ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                background: activeFilter === 'DESCUENTO' ? '#fef3c7' : '#ffffff',
                color: activeFilter === 'DESCUENTO' ? '#b45309' : '#64748b',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }}
            >
              🏷️ Oferta / Liquidadas ({data?.metrics_summary?.suggested_discounts || 0})
            </button>

            <button
              onClick={() => setActiveFilter('AJUSTAR_MARGEN')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.5rem',
                border: activeFilter === 'AJUSTAR_MARGEN' ? '1px solid #ef4444' : '1px solid #e2e8f0',
                background: activeFilter === 'AJUSTAR_MARGEN' ? '#fee2e2' : '#ffffff',
                color: activeFilter === 'AJUSTAR_MARGEN' ? '#dc2626' : '#64748b',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }}
            >
              ⚖️ Margen Crítico ({data?.metrics_summary?.suggested_margin_fixes || 0})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleApplySelectedBatch}
              disabled={isApplyingBatch || selectedCodes.size === 0}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.625rem',
                padding: '0.55rem 1.1rem',
                fontSize: '0.8125rem',
                fontWeight: 800,
                cursor: selectedCodes.size > 0 ? 'pointer' : 'not-allowed',
                opacity: selectedCodes.size > 0 ? 1 : 0.5,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Sparkles size={16} />
              Aplicar {selectedCodes.size} Sugerencias Seleccionadas
            </button>
          </div>
        </div>

        {/* Table Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem', background: '#f8fafc' }}>
          {loading ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={36} className="animate-spin" style={{ color: '#0284c7', margin: '0 auto 1rem auto' }} />
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Ejecutando modelo analítico de IA...</div>
              <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>
                Procesando rotación histórica, márgenes por categoría e historial de auditoría (`price_audit_logs`).
              </div>
            </div>
          ) : filteredRecommendations.length === 0 ? (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center', background: '#ffffff', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
              <CheckCircle2 size={40} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                ¡El catálogo se encuentra perfectamente optimizado!
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '4px' }}>
                No se detectaron desviaciones críticas de margen o rotación estancada en este período.
              </div>
            </div>
          ) : (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontSize: '0.725rem', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '40px' }}>
                      <button
                        onClick={handleToggleSelectAll}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0284c7' }}
                      >
                        {selectedCodes.size === filteredRecommendations.length ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </th>
                    <th style={{ padding: '0.75rem 1rem' }}>Producto / Rubro</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Ventas / Stock</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Precio Actual vs Costo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Margen %</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Sugerencia IA</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Justificación Algorítmica</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecommendations.map(rec => {
                    const isSelected = selectedCodes.has(rec.article_code);
                    const isSingleApplying = applyingSingleCode === rec.article_code;

                    let actionBadgeBg = '#e0f2fe';
                    let actionBadgeColor = '#0284c7';
                    let actionLabel = 'Aumentar';

                    if (rec.action === 'DESCUENTO') {
                      actionBadgeBg = '#fef3c7';
                      actionBadgeColor = '#b45309';
                      actionLabel = 'Oferta';
                    } else if (rec.action === 'AJUSTAR_MARGEN') {
                      actionBadgeBg = '#fee2e2';
                      actionBadgeColor = '#dc2626';
                      actionLabel = 'Ajustar Margen';
                    }

                    return (
                      <tr key={rec.article_code} style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#f0f9ff' : '#ffffff' }}>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <button
                            onClick={() => handleToggleSelect(rec.article_code)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: isSelected ? '#0284c7' : '#94a3b8' }}
                          >
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>

                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{rec.description}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Código: <strong>{rec.article_code}</strong> | Rubro: {rec.category}
                          </div>
                        </td>

                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{rec.units_sold_period} u. vendidas</div>
                          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                            Stock: {rec.stock_qty} u. (Rot: {rec.rotation_index})
                          </div>
                        </td>

                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>${rec.current_price.toFixed(2)}</div>
                          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Costo: ${rec.cost_price.toFixed(2)}</div>
                        </td>

                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            background: rec.current_margin_percent >= 30 ? '#dcfce7' : (rec.current_margin_percent > 15 ? '#fef3c7' : '#fee2e2'),
                            color: rec.current_margin_percent >= 30 ? '#15803d' : (rec.current_margin_percent > 15 ? '#b45309' : '#dc2626'),
                            fontWeight: 900,
                            fontSize: '0.75rem'
                          }}>
                            {rec.current_margin_percent.toFixed(1)}%
                          </span>
                        </td>

                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 900, color: rec.suggested_change_percent >= 0 ? '#10b981' : '#f59e0b' }}>
                            ${rec.suggested_price.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: rec.suggested_change_percent >= 0 ? '#10b981' : '#f59e0b' }}>
                            {rec.suggested_change_percent >= 0 ? `+${rec.suggested_change_percent}%` : `${rec.suggested_change_percent}%`}
                          </div>
                        </td>

                        <td style={{ padding: '0.875rem 1rem', maxWidth: '320px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '4px' }}>
                            <span style={{ background: actionBadgeBg, color: actionBadgeColor, padding: '0.15rem 0.5rem', borderRadius: '0.375rem', fontWeight: 800, fontSize: '0.725rem' }}>
                              {actionLabel}
                            </span>
                            <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>
                              Confianza: {Math.round(rec.confidence_score * 100)}%
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.35 }}>
                            {rec.reason}
                          </div>
                        </td>

                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleApplySingle(rec)}
                            disabled={isSingleApplying}
                            style={{
                              background: '#0f172a',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '0.5rem',
                              padding: '0.45rem 0.85rem',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            {isSingleApplying ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                                Aplicar
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            Todos los precios aceptados se registran automáticamente en <strong>price_audit_logs</strong>.
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              color: '#0f172a',
              border: 'none',
              borderRadius: '0.625rem',
              padding: '0.6rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Cerrar Asistente
          </button>
        </div>

      </div>
    </div>
  );
};
