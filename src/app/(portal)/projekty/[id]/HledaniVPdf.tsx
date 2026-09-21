'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hledej, pripravStranu, type MoznostiHledani, type Nalez, type StrankaTextu } from '@/lib/hledaniVPdf';

/**
 * HLEDÁNÍ V PDF (zadání 21. 9. 2026: „v PDF bych chtěl sofistikovanější
 * vyhledávání slov"). Logika je v lib/hledaniVPdf.ts, tady je políčko,
 * přepínače, seznam nálezů a žluté podbarvení v textu.
 *
 * Text celé knihy se vytáhne až při PRVNÍM hledání (u 300 stran to trvá pár
 * vteřin, ukazuje se průběh) a pak se drží v paměti - další hledání je
 * okamžité, i při každém stisku klávesy.
 *
 * Podbarvení se kreslí do vrstvy `[data-hledani]` u každé strany - stejně
 * jako zvýraznění chyb; React do ní nesahá.
 */
export function HledaniVPdf({
  doc,
  pdfjs,
  obalRef,
}: {
  /** Načtené PDF (pdf.js). Nové PDF = nový index. */
  doc: any;
  pdfjs: any;
  /** Obal stránek, ve kterém jsou rámečky `[data-strana]`. */
  obalRef: { current: HTMLDivElement | null };
}) {
  const [dotaz, setDotaz] = useState('');
  const [moznosti, setMoznosti] = useState<MoznostiHledani>({});
  const [strany, setStrany] = useState<StrankaTextu[] | null>(null);
  const [indexuji, setIndexuji] = useState<{ hotovo: number; celkem: number } | null>(null);
  const [aktualni, setAktualni] = useState(0);
  const [seznam, setSeznam] = useState(false);
  const [nastaveni, setNastaveni] = useState(false);
  const policko = useRef<HTMLInputElement | null>(null);
  const indexDoc = useRef<any>(null);

  // Nove PDF - stary index neplati.
  useEffect(() => {
    setStrany(null);
    indexDoc.current = null;
    setAktualni(0);
  }, [doc]);

  /** Vytáhne text všech stran (jednou za PDF). */
  const indexuj = useCallback(async () => {
    if (!doc || !pdfjs || indexDoc.current === doc) return;
    indexDoc.current = doc;
    const vysledek: StrankaTextu[] = [];
    setIndexuji({ hotovo: 0, celkem: doc.numPages });
    for (let n = 1; n <= doc.numPages; n += 1) {
      try {
        const stranka = await doc.getPage(n);
        const vp = stranka.getViewport({ scale: 1 });
        const obsah = await stranka.getTextContent();
        const polozky = (obsah.items as any[])
          .filter((p) => typeof p.str === 'string')
          .map((p) => {
            const t = pdfjs.Util.transform(vp.transform, p.transform);
            const vyska = Math.hypot(t[2], t[3]) || 10;
            return {
              str: p.str as string,
              hasEOL: Boolean(p.hasEOL),
              x: t[4] / vp.width,
              y: (t[5] - vyska) / vp.height,
              w: (p.width || 0) / vp.width,
              h: (vyska * 1.2) / vp.height,
            };
          });
        vysledek.push({ strana: n, polozky });
      } catch {
        vysledek.push({ strana: n, polozky: [] });
      }
      if (indexDoc.current !== doc) return;
      if (n % 5 === 0 || n === doc.numPages) setIndexuji({ hotovo: n, celkem: doc.numPages });
    }
    setStrany(vysledek);
    setIndexuji(null);
  }, [doc, pdfjs]);

  // Pripravene strany zvlast pro presne / volne hledani - pri psani se nic
  // neprepocitava.
  const pripravene = useMemo(
    () => (strany ? strany.map((s) => pripravStranu(s, Boolean(moznosti.presne))) : null),
    [strany, moznosti.presne],
  );

  const { nalezy, vic } = useMemo(
    () => (pripravene && dotaz.trim() ? hledej(pripravene, dotaz, moznosti) : { nalezy: [] as Nalez[], vic: false }),
    [pripravene, dotaz, moznosti],
  );

  useEffect(() => setAktualni(0), [dotaz, moznosti]);

  /** Podbarvení nálezů ve stranách; aktuální výrazněji a na očích. */
  useEffect(() => {
    const obal = obalRef.current;
    if (!obal) return;
    obal.querySelectorAll<HTMLElement>('[data-hledani]').forEach((v) => v.replaceChildren());
    let cil: HTMLElement | null = null;
    nalezy.forEach((n, i) => {
      const vrstva = obal.querySelector<HTMLElement>(`[data-strana="${n.strana}"] [data-hledani]`);
      if (!vrstva) return;
      const jeTen = i === aktualni;
      n.ramecky.forEach(([x, y, w, h], k) => {
        const el = document.createElement('div');
        el.style.cssText =
          `position:absolute;left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%;border-radius:2px;` +
          (jeTen
            ? 'background:rgba(255,140,0,0.55);outline:2px solid rgba(224,100,0,0.95);'
            : 'background:rgba(123,85,255,0.28);');
        vrstva.appendChild(el);
        if (jeTen && k === 0) cil = el;
      });
    });
    if (cil) (cil as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [nalezy, aktualni, obalRef]);

  // Ctrl/Cmd+F v AudioTaggeru hleda v textu knihy, ne v okne prohlizece.
  useEffect(() => {
    function stisk(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && doc) {
        e.preventDefault();
        policko.current?.focus();
        policko.current?.select();
      }
    }
    window.addEventListener('keydown', stisk);
    return () => window.removeEventListener('keydown', stisk);
  }, [doc]);

  function posun(o: number) {
    if (nalezy.length === 0) return;
    setAktualni((a) => (a + o + nalezy.length) % nalezy.length);
  }

  function prepni(k: keyof MoznostiHledani) {
    setMoznosti((m) => ({ ...m, [k]: !m[k] }));
  }

  if (!doc) return null;

  const pocet = indexuji
    ? `${Math.round((indexuji.hotovo / Math.max(1, indexuji.celkem)) * 100)} %`
    : dotaz.trim() && strany
      ? nalezy.length === 0
        ? 'nic'
        : `${aktualni + 1} / ${nalezy.length}${vic ? '+' : ''}`
      : '';

  return (
    <span className="relative flex items-center gap-1">
      <span className="flex items-center rounded-lg border border-line bg-field focus-within:border-brand-purple">
        <span className="pl-2 text-muted text-xs" aria-hidden="true">
          🔍
        </span>
        <input
          ref={policko}
          type="search"
          value={dotaz}
          placeholder="Hledat v textu (Ctrl+F)"
          aria-label="Hledat v textu"
          onFocus={() => void indexuj()}
          onChange={(e) => {
            setDotaz(e.target.value);
            void indexuj();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              posun(e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDotaz('');
              setSeznam(false);
              e.currentTarget.blur();
            }
          }}
          className="w-44 bg-transparent px-2 py-1 text-sm font-body text-ink outline-none"
        />
        {pocet && (
          <span
            className={`pr-2 text-[11px] font-heading tabular-nums whitespace-nowrap ${
              pocet === 'nic' ? 'text-danger' : 'text-muted'
            }`}
            title={indexuji ? 'Připravuji text celé knihy pro hledání…' : undefined}
          >
            {pocet}
          </span>
        )}
      </span>
      <button type="button" onClick={() => posun(-1)} disabled={nalezy.length === 0} title="Předchozí (Shift+Enter)" className="text-muted hover:text-brand-purple px-1 disabled:opacity-30">
        ▲
      </button>
      <button type="button" onClick={() => posun(1)} disabled={nalezy.length === 0} title="Další (Enter)" className="text-muted hover:text-brand-purple px-1 disabled:opacity-30">
        ▼
      </button>
      <button
        type="button"
        onClick={() => setSeznam((v) => !v)}
        disabled={nalezy.length === 0}
        title="Seznam všech nálezů"
        className={`text-xs font-heading rounded-md px-1.5 py-0.5 disabled:opacity-30 ${seznam ? 'bg-tint text-brand-purple' : 'text-muted hover:text-brand-purple'}`}
      >
        ☰
      </button>
      <button
        type="button"
        onClick={() => setNastaveni((v) => !v)}
        title="Jak hledat"
        className={`text-xs font-heading rounded-md px-1.5 py-0.5 ${
          nastaveni || moznosti.celaSlova || moznosti.presne || moznosti.pribizne
            ? 'bg-tint text-brand-purple'
            : 'text-muted hover:text-brand-purple'
        }`}
      >
        Aa
      </button>

      {nastaveni && (
        <div className="absolute left-0 top-full mt-2 z-[60] w-[290px] bg-surface rounded-card border border-line shadow-xl p-3 flex flex-col gap-2 text-left">
          {(
            [
              ['celaSlova', 'Jen celá slova', '„les" nenajde „lesník"'],
              ['pribizne', 'Přibližně', 'najde i překlep a jiný tvar: „Novak" → „Nováka"'],
              ['presne', 'Přesně', 'rozlišuje diakritiku a velká písmena'],
            ] as [keyof MoznostiHledani, string, string][]
          ).map(([k, nazev, popis]) => (
            <label key={k} className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={Boolean(moznosti[k])} onChange={() => prepni(k)} className="mt-0.5 accent-brand-purple" />
              <span className="flex flex-col">
                <span className="text-sm font-body text-ink">{nazev}</span>
                <span className="text-[11px] font-body text-muted">{popis}</span>
              </span>
            </label>
          ))}
          <span className="text-[11px] font-body text-muted border-t border-line pt-2">
            Bez voleb se hledá bez ohledu na diakritiku a velikost písmen („prilis" najde „Příliš"), i přes
            rozdělení slova na konci řádku.
          </span>
        </div>
      )}

      {seznam && nalezy.length > 0 && (
        <div className="absolute left-0 top-full mt-2 z-[60] w-[420px] max-w-[80vw] max-h-[50vh] overflow-y-auto bg-surface rounded-card border border-line shadow-xl py-1 text-left">
          <div className="px-3 py-1.5 text-[11px] font-heading font-semibold uppercase tracking-wide text-muted flex justify-between">
            <span>
              {nalezy.length}
              {vic ? '+' : ''} nálezů
            </span>
            <button type="button" onClick={() => setSeznam(false)} className="text-muted hover:text-ink normal-case">
              ×
            </button>
          </div>
          <ul className="list-none m-0 p-0">
            {nalezy.map((n, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setAktualni(i)}
                  className={`w-full text-left px-3 py-1.5 flex gap-2 items-baseline hover:bg-field ${i === aktualni ? 'bg-tint' : ''}`}
                >
                  <span className="shrink-0 text-[11px] font-heading text-muted tabular-nums w-10">str. {n.strana}</span>
                  <span className="text-xs font-body text-ink break-words">
                    {n.pred}
                    <mark className="bg-status-progress/40 text-ink rounded px-0.5">{n.nalez}</mark>
                    {n.po}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
