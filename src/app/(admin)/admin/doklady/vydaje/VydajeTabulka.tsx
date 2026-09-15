'use client';

import { QrTlacitko } from '@/components/QrTlacitko';

import Link from 'next/link';
import {
  RaditelnaTabulka,
  moznostiZ,
  type SloupecTabulky,
} from '@/app/(portal)/components/RaditelnaTabulka';

/**
 * Tabulka výdajů, řaditelná kliknutím na název sloupce (zadání 9. 9. 2026).
 *
 * Stránka zůstává serverová a načítá data z databáze; sem posílá jen hotové
 * řádky. Texty jsou naformátované už na serveru (peníze, datumy), aby se do
 * prohlížeče netahaly pomocné funkce - a k nim čísla, podle kterých se řadí.
 * Řadit podle naformátovaného textu by nefungovalo: "9. 10." je jako text
 * větší než "10. 9." a stovka s mezerami se nesečte.
 */

export type VydajRadek = {
  id: string;
  nazev: string;
  /** Řetězec QR platby (SPD 1.0). null = neznáme účet nebo je doklad zaplacený. */
  qrText: string | null;
  ucet: string | null;
  prijemce: string;
  cisloDokladu: string | null;
  podnadpis: string | null;
  maPrilohu: boolean;
  datum: string;
  datumMs: number | null;
  kategorie: string;
  splatnost: string;
  splatnostMs: number | null;
  poSplatnosti: boolean;
  bezDph: string;
  bezDphMinor: number;
  celkem: string;
  celkemMinor: number;
  dph: string;
  uhrazeno: boolean;
};

export function VydajeTabulka({ radky }: { radky: VydajRadek[] }) {
  const sloupce: SloupecTabulky<VydajRadek>[] = [
    {
      key: 'nazev',
      label: 'Název',
      hodnota: (r) => r.nazev,
      trida: 'font-semibold',
      bunka: (r) => (
        <>
          <Link
            href={`/admin/doklady/vydaje/${r.id}`}
            className="text-ink hover:text-brand-purple no-underline"
          >
            {r.nazev}
          </Link>
          {r.podnadpis && <span className="block text-xs text-muted font-body">{r.podnadpis}</span>}
          {r.maPrilohu && (
            <span className="ml-2 text-[10px] font-heading font-bold text-brand-purpleDeep bg-line rounded px-1.5 py-0.5">
              PŘÍLOHA
            </span>
          )}
        </>
      ),
    },
    {
      key: 'datum',
      label: 'Datum',
      hodnota: (r) => r.datumMs,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.datum,
    },
    {
      key: 'kategorie',
      label: 'Kategorie',
      hodnota: (r) => r.kategorie,
      trida: 'text-muted whitespace-nowrap',
      bunka: (r) => r.kategorie,
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
      key: 'bezDph',
      label: 'Bez DPH',
      hodnota: (r) => r.bezDphMinor,
      vpravo: true,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.bezDph,
    },
    {
      key: 'celkem',
      label: 'Celkem',
      hodnota: (r) => r.celkemMinor,
      vpravo: true,
      trida: 'text-ink tabular-nums whitespace-nowrap',
      bunka: (r) => (
        <>
          {r.celkem}
          <span className="block text-[11px] font-body text-muted">{r.dph}</span>
        </>
      ),
    },
    {
      key: 'stav',
      label: 'Stav',
      // Neuhrazené napřed při vzestupném řazení - to je to, co člověk hledá.
      hodnota: (r) => (r.uhrazeno ? 1 : 0),
      trida: 'whitespace-nowrap',
      bunka: (r) => (
        <span
          className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
            r.uhrazeno ? 'bg-okTint text-status-done' : 'bg-tint text-brand-purpleDark'
          }`}
        >
          {r.uhrazeno ? 'Uhrazeno' : 'Neuhrazeno'}
        </span>
      ),
    },
  ];

  // QR platba na konci radku - vedle castky, kterou se plati.
  sloupce.push({
    key: 'qr',
    label: 'Platba',
    trida: 'whitespace-nowrap',
    bunka: (r) =>
      r.qrText && r.ucet ? (
        <QrTlacitko
          text={r.qrText}
          castka={r.celkem}
          prijemce={r.prijemce}
          ucet={r.ucet}
          variabilniSymbol={r.cisloDokladu}
          splatnost={r.splatnost !== '—' ? r.splatnost : null}
        />
      ) : null,
  });

  return (
    <RaditelnaTabulka
      radky={radky}
      sloupce={sloupce}
      klicRadku={(r) => r.id}
      vychoziSloupec="datum"
      vychoziSmer="desc"
      prazdno="Tady zatím nic není."
      minSirka={960}
      hledat={(r) => `${r.nazev} ${r.podnadpis ?? ''} ${r.kategorie}`}
      hledatPlaceholder="Hledat doklad, dodavatele, projekt…"
      filtry={[
        {
          key: 'kategorie',
          label: 'Kategorie',
          moznosti: moznostiZ(radky, (r) => r.kategorie),
          vyhovuje: (r, h) => r.kategorie === h,
        },
        {
          key: 'stav',
          label: 'Stav',
          moznosti: [
            { hodnota: 'uhrazene', popisek: 'Uhrazené' },
            { hodnota: 'neuhrazene', popisek: 'Neuhrazené' },
            { hodnota: 'po-splatnosti', popisek: 'Po splatnosti' },
            { hodnota: 's-prilohou', popisek: 'S přílohou' },
            { hodnota: 'bez-prilohy', popisek: 'Bez přílohy' },
          ],
          vyhovuje: (r, h) => {
            if (h === 'uhrazene') return r.uhrazeno;
            if (h === 'neuhrazene') return !r.uhrazeno;
            if (h === 'po-splatnosti') return r.poSplatnosti;
            if (h === 's-prilohou') return r.maPrilohu;
            return !r.maPrilohu;
          },
        },
      ]}
      rozsahDatumu={{ label: 'Datum', ms: (r) => r.datumMs }}
    />
  );
}
