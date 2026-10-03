'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { DisplayProject } from '@/lib/projektyTypy';
import { StatusPill, formatDate } from './shared';
import { stavProKlientaReklamy } from '@/lib/stavyProjektu';
import { IkonaTypu, KresbaIkony } from '@/lib/ikonyTypu';
import { ZnackyDokladuKlienta } from '@/lib/dokladyKlienta';
import type { DokladKlienta } from '@/lib/dokladyKlientaServer';
import { useJazyk, usePreklad } from '../components/JazykProvider';

/**
 * PŘEHLED PROJEKTŮ U KLIENTA REKLAM (zadání 25. 9. 2026: „u klientů reklam
 * bude jinak poskládaný přehled projektů: Název projektu, Stav, Herec, Typ
 * projektu, Licence (tady když klikne, tak by mu mohlo vyjet menší
 * vyskakovací okno, kde bude mít k dispozici dokumenty a u každého tlačítko
 * stáhnout), Datum dokončení, Odkaz na složku, Připomínkovat (tady bude odkaz
 * na AudioTagger)").
 *
 * Reklama a audiokniha jsou dvě různé práce a klient u nich potřebuje vidět
 * něco jiného. Proto vlastní tabulka, ne další zaškrtávátka v té společné:
 * normostrany, přeposlech ani progres natáčení u spotu nic neznamenají,
 * zato licence, složka a odkaz na připomínky ano.
 *
 * DOKUMENTY JSOU V OKNĚ, ne v řádku: rodný i licenční list se ke spotu můžou
 * vázat oba a dva odkazy navíc by řádek rozbily. Klepnutí na licenci je
 * vytáhne i s tlačítkem Stáhnout.
 */
export type DokumentProjektu = {
  id: string;
  nazev: string;
  /** RL = rodný list (rádiový spot), LL = licenční list (ostatní reklamy). */
  druh: 'RL' | 'LL';
};

export type ReklamaProjekt = DisplayProject;

/**
 * Okno s dokumenty se kotví k pilulce licence, u které se klepne - stejně
 * jako náhled dokladů v přehledu projektů (zadání 27. 9. 2026: „toto
 * vyskakovací okno udělat tak, aby vyskočilo a zavíralo se jako doklady
 * v přehledu projektu"). Žádné ztmavení pozadí: přehled má pod ním zůstat
 * čitelný, ať je vidět, u kterého řádku člověk stojí.
 */
type OknoDokumentu = {
  nazev: string;
  projektId: string;
  dokumenty: DokumentProjektu[];
  left: number;
  top: number;
};

const SIRKA_OKNA = 320;
const MEZERA_OKNA = 8;

