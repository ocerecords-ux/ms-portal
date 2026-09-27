'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BARVY,
  FORMATY,
  PISMA,
  SABLONY,
  adresyObrazku,
  najdiFormat,
  nazevSouboru,
  noveId,
  vykresliPlatno,
  type Platno,
  type Vrstva,
} from '@/lib/socialni';
import type { ObrazekRadek, PrispevekDetail } from '@/lib/socialniServer';

/**
 * EDITOR PŘÍSPĚVKU (zadání 27. 9. 2026: „aby tam bylo něco jako Canva",
 * upřesnění: „obojí" - začne se šablonou a pak se v ní dá cokoli posunout
 * a přepsat).
 *
 * KRESLÍ SE NA <canvas>, OVLÁDÁ PŘES PRŮHLEDNÉ RÁMEČKY NAD NÍM. Plátno je
 * jedna pravda pro náhled i pro export, takže se stáhne přesně to, co je
 * vidět; rámečky nad ním jsou jen na chytání myší a nic nevykreslují.
 *
 * Vrstvy jsou v PROCENTECH plátna, takže přepnutí formátu (stories →
 * LinkedIn) nic nerozhodí - jen se to jinak protáhne.
 */

const pole =
  'rounded-lg border border-line bg-field px-2.5 py-1.5 text-ink font-heading text-sm outline-none focus:border-brand-purple';
const popisekPole = 'text-[11px] font-heading text-muted uppercase tracking-wide';

type Ukol =
  | { druh: 'posun'; id: string; zacatekX: number; zacatekY: number; puvodX: number; puvodY: number }
  | { druh: 'velikost'; id: string; zacatekX: number; zacatekY: number; puvodS: number; puvodV: number };

