'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';
import { Budik } from '@/app/(portal)/palubovka/Budik';
import type { Stav } from '@/lib/palubovka';
import type { Cile } from '@/lib/palubovkaServer';
import type { KnihaUkazatel, KnihyUkazatele, RozpadDruhu } from '@/lib/knihyPrehledServer';
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
 *   ZISK - kolik knih jsme uzavřeli za vybrané období a jestli to stačí na
 *   čistý zisk 400 000 Kč bez DPH.
 *
 * Pod tím jsou knihy uzavřené ve vybraném období; u každé je vidět, na kolika
 * procentech rozpočtu stojí a o kolik korun ho přejela. Po rozkliknutí se
 * vysune, NA ČEM to přeteklo (natáčení / střih / ostatní) a kdo na ní dělal -
 * tam se teprve pozná, kde problém vznikl.
 *
 * BUDÍK JE STEJNÝ JAKO NA PALUBOVCE, včetně slovního stavu pod ručičkou -
 * dva různé budíky ve dvou přehledech téže firmy by se musely učit dvakrát.
 */

/**
 * ŠKÁLA ČERPÁNÍ (zadání 28. 9. 2026: „ty válce fialové, kolik je vyčerpáno, by
 * měly být asi na barevné škále, a když je přečerpáno, nebo se blíží
 * přečerpání, tak se to mělo jinak zabarvit").
 *
 * Tři stupně, ne plynulý přechod: pruh má říct, jestli se máme starat, ne
 * kreslit teplotu. Používají se stavové barvy portálu - jsou vyhrazené přesně
 * pro tohle a nekřížou se s barvami druhů práce.
 *
 * BARVA NIKDY NEHLÁSÍ SAMA: vedle pruhu stojí procento a stav slovem.
 */
function skala(pomer: number): { barva: string; trida: string; slovy: string } {
  if (pomer > 1) {
    return { barva: 'rgb(var(--c-danger))', trida: 'text-danger', slovy: 'Přes rozpočet' };
  }
  if (pomer > 0.85) {
    return {
      barva: 'rgb(var(--c-status-progress))',
      trida: 'text-status-progress',
      slovy: 'Na hraně',
    };
  }
  return { barva: 'rgb(var(--c-status-done))', trida: 'text-status-done', slovy: 'V rozpočtu' };
}

/** „+12 %", „−34 %", „0 %" - nula se píše bez znaménka, „-0 %" nic neříká. */
function procenta(hodnota: number | null): string {
  if (hodnota === null) return '—';
  const cele = Math.round(hodnota);
  if (cele === 0) return '0 %';
  return `${cele > 0 ? '+' : '−'}${Math.abs(cele)} %`;
}

