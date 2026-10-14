'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * SÉRIE U NÁZVU KNIHY (zadání 14. 10. 2026: „u některých audioknížek
 * potřebujeme někde naznačit sérii. Akorát to nechci psát do názvu, protože
 * je pak strašně dlouhý").
 *
 * V PŘEHLEDU JE VIDĚT JEN KOLEČKO s číslem dílu - řádek se o ně nezvýší ani
 * o pixel a kniha bez série vypadá přesně jako dřív. Název série se ukáže až
 * po rozkliknutí, a s ním OSTATNÍ DÍLY JAKO PROKLIK: kdo si sérii otevře,
 * nejčastěji chce skočit na předchozí díl.
 *
 * Je to JEN KE ČTENÍ. Série se zadává a mění v detailu projektu - na jednom
 * místě spolu s názvem knihy, ať se nezadává na dvou místech jinak.
 *
 * Díly si volání počítá ze seznamu, který už má v ruce (viz `dilySerie`
 * v lib/serie.ts) - žádný další dotaz do databáze. Klient tak v oknénku
 * uvidí jen díly své firmy, což je přesně správně.
 */
export function OdznakSerie({
  serie,
  dil,
  dily = [],
  aktivniId,
  velky = false,
}: {
  serie: string;
  dil: number | null;
  /** Ostatní knihy téže série, seřazené podle dílu. */
  dily?: { id: number; name: string; dil: number | null }[];
  aktivniId?: number;
  velky?: boolean;
}) {
  const t = usePreklad();
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLSpanElement | null>(null);

  // Zavře se kliknutím vedle i klávesou Esc - oknénko nesmí zůstat viset
  // nad tabulkou, když už člověk pokračuje jinam.
  useEffect(() => {
    if (!otevreno) return;
    function vedle(e: MouseEvent) {
      if (!obal.current?.contains(e.target as Node)) setOtevreno(false);
    }
    function klavesa(e: KeyboardEvent) {
      if (e.key === 'Escape') setOtevreno(false);
    }
    document.addEventListener('mousedown', vedle);
    document.addEventListener('keydown', klavesa);
    return () => {
      document.removeEventListener('mousedown', vedle);
      document.removeEventListener('keydown', klavesa);
    };
  }, [otevreno]);

  const popis = dil != null ? t('serie.dilZSerie', { dil, serie }) : serie;

  return (
    <span ref={obal} className="relative inline-block align-middle">
      <button
        type="button"
        onClick={(e) => {
          // V tabulce bývá celý řádek odkaz - kolečko nesmí otevřít projekt.
          e.preventDefault();
          e.stopPropagation();
          setOtevreno((v) => !v);
        }}
        title={popis}
        aria-label={popis}
        aria-expanded={otevreno}
        className={`inline-grid place-items-center rounded-full bg-brand-purpleDark text-white font-heading font-bold tabular-nums align-middle ml-2 shrink-0 cursor-pointer border-0 ${
          velky ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[11px]'
        }`}
      >
        {dil ?? '•'}
      </button>
      {otevreno && (
        <span className="absolute z-30 top-[calc(100%+4px)] left-0 w-[270px] max-w-[80vw] bg-surface border border-line rounded-card shadow-lg p-3.5 text-left block cursor-default">
          <span className="block font-heading font-semibold text-sm text-ink break-words">{serie}</span>
          <span className="block text-[11px] font-body text-muted mt-0.5">
            {dil != null ? t('serie.kolikatyDil', { dil }) : t('serie.bezCisla')}
            {dily.length > 1 ? ` · ${t('serie.unasDilu', { pocet: dily.length })}` : ''}
          </span>
          {dily.length > 1 && (
            <span className="flex flex-col gap-0.5 mt-2.5">
              {dily.map((d) => {
                const jeTento = d.id === aktivniId;
                return (
                  <Link
                    key={d.id}
                    href={`/projekty/${d.id}`}
                    onClick={() => setOtevreno(false)}
                    className={`flex items-center gap-2 text-xs no-underline rounded-md px-1.5 py-1 ${
                      jeTento ? 'bg-field text-ink font-semibold' : 'text-brand-purple hover:bg-tint'
                    }`}
                  >
                    <span
                      className={`inline-grid place-items-center w-4 h-4 rounded-full text-[10px] font-heading font-bold tabular-nums shrink-0 ${
                        jeTento ? 'bg-brand-purpleDark text-white' : 'bg-field text-muted'
                      }`}
                    >
                      {d.dil ?? '•'}
                    </span>
                    <span className="truncate">{d.name}</span>
                  </Link>
                );
              })}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
