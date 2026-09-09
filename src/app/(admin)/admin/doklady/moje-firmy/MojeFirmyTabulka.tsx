'use client';

import Link from 'next/link';
import { RaditelnaTabulka, type SloupecTabulky } from '@/app/(portal)/components/RaditelnaTabulka';

/** Vlastní fakturační firmy, řaditelné kliknutím na název sloupce (9. 9. 2026). */

export type MojeFirmaRadek = {
  id: string;
  nazev: string;
  vychozi: boolean;
  aktivni: boolean;
  ic: string | null;
  dalsiFaktura: string;
  dalsiNabidka: string;
  mena: string;
  uctu: number;
};

export function MojeFirmyTabulka({ radky }: { radky: MojeFirmaRadek[] }) {
  const sloupce: SloupecTabulky<MojeFirmaRadek>[] = [
    {
      key: 'nazev',
      label: 'Firma',
      hodnota: (r) => r.nazev,
      trida: 'font-semibold',
      bunka: (r) => (
        <>
          <Link
            href={`/admin/doklady/moje-firmy/${r.id}`}
            className="text-ink hover:text-brand-purple no-underline"
          >
            {r.nazev}
          </Link>
          {r.vychozi && (
            <span className="ml-2 text-[10px] font-heading font-bold text-brand-purpleDeep bg-tint rounded px-1.5 py-0.5">
              VÝCHOZÍ
            </span>
          )}
          {!r.aktivni && <span className="ml-2 text-xs text-muted">(neaktivní)</span>}
        </>
      ),
    },
    {
      key: 'ic',
      label: 'IČ',
      hodnota: (r) => r.ic,
      trida: 'text-muted tabular-nums',
      bunka: (r) => r.ic || '—',
    },
    {
      key: 'faktura',
      label: 'Další faktura',
      hodnota: (r) => r.dalsiFaktura,
      trida: 'text-muted tabular-nums',
      bunka: (r) => r.dalsiFaktura,
    },
    {
      key: 'nabidka',
      label: 'Další nabídka',
      hodnota: (r) => r.dalsiNabidka,
      trida: 'text-muted tabular-nums',
      bunka: (r) => r.dalsiNabidka,
    },
    {
      key: 'mena',
      label: 'Měna',
      hodnota: (r) => r.mena,
      trida: 'text-muted',
      bunka: (r) => r.mena,
    },
    {
      key: 'ucty',
      label: 'Účty',
      hodnota: (r) => r.uctu,
      vpravo: true,
      trida: 'text-muted tabular-nums',
      bunka: (r) => r.uctu,
    },
  ];

  return (
    <RaditelnaTabulka
      radky={radky}
      sloupce={sloupce}
      klicRadku={(r) => r.id}
      vychoziSloupec="nazev"
      prazdno="Zatím tu není žádná firma. Založte první formulářem níže — bez ní nejde vystavit doklad."
      minSirka={820}
    />
  );
}