export function Editor({
  prispevek,
  obrazkyVychozi,
}: {
  prispevek: PrispevekDetail;
  obrazkyVychozi: ObrazekRadek[];
}) {
  const router = useRouter();
  const [nazev, setNazev] = useState(prispevek.nazev);
  const [format, setFormat] = useState(prispevek.format);
  const [platno, setPlatno] = useState<Platno>(prispevek.platno);
  const [popisek, setPopisek] = useState(prispevek.popisek);
  const [hashtagy, setHashtagy] = useState(prispevek.hashtagy);
  const [stav, setStav] = useState(prispevek.stav);
  const [vybrano, setVybrano] = useState<string | null>(null);
  const [obrazky, setObrazky] = useState<ObrazekRadek[]>(obrazkyVychozi);
  const [nacteneObrazky, setNacteneObrazky] = useState<Map<string, HTMLImageElement>>(new Map());
  const [uklada, setUklada] = useState(false);
  const [ulozeno, setUlozeno] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);
  const [oCem, setOCem] = useState('');
  const [brunoPracuje, setBrunoPracuje] = useState(false);
  const [panel, setPanel] = useState<'navrh' | 'text'>('navrh');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const plochaRef = useRef<HTMLDivElement | null>(null);
  const ukolRef = useRef<Ukol | null>(null);

  const f = najdiFormat(format);
  const vrstva = platno.vrstvy.find((v) => v.id === vybrano) ?? null;

  const zmenPlatno = useCallback((zmena: (p: Platno) => Platno) => {
    setPlatno((p) => zmena(p));
    setUlozeno(false);
  }, []);

  const zmenVrstvu = useCallback(
    (id: string, zmena: Partial<Vrstva>) => {
      zmenPlatno((p) => ({
        ...p,
        vrstvy: p.vrstvy.map((v) => (v.id === id ? ({ ...v, ...zmena } as Vrstva) : v)),
      }));
    },
    [zmenPlatno],
  );

  /* --- Obrázky: načtou se jednou a drží se v paměti ---------------------- */
  useEffect(() => {
    const potreba = adresyObrazku(platno);
    const chybi = potreba.filter((src) => !nacteneObrazky.has(src));
    if (chybi.length === 0) return;
    let zivy = true;
    void Promise.all(
      chybi.map(
        (src) =>
          new Promise<[string, HTMLImageElement] | null>((hotovo) => {
            const img = new Image();
            img.onload = () => hotovo([src, img]);
            img.onerror = () => hotovo(null);
            img.src = src;
          }),
      ),
    ).then((nove) => {
      if (!zivy) return;
      setNacteneObrazky((stare) => {
        const mapa = new Map(stare);
        for (const n of nove) if (n) mapa.set(n[0], n[1]);
        return mapa;
      });
    });
    return () => {
      zivy = false;
    };
  }, [platno, nacteneObrazky]);

  /* --- Kreslení --------------------------------------------------------- */
  const prekresli = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = f.sirka;
    canvas.height = f.vyska;
    vykresliPlatno(ctx, platno, f.sirka, f.vyska, nacteneObrazky as Map<string, CanvasImageSource>);
  }, [platno, f.sirka, f.vyska, nacteneObrazky]);

  useEffect(() => {
    prekresli();
    // Písma se načítají až po startu stránky - po jejich načtení se překreslí,
    // jinak by první náhled byl v Arialu.
    if (typeof document !== 'undefined' && document.fonts) {
      void document.fonts.ready.then(() => prekresli());
    }
  }, [prekresli]);

  /* --- Tahání a zvětšování ---------------------------------------------- */
  function zacniPosun(e: React.PointerEvent, v: Vrstva) {
    if (v.zamceno) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setVybrano(v.id);
    ukolRef.current = {
      druh: 'posun',
      id: v.id,
      zacatekX: e.clientX,
      zacatekY: e.clientY,
      puvodX: v.x,
      puvodY: v.y,
    };
  }

  function zacniVelikost(e: React.PointerEvent, v: Vrstva) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setVybrano(v.id);
    ukolRef.current = {
      druh: 'velikost',
      id: v.id,
      zacatekX: e.clientX,
      zacatekY: e.clientY,
      puvodS: v.sirka,
      puvodV: v.vyska,
    };
  }

  function tahni(e: React.PointerEvent) {
    const ukol = ukolRef.current;
    const plocha = plochaRef.current;
    if (!ukol || !plocha) return;
    const r = plocha.getBoundingClientRect();
    const dx = ((e.clientX - ukol.zacatekX) / r.width) * 100;
    const dy = ((e.clientY - ukol.zacatekY) / r.height) * 100;
    if (ukol.druh === 'posun') {
      zmenVrstvu(ukol.id, {
        x: Math.round((ukol.puvodX + dx) * 10) / 10,
        y: Math.round((ukol.puvodY + dy) * 10) / 10,
      } as Partial<Vrstva>);
    } else {
      zmenVrstvu(ukol.id, {
        sirka: Math.max(2, Math.round((ukol.puvodS + dx) * 10) / 10),
        vyska: Math.max(1, Math.round((ukol.puvodV + dy) * 10) / 10),
      } as Partial<Vrstva>);
    }
  }

  function pustTah() {
    ukolRef.current = null;
  }

  /* --- Přidávání vrstev -------------------------------------------------- */
  function pridejText() {
    const nova: Vrstva = {
      id: noveId(),
      druh: 'text',
      x: 10,
      y: 42,
      sirka: 80,
      vyska: 16,
      text: 'Nový text',
      velikost: 5,
      pismo: 'display',
      tucne: true,
      barva: BARVY.bila,
      zarovnani: 'left',
      radkovani: 1.2,
    };
    zmenPlatno((p) => ({ ...p, vrstvy: [...p.vrstvy, nova] }));
    setVybrano(nova.id);
  }

  function pridejTvar() {
    const nova: Vrstva = {
      id: noveId(),
      druh: 'tvar',
      x: 20,
      y: 40,
      sirka: 60,
      vyska: 20,
      barva: BARVY.zelena,
      radius: 2,
    };
    zmenPlatno((p) => ({ ...p, vrstvy: [...p.vrstvy, nova] }));
    setVybrano(nova.id);
  }

  function pridejObrazek(id: string) {
    const nova: Vrstva = {
      id: noveId(),
      druh: 'obrazek',
      x: 10,
      y: 20,
      sirka: 80,
      vyska: 40,
      src: `/api/site/obrazek/${id}`,
      vyplneni: 'cover',
      radius: 2,
    };
    zmenPlatno((p) => ({ ...p, vrstvy: [...p.vrstvy, nova] }));
    setVybrano(nova.id);
  }

  function smazVrstvu(id: string) {
    zmenPlatno((p) => ({ ...p, vrstvy: p.vrstvy.filter((v) => v.id !== id) }));
    setVybrano(null);
  }

  function posunVrstvu(id: string, smer: -1 | 1) {
    zmenPlatno((p) => {
      const i = p.vrstvy.findIndex((v) => v.id === id);
      const j = i + smer;
      if (i < 0 || j < 0 || j >= p.vrstvy.length) return p;
      const vrstvy = [...p.vrstvy];
      [vrstvy[i], vrstvy[j]] = [vrstvy[j], vrstvy[i]];
      return { ...p, vrstvy };
    });
  }

  /* --- Obrázky: nahrání -------------------------------------------------- */
  async function nahrajObrazek(soubor: File, kamPozadi = false) {
    setChyba(null);
    try {
      // Zmenšení v prohlížeči - do plátna stačí 1600 px a nahrávání je hned.
      const zmenseny = await zmensi(soubor, 1600);
      const data = new FormData();
      data.append('soubor', zmenseny.soubor);
      data.append('sirka', String(zmenseny.sirka));
      data.append('vyska', String(zmenseny.vyska));
      const res = await fetch('/api/site/obrazky', { method: 'POST', body: data });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || 'Obrázek se nepodařilo nahrát.');
      const novy = telo.obrazek as ObrazekRadek;
      setObrazky((p) => [novy, ...p]);
      if (kamPozadi) {
        zmenPlatno((p) => ({
          ...p,
          pozadi: { druh: 'obrazek', src: `/api/site/obrazek/${novy.id}`, ztmaveni: 0.25 },
        }));
      } else {
        pridejObrazek(novy.id);
      }
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Obrázek se nepodařilo nahrát.');
    }
  }

  /* --- Ukládání a export ------------------------------------------------- */
  const uloz = useCallback(
    async (dalsi?: { stav?: string }) => {
      setUklada(true);
      setChyba(null);
      try {
        const res = await fetch(`/api/site/prispevky/${prispevek.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nazev, format, platno, popisek, hashtagy, ...dalsi }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(telo.error || 'Uložení se nepovedlo.');
        setUlozeno(true);
        router.refresh();
      } catch (err) {
        setChyba(err instanceof Error ? err.message : 'Uložení se nepovedlo.');
      } finally {
        setUklada(false);
      }
    },
    [prispevek.id, nazev, format, platno, popisek, hashtagy, router],
  );

  function stahni() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const odkaz = document.createElement('a');
      odkaz.href = canvas.toDataURL('image/png');
      odkaz.download = nazevSouboru(nazev, format);
      odkaz.click();
    } catch {
      setChyba('Obrázek se nepodařilo vyexportovat.');
    }
  }

  async function zeptejSeBruna() {
    if (oCem.trim().length < 3) {
      setChyba('Napište aspoň větu o tom, o čem příspěvek je.');
      return;
    }
    setBrunoPracuje(true);
    setChyba(null);
    try {
      const textyNaPlatne = platno.vrstvy
        .filter((v): v is Extract<Vrstva, { druh: 'text' }> => v.druh === 'text')
        .map((v) => v.text)
        .join('\n');
      const res = await fetch('/api/site/popisek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sit: f.sit, oCem, textyNaPlatne }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || 'Bruno teď neodpovídá.');
      setPopisek(telo.popisek || '');
      setHashtagy(telo.hashtagy || '');
      setUlozeno(false);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Bruno teď neodpovídá.');
    } finally {
      setBrunoPracuje(false);
    }
  }

  async function smazPrispevek() {
    if (!window.confirm('Smazat celý příspěvek?')) return;
    const res = await fetch(`/api/site/prispevky/${prispevek.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/site');
  }

  // Escape zruší výběr, Delete smaže vybranou vrstvu (mimo psaní do políčka).
  useEffect(() => {
    const klavesa = (e: KeyboardEvent) => {
      const cil = e.target as HTMLElement | null;
      if (cil && /^(INPUT|TEXTAREA|SELECT)$/.test(cil.tagName)) return;
      if (e.key === 'Escape') setVybrano(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && vybrano) {
        e.preventDefault();
        smazVrstvu(vybrano);
      }
    };
    window.addEventListener('keydown', klavesa);
    return () => window.removeEventListener('keydown', klavesa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vybrano]);

  const pomerPlatna = useMemo(() => `${f.sirka} / ${f.vyska}`, [f.sirka, f.vyska]);

  /**
   * PLÁTNO SE VŽDY VEJDE CELÉ NA OBRAZOVKU (stejné pravidlo jako u náhledů
   * dokumentů: „nemůže tam být nikdy ten posuvník"). Poměr stran se mění
   * s formátem - 9:16 je vysoké, LinkedIn na šířku je nízké - takže velikost
   * počítáme z volné šířky sloupce i z výšky okna a bereme menší z obojího.
   */
  const ramecRef = useRef<HTMLDivElement | null>(null);
  const [rozmer, setRozmer] = useState<{ sirka: number; vyska: number } | null>(null);

  useEffect(() => {
    const spocti = () => {
      const ramec = ramecRef.current;
      if (!ramec) return;
      const pomer = f.sirka / f.vyska;
      const volnaVyska = Math.max(280, window.innerHeight - 250);
      let sirka = Math.min(ramec.clientWidth, 520);
      let vyska = sirka / pomer;
      if (vyska > volnaVyska) {
        vyska = volnaVyska;
        sirka = vyska * pomer;
      }
      setRozmer({ sirka: Math.round(sirka), vyska: Math.round(vyska) });
    };
    spocti();
    window.addEventListener('resize', spocti);
    const sledovac = new ResizeObserver(spocti);
    if (ramecRef.current) sledovac.observe(ramecRef.current);
    return () => {
      window.removeEventListener('resize', spocti);
      sledovac.disconnect();
    };
  }, [f.sirka, f.vyska]);

  return (
    <div className="flex flex-col gap-4">
      {/* Hlavička */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/site" className="text-sm font-heading text-muted no-underline hover:text-brand-purple">
          ← Sítě
        </Link>
        <input
          value={nazev}
          onChange={(e) => {
            setNazev(e.target.value);
            setUlozeno(false);
          }}
          aria-label="Název příspěvku"
          className="flex-1 min-w-[160px] max-w-[320px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-ink font-display text-xl outline-none hover:border-line focus:border-brand-purple focus:bg-field"
        />
        <span className="text-xs font-body text-muted">
          {ulozeno ? 'Uloženo' : 'Neuložené změny'}
        </span>
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={uklada}
          className="ml-auto rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
        >
          {uklada ? 'Ukládám…' : 'Uložit'}
        </button>
        <button
          type="button"
          onClick={stahni}
          className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-1.5 hover:bg-brand-purpleDeep transition-colors cursor-pointer"
        >
          Stáhnout PNG
        </button>
      </div>

      {chyba && (
        <p className="text-sm font-body text-status-error m-0" role="alert">
          {chyba}
        </p>
      )}

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-5 items-start">
        {/* PLÁTNO */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={pridejText} className={`${pole} cursor-pointer hover:border-brand-purple`}>
              + Text
            </button>
            <button type="button" onClick={pridejTvar} className={`${pole} cursor-pointer hover:border-brand-purple`}>
              + Tvar
            </button>
            <label className={`${pole} cursor-pointer hover:border-brand-purple`}>
              + Obrázek
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const s = e.target.files?.[0];
                  if (s) void nahrajObrazek(s);
                  e.target.value = '';
                }}
              />
            </label>
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setUlozeno(false);
              }}
              className={pole}
              aria-label="Formát"
            >
              {FORMATY.map((x) => (
                <option key={x.klic} value={x.klic}>
                  {x.sit === 'INSTAGRAM' ? 'IG' : 'LI'} · {x.nazev} ({x.sirka}×{x.vyska})
                </option>
              ))}
            </select>
          </div>

          <div ref={ramecRef} className="w-full flex justify-center">
          <div
            className="relative rounded-card overflow-hidden border border-line bg-field"
            style={
              rozmer
                ? { width: `${rozmer.sirka}px`, height: `${rozmer.vyska}px` }
                : { width: '100%', maxWidth: '520px', aspectRatio: pomerPlatna }
            }
            ref={plochaRef}
            onPointerMove={tahni}
            onPointerUp={pustTah}
            onPointerCancel={pustTah}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setVybrano(null);
            }}
          >
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            {platno.vrstvy.map((v) => (
              <div
                key={v.id}
                onPointerDown={(e) => zacniPosun(e, v)}
                style={{
                  position: 'absolute',
                  left: `${v.x}%`,
                  top: `${v.y}%`,
                  width: `${v.sirka}%`,
                  height: `${v.vyska}%`,
                  cursor: v.zamceno ? 'default' : 'move',
                }}
                className={`${
                  vybrano === v.id ? 'outline outline-2 outline-brand-purple' : 'outline outline-1 outline-transparent hover:outline-brand-purple/40'
                }`}
              >
                {vybrano === v.id && !v.zamceno && (
                  <span
                    onPointerDown={(e) => zacniVelikost(e, v)}
                    title="Změnit velikost"
                    className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-sm bg-brand-purple border-2 border-white cursor-nwse-resize"
                  />
                )}
              </div>
            ))}
          </div>
          </div>

          <span className="text-xs font-body text-muted text-center">
            Táhněte myší, rohem měníte velikost. Klávesa Delete smaže vybranou vrstvu, Escape zruší výběr.
          </span>
        </div>

        {/* PANEL */}
        <div className="flex flex-col gap-3 min-w-0 min-[1100px]:sticky min-[1100px]:top-4">
          <div className="flex gap-2">
            {(['navrh', 'text'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPanel(k)}
                aria-pressed={panel === k}
                className={`flex-1 rounded-pill border px-3 py-1.5 text-sm font-heading transition-colors ${
                  panel === k ? 'border-brand-purple bg-brand-purple/10 text-ink' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {k === 'navrh' ? 'Návrh' : 'Popisek'}
              </button>
            ))}
          </div>

          {panel === 'navrh' ? (
            <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-4">
              {/* Vlastnosti vybrané vrstvy */}
              {vrstva ? (
                <VlastnostiVrstvy
                  vrstva={vrstva}
                  onZmena={(z) => zmenVrstvu(vrstva.id, z)}
                  onSmaz={() => smazVrstvu(vrstva.id)}
                  onPosun={(s) => posunVrstvu(vrstva.id, s)}
                  obrazky={obrazky}
                />
              ) : (
                <Pozadi
                  platno={platno}
                  onZmena={(pozadi) => zmenPlatno((p) => ({ ...p, pozadi }))}
                  onObrazek={(s) => void nahrajObrazek(s, true)}
                />
              )}

              {/* Vrstvy */}
              <div className="flex flex-col gap-1.5">
                <span className={popisekPole}>Vrstvy (odspodu nahoru)</span>
                {platno.vrstvy.length === 0 && (
                  <span className="text-sm font-body text-muted">Zatím žádná — přidejte text nebo obrázek.</span>
                )}
                <ul className="list-none p-0 m-0 flex flex-col gap-1">
                  {[...platno.vrstvy].reverse().map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setVybrano(v.id === vybrano ? null : v.id)}
                        className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-sm font-heading truncate transition-colors ${
                          vybrano === v.id
                            ? 'border-brand-purple bg-brand-purple/10 text-ink'
                            : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        {v.druh === 'text' ? v.text.split('\n')[0] || 'Text' : v.druh === 'obrazek' ? 'Obrázek' : 'Tvar'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Šablony */}
              <div className="flex flex-col gap-1.5">
                <span className={popisekPole}>Začít znovu ze šablony</span>
                <div className="flex flex-wrap gap-1.5">
                  {SABLONY.filter((s) => !s.formaty || s.formaty.includes(format)).map((s) => (
                    <button
                      key={s.klic}
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Nahradit současný návrh šablonou „${s.nazev}"?`)) return;
                        setPlatno(s.platno());
                        setVybrano(null);
                        setUlozeno(false);
                      }}
                      title={s.popis}
                      className="rounded-pill border border-line text-muted px-2.5 py-1 text-xs font-heading hover:text-brand-purple hover:border-brand-purple transition-colors"
                    >
                      {s.nazev}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void smazPrispevek()}
                className="self-start text-xs font-heading text-muted hover:text-danger transition-colors bg-transparent border-0 cursor-pointer p-0"
              >
                Smazat příspěvek
              </button>
            </div>
          ) : (
            <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className={popisekPole}>O čem příspěvek je</span>
                <textarea
                  value={oCem}
                  onChange={(e) => setOCem(e.target.value)}
                  rows={3}
                  placeholder="Natočili jsme spot pro Strabag, mluví v něm patnáct herců…"
                  className={`${pole} font-body resize-y`}
                />
              </label>
              <button
                type="button"
                onClick={() => void zeptejSeBruna()}
                disabled={brunoPracuje}
                className="self-start rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
              >
                {brunoPracuje ? 'Bruno píše…' : 'Nechat napsat Brunem'}
              </button>

              <label className="flex flex-col gap-1">
                <span className={popisekPole}>Popisek</span>
                <textarea
                  value={popisek}
                  onChange={(e) => {
                    setPopisek(e.target.value);
                    setUlozeno(false);
                  }}
                  rows={8}
                  className={`${pole} font-body resize-y`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={popisekPole}>Hashtagy</span>
                <textarea
                  value={hashtagy}
                  onChange={(e) => {
                    setHashtagy(e.target.value);
                    setUlozeno(false);
                  }}
                  rows={3}
                  className={`${pole} font-body resize-y`}
                />
              </label>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText([popisek, hashtagy].filter(Boolean).join('\n\n'))}
                className="self-start text-xs font-heading text-brand-purple bg-transparent border-0 cursor-pointer p-0 hover:underline"
              >
                Zkopírovat popisek i s hashtagy
              </button>

              <label className="flex flex-col gap-1 pt-2 border-t border-line">
                <span className={popisekPole}>Stav</span>
                <select
                  value={stav}
                  onChange={(e) => {
                    setStav(e.target.value);
                    void uloz({ stav: e.target.value });
                  }}
                  className={pole}
                >
                  <option value="KONCEPT">Rozpracováno</option>
                  <option value="HOTOVO">Hotovo</option>
                  <option value="PUBLIKOVANO">Publikováno</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function VlastnostiVrstvy({
  vrstva,
  onZmena,
  onSmaz,
  onPosun,
  obrazky,
}: {
  vrstva: Vrstva;
  onZmena: (z: Partial<Vrstva>) => void;
  onSmaz: () => void;
  onPosun: (smer: -1 | 1) => void;
  obrazky: ObrazekRadek[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={popisekPole}>
          {vrstva.druh === 'text' ? 'Text' : vrstva.druh === 'obrazek' ? 'Obrázek' : 'Tvar'}
        </span>
        <button
          type="button"
          onClick={() => onPosun(1)}
          title="Dopředu"
          className="ml-auto text-xs font-heading text-muted hover:text-brand-purple bg-transparent border-0 cursor-pointer"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onPosun(-1)}
          title="Dozadu"
          className="text-xs font-heading text-muted hover:text-brand-purple bg-transparent border-0 cursor-pointer"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onSmaz}
          title="Smazat vrstvu"
          className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer"
        >
          ×
        </button>
      </div>

      {vrstva.druh === 'text' && (
        <>
          <textarea
            value={vrstva.text}
            onChange={(e) => onZmena({ text: e.target.value } as Partial<Vrstva>)}
            rows={3}
            className={`${pole} font-body resize-y`}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className={popisekPole}>Velikost</span>
              <input
                type="number"
                step="0.2"
                value={vrstva.velikost}
                onChange={(e) => onZmena({ velikost: Number(e.target.value) || 1 } as Partial<Vrstva>)}
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={popisekPole}>Písmo</span>
              <select
                value={vrstva.pismo}
                onChange={(e) => onZmena({ pismo: e.target.value } as Partial<Vrstva>)}
                className={pole}
              >
                {PISMA.map((p) => (
                  <option key={p.klic} value={p.klic}>
                    {p.nazev}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={popisekPole}>Barva</span>
              <input
                type="color"
                value={vrstva.barva}
                onChange={(e) => onZmena({ barva: e.target.value } as Partial<Vrstva>)}
                className="h-9 w-full rounded-lg border border-line bg-field cursor-pointer"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={popisekPole}>Zarovnání</span>
              <select
                value={vrstva.zarovnani}
                onChange={(e) => onZmena({ zarovnani: e.target.value as 'left' } as Partial<Vrstva>)}
                className={pole}
              >
                <option value="left">Vlevo</option>
                <option value="center">Na střed</option>
                <option value="right">Vpravo</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-sm font-body text-ink">
              <input
                type="checkbox"
                checked={vrstva.tucne}
                onChange={(e) => onZmena({ tucne: e.target.checked } as Partial<Vrstva>)}
              />
              Tučně
            </label>
            <label className="flex items-center gap-1.5 text-sm font-body text-ink">
              <input
                type="checkbox"
                checked={Boolean(vrstva.velkaPismena)}
                onChange={(e) => onZmena({ velkaPismena: e.target.checked } as Partial<Vrstva>)}
              />
              VERZÁLKY
            </label>
          </div>
        </>
      )}

      {vrstva.druh === 'tvar' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className={popisekPole}>Barva</span>
            <input
              type="color"
              value={vrstva.barva}
              onChange={(e) => onZmena({ barva: e.target.value } as Partial<Vrstva>)}
              className="h-9 w-full rounded-lg border border-line bg-field cursor-pointer"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={popisekPole}>Zaoblení</span>
            <input
              type="number"
              step="0.5"
              value={vrstva.radius ?? 0}
              onChange={(e) => onZmena({ radius: Number(e.target.value) || 0 } as Partial<Vrstva>)}
              className={pole}
            />
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span className={popisekPole}>Průhlednost</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={vrstva.pruhlednost ?? 1}
              onChange={(e) => onZmena({ pruhlednost: Number(e.target.value) } as Partial<Vrstva>)}
            />
          </label>
        </div>
      )}

      {vrstva.druh === 'obrazek' && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={popisekPole}>Výplň rámečku</span>
            <select
              value={vrstva.vyplneni}
              onChange={(e) => onZmena({ vyplneni: e.target.value as 'cover' } as Partial<Vrstva>)}
              className={pole}
            >
              <option value="cover">Vyplnit a oříznout</option>
              <option value="contain">Vejít se celý</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={popisekPole}>Vyměnit za</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) onZmena({ src: `/api/site/obrazek/${e.target.value}` } as Partial<Vrstva>);
              }}
              className={pole}
            >
              <option value="">— vyberte z nahraných —</option>
              {obrazky.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nazev}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function Pozadi({
  platno,
  onZmena,
  onObrazek,
}: {
  platno: Platno;
  onZmena: (p: Platno['pozadi']) => void;
  onObrazek: (soubor: File) => void;
}) {
  const p = platno.pozadi;
  return (
    <div className="flex flex-col gap-3">
      <span className={popisekPole}>Pozadí (nic není vybráno)</span>
      <div className="flex gap-1.5">
        {(['barva', 'prechod', 'obrazek'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              if (d === 'barva') onZmena({ druh: 'barva', barva: BARVY.inkoust });
              else if (d === 'prechod')
                onZmena({ druh: 'prechod', od: BARVY.fialova, do: BARVY.fialovaHodneTmava, uhel: 160 });
              else onZmena({ druh: 'obrazek', src: '', ztmaveni: 0.25 });
            }}
            aria-pressed={p.druh === d}
            className={`flex-1 rounded-pill border px-2 py-1 text-xs font-heading transition-colors ${
              p.druh === d ? 'border-brand-purple bg-brand-purple/10 text-ink' : 'border-line text-muted hover:text-ink'
            }`}
          >
            {d === 'barva' ? 'Barva' : d === 'prechod' ? 'Přechod' : 'Fotka'}
          </button>
        ))}
      </div>

      {p.druh === 'barva' && (
        <input
          type="color"
          value={p.barva}
          onChange={(e) => onZmena({ druh: 'barva', barva: e.target.value })}
          className="h-9 w-full rounded-lg border border-line bg-field cursor-pointer"
        />
      )}

      {p.druh === 'prechod' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className={popisekPole}>Od</span>
            <input
              type="color"
              value={p.od}
              onChange={(e) => onZmena({ ...p, od: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-field cursor-pointer"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={popisekPole}>Do</span>
            <input
              type="color"
              value={p.do}
              onChange={(e) => onZmena({ ...p, do: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-field cursor-pointer"
            />
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span className={popisekPole}>Úhel</span>
            <input
              type="range"
              min="0"
              max="360"
              value={p.uhel}
              onChange={(e) => onZmena({ ...p, uhel: Number(e.target.value) })}
            />
          </label>
        </div>
      )}

      {p.druh === 'obrazek' && (
        <div className="flex flex-col gap-2">
          <label className={`${pole} cursor-pointer text-center hover:border-brand-purple`}>
            Nahrát fotku na pozadí
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const s = e.target.files?.[0];
                if (s) onObrazek(s);
                e.target.value = '';
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={popisekPole}>Ztmavení</span>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={p.ztmaveni ?? 0}
              onChange={(e) => onZmena({ ...p, ztmaveni: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

/** Zmenší obrázek v prohlížeči, ať se nenahrávají fotky z foťáku. */
async function zmensi(soubor: File, maxStrana: number): Promise<{ soubor: File; sirka: number; vyska: number }> {
  const bitmapa = await createImageBitmap(soubor).catch(() => null);
  if (!bitmapa) return { soubor, sirka: 0, vyska: 0 };
  const pomer = Math.min(1, maxStrana / Math.max(bitmapa.width, bitmapa.height));
  const sirka = Math.round(bitmapa.width * pomer);
  const vyska = Math.round(bitmapa.height * pomer);
  if (pomer === 1) return { soubor, sirka, vyska };

  const canvas = document.createElement('canvas');
  canvas.width = sirka;
  canvas.height = vyska;
  canvas.getContext('2d')?.drawImage(bitmapa, 0, 0, sirka, vyska);
  const blob = await new Promise<Blob | null>((hotovo) => canvas.toBlob(hotovo, 'image/jpeg', 0.9));
  if (!blob) return { soubor, sirka, vyska };
  return {
    soubor: new File([blob], soubor.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }),
    sirka,
    vyska,
  };
}
