'use client';

import { useEffect } from 'react';

/**
 * Development only: unregister any service worker and wipe Workbox caches so
 * `next dev` never serves stale /cart or chunk bundles from a prior production build.
 */
export function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    async function cleanup() {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    }

    void cleanup();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void cleanup();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
