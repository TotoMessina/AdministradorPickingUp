import { supabase, isValidUUID } from '../lib/supabase';

export interface OfflineSaleItem {
  code: string;
  barcode?: string;
  description: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface OfflineSaleRecord {
  id: string;
  store_id: string;
  cashier_email: string;
  customer_id?: string;
  customer_name: string;
  invoice_type: string;
  payment_method: string;
  price_list_id: string;
  total: number;
  items: OfflineSaleItem[];
  created_at: string;
  synced: number; // 0 = false, 1 = true
}

const DB_NAME = 'PickingUp_POS_Offline_v1';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export const initOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported in this browser.');
      return reject('IndexedDB not supported');
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;

      // Object Store: Catalog Cache
      if (!db.objectStoreNames.contains('articles_cache')) {
        db.createObjectStore('articles_cache', { keyPath: 'code' });
      }

      // Object Store: Sales Queue
      if (!db.objectStoreNames.contains('sales_queue')) {
        const salesStore = db.createObjectStore('sales_queue', { keyPath: 'id' });
        salesStore.createIndex('synced', 'synced', { unique: false });
        salesStore.createIndex('store_id', 'store_id', { unique: false });
      }
    };
  });
};

// --- ARTICLES CATALOG OFFLINE CACHING ---
export const cacheArticlesOffline = async (articles: any[]): Promise<void> => {
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('articles_cache', 'readwrite');
    const store = tx.objectStore('articles_cache');

    articles.forEach(art => {
      store.put(art);
    });

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch (err) {
    console.error('Error caching articles in IndexedDB:', err);
  }
};

export const getOfflineArticles = async (): Promise<any[]> => {
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('articles_cache', 'readonly');
    const store = tx.objectStore('articles_cache');
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

// --- OFFLINE SALES QUEUE ---
export const queueOfflineSale = async (sale: Omit<OfflineSaleRecord, 'synced'>): Promise<void> => {
  const record: OfflineSaleRecord = {
    ...sale,
    synced: 0
  };

  // 1. Store in IndexedDB
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('sales_queue', 'readwrite');
    const store = tx.objectStore('sales_queue');
    store.put(record);
  } catch (err) {
    console.error('Error queueing sale in IndexedDB:', err);
  }

  // 2. Fallback in LocalStorage
  try {
    const key = `pickingup_offline_sales_${sale.store_id}`;
    const raw = localStorage.getItem(key);
    const list: OfflineSaleRecord[] = raw ? JSON.parse(raw) : [];
    list.push(record);
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore
  }
};

export const getPendingOfflineSalesCount = async (storeId: string): Promise<number> => {
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('sales_queue', 'readonly');
    const store = tx.objectStore('sales_queue');
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const all: OfflineSaleRecord[] = request.result || [];
        const pending = all.filter(s => s.store_id === storeId && s.synced === 0);
        resolve(pending.length);
      };
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
};

