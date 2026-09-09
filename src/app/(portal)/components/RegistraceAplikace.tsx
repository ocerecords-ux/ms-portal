'use client';

import { useEffect } from 'react';

/**
 * Přihlásí service worker, díky kterému jde portál i chat nainstalovat na
 * plochu jako aplikaci (zadání 9. 9. 2026).
 *
 * Registruje se až po načtení stránky, aby to nezdržovalo první vykreslení.
 * Když se to nepovede (starší prohlížeč, vypnuté service workery), portál
 * funguje dál jako obyčejný web - jen se nedá přidat na plochu.
 */
export function RegistraceAplikace() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registruj = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker se nepodařilo zaregistrovat:', err);
      });
    };
    if (document.readyState === 'complete') registruj();
    else window.addEventListener('load', registruj, { once: true });
  }, []);

  return null;
}
