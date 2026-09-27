'use client';

import { QrTlacitko } from '@/components/QrTlacitko';

import Link from 'next/link';
import {
  RaditelnaTabulka,
  moznostiZ,
  type SloupecTabulky,
} from '@/app/(portal)/components/RaditelnaTabulka';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

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
  /** Něco už zaplaceno, ale ne všechno (25. 9. 2026). */
  castecne: boolean;
  /** Kolik ještě zbývá doplatit - naformátované i jako číslo na řazení. */
  zbyva: string;
  zbyvaMinor: number;
};

export function VydajeTabulka({ radky }: { radky: VydajRadek[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const sloupce: SloupecTabulky<VydajRadek>[] = [
    {
      key: 'nazev',
      label: t('vydaj.sloupecNazev'),
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
              {t('vydaj.stitekPriloha')}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'datum',
      label: t('vydaj.sloupecDatum'),
      hodnota: (r) => r.datumMs,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.datum,
    },
    {
      key: 'kategorie',
      label: t('vydaj.sloupecKategorie'),
      hodnota: (r) => r.kategorie,
      trida: 'text-muted whitespace-nowrap',
      bunka: (r) => r.kategorie,
    },
    {
      key: 'splatnost',
      label: t('vydaj.sloupecSplatnost'),
      hodnota: (r) => r.splatnostMs,
      trida: 'tabular-nums whitespace-nowrap',
      bunka: (r) => (
        <span className={r.poSplatnosti ? 'text-danger font-semibold' : 'text-muted'}>
          {r.splatnost}
          {r.poSplatnosti && (
            <span className="block text-[11px] font-body">{t('vydaj.poSplatnosti')}</span>
          )}
        </span>
      ),
    },
    {
      key: 'bezDph',
      label: t('vydaj.sloupecBezDph'),
      hodnota: (r) => r.bezDphMinor,
      vpravo: true,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.bezDph,
    },
    {
      key: 'celkem',
      label: t('vydaj.sloupecCelkem'),
      hodnota: (r) => r.celkemMinor,
      vpravo: true,
      trida: 'text-ink tabular-nums whitespace-nowrap',
      bunka: (r) => (
        <>
          {r.celkem}
          <span className="block text-[11px] font-body text-muted">{r.dph}</span>
          {/* U dokladu placeneho na vicekrat je zbytek to podstatne cislo. */}
          {r.castecne && (
            <span className="block text-[11px] font-heading font-semibold text-danger">
              {t('vydaj.zbyvaCastka', { castka: r.zbyva })}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'stav',
      label: t('vydaj.sloupecStav'),
      // Neuhrazené napřed při vzestupném řazení - to je to, co člověk hledá;
      // rozdělané platby hned za nimi.
      hodnota: (r) => (r.uhrazeno ? 2 : r.castecne ? 1 : 0),
      trida: 'whitespace-nowrap',
      bunka: (r) => (
        <span
          className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
            r.uhrazeno
              ? 'bg-okTint text-status-done'
              : r.castecne
                ? 'bg-warnTint text-status-progress'
                : 'bg-tint text-brand-purpleDark'
          }`}
        >
          {r.uhrazeno
            ? t('vydaj.stavUhrazeno')
            : r.castecne
              ? t('vydaj.stavCastecne')
              : t('vydaj.stavNeuhrazeno')}
        </span>
      ),
    },
  ];

  // QR platba na konci radku - vedle castky, kterou se plati.
  sloupce.push({
    key: 'qr',
    label: t('vydaj.sloupecPlatba'),
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
      prazdno={t('vydaj.tabulkaPrazdna')}
      minSirka={960}
      jazyk={jazyk}
      hledat={(r) => `${r.nazev} ${r.podnadpis ?? ''} ${r.kategorie}`}
      hledatPlaceholder={t('vydaj.hledatPlaceholder')}
      filtry={[
        {
          key: 'kategorie',
          label: t('vydaj.sloupecKategorie'),
          moznosti: moznostiZ(radky, (r) => r.kategorie),
          vyhovuje: (r, h) => r.kategorie === h,
        },
        {
          key: 'stav',
          label: t('vydaj.sloupecStav'),
          moznosti: [
            { hodnota: 'uhrazene', popisek: t('vydaj.filtrUhrazene') },
            { hodnota: 'neuhrazene', popisek: t('vydaj.filtrNeuhrazene') },
            { hodnota: 'castecne', popisek: t('vydaj.filtrCastecne') },
            { hodnota: 'po-splatnosti', popisek: t('vydaj.filtrPoSplatnosti') },
            { hodnota: 's-prilohou', popisek: t('vydaj.filtrSPrilohou') },
            { hodnota: 'bez-prilohy', popisek: t('vydaj.filtrBezPrilohy') },
          ],
          vyhovuje: (r, h) => {
            if (h === 'uhrazene') return r.uhrazeno;
            if (h === 'neuhrazene') return !r.uhrazeno;
            if (h === 'castecne') return r.castecne;
            if (h === 'po-splatnosti') return r.poSplatnosti;
            if (h === 's-prilohou') return r.maPrilohu;
            return !r.maPrilohu;
          },
        },
      ]}
      rozsahDatumu={{ label: t('vydaj.sloupecDatum'), ms: (r) => r.datumMs }}
    />
  );
}
