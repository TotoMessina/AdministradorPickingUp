import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { NotificationProvider } from './context/NotificationContext';
import { supabase, SUPABASE_ANON_KEY, isValidUUID } from './lib/supabase';
import { LoginForm } from './components/Auth/LoginForm';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { FavoritesBar, ActionItem } from './components/Dashboard/FavoritesBar';
import { ModuleGrid, MODULE_GROUPS } from './components/Dashboard/ModuleGrid';
import { CommandPalette } from './components/Dashboard/CommandPalette';
import { ActionModal } from './components/Modals/ActionModal';
import { MobileAppView } from './components/Mobile/MobileAppView';
import { initShepherdTour } from './services/ShepherdTourService';
import { OnboardingTutorialModal } from './components/Modals/OnboardingTutorialModal';
import { APP_CONFIG } from './config/appConfig';
import { registerServiceWorker } from './services/ServiceWorkerRegister';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { SkipLink } from './components/Layout/SkipLink';
import {
  TrendingUp,
  Activity,
  Building2,
  Repeat,
  CheckCircle,
  Filter,
  Users
} from 'lucide-react';

const PriceListsModal = React.lazy(() => import('./components/Modals/PriceListsModal').then(m => ({ default: m.PriceListsModal })));
const CashRegisterMonitoringModal = React.lazy(() => import('./components/Modals/CashRegisterMonitoringModal').then(m => ({ default: m.CashRegisterMonitoringModal })));
const CashRegisterConfigModal = React.lazy(() => import('./components/Modals/CashRegisterConfigModal').then(m => ({ default: m.CashRegisterConfigModal })));
const InventoryManagementModal = React.lazy(() => import('./components/Modals/InventoryManagementModal').then(m => ({ default: m.InventoryManagementModal })));
const POSTerminalModal = React.lazy(() => import('./components/Modals/POSTerminalModal').then(m => ({ default: m.POSTerminalModal })));
const FavoritesConfigModal = React.lazy(() => import('./components/Modals/FavoritesConfigModal').then(m => ({ default: m.FavoritesConfigModal })));
const StoreSelector = React.lazy(() => import('./components/Auth/StoreSelector').then(m => ({ default: m.StoreSelector })));

const ModalFallback = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  }}>
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: '1rem',
      padding: '1.25rem 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      boxShadow: 'var(--shadow-lg)',
      color: 'var(--text-main)'
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: '3px solid rgba(99, 102, 241, 0.2)',
        borderTopColor: '#6366f1',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Cargando módulo...</span>
    </div>
  </div>
);

const ALL_MODULE_ACTIONS: ActionItem[] = MODULE_GROUPS.flatMap(g => g.actions);

const INITIAL_FAVORITES: ActionItem[] = [
  { name: 'Cambio Masivo', slug: 'cambio-masivo', moduleName: 'Precios', moduleSlug: 'precios', colorTheme: 'red', iconName: 'Zap' },
  { name: 'Cierre de Cajeros', slug: 'cierre-cajeros', moduleName: 'Caja Central', moduleSlug: 'caja-central', colorTheme: 'lime', iconName: 'Lock' },
  { name: 'Ingreso de Comprobantes', slug: 'ingreso-comprobantes', moduleName: 'Proveedores', moduleSlug: 'proveedores', colorTheme: 'orange', iconName: 'FileText' },
  { name: 'Artículos', slug: 'articulos-list', moduleName: 'Artículos', moduleSlug: 'articulos', colorTheme: 'blue', iconName: 'Tag' }
];

