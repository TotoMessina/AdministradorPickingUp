// @ts-nocheck
// Supabase Edge Function: /functions/v1/update-currency-rates
// Consulta cotizaciones al día (USD Oficial, Blue, MEP, Euro) desde APIs públicas y actualiza public.currency_rates
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

    // Fetch Live Exchange Rates from DolarApi / Bluelytics APIs
    let usdOficial = 1250.00;
    let usdBlue = 1380.00;
    let usdMep = 1320.00;
    let euro = 1420.00;

    try {
      const respDolares = await fetch("https://dolarapi.com/v1/dolares");
      if (respDolares.ok) {
        const data = await respDolares.json();
        const oficialObj = data.find((d: any) => d.casa === "oficial");
        const blueObj = data.find((d: any) => d.casa === "blue");
        const mepObj = data.find((d: any) => d.casa === "bolsa");

        if (oficialObj?.venta) usdOficial = Number(oficialObj.venta);
        if (blueObj?.venta) usdBlue = Number(blueObj.venta);
        if (mepObj?.venta) usdMep = Number(mepObj.venta);
      }

      const respEuro = await fetch("https://dolarapi.com/v1/cotizaciones/eur");
      if (respEuro.ok) {
        const eurData = await respEuro.json();
        if (eurData?.venta) euro = Number(eurData.venta);
      }
    } catch (err) {
      console.warn("Public exchange rate API fallback warning:", err);
    }

    const ratesToUpsert = [
      { currency_code: "USD_OFFICIAL", currency_name: "Dólar Oficial", rate_to_ars: usdOficial, source: "DolarApi / BCRA" },
      { currency_code: "USD_BLUE", currency_name: "Dólar Blue", rate_to_ars: usdBlue, source: "DolarApi Mercado" },
      { currency_code: "USD_MEP", currency_name: "Dólar MEP", rate_to_ars: usdMep, source: "DolarApi Bolsa" },
      { currency_code: "EUR", currency_name: "Euro", rate_to_ars: euro, source: "DolarApi Euro" }
    ];

    if (storeId) {
      const dbPayload = ratesToUpsert.map(r => ({ ...r, store_id: storeId }));
      await supabase.from("currency_rates").upsert(dbPayload, { onConflict: "store_id,currency_code" });
    }

    return new Response(
      JSON.stringify({
        success: true,
        store_id: storeId,
        updated_at: new Date().toISOString(),
        rates: ratesToUpsert
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error executing update-currency-rates Edge Function:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
