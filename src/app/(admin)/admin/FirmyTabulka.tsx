'use client';

import Link from 'next/link';
import { RaditelnaTabulka, type SloupecTabulky } from '@/app/(portal)/components/RaditelnaTabulka';

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
  const nazevSloupce: SloupecTabulky<FirmaRadek> = {
    key: 'nazev',
    label: 'Firma',
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
    label: 'Kód',
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
            label: 'Sazba / normostrana',
            hodnota: (r) => r.sazba,
            trida: 'tabular-nums',
            bunka: (r) => `${r.sazba ?? '—'} Kč`,
          },
          {
            key: 'uzivatele',
            label: 'Uživatelé',
            hodnota: (r) => r.uzivatelu,
            trida: 'tabular-nums',
            bunka: (r) => r.uzivatelu,
          },
          {
            key: 'objednavky',
            label: 'Objednávky',
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
            label: 'Kontaktní osoba',
            hodnota: (r) => r.kontaktniOsoba,
            bunka: (r) => r.kontaktniOsoba || '—',
          },
          {
            key: 'spojeni',
            label: 'Telefon / e-mail',
            hodnota: (r) => r.telefonEmail,
            trida: 'text-muted',
            bunka: (r) => r.telefonEmail || '—',
          },
          {
            key: 'ic',
            label: 'IČ',
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
    />
  );
}
