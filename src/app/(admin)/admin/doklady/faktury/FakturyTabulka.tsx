'use client';

import Link from 'next/link';
import { RaditelnaTabulka, type SloupecTabulky } from '@/app/(portal)/components/RaditelnaTabulka';

/**
 * Tabulka vydaných faktur, řaditelná kliknutím na název sloupce (zadání
 * 9. 9. 2026). Stránka zůstává serverová a posílá sem hotové řádky - texty
 * naformátované a k nim čísla, podle kterých se řadí.
 */

export type FakturaRadek = {
  id: string;
  nazev: string;
  cislo: string;
  projekt: string | null;
  odberatel: string;
  vystaveno: string;
  vystavenoMs: number | null;
  splatnost: string;
  splatnostMs: number | null;
  poSplatnosti: boolean;
  stav: string;
  stavTrida: string;
  /** Pořadí stavu při řazení: rozpracované napřed, uhrazené nakonec. */
  stavPoradi: number;
  castka: string;
  castkaMinor: number;
};

export function FakturyTabulka({ radky }: { radky: FakturaRadek[] }) {
  const sloupce: SloupecTabulky<FakturaRadek>[] = [
    {
      key: 'nazev',
      label: 'Název',
      hodnota: (r) => r.nazev,
      trida: 'font-semibold',
      bunka: (r) => (
        <>
          <Link
            href={`/admin/doklady/faktury/${r.id}`}
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
      key: 'odberatel',
      label: 'Odběratel',
      hodnota: (r) => r.odberatel,
      trida: 'text-muted',
      bunka: (r) => r.odberatel,
    },
    {
      key: 'vystaveno',
      label: 'Vystaveno',
      hodnota: (r) => r.vystavenoMs,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.vystaveno,
    },
    {
      key: 'splatnost',
      label: 'Splatnost',
      hodnota: (r) => r.splatnostMs,
      trida: 'tabular-nums whitespace-nowrap',
      bunka: (r) => (
        <span className={r.poSplatnosti ? 'text-danger font-semibold' : 'text-muted'}>
          {r.splatnost}
          {r.poSplatnosti && <span className="block text-[11px] font-body">po splatnosti</span>}
        </span>
      ),
    },
    {
      key: 'stav',
      label: 'Stav',
      hodnota: (r) => r.stavPoradi,
      trida: 'whitespace-nowrap',
      bunka: (r) => (
        <span
          className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${r.stavTrida}`}
        >
          {r.stav}
        </span>
      ),
    },
    {
      key: 'castka',
      label: 'K úhradě',
      hodnota: (r) => r.castkaMinor,
      vpravo: true,
      trida: 'text-ink tabular-nums whitespace-nowrap',
      bunka: (r) => r.castka,
    },
  ];

  return (
    <RaditelnaTabulka
      radky={radky}
      sloupce={sloupce}
      klicRadku={(r) => r.id}
      vychoziSloupec="vystaveno"
      vychoziSmer="desc"
      prazdno="Tady zatím nic není."
      minSirka={860}
    />
  );
}
