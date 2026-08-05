import React from 'react';
import {
  Menu,
  ChevronLeft,
  Bell,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useNotifications } from '../../context/NotificationContext';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onOpenMenu?: () => void;
  showSearch?: boolean;
  onOpenSearch?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  onOpenMenu,
  showSearch = false,
  onOpenSearch
}) => {
  const { user } = useAuth();
  const { activeStore } = useTenant();
  const { unreadCount } = useNotifications();

  const initialLetter = (activeStore?.name || user?.email || 'T').charAt(0).toUpperCase();

  return (
    <header style={{
      height: '56px',
      background: '#ffffff',
      borderBottom: '1px solid #e8ecf4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1rem',
      position: 'sticky',
      top: 0,
      zIndex: 90
    }}>
      {/* Left Action: Hamburger Menu or Back Arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {showBack ? (
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#1e293b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            <ChevronLeft size={24} />
          </button>
        ) : (
          <button
            onClick={onOpenMenu}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#1e293b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            <Menu size={22} />
          </button>
        )}

        <h1 style={{
          fontSize: '1.125rem',
          fontWeight: 800,
          color: '#1e293b',
          margin: 0
        }}>
          {title}
        </h1>
      </div>

      {/* Right Icons: Search / Bell / User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {showSearch && (
          <button
            onClick={onOpenSearch}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            <Search size={20} />
          </button>
        )}

        {!showBack && (
          <>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444'
                  }} />
                )}
              </button>
            </div>

            {/* User Avatar Circle */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
            }}>
              {initialLetter}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
