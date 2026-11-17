'use client';

import { useState, type ReactNode } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * ZÁLOŽKY NA KARTĚ UŽIVATELE (zadání 17. 11. 2026: „a ještě tu historii
 * upozornění u uživatelů bychom mohli dát zvlášť do záložky. A asi tam
 * celkově udělat záložky i na ty další věci, protože už je to nepřehledné,
 * jak je tam toho moc teď").
 *
 * Karta narostla do stránky, kterou je potřeba rolovat minutu: údaje,
 * přístupy, dvacet zaškrtávátek upozornění a pod tím padesát řádků historie.
 * Kdo přišel přepnout jedno zaškrtávátko, hledal ho očima v celé té ploše.
 *
 * PŘEPÍNÁ SE V PROHLÍŽEČI, NEMĚNÍ SE ADRESA. Formulář je jeden a ukládá se
 * najednou - kdyby každá záložka byla vlastní stránka, rozdělaná změna by se
 * při přepnutí ztratila. Obsah neaktivní záložky se schválně jen skryje
 * (`hidden`), nerozebírá - jinak by se vyplněná pole v jiné záložce při
 * návratu vrátila na původní hodnoty.
 */
export function ZalozkyKarty({
  zalozky,
}: {
  zalozky: { klic: string; nazev: string; obsah: ReactNode }[];
}) {
  const t = usePreklad();
  const [aktivni, setAktivni] = useState(zalozky[0]?.klic ?? '');

  return (
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label={t('uzivatel.zalozkyPopis')}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {zalozky.map((z) => {
          const jeTu = z.klic === aktivni;
          return (
            <button
              key={z.klic}
              type="button"
              role="tab"
              aria-selected={jeTu}
              onClick={() => setAktivni(z.klic)}
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                jeTu
                  ? 'bg-surface border-line text-brand-purple'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {z.nazev}
            </button>
          );
        })}
      </div>
      {zalozky.map((z) => (
        <div key={z.klic} role="tabpanel" hidden={z.klic !== aktivni} className="pt-4">
          {z.obsah}
        </div>
      ))}
    </div>
  );
}