export const AppContent: React.FC = () => {
  const { user, loading, isDemoMode } = useAuth();
  const { activeStore, isStoreSelectorOpen, setIsStoreSelectorOpen } = useTenant();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const savedTheme = localStorage.getItem('pickingup_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [favorites, setFavorites] = useState<ActionItem[]>(INITIAL_FAVORITES);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isFavConfigOpen, setIsFavConfigOpen] = useState(false);
  const [activeModalAction, setActiveModalAction] = useState<ActionItem | null>(null);
  const [isPOSStandaloneMode, setIsPOSStandaloneMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pickingup_active_pos_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    try {
      return window.innerWidth < 768;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    registerServiceWorker();
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSetPOSMode = (enabled: boolean) => {
    setIsPOSStandaloneMode(enabled);
    try {
      localStorage.setItem('pickingup_active_pos_mode', String(enabled));
    } catch {}
  };

  const handleStartShepherdTour = () => {
    const tour = initShepherdTour({
      openAction: (slug: string) => {
        const foundAction = ALL_MODULE_ACTIONS.find(a => a.slug === slug);
        if (foundAction) {
          setActiveModalAction(foundAction);
        } else {
          setActiveModalAction({ name: slug, slug, moduleName: 'General', moduleSlug: 'general', colorTheme: 'blue', iconName: 'Tag' });
        }
      },
      closeModal: () => setActiveModalAction(null),
      openPOS: () => handleSetPOSMode(true)
    });
    tour.start();
  };

  const getFavStorageKey = () => {
    return `pickingup_favs_${user?.id || 'demo'}_${activeStore?.id || 'default'}`;
  };

  const saveFavSlugsLocally = (slugs: string[]) => {
    try {
      localStorage.setItem(getFavStorageKey(), JSON.stringify(slugs));
    } catch {
      // Ignore
    }
  };

  const [realOpsTodayCount, setRealOpsTodayCount] = useState<number>(0);
  const [realOpsTodayAmount, setRealOpsTodayAmount] = useState<number>(0);
  const [realActiveCajasText, setRealActiveCajasText] = useState<string>('0 / 0');
  const [realLastUpdate, setRealLastUpdate] = useState<string>('');
  const [serverLatency, setServerLatency] = useState<string>('12 ms');
  const [isServerOnline, setIsServerOnline] = useState<boolean>(true);

  // Apply theme attribute to html element & sync with localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('pickingup_theme', theme);
    } catch {}
  }, [theme]);

  // Sync theme preference from Supabase user profile on login
  useEffect(() => {
    if (user?.id && !isDemoMode) {
      supabase.from('profiles').select('theme_preference').eq('id', user.id).single()
        .then((res: any) => {
          if (!res.error && res.data?.theme_preference && (res.data.theme_preference === 'light' || res.data.theme_preference === 'dark')) {
            setTheme(res.data.theme_preference);
          }
        });
    }
  }, [user?.id, isDemoMode]);

  // Listen to OS system color scheme changes (prefers-color-scheme)
  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const hasExplicitLocalPref = localStorage.getItem('pickingup_theme');
      if (!hasExplicitLocalPref) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    try {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    } catch {
      mediaQuery.addListener(handleSystemThemeChange);
      return () => mediaQuery.removeListener(handleSystemThemeChange);
    }
  }, []);

  // Fetch real-time dashboard metrics (Operaciones Hoy, Cajas Activas, Last Update, Server Status)
  useEffect(() => {
    const loadRealMetrics = async () => {
      const storeKey = activeStore?.id || 'demo-store';

      // 1. Calculate Real Active Cash Registers (Cajas Activas)
      let configuredRegs: any[] = [];
      try {
        const raw = localStorage.getItem(`pickingup_registers_${storeKey}`) || localStorage.getItem(`pickingup_cajas_config_${storeKey}`);
        if (raw) configuredRegs = JSON.parse(raw);
      } catch {}

      let onlineCount = configuredRegs.filter((r: any) => r.isActive !== false).length;
      let totalRegs = configuredRegs.length;

      if (user && activeStore && !isDemoMode && user.id !== 'demo-user-1234') {
        try {
          const { data: dbRegs } = await supabase
            .from('cash_registers')
            .select('id, is_active')
            .eq('store_id', activeStore.id);

          if (dbRegs && dbRegs.length > 0) {
            totalRegs = dbRegs.length;
            onlineCount = dbRegs.filter(r => r.is_active !== false).length;
          }
        } catch {}
      }

      setRealActiveCajasText(totalRegs === 0 ? '0 / 0' : `${onlineCount} / ${totalRegs}`);

      // 2. Calculate Real Today Operations and Total Sales Amount
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let opsCount = 0;
      let opsAmount = 0;

      // a. Read from store-scoped sales history in localStorage
      try {
        const storeKey = activeStore?.id || 'demo-store';
        const rawSales = localStorage.getItem(`pickingup_sales_history_${storeKey}`);
        if (rawSales) {
          const parsedSales = JSON.parse(rawSales);
          if (Array.isArray(parsedSales)) {
            const todaySales = parsedSales.filter((s: any) => new Date(s.date || s.created_at || Date.now()) >= todayStart);
            opsCount = todaySales.length;
            opsAmount = todaySales.reduce((acc: number, s: any) => acc + (Number(s.total) || Number(s.subtotal) || 0), 0);
          }
        }
      } catch {}

      // b. Query DB stock_movements & stock_movement_items for real DB stores
      if (user && activeStore && activeStore.isRealDbStore && isValidUUID(activeStore.id) && !isDemoMode && user.id !== 'demo-user-1234') {
        try {
          const { data: dbMovements, error } = await supabase
            .from('stock_movements')
            .select('id, created_at, stock_movement_items(qty, unit_price, total_price)')
            .eq('store_id', activeStore.id)
            .eq('movement_type', 'Egreso')
            .gte('created_at', todayStart.toISOString());

          if (!error && dbMovements && dbMovements.length > 0) {
            const dbOpsCount = dbMovements.length;
            const dbOpsAmount = dbMovements.reduce((acc: number, m: any) => {
              const items = m.stock_movement_items || [];
              const mTotal = items.reduce((sum: number, i: any) => sum + (Number(i.total_price) || (Number(i.qty || 1) * Number(i.unit_price || 0))), 0);
              return acc + mTotal;
            }, 0);

            opsCount = Math.max(opsCount, dbOpsCount);
            opsAmount = Math.max(opsAmount, dbOpsAmount);
          }
        } catch {}
      }

      setRealOpsTodayCount(opsCount);
      setRealOpsTodayAmount(opsAmount);

      // 3. Live Timestamp Update
      const now = new Date();
      setRealLastUpdate(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));

      // 4. Real-time Server Latency Check (Lightweight network ping using Supabase SDK)
      const startPing = performance.now();
      try {
        const { error } = await supabase.from('modules').select('id').limit(1);
        const pingMs = Math.round(performance.now() - startPing);
        setServerLatency(`${pingMs} ms`);
        setIsServerOnline(!error);
      } catch {
        setServerLatency('Offline');
        setIsServerOnline(false);
      }
    };

    loadRealMetrics();
    const interval = setInterval(loadRealMetrics, 10000);
    const handleSaleEvent = () => loadRealMetrics();

    window.addEventListener('pickingup_sale_completed', handleSaleEvent);
    window.addEventListener('storage', handleSaleEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pickingup_sale_completed', handleSaleEvent);
      window.removeEventListener('storage', handleSaleEvent);
    };
  }, [activeStore, user, isDemoMode]);

  // Load store-specific favorites from Supabase AND localStorage
  useEffect(() => {
    let localSlugs: string[] = [];
    try {
      const raw = localStorage.getItem(getFavStorageKey()) || localStorage.getItem('pickingup_user_favorites_v2');
      if (raw) localSlugs = JSON.parse(raw);
    } catch {
      // Ignore
    }

    const loadFavorites = async () => {
      let combinedSlugs: string[] = [...localSlugs];

      if (user && activeStore && activeStore.isRealDbStore && isValidUUID(activeStore.id) && !isDemoMode && user.id !== 'demo-user-1234') {
        try {
          const { data, error } = await supabase
            .from('user_favorites')
            .select('action_slug')
            .eq('store_id', activeStore.id)
            .eq('user_id', user.id);

          if (!error && data && data.length > 0) {
            const dbSlugs = data.map(d => d.action_slug);
            combinedSlugs = Array.from(new Set([...combinedSlugs, ...dbSlugs]));
          }
        } catch (err) {
          console.error('Error fetching favorites from Supabase:', err);
        }
      }

      if (combinedSlugs.length > 0) {
        const matched = ALL_MODULE_ACTIONS.filter(act => combinedSlugs.includes(act.slug));
        if (matched.length > 0) {
          setFavorites(matched);
          return;
        }
      }
      setFavorites(INITIAL_FAVORITES);
    };

    loadFavorites();
  }, [user, activeStore, isDemoMode]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('pickingup_theme', next);
      } catch {}

      if (user?.id && !isDemoMode) {
        supabase.from('profiles').update({ theme_preference: next }).eq('id', user.id)
          .then(() => {
            // Updated successfully
          });
      }

      return next;
    });
  };

  const handleToggleFavorite = async (action: ActionItem) => {
    const exists = favorites.some(f => f.slug === action.slug);
    let updated: ActionItem[];

    if (exists) {
      updated = favorites.filter(f => f.slug !== action.slug);
    } else {
      updated = [...favorites, action];
    }
    setFavorites(updated);
    saveFavSlugsLocally(updated.map(f => f.slug));

    // Save to Supabase if logged in with active store scope
    if (user && user.id !== 'demo-user-1234' && !isDemoMode && activeStore) {
      try {
        if (exists) {
          await supabase
            .from('user_favorites')
            .delete()
            .eq('store_id', activeStore.id)
            .eq('user_id', user.id)
            .eq('action_slug', action.slug);
        } else {
          await supabase
            .from('user_favorites')
            .insert({
              user_id: user.id,
              store_id: activeStore.id,
              action_slug: action.slug
            });
        }
      } catch (err) {
        console.error('Error persisting favorite in Supabase:', err);
      }
    }
  };

  const handleRemoveFavorite = async (actionSlug: string) => {
    const updated = favorites.filter(f => f.slug !== actionSlug);
    setFavorites(updated);
    saveFavSlugsLocally(updated.map(f => f.slug));

    if (user && user.id !== 'demo-user-1234' && !isDemoMode && activeStore) {
      try {
        await supabase
          .from('user_favorites')
          .delete()
          .eq('store_id', activeStore.id)
          .eq('user_id', user.id)
          .eq('action_slug', actionSlug);
      } catch (err) {
        console.error('Error deleting favorite in Supabase:', err);
      }
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#090d16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontFamily: 'var(--font-main)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '4px solid rgba(2, 132, 199, 0.2)',
            borderTopColor: '#0284c7',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em' }}>
            CARGANDO {APP_CONFIG.name.toUpperCase()}...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // If in Standalone POS Cashier Mode, hide the entire Backoffice Administration
  if (isPOSStandaloneMode) {
    return (
      <React.Suspense fallback={<ModalFallback />}>
        <POSTerminalModal
          isOpen={true}
          isStandalone={true}
          onClose={() => handleSetPOSMode(false)}
        />
      </React.Suspense>
    );
  }

  if (isMobileView) {
    return (
      <>
        <MobileAppView
          favorites={favorites}
          setFavorites={setFavorites}
          onOpenAction={(act) => setActiveModalAction(act)}
          onOpenActionBySlug={(slug) => {
            const found = ALL_MODULE_ACTIONS.find(a => a.slug === slug);
            if (found) setActiveModalAction(found);
            else setActiveModalAction({ name: slug, slug, moduleName: 'General', moduleSlug: 'general', colorTheme: 'blue', iconName: 'Tag' });
          }}
          realOpsTodayCount={realOpsTodayCount}
          realOpsTodayAmount={realOpsTodayAmount}
          realActiveCajasText={realActiveCajasText}
          realLastUpdate={realLastUpdate}
          serverLatency={serverLatency}
          onOpenPOS={() => handleSetPOSMode(true)}
        />

        {/* Render Action Modals when opened on mobile */}
        {activeModalAction && (
          <ActionModal
            action={activeModalAction}
            onClose={() => setActiveModalAction(null)}
          />
        )}

        {/* Store Selector Modal */}
        {isStoreSelectorOpen && (
          <StoreSelector
            isModal={true}
            onClose={() => setIsStoreSelectorOpen(false)}
          />
        )}
      </>
    );
  }

  const handleOpenActionBySlug = (slug: string) => {
    const found = ALL_MODULE_ACTIONS.find(a => a.slug === slug);
    if (found) {
      setActiveModalAction(found);
    } else {
      setActiveModalAction({ name: slug, slug, moduleName: 'General', moduleSlug: 'general', colorTheme: 'blue', iconName: 'Tag' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* Accessibility Skip to Content Link */}
      <SkipLink />

      {/* Top Header */}
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        openCommandPalette={() => setIsCommandPaletteOpen(true)}
        onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
        onOpenPOSOnlyMode={() => handleSetPOSMode(true)}
        onOpenTutorial={handleStartShepherdTour}
      />

      {/* Main Container */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onOpenActionBySlug={handleOpenActionBySlug}
        />

        {/* Main Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          role="main"
          style={{
            flex: 1,
            padding: '1.5rem 2rem',
            maxWidth: '1600px',
            margin: '0 auto',
            width: '100%',
            background: 'var(--bg-app)'
          }}
        >
          {/* Favorites / Fast Access Bar */}
          <FavoritesBar
            favorites={favorites}
            onRemoveFavorite={handleRemoveFavorite}
            onExecuteAction={(act) => setActiveModalAction(act)}
            onOpenManageModal={() => setIsFavConfigOpen(true)}
          />

          <ModuleGrid
            selectedCategory={selectedCategory}
            searchTerm={searchTerm}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onActionClick={(act) => setActiveModalAction(act)}
            onOpenActionBySlug={handleOpenActionBySlug}
            onOpenFavConfig={() => setIsFavConfigOpen(true)}
            realOpsTodayCount={realOpsTodayCount}
            realOpsTodayAmount={realOpsTodayAmount}
            realActiveCajasText={realActiveCajasText}
            realLastUpdate={realLastUpdate}
            serverLatency={serverLatency}
            isServerOnline={isServerOnline}
          />
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectAction={(act) => setActiveModalAction(act)}
      />

      {/* Configurable Favorites Fast Access Modal */}
      <React.Suspense fallback={<ModalFallback />}>
        <FavoritesConfigModal
          isOpen={isFavConfigOpen}
          onClose={() => setIsFavConfigOpen(false)}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />
      </React.Suspense>

      {/* Interactive Action Operational Modals */}
      <React.Suspense fallback={<ModalFallback />}>
      {activeModalAction?.slug === 'listas-precios' ? (
        <PriceListsModal
          isOpen={true}
          onClose={() => setActiveModalAction(null)}
        />
      ) : activeModalAction?.slug === 'monitoreo-cajas' ? (
        <CashRegisterMonitoringModal
          isOpen={true}
          onClose={() => setActiveModalAction(null)}
          onOpenConfig={() => setActiveModalAction({ name: 'Configuración de Cajas', slug: 'configuracion-cajas', moduleName: 'Configuración', moduleSlug: 'configuracion', colorTheme: 'rose', iconName: 'Monitor' })}
        />
      ) : activeModalAction?.slug === 'configuracion-cajas' ? (
        <CashRegisterConfigModal
          isOpen={true}
          onClose={() => setActiveModalAction(null)}
        />
      ) : activeModalAction?.slug === 'gestion-inventario' ? (
        <InventoryManagementModal
          isOpen={true}
          onClose={() => setActiveModalAction(null)}
          onOpenPriceLists={() => setActiveModalAction({ name: 'Gestión de Listas de Precios', slug: 'listas-precios', moduleName: 'Precios', moduleSlug: 'precios', colorTheme: 'indigo', iconName: 'Tag' })}
        />
      ) : (
        <ActionModal
          action={activeModalAction}
          onClose={() => setActiveModalAction(null)}
        />
      )}
      </React.Suspense>

      {/* Multi-Tenant Store Selector Modal */}
      {isStoreSelectorOpen && (
        <React.Suspense fallback={<ModalFallback />}>
          <StoreSelector isModal onClose={() => setIsStoreSelectorOpen(false)} />
        </React.Suspense>
      )}

      {/* Interactive Guided Onboarding Tutorial Modal */}
      <OnboardingTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      {/* PWA Floating Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <TenantProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </TenantProvider>
    </AuthProvider>
  );
};

export default App;