// --- SYNC ENGINE: POST PENDING SALES TO SUPABASE ---
export const syncOfflineSalesWithSupabase = async (storeId: string): Promise<{ syncedCount: number; errors: any[] }> => {
  if (!isValidUUID(storeId)) {
    return { syncedCount: 0, errors: [] };
  }
  let pendingSales: OfflineSaleRecord[] = [];

  // Fetch pending sales from IndexedDB
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('sales_queue', 'readonly');
    const store = tx.objectStore('sales_queue');
    const request = store.getAll();

    await new Promise<void>((resolve) => {
      request.onsuccess = () => {
        const all: OfflineSaleRecord[] = request.result || [];
        pendingSales = all.filter(s => s.store_id === storeId && s.synced === 0);
        resolve();
      };
      request.onerror = () => resolve();
    });
  } catch (err) {
    console.error('Error reading pending sales:', err);
  }

  // Also check LocalStorage fallback
  try {
    const key = `pickingup_offline_sales_${storeId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const lsList: OfflineSaleRecord[] = JSON.parse(raw);
      const lsPending = lsList.filter(s => s.synced === 0);
      const existingIds = new Set(pendingSales.map(p => p.id));
      lsPending.forEach(item => {
        if (!existingIds.has(item.id)) {
          pendingSales.push(item);
        }
      });
    }
  } catch {}

  if (pendingSales.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  let syncedCount = 0;
  const errors: any[] = [];

  for (const sale of pendingSales) {
    try {
      // 1. Idempotency / Duplicate Check
      let isAlreadySynced = false;

      if (isValidUUID(sale.id)) {
        const { data: existing } = await supabase
          .from('sales')
          .select('id')
          .eq('id', sale.id)
          .maybeSingle();
        if (existing) {
          isAlreadySynced = true;
        }
      }

      if (!isAlreadySynced && sale.id) {
        const { data: existingByTicket } = await supabase
          .from('sales')
          .select('id')
          .eq('store_id', storeId)
          .eq('ticket_number', sale.id)
          .maybeSingle();
        if (existingByTicket) {
          isAlreadySynced = true;
        }
      }

      if (isAlreadySynced) {
        // Sale already present in Supabase -> Mark local record synced and skip duplicate insertion
        try {
          const db = await initOfflineDB();
          const tx = db.transaction('sales_queue', 'readwrite');
          const store = tx.objectStore('sales_queue');
          sale.synced = 1;
          store.put(sale);
        } catch {}

        syncedCount++;
        continue;
      }

      // 2. Map & Insert into public.sales
      const validSaleId = isValidUUID(sale.id) ? sale.id : crypto.randomUUID();

      let validPaymentMethod = 'Efectivo';
      if (['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta'].includes(sale.payment_method)) {
        validPaymentMethod = sale.payment_method;
      } else if (sale.payment_method === 'Debito' || sale.payment_method === 'Credito') {
        validPaymentMethod = 'Tarjeta';
      }

      const salePayload = {
        id: validSaleId,
        store_id: storeId,
        ticket_number: sale.id,
        cashier_email: sale.cashier_email,
        customer_id: (sale.customer_id && isValidUUID(sale.customer_id)) ? sale.customer_id : null,
        customer_name: sale.customer_name || 'Consumidor Final',
        invoice_type: sale.invoice_type || 'Ticket X',
        payment_method: validPaymentMethod,
        price_list_id: isValidUUID(sale.price_list_id) ? sale.price_list_id : null,
        total_amount: sale.total,
        status: 'Completada',
        synced_at: new Date().toISOString(),
        created_at: sale.created_at || new Date().toISOString()
      };

      const { error: saleErr } = await supabase
        .from('sales')
        .insert([salePayload]);

      if (saleErr) {
        console.warn('Error inserting sale into Supabase public.sales:', saleErr);
      }

      // 3. Insert items into public.sales_items
      if (sale.items && sale.items.length > 0) {
        const codes = sale.items.map(i => i.code);
        const { data: dbArts } = await supabase
          .from('articles')
          .select('id, code, cost')
          .eq('store_id', storeId)
          .in('code', codes);

        const artMap = new Map((dbArts || []).map((a: any) => [a.code, a]));

        const itemInserts = sale.items.map(item => {
          const artInfo = artMap.get(item.code);
          return {
            sale_id: validSaleId,
            article_id: artInfo?.id || null,
            article_code: item.code,
            article_description: item.description,
            qty: item.qty,
            unit_price: item.unitPrice,
            cost_price: Number(artInfo?.cost) || 0,
            total_price: item.subtotal,
            created_at: sale.created_at || new Date().toISOString()
          };
        });

        const { error: itemsErr } = await supabase
          .from('sales_items')
          .insert(itemInserts);

        if (itemsErr) {
          console.warn('Error inserting items into Supabase public.sales_items:', itemsErr);
        }
      }

      // 4. Insert Stock Movements in Supabase
      const movementInserts = sale.items.map(item => ({
        store_id: storeId,
        article_code: item.code,
        movement_type: 'Egreso',
        qty: item.qty,
        notes: `Venta POS (Ticket: ${sale.id}) - ${sale.payment_method}`,
        user_email: sale.cashier_email,
        created_at: sale.created_at || new Date().toISOString()
      }));

      const { error: moveErr } = await supabase
        .from('stock_movements')
        .insert(movementInserts);

      if (moveErr) {
        console.warn('Error inserting stock movements for offline sale:', moveErr);
      }

      // 5. Update Article Stock
      for (const item of sale.items) {
        try {
          const { data: artData } = await supabase
            .from('articles')
            .select('stock')
            .eq('store_id', storeId)
            .eq('code', item.code)
            .single();

          if (artData) {
            const newStock = Math.max(0, (artData.stock || 0) - item.qty);
            await supabase
              .from('articles')
              .update({ stock: newStock })
              .eq('store_id', storeId)
              .eq('code', item.code);
          }
        } catch (e) {
          // Non-blocking
        }
      }

      // Mark as synced in IndexedDB
      try {
        const db = await initOfflineDB();
        const tx = db.transaction('sales_queue', 'readwrite');
        const store = tx.objectStore('sales_queue');
        sale.synced = 1;
        store.put(sale);
      } catch {}

      syncedCount++;
    } catch (err) {
      console.error('Failed to sync offline sale:', sale.id, err);
      errors.push(err);
    }
  }

  // Clear synced from LocalStorage
  try {
    const key = `pickingup_offline_sales_${storeId}`;
    localStorage.removeItem(key);
  } catch {}

  return { syncedCount, errors };
};
