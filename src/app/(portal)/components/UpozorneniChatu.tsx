'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Zapnutí upozornění na nové zprávy (zadání 9. 9. 2026).
 *
 * Tlačítko sedí v hlavičce chatu. Ukazuje tři stavy: vypnuto, zapnuto
 * a zakázáno prohlížečem - v posledním případě se nedá nic dělat z portálu
 * a člověk to musí povolit v nastavení prohlížeče, což mu tooltip řekne.
 *
 * POZOR NA IPHONE: Apple pouští upozornění jen aplikacím přidaným na plochu.
 * V samotném Safari tlačítko nic nesvede, proto se tam rovnou vysvětlí proč,
 * místo aby povolení tiše selhalo.
 */

type Stav = 'nezname' | 'nepodporovano' | 'vypnuto' | 'zapnuto' | 'zakazano' | 'jenVAplikaci';

/**
 * Klíč z API chodí v base64url, prohlížeč ho chce jako syrové bajty.
 *
 * Vrací se ArrayBuffer, ne Uint8Array: novější TypeScript rozlišuje, nad
 * jakou pamětí pole leží, a subscribe() chce právě tenhle tvar.
 */
function naBajty(base64url: string): ArrayBuffer {
  const doplneni = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + doplneni).replace(/-/g, '+').replace(/_/g, '/');
  const syrove = atob(base64);
  const pole = new Uint8Array(syrove.length);
  for (let i = 0; i < syrove.length; i += 1) pole[i] = syrove.charCodeAt(i);
  return pole.buffer;
}

function jeIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function vAplikaci(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function UpozorneniChatu() {
  const [stav, setStav] = useState<Stav>('nezname');
  const [pracuje, setPracuje] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      // iPhone mimo aplikaci na ploše push vůbec nenabízí - řekněme proč.
      setStav(jeIOS() && !vAplikaci() ? 'jenVAplikaci' : 'nepodporovano');
      return;
    }
    if (Notification.permission === 'denied') {
      setStav('zakazano');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((odber) => setStav(odber ? 'zapnuto' : 'vypnuto'))
      .catch(() => setStav('vypnuto'));
  }, []);

  const zapni = useCallback(async () => {
    setPracuje(true);
    try {
      const povoleni = await Notification.requestPermission();
      if (povoleni !== 'granted') {
        setStav(povoleni === 'denied' ? 'zakazano' : 'vypnuto');
        return;
      }

      const odpoved = await fetch('/api/push/klic');
      const data = await odpoved.json().catch(() => ({}));
      if (!odpoved.ok || !data?.klic) {
        console.error('Klíč pro upozornění se nepodařilo načíst:', data?.error);
        setStav('vypnuto');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const odber = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: naBajty(data.klic),
      });

      const json = odber.toJSON();
      const ulozeno = await fetch('/api/push/odber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: odber.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          zarizeni: navigator.userAgent.slice(0, 300),
        }),
      });
      setStav(ulozeno.ok ? 'zapnuto' : 'vypnuto');
    } catch (err) {
      console.error('Upozornění se nepodařilo zapnout:', err);
      setStav('vypnuto');
    } finally {
      setPracuje(false);
    }
  }, []);

  const vypni = useCallback(async () => {
    setPracuje(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const odber = await reg.pushManager.getSubscription();
      if (odber) {
        await fetch('/api/push/odber', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: odber.endpoint }),
        }).catch(() => undefined);
        await odber.unsubscribe().catch(() => undefined);
      }
      setStav('vypnuto');
    } finally {
      setPracuje(false);
    }
  }, []);

  if (stav === 'nezname' || stav === 'nepodporovano') return null;

  const popis =
    stav === 'zapnuto'
      ? 'Upozornění na nové zprávy jsou zapnutá - klepnutím je vypnete'
      : stav === 'zakazano'
        ? 'Upozornění máte zakázaná v nastavení prohlížeče - povolit se dají jen tam'
        : stav === 'jenVAplikaci'
          ? 'Na iPhonu chodí upozornění jen aplikaci přidané na plochu - přidejte MS Chat na plochu a zapněte je tam'
          : 'Zapnout upozornění na nové zprávy';

  const nefunkcni = stav === 'zakazano' || stav === 'jenVAplikaci';

  return (
    <button
      type="button"
      onClick={() => {
        if (nefunkcni || pracuje) return;
        void (stav === 'zapnuto' ? vypni() : zapni());
      }}
      title={popis}
      aria-label={popis}
      aria-pressed={stav === 'zapnuto'}
      disabled={pracuje}
      className={`leading-none transition-colors disabled:opacity-50 ${
        stav === 'zapnuto' ? 'text-brand-green' : 'text-brand-green/60 hover:text-brand-green'
      } ${nefunkcni ? 'cursor-help opacity-60' : ''}`}
    >
      {stav === 'zapnuto' ? <ZvonekZapnuty /> : <ZvonekVypnuty />}
    </button>
  );
}

function ZvonekZapnuty() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22zm7-5.4v-5a7 7 0 0 0-5.3-6.8V4a1.7 1.7 0 1 0-3.4 0v.8A7 7 0 0 0 5 11.6v5l-1.6 1.6v.8h17.2v-.8z" />
    </svg>
  );
}

function ZvonekVypnuty() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4" aria-hidden="true">
      <path d="M18 15.6v-4a6 6 0 0 0-12 0v4L4.6 17v.7h14.8V17z" />
      <path d="M10.2 20.4a2 2 0 0 0 3.6 0" />
      <path d="M4 3.5 20 20" />
    </svg>
  );
}
