// @ts-nocheck
// Supabase Edge Function: /functions/v1/cron-smart-alerts
// Ejecución cron programada (diario 8:00 AM) para evaluar reglas de negocio e insertar alertas en public.notifications
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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

    let storeId: string | null = null;
    try {
      const body = await req.json();
      storeId = body.store_id || null;
    } catch {}

    const notificationsToInsert: any[] = [];

    // 1. RULE 1: Stock Crítico (articles.stock <= articles.min_stock)
    let articlesQuery = supabase.from("articles").select("code, description, stock, min_stock, store_id");
    if (storeId) articlesQuery = articlesQuery.eq("store_id", storeId);

    const { data: lowStockArticles } = await articlesQuery;

    if (lowStockArticles) {
      lowStockArticles.forEach((art) => {
        if (art.stock <= art.min_stock) {
          notificationsToInsert.push({
            store_id: art.store_id,
            title: `⚠️ Stock Crítico: ${art.description}`,
            message: `Quedan solo ${art.stock} unidades de "${art.description}" (Mínimo configurado: ${art.min_stock}).`,
            type: "warning",
            is_read: false
          });
        }
      });
    }

    // 2. RULE 2: Facturas de Proveedores por Vencer / Pendientes
    let invoicesQuery = supabase.from("supplier_invoices").select("id, invoice_number, supplier_name, amount, due_date, status, store_id");
    if (storeId) invoicesQuery = invoicesQuery.eq("store_id", storeId);

    const { data: pendingInvoices } = await invoicesQuery;

    if (pendingInvoices) {
      pendingInvoices.forEach((inv) => {
        if (inv.status === "Pendiente" || inv.status === "Por Vencer") {
          notificationsToInsert.push({
            store_id: inv.store_id,
            title: `📄 Vencimiento Factura: ${inv.supplier_name || 'Proveedor'}`,
            message: `La factura #${inv.invoice_number || inv.id} por $${Number(inv.amount || 0).toFixed(2)} se encuentra pendiente de pago.`,
            type: "error",
            is_read: false
          });
        }
      });
    }

    // 3. RULE 3: Resumen Diario de Ventas del Día
    let salesQuery = supabase.from("sales").select("total_amount, store_id, created_at");
    if (storeId) salesQuery = salesQuery.eq("store_id", storeId);

    const { data: salesToday } = await salesQuery;

    if (salesToday && salesToday.length > 0) {
      const storeTotalMap: Record<string, { count: number; total: number }> = {};

      salesToday.forEach((s) => {
        const sId = s.store_id || "default";
        if (!storeTotalMap[sId]) storeTotalMap[sId] = { count: 0, total: 0 };
        storeTotalMap[sId].count += 1;
        storeTotalMap[sId].total += Number(s.total_amount) || 0;
      });

      for (const [stId, metrics] of Object.entries(storeTotalMap)) {
        notificationsToInsert.push({
          store_id: stId === "default" ? null : stId,
          title: `📈 Resumen Diario de Ventas`,
          message: `Se registraron ${metrics.count} cobranzas por un total de $${metrics.total.toFixed(2)}.`,
          type: "success",
          is_read: false
        });
      }
    }

    // Insert Evaluated Notifications into DB
    let insertedCount = 0;
    if (notificationsToInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase
        .from("notifications")
        .insert(notificationsToInsert.slice(0, 50)); // Limit batch insertion

      if (!insErr) {
        insertedCount = notificationsToInsert.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cron_executed_at: new Date().toISOString(),
        evaluated_rules: 4,
        inserted_notifications_count: insertedCount,
        notifications: notificationsToInsert
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error executing cron-smart-alerts Edge Function:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