export function ReklamaPrehled({
  aktivni,
  dokoncene,
  typy = {},
  licence = {},
  slozky = {},
  dokumenty = {},
  odkazyPripominek = {},
  doklady = {},
  ikony = {},
}: {
  aktivni: ReklamaProjekt[];
  dokoncene: ReklamaProjekt[];
  /**
   * Typ projektu podle ID zakázky (položka ceníku). Od 1. 10. 2026 nemá
   * vlastní sloupec - je z něj ikona u názvu, stejně jako v našem přehledu
   * („pole Typ projektu nahraďme ikonami, jako máme my v přehledu projektu").
   * Název typu zůstává v bublince nad ikonou.
   */
  typy?: Record<string, string | null>;
  /** Druhy licence u zakázky - jméno a ikona. */
  licence?: Record<string, { nazev: string; ikona: string | null }[]>;
  /** Odkaz do složky projektu na Disku. */
  slozky?: Record<string, string | null>;
  /** Rodné a licenční listy ke stažení. */
  dokumenty?: Record<string, DokumentProjektu[]>;
  /** Odkaz do AudioTaggeru (tagger spotu s tlačítkem Schválit). */
  odkazyPripominek?: Record<string, string | null>;
  /** Nabídka, faktura a objednávka k zakázce (1. 10. 2026). */
  doklady?: Record<string, DokladKlienta[]>;
  /** Klíč ikony typu zakázky z ceníku (1. 10. 2026). */
  ikony?: Record<string, string | null>;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  /**
   * DOKONČENÉ JSOU VIDĚT ROVNOU (zadání 27. 9. 2026: „aby primárně byly ty
   * dokončené projekty odkryté, klient si je když tak schová sám"). Klient
   * reklam se k hotovým spotům vrací - stahuje si listy, otevírá složku -
   * takže skrývat je za tlačítko znamenalo klik navíc pokaždé.
   */
  const [rozbaleno, setRozbaleno] = useState(true);
  const [okno, setOkno] = useState<OknoDokumentu | null>(null);
  const oknoRef = useRef<HTMLDivElement | null>(null);

  /** Okno se nesmí schovat pod spodní hranou - když se nevejde, jde nahoru. */
  useLayoutEffect(() => {
    if (!okno || !oknoRef.current) return;
    const r = oknoRef.current.getBoundingClientRect();
    if (r.bottom > window.innerHeight - MEZERA_OKNA) {
      const novy = Math.max(MEZERA_OKNA, window.innerHeight - r.height - MEZERA_OKNA);
      if (Math.abs(novy - okno.top) > 1) setOkno({ ...okno, top: novy });
    }
  }, [okno]);

  // Escape, klik mimo a posun stránky okno zavřou - stejně jako u dokladů.
  useEffect(() => {
    if (!okno) return;
    /**
     * Posun STRÁNKY okno zavře (jinak by zůstalo viset u jiného řádku), ale
     * posun UVNITŘ okna ne - u zakázky s pěti listy se seznam roluje a musí
     * v něm jít jezdit (27. 9. 2026: „nejde v tom otevřeném okně rolovat").
     */
    const zavri = (e?: Event) => {
      const cil = e?.target;
      if (cil instanceof Node && oknoRef.current?.contains(cil)) return;
      setOkno(null);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOkno(null);
    };
    const mimo = (e: MouseEvent) => {
      if (oknoRef.current && !oknoRef.current.contains(e.target as Node)) setOkno(null);
    };
    window.addEventListener('keydown', klavesa);
    window.addEventListener('scroll', zavri, true);
    window.addEventListener('resize', zavri);
    // Až v dalším cyklu, ať otevírací klik okno rovnou nezavře.
    const t = window.setTimeout(() => document.addEventListener('mousedown', mimo), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', klavesa);
      window.removeEventListener('scroll', zavri, true);
      window.removeEventListener('resize', zavri);
      document.removeEventListener('mousedown', mimo);
    };
  }, [okno]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
          {t('projekty.aktivni')}
        </h2>
        <Tabulka
          projekty={aktivni}
          prazdne={t('projekty.zadneAktivni')}
          {...{ typy, licence, slozky, dokumenty, odkazyPripominek, doklady, ikony, jazyk, setOkno }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('projekty.dokoncene')}
          </h2>
          <button
            type="button"
            onClick={() => setRozbaleno((v) => !v)}
            className="bg-surface border border-line text-ink font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-field transition-colors"
          >
            {rozbaleno
              ? t('projekty.skrytDokoncene')
              : t('projekty.zobrazitDokoncene', { pocet: dokoncene.length })}
          </button>
        </div>
        {rozbaleno && (
          <Tabulka
            projekty={dokoncene}
            prazdne={t('projekty.zadneDokoncene')}
            {...{ typy, licence, slozky, dokumenty, odkazyPripominek, doklady, ikony, jazyk, setOkno }}
          />
        )}
      </div>

      {/* Dokumenty k zakázce - okno u pilulky, jako náhled dokladů. */}
      {okno && (
        <div
          ref={oknoRef}
          style={{ position: 'fixed', left: okno.left, top: okno.top, width: SIRKA_OKNA }}
          className="z-[90] bg-surface border border-line rounded-card shadow-2xl overflow-hidden text-left"
        >
          <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 border-b border-line">
            <span className="font-heading font-semibold text-sm text-ink truncate">{okno.nazev}</span>
            {okno.dokumenty.length > 1 && (
              <a
                href={`/api/projects/${encodeURIComponent(okno.projektId)}/dokumenty/zip`}
                title="Stáhne všechny dokumenty zakázky v jednom archivu"
                className="shrink-0 text-xs font-heading font-semibold text-brand-purple no-underline hover:underline"
              >
                Stáhnout vše
              </a>
            )}
          </div>
          <div className="p-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
            {okno.dokumenty.length === 0 && (
              <p className="text-sm font-body text-muted m-0">Zatím tu žádný dokument není.</p>
            )}
            {okno.dokumenty.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 justify-between border border-line rounded-lg px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-heading text-muted">
                    {d.druh === 'RL' ? 'Rodný list' : 'Licenční list'}
                  </span>
                  <span className="block text-sm font-body text-ink truncate">{d.nazev}</span>
                </span>
                <a
                  href={d.druh === 'RL' ? `/api/rodny-list/${d.id}` : `/api/licencni-list/${d.id}`}
                  download
                  className="shrink-0 bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 no-underline hover:bg-brand-purpleDeep transition-colors"
                >
                  Stáhnout
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tabulka({
  projekty,
  prazdne,
  typy,
  licence,
  slozky,
  dokumenty,
  odkazyPripominek,
  doklady,
  ikony,
  jazyk,
  setOkno,
}: {
  projekty: ReklamaProjekt[];
  prazdne: string;
  typy: Record<string, string | null>;
  licence: Record<string, { nazev: string; ikona: string | null }[]>;
  slozky: Record<string, string | null>;
  dokumenty: Record<string, DokumentProjektu[]>;
  odkazyPripominek: Record<string, string | null>;
  doklady: Record<string, DokladKlienta[]>;
  ikony: Record<string, string | null>;
  jazyk: ReturnType<typeof useJazyk>;
  setOkno: (v: OknoDokumentu | null) => void;
}) {
  if (projekty.length === 0) {
    return (
      <div className="bg-surface rounded-card border border-line shadow-sm px-6 py-10 text-center">
        <p className="text-sm font-body text-muted m-0">{prazdne}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              <th className="text-left px-4 py-3.5">Projekt</th>
              <th className="text-left px-4 py-3.5">Stav</th>
              <th className="text-left px-4 py-3.5">Herec</th>
              {/* „Typ projektu" tu od 1. 10. 2026 není - je z něj ikona
                  u názvu a uvolněné místo zabraly Doklady. */}
              <th className="text-left px-4 py-3.5">Licence</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Doklady</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Dokončení</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Složka</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Připomínkovat</th>
            </tr>
          </thead>
          <tbody>
            {projekty.map((p) => {
              const id = String(p.id);
              const druhy = licence[id] ?? [];
              const listy = dokumenty[id] ?? [];
              const slozka = slozky[id];
              const pripominky = odkazyPripominek[id];
              return (
                <tr key={p.id} className="border-t border-line hover:bg-field/60 transition-colors">
                  <td className="px-4 py-2.5 align-middle">
                    <span className="flex items-center gap-2">
                      {/* Ikona typu zakázky místo sloupce (1. 10. 2026) - co
                          znamená, řekne bublinka nad ní, stejně jako u nás. */}
                      <IkonaTypu klic={ikony[id] ?? null} typProjektu={typy[id] ?? null} mezeraKdyzNeni />
                      <Link
                        href={`/projekty/${p.id}`}
                        className="text-ink hover:text-brand-purple no-underline font-heading text-sm whitespace-normal break-words leading-snug"
                      >
                        {p.name}
                      </Link>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    {/* Klient reklamy vidí jen svých pět stavů (25. 9. 2026). */}
                    <StatusPill
                      finished={p.finished}
                      statusName={p.statusName}
                      popisek={stavProKlientaReklamy(p.statusName, jazyk)}
                      jazyk={jazyk}
                    />
                  </td>
                  <td className="px-4 py-2.5 align-middle text-sm font-body text-muted">
                    {p.herci && p.herci.length > 0
                      ? p.herci.map((h) => h.jmeno).join(', ')
                      : p.narrator || '—'}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    {/* LICENCE JE POPIS, DOKUMENTY JSOU IKONA (zadání 27. 9.
                        2026: „u té licence by to chtělo nějakou jednoznačnou
                        jednu ikonu, na kterou kliknu, je to zmatené klikat na
                        dvě různé věci"). Pilulky licence se na klepnutí
                        netváří; klikací je jen ikona dokumentů s počtem. */}
                    {druhy.length === 0 && listy.length === 0 ? (
                      <span className="text-sm text-muted">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        {druhy.map((l) => (
                          <span
                            key={l.nazev}
                            className="inline-flex items-center gap-1 rounded-pill border border-line px-2 py-0.5 text-xs font-heading text-ink"
                          >
                            {l.ikona ? <KresbaIkony klic={l.ikona} velikost={11} /> : null}
                            {l.nazev}
                          </span>
                        ))}
                        {listy.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setOkno({
                                nazev: p.name,
                                projektId: id,
                                dokumenty: listy,
                                left: Math.min(r.left, window.innerWidth - SIRKA_OKNA - MEZERA_OKNA),
                                top: r.bottom + MEZERA_OKNA,
                              });
                            }}
                            title={`Dokumenty ke stažení (${listy.length})`}
                            aria-label={`Dokumenty ke stažení (${listy.length})`}
                            className="shrink-0 inline-flex items-center gap-1 rounded-pill border border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight px-2 py-1 cursor-pointer hover:border-brand-purple transition-colors"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width={13}
                              height={13}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 3 14 8 19 8" />
                              <line x1="12" y1="11" x2="12" y2="16" />
                              <polyline points="9.5 14 12 16.5 14.5 14" />
                            </svg>
                            <span className="text-[11px] font-heading font-semibold tabular-nums">
                              {listy.length}
                            </span>
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    {/* Nabídka, faktura a objednávka (1. 10. 2026) - klik
                        ukáže náhled a tlačítko na PDF, viz NahledIkony. */}
                    <ZnackyDokladuKlienta doklady={doklady[id]} />
                  </td>
                  <td className="px-4 py-2.5 align-middle text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                    {formatDate(p.endDate, jazyk)}
                  </td>
                  <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                    {/* OBRANDOVANÝ DISK, NE ODKAZ NA GOOGLE (zadání 27. 9.
                        2026). V adrese je id projektu, ne složky - portál
                        ověří, že projekt klientovi patří, a teprve pak jeho
                        složku ukáže. */}
                    {slozka ? (
                      <Link
                        href={`/nahravky?projekt=${encodeURIComponent(id)}`}
                        className="text-brand-purple font-heading text-xs no-underline hover:underline"
                      >
                        Otevřít složku
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                    {/* HOTOVÝ SPOT SE UŽ NEPŘIPOMÍNKUJE (zadání 27. 9. 2026).
                        Dokončená zakázka je odevzdaná a schválená; odkaz do
                        taggeru by sváděl psát připomínky k něčemu, co se už
                        nemění. */}
                    {pripominky && !p.finished ? (
                      <a
                        href={pripominky}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 no-underline hover:bg-brand-purpleDeep transition-colors"
                      >
                        Připomínkovat
                      </a>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
