import React from 'react';
import {
  Home,
  Zap,
  Plus,
  BarChart3,
  MoreHorizontal
} from 'lucide-react';

export type MobileTab = 'dashboard' | 'operaciones' | 'modulos' | 'submodulo' | 'reportes' | 'mas';

interface MobileBottomBarProps {
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
  onOpenFAB?: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenFAB
}) => {
  const tabs = [
    { id: 'dashboard' as MobileTab, label: 'Inicio', icon: <Home size={20} /> },
    { id: 'operaciones' as MobileTab, label: 'Operaciones', icon: <Zap size={20} /> },
    { id: 'fab' as const, label: '', icon: <Plus size={26} /> },
    { id: 'reportes' as MobileTab, label: 'Reportes', icon: <BarChart3 size={20} /> },
    { id: 'mas' as MobileTab, label: 'Más', icon: <MoreHorizontal size={20} /> }
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '68px',
      background: '#ffffff',
      borderTop: '1px solid #e8ecf4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 99,
      padding: '0 0.5rem',
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)'
    }}>
      {tabs.map((tab) => {
        if (tab.id === 'fab') {
          return (
            <button
              key="fab-button"
              onClick={onOpenFAB}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
                cursor: 'pointer',
                marginTop: '-18px',
                transition: 'transform 0.15s ease'
              }}
              className="active:scale-95"
            >
              <Plus size={26} strokeWidth={2.5} />
            </button>
          );
        }

        const isSelected = activeTab === tab.id || (tab.id === 'dashboard' && activeTab === 'modulos');
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as MobileTab)}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              color: isSelected ? '#6366f1' : '#94a3b8',
              fontWeight: isSelected ? 800 : 600,
              fontSize: '0.6875rem',
              cursor: 'pointer',
              flex: 1,
              padding: '6px 0',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: isSelected ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 0.15s ease'
            }}>
              {tab.icon}
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
