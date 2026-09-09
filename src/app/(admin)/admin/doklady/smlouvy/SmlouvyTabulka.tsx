'use client';

import Link from 'next/link';
import { RaditelnaTabulka, type SloupecTabulky } from '@/app/(portal)/components/RaditelnaTabulka';

/**
 * Tabulka smluv, řaditelná kliknutím na název sloupce (zadání 9. 9. 2026).
 * Stránka zůstává serverová a posílá sem hotové řádky.
 */

export type SmlouvaRadek = {
  id: string;
  nazev: string;
  cislo: string;
  projekt: string | null;
  podepisujici: string;
  podepisujiciDoplnek: string;
  vytvoreno: string;
  vytvorenoMs: number | null;
  podepsalaMediaspace: boolean;
  podepsalaProtistrana: boolean;
  stav: string;
  stavTrida: string;
};

export function SmlouvyTabulka({ radky }: { radky: SmlouvaRadek[] }) {
  const sloupce: SloupecTabulky<SmlouvaRadek>[] = [
    {
      key: 'nazev',
      label: 'Název',
      hodnota: (r) => r.nazev,
      trida: 'font-semibold',
      bunka: (r) => (
        <>
          <Link
            href={`/admin/doklady/smlouvy/${r.id}`}
            className="text-ink hover:text-brand-purple no-underline"
          >
            {r.nazev}
          </Link>
          <span className="block text-xs text-muted font-body">
            <span className="tabular-nums">{r.cislo}</span>
            {r.projekt ? ` · ${r.projekt}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'podepisujici',
      label: 'Podepisující',
      hodnota: (r) => r.podepisujici,
      trida: 'text-muted whitespace-nowrap',
      bunka: (r) => (
        <>
          {r.podepisujici}
          <span className="block text-xs font-body">{r.podepisujiciDoplnek}</span>
        </>
      ),
    },
    {
      key: 'vytvoreno',
      label: 'Vytvořeno',
      hodnota: (r) => r.vytvorenoMs,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.vytvoreno,
    },
    {
      key: 'podpisy',
      label: 'Podpisy',
      // Kolik podpisu chybi - nedopodepsane smlouvy jdou napred.
      hodnota: (r) => (r.podepsalaMediaspace ? 1 : 0) + (r.podepsalaProtistrana ? 1 : 0),
      trida: 'text-xs whitespace-nowrap',
      bunka: (r) => (
        <>
          <span className={r.podepsalaMediaspace ? 'text-status-done' : 'text-muted'}>
            {r.podepsalaMediaspace ? '✓' : '○'} Mediaspace
          </span>
          <span className={`block ${r.podepsalaProtistrana ? 'text-status-done' : 'text-muted'}`}>
            {r.podepsalaProtistrana ? '✓' : '○'} protistrana
          </span>
        </>
      ),
    },
    {
      key: 'stav',
      label: 'Stav',
      hodnota: (r) => r.stav,
      trida: 'whitespace-nowrap',
      bunka: (r) => (
        <span
          className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${r.stavTrida}`}
        >
          {r.stav}
        </span>
      ),
    },
  ];

  return (
    <RaditelnaTabulka
      radky={radky}
      sloupce={sloupce}
      klicRadku={(r) => r.id}
      vychoziSloupec="vytvoreno"
      vychoziSmer="desc"
      prazdno="Tady zatím nic není."
      minSirka={860}
    />
  );
}
