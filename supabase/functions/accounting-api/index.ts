// @ts-nocheck
// Supabase Edge Function: /functions/v1/accounting-api
// API REST de Integración Contable para ERPs externos (TANGO, Bejerman, SAP, Holistor)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id") || "";
    const exportType = url.searchParams.get("type") || "sales"; // sales, stock, libro-iva

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    if (!storeId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: store_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Export Type: Sales Vouchers (Ventas para ERP)
    if (exportType === "sales") {
      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, ticket_number, total_amount, payment_method, cashier_email, customer_name, invoice_type, created_at, sales_items(*)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const formattedSales = (sales || []).map(s => {
        const total = Number(s.total_amount) || 0;
        const neto = Math.round((total / 1.21) * 100) / 100;
        const iva = Math.round((total - neto) * 100) / 100;

        return {
          id: s.id,
          comprobante_numero: s.ticket_number || s.id,
          fecha: s.created_at,
          tipo_factura: s.invoice_type || "Factura B",
          cliente: s.customer_name || "Consumidor Final",
          metodo_pago: s.payment_method || "Efectivo",
          neto_gravado_21: neto,
          iva_21: iva,
          total_general: total,
          items_count: s.sales_items?.length || 0
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          erp_system_compatible: ["TANGO", "Bejerman", "Holistor", "SAP"],
          store_id: storeId,
          record_count: formattedSales.length,
          data: formattedSales
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Export Type: Stock Valuation (Inventario Valorizado)
    if (exportType === "stock") {
      const { data: articles, error } = await supabase
        .from("articles")
        .select("code, barcode, description, category, price, cost, stock, min_stock")
        .eq("store_id", storeId);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let totalValuationCost = 0;
      let totalValuationPrice = 0;

      const formattedStock = (articles || []).map(a => {
        const stock = Number(a.stock) || 0;
        const cost = Number(a.cost) || 0;
        const price = Number(a.price) || 0;
        const valCost = stock * cost;
        const valPrice = stock * price;

        totalValuationCost += valCost;
        totalValuationPrice += valPrice;

        return {
          codigo: a.code,
          codigo_barras: a.barcode,
          descripcion: a.description,
          categoria: a.category,
          stock_actual: stock,
          precio_costo_unitario: cost,
          precio_venta_unitario: price,
          valorizado_costo_total: valCost,
          valorizado_venta_total: valPrice,
          margin_percent: price > 0 ? Math.round(((price - cost) / price) * 100) : 0
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          store_id: storeId,
          total_articles: formattedStock.length,
          resumen_inventario: {
            total_valorizado_costo: totalValuationCost,
            total_valorizado_venta: totalValuationPrice,
            ganancia_proyectada: totalValuationPrice - totalValuationCost
          },
          data: formattedStock
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unsupported export type. Valid types: sales, stock" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error executing accounting-api Edge Function:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
