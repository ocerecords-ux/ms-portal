'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HromadneMazani, VyberRadku } from '@/components/HromadneMazani';
import {
  RaditelnaTabulka,
  moznostiZ,
  type SloupecTabulky,
} from '@/app/(portal)/components/RaditelnaTabulka';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { ZKRATKA_CASTI, jeCastFaktury } from '@/lib/fakturaCast';
import {
  kdyOdesla,
  kdyPujde,
  popisPoradi,
  upominkaNaSpadnuti,
  type StavUpominky,
} from '@/lib/upominkaStav';

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
  /**
   * Interní značka „1. část / 2. část" (29. 9. 2026). Jen pro nás - na
   * dokladu ani v mailu klientovi není. Prázdno = zakázka není na části.
   */
  cast: string | null;
  /**
   * KDY PŮJDE UPOMÍNKA A KDY ŠLA (zadání 29. 9. 2026). Počítá se na serveru
   * (lib/upominkaStav.ts), tabulka to jen kreslí.
   */
  upominka: StavUpominky;
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
  const t = usePreklad();
  const jazyk = useJazyk();
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
                popisek={t('faktura.vybratRadek', { cislo: r.cislo })}
              />
            ),
          } as SloupecTabulky<FakturaRadek>,
        ]
      : []),
    {
      key: 'nazev',
      label: t('faktura.sloupecNazev'),
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
          {jeCastFaktury(r.cast) && (
            <span
              title="Interní označení — na faktuře se to nikde neobjeví."
              className="inline-flex items-center mt-1 text-[11px] font-heading font-semibold px-2 py-0.5 rounded-pill bg-field text-muted border border-line"
            >
              {ZKRATKA_CASTI[r.cast]}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'odberatel',
      label: t('faktura.sloupecOdberatel'),
      hodnota: (r) => r.odberatel,
      trida: 'text-muted',
      bunka: (r) => r.odberatel,
    },
    {
      key: 'vystaveno',
      label: t('faktura.sloupecVystaveno'),
      hodnota: (r) => r.vystavenoMs,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.vystaveno,
    },
    {
      key: 'splatnost',
      label: t('faktura.sloupecSplatnost'),
      hodnota: (r) => r.splatnostMs,
      trida: 'tabular-nums whitespace-nowrap',
      bunka: (r) => (
        <span className={r.poSplatnosti ? 'text-danger font-semibold' : 'text-muted'}>
          {r.splatnost}
          {r.poSplatnosti && (
            <span className="block text-[11px] font-body">{t('faktura.poSplatnosti')}</span>
          )}
        </span>
      ),
    },
    {
      /**
       * UPOMÍNKA (zadání 29. 9. 2026: „aby mi svítilo, že půjde upomínka za
       * fakturu. A že šla a kdy").
       *
       * Svítí jen den dopředu a dneškem počínaje - u faktury, která visí
       * měsíc, by trvale rozsvícený štítek nikdo nevnímal. Co už odešlo,
       * stojí pod tím tiše, ať je vidět, že se něco děje.
       */
      key: 'upominka',
      label: 'Upomínka',
      // Řadí se podle toho, co je na spadnutí - a teprve pak podle toho,
      // kolik už toho odešlo.
      hodnota: (r) =>
        r.upominka.dalsi ? r.upominka.dalsi.zaDnu : 9000 - r.upominka.odeslane.length,
      trida: 'whitespace-nowrap',
      bunka: (r) => {
        const posledni = r.upominka.odeslane[0];
        if (!r.upominka.dalsi && !posledni) return <span className="text-muted">—</span>;
        const sviti = upominkaNaSpadnuti(r.upominka);
        return (
          <span className="flex flex-col gap-0.5">
            {/* Ve štítku stojí KDY, ne kolikátá - „1. 5. 10." se četlo jako
                jedno rozsypané datum. Pořadí je vedlejší údaj a patří pod to. */}
            {r.upominka.dalsi && (
              <span
                title={
                  sviti
                    ? 'Odejde klientovi automaticky. Když nemá, zastavte to v Doklady → Upomínky.'
                    : 'Termín automatické upomínky.'
                }
                className={`inline-flex items-center self-start text-[11px] font-heading font-semibold px-2 py-0.5 rounded-pill whitespace-nowrap ${
                  sviti ? 'bg-dangerTint text-danger' : 'bg-field text-muted border border-line'
                }`}
              >
                {kdyPujde(r.upominka.dalsi)}
              </span>
            )}
            <span className="text-[11px] font-body text-muted tabular-nums">
              {posledni
                ? `${posledni.poradi}. šla ${kdyOdesla(posledni.kdy)}`
                : r.upominka.dalsi
                  ? popisPoradi(r.upominka.dalsi.poradi)
                  : ''}
            </span>
          </span>
        );
      },
    },
    {
      key: 'stav',
      label: t('faktura.sloupecStav'),
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
      label: t('faktura.sloupecKUhrade'),
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
      /**
       * Řadí se podle SPLATNOSTI, ne podle vystavení (29. 9. 2026: „když
       * najedu do faktur, tak mi je seřaď primárně dle data splatnosti").
       * Vzestupně: nahoře je to, co je po splatnosti nebo se k ní blíží -
       * tedy to, kvůli čemu se do faktur chodí. Kliknutím na hlavičku se to
       * dá kdykoliv přehodit.
       */
      vychoziSloupec="splatnost"
      vychoziSmer="asc"
      prazdno={t('faktura.tabulkaPrazdna')}
      minSirka={860}
      jazyk={jazyk}
      // Hledá se ve všem, co je na řádku vidět - včetně čísla faktury
      // a projektu (zadání 15. 9. 2026).
      hledat={(r) =>
        `${r.nazev} ${r.cislo} ${r.projekt ?? ''} ${r.odberatel} ${r.stav} ${
          jeCastFaktury(r.cast) ? ZKRATKA_CASTI[r.cast] : ''
        }`
      }
      hledatPlaceholder={t('faktura.hledatPlaceholder')}
      filtry={[
        {
          key: 'odberatel',
          label: t('faktura.filtrOdberatel'),
          moznosti: moznostiZ(radky, (r) => r.odberatel),
          vyhovuje: (r, h) => r.odberatel === h,
        },
        {
          key: 'projekt',
          label: t('faktura.filtrProjekt'),
          moznosti: moznostiZ(radky, (r) => r.projekt),
          vyhovuje: (r, h) => r.projekt === h,
        },
        {
          key: 'cast',
          label: 'Část zakázky',
          moznosti: moznostiZ(radky, (r) => (jeCastFaktury(r.cast) ? ZKRATKA_CASTI[r.cast] : null)),
          vyhovuje: (r, h) => jeCastFaktury(r.cast) && ZKRATKA_CASTI[r.cast] === h,
        },
        {
          key: 'stav',
          label: t('faktura.filtrStav'),
          moznosti: [
            ...moznostiZ(radky, (r) => r.stav),
            { hodnota: 'po-splatnosti', popisek: t('faktura.filtrPoSplatnosti') },
          ],
          vyhovuje: (r, h) => (h === 'po-splatnosti' ? r.poSplatnosti : r.stav === h),
        },
      ]}
      rozsahDatumu={{ label: t('faktura.sloupecVystaveno'), ms: (r) => r.vystavenoMs }}
      hromadneAkce={
        lzeMazat
          ? (viditelne) => (
              <HromadneMazani
                viditelneIds={viditelne.map((r) => r.id)}
                vybrane={vybrane}
                onZmena={setVybrane}
                endpoint="/api/admin/invoices/hromadne-smazani"
                poznamka={t('faktura.hromadneMazaniPoznamka')}
              />
            )
          : undefined
      }
    />
  );
}
