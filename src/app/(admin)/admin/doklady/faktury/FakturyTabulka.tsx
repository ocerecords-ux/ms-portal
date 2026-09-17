'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HromadneMazani, VyberRadku } from '@/components/HromadneMazani';
import {
  RaditelnaTabulka,
  moznostiZ,
  type SloupecTabulky,
} from '@/app/(portal)/components/RaditelnaTabulka';

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

export function FakturyTabulka({
  radky,
  lzeMazat = false,
}: {
  radky: FakturaRadek[];
  /**
   * Zaškrtávátka a hromadné mazání (zadání 17. 9. 2026: „a co stornované
   * faktury? Ty potřebuju taky mazat"). Zapíná se jen v záložce Stornované -
   * jinde se doklad nejdřív stornuje a teprve stornovaný jde smazat natrvalo,
   * aby se odeslaná faktura nedala ztratit jedním kliknutím.
   */
  lzeMazat?: boolean;
}) {
  const [vybrane, setVybrane] = useState<Set<string>>(new Set());

  const sloupce: SloupecTabulky<FakturaRadek>[] = [
    ...(lzeMazat
      ? [
          {
            key: 'vyber',
            label: '',
            trida: 'w-8',
            bunka: (r: FakturaRadek) => (
              <VyberRadku
                zaskrtnuto={vybrane.has(r.id)}
                onZmena={() =>
                  setVybrane((v) => {
                    const dalsi = new Set(v);
                    if (dalsi.has(r.id)) dalsi.delete(r.id);
                    else dalsi.add(r.id);
                    return dalsi;
                  })
                }
                popisek={`Vybrat fakturu ${r.cislo}`}
              />
            ),
          } as SloupecTabulky<FakturaRadek>,
        ]
      : []),
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
      // Hledá se ve všem, co je na řádku vidět - včetně čísla faktury
      // a projektu (zadání 15. 9. 2026).
      hledat={(r) => `${r.nazev} ${r.cislo} ${r.projekt ?? ''} ${r.odberatel} ${r.stav}`}
      hledatPlaceholder="Hledat fakturu, odběratele, projekt…"
      filtry={[
        {
          key: 'odberatel',
          label: 'Odběratel',
          moznosti: moznostiZ(radky, (r) => r.odberatel),
          vyhovuje: (r, h) => r.odberatel === h,
        },
        {
          key: 'projekt',
          label: 'Projekt',
          moznosti: moznostiZ(radky, (r) => r.projekt),
          vyhovuje: (r, h) => r.projekt === h,
        },
        {
          key: 'stav',
          label: 'Stav',
          moznosti: [
            ...moznostiZ(radky, (r) => r.stav),
            { hodnota: 'po-splatnosti', popisek: 'Po splatnosti' },
          ],
          vyhovuje: (r, h) => (h === 'po-splatnosti' ? r.poSplatnosti : r.stav === h),
        },
      ]}
      rozsahDatumu={{ label: 'Vystaveno', ms: (r) => r.vystavenoMs }}
      hromadneAkce={
        lzeMazat
          ? (viditelne) => (
              <HromadneMazani
                viditelneIds={viditelne.map((r) => r.id)}
                vybrane={vybrane}
                onZmena={setVybrane}
                endpoint="/api/admin/invoices/hromadne-smazani"
                poznamka="Smazání je nevratné a v číselné řadě po dokladu zůstane díra. Portál smaže jen stornované faktury — ostatní se musí nejdřív stornovat."
              />
            )
          : undefined
      }
    />
  );
}
