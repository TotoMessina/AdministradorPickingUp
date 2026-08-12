// Service Worker Registration Service for PWA
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers are not supported in this browser environment.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('[PWA SW] Service Worker registered successfully with scope:', registration.scope);

    // Listen for updates
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            console.log('[PWA SW] New content is available; please refresh.');
          } else {
            console.log('[PWA SW] Content is cached for offline use.');
          }
        }
      };
    };

    return registration;
  } catch (err) {
    console.error('[PWA SW] Service Worker registration failed:', err);
    return null;
  }
};
