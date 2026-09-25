'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DisplayProject } from '@/lib/projektyTypy';
import { StatusPill, formatDate } from './shared';
import { stavProKlientaReklamy } from '@/lib/stavyProjektu';
import { KresbaIkony } from '@/lib/ikonyTypu';
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

export function ReklamaPrehled({
  aktivni,
  dokoncene,
  typy = {},
  licence = {},
  slozky = {},
  dokumenty = {},
  odkazyPripominek = {},
}: {
  aktivni: ReklamaProjekt[];
  dokoncene: ReklamaProjekt[];
  /** Typ projektu podle ID zakázky (položka ceníku). */
  typy?: Record<string, string | null>;
  /** Druhy licence u zakázky - jméno a ikona. */
  licence?: Record<string, { nazev: string; ikona: string | null }[]>;
  /** Odkaz do složky projektu na Disku. */
  slozky?: Record<string, string | null>;
  /** Rodné a licenční listy ke stažení. */
  dokumenty?: Record<string, DokumentProjektu[]>;
  /** Odkaz do AudioTaggeru (tagger spotu s tlačítkem Schválit). */
  odkazyPripominek?: Record<string, string | null>;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [rozbaleno, setRozbaleno] = useState(false);
  const [okno, setOkno] = useState<{ nazev: string; dokumenty: DokumentProjektu[] } | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
          {t('projekty.aktivni')}
        </h2>
        <Tabulka
          projekty={aktivni}
          prazdne={t('projekty.zadneAktivni')}
          {...{ typy, licence, slozky, dokumenty, odkazyPripominek, jazyk, setOkno }}
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
            {...{ typy, licence, slozky, dokumenty, odkazyPripominek, jazyk, setOkno }}
          />
        )}
      </div>

      {/* Dokumenty k zakázce - malé okno, ať se kvůli stažení nikam neproklikává. */}
      {okno && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOkno(null)}
          role="presentation"
        >
          <div
            className="bg-surface border border-line rounded-card shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
              <span className="font-heading font-semibold text-sm text-ink">{okno.nazev}</span>
              <button
                type="button"
                onClick={() => setOkno(null)}
                aria-label="Zavřít"
                className="text-muted hover:text-ink text-xl leading-none bg-transparent border-0 cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2">
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
  jazyk: ReturnType<typeof useJazyk>;
  setOkno: (v: { nazev: string; dokumenty: DokumentProjektu[] } | null) => void;
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
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Typ projektu</th>
              <th className="text-left px-4 py-3.5">Licence</th>
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
                    <Link
                      href={`/projekty/${p.id}`}
                      className="text-ink hover:text-brand-purple no-underline font-heading text-sm whitespace-normal break-words leading-snug"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    {/* Klient reklamy vidí jen svých pět stavů (25. 9. 2026). */}
                    <StatusPill
                      finished={p.finished}
                      statusName={p.statusName}
                      popisek={stavProKlientaReklamy(p.statusName)}
                    />
                  </td>
                  <td className="px-4 py-2.5 align-middle text-sm font-body text-muted">
                    {p.herci && p.herci.length > 0
                      ? p.herci.map((h) => h.jmeno).join(', ')
                      : p.narrator || '—'}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-sm font-body text-muted">
                    {typy[id] || '—'}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    {druhy.length === 0 && listy.length === 0 ? (
                      <span className="text-sm text-muted">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOkno({ nazev: p.name, dokumenty: listy })}
                        title={
                          listy.length > 0
                            ? 'Dokumenty k zakázce'
                            : 'K téhle zakázce zatím žádný dokument není'
                        }
                        className="inline-flex items-center gap-1.5 flex-wrap bg-transparent border-0 cursor-pointer p-0 text-left"
                      >
                        {druhy.length > 0 ? (
                          druhy.map((l) => (
                            <span
                              key={l.nazev}
                              className="inline-flex items-center gap-1 rounded-pill border border-line px-2 py-0.5 text-xs font-heading text-ink hover:border-brand-purple"
                            >
                              {l.ikona ? <KresbaIkony klic={l.ikona} velikost={11} /> : null}
                              {l.nazev}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-pill border border-line px-2 py-0.5 text-xs font-heading text-ink hover:border-brand-purple">
                            Dokumenty
                          </span>
                        )}
                        {listy.length > 0 && (
                          <span className="text-[11px] font-heading text-brand-purple">
                            {listy.length}×
                          </span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                    {formatDate(p.endDate, jazyk)}
                  </td>
                  <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                    {slozka ? (
                      <a
                        href={slozka}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-purple font-heading text-xs no-underline hover:underline"
                      >
                        Otevřít složku
                      </a>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                    {pripominky ? (
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
