import { supabase, isValidUUID } from '../lib/supabase';

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  const permission = await Notification.requestPermission();
  return permission;
};

export const registerPushSubscriptionInSupabase = async (
  storeId: string,
  subscription: PushSubscription,
  userId?: string
): Promise<boolean> => {
  if (!isValidUUID(storeId)) return false;

  const subJson = subscription.toJSON();
  const endpoint = subJson.endpoint;
  const keys = subJson.keys;

  if (!endpoint || !keys) return false;

  try {
    const { error } = await supabase.from('push_subscriptions').upsert({
      store_id: storeId,
      user_id: isValidUUID(userId) ? userId : null,
      endpoint,
      keys
    }, { onConflict: 'endpoint' });

    if (error) {
      console.warn('Error saving push subscription in Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to register push subscription:', err);
    return false;
  }
};

export const sendLocalNotification = (title: string, body: string, icon = '/favicon.svg') => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon,
      badge: icon
    });
  }
};

export const triggerServerPushNotification = async (
  storeId: string,
  title: string,
  body: string,
  url = '/'
): Promise<boolean> => {
  if (isValidUUID(storeId)) {
    try {
      const { data, error } = await supabase.functions.invoke('push-notifications', {
        body: {
          store_id: storeId,
          title,
          body,
          url
        }
      });
      if (!error && data?.success) {
        return true;
      }
    } catch (e) {
      console.warn('Edge Function push-notifications invocation error:', e);
    }
  }

  // Fallback to local notification
  sendLocalNotification(title, body);
  return true;
};
