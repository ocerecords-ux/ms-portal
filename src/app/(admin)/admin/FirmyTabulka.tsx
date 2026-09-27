'use client';

import Link from 'next/link';
import { RaditelnaTabulka, type SloupecTabulky } from '@/app/(portal)/components/RaditelnaTabulka';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * Přehled firem v administraci, řaditelný kliknutím na název sloupce (zadání
 * 9. 9. 2026).
 *
 * Jedna komponenta pro obě záložky: klienti a dodavatelé. Sloupce se liší,
 * ale všechno ostatní je stejné, takže rozhoduje `druh` - dvě skoro shodné
 * tabulky vedle sebe by se stejně rozešly hned při první úpravě.
 */

export type FirmaRadek = {
  id: string;
  kod: string | null;
  nazev: string;
  /** Klienti */
  sazba: number | null;
  uzivatelu: number;
  objednavek: number;
  /** Dodavatelé */
  kontaktniOsoba: string | null;
  telefonEmail: string | null;
  ic: string | null;
};

export function FirmyTabulka({
  radky,
  druh,
  prazdno,
}: {
  radky: FirmaRadek[];
  druh: 'klienti' | 'dodavatele';
  prazdno: string;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();

  const nazevSloupce: SloupecTabulky<FirmaRadek> = {
    key: 'nazev',
    label: t('firmy.sl.firma'),
    hodnota: (r) => r.nazev,
    trida: 'font-semibold whitespace-nowrap',
    bunka: (r) => (
      <Link href={`/admin/companies/${r.id}`} className="text-ink hover:text-brand-purple no-underline">
        {r.nazev}
      </Link>
    ),
  };

  const kodSloupce: SloupecTabulky<FirmaRadek> = {
    key: 'kod',
    label: t('firmy.sl.kod'),
    hodnota: (r) => r.kod,
    trida: 'text-muted tabular-nums',
    bunka: (r) => r.kod || '—',
  };

  const sloupce: SloupecTabulky<FirmaRadek>[] =
    druh === 'klienti'
      ? [
          kodSloupce,
          nazevSloupce,
          {
            key: 'sazba',
            label: t('firmy.sl.sazba'),
            hodnota: (r) => r.sazba,
            trida: 'tabular-nums',
            bunka: (r) => `${r.sazba ?? '—'} Kč`,
          },
          {
            key: 'uzivatele',
            label: t('firmy.sl.uzivatele'),
            hodnota: (r) => r.uzivatelu,
            trida: 'tabular-nums',
            bunka: (r) => r.uzivatelu,
          },
          {
            key: 'objednavky',
            label: t('firmy.sl.objednavky'),
            hodnota: (r) => r.objednavek,
            trida: 'tabular-nums',
            bunka: (r) => r.objednavek,
          },
        ]
      : [
          kodSloupce,
          nazevSloupce,
          {
            key: 'kontakt',
            label: t('firmy.sl.kontaktniOsoba'),
            hodnota: (r) => r.kontaktniOsoba,
            bunka: (r) => r.kontaktniOsoba || '—',
          },
          {
            key: 'spojeni',
            label: t('firmy.sl.spojeni'),
            hodnota: (r) => r.telefonEmail,
            trida: 'text-muted',
            bunka: (r) => r.telefonEmail || '—',
          },
          {
            key: 'ic',
            label: t('firmy.sl.ic'),
            hodnota: (r) => r.ic,
            trida: 'tabular-nums',
            bunka: (r) => r.ic || '—',
          },
        ];

  return (
    <RaditelnaTabulka
      radky={radky}
      sloupce={sloupce}
      klicRadku={(r) => r.id}
      vychoziSloupec="nazev"
      prazdno={prazdno}
      minSirka={720}
      jazyk={jazyk}
    />
  );
}