export function Ukazatele({
  data,
  cile: cilePocatecni,
  obdobi,
}: {
  data: KnihyUkazatele;
  cile: Cile;
  obdobi: string;
}) {
  const router = useRouter();
  const cesta = usePathname();
  const parametry = useSearchParams();

  const [cile, setCile] = useState(cilePocatecni);
  const [upravaCile, setUpravaCile] = useState(false);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [rozbalena, setRozbalena] = useState<string | null>(null);

  const cilZisku = cile.mesicniZiskKnih ?? 400_000;
  const vseZaObdobi = obdobi === 'vse';

  function prepniObdobi(nove: string) {
    const p = new URLSearchParams(parametry?.toString() ?? '');
    if (nove === 'tento') p.delete('obdobi');
    else p.set('obdobi', nove);
    const q = p.toString();
    router.push(q ? `${cesta}?${q}` : cesta);
  }

  /**
   * BUDÍK PŘETEČENÍ. Ručička jde od „drží se rozpočtu" po „o pětinu přes" -
   * stupnice do 20 %, protože nad tím už je jedno, jestli je to 25 nebo 60:
   * obojí znamená totéž. Úspora (záporné přetečení) sráží ručičku na nulu.
   *
   * Měří se přes VŠECHNY rozdělané audioknihy, ne jen za vybrané období -
   * je to stav rozpočtů, ne výsledek měsíce.
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
          ? `Vešli jsme se do rozpočtů, zbylo ${kc(Math.abs(data.celkem.vycerpano - data.celkem.rozpocet))}`
          : `Přes rozpočty o ${kc(data.celkem.vycerpano - data.celkem.rozpocet)} celkem`,
  };

  /** BUDÍK ZISKU za vybrané období proti cíli. */
  const pomerZisku = cilZisku > 0 ? data.vybrany.zisk / cilZisku : 0;
  const chybiKc = Math.max(0, cilZisku - data.vybrany.zisk);
  const jesteKnih =
    data.vybrany.prumernyZisk && data.vybrany.prumernyZisk > 0
      ? Math.ceil(chybiKc / data.vybrany.prumernyZisk)
      : null;
  const budikZisk = {
    pomer: Math.max(0, pomerZisku),
    stav: (pomerZisku >= 1 ? 'DOBRE' : pomerZisku >= 0.6 ? 'HLIDAT' : 'SPATNE') as Stav,
    popis: vseZaObdobi
      ? 'Součet za všechna uzavřená - měsíční cíl se na něj nevztahuje'
      : pomerZisku >= 1
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
          hodnota={procenta(pretek)}
          budik={budikPretek}
          spodniPopisek={`${data.celkem.prekrocenych} z ${data.celkem.knih} knih přes rozpočet · ${kc(data.celkem.vycerpano)} z ${kc(data.celkem.rozpocet)}`}
          znacka={0}
        />
        <Budik
          nadpis={`Čistý zisk z uzavřených knih · ${data.vybrany.popis}`}
          hodnota={kc(data.vybrany.zisk)}
          budik={budikZisk}
          spodniPopisek={`${pocetKnih(data.vybrany.knih)} uzavřeno · cíl ${kc(cilZisku)} bez DPH`}
          znacka={1}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <VyberPole
          aria-label="Období"
          value={obdobi}
          onChange={(e) => prepniObdobi(e.target.value)}
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple min-w-[190px]"
        >
          <option value="tento">Tento měsíc</option>
          <option value="minuly">Minulý měsíc</option>
          <option value="vse">Všechno</option>
          {data.dostupneMesice.map((m) => (
            <option key={m.klic} value={m.klic}>
              {m.popis}
            </option>
          ))}
        </VyberPole>

        <span className="text-sm font-body text-muted">
          Minulý měsíc ({data.minuly.popis}): {pocetKnih(data.minuly.knih)}, čistý zisk{' '}
          <span className={data.minuly.zisk < 0 ? 'text-danger' : 'text-ink'}>
            {kc(data.minuly.zisk)}
          </span>
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
          Knihy uzavřené · {data.vybrany.popis}
        </h2>
        {data.knihy.length === 0 ? (
          <p className="text-sm text-muted m-0">V tomhle období se neuzavřela žádná kniha.</p>
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
          Pruh ukazuje, na kolika procentech rozpočtu kniha stojí. Kliknutím se vysune, na čem
          přetekla a kdo na ní dělal.
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
  // Kolik rozpočtu je snědeno. Pruh se plní k rozpočtu, přes něj už neroste -
  // roste jen červené číslo vedle.
  const pomer = k.rozpocet > 0 ? k.vycerpano / k.rozpocet : 0;
  const s = skala(pomer);
  const prestrelil = pomer > 1;

  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={prepni}
        aria-expanded={otevreno}
        className="w-full flex items-center gap-3 flex-wrap text-left bg-transparent border-0 py-3 cursor-pointer"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-heading font-semibold text-sm text-ink truncate">
            {k.nazev}
          </span>
          <span className="block text-xs text-muted truncate">
            {[
              k.klient,
              k.odevzdanoAt ? `uzavřeno ${datum(k.odevzdanoAt)}` : null,
              `${k.normostran} NS`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>

        <span className="w-44 shrink-0">
          <span className="block h-2 rounded-full bg-field overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.min(100, pomer * 100)}%`, backgroundColor: s.barva }}
            />
          </span>
          <span className="flex items-baseline justify-between gap-2 mt-1">
            <span className={`text-[11px] font-heading font-semibold ${s.trida}`}>{s.slovy}</span>
            <span className="text-[11px] text-muted tabular-nums">
              {Math.round(pomer * 100)} % rozpočtu
            </span>
          </span>
        </span>

        <span className="w-28 shrink-0 text-right">
          <span
            className={`block font-heading font-semibold text-sm tabular-nums ${prestrelil ? 'text-danger' : 'text-status-done'}`}
          >
            {procenta(k.preteceniProcent)}
          </span>
          <span
            className={`block text-[11px] tabular-nums ${prestrelil ? 'text-danger' : 'text-muted'}`}
          >
            {k.preteceniKc > 0 ? '+' : ''}
            {kc(k.preteceniKc)}
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
        <div className="pb-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Udaj nazev="Rozpočet" hodnota={kc(k.rozpocet)} pozn={hodiny(k.rozpocetHodin)} />
            <Udaj nazev="Vyčerpáno" hodnota={kc(k.vycerpano)} pozn={hodiny(k.hodin)} />
            <Udaj
              nazev="Tržba"
              hodnota={k.trzba > 0 ? `${k.trzbaOdhad ? '~' : ''}${kc(k.trzba)}` : '—'}
              pozn={k.trzbaOdhad ? 'zatím neschválená nabídka' : 'ze schválené nabídky'}
            />
            <Udaj nazev="Náklady" hodnota={kc(k.naklady)} pozn="výkazy + výdaje" />
          </div>

          {/* NA ČEM TO PŘETEKLO (zadání 28. 9. 2026). */}
          <div className="flex flex-col gap-2">
            <h3 className="font-heading font-semibold text-xs text-muted uppercase tracking-wide m-0">
              Na čem to přeteklo
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body border-collapse">
                <thead>
                  <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                    <th className="text-left py-2 pr-3">Druh práce</th>
                    <th className="text-right py-2 px-3">Rozpočet</th>
                    <th className="text-right py-2 px-3">Odpracováno</th>
                    <th className="text-right py-2 px-3">Rozdíl</th>
                    <th className="text-right py-2 pl-3">Mzdy</th>
                  </tr>
                </thead>
                <tbody>
                  <RadekDruhu nazev="Natáčení" d={k.nataceni} />
                  <RadekDruhu nazev="Střih" d={k.strih} />
                  {k.ostatni.hodin > 0 && (
                    <RadekDruhu nazev="Ostatní" d={k.ostatni} bezRozpoctu />
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-heading font-semibold text-xs text-muted uppercase tracking-wide m-0">
              Kdo na tom dělal
            </h3>
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
          </div>

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

function RadekDruhu({
  nazev,
  d,
  bezRozpoctu,
}: {
  nazev: string;
  d: RozpadDruhu;
  /** Ostatní práce rozpočet nemá - místo nuly se píše pomlčka. */
  bezRozpoctu?: boolean;
}) {
  const pres = d.preteceniHodin > 0.05;
  return (
    <tr className="border-t border-line">
      <td className="py-1.5 pr-3 text-ink">{nazev}</td>
      <td className="text-right py-1.5 px-3 tabular-nums text-muted">
        {bezRozpoctu ? '—' : hodiny(d.rozpocetHodin)}
      </td>
      <td className="text-right py-1.5 px-3 tabular-nums">{hodiny(d.hodin)}</td>
      <td
        className={`text-right py-1.5 px-3 tabular-nums font-heading font-semibold ${pres ? 'text-danger' : 'text-status-done'}`}
      >
        {pres ? '+' : ''}
        {hodiny(d.preteceniHodin)}
      </td>
      <td className="text-right py-1.5 pl-3 tabular-nums">{kc(d.castka)}</td>
    </tr>
  );
}

function Udaj({ nazev, hodnota, pozn }: { nazev: string; hodnota: string; pozn?: string }) {
  return (
    <div className="rounded-lg border border-line bg-field px-3 py-2 min-w-0">
      <span className="block text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
        {nazev}
      </span>
      <span className="block font-heading font-semibold text-ink tabular-nums truncate">
        {hodnota}
      </span>
      {pozn && <span className="block text-[11px] text-muted truncate">{pozn}</span>}
    </div>
  );
}
