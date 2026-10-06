'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatum, type Jazyk } from '@/lib/jazyk';
import type { PribehRadek } from '@/lib/pribehyServer';
import { MAX_POPISEK, PRIJIMANE_PRIPONY, POVOLENE_TYPY, maxProTyp, velikostVMB } from '@/lib/pribehy';
import {
  BARVY_TEXTU,
  MAX_VELIKOST,
  MIN_VELIKOST,
  PODKLADY,
  SIRKA_BLOKU,
  VYCHOZI_STYL,
  orezStyl,
  slozPribeh,
  type StylTextu,
  type ZarovnaniTextu,
} from '@/lib/pribehText';

/**
 * FRONTA PŘÍBĚHŮ (zadání 6. 10. 2026: „tohle se musí chovat jak zjednodušený
 * instagram. Font a barvy v našich brandových barvách. A hlavně musí být
 * vidět, jak to vypadá").
 *
 * PROTO SE TU NIC NEUKAZUJE V ŘÁDCÍCH. Příběh je svislý obdélník 9:16 a nic
 * jiného než ten obdélník nerozhodne, jestli je fotka dobře oříznutá. Fronta
 * je dlaždicová jako profil na Instagramu, čekající příběhy mají kolem sebe
 * firemní kroužek (fialová do zelené) a kliknutí otevře prohlížeč na celou
 * obrazovku - s pruhem nahoře, účtem a textem dole, přesně jak to uvidí lidé.
 *
 * NÁHLED JE VIDĚT UŽ PŘI NAHRÁVÁNÍ. Vybraný soubor se ukáže ve stejném rámu
 * dřív, než se odešle; kdo pošle fotku na šířku, vidí hned, že se ořízne.
 * Náhled je jen v prohlížeči (blob), nikam se neposílá.
 *
 * SOUBOR JDE DO ÚLOŽIŠTĚ ROVNOU Z PROHLÍŽEČE - nejdřív se vyžádá podepsaná
 * adresa, pak se na ni soubor pošle a teprve potom portálu řekneme „zapiš
 * příběh k tomuhle klíči". Přes portál by patnáctisekundové video neprošlo
 * (strop Vercelu 4,5 MB). Nahrává XMLHttpRequest, ne fetch - jen on umí
 * hlásit procenta, a u videa z telefonu to není kosmetika.
 */

/** Firemní kroužek kolem příběhu - stejný nápad jako nepřečtená story. */
const KROUZEK = 'bg-gradient-to-tr from-brand-green via-brand-purple to-brand-purpleDeep';
const KROUZEK_KLID = 'bg-line';

/** Prohlížeč u .mov občas typ nepozná - doplníme ho z přípony. */
function typSouboru(soubor: File): string {
  if (soubor.type && POVOLENE_TYPY.includes(soubor.type)) return soubor.type;
  const pripona = soubor.name.toLowerCase().split('.').pop() ?? '';
  if (pripona === 'mov') return 'video/quicktime';
  if (pripona === 'mp4' || pripona === 'm4v') return 'video/mp4';
  if (pripona === 'jpg' || pripona === 'jpeg') return 'image/jpeg';
  if (pripona === 'png') return 'image/png';
  if (pripona === 'webp') return 'image/webp';
  return soubor.type;
}

function nahrajDoUloziste(adresa: string, soubor: Blob, typ: string, pokrok: (p: number) => void) {
  return new Promise<void>((hotovo, chyba) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', adresa);
    xhr.setRequestHeader('Content-Type', typ);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) pokrok(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? hotovo() : chyba(new Error('upload')));
    xhr.onerror = () => chyba(new Error('upload'));
    xhr.send(soubor);
  });
}

/** Kolečko s iniciálami účtu - zastupuje profilovku, aby se nic nestahovalo. */
function Znacka({ velikost = 36 }: { velikost?: number }) {
  return (
    <span className={`shrink-0 grid place-items-center rounded-full p-[2px] ${KROUZEK}`} style={{ width: velikost, height: velikost }}>
      <span className="grid h-full w-full place-items-center rounded-full bg-bar font-heading font-semibold text-white" style={{ fontSize: velikost * 0.36 }}>
        MS
      </span>
    </span>
  );
}

