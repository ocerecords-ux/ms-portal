'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Budik } from '@/app/(portal)/palubovka/Budik';
import type { Stav } from '@/lib/palubovka';
import type { Cile } from '@/lib/palubovkaServer';
import type { KnihaUkazatel, KnihyUkazatele } from '@/lib/knihyPrehledServer';
import { datum, hodiny, kc, pocetKnih } from './format';

/**
 * KNIHY A ROZPOČTY - UKAZATELE (zadání 28. 9. 2026: „ten přehled bych
 * potřeboval zjednodušit. Něco podobného, jako mám palubovku. Jasné
 * ukazatele.").
 *
 * DVA BUDÍKY A JEDNA TABULKA. Nahoře stojí dvě otázky, na které se Peter ptá
 * každý měsíc:
 *
 *   PŘETEČENÍ - o kolik procent nám přetekly rozpočty audioknih celkem.
 *   ZISK MĚSÍCE - kolik knih jsme uzavřeli a jestli to stačí na čistý zisk
 *   400 000 Kč bez DPH.
 *
 * Pod tím jsou knihy uzavřené tenhle a minulý měsíc; u každé je vidět, o kolik
 * přetekl rozpočet procentuálně I V HODINÁCH, a po rozkliknutí se vysune, kdo
 * na ní točil a stříhal - tam se teprve pozná, kde problém vznikl.
 *
 * BUDÍK JE STEJNÝ JAKO NA PALUBOVCE, včetně slovního stavu pod ručičkou -
 * dva různé budíky ve dvou přehledech téže firmy by se musely učit dvakrát.
 */

