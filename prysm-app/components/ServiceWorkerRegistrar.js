'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Service Worker is not needed in development and can cause issues
    if (process.env.NODE_ENV === 'development') {
      console.log('%c✓ Service Worker disabled in development mode', 'color: green; font-weight: bold');
      console.log('%cHydration fix applied - site should load on first visit!', 'color: cyan; font-weight: bold');
      return;
    }

    // Only register in production
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  return null;
}
