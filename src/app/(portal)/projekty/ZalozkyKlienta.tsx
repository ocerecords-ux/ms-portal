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
  samotny = false,
}: {
  moje: React.ReactNode;
  firma: React.ReactNode;
  /** Kolik zakázek má firma celkem - ať je vidět, jestli se vůbec vyplatí klikat. */
  pocetFirmy: number;
  /**
   * NENÍ CO PŘEPÍNAT - obě záložky by ukázaly totéž (25. 9. 2026: „vypni ten
   * přepínač Celá firma u klienta v přehledu projektů, když má firma pod
   * sebou jen jednoho klienta. To je nesmysl.").
   *
   * Od 20. 10. 2026 o tom rozhoduje POROVNÁNÍ SEZNAMŮ, ne počet klientských
   * účtů u firmy. Zakázka totiž nemusí mít kontaktní osobu vůbec, nebo ji má
   * vedenou na někom bez účtu v portálu - a u firmy s jedním účtem tak mizel
   * přepínač i tam, kde firma zakázky měla a člověk koukal na prázdno.
   */
  samotny?: boolean;
}) {
  const [zalozka, setZalozka] = useState<'moje' | 'firma'>('moje');
  const t = usePreklad();

  if (samotny) return <>{moje}</>;

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