export function Ukazatele({
  data,
  cile: cilePocatecni,
}: {
  data: KnihyUkazatele;
  cile: Cile;
}) {
  const [cile, setCile] = useState(cilePocatecni);
  const [upravaCile, setUpravaCile] = useState(false);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [rozbalena, setRozbalena] = useState<string | null>(null);

  const cilZisku = cile.mesicniZiskKnih ?? 400_000;

  /**
   * BUDÍK PŘETEČENÍ. Ručička jde od „drží se rozpočtu" po „o pětinu přes" -
   * stupnice do 20 %, protože nad tím už je jedno, jestli je to 25 nebo 60:
   * obojí znamená totéž. Úspora (záporné přetečení) sráží ručičku na nulu.
   */
  const pretek = data.celkem.preteceniProcent;
  const budikPretek = {
    pomer: pretek === null ? 0 : Math.max(0, Math.min(1.2, pretek / 20)),
    stav: (pretek === null
      ? 'HLIDAT'
      : pretek <= 0
        ? 'DOBRE'
        : pretek <= 10
          ? 'HLIDAT'
          : 'SPATNE') as Stav,
    popis:
      pretek === null
        ? 'Zatím není co měřit'
        : pretek <= 0
          ? `Vešli jsme se do rozpočtů, zbylo ${hodiny(Math.abs(data.celkem.preteceniHodin))}`
          : `Přes rozpočty o ${hodiny(data.celkem.preteceniHodin)} celkem`,
  };

  /** BUDÍK ZISKU tohohle měsíce proti cíli 400 000 Kč. */
  const pomerZisku = cilZisku > 0 ? data.tento.zisk / cilZisku : 0;
  const chybiKc = Math.max(0, cilZisku - data.tento.zisk);
  const jesteKnih =
    data.tento.prumernyZisk && data.tento.prumernyZisk > 0
      ? Math.ceil(chybiKc / data.tento.prumernyZisk)
      : null;
  const budikZisk = {
    pomer: Math.max(0, pomerZisku),
    stav: (pomerZisku >= 1 ? 'DOBRE' : pomerZisku >= 0.6 ? 'HLIDAT' : 'SPATNE') as Stav,
    popis:
      pomerZisku >= 1
        ? `Cíl ${kc(cilZisku)} je splněný`
        : jesteKnih
          ? `Chybí ${kc(chybiKc)}, při dosavadním průměru ${pocetKnih(jesteKnih)}`
          : `Chybí ${kc(chybiKc)} do cíle ${kc(cilZisku)}`,
  };

  async function ulozCil(hodnota: number | null) {
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch('/api/palubovka/cile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Posílá se celý objekt cílů - route ukládá všechna pole najednou,
        // takže poslat jen jedno by ostatní vynulovalo.
        body: JSON.stringify({ ...cile, mesicniZiskKnih: hodnota }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || 'Cíl se nepodařilo uložit.');
      setCile(telo.cile as Cile);
      setUpravaCile(false);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Cíl se nepodařilo uložit.');
    } finally {
      setUklada(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Budik
          nadpis="Přetečení rozpočtů audioknih"
          hodnota={
            pretek === null
              ? '—'
              : `${pretek > 0 ? '+' : ''}${pretek.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %`
          }
          budik={budikPretek}
          spodniPopisek={`${data.celkem.prekrocenych} z ${data.celkem.knih} knih přes rozpočet · ${kc(data.celkem.vycerpano)} z ${kc(data.celkem.rozpocet)}`}
          znacka={0}
        />
        <Budik
          nadpis={`Čistý zisk z uzavřených knih · ${data.tento.popis}`}
          hodnota={kc(data.tento.zisk)}
          budik={budikZisk}
          spodniPopisek={`${pocetKnih(data.tento.knih)} uzavřeno · cíl ${kc(cilZisku)} bez DPH`}
          znacka={1}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap text-sm font-body">
        <span className="text-muted">
          Minulý měsíc ({data.minuly.popis}): {pocetKnih(data.minuly.knih)}, čistý zisk{' '}
          <span className={data.minuly.zisk < 0 ? 'text-danger' : 'text-ink'}>{kc(data.minuly.zisk)}</span>
        </span>
        <button
          type="button"
          onClick={() => setUpravaCile((o) => !o)}
          className="ml-auto text-sm font-heading font-semibold text-brand-purple bg-transparent border-0"
        >
          {upravaCile ? 'Zavřít' : 'Změnit cíl zisku'}
        </button>
        <Link
          href="/prehledy/knihy/rozpad"
          className="text-sm font-heading font-semibold text-brand-purple no-underline hover:underline"
        >
          Podrobný rozpad →
        </Link>
      </div>

      {upravaCile && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const hodnota = Number(new FormData(e.currentTarget).get('cil'));
            void ulozCil(Number.isFinite(hodnota) && hodnota > 0 ? Math.round(hodnota) : null);
          }}
          className="bg-surface border border-line rounded-card shadow-sm p-4 flex items-end gap-3 flex-wrap"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">
              Čistý zisk z uzavřených knih za měsíc (Kč bez DPH)
            </span>
            <input
              name="cil"
              type="number"
              min={0}
              step={10000}
              defaultValue={cilZisku}
              className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-56 tabular-nums"
            />
          </label>
          <button
            type="submit"
            disabled={uklada}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
          >
            {uklada ? 'Ukládám…' : 'Uložit'}
          </button>
          {chyba && <span className="text-sm text-danger">{chyba}</span>}
        </form>
      )}

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Knihy uzavřené tenhle a minulý měsíc
        </h2>
        {data.knihy.length === 0 ? (
          <p className="text-sm text-muted m-0">Za tenhle ani minulý měsíc se neuzavřela žádná kniha.</p>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col">
            {data.knihy.map((k) => (
              <RadekKnihy
                key={k.id}
                kniha={k}
                otevreno={rozbalena === k.id}
                prepni={() => setRozbalena((r) => (r === k.id ? null : k.id))}
              />
            ))}
          </ul>
        )}
        <p className="text-xs text-muted m-0">
          Rozpočtové hodiny = (natáčecí frekvence + střihové jednotky) × délka frekvence. Kliknutím
          na knihu se vysune, kdo na ní točil a stříhal.
        </p>
      </section>
    </div>
  );
}

