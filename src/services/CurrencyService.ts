import { supabase, isValidUUID } from '../lib/supabase';

export interface CurrencyRate {
  currency_code: 'USD_OFFICIAL' | 'USD_BLUE' | 'USD_MEP' | 'EUR';
  currency_name: string;
  rate_to_ars: number;
  source?: string;
  updated_at?: string;
}

export const DEFAULT_RATES: Record<string, number> = {
  USD_OFFICIAL: 1250.00,
  USD_BLUE: 1380.00,
  USD_MEP: 1320.00,
  EUR: 1420.00
};

export const fetchCurrencyRates = async (storeId?: string): Promise<Record<string, number>> => {
  const ratesMap: Record<string, number> = { ...DEFAULT_RATES };
  const storeKey = storeId || 'demo-store';

  // 1. Try Local Storage Cache
  try {
    const raw = localStorage.getItem(`pickingup_currency_rates_${storeKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(ratesMap, parsed);
    }
  } catch {}

  // 2. Try DB Fetch if storeId is valid
  if (storeId && isValidUUID(storeId)) {
    try {
      const { data, error } = await supabase
        .from('currency_rates')
        .select('*')
        .eq('store_id', storeId);

      if (!error && data && data.length > 0) {
        data.forEach(r => {
          if (r.currency_code && r.rate_to_ars) {
            ratesMap[r.currency_code] = Number(r.rate_to_ars);
          }
        });
      }
    } catch {}
  }

  // 3. Fallback to DolarApi Public Endpoint if uninitialized
  try {
    const resp = await fetch('https://dolarapi.com/v1/dolares');
    if (resp.ok) {
      const list = await resp.json();
      const oficial = list.find((d: any) => d.casa === 'oficial')?.venta;
      const blue = list.find((d: any) => d.casa === 'blue')?.venta;

      if (oficial) ratesMap.USD_OFFICIAL = Number(oficial);
      if (blue) ratesMap.USD_BLUE = Number(blue);

      localStorage.setItem(`pickingup_currency_rates_${storeKey}`, JSON.stringify(ratesMap));
    }
  } catch {}

  return ratesMap;
};

export const triggerUpdateCurrencyRatesEdgeFunction = async (storeId?: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('update-currency-rates', {
      body: { store_id: storeId }
    });
    if (!error && data?.success) {
      console.log('[CurrencyService] Edge Function rates updated:', data);
      return true;
    }
  } catch (err) {
    console.warn('[CurrencyService] Edge Function invocation warning:', err);
  }
  return false;
};

export const convertARS = (amountARS: number, targetCurrency: string, ratesMap: Record<string, number>): number => {
  if (!amountARS || amountARS <= 0) return 0;
  if (targetCurrency === 'ARS') return amountARS;

  const rate = ratesMap[targetCurrency] || DEFAULT_RATES[targetCurrency] || 1;
  return amountARS / rate;
};

export const formatCurrencyAmount = (amount: number, currencyCode = 'ARS'): string => {
  if (currencyCode === 'USD' || currencyCode === 'USD_OFFICIAL' || currencyCode === 'USD_BLUE') {
    return `US$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currencyCode === 'EUR') {
    return `€ ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$ ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
