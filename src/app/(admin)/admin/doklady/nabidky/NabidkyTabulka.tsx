'use client';

import Link from 'next/link';
import {
  RaditelnaTabulka,
  moznostiZ,
  type SloupecTabulky,
} from '@/app/(portal)/components/RaditelnaTabulka';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * Tabulka nabídek, řaditelná kliknutím na název sloupce (zadání 9. 9. 2026).
 * Stránka zůstává serverová a posílá sem hotové řádky.
 */

export type NabidkaRadek = {
  id: string;
  nazev: string;
  cislo: string;
  projekt: string | null;
  odberatel: string;
  vystaveno: string;
  vystavenoMs: number | null;
  stav: string;
  stavTrida: string;
  stavPoradi: number;
  bezDph: string;
  bezDphMinor: number;
  sDph: string;
  sDphMinor: number;
};

export function NabidkyTabulka({ radky }: { radky: NabidkaRadek[] }) {
  const t = usePreklad();
  // Tabulka si jazyk bere propem, ne hookem - viz poznámka u RaditelnaTabulka.
  const jazyk = useJazyk();

  const sloupce: SloupecTabulky<NabidkaRadek>[] = [
    {
      key: 'nazev',
      label: t('nabidka.sl.nazev'),
      hodnota: (r) => r.nazev,
      trida: 'font-semibold',
      bunka: (r) => (
        <>
          <Link
            href={`/admin/doklady/nabidky/${r.id}`}
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
      label: t('nabidka.sl.odberatel'),
      hodnota: (r) => r.odberatel,
      trida: 'text-muted',
      bunka: (r) => r.odberatel,
    },
    {
      key: 'vystaveno',
      label: t('nabidka.sl.vystaveno'),
      hodnota: (r) => r.vystavenoMs,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.vystaveno,
    },
    {
      key: 'stav',
      label: t('nabidka.sl.stav'),
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
      key: 'bezDph',
      label: t('nabidka.sl.bezDph'),
      hodnota: (r) => r.bezDphMinor,
      vpravo: true,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.bezDph,
    },
    {
      key: 'sDph',
      label: t('nabidka.sl.sDph'),
      hodnota: (r) => r.sDphMinor,
      vpravo: true,
      trida: 'text-ink tabular-nums whitespace-nowrap',
      bunka: (r) => r.sDph,
    },
  ];

  return (
    <RaditelnaTabulka
      radky={radky}
      sloupce={sloupce}
      klicRadku={(r) => r.id}
      vychoziSloupec="vystaveno"
      vychoziSmer="desc"
      jazyk={jazyk}
      prazdno={t('nabidka.tabulkaPrazdna')}
      minSirka={860}
      hledat={(r) => `${r.nazev} ${r.cislo} ${r.projekt ?? ''} ${r.odberatel} ${r.stav}`}
      hledatPlaceholder={t('nabidka.hledatPlaceholder')}
      filtry={[
        {
          key: 'odberatel',
          label: t('nabidka.sl.odberatel'),
          moznosti: moznostiZ(radky, (r) => r.odberatel),
          vyhovuje: (r, h) => r.odberatel === h,
        },
        {
          key: 'projekt',
          label: t('nabidka.sl.projekt'),
          moznosti: moznostiZ(radky, (r) => r.projekt),
          vyhovuje: (r, h) => r.projekt === h,
        },
        {
          key: 'stav',
          label: t('nabidka.sl.stav'),
          moznosti: moznostiZ(radky, (r) => r.stav),
          vyhovuje: (r, h) => r.stav === h,
        },
      ]}
      rozsahDatumu={{ label: t('nabidka.sl.vystaveno'), ms: (r) => r.vystavenoMs }}
    />
  );
}