/** Malé kulaté tlačítko k ovládání textu (zvětšit, zmenšit). */
function KulatyKnoflik({
  popisek,
  nazev,
  onClick,
  vypnuto,
}: {
  popisek: string;
  nazev: string;
  onClick: () => void;
  vypnuto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={vypnuto}
      aria-label={nazev}
      title={nazev}
      className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-line font-heading text-sm text-ink transition-colors hover:border-brand-purple disabled:opacity-40"
    >
      {popisek}
    </button>
  );
}

/**
 * DLAŽDICE VE FRONTĚ - svislý obdélník, jak to na Instagramu vypadá.
 *
 * Schválně MIMO hlavní komponentu: kdyby byla uvnitř, React by ji při každém
 * překreslení považoval za nový typ a obrázky i videa by se při každém písmenu
 * v popisku načítaly znovu.
 */
function Dlazdice({
  p,
  t,
  jazyk,
  otevri,
}: {
  p: PribehRadek;
  t: (klic: string, hodnoty?: Record<string, string | number>) => string;
  jazyk: Jazyk;
  otevri: (id: string) => void;
}) {
    const ceka = p.stav === 'CEKA';
    return (
      <button
        type="button"
        onClick={() => otevri(p.id)}
        className="block w-full text-left cursor-pointer"
        aria-label={p.autor}
      >
        <span className={`block rounded-[22px] p-[2px] transition-transform hover:scale-[1.02] ${ceka ? KROUZEK : KROUZEK_KLID}`}>
          <span className="relative block aspect-[9/16] overflow-hidden rounded-[20px] bg-bar">
            {p.jeVideo ? (
              <video
                src={`/api/site/pribehy/${p.id}/soubor`}
                preload="metadata"
                muted
                playsInline
                className="pointer-events-none h-full w-full object-cover"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`/api/site/pribehy/${p.id}/soubor`}
                alt=""
                className="pointer-events-none h-full w-full object-cover"
              />
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
              <span className="block truncate font-heading text-[11px] font-semibold text-white">{p.autor}</span>
              <span className="block truncate font-body text-[10px] text-white/70">
                {formatDatum(jazyk, new Date(p.createdAt))}
              </span>
            </span>
            {!ceka && (
              <span className="absolute left-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 font-heading text-[10px] text-white backdrop-blur-sm">
                {t(`pribehy.stav.${p.stav}`)}
              </span>
            )}
            {p.jeVideo && (
              <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-[10px] text-white backdrop-blur-sm">
                ▶
              </span>
            )}
          </span>
        </span>
      </button>
    );
}

export function FrontaPribehu({
  pribehy,
  smiPoslat,
  smiSchvalit,
  presApi,
  ucet,
  jaId,
}: {
  pribehy: PribehRadek[];
  smiPoslat: boolean;
  smiSchvalit: boolean;
  /** Je Instagram připojený? Pak portál vyvěšuje sám, jinak zbývá ruční cesta. */
  presApi: boolean;
  /** Jméno účtu, na který to půjde - do náhledu, ať je vidět čí to bude. */
  ucet: string | null;
  jaId: string;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();

  const vstupSouboru = useRef<HTMLInputElement | null>(null);
  const [soubor, setSoubor] = useState<File | null>(null);
  const [nahled, setNahled] = useState<string | null>(null);
  const [popisek, setPopisek] = useState('');
  const [styl, setStyl] = useState<StylTextu>(VYCHOZI_STYL);
  const ramRef = useRef<HTMLSpanElement | null>(null);
  const [ramVyska, setRamVyska] = useState(0);
  const taham = useRef(false);
  const [procenta, setProcenta] = useState<number | null>(null);
  const [odesilam, setOdesilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState<string | null>(null);
  const [otevreny, setOtevreny] = useState<string | null>(null);
  const [zamitam, setZamitam] = useState(false);
  const [vzkaz, setVzkaz] = useState('');
  const [pracuji, setPracuji] = useState<string | null>(null);

  // Nahled zije jen v prohlizeci; po vymene souboru se adresa musi uvolnit.
  useEffect(() => {
    if (!soubor) {
      setNahled(null);
      return;
    }
    const adresa = URL.createObjectURL(soubor);
    setNahled(adresa);
    return () => URL.revokeObjectURL(adresa);
  }, [soubor]);

  /**
   * Výška rámu v bodech. Velikost písma je v PROCENTECH výšky, aby náhled
   * i hotový příběh (1080×1920) vypadaly stejně - v CSS se procenta z výšky
   * u písma zadat nedají, takže se to musí přepočítat.
   */
  useEffect(() => {
    const prvek = ramRef.current;
    if (!prvek || typeof ResizeObserver === 'undefined') return;
    const hlidac = new ResizeObserver(() => setRamVyska(prvek.clientHeight));
    hlidac.observe(prvek);
    setRamVyska(prvek.clientHeight);
    return () => hlidac.disconnect();
  }, [nahled]);

  // Escape zavira prohlizec pribehu - jako na Instagramu.
  useEffect(() => {
    if (!otevreny) return;
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtevreny(null);
    };
    window.addEventListener('keydown', naKlavesu);
    return () => window.removeEventListener('keydown', naKlavesu);
  }, [otevreny]);

  function vyber(e: React.ChangeEvent<HTMLInputElement>) {
    const vybrany = e.target.files?.[0] ?? null;
    setChyba(null);
    if (!vybrany) {
      setSoubor(null);
      return;
    }
    const typ = typSouboru(vybrany);
    if (!POVOLENE_TYPY.includes(typ)) {
      setSoubor(null);
      setChyba(t('pribehy.spatnyTyp'));
      return;
    }
    if (vybrany.size > maxProTyp(typ)) {
      setSoubor(null);
      setChyba(t('pribehy.mocVelky', { kolik: velikostVMB(maxProTyp(typ)) }));
      return;
    }
    setSoubor(vybrany);
  }

  /** Táhnutí textu po příběhu. Procenta, ne body - viz lib/pribehText.ts. */
  function chytText(e: React.PointerEvent<HTMLDivElement>) {
    const ram = ramRef.current;
    if (!ram) return;
    taham.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function tahniText(e: React.PointerEvent<HTMLDivElement>) {
    const ram = ramRef.current;
    if (!taham.current || !ram) return;
    const r = ram.getBoundingClientRect();
    setStyl((st) =>
      orezStyl({
        ...st,
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      }),
    );
  }

  function pustText(e: React.PointerEvent<HTMLDivElement>) {
    taham.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  async function odesli() {
    if (!soubor) return;
    let data: Blob = soubor;
    let typ = typSouboru(soubor);
    let nazev = soubor.name;
    setOdesilam(true);
    setChyba(null);
    setProcenta(0);
    try {
      /**
       * FOTKA SE SKLÁDÁ UŽ TADY: ořízne se na 9:16 a vypálí se do ní text.
       * Instagram popisek u příběhů přes API nebere, takže co není v obrázku,
       * nikdo neuvidí. U videa to nejde - text zůstane jen vzkazem.
       */
      if (!typ.startsWith('video/')) {
        data = await slozPribeh(soubor, popisek, styl);
        typ = 'image/jpeg';
        nazev = `${soubor.name.replace(/\.[^.]+$/, '')}.jpg`;
      }

      const podpisRes = await fetch('/api/site/pribehy/podpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev, typ, velikost: data.size }),
      });
      const podpis = await podpisRes.json().catch(() => ({}));
      if (!podpisRes.ok) throw new Error(podpis.error || t('pribehy.neodeslano'));

      await nahrajDoUloziste(podpis.uploadUrl, data, typ, setProcenta);
      setProcenta(null);

      const res = await fetch('/api/site/pribehy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klic: podpis.key, nazevSouboru: nazev, popisek }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || t('pribehy.neodeslano'));

      setSoubor(null);
      setPopisek('');
      setStyl(VYCHOZI_STYL);
      if (vstupSouboru.current) vstupSouboru.current.value = '';
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error && err.message !== 'upload' ? err.message : t('pribehy.neodeslano'));
    } finally {
      setOdesilam(false);
      setProcenta(null);
    }
  }

  async function vyrid(id: string, stav: 'VYVESENO' | 'ZAMITNUTO', text?: string, pres?: 'API') {
    setPracuji(id);
    setChyba(null);
    try {
      const res = await fetch(`/api/site/pribehy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav, vzkaz: text ?? undefined, pres }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || t('pribehy.nevyrizeno'));
      setZamitam(false);
      setVzkaz('');
      setOtevreny(null);
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('pribehy.nevyrizeno'));
    } finally {
      setPracuji(null);
    }
  }

  async function stahniZFronty(id: string) {
    setPracuji(id);
    try {
      const res = await fetch(`/api/site/pribehy/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const telo = await res.json().catch(() => ({}));
        throw new Error(telo.error || t('pribehy.nevyrizeno'));
      }
      setOtevreny(null);
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('pribehy.nevyrizeno'));
    } finally {
      setPracuji(null);
    }
  }

  async function zkopiruj(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setZkopirovano(id);
      setTimeout(() => setZkopirovano(null), 2000);
    } catch {
      setChyba(t('pribehy.nezkopirovano'));
    }
  }

  const jeVideoNahled = soubor !== null && typSouboru(soubor).startsWith('video/');

  function otevri(id: string) {
    setOtevreny(id);
    setZamitam(false);
    setVzkaz('');
    setChyba(null);
  }

  const cekaji = pribehy.filter((p) => p.stav === 'CEKA');
  const vyrizene = pribehy.filter((p) => p.stav !== 'CEKA');
  const vybrany = pribehy.find((p) => p.id === otevreny) ?? null;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center gap-3">
        <Znacka velikost={46} />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 font-display text-3xl text-ink">{t('pribehy.nadpis')}</h1>
          <span className="font-body text-sm text-muted">
            {ucet ? `@${ucet}` : t('pribehy.bezUctu')}
          </span>
        </div>
      </div>

      <p className="m-0 max-w-[68ch] font-body text-sm text-muted">
        {t(smiSchvalit ? 'pribehy.podnadpisSchvalovatel' : 'pribehy.podnadpis')}
      </p>

      {smiPoslat && (
        <div className="grid gap-5 rounded-card border border-line bg-surface p-5 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            <label
              htmlFor="pribeh-soubor"
              /* S náhledem se do rámu klikat nedá - jinak by každé tažení textem otevřelo výběr souboru. */
              onClick={(e) => {
                if (nahled) e.preventDefault();
              }}
              className={`block rounded-[26px] p-[2px] ${nahled ? KROUZEK : KROUZEK_KLID} ${nahled ? '' : 'cursor-pointer'}`}
            >
              <span
                ref={ramRef}
                className="relative block aspect-[9/16] w-[250px] overflow-hidden rounded-[24px] bg-field sm:w-[290px]"
              >
                {nahled ? (
                  <>
                    {jeVideoNahled ? (
                      <video src={nahled} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={nahled} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="pointer-events-none absolute inset-x-4 top-4 flex flex-col gap-2">
                      <span className="h-[3px] rounded-pill bg-white/90" />
                      <span className="flex items-center gap-2">
                        <Znacka velikost={22} />
                        <span className="truncate font-heading text-[11px] text-white drop-shadow">
                          {ucet ? `@${ucet}` : t('pribehy.nadpis')}
                        </span>
                      </span>
                    </span>

                    {/* TEXT NA PŘÍBĚHU - táhne se myší i prstem. */}
                    {popisek.trim() && !jeVideoNahled && (
                      <div
                        onPointerDown={chytText}
                        onPointerMove={tahniText}
                        onPointerUp={pustText}
                        onPointerCancel={pustText}
                        onClick={(e) => e.preventDefault()}
                        role="presentation"
                        className="absolute cursor-grab touch-none select-none font-heading font-semibold leading-tight active:cursor-grabbing"
                        style={{
                          left: `${styl.x}%`,
                          top: `${styl.y}%`,
                          width: `${SIRKA_BLOKU}%`,
                          transform: 'translate(-50%, -50%)',
                          fontSize: ramVyska ? (ramVyska * styl.velikost) / 100 : 14,
                          textAlign: styl.zarovnani,
                          color: styl.barva,
                        }}
                      >
                        <span
                          className="whitespace-pre-wrap"
                          style={{
                            background: PODKLADY[styl.podklad] ?? 'transparent',
                            padding: '0.12em 0.3em',
                            borderRadius: '0.22em',
                            boxDecorationBreak: 'clone',
                            WebkitBoxDecorationBreak: 'clone',
                          }}
                        >
                          {popisek}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-center">
                    <span className="flex flex-col items-center gap-2 px-4">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-purple font-display text-3xl leading-none text-white">
                        +
                      </span>
                      <span className="font-heading text-xs text-muted">{t('pribehy.vybratSoubor')}</span>
                    </span>
                  </span>
                )}
              </span>
            </label>
            <input
              id="pribeh-soubor"
              ref={vstupSouboru}
              type="file"
              accept={PRIJIMANE_PRIPONY}
              onChange={vyber}
              className="sr-only"
            />
            <span className="text-center font-body text-[11px] text-muted">
              {t(nahled ? (jeVideoNahled ? 'pribehy.uVideaBezTextu' : 'pribehy.tahniText') : 'pribehy.devetNaSestnact')}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <label className="font-heading text-sm font-semibold text-ink" htmlFor="pribeh-popisek">
              {t('pribehy.popisek')}
            </label>
            <textarea
              id="pribeh-popisek"
              value={popisek}
              onChange={(e) => setPopisek(e.target.value.slice(0, MAX_POPISEK))}
              rows={3}
              placeholder={t('pribehy.popisekPlaceholder')}
              className="w-full rounded-card border border-line bg-field/40 px-3 py-2 font-body text-sm text-ink outline-none focus:border-brand-purple"
            />

            {/* OVLÁDÁNÍ TEXTU - jen u fotky, do videa text vypálit nejde. */}
            {popisek.trim() && !jeVideoNahled && (
              <div className="flex flex-col gap-3 rounded-card border border-line bg-field/30 p-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('pribehy.velikost')}
                  </span>
                  <span className="flex items-center gap-1">
                    <KulatyKnoflik
                      popisek="−"
                      nazev={t('pribehy.zmensit')}
                      onClick={() => setStyl((st) => orezStyl({ ...st, velikost: st.velikost - 0.5 }))}
                      vypnuto={styl.velikost <= MIN_VELIKOST}
                    />
                    <span className="w-10 text-center font-heading text-xs tabular-nums text-ink">
                      {styl.velikost.toFixed(1)}
                    </span>
                    <KulatyKnoflik
                      popisek="+"
                      nazev={t('pribehy.zvetsit')}
                      onClick={() => setStyl((st) => orezStyl({ ...st, velikost: st.velikost + 0.5 }))}
                      vypnuto={styl.velikost >= MAX_VELIKOST}
                    />
                  </span>

                  <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('pribehy.zarovnani')}
                  </span>
                  <span className="flex items-center gap-1">
                    {(['left', 'center', 'right'] as ZarovnaniTextu[]).map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setStyl((st) => ({ ...st, zarovnani: z }))}
                        aria-pressed={styl.zarovnani === z}
                        className={`h-7 w-8 cursor-pointer rounded-lg border font-heading text-xs transition-colors ${
                          styl.zarovnani === z
                            ? 'border-brand-purple bg-brand-purple/15 text-ink'
                            : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        {z === 'left' ? '◧' : z === 'center' ? '▣' : '◨'}
                      </button>
                    ))}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('pribehy.barvaPisma')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {BARVY_TEXTU.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setStyl((st) => ({ ...st, barva: b }))}
                        aria-pressed={styl.barva === b}
                        aria-label={b}
                        style={{ background: b }}
                        className={`h-6 w-6 cursor-pointer rounded-full border-2 transition-transform ${
                          styl.barva === b ? 'border-brand-purple scale-110' : 'border-line'
                        }`}
                      />
                    ))}
                  </span>

                  <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('pribehy.podklad')}
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {Object.keys(PODKLADY).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setStyl((st) => ({ ...st, podklad: k }))}
                        aria-pressed={styl.podklad === k}
                        className={`cursor-pointer rounded-pill border px-2.5 py-1 font-heading text-[11px] transition-colors ${
                          styl.podklad === k
                            ? 'border-brand-purple bg-brand-purple/15 text-ink'
                            : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        {t(`pribehy.podklad.${k}`)}
                      </button>
                    ))}
                  </span>
                </div>
              </div>
            )}

            <span className="font-body text-xs text-muted">{t('pribehy.souborPopis')}</span>

            <div className="mt-auto flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!soubor || odesilam}
                onClick={() => void odesli()}
                className="cursor-pointer rounded-pill bg-brand-purple px-5 py-2 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-purpleDeep disabled:opacity-50"
              >
                {t(odesilam ? 'pribehy.odesilam' : 'pribehy.odeslat')}
              </button>
              {soubor && !odesilam && (
                <button
                  type="button"
                  onClick={() => {
                    setSoubor(null);
                    if (vstupSouboru.current) vstupSouboru.current.value = '';
                  }}
                  className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-muted transition-colors hover:text-ink"
                >
                  {t('pribehy.zmenitSoubor')}
                </button>
              )}
              {procenta !== null && (
                <span className="font-body text-xs tabular-nums text-muted">
                  {t('pribehy.nahravam', { procenta: String(procenta) })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {chyba && !otevreny && (
        <p className="m-0 font-body text-sm text-danger" role="alert">
          {chyba}
        </p>
      )}

      {pribehy.length === 0 && (
        <div className="rounded-card border border-line bg-surface px-6 py-12 text-center">
          <p className="m-0 font-body text-sm text-muted">{t('pribehy.zatimNic')}</p>
        </div>
      )}

      {cekaji.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            {t('pribehy.cekaji')} <span className="tabular-nums">{cekaji.length}</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cekaji.map((p) => (
              <Dlazdice key={p.id} p={p} t={t} jazyk={jazyk} otevri={otevri} />
            ))}
          </div>
        </section>
      )}

      {vyrizene.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            {t('pribehy.vyrizene')}
          </h2>
          <div className="grid grid-cols-2 gap-3 opacity-80 sm:grid-cols-3 lg:grid-cols-5">
            {vyrizene.map((p) => (
              <Dlazdice key={p.id} p={p} t={t} jazyk={jazyk} otevri={otevri} />
            ))}
          </div>
        </section>
      )}

      {/* PROHLÍŽEČ PŘÍBĚHU - celá obrazovka, jak to uvidí lidé. */}
      {vybrany && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOtevreny(null)}
        >
          <div
            className="flex w-full max-w-[360px] flex-col items-center gap-4 py-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[28px] bg-bar shadow-2xl">
              {vybrany.jeVideo ? (
                <video
                  src={`/api/site/pribehy/${vybrany.id}/soubor`}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/site/pribehy/${vybrany.id}/soubor`}
                  alt={vybrany.nazevSouboru}
                  className="h-full w-full object-cover"
                />
              )}

              <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-col gap-2">
                <span className="h-[3px] rounded-pill bg-white/90" />
                <span className="flex items-center gap-2">
                  <Znacka velikost={26} />
                  <span className="truncate font-heading text-xs text-white drop-shadow">
                    {ucet ? `@${ucet}` : t('pribehy.nadpis')}
                  </span>
                  <span className="truncate font-body text-xs text-white/70">
                    {vybrany.autor} · {formatDatum(jazyk, new Date(vybrany.createdAt))}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setOtevreny(null)}
                aria-label={t('pribehy.zavrit')}
                className="absolute right-3 top-14 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-black/50 font-heading text-sm text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              >
                ✕
              </button>

              {/* U fotky je text vypálený přímo v obrázku, tady se už nepřekrývá. */}
              {vybrany.popisek.trim() && vybrany.jeVideo && (
                <div className="absolute inset-x-4 bottom-4 max-h-[40%] overflow-y-auto rounded-card bg-black/55 px-3 py-2 font-body text-sm text-white backdrop-blur-sm">
                  <p className="m-0 whitespace-pre-wrap">{vybrany.popisek}</p>
                </div>
              )}
            </div>

            {vybrany.popisek.trim() && !vybrany.jeVideo && (
              <p className="m-0 w-full whitespace-pre-wrap rounded-card border border-white/15 bg-white/10 px-3 py-2 font-body text-xs text-white/80">
                {vybrany.popisek}
              </p>
            )}
            {vybrany.vzkaz && (
              <p className="m-0 w-full rounded-card border border-white/15 bg-white/10 px-3 py-2 font-body text-xs text-white/80">
                {vybrany.vzkaz}
              </p>
            )}
            {vybrany.vyridil && vybrany.vyrizenoAt && (
              <p className="m-0 font-body text-[11px] text-white/60">
                {t('pribehy.vyridil', {
                  kdo: vybrany.vyridil,
                  datum: formatDatum(jazyk, new Date(vybrany.vyrizenoAt)),
                })}
              </p>
            )}

            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              {smiSchvalit && vybrany.stav === 'CEKA' && presApi && (
                <button
                  type="button"
                  disabled={pracuji === vybrany.id}
                  onClick={() => void vyrid(vybrany.id, 'VYVESENO', undefined, 'API')}
                  className="cursor-pointer rounded-pill bg-brand-purple px-5 py-2 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-purpleDeep disabled:opacity-50"
                >
                  {t(pracuji === vybrany.id ? 'pribehy.vyvesuji' : 'pribehy.vyvesit')}
                </button>
              )}
              {smiSchvalit && vybrany.stav === 'CEKA' && !presApi && (
                <button
                  type="button"
                  disabled={pracuji === vybrany.id}
                  onClick={() => void vyrid(vybrany.id, 'VYVESENO')}
                  className="cursor-pointer rounded-pill bg-brand-purple px-5 py-2 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-purpleDeep disabled:opacity-50"
                >
                  {t('pribehy.vyveseno')}
                </button>
              )}

              <a
                href={`/api/site/pribehy/${vybrany.id}/soubor?stahnout=1`}
                className="rounded-pill border border-white/25 px-4 py-2 font-heading text-sm text-white no-underline transition-colors hover:border-white/60"
              >
                {t('pribehy.stahnout')}
              </a>
              {vybrany.popisek.trim() && (
                <button
                  type="button"
                  onClick={() => void zkopiruj(vybrany.id, vybrany.popisek)}
                  className="cursor-pointer rounded-pill border border-white/25 px-4 py-2 font-heading text-sm text-white transition-colors hover:border-white/60"
                >
                  {t(zkopirovano === vybrany.id ? 'pribehy.zkopirovano' : 'pribehy.zkopirovatText')}
                </button>
              )}

              {smiSchvalit && vybrany.stav === 'CEKA' && (
                <>
                  {presApi && (
                    <button
                      type="button"
                      disabled={pracuji === vybrany.id}
                      onClick={() => void vyrid(vybrany.id, 'VYVESENO')}
                      className="cursor-pointer rounded-pill border border-white/25 px-4 py-2 font-heading text-sm text-white/80 transition-colors hover:text-white disabled:opacity-50"
                    >
                      {t('pribehy.vyvesenoRucne')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pracuji === vybrany.id}
                    onClick={() => {
                      setZamitam((z) => !z);
                      setVzkaz('');
                    }}
                    className="cursor-pointer rounded-pill border border-white/25 px-4 py-2 font-heading text-sm text-white/70 transition-colors hover:text-white disabled:opacity-50"
                  >
                    {t('pribehy.zamitnout')}
                  </button>
                </>
              )}

              {vybrany.autorId === jaId && vybrany.stav === 'CEKA' && (
                <button
                  type="button"
                  disabled={pracuji === vybrany.id}
                  onClick={() => void stahniZFronty(vybrany.id)}
                  className="cursor-pointer rounded-pill border border-white/25 px-4 py-2 font-heading text-sm text-white/70 transition-colors hover:text-white disabled:opacity-50"
                >
                  {t('pribehy.stahnoutZFronty')}
                </button>
              )}
            </div>

            {zamitam && (
              <div className="flex w-full flex-col gap-2 rounded-card border border-white/15 bg-white/10 p-3">
                <label className="font-heading text-xs font-semibold text-white" htmlFor="vzkaz-pribehu">
                  {t('pribehy.vzkaz')}
                </label>
                <textarea
                  id="vzkaz-pribehu"
                  value={vzkaz}
                  onChange={(e) => setVzkaz(e.target.value)}
                  rows={2}
                  placeholder={t('pribehy.vzkazPlaceholder')}
                  className="w-full rounded-card border border-white/20 bg-black/40 px-3 py-2 font-body text-sm text-white outline-none placeholder:text-white/40"
                />
                <button
                  type="button"
                  disabled={pracuji === vybrany.id}
                  onClick={() => void vyrid(vybrany.id, 'ZAMITNUTO', vzkaz)}
                  className="cursor-pointer self-start rounded-pill border border-white/30 px-4 py-1.5 font-heading text-xs font-semibold text-white transition-colors hover:border-white disabled:opacity-50"
                >
                  {t('pribehy.potvrditZamitnuti')}
                </button>
              </div>
            )}

            {chyba && (
              <p className="m-0 w-full rounded-card bg-black/60 px-3 py-2 text-center font-body text-sm text-white" role="alert">
                {chyba}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
