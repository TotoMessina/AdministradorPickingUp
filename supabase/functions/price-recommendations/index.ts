// @ts-nocheck
// Supabase Edge Function: /functions/v1/price-recommendations
// Analiza rotación histórica de stock, margen de ganancia por categoría e historial de price_audit_logs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestPayload {
  store_id: string;
  options?: {
    period_days?: number;
    target_margin_percent?: number;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    const body: RequestPayload = await req.json();
    const { store_id, options } = body;

    if (!store_id) {
      return new Response(
        JSON.stringify({ error: "Missing store_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const periodDays = options?.period_days || 30;
    const defaultTargetMargin = options?.target_margin_percent || 30;

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - periodDays);
    const isoThreshold = dateThreshold.toISOString();

    // 1. Fetch Articles
    const { data: articles, error: artErr } = await supabase
      .from("articles")
      .select("id, code, description, category, price, base_price, cost, stock, min_stock")
      .eq("store_id", store_id);

    if (artErr) {
      throw artErr;
    }

    // 2. Fetch Sales & Sales Items within period
    const { data: sales, error: salesErr } = await supabase
      .from("sales")
      .select("id, created_at, sales_items(article_code, qty, unit_price, cost_price, total_price)")
      .eq("store_id", store_id)
      .gte("created_at", isoThreshold);

    if (salesErr) {
      console.warn("Error fetching sales for recommendations:", salesErr);
    }

    // 3. Fetch Price Audit Logs within period
    const { data: auditLogs, error: auditErr } = await supabase
      .from("price_audit_logs")
      .select("id, article_code, old_price, new_price, created_at")
      .eq("store_id", store_id)
      .gte("created_at", isoThreshold);

    if (auditErr) {
      console.warn("Error fetching price audit logs for recommendations:", auditErr);
    }

    // Process Sales Data per Article Code
    const salesVolumeMap: Record<string, { qty: number; revenue: number }> = {};
    (sales || []).forEach((sale: any) => {
      (sale.sales_items || []).forEach((item: any) => {
        const code = item.article_code;
        if (!salesVolumeMap[code]) {
          salesVolumeMap[code] = { qty: 0, revenue: 0 };
        }
        salesVolumeMap[code].qty += Number(item.qty) || 1;
        salesVolumeMap[code].revenue += Number(item.total_price) || (Number(item.qty || 1) * Number(item.unit_price || 0));
      });
    });

    // Process Audit Logs per Article Code
    const auditCountMap: Record<string, number> = {};
    (auditLogs || []).forEach((log: any) => {
      const code = log.article_code;
      auditCountMap[code] = (auditCountMap[code] || 0) + 1;
    });

    // Generate Recommendations
    let suggestedIncreases = 0;
    let suggestedDiscounts = 0;
    let suggestedMarginFixes = 0;
    let estimatedProfitUplift = 0;

    const recommendations = (articles || []).map((art: any) => {
      const currentPrice = Number(art.price ?? art.base_price) || 0;
      const costPrice = Number(art.cost) || 0;
      const stock = Number(art.stock) || 0;
      const minStock = Number(art.min_stock) || 5;

      const salesData = salesVolumeMap[art.code] || { qty: 0, revenue: 0 };
      const unitsSold = salesData.qty;
      const auditCount = auditCountMap[art.code] || 0;

      // Rotation index: Units sold in period / Stock
      const rotationIndex = stock > 0 ? unitsSold / stock : unitsSold > 0 ? 2.0 : 0;
      const currentMarginPercent = currentPrice > 0 ? ((currentPrice - costPrice) / currentPrice) * 100 : 0;

      let action: "AUMENTAR" | "DESCUENTO" | "AJUSTAR_MARGEN" | "MANTENER" = "MANTENER";
      let suggestedPrice = currentPrice;
      let changePercent = 0;
      let confidenceScore = 0.85;
      let reason = "El precio y rotación se encuentran en niveles equilibrados.";

      // Decision Tree Algorithm
      if (currentMarginPercent < 15 || currentPrice <= costPrice) {
        // Critical Margin Fix
        action = "AJUSTAR_MARGEN";
        const targetCostPrice = costPrice > 0 ? costPrice / (1 - (defaultTargetMargin / 100)) : currentPrice * 1.25;
        suggestedPrice = Math.round(targetCostPrice);
        changePercent = currentPrice > 0 ? ((suggestedPrice - currentPrice) / currentPrice) * 100 : 25;
        confidenceScore = 0.95;
        reason = `Margen crítico (${currentMarginPercent.toFixed(1)}%). Se sugiere ajustar precio para alcanzar la meta de margen del ${defaultTargetMargin}%.`;
        suggestedMarginFixes++;
      } else if (rotationIndex >= 1.2 && currentMarginPercent < 35) {
        // High Rotation -> Opportunity to Increase Price
        action = "AUMENTAR";
        const increaseRate = rotationIndex >= 2.0 ? 0.12 : 0.08;
        suggestedPrice = Math.round(currentPrice * (1 + increaseRate));
        changePercent = Number((increaseRate * 100).toFixed(1));
        confidenceScore = 0.90;
        reason = `Alta rotación de stock (${unitsSold} u. vendidas en ${periodDays} días). Es posible incrementar el margen sin impactar la demanda.`;
        suggestedIncreases++;
      } else if (rotationIndex < 0.15 && stock > (minStock * 2) && stock >= 10) {
        // Stagnant Stock -> Offer / Discount to Liquidate
        action = "DESCUENTO";
        const discountRate = stock > (minStock * 4) ? 0.15 : 0.08;
        suggestedPrice = Math.max(Math.round(costPrice * 1.05), Math.round(currentPrice * (1 - discountRate)));
        changePercent = currentPrice > 0 ? -Number(((currentPrice - suggestedPrice) / currentPrice * 100).toFixed(1)) : -8;
        confidenceScore = 0.88;
        reason = `Baja rotación (${unitsSold} u. vendidas) y sobre-stock de ${stock} u. Se sugiere oferta promocional para liberar capital de trabajo.`;
        suggestedDiscounts++;
      }

      const projectedUnitProfitCurrent = Math.max(0, currentPrice - costPrice);
      const projectedUnitProfitSuggested = Math.max(0, suggestedPrice - costPrice);
      const profitDelta = (projectedUnitProfitSuggested - projectedUnitProfitCurrent) * Math.max(1, unitsSold);
      estimatedProfitUplift += profitDelta;

      return {
        article_code: art.code,
        description: art.description,
        category: art.category || "General",
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

    const responseData = {
      success: true,
      store_id,
      generated_at: new Date().toISOString(),
      metrics_summary: {
        total_analyzed: articles?.length || 0,
        suggested_increases: suggestedIncreases,
        suggested_discounts: suggestedDiscounts,
        suggested_margin_fixes: suggestedMarginFixes,
        estimated_profit_uplift: Math.round(estimatedProfitUplift)
      },
      recommendations
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("Error executing price-recommendations Edge Function:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
