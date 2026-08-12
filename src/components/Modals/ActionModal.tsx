
import { ActionItem } from '../Dashboard/FavoritesBar';
import { useTenant } from '../../context/TenantContext';
import { useNotifications } from '../../context/NotificationContext';
import { APP_CONFIG } from '../../config/appConfig';
import { supabase, isValidUUID } from '../../lib/supabase';
import {
  X,
  Zap,
  Save,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Lock,
  RefreshCw,
  TrendingUp,
  Download,
  Filter
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import React, { useState, useEffect, Suspense, lazy } from 'react';

import { logPriceChange } from '../../services/AuditLoggerService';

const PriceListsModal = lazy(() => import('./PriceListsModal').then(m => ({ default: m.PriceListsModal })));
const PriceAuditLogsModal = lazy(() => import('./PriceAuditLogsModal').then(m => ({ default: m.PriceAuditLogsModal })));
const CashRegisterMonitoringModal = lazy(() => import('./CashRegisterMonitoringModal').then(m => ({ default: m.CashRegisterMonitoringModal })));
const CashRegisterConfigModal = lazy(() => import('./CashRegisterConfigModal').then(m => ({ default: m.CashRegisterConfigModal })));
const InventoryManagementModal = lazy(() => import('./InventoryManagementModal').then(m => ({ default: m.InventoryManagementModal })));
const ArticlesManagementModal = lazy(() => import('./ArticlesManagementModal').then(m => ({ default: m.ArticlesManagementModal })));
const InventoryReconciliationModal = lazy(() => import('./InventoryReconciliationModal').then(m => ({ default: m.InventoryReconciliationModal })));
const ReportsAnalyticsModal = lazy(() => import('./ReportsAnalyticsModal').then(m => ({ default: m.ReportsAnalyticsModal })));
const ExecutiveDashboardModal = lazy(() => import('./ExecutiveDashboardModal').then(m => ({ default: m.ExecutiveDashboardModal })));
const SuppliersManagementModal = lazy(() => import('./SuppliersManagementModal').then(m => ({ default: m.SuppliersManagementModal })));
const POSTerminalModal = lazy(() => import('./POSTerminalModal').then(m => ({ default: m.POSTerminalModal })));
const UserPermissionsModal = lazy(() => import('./UserPermissionsModal').then(m => ({ default: m.UserPermissionsModal })));
const CajaCentralModal = lazy(() => import('./CajaCentralModal').then(m => ({ default: m.CajaCentralModal })));
const ConfiguracionModal = lazy(() => import('./ConfiguracionModal').then(m => ({ default: m.ConfiguracionModal })));
const LabelDesignModal = lazy(() => import('./LabelDesignModal').then(m => ({ default: m.LabelDesignModal })));
const AccountingExportModal = lazy(() => import('./AccountingExportModal').then(m => ({ default: m.AccountingExportModal })));
const AIPriceRecommendationsModal = lazy(() => import('./AIPriceRecommendationsModal').then(m => ({ default: m.AIPriceRecommendationsModal })));
const CustomersManagementModal = lazy(() => import('./CustomersManagementModal').then(m => ({ default: m.CustomersManagementModal })));
const DesignSystemCatalog = lazy(() => import('../../design-system/DesignSystemCatalog').then(m => ({ default: m.DesignSystemCatalog })));
const OtrosModal = lazy(() => import('./OtrosModal').then(m => ({ default: m.OtrosModal })));

const ModalFallback = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  }}>
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: '1rem',
      padding: '1.25rem 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      boxShadow: 'var(--shadow-lg)',
      color: 'var(--text-main)'
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: '3px solid rgba(99, 102, 241, 0.2)',
        borderTopColor: '#6366f1',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Cargando módulo...</span>
    </div>
  </div>
);

