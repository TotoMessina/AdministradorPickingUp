import { supabase, isValidUUID } from '../lib/supabase';
import { logPriceChange } from './AuditLoggerService';

export interface AIPriceRecommendationItem {
  article_code: string;
  description: string;
  category: string;
  current_price: number;
  cost_price: number;
  current_margin_percent: number;
  suggested_price: number;
  suggested_change_percent: number;
  action: 'AUMENTAR' | 'DESCUENTO' | 'AJUSTAR_MARGEN' | 'MANTENER';
  confidence_score: number;
  reason: string;
  units_sold_period: number;
  stock_qty: number;
  rotation_index: number;
  price_audit_changes: number;
}

export interface AIPriceRecommendationsResponse {
  success: boolean;
  store_id: string;
  generated_at: string;
  metrics_summary: {
    total_analyzed: number;
    suggested_increases: number;
    suggested_discounts: number;
    suggested_margin_fixes: number;
    estimated_profit_uplift: number;
  };
  recommendations: AIPriceRecommendationItem[];
}

export const fetchAIPriceRecommendations = async (
  storeId: string,
  options?: { periodDays?: number; targetMarginPercent?: number }
): Promise<AIPriceRecommendationsResponse> => {
  const periodDays = options?.periodDays || 30;
  const targetMargin = options?.targetMarginPercent || 30;

  // 1. Try Invoking Supabase Edge Function
  if (isValidUUID(storeId)) {
    try {
      const { data, error } = await supabase.functions.invoke('price-recommendations', {
        body: {
          store_id: storeId,
          options: {
            period_days: periodDays,
            target_margin_percent: targetMargin
          }
        }
      });

      if (!error && data && data.success && data.recommendations) {
        return data;
      }
    } catch (err) {
      console.warn('Edge Function invocation un-reachable, executing fallback engine:', err);
    }
  }

  // 2. Client-Side Fallback Engine (for Local Storage / Offline / Demo Mode)
  let articles: any[] = [];
  let salesList: any[] = [];
  let auditLogs: any[] = [];

  // Read Local Storage Articles
  try {
    const rawProds = localStorage.getItem(`pickingup_prodprices_${storeId}`);
    if (rawProds) articles = JSON.parse(rawProds);

    const rawSales = localStorage.getItem(`pickingup_sales_history_${storeId}`);
    if (rawSales) salesList = JSON.parse(rawSales);

    const rawAudits = localStorage.getItem(`pickingup_audit_logs_${storeId}`);
    if (rawAudits) auditLogs = JSON.parse(rawAudits);
  } catch {}

  // If connected to Supabase DB, fetch active DB records
  if (isValidUUID(storeId)) {
    try {
      const { data: dbArts } = await supabase
        .from('articles')
        .select('*')
        .eq('store_id', storeId);
      if (dbArts && dbArts.length > 0) articles = dbArts;

      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - periodDays);

      const { data: dbSales } = await supabase
        .from('sales')
        .select('*, sales_items(*)')
        .eq('store_id', storeId)
        .gte('created_at', dateThreshold.toISOString());

      if (dbSales && dbSales.length > 0) {
        salesList = dbSales.map((s: any) => ({
          created_at: s.created_at,
          items: s.sales_items || []
        }));
      }

      const { data: dbAudits } = await supabase
        .from('price_audit_logs')
        .select('*')
        .eq('store_id', storeId)
        .gte('created_at', dateThreshold.toISOString());

      if (dbAudits && dbAudits.length > 0) auditLogs = dbAudits;
    } catch {}
  }

  // Process Sales & Rotation Map
  const salesVolumeMap: Record<string, number> = {};
  salesList.forEach((sale: any) => {
    const items = sale.items || sale.sales_items || [];
    items.forEach((item: any) => {
      const code = item.code || item.article_code;
      if (code) {
        salesVolumeMap[code] = (salesVolumeMap[code] || 0) + (Number(item.qty) || 1);
      }
    });
  });

  const auditCountMap: Record<string, number> = {};
  auditLogs.forEach((log: any) => {
    const code = log.article_code;
    if (code) {
      auditCountMap[code] = (auditCountMap[code] || 0) + 1;
    }
  });

  let suggestedIncreases = 0;
  let suggestedDiscounts = 0;
  let suggestedMarginFixes = 0;
  let estimatedProfitUplift = 0;

  const recommendations: AIPriceRecommendationItem[] = articles.map(art => {
    const currentPrice = Number(art.price ?? art.base_price) || 0;
    const costPrice = Number(art.cost) || 0;
    const stock = Number(art.stock) || 0;
    const minStock = Number(art.min_stock) || 5;

    const unitsSold = salesVolumeMap[art.code] || 0;
    const auditCount = auditCountMap[art.code] || 0;
    const rotationIndex = stock > 0 ? unitsSold / stock : (unitsSold > 0 ? 2.0 : 0);
    const currentMarginPercent = currentPrice > 0 ? ((currentPrice - costPrice) / currentPrice) * 100 : 0;

    let action: 'AUMENTAR' | 'DESCUENTO' | 'AJUSTAR_MARGEN' | 'MANTENER' = 'MANTENER';
    let suggestedPrice = currentPrice;
    let changePercent = 0;
    let confidenceScore = 0.85;
    let reason = 'Rotación de ventas y margen dentro de rangos normales de mercado.';

    if (currentMarginPercent < 15 || currentPrice <= costPrice) {
      action = 'AJUSTAR_MARGEN';
      const targetCostPrice = costPrice > 0 ? costPrice / (1 - (targetMargin / 100)) : currentPrice * 1.25;
      suggestedPrice = Math.round(targetCostPrice);
      changePercent = currentPrice > 0 ? ((suggestedPrice - currentPrice) / currentPrice) * 100 : 25;
      confidenceScore = 0.95;
      reason = `Margen crítico actual (${currentMarginPercent.toFixed(1)}%). Recomendamos reajustar precio para cubrir costos y alcanzar la meta del ${targetMargin}%.`;
      suggestedMarginFixes++;
    } else if (rotationIndex >= 1.2 && currentMarginPercent < 35) {
      action = 'AUMENTAR';
      const rate = rotationIndex >= 2.0 ? 0.12 : 0.08;
      suggestedPrice = Math.round(currentPrice * (1 + rate));
      changePercent = Number((rate * 100).toFixed(1));
      confidenceScore = 0.90;
      reason = `Alta velocidad de venta (${unitsSold} u. vendidas en ${periodDays} días). Es posible incrementar el margen sin desacelerar la demanda.`;
      suggestedIncreases++;
    } else if (rotationIndex < 0.15 && stock > (minStock * 2) && stock >= 10) {
      action = 'DESCUENTO';
      const discountRate = stock > (minStock * 4) ? 0.15 : 0.08;
      suggestedPrice = Math.max(Math.round(costPrice * 1.05), Math.round(currentPrice * (1 - discountRate)));
      changePercent = currentPrice > 0 ? -Number(((currentPrice - suggestedPrice) / currentPrice * 100).toFixed(1)) : -8;
      confidenceScore = 0.88;
      reason = `Inventario inmovilizado (${stock} u. en stock con solo ${unitsSold} u. vendidas). Sugerimos precio promocional para acelerar rotación.`;
      suggestedDiscounts++;
    }

    const projectedProfitCurrent = Math.max(0, currentPrice - costPrice);
    const projectedProfitSuggested = Math.max(0, suggestedPrice - costPrice);
    const delta = (projectedProfitSuggested - projectedProfitCurrent) * Math.max(1, unitsSold);
    estimatedProfitUplift += delta;

    return {
      article_code: art.code,
      description: art.description,
      category: art.category || 'General',
      current_price: currentPrice,
      cost_price: costPrice,
      current_margin_percent: Number(currentMarginPercent.toFixed(1)),
      suggested_price: suggestedPrice,
      suggested_change_percent: Number(changePercent.toFixed(1)),
      action,
      confidence_score: confidenceScore,
      reason,
      units_sold_period: unitsSold,
      stock_qty: stock,
      rotation_index: Number(rotationIndex.toFixed(2)),
      price_audit_changes: auditCount
    };
  });

  return {
    success: true,
    store_id: storeId,
    generated_at: new Date().toISOString(),
    metrics_summary: {
      total_analyzed: articles.length,
      suggested_increases: suggestedIncreases,
      suggested_discounts: suggestedDiscounts,
      suggested_margin_fixes: suggestedMarginFixes,
      estimated_profit_uplift: Math.round(estimatedProfitUplift)
    },
    recommendations
  };
};

