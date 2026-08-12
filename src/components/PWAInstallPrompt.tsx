import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare, CheckCircle2, Sparkles } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already running in Standalone (Installed) mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIphoneOrIpad = /iphone|ipad|ipod/.test(userAgent);
    if (isIphoneOrIpad) {
      setIsIOS(true);
    }

    // 3. Listen for Android / Chrome / Edge beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      alert('Para instalar en Android/Desktop: Abrí el menú del navegador y seleccioná "Agregar a pantalla de inicio" o "Instalar Aplicación".');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled || isDismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      {/* Floating PWA Install Banner */}
      <div style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 2.5rem)',
        maxWidth: '540px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '1.25rem',
        padding: '1rem 1.25rem',
        color: '#ffffff',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }} className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '0.875rem',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
            flexShrink: 0
          }}>
            <Smartphone size={22} style={{ color: '#ffffff' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.725rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
              <Sparkles size={12} /> PWA Enterprise App
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#ffffff', margin: '1px 0' }}>
              Instalar PickingUp! POS
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.25 }}>
              Modo nativo offline para pantalla de inicio.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <button
            onClick={handleInstallClick}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.625rem',
              padding: '0.55rem 1rem',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}
          >
            <Download size={15} /> Instalar
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Modal Guide for iOS Safari Users */}
      {showIOSInstructions && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '1.25rem',
            padding: '1.75rem',
            maxWidth: '420px',
            width: '100%',
            color: '#0f172a',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone style={{ color: '#0284c7' }} /> Instalar en iPhone / iPad
              </div>
              <button
                onClick={() => setShowIOSInstructions(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem', color: '#475569' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ background: '#e0f2fe', color: '#0284c7', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>1</div>
                <div>Tocá el botón <strong>Compartir</strong> en la barra inferior de Safari (<Share size={15} style={{ display: 'inline', color: '#0284c7' }} />).</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ background: '#e0f2fe', color: '#0284c7', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>2</div>
                <div>Desplazate hacia abajo y seleccioná <strong>"Añadir a la pantalla de inicio"</strong> (<PlusSquare size={15} style={{ display: 'inline', color: '#0284c7' }} />).</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ background: '#e0f2fe', color: '#0284c7', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>3</div>
                <div>Tocá <strong>"Añadir"</strong> arriba a la derecha. ¡Listo! La app estará disponible en tu pantalla principal.</div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              style={{
                marginTop: '1.5rem',
                width: '100%',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.625rem',
                padding: '0.75rem',
                fontWeight: 800,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
