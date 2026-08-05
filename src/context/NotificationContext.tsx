import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { supabase, isValidUUID } from '../lib/supabase';

export interface NotificationItem {
  id: string;
  store_id?: string;
  user_id?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  markAllAsRead: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  toggleRead: (id: string) => Promise<void>;
  addNotification: (params: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const { activeStore } = useTenant();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getStorageKey = () => {
    return `pickingup_read_notifs_${user?.id || 'demo'}_${activeStore?.id || 'default'}`;
  };

  const getSavedReadIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (raw) {
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
      }
    } catch {
      // Ignore
    }
    return new Set();
  };

  const saveReadStateLocally = (id: string, isRead: boolean) => {
    try {
      const set = getSavedReadIds();
      if (isRead) {
        set.add(id);
      } else {
        set.delete(id);
      }
      localStorage.setItem(getStorageKey(), JSON.stringify(Array.from(set)));
    } catch {
      // Ignore
    }
  };

  const saveAllReadLocally = (ids: string[]) => {
    try {
      const set = getSavedReadIds();
      ids.forEach(id => set.add(id));
      localStorage.setItem(getStorageKey(), JSON.stringify(Array.from(set)));
    } catch {
      // Ignore
    }
  };

  // Fetch real notifications whenever activeStore or user changes
  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const readSet = getSavedReadIds();

    if (isDemoMode || user.id === 'demo-user-1234' || !activeStore?.isRealDbStore || !isValidUUID(activeStore?.id)) {
      const storeName = activeStore?.name || 'Tu Comercio Demo';
      const demoList: NotificationItem[] = [
        {
          id: 'demo-notif-1',
          title: `¡Bienvenido a ${storeName}!`,
          message: `El portal administrativo está configurado e integrado para tu sucursal.`,
          type: 'success',
          is_read: readSet.has('demo-notif-1') ? true : false,
          created_at: new Date().toISOString()
        },
        {
          id: 'demo-notif-2',
          title: 'Sistema Multi-Tenant Protegido',
          message: 'Tus listas de precios, productos y arqueos de cajas están 100% aislados.',
          type: 'info',
          is_read: readSet.has('demo-notif-2') ? true : false,
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ];
      setNotifications(demoList);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`store_id.eq.${activeStore.id},store_id.is.null`)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const processed = data.map((n: any) => ({
          ...n,
          is_read: n.is_read || readSet.has(n.id)
        }));
        setNotifications(processed as NotificationItem[]);
      } else {
        // Initial real welcome notification if DB table is clean
        const initId = 'init-notif-' + (activeStore?.id || 'main');
        const initialWelcome: NotificationItem = {
          id: initId,
          title: `¡Bienvenido a ${activeStore?.name || 'PickingUp!'}!`,
          message: 'Tu sistema administrativo multi-tenant está listo para operar.',
          type: 'success',
          is_read: readSet.has(initId) ? true : false,
          created_at: new Date().toISOString()
        };
        setNotifications([initialWelcome]);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user, activeStore, isDemoMode]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllAsRead = async () => {
    const allIds = notifications.map(n => n.id);
    saveAllReadLocally(allIds);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    if (user && !isDemoMode && user.id !== 'demo-user-1234' && activeStore?.isRealDbStore && isValidUUID(activeStore?.id)) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .or(`store_id.eq.${activeStore.id},store_id.is.null`);
      } catch {
        // Ignore
      }
    }
  };

  const markAsRead = async (id: string) => {
    saveReadStateLocally(id, true);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

    if (user && !isDemoMode && user.id !== 'demo-user-1234') {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id);
      } catch {
        // Ignore
      }
    }
  };

  const markAsUnread = async (id: string) => {
    saveReadStateLocally(id, false);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));

    if (user && !isDemoMode && user.id !== 'demo-user-1234') {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: false })
          .eq('id', id);
      } catch {
        // Ignore
      }
    }
  };

  const toggleRead = async (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target) return;

    const newReadState = !target.is_read;
    saveReadStateLocally(id, newReadState);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: newReadState } : n));

    if (user && !isDemoMode && user.id !== 'demo-user-1234') {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: newReadState })
          .eq('id', id);
      } catch {
        // Ignore
      }
    }
  };

  const addNotification = async ({
    title,
    message,
    type = 'info'
  }: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }) => {
    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      store_id: activeStore?.id,
      user_id: user?.id,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    };

    setNotifications(prev => [newNotif, ...prev]);

    // Save to Supabase DB if authenticated real user
    if (user && !isDemoMode && user.id !== 'demo-user-1234' && activeStore?.isRealDbStore && isValidUUID(activeStore?.id)) {
      try {
        await supabase
          .from('notifications')
          .insert({
            store_id: activeStore.id,
            user_id: user.id,
            title,
            message,
            type,
            is_read: false
          });
      } catch {
        // Local state preserved
      }
    }
  };

  const clearNotifications = async () => {
    setNotifications([]);
    try {
      localStorage.removeItem(getStorageKey());
    } catch {
      // Ignore
    }
    if (user && !isDemoMode && user.id !== 'demo-user-1234' && activeStore?.isRealDbStore && isValidUUID(activeStore?.id)) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('store_id', activeStore.id);
      } catch {
        // Ignore
      }
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAllAsRead,
        markAsRead,
        markAsUnread,
        toggleRead,
        addNotification,
        clearNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
