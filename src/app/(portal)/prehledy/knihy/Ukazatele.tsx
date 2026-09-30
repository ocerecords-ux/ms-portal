'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';
import { Budik } from '@/app/(portal)/palubovka/Budik';
import type { Stav } from '@/lib/palubovka';
import type { Cile } from '@/lib/palubovkaServer';
import type { KnihaUkazatel, KnihyUkazatele, RozpadDruhu } from '@/lib/knihyPrehledServer';
import type { TemaNaPlatno } from '@/lib/poradaServer';
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

/** „28. září 2026" - datum do záhlaví porady. */
function dlouheDatum(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
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
  porada,
  program,
  dnesISO,
}: {
  data: KnihyUkazatele;
  cile: Cile;
  obdobi: string;
  /**
   * Režim porady (zadání 28. 9. 2026) - přehled na projektor pro zvukařskou
   * poradu. Peníze v něm nejsou; stránka je sem ani neposílá, viz page.tsx.
   */
  porada: boolean;
  /** Program porady - jen nadpisy, poznámky vedoucího sem nechodí. */
  program: TemaNaPlatno[];
  /** Dnešek ze serveru - datum v záhlaví porady. */
  dnesISO: string;
}) {
  const router = useRouter();
  const cesta = usePathname();
  const parametry = useSearchParams();

  const [cile, setCile] = useState(cilePocatecni);
  const [upravaCile, setUpravaCile] = useState(false);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [rozbalena, setRozbalena] = useState<string | null>(null);

  /**
   * CELÁ OBRAZOVKA PRO PORADU (zadání 28. 9. 2026: „udělej u té porady možnost
   * fullscreenu"). Stejně jako v kalendáři: prohlížeč to umí sám, my mu jen
   * řekneme, co roztáhnout. Z režimu se dá odejít i Escapem nebo lištou
   * prohlížeče, takže se stav čte z `fullscreenchange`, ne z vlastního
   * klepnutí - jinak by ikona zůstala viset v „zapnuto".
   */
  const obalRef = useRef<HTMLDivElement | null>(null);
  const [naCeleObrazovce, setNaCeleObrazovce] = useState(false);
  useEffect(() => {
    const zmena = () => setNaCeleObrazovce(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', zmena);
    return () => document.removeEventListener('fullscreenchange', zmena);
  }, []);

  /**
   * PLÁTNO SE SAMO OBNOVUJE (zadání 28. 9. 2026). Vedoucí odškrtává témata
   * v režii na telefonu; kdyby se plátno neobnovovalo, musel by k počítači.
   * Pět vteřin je dost na to, aby to vypadalo okamžitě, a málo na to, aby to
   * bylo znát - stránka je stejně jen pro jednoho člověka v jedné místnosti.
   */
  useEffect(() => {
    if (!porada) return;
    const casovac = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(casovac);
  }, [porada, router]);

  /** Odškrtnutí rovnou z plátna - když poradu vede od počítače. */
  async function prepniTema(id: string, hotovo: boolean) {
    try {
      await fetch('/api/porada/temata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hotovo }),
      });
      router.refresh();
    } catch {
      // Na plátně se chyba neřeší - vedoucí to odškrtne v režii.
    }
  }

  function prepniCelouObrazovku() {
    const obal = obalRef.current;
    if (!obal) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void obal.requestFullscreen?.().catch(() => {});
  }

  const cilZisku = cile.mesicniZiskKnih ?? 400_000;
  const vseZaObdobi = obdobi === 'vse';

  function prepniObdobi(nove: string) {
    const p = new URLSearchParams(parametry?.toString() ?? '');
    if (nove === 'tento') p.delete('obdobi');
    else p.set('obdobi', nove);
    const q = p.toString();
    router.push(q ? `${cesta}?${q}` : cesta);
  }

  function prepniPoradu() {
    const p = new URLSearchParams(parametry?.toString() ?? '');
    if (porada) p.delete('porada');
    else p.set('porada', '1');
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
        : porada
          ? pretek <= 0
            ? `Vešli jsme se do rozpočtů, zbylo ${hodiny(Math.abs(data.celkem.preteceniHodin))}`
            : `Přes rozpočty o ${hodiny(data.celkem.preteceniHodin)} celkem`
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
    <div
      ref={obalRef}
      className={`flex flex-col gap-5 ${
        // Prvek na celé obrazovce nemá vlastní podklad - bez tohohle by
        // prosvítala černá a přehled by na ní plaval.
        naCeleObrazovce ? 'bg-paper p-5 sm:p-8 overflow-y-auto' : ''
      }`}
    >
      {porada && (
        <header className="flex items-baseline gap-4 flex-wrap border-b border-line pb-4">
          <h1 className="font-display text-3xl sm:text-5xl text-ink m-0">
            Technická porada <span className="text-brand-purple">·</span> Mediaspace
          </h1>
          <span className="font-heading text-lg sm:text-2xl text-muted tabular-nums">
            {dlouheDatum(dnesISO)}
          </span>
        </header>
      )}

      {porada && program.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Program porady · {program.filter((t) => t.hotovo).length} z {program.length} probráno
          </h2>
          {/* NA PLÁTNĚ JSOU JEN NADPISY. Podrobné poznámky má vedoucí v režii
              (/prehledy/knihy/porada) a sem se vůbec neposílají. */}
          <ol className="list-none m-0 p-0 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {program.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void prepniTema(t.id, !t.hotovo)}
                  aria-pressed={t.hotovo}
                  className={`w-full flex items-center gap-4 text-left rounded-card border px-4 py-3 transition-colors cursor-pointer ${
                    t.hotovo
                      ? 'border-line bg-field text-muted'
                      : 'border-line bg-surface text-ink hover:border-brand-purple'
                  }`}
                >
                  <span
                    className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-heading font-semibold ${
                      t.hotovo ? 'bg-status-done text-white' : 'bg-tint text-brand-purple'
                    }`}
                  >
                    {t.hotovo ? '✓' : i + 1}
                  </span>
                  <span
                    className={`font-heading font-semibold text-lg sm:text-2xl ${t.hotovo ? 'line-through' : ''}`}
                  >
                    {t.nadpis}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {porada && (
        <h2 className="font-display text-2xl sm:text-3xl text-ink m-0 pt-2">Rozpočty projektů</h2>
      )}

      <div className={`grid grid-cols-1 gap-4 ${porada ? '' : 'md:grid-cols-2'}`}>
        <Budik
          nadpis="Přetečení rozpočtů audioknih"
          hodnota={procenta(pretek)}
          budik={budikPretek}
          spodniPopisek={
            porada
              ? `${data.celkem.prekrocenych} z ${data.celkem.knih} knih přes rozpočet · ${hodiny(data.celkem.hodin)} z ${hodiny(data.celkem.rozpocetHodin)}`
              : `${data.celkem.prekrocenych} z ${data.celkem.knih} knih přes rozpočet · ${kc(data.celkem.vycerpano)} z ${kc(data.celkem.rozpocet)}`
          }
          znacka={0}
        />
        {!porada && (
          <Budik
            nadpis={`Čistý zisk z uzavřených knih · ${data.vybrany.popis}`}
            hodnota={kc(data.vybrany.zisk)}
            budik={budikZisk}
            spodniPopisek={`${pocetKnih(data.vybrany.knih)} uzavřeno · cíl ${kc(cilZisku)} bez DPH`}
            znacka={1}
          />
        )}
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
          Minulý měsíc ({data.minuly.popis}): {pocetKnih(data.minuly.knih)}
          {!porada && (
            <>
              , čistý zisk{' '}
              <span className={data.minuly.zisk < 0 ? 'text-danger' : 'text-ink'}>
                {kc(data.minuly.zisk)}
              </span>
            </>
          )}
        </span>

        <button
          type="button"
          onClick={prepniPoradu}
          title="Přehled pro zvukařskou poradu - bez cen a zisku"
          className={`ml-auto rounded-pill border font-heading font-semibold text-sm px-4 py-1.5 transition-colors cursor-pointer ${
            porada
              ? 'bg-brand-purple text-white border-brand-purple'
              : 'bg-surface text-muted border-line hover:text-brand-purple hover:border-brand-purple'
          }`}
        >
          {porada ? 'Zpět k celému přehledu' : 'Pro poradu'}
        </button>

        {porada && !naCeleObrazovce && (
          <Link
            href="/prehledy/knihy/porada"
            target="_blank"
            rel="noopener"
            className="text-sm font-heading font-semibold text-brand-purple no-underline hover:underline"
          >
            Režie a poznámky →
          </Link>
        )}

        {porada && (
          <button
            type="button"
            onClick={prepniCelouObrazovku}
            aria-pressed={naCeleObrazovce}
            aria-label={naCeleObrazovce ? 'Zpět z celé obrazovky' : 'Na celou obrazovku'}
            title={naCeleObrazovce ? 'Zpět z celé obrazovky (Esc)' : 'Na celou obrazovku'}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
              naCeleObrazovce
                ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                : 'border-line text-muted hover:text-brand-purple hover:border-brand-purple'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden="true"
            >
              {naCeleObrazovce ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              )}
            </svg>
          </button>
        )}

        {!porada && (
          <>
            <button
              type="button"
              onClick={() => setUpravaCile((o) => !o)}
              className="text-sm font-heading font-semibold text-brand-purple bg-transparent border-0"
            >
              {upravaCile ? 'Zavřít' : 'Změnit cíl zisku'}
            </button>
            <Link
              href="/prehledy/knihy/rozpad"
              className="text-sm font-heading font-semibold text-brand-purple no-underline hover:underline"
            >
              Podrobný rozpad →
            </Link>
          </>
        )}
      </div>

      {upravaCile && !porada && (
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
                porada={porada}
                otevreno={rozbalena === k.id}
                prepni={() => setRozbalena((r) => (r === k.id ? null : k.id))}
              />
            ))}
          </ul>
        )}
        <p className="text-xs text-muted m-0">
          Pruh ukazuje, na kolika procentech rozpočtu kniha stojí. Kliknutím se vysune, na čem
          přetekla a kdo na ní dělal.{' '}
          {porada && 'V režimu porady jsou vidět jen hodiny - žádné ceny, mzdy ani zisk.'}
        </p>
      </section>
    </div>
  );
}

function RadekKnihy({
  kniha: k,
  porada,
  otevreno,
  prepni,
}: {
  kniha: KnihaUkazatel;
  porada: boolean;
  otevreno: boolean;
  prepni: () => void;
}) {
  // Kolik rozpočtu je snědeno. Pruh se plní k rozpočtu, přes něj už neroste -
  // roste jen červené číslo vedle. Poměr chodí ze serveru, aby pruh fungoval
  // i v režimu porady, kde se částky vůbec neposílají.
  const pomer = k.pomerCerpani;
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
            {porada ? (
              <>
                {k.preteceniHodin > 0 ? '+' : ''}
                {hodiny(k.preteceniHodin)}
              </>
            ) : (
              <>
                {k.preteceniKc > 0 ? '+' : ''}
                {kc(k.preteceniKc)}
              </>
            )}
          </span>
        </span>

        {!porada && (
          <span className="w-28 shrink-0 text-right">
            <span
              className={`block font-heading font-semibold text-sm tabular-nums ${k.zisk < 0 ? 'text-danger' : 'text-ink'}`}
            >
              {k.trzba > 0 ? kc(k.zisk) : '—'}
            </span>
            <span className="block text-[11px] text-muted">zisk</span>
          </span>
        )}

        <span className="text-muted text-sm shrink-0">{otevreno ? '▾' : '▸'}</span>
      </button>

      {otevreno && (
        <div className="pb-4 flex flex-col gap-4">
          <div className={`grid gap-3 ${porada ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {porada ? (
              <>
                <Udaj nazev="Rozpočet" hodnota={hodiny(k.rozpocetHodin)} pozn={`${k.normostran} NS`} />
                <Udaj
                  nazev="Odpracováno"
                  hodnota={hodiny(k.hodin)}
                  pozn={`${Math.round(k.pomerCerpani * 100)} % rozpočtu`}
                />
              </>
            ) : (
              <>
                <Udaj nazev="Rozpočet" hodnota={kc(k.rozpocet)} pozn={hodiny(k.rozpocetHodin)} />
                <Udaj nazev="Vyčerpáno" hodnota={kc(k.vycerpano)} pozn={hodiny(k.hodin)} />
                <Udaj
                  nazev="Tržba"
                  hodnota={k.trzba > 0 ? `${k.trzbaOdhad ? '~' : ''}${kc(k.trzba)}` : '—'}
                  pozn={k.trzbaOdhad ? 'zatím neschválená nabídka' : 'ze schválené nabídky'}
                />
                <Udaj nazev="Náklady" hodnota={kc(k.naklady)} pozn="výkazy + výdaje" />
              </>
            )}
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
                    <th className={porada ? 'text-right py-2 pl-3' : 'text-right py-2 px-3'}>
                      Rozdíl
                    </th>
                    {!porada && <th className="text-right py-2 pl-3">Mzdy</th>}
                  </tr>
                </thead>
                <tbody>
                  <RadekDruhu nazev="Natáčení" d={k.nataceni} porada={porada} />
                  <RadekDruhu nazev="Střih" d={k.strih} porada={porada} />
                  {/* Opravy a Ostatní rozpočet nemají - ukazují se, jen když
                      na nich něco je, ať tabulka nemá dva prázdné řádky. */}
                  {k.opravy.hodin > 0 && (
                    <RadekDruhu nazev="Opravy" d={k.opravy} porada={porada} bezRozpoctu />
                  )}
                  {k.ostatni.hodin > 0 && (
                    <RadekDruhu nazev="Ostatní" d={k.ostatni} porada={porada} bezRozpoctu />
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
                      <th className="text-right py-2 px-3">Opravy</th>
                      <th className={porada ? 'text-right py-2 pl-3' : 'text-right py-2 px-3'}>
                        Ostatní
                      </th>
                      {!porada && <th className="text-right py-2 pl-3">Mzda</th>}
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
                          {c.opravyHodin > 0 ? hodiny(c.opravyHodin) : '—'}
                        </td>
                        <td
                          className={`text-right py-1.5 tabular-nums ${porada ? 'pl-3' : 'px-3'}`}
                        >
                          {c.ostatniHodin > 0 ? hodiny(c.ostatniHodin) : '—'}
                        </td>
                        {!porada && (
                          <td className="text-right py-1.5 pl-3 tabular-nums font-heading font-semibold">
                            {kc(c.castka)}
                          </td>
                        )}
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
  porada,
  bezRozpoctu,
}: {
  nazev: string;
  d: RozpadDruhu;
  porada: boolean;
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
        className={`text-right py-1.5 tabular-nums font-heading font-semibold ${porada ? 'pl-3' : 'px-3'} ${pres ? 'text-danger' : 'text-status-done'}`}
      >
        {pres ? '+' : ''}
        {hodiny(d.preteceniHodin)}
      </td>
      {!porada && <td className="text-right py-1.5 pl-3 tabular-nums">{kc(d.castka)}</td>}
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