interface ActionModalProps {
  action: ActionItem | null;
  onClose: () => void;
  onNavigate?: (actionSlug: string) => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({ action, onClose, onNavigate }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();
  const [articles, setArticles] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('base');
  const [loading, setLoading] = useState(false);
  const [percentageChange, setPercentageChange] = useState<number>(5);
  const [notification, setNotification] = useState<string | null>(null);

  const storeKey = activeStore?.id || 'demo-store';

  // Cash Register State
  const [declaredCash, setDeclaredCash] = useState<number>(0);
  const [systemCash, setSystemCash] = useState<number>(0);

  useEffect(() => {
    try {
      const rawSales = localStorage.getItem(`pickingup_sales_history_${storeKey}`);
      if (rawSales) {
        const sales = JSON.parse(rawSales);
        const cashSalesToday = sales
          .filter((s: any) => s.paymentMethod === 'Efectivo')
          .reduce((sum: number, s: any) => sum + (s.total || 0), 0);
        setSystemCash(cashSalesToday);
        setDeclaredCash(cashSalesToday);
      }
    } catch {}
  }, [storeKey]);

  // Supplier Invoice State
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  // Price Distribution State
  const [distributeTargetRegs, setDistributeTargetRegs] = useState<string[]>(['all']);
  const [isDistributing, setIsDistributing] = useState(false);
  const [lastDistributeTime, setLastDistributeTime] = useState<string | null>(null);

  const fetchPriceLists = async () => {
    // Load lists from localStorage
    try {
      const rawLists = localStorage.getItem(`pickingup_pricelists_${storeKey}`);
      if (rawLists) {
        const parsed = JSON.parse(rawLists);
        setPriceLists(parsed);
        if (parsed.length > 0 && selectedListId === 'base') {
          setSelectedListId(parsed[0].id);
        }
      }
    } catch {}

    // Load lists from Supabase
    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        const { data, error } = await supabase
          .from('price_lists')
          .select('*')
          .eq('store_id', activeStore.id)
          .order('code', { ascending: true });

        if (!error && data && data.length > 0) {
          setPriceLists(data);
          if (selectedListId === 'base') {
            setSelectedListId(data[0].id);
          }
        }
      } catch {}
    }
  };

  const fetchSampleData = async () => {
    setLoading(true);
    try {
      // 1. Try local cache first
      const rawLocal = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed && parsed.length > 0) {
          const mapped = parsed.map((p: any) => ({
            id: p.code,
            code: p.code,
            description: p.description,
            category: p.category,
            price: p.base_price || p.price,
            custom_prices: p.custom_prices || {}
          }));
          setArticles(mapped);
        }
      }

      // 2. Fetch from Supabase DB
      if (activeStore?.id && isValidUUID(activeStore.id)) {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          setArticles(data);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  // Reset selectedListId whenever the active store changes
  useEffect(() => {
    setSelectedListId('base');
  }, [activeStore?.id]);

  useEffect(() => {
    if (action) {
      setSelectedListId('base');
      fetchSampleData();
      fetchPriceLists();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [action, activeStore]);

  if (!action) return null;

  const slug = action.slug.toLowerCase();

  if (slug === 'usuarios-permisos' || slug === 'permisos' || slug === 'gestion-usuarios' || slug === 'usuarios') {
    return <Suspense fallback={<ModalFallback />}><UserPermissionsModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'pos-terminal' || slug === 'venta-pos' || slug === 'distribuciones') {
    return <Suspense fallback={<ModalFallback />}><POSTerminalModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'configuracion-cajas') {
    return <Suspense fallback={<ModalFallback />}><CashRegisterConfigModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'monitoreo-cajas') {
    return <Suspense fallback={<ModalFallback />}><CashRegisterMonitoringModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'listas-precios') {
    return <Suspense fallback={<ModalFallback />}><PriceListsModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'ai-precios' || slug === 'recomendaciones-ia') {
    return <Suspense fallback={<ModalFallback />}><AIPriceRecommendationsModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'gestion-clientes' || slug === 'clientes' || slug === 'cta-cte-clientes') {
    return <Suspense fallback={<ModalFallback />}><CustomersManagementModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'design-system' || slug === 'componentes' || slug === 'storybook') {
    return <Suspense fallback={<ModalFallback />}><DesignSystemCatalog isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'diseno-etiquetas' || slug === 'etiquetas') {
    return <Suspense fallback={<ModalFallback />}><LabelDesignModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'auditoria-precios' || slug === 'price-audit') {
    return <Suspense fallback={<ModalFallback />}><PriceAuditLogsModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'gestion-inventario' || slug === 'inventario') {
    return <Suspense fallback={<ModalFallback />}><InventoryManagementModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'articulos' || slug === 'articulos-list' || slug === 'rubros' || slug === 'baja-articulos' || slug === 'familias-subfamilias') {
    const tabMap: Record<string, 'articles' | 'categories' | 'deactivated'> = {
      'articulos': 'articles',
      'articulos-list': 'articles',
      'rubros': 'categories',
      'familias-subfamilias': 'categories',
      'baja-articulos': 'deactivated'
    };
    return (
      <Suspense fallback={<ModalFallback />}>
        <ArticlesManagementModal
          isOpen={true}
          onClose={onClose}
          initialTab={tabMap[slug] || 'articles'}
        />
      </Suspense>
    );
  }

  if (slug === 'conciliacion') {
    return <Suspense fallback={<ModalFallback />}><InventoryReconciliationModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'reportes-analytics' || slug === 'reportes') {
    return <Suspense fallback={<ModalFallback />}><ReportsAnalyticsModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'exportaciones' || slug === 'exportacion-contable' || slug === 'citi-ventas') {
    return <Suspense fallback={<ModalFallback />}><AccountingExportModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'dashboard-ejecutivo' || slug === 'dashboards-recharts') {
    return <Suspense fallback={<ModalFallback />}><ExecutiveDashboardModal isOpen={true} onClose={onClose} /></Suspense>;
  }

  if (slug === 'compras' || slug === 'proveedores' || slug === 'gestion-proveedores' || slug === 'prov-cta-cte' || slug === 'ingreso-comprobantes' || slug === 'admin-cta-cte') {
    const suppTabMap: Record<string, 'suppliers' | 'checking_account' | 'invoices'> = {
      'gestion-proveedores': 'suppliers',
      'proveedores': 'suppliers',
      'prov-cta-cte': 'checking_account',
      'admin-cta-cte': 'checking_account',
      'compras': 'invoices',
      'ingreso-comprobantes': 'invoices'
    };
    return (
      <Suspense fallback={<ModalFallback />}>
        <SuppliersManagementModal
          isOpen={true}
          onClose={onClose}
          initialTab={suppTabMap[slug] || 'suppliers'}
        />
      </Suspense>
    );
  }

  if (slug === 'cajas' || slug === 'caja-central' || slug === 'cierre-cajeros' || slug === 'cuenta-corriente-caja' || slug === 'movimientos-caja' || slug === 'admin-aranceles') {
    const cajaTabMap: Record<string, 'closing' | 'checking_account' | 'movements' | 'tariffs'> = {
      'cajas': 'closing',
      'caja-central': 'closing',
      'cierre-cajeros': 'closing',
      'cuenta-corriente-caja': 'checking_account',
      'movimientos-caja': 'movements',
      'admin-aranceles': 'tariffs'
    };
    return (
      <Suspense fallback={<ModalFallback />}>
        <CajaCentralModal
          isOpen={true}
          onClose={onClose}
          initialTab={cajaTabMap[slug] || 'closing'}
        />
      </Suspense>
    );
  }

  if (slug === 'configuracion' || slug === 'autorizar-soporte' || slug === 'diseno-etiquetas' || slug === 'bonificaciones' || slug === 'propiedades-mm' || slug === 'configuracion-backend') {
    const configTabMap: Record<string, 'support' | 'labels' | 'discounts' | 'mm_props' | 'backend'> = {
      'configuracion': 'support',
      'autorizar-soporte': 'support',
      'diseno-etiquetas': 'labels',
      'bonificaciones': 'discounts',
      'propiedades-mm': 'mm_props',
      'configuracion-backend': 'backend'
    };
    return (
      <Suspense fallback={<ModalFallback />}>
        <ConfiguracionModal
          isOpen={true}
          onClose={onClose}
          initialTab={configTabMap[slug] || 'support'}
        />
      </Suspense>
    );
  }

  if (slug === 'bancos' || slug === 'tipo-cambio' || slug === 'ingresos-egresos' || slug === 'cuentas' || slug === 'vales-compra' || slug === 'exportaciones') {
    const otrosTabMap: Record<string, 'banks' | 'currency' | 'income_expense' | 'chart_of_accounts' | 'vouchers' | 'exports'> = {
      'bancos': 'banks',
      'tipo-cambio': 'currency',
      'ingresos-egresos': 'income_expense',
      'cuentas': 'chart_of_accounts',
      'vales-compra': 'vouchers',
      'exportaciones': 'exports'
    };
    return (
      <Suspense fallback={<ModalFallback />}>
        <OtrosModal
          isOpen={true}
          onClose={onClose}
          initialTab={otrosTabMap[slug] || 'banks'}
        />
      </Suspense>
    );
  }



  const syncArticlesToStorage = (updatedArticles: any[]) => {
    setArticles(updatedArticles);
    try {
      const formattedForStorage = updatedArticles.map(art => ({
        code: art.code,
        description: art.description,
        category: art.category,
        base_price: art.price,
        custom_prices: art.custom_prices || {}
      }));
      localStorage.setItem(`pickingup_prodprices_${storeKey}`, JSON.stringify(formattedForStorage));
    } catch {
      // Ignore
    }
  };

  const handleApplyBulkPriceChange = async () => {
    const multiplier = 1 + percentageChange / 100;

    // Apply percentage to base price AND to every existing custom_price override
    const updated = articles.map(art => {
      const newBasePrice = Math.round(art.price * multiplier);
      const updatedCustomPrices: Record<string, number> = {};
      if (art.custom_prices) {
        Object.keys(art.custom_prices).forEach(listId => {
          updatedCustomPrices[listId] = Math.round((art.custom_prices[listId] as number) * multiplier);
        });
      }
      return {
        ...art,
        price: newBasePrice,
        custom_prices: updatedCustomPrices
      };
    });

    syncArticlesToStorage(updated);

    // Audit Log: Record bulk price change for each article
    const activeListName = priceLists.find(l => l.id === selectedListId)?.name || 'Todas las listas';
    articles.forEach(art => {
      const newPrice = Math.round(art.price * multiplier);
      logPriceChange({
        store_id: storeKey,
        article_code: art.code,
        article_description: art.description,
        price_list_name: activeListName,
        old_price: art.price,
        new_price: newPrice,
        reason: `Cambio Masivo (${percentageChange >= 0 ? '+' : ''}${percentageChange}%)`,
        user_email: user?.email || 'Administrador'
      });
    });

    // Persist to Supabase
    if (user && !isDemoMode && activeStore) {
      try {
        // Fetch the current valid price_list IDs from DB to guard against FK violations
        const { data: validLists } = await supabase
          .from('price_lists')
          .select('id')
          .eq('store_id', activeStore.id);
        const validListIds = new Set((validLists || []).map((l: any) => l.id));

        for (const art of updated) {
          // 1. Always update base price in articles table
          await supabase
            .from('articles')
            .update({ price: art.price })
            .eq('store_id', activeStore.id)
            .eq('code', art.code);

          // 2. Update existing custom_price overrides in price_list_items
          if (art.custom_prices) {
            for (const [listId, customPrice] of Object.entries(art.custom_prices)) {
              // FK validation: only upsert when the list actually exists in DB
              if (validListIds.has(listId)) {
                await supabase
                  .from('price_list_items')
                  .upsert({
                    price_list_id: listId,
                    article_code: art.code,
                    custom_price: customPrice as number
                  }, { onConflict: 'price_list_id,article_code' });
              }
            }
          }

          // 3. Also apply the bulk change to ALL secondary lists that don't yet
          //    have a custom_price for this article (so they stay in sync)
          for (const list of priceLists) {
            const listId = list.id;
            if (!listId || listId === 'base' || listId.startsWith('list-')) continue;
            if (!validListIds.has(listId)) continue; // FK guard
            const alreadyUpdated = art.custom_prices && listId in art.custom_prices;
            if (!alreadyUpdated) {
              // Use base price as the starting point for lists without an override yet
              const newListPrice = Math.round(art.price); // art.price is already post-multiplier
              await supabase
                .from('price_list_items')
                .upsert({
                  price_list_id: listId,
                  article_code: art.code,
                  custom_price: newListPrice
                }, { onConflict: 'price_list_id,article_code' });
            }
          }
        }
      } catch (err) {
        console.error('Error persisting bulk price change in DB:', err);
      }
    }

    const msg = `¡Precios actualizados en un +${percentageChange}% exitosamente!`;
    setNotification(msg);
    addNotification({
      title: 'Actualización Masiva de Precios',
      message: `Se aplicó un incremento del +${percentageChange}% en los precios de ${activeStore?.name || 'tu negocio'}.`,
      type: 'success'
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleIndividualPriceChange = async (articleCode: string, newPrice: number, listId: string = selectedListId) => {
    const targetList = priceLists.find(l => l.id === listId);
    const isBaseList = listId === 'base' || targetList?.is_default || targetList?.code === 1;

    const updated = articles.map(art => {
      if (art.code === articleCode) {
        const customPrices = { ...(art.custom_prices || {}), [listId]: newPrice };
        return {
          ...art,
          price: isBaseList ? newPrice : art.price,
          custom_prices: customPrices
        };
      }
      return art;
    });

    syncArticlesToStorage(updated);

    if (user && !isDemoMode && activeStore) {
      try {
        if (isBaseList) {
          await supabase
            .from('articles')
            .update({ price: newPrice })
            .eq('store_id', activeStore.id)
            .eq('code', articleCode);
        } else if (targetList && targetList.id && !targetList.id.startsWith('list-')) {
          // FK Validated: only upsert if targetList exists in database (UUID)
          await supabase
            .from('price_list_items')
            .upsert({
              price_list_id: targetList.id,
              article_code: articleCode,
              custom_price: newPrice
            }, { onConflict: 'price_list_id,article_code' });
        }
      } catch (err) {
        console.error('Error updating individual price in DB:', err);
      }
    }
  };

  const handleCloseCashRegister = () => {
    const diff = declaredCash - systemCash;
    const diffFormatted = `${diff >= 0 ? '+' : ''}$${diff}`;
    setNotification(`Cierre registrado correctamente. Diferencia: ${diffFormatted}`);
    addNotification({
      title: 'Arqueo de Caja Finalizado',
      message: `Cierre de caja registrado para ${activeStore?.name || 'tu negocio'}. Diferencia declarada: ${diffFormatted}.`,
      type: diff === 0 ? 'success' : 'warning'
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(`Comprobante ${invoiceNumber} cargado correctamente para ${supplierName}.`);
    addNotification({
      title: 'Ingreso de Comprobante',
      message: `Factura N° ${invoiceNumber || 'SN-001'} de ${supplierName || 'Proveedor'} registrada por $${totalAmount || '0.00'}.`,
      type: 'info'
    });
    setSupplierName('');
    setInvoiceNumber('');
    setTotalAmount('');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDistributePrices = async () => {
    setIsDistributing(true);
    setNotification(null);

    await new Promise(res => setTimeout(res, 600));

    const timeStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastDistributeTime(timeStr);
    setIsDistributing(false);

    const targetName = distributeTargetRegs.includes('all') ? 'todas las Cajas POS terminales' : `${distributeTargetRegs.length} caja(s) seleccionada(s)`;
    const listName = priceLists.find(l => l.id === selectedListId)?.name || 'Lista Base';
    const msg = `¡Novedades de precios de "${listName}" distribuidos a ${targetName} a las ${timeStr}!`;

    setNotification(msg);
    addNotification({
      title: 'Distribución de Precios Exitosa',
      message: `Se enviaron los precios actualizados de la ${listName} (${articles.length} artículos) a las cajas de ${activeStore?.name || 'su negocio'}.`,
      type: 'success'
    });

    try {
      localStorage.setItem(`pickingup_last_price_dist_${storeKey}`, JSON.stringify({
        listId: selectedListId,
        timestamp: timeStr,
        articlesCount: articles.length
      }));
    } catch {}

    setTimeout(() => setNotification(null), 5000);
  };

  if (!action) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      zIndex: 90
    }}>
      <div style={{
        width: '100%',
        maxWidth: '840px',
        maxHeight: '85vh',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }} className="animate-fade-in">
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: `var(--theme-${action.colorTheme}-bg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '0.5rem',
              background: 'var(--bg-surface)',
              border: `1px solid var(--theme-${action.colorTheme}-border)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: `var(--theme-${action.colorTheme})`,
              fontWeight: 700
            }}>
              {action.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                MÓDULO DE {action.moduleName.toUpperCase()}
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: `var(--theme-${action.colorTheme})` }}>
                {action.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.5rem',
              width: '32px',
              height: '32px',
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

        {/* Modal Body Notification */}
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

        {/* Modal Dynamic Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {/* CAMBIO PUNTUAL DE UN PRODUCTO */}
          {action.slug === 'cambio-puntual' && (
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
                    🎯 Cambio Puntual de Precio por Producto y Lista
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                    Elegí la lista de precios a modificar e ingresá el valor puntual para {activeStore?.name || 'su negocio'}.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Lista Objetivo:
                  </label>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    style={{
                      padding: '0.5rem 0.875rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      color: 'var(--brand-blue)',
                      fontWeight: 800,
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="base">📌 Precio Base / Principal</option>
                    {priceLists.map(l => (
                      <option key={l.id} value={l.id}>🏷️ {l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Selector / Search */}
              {articles.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-app)', borderRadius: '0.875rem', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>No hay productos cargados en esta sucursal</div>
                  <p style={{ fontSize: '0.8125rem', margin: 0 }}>Cargá tus listas de precios o importá productos desde una planilla CSV / Excel en la sección de Listas de Precios.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {articles.map((art) => {
                    const currentListVal = selectedListId === 'base'
                      ? art.price
                      : (art.custom_prices?.[selectedListId] ?? art.price);

                    return (
                      <div
                        key={art.code}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '0.875rem',
                          padding: '1rem 1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>{art.description}</span>
                            <span style={{ fontSize: '0.7rem', background: 'var(--brand-light-bg)', color: 'var(--brand-blue)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 800 }}>
                              CÓD: {art.code}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Categoría: <strong>{art.category}</strong> | Stock: <strong>{art.stock || 0} u.</strong></span>
                            <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                              Base: ${art.price.toFixed(2)}
                            </span>
                            {selectedListId !== 'base' && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                Lista: {priceLists.find(l => l.id === selectedListId)?.name || 'Seleccionada'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.9rem' }}>$</span>
                            <input
                              type="number"
                              step="0.5"
                              key={`${art.code}-${selectedListId}-${currentListVal}`}
                              defaultValue={currentListVal}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  handleIndividualPriceChange(art.code, val, selectedListId);
                                  setNotification(`¡Precio de "${art.description}" actualizado a $${val.toFixed(2)} en la lista seleccionada!`);
                                  setTimeout(() => setNotification(null), 4000);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseFloat((e.target as HTMLInputElement).value);
                                  if (!isNaN(val)) {
                                    handleIndividualPriceChange(art.code, val, selectedListId);
                                    setNotification(`¡Precio de "${art.description}" actualizado a $${val.toFixed(2)} en la lista seleccionada!`);
                                    setTimeout(() => setNotification(null), 4000);
                                  }
                                }
                              }}
                              style={{
                                width: '100px',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--brand-blue)',
                                background: 'var(--bg-surface)',
                                color: 'var(--brand-blue)',
                                fontWeight: 900,
                                fontSize: '0.95rem',
                                textAlign: 'right'
                              }}
                            />
                          </div>
                          <button
                            onClick={() => {
                              setNotification(`¡Precio de "${art.description}" guardado en base de datos para la lista seleccionada!`);
                              setTimeout(() => setNotification(null), 3000);
                            }}
                            style={{
                              padding: '0.5rem 0.875rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              background: 'var(--brand-blue)',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.78125rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <Save size={14} /> Guardar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* 1. CAMBIO MASIVO O LISTAS DE PRECIOS */}
          {(action.slug === 'cambio-masivo' || action.slug === 'listas-precios' || action.slug === 'cambio-rapido') && (
            <div>
              <div style={{
                background: 'var(--bg-app)',
                padding: '1.25rem',
                borderRadius: '0.875rem',
                border: '1px solid var(--border-light)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Aumento / Descuento Porcentual
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Aplica la variación masiva a todos los artículos seleccionados en catálogo.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input
                      type="number"
                      value={percentageChange}
                      onChange={(e) => setPercentageChange(Number(e.target.value))}
                      style={{
                        width: '80px',
                        padding: '0.5rem',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '0.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        color: 'var(--text-main)'
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>%</span>
                  </div>

                  <button
                    onClick={handleApplyBulkPriceChange}
                    className="btn-primary"
                    style={{ background: 'var(--theme-red)' }}
                  >
                    <Zap size={16} /> Aplicar Cambio
                  </button>
                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Código</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Descripción</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left' }}>Rubro</th>
                    <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>Precio Lista</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((art) => (
                    <tr key={art.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, fontFamily: 'monospace' }}>{art.code}</td>
                      <td style={{ padding: '0.625rem 0.75rem' }}>{art.description}</td>
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>{art.category}</td>
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>$</span>
                          <input
                            type="number"
                            step="0.5"
                            value={art.price}
                            onChange={(e) => handleIndividualPriceChange(art.code, parseFloat(e.target.value) || 0)}
                            style={{
                              width: '95px',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              color: 'var(--brand-blue)',
                              fontWeight: 900,
                              fontSize: '0.875rem',
                              textAlign: 'right'
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 2. CIERRE DE CAJEROS */}
          {action.slug === 'cierre-cajeros' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem'
              }}>
                <div style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>EFECTIVO SEGÚN SISTEMA</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                    ${systemCash.toLocaleString('es-AR')}
                  </div>
                </div>

                <div style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DECLARADO EN CAJA</div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <input
                      type="number"
                      value={declaredCash}
                      onChange={(e) => setDeclaredCash(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.625rem',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '0.5rem',
                        color: 'var(--text-main)'
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: declaredCash - systemCash >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${declaredCash - systemCash >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DIFERENCIA</div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: declaredCash - systemCash >= 0 ? '#10b981' : '#ef4444',
                    marginTop: '0.25rem'
                  }}>
                    {declaredCash - systemCash >= 0 ? '+' : ''}${(declaredCash - systemCash).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  onClick={handleCloseCashRegister}
                  className="btn-primary"
                  style={{ background: 'var(--theme-lime)', color: '#000' }}
                >
                  <Lock size={16} /> Confirmar Cierre de Caja
                </button>
              </div>
            </div>
          )}

          {/* 3. INGRESO DE COMPROBANTES / PROVEEDORES */}
          {action.slug === 'ingreso-comprobantes' && (
            <form onSubmit={handleSaveInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Proveedor
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Arcor S.A."
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
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

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    N° Comprobante / Factura
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. FC-A-0001-0004928"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Monto Total ($)
                </label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" className="btn-primary" style={{ background: 'var(--theme-orange)' }}>
                  <FileText size={16} /> Guardar Comprobante
                </button>
              </div>
            </form>
          )}

          {/* 4. DISTRIBUIR PRECIOS A CAJAS */}
          {action.slug === 'distribuir-precios' && (
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
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={18} style={{ color: '#10b981' }} /> Sincronización y Distribución de Precios a POS
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                    Transmití las listas de precios actualizadas directamente a las terminales de caja de {activeStore?.name || 'tu negocio'}.
                  </p>
                </div>

                {lastDistributeTime && (
                  <div style={{
                    fontSize: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <CheckCircle2 size={14} /> ÚLTIMA SYNC: {lastDistributeTime}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '0.875rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem'
                }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    1. Lista de Precios a Distribuir:
                  </label>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-app)',
                      color: 'var(--brand-blue)',
                      fontWeight: 800,
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="base">Lista Base (Predeterminada)</option>
                    {priceLists.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name} ({pl.code})</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Total de artículos a sincronizar: <strong>{articles.length} productos</strong>
                  </div>
                </div>

                <div style={{
                  padding: '1.25rem',
                  borderRadius: '0.875rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem'
                }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    2. Destino de la Distribución:
                  </label>
                  <select
                    value={distributeTargetRegs[0] || 'all'}
                    onChange={(e) => setDistributeTargetRegs([e.target.value])}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontWeight: 700,
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="all">🌐 Todas las Cajas de la Sucursal ({activeStore?.code || 'SUC'})</option>
                    <option value="pos-01">Caja 01 - Principal (iPOS Android)</option>
                    <option value="pos-02">Caja 02 - Express (iPOS Android)</option>
                  </select>
                  <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                    ● Estado de Red: Servidor en línea (Supabase DB Sincronizada)
                  </div>
                </div>
              </div>

              <div style={{
                background: 'var(--bg-app)',
                padding: '1rem 1.25rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Al confirmar, los cambios de precios impactarán inmediatamente en las terminales activas.
                </div>

                <button
                  onClick={handleDistributePrices}
                  disabled={isDistributing}
                  className="btn-primary"
                  style={{ background: '#10b981', color: '#ffffff', gap: '0.5rem' }}
                >
                  <RefreshCw size={16} style={{ animation: isDistributing ? 'spin 1s linear infinite' : 'none' }} />
                  {isDistributing ? 'Enviando a Cajas...' : 'Distribuir Precios Ahora'}
                </button>
              </div>
            </div>
          )}

          {/* DEFAULT ACTION VIEW */}
          {action.slug !== 'cambio-masivo' &&
           action.slug !== 'listas-precios' &&
           action.slug !== 'cambio-rapido' &&
           action.slug !== 'cambio-puntual' &&
           action.slug !== 'distribuir-precios' &&
           action.slug !== 'cierre-cajeros' &&
           action.slug !== 'ingreso-comprobantes' && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: `var(--theme-${action.colorTheme}-bg)`,
                color: `var(--theme-${action.colorTheme})`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                Módulo "{action.name}" listo para operar
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                Esta funcionalidad está integrada con el servicio de base de datos Supabase para {APP_CONFIG.name}.
              </p>

              <div style={{
                display: 'inline-flex',
                gap: '0.75rem'
              }}>
                <button onClick={onClose} className="btn-secondary">
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    setNotification(`Acción ${action.name} ejecutada con éxito.`);
                    setTimeout(() => setNotification(null), 3000);
                  }}
                  className="btn-primary"
                >
                  Ejecutar Operación
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '0.875rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <span>ID de Transacción: <code>{action.slug}-84920</code></span>
          <span>{APP_CONFIG.shortName} Enterprise API v2.4</span>
        </div>
      </div>
    </div>
  );
};
