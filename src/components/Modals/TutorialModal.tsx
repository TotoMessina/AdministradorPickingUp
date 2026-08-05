import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShoppingCart,
  Tag,
  Handshake,
  Users,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Lock,
  Building2,
  ShieldCheck
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: '🛒 Terminal POS de Venta (Mostrador Cajero)',
      icon: <ShoppingCart size={32} style={{ color: '#10b981' }} />,
      description: 'Accedé a la Terminal POS desde el menú de Distribuciones, Caja Central o el botón "🛒 Modo POS". Permite cobrar con código de barras EAN, calculadora de vuelto, multilector de medios de pago e impresión de tickets térmicos.',
      location: 'Ubicación: Botón superior "🛒 Modo POS" o Módulo Distribuciones -> Terminal POS.'
    },
    {
      title: '🏷️ Catálogo de Artículos & Listas de Precios',
      icon: <Tag size={32} style={{ color: '#a855f7' }} />,
      description: 'Definí el precio base de cada producto (Lista 1) y configurá sobreprecios específicos para Listas Secundarias (Mayorista, POS, Lista 2). Al cobrar en la Terminal POS podés alternar listas en vivo y recalcular precios.',
      location: 'Ubicación: Módulo Artículos -> Artículos & Precios por Lista.'
    },
    {
      title: '🤝 Módulo de Proveedores & Cuentas Corrientes',
      icon: <Handshake size={32} style={{ color: '#f59e0b' }} />,
      description: 'Gestión completa de Proveedores, Ingreso de Facturas de Compra y Registro de Pagos (Efectivo, Transferencia, Cheque). Si pagás de más a un proveedor, el sistema genera automáticamente Saldo a Favor.',
      location: 'Ubicación: Módulo Proveedores -> Gestión de Proveedores y Cuentas Corrientes.'
    },
    {
      title: '👥 Usuarios Cajeros, Cajas & Roles de Acceso',
      icon: <Users size={32} style={{ color: '#4f46e5' }} />,
      description: 'Creá cuentas para tus cajeros con Email y Contraseña. Asignales una Caja Registradora puntual y su Lista de Precios predeterminada. Los cajeros sólo verán la Terminal POS sin acceso al panel de administración.',
      location: 'Ubicación: Módulo Configuración -> 👥 Usuarios y Permisos.'
    },
    {
      title: '📊 Auditoría y Monitoreo de Ventas en Vivo',
      icon: <BarChart3 size={32} style={{ color: '#0ea5e9' }} />,
      description: 'Auditá qué vendió cada cajero y con qué lista de precios emitió sus comprobantes. Consultá métricas KPI en tiempo real (operaciones hoy, latencia de base de datos y cajas activas).',
      location: 'Ubicación: Módulo Caja Central -> Monitoreo de Cajas (Pestaña Auditoría).'
    }
  ];

  if (!isOpen) return null;

  const current = steps[currentStep];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '600px',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        color: 'var(--text-main)'
      }} className="animate-fade-in">

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sparkles size={22} />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0 }}>Guía Interactiva de la Aplicación</h2>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Paso {currentStep + 1} de {steps.length}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Step Content */}
        <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '1.25rem',
            background: 'var(--bg-sidebar-hover)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {current.icon}
          </div>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
            {current.title}
          </h3>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            {current.description}
          </p>

          <div style={{
            padding: '0.625rem 1rem',
            borderRadius: '0.625rem',
            background: 'var(--brand-light-bg)',
            color: 'var(--brand-blue)',
            fontWeight: 800,
            fontSize: '0.8125rem'
          }}>
            📌 {current.location}
          </div>
        </div>

        {/* Footer Navigation */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontWeight: 700,
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          {/* Dots Indicator */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {steps.map((_, idx) => (
              <span
                key={idx}
                onClick={() => setCurrentStep(idx)}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: idx === currentStep ? '#6366f1' : 'var(--border-light)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#6366f1',
                color: '#ffffff',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              Entendido <CheckCircle2 size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
