'use client';

import Link from 'next/link';
import { RaditelnaTabulka, type SloupecTabulky } from '@/app/(portal)/components/RaditelnaTabulka';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

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
  const t = usePreklad();
  const sloupce: SloupecTabulky<MojeFirmaRadek>[] = [
    {
      key: 'nazev',
      label: t('mojeFirmy.sloupecFirma'),
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
              {t('mojeFirmy.vychoziOdznak')}
            </span>
          )}
          {!r.aktivni && <span className="ml-2 text-xs text-muted">{t('mojeFirmy.neaktivni')}</span>}
        </>
      ),
    },
    {
      key: 'ic',
      label: t('mojeFirmy.ic'),
      hodnota: (r) => r.ic,
      trida: 'text-muted tabular-nums',
      bunka: (r) => r.ic || '—',
    },
    {
      key: 'faktura',
      label: t('mojeFirmy.dalsiFaktura'),
      hodnota: (r) => r.dalsiFaktura,
      trida: 'text-muted tabular-nums',
      bunka: (r) => r.dalsiFaktura,
    },
    {
      key: 'nabidka',
      label: t('mojeFirmy.dalsiNabidka'),
      hodnota: (r) => r.dalsiNabidka,
      trida: 'text-muted tabular-nums',
      bunka: (r) => r.dalsiNabidka,
    },
    {
      key: 'mena',
      label: t('mojeFirmy.mena'),
      hodnota: (r) => r.mena,
      trida: 'text-muted',
      bunka: (r) => r.mena,
    },
    {
      key: 'ucty',
      label: t('mojeFirmy.ucty'),
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
      prazdno={t('mojeFirmy.prazdno')}
      minSirka={820}
    />
  );
}