function RadekKnihy({
  kniha: k,
  otevreno,
  prepni,
}: {
  kniha: KnihaUkazatel;
  otevreno: boolean;
  prepni: () => void;
}) {
  const pretek = k.preteceniProcent;
  const prestrelil = (pretek ?? 0) > 0;
  // Pruh se plní k rozpočtu; co je nad ním, se obarví červeně.
  const pomer = k.rozpocet > 0 ? k.vycerpano / k.rozpocet : 0;

  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={prepni}
        aria-expanded={otevreno}
        className="w-full flex items-center gap-3 flex-wrap text-left bg-transparent border-0 py-3 cursor-pointer"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-heading font-semibold text-sm text-ink truncate">{k.nazev}</span>
          <span className="block text-xs text-muted truncate">
            {[k.klient, k.odevzdanoAt ? `uzavřeno ${datum(k.odevzdanoAt)}` : null, `${k.normostran} NS`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>

        <span className="w-40 shrink-0">
          <span className="block h-2 rounded-full bg-field overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, pomer * 100)}%`,
                backgroundColor: prestrelil ? 'rgb(var(--c-danger))' : 'var(--viz-nataceni)',
              }}
            />
          </span>
          <span className="block text-[11px] text-muted tabular-nums mt-1">
            {hodiny(k.hodin)} z {hodiny(k.rozpocetHodin)}
          </span>
        </span>

        <span className="w-28 shrink-0 text-right">
          <span
            className={`block font-heading font-semibold text-sm tabular-nums ${prestrelil ? 'text-danger' : 'text-status-done'}`}
          >
            {pretek === null
              ? '—'
              : `${pretek > 0 ? '+' : ''}${pretek.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} %`}
          </span>
          <span className="block text-[11px] text-muted tabular-nums">
            {k.preteceniHodin > 0 ? '+' : ''}
            {hodiny(k.preteceniHodin)}
          </span>
        </span>

        <span className="w-28 shrink-0 text-right">
          <span
            className={`block font-heading font-semibold text-sm tabular-nums ${k.zisk < 0 ? 'text-danger' : 'text-ink'}`}
          >
            {k.trzba > 0 ? kc(k.zisk) : '—'}
          </span>
          <span className="block text-[11px] text-muted">zisk</span>
        </span>

        <span className="text-muted text-sm shrink-0">{otevreno ? '▾' : '▸'}</span>
      </button>

      {otevreno && (
        <div className="pb-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Udaj nazev="Rozpočet" hodnota={kc(k.rozpocet)} pozn={hodiny(k.rozpocetHodin)} />
            <Udaj nazev="Vyčerpáno" hodnota={kc(k.vycerpano)} pozn={hodiny(k.hodin)} />
            <Udaj
              nazev="Tržba"
              hodnota={k.trzba > 0 ? `${k.trzbaOdhad ? '~' : ''}${kc(k.trzba)}` : '—'}
              pozn={k.trzbaOdhad ? 'odhad z NS a sazby' : 'z faktur'}
            />
            <Udaj nazev="Náklady" hodnota={kc(k.naklady)} pozn="výkazy + výdaje" />
          </div>

          {k.lide.length === 0 ? (
            <p className="text-sm text-muted m-0">Na téhle knize zatím nikdo nic nevykázal.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body border-collapse">
                <thead>
                  <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                    <th className="text-left py-2 pr-3">Kdo</th>
                    <th className="text-right py-2 px-3">Natáčení</th>
                    <th className="text-right py-2 px-3">Střih</th>
                    <th className="text-right py-2 px-3">Ostatní</th>
                    <th className="text-right py-2 pl-3">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {k.lide.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="py-1.5 pr-3 text-ink">{c.jmeno}</td>
                      <td className="text-right py-1.5 px-3 tabular-nums">
                        {c.nataceniHodin > 0 ? hodiny(c.nataceniHodin) : '—'}
                      </td>
                      <td className="text-right py-1.5 px-3 tabular-nums">
                        {c.strihHodin > 0 ? hodiny(c.strihHodin) : '—'}
                      </td>
                      <td className="text-right py-1.5 px-3 tabular-nums">
                        {c.ostatniHodin > 0 ? hodiny(c.ostatniHodin) : '—'}
                      </td>
                      <td className="text-right py-1.5 pl-3 tabular-nums font-heading font-semibold">
                        {kc(c.castka)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Link
            href={`/projekty/${encodeURIComponent(k.id)}`}
            className="self-start text-sm font-heading font-semibold text-brand-purple no-underline hover:underline"
          >
            Otevřít projekt →
          </Link>
        </div>
      )}
    </li>
  );
}

function Udaj({ nazev, hodnota, pozn }: { nazev: string; hodnota: string; pozn?: string }) {
  return (
    <div className="rounded-lg border border-line bg-field px-3 py-2 min-w-0">
      <span className="block text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
        {nazev}
      </span>
      <span className="block font-heading font-semibold text-ink tabular-nums truncate">{hodnota}</span>
      {pozn && <span className="block text-[11px] text-muted truncate">{pozn}</span>}
    </div>
  );
}
