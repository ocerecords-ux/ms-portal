'use client';

import { useEffect, useState } from 'react';

/**
 * NOUZOVÁ STRÁNKA (zadání 12. 9. 2026: „nedokážem tam zobrazit v tyto případy
 * alespoň nějaký nouzový režim? Nebo aspoň zprávu, o co jde?").
 *
 * Next.js na neodchycenou chybu vypisoval holé „Application error: a
 * server-side exception has occurred" na bílém pozadí. Z toho nikdo nepozná,
 * jestli přišel o data, nebo si má za minutu dát F5.
 *
 * Nejčastější případ je přitom neškodný: Supabase nemá zrovna volné spojení a
 * za pár vteřin ho mít bude. Proto se o to stránka sama jednou pokusí a mezitím
 * napíše, co se děje. Podrobnosti chyby sem Next schválně nepouští, zůstane jen
 * digest — ten se hodí do logu na Vercelu.
 */
export function ChybaStranky({
  error,
  reset,
  nadpis = 'Portál teď nenaběhl',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  nadpis?: string;
}) {
  const [odpocet, setOdpocet] = useState(5);
  const [zkousim, setZkousim] = useState(false);

  useEffect(() => {
    console.error('Stránka spadla:', error);
  }, [error]);

  // Jeden pokus zadarmo. Když to bylo jen přeplněné spojení, člověk si toho
  // skoro nevšimne; když ne, zůstane tu tlačítko a aspoň ví, na čem je.
  useEffect(() => {
    if (odpocet <= 0) {
      setZkousim(true);
      reset();
      return;
    }
    const casovac = setTimeout(() => setOdpocet((n) => n - 1), 1000);
    return () => clearTimeout(casovac);
  }, [odpocet, reset]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[520px] bg-surface border border-line rounded-card shadow-sm p-7 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo-still.png" alt="Mediaspace" className="h-8 w-auto mx-auto opacity-90" />
        <h1 className="font-heading font-bold text-xl text-ink mt-6 mb-2">{nadpis}</h1>
        <p className="text-sm font-body text-muted m-0">
          Nejčastěji to znamená, že databáze má zrovna plno a za chvíli bude zase volná. Data jsou v pořádku, nic se
          neztratilo.
        </p>

        <button
          type="button"
          onClick={() => {
            setZkousim(true);
            reset();
          }}
          className="mt-6 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors"
        >
          {zkousim ? 'Zkouším…' : `Zkusit znovu (${odpocet} s)`}
        </button>

        <p className="text-xs font-body text-muted mt-5 mb-0">
          Pokud to nepomůže ani po pár minutách, dejte vědět — s tímhle číslem se chyba najde v logu:
        </p>
        <p className="text-xs font-heading text-muted tabular-nums mt-1 mb-0">{error.digest ?? 'bez čísla'}</p>
      </div>
    </div>
  );
}
