'use client';

import { useState } from 'react';
import { usePreklad } from '../components/JazykProvider';

/**
 * MOJE PROJEKTY vs. CELÁ FIRMA (zadání 24. 9. 2026: „nastav u klientů, aby
 * měli možnost vidět i někde v záložce projekty celé firmy - ostatních
 * kolegů, aby je mohli zobrazit").
 *
 * Klient měl do teď jen zakázky, u kterých je vedený jako kontakt (oprava
 * 11. 9. 2026: u větších vydavatelství na sebe lidé z různých oddělení
 * viděli navzájem). Zůstává to tak i teď - ale kdo potřebuje vidět, co se
 * u nás pro jeho firmu dělá, přepne se na druhou záložku.
 *
 * Obě tabulky se vykreslí na serveru a tady se jen přepíná, co je vidět -
 * kliknutí tedy nečeká na žádné načítání.
 */
export function ZalozkyKlienta({
  moje,
  firma,
  pocetFirmy,
}: {
  moje: React.ReactNode;
  firma: React.ReactNode;
  /** Kolik zakázek má firma celkem - ať je vidět, jestli se vůbec vyplatí klikat. */
  pocetFirmy: number;
}) {
  const [zalozka, setZalozka] = useState<'moje' | 'firma'>('moje');
  const t = usePreklad();

  const stitek = (klic: 'moje' | 'firma', popisek: string, pocet?: number) => (
    <button
      type="button"
      onClick={() => setZalozka(klic)}
      aria-pressed={zalozka === klic}
      className={`rounded-pill px-4 py-1.5 text-sm font-heading font-semibold transition-colors ${
        zalozka === klic
          ? 'bg-brand-purple text-white'
          : 'border border-line text-muted hover:text-ink hover:border-brand-purple'
      }`}
    >
      {popisek}
      {pocet !== undefined && <span className="ml-1.5 opacity-70 tabular-nums">{pocet}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 flex-wrap">
        {stitek('moje', t('projekty.zalozkaMoje'))}
        {stitek('firma', t('projekty.zalozkaFirma'), pocetFirmy)}
      </div>

      {zalozka === 'moje' ? moje : firma}
    </div>
  );
}
