import { supabase, isValidUUID } from '../lib/supabase';

export interface SmartScanResults {
  lowStockCount: number;
  pendingInvoicesCount: number;
  notificationsGenerated: number;
}

export const triggerCronSmartAlertsEdgeFunction = async (storeId?: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('cron-smart-alerts', {
      body: { store_id: storeId }
    });
    if (!error && data?.success) {
      console.log('[SmartAlerts] Cron Edge Function executed:', data);
      return true;
    }
  } catch (err) {
    console.warn('[SmartAlerts] Edge Function invocation warning:', err);
  }
  return false;
};

export const runLocalSmartAlertsScan = async (
  storeId: string,
  addNotification: (params: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }) => void
): Promise<SmartScanResults> => {
  let lowStockCount = 0;
  let pendingInvoicesCount = 0;
  let notificationsGenerated = 0;

  const storeKey = storeId || 'demo-store';

  // 1. Scan Articles for Low Stock (articles.stock <= articles.min_stock)
  let articles: any[] = [];
  try {
    const rawProds = localStorage.getItem(`pickingup_articles_${storeKey}`) || localStorage.getItem(`pickingup_prodprices_${storeKey}`);
    if (rawProds) articles = JSON.parse(rawProds);
  } catch {}

  if (isValidUUID(storeId)) {
    try {
      const { data: dbArticles } = await supabase
        .from('articles')
        .select('*')
        .eq('store_id', storeId);
      if (dbArticles && dbArticles.length > 0) articles = dbArticles;
    } catch {}
  }

  articles.forEach((art) => {
    const stock = Number(art.stock) || 0;
    const minStock = Number(art.min_stock) || 5;

    if (stock <= minStock) {
      lowStockCount++;
      notificationsGenerated++;
      addNotification({
        title: `⚠️ Stock Crítico: ${art.description || art.code}`,
        message: `Quedan solo ${stock} unidades (Mínimo: ${minStock}).`,
        type: 'warning'
      });
    }
  });

  // 2. Scan Supplier Invoices for Pending Expirations
  let invoices: any[] = [];
  try {
    const rawInv = localStorage.getItem(`pickingup_supplier_invoices_${storeKey}`);
    if (rawInv) invoices = JSON.parse(rawInv);
  } catch {}

  invoices.forEach((inv) => {
    if (inv.status === 'Pendiente' || inv.status === 'Por Vencer') {
      pendingInvoicesCount++;
      notificationsGenerated++;
      addNotification({
        title: `📄 Factura por Vencer: ${inv.supplierName || 'Proveedor'}`,
        message: `La factura #${inv.invoiceNumber || inv.id} ($${(Number(inv.amount) || 0).toFixed(2)}) vence próximamente.`,
        type: 'error'
      });
    }
  });

  return {
    lowStockCount,
    pendingInvoicesCount,
    notificationsGenerated
  };
};
