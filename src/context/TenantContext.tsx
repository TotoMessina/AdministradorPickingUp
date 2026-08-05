import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export interface Store {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  code: string;
  plan: 'standard' | 'pro' | 'enterprise';
  is_active: boolean;
  user_role?: string;
}

export const MOCK_STORES: Store[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'PICKING & DELIVERING UP! S.A.',
    slug: 'picking-delivering-up',
    code: 'UP-001',
    plan: 'enterprise',
    is_active: true,
    user_role: 'Administrador'
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'SUPERMERCADOS CENTRAL SUR',
    slug: 'central-sur',
    code: 'CS-002',
    plan: 'pro',
    is_active: true,
    user_role: 'Supervisor'
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'EXPRESS MARKET NORTE',
    slug: 'express-norte',
    code: 'EM-003',
    plan: 'standard',
    is_active: true,
    user_role: 'Operador'
  }
];

interface TenantContextType {
  stores: Store[];
  activeStore: Store | null;
  setActiveStore: (store: Store) => void;
  isLoadingStores: boolean;
  isStoreSelectorOpen: boolean;
  setIsStoreSelectorOpen: (open: boolean) => void;
  refreshStores: () => Promise<void>;
  createNewStore: (name: string, code?: string, plan?: 'standard' | 'pro' | 'enterprise') => Promise<Store | null>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);
  const [isLoadingStores, setIsLoadingStores] = useState<boolean>(true);
  const [isStoreSelectorOpen, setIsStoreSelectorOpen] = useState<boolean>(false);

  const setActiveStore = (store: Store) => {
    setActiveStoreState(store);
    localStorage.setItem(`scanntech_active_store_${user?.id || 'demo'}`, store.id);
    
    // Save to profile in Supabase if logged in
    if (user && !isDemoMode && user.id !== 'demo-user-1234') {
      supabase
        .from('profiles')
        .update({ active_store_id: store.id })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('Error updating active_store_id:', error);
        });
    }
  };

  const createNewStore = async (
    name: string,
    code?: string,
    plan: 'standard' | 'pro' | 'enterprise' = 'enterprise'
  ): Promise<Store | null> => {
    const storeName = name.trim();
    if (!storeName) return null;

    const generatedSlug = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
    const storeCode = code ? code.trim().toUpperCase() : `SUC-${Math.floor(100 + Math.random() * 900)}`;

    let newStoreObj: Store = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '11111111-1111-1111-1111-111111111111',
      name: storeName.toUpperCase(),
      slug: generatedSlug,
      code: storeCode,
      plan: plan,
      is_active: true,
      user_role: 'Propietario'
    };

    if (user && !isDemoMode && user.id !== 'demo-user-1234') {
      try {
        // 1. Insert store into Supabase
        const { data: dbStore, error: storeErr } = await supabase
          .from('stores')
          .insert({
            name: storeName.toUpperCase(),
            slug: generatedSlug,
            code: storeCode,
            plan: plan,
            is_active: true
          })
          .select()
          .single();

        if (storeErr) {
          console.error('Error inserting store into Supabase:', storeErr);
        } else if (dbStore) {
          newStoreObj.id = dbStore.id;

          // 2. Insert membership into store_members
          const { error: memberErr } = await supabase
            .from('store_members')
            .insert({
              store_id: dbStore.id,
              user_id: user.id,
              role: 'owner',
              is_active: true
            });

          if (memberErr) console.error('Error inserting store_members:', memberErr);

          // 3. Update active store in profile
          await supabase
            .from('profiles')
            .update({ active_store_id: dbStore.id })
            .eq('id', user.id);
        }
      } catch (err) {
        console.error('Error in createNewStore:', err);
      }
    }

    setStores(prev => [...prev, newStoreObj]);
    setActiveStore(newStoreObj);
    return newStoreObj;
  };

  const fetchStores = async () => {
    setIsLoadingStores(true);

    if (isDemoMode || !user || user.id === 'demo-user-1234') {
      setStores(MOCK_STORES);
      const savedStoreId = localStorage.getItem(`scanntech_active_store_${user?.id || 'demo'}`);
      const initial = MOCK_STORES.find(s => s.id === savedStoreId) || MOCK_STORES[0];
      setActiveStoreState(initial);
      setIsLoadingStores(false);
      return;
    }

    try {
      // Query store memberships for authenticated real user
      const { data: memberData, error: memberError } = await supabase
        .from('store_members')
        .select(`
          role,
          store_id,
          stores (
            id,
            name,
            slug,
            logo_url,
            code,
            plan,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!memberError && memberData && memberData.length > 0) {
        const loadedStores: Store[] = memberData
          .map((m: any) => {
            const st = m.stores;
            if (!st) return null;
            return {
              id: st.id,
              name: st.name,
              slug: st.slug,
              logo_url: st.logo_url,
              code: st.code || 'STORE',
              plan: st.plan || 'enterprise',
              is_active: st.is_active,
              user_role: m.role || 'Propietario'
            };
          })
          .filter(Boolean) as Store[];

        if (loadedStores.length > 0) {
          setStores(loadedStores);
          const savedStoreId = localStorage.getItem(`scanntech_active_store_${user.id}`);
          const selected = loadedStores.find(s => s.id === savedStoreId) || loadedStores[0];
          setActiveStoreState(selected);
          setIsLoadingStores(false);
          return;
        }
      }

      // If user has no store membership in DB yet, attempt to auto-create their store
      const userStoreName = user.user_metadata?.store_name || `Supermercado (${user.email?.split('@')[0] || 'Mi Negocio'})`;
      const generatedSlug = userStoreName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
      const generatedCode = 'SUC-' + Math.floor(100 + Math.random() * 900);

      const { data: newStore, error: createStoreErr } = await supabase
        .from('stores')
        .insert({
          name: userStoreName,
          slug: generatedSlug,
          code: generatedCode,
          plan: 'enterprise'
        })
        .select()
        .single();

      if (!createStoreErr && newStore) {
        await supabase.from('store_members').insert({
          store_id: newStore.id,
          user_id: user.id,
          role: 'owner'
        });

        const createdStoreObj: Store = {
          id: newStore.id,
          name: newStore.name,
          slug: newStore.slug,
          code: newStore.code,
          plan: 'enterprise',
          is_active: true,
          user_role: 'Propietario'
        };

        setStores([createdStoreObj]);
        setActiveStoreState(createdStoreObj);
      } else {
        // Fallback for real user if DB table not populated yet: create dynamic user store object with user's business name
        const userFallbackStore: Store = {
          id: user.id,
          name: userStoreName,
          slug: generatedSlug,
          code: generatedCode,
          plan: 'enterprise',
          is_active: true,
          user_role: 'Propietario'
        };
        setStores([userFallbackStore]);
        setActiveStoreState(userFallbackStore);
      }
    } catch (err) {
      console.error('Error fetching/creating store:', err);
      const userStoreName = user.user_metadata?.store_name || `Supermercado (${user.email?.split('@')[0] || 'Mi Negocio'})`;
      const fallbackStore: Store = {
        id: user?.id || '11111111-1111-1111-1111-111111111111',
        name: userStoreName,
        slug: 'mi-negocio',
        code: 'SUC-001',
        plan: 'enterprise',
        is_active: true,
        user_role: 'Propietario'
      };
      setStores([fallbackStore]);
      setActiveStoreState(fallbackStore);
    } finally {
      setIsLoadingStores(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [user, isDemoMode]);

  return (
    <TenantContext.Provider
      value={{
        stores,
        activeStore,
        setActiveStore,
        isLoadingStores,
        isStoreSelectorOpen,
        setIsStoreSelectorOpen,
        refreshStores: fetchStores,
        createNewStore
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
