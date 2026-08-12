import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useNotifications } from '../../context/NotificationContext';
import { APP_CONFIG } from '../../config/appConfig';
import { triggerCronSmartAlertsEdgeFunction, runLocalSmartAlertsScan } from '../../services/SmartAlertsService';
const UserProfileModal = React.lazy(() => import('../Modals/UserProfileModal').then(m => ({ default: m.UserProfileModal })));
import {
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Shield,
  Command,
  Sparkles,
  ChevronDown,
  Repeat,
  CheckCircle2,
  X,
  Check,
  Trash2
} from 'lucide-react';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  openCommandPalette: () => void;
  onToggleSidebar?: () => void;
  onOpenPOSOnlyMode?: () => void;
  onOpenTutorial?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  searchTerm,
  setSearchTerm,
  openCommandPalette,
  onToggleSidebar,
  onOpenPOSOnlyMode,
  onOpenTutorial
}) => {
  const { user, signOut, isDemoMode } = useAuth();
  const { activeStore, setIsStoreSelectorOpen } = useTenant();
  const { notifications, unreadCount, markAllAsRead, clearNotifications } = useNotifications();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Propietario';
  const role = activeStore?.user_role || (isDemoMode ? 'Propietario' : 'Operador');
  const initialLetter = (activeStore?.name || displayName || 'P').charAt(0).toUpperCase();

  const storeName = activeStore?.name || 'Mi Comercio';
  const storeCode = activeStore?.code || 'SUC-001';

  return (
    <>
      <header style={{
        height: '68px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 45,
        boxShadow: 'var(--shadow-sm)',
        transition: 'background 0.2s ease, border-color 0.2s ease'
      }}>
        {/* Left Side: Store Name, Badge & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
              {storeName}
            </h1>
            <span style={{
              background: 'var(--brand-light-bg)',
              color: 'var(--brand-blue)',
              padding: '0.15rem 0.55rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              {storeCode}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#10b981',
            marginLeft: '0.25rem'
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
            Operativo
          </div>
        </div>

        {/* Center: Search Input (⌘ K) & Asistente IA / Tutorial Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, maxWidth: '580px', margin: '0 1.5rem' }}>
          <div
            onClick={openCommandPalette}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-sidebar-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.75rem',
              padding: '0.5rem 0.875rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Buscar módulos, acciones, reportes...</span>
            </div>
            <kbd style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.375rem',
              padding: '0.1rem 0.4rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-muted)'
            }}>
              ⌘ K
            </kbd>
          </div>

          <button
            onClick={onOpenTutorial}
            style={{
              background: 'var(--theme-purple-bg)',
              border: '1px solid var(--theme-purple-border)',
              borderRadius: '0.75rem',
              padding: '0.5rem 0.875rem',
              color: 'var(--theme-purple)',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Sparkles size={16} /> Tutorial & Ayuda
          </button>
        </div>

        {/* Right Side: POS Button, Cambiar Comercio, Notifications, Theme, Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

          {/* POS Standalone Button */}
          {onOpenPOSOnlyMode && (
            <button
              onClick={onOpenPOSOnlyMode}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                border: 'none',
                borderRadius: '0.625rem',
                padding: '0.45rem 0.85rem',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.7825rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              🛒 Modo POS
            </button>
          )}

          {/* Cambiar Comercio Button */}
          <button
            onClick={() => setIsStoreSelectorOpen(true)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.625rem',
              padding: '0.45rem 0.85rem',
              color: 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.7825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Repeat size={14} style={{ color: 'var(--brand-blue)' }} /> Cambiar Comercio
          </button>

          {/* Notification Bell with Active Popover */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
              title="Notificaciones del Sistema"
              style={{
                background: 'var(--bg-sidebar-hover)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.625rem',
                  fontWeight: 900,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                width: '340px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                boxShadow: 'var(--shadow-lg)',
                padding: '1rem',
                zIndex: 100
              }} className="animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                    🔔 Notificaciones ({notifications.length})
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        const targetStoreId = activeStore?.id || 'demo-store';
                        triggerCronSmartAlertsEdgeFunction(targetStoreId);
                        runLocalSmartAlertsScan(targetStoreId, (notif) => {
                          // NotificationContext handles live updates
                        });
                      }}
                      title="Escanear reglas de alerta en vivo"
                      style={{ background: 'rgba(37, 99, 235, 0.12)', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                    >
                      🤖 Escanear
                    </button>
                    {notifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      No hay notificaciones pendientes
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', background: 'var(--bg-sidebar-hover)', border: '1px solid var(--border-light)', fontSize: '0.8125rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '2px' }}>{n.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.message}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                          {n.created_at ? new Date(n.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Ahora'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle (Light / Dark Mode) */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            style={{
              background: 'var(--bg-sidebar-hover)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} style={{ color: '#f59e0b' }} />}
          </button>

          <div style={{ height: '24px', width: '1px', background: 'var(--border-light)' }} />

          {/* User Profile Menu */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.625rem'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {initialLetter}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
                  {displayName}
                </span>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {role}
                </span>
              </div>

              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                top: '115%',
                right: 0,
                width: '200px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                boxShadow: 'var(--shadow-lg)',
                padding: '0.5rem',
                zIndex: 100
              }}>
                <button
                  onClick={() => { setShowProfileModal(true); setShowProfileMenu(false); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.6rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <User size={15} /> Mi Perfil
                </button>
                <button
                  onClick={() => { signOut(); setShowProfileMenu(false); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.6rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: '#ef4444',
                    cursor: 'pointer',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <LogOut size={15} /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* User Profile Modal */}
      {showProfileModal && (
        <React.Suspense fallback={null}>
          <UserProfileModal
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
          />
        </React.Suspense>
      )}
    </>
  );
};
