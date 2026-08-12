import { supabase, isValidUUID } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeSubscriptionOptions {
  storeId: string;
  userId?: string;
  onSalesChange?: (payload: any) => void;
  onStockChange?: (payload: any) => void;
  onAlertChange?: (payload: any) => void;
}

export interface RealtimeManager {
  salesChannel: RealtimeChannel | null;
  stockChannel: RealtimeChannel | null;
  alertsChannel: RealtimeChannel | null;
  unsubscribeAll: () => void;
}

// 1. Subscribe to Sales Live Channel ('sales-live')
export const subscribeSalesLive = (
  storeId: string,
  onSalesChange: (payload: any) => void
): RealtimeChannel | null => {
  if (!isValidUUID(storeId)) return null;

  const channelName = `sales-live-${storeId}-${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sales',
        filter: `store_id=eq.${storeId}`
      },
      (payload) => {
        console.log('[Realtime] Sales event received:', payload.eventType);
        onSalesChange(payload);
      }
    )
    .subscribe();

  return channel;
};

// 2. Subscribe to Stock Live Channel ('stock-live')
export const subscribeStockLive = (
  storeId: string,
  onStockChange: (payload: any) => void
): RealtimeChannel | null => {
  if (!isValidUUID(storeId)) return null;

  const channelName = `stock-live-${storeId}-${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'articles',
        filter: `store_id=eq.${storeId}`
      },
      (payload) => {
        console.log('[Realtime] Stock/Article event received:', payload.eventType);
        onStockChange(payload);
      }
    )
    .subscribe();

  return channel;
};

// 3. Subscribe to Alerts Live Channel ('alerts-live')
export const subscribeAlertsLive = (
  storeId: string,
  userId: string | undefined,
  onAlertChange: (payload: any) => void
): RealtimeChannel | null => {
  if (!isValidUUID(storeId)) return null;

  const channelName = `alerts-live-${storeId}-${Math.random().toString(36).substring(2, 7)}`;
  let filterString = `store_id=eq.${storeId}`;
  if (isValidUUID(userId)) {
    filterString += `&user_id=eq.${userId}`;
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: filterString
      },
      (payload) => {
        console.log('[Realtime] Notification alert event received:', payload.new);
        onAlertChange(payload.new);
      }
    )
    .subscribe();

  return channel;
};

// 4. Global Manager Initialization Helper
export const initRealtimeMultiStoreChannels = (
  options: RealtimeSubscriptionOptions
): RealtimeManager => {
  const { storeId, userId, onSalesChange, onStockChange, onAlertChange } = options;

  let salesChannel: RealtimeChannel | null = null;
  let stockChannel: RealtimeChannel | null = null;
  let alertsChannel: RealtimeChannel | null = null;

  if (onSalesChange) {
    salesChannel = subscribeSalesLive(storeId, onSalesChange);
  }

  if (onStockChange) {
    stockChannel = subscribeStockLive(storeId, onStockChange);
  }

  if (onAlertChange) {
    alertsChannel = subscribeAlertsLive(storeId, userId, onAlertChange);
  }

  const unsubscribeAll = () => {
    if (salesChannel) supabase.removeChannel(salesChannel);
    if (stockChannel) supabase.removeChannel(stockChannel);
    if (alertsChannel) supabase.removeChannel(alertsChannel);
  };

  return {
    salesChannel,
    stockChannel,
    alertsChannel,
    unsubscribeAll
  };
};