export const applyPriceRecommendation = async (
  storeId: string,
  recommendation: AIPriceRecommendationItem,
  userEmail: string
): Promise<void> => {
  const oldPrice = recommendation.current_price;
  const newPrice = recommendation.suggested_price;

  // 1. Update in LocalStorage
  try {
    const key = `pickingup_prodprices_${storeId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const list = JSON.parse(raw);
      const updated = list.map((a: any) => {
        if (a.code === recommendation.article_code) {
          return { ...a, price: newPrice, base_price: newPrice };
        }
        return a;
      });
      localStorage.setItem(key, JSON.stringify(updated));
    }
  } catch {}

  // 2. Update in Supabase DB
  if (isValidUUID(storeId)) {
    try {
      await supabase
        .from('articles')
        .update({ price: newPrice, base_price: newPrice })
        .eq('store_id', storeId)
        .eq('code', recommendation.article_code);
    } catch (err) {
      console.warn('Error updating article price in Supabase:', err);
    }
  }

  // 3. Log Audit Record
  await logPriceChange({
    store_id: storeId,
    article_code: recommendation.article_code,
    article_description: recommendation.description,
    price_list_name: 'Lista Base (Sugerencia IA)',
    old_price: oldPrice,
    new_price: newPrice,
    reason: `Sugerencia IA (${recommendation.action}): ${recommendation.reason}`,
    user_email: userEmail
  });
};
