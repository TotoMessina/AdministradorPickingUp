import { supabase } from '../lib/supabase';

export interface PriceAuditRecord {
  id?: string;
  store_id: string;
  article_code: string;
  article_description: string;
  price_list_name: string;
  old_price: number;
  new_price: number;
  reason: string;
  user_email: string;
  created_at?: string;
}

export const logPriceChange = async (record: PriceAuditRecord): Promise<void> => {
  const fullRecord = {
    ...record,
    id: record.id || `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    created_at: record.created_at || new Date().toISOString()
  };

  // 1. Save to LocalStorage Backup
  try {
    const key = `pickingup_audit_logs_${record.store_id}`;
    const raw = localStorage.getItem(key);
    const prevLogs: PriceAuditRecord[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(key, JSON.stringify([fullRecord, ...prevLogs.slice(0, 200)]));
  } catch (err) {
    console.warn('Error caching audit log in LocalStorage:', err);
  }

  // 2. Persist in Supabase DB
  try {
    await supabase.from('price_audit_logs').insert({
      store_id: record.store_id,
      article_code: record.article_code,
      article_description: record.article_description,
      price_list_name: record.price_list_name,
      old_price: record.old_price,
      new_price: record.new_price,
      reason: record.reason,
      user_email: record.user_email,
      created_at: fullRecord.created_at
    });
  } catch (err) {
    console.error('Error persisting price audit log in Supabase:', err);
  }
};

export const fetchAuditLogs = async (storeId: string): Promise<PriceAuditRecord[]> => {
  let logs: PriceAuditRecord[] = [];

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('price_audit_logs')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('Error fetching audit logs from Supabase:', err);
  }

  // Fallback to LocalStorage
  try {
    const key = `pickingup_audit_logs_${storeId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      logs = JSON.parse(raw);
    }
  } catch {}

  return logs;
};
