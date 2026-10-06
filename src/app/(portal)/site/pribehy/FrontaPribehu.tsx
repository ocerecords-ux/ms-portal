'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatum, type Jazyk } from '@/lib/jazyk';
import type { PribehRadek } from '@/lib/pribehyServer';
import { MAX_POPISEK, PRIJIMANE_PRIPONY, POVOLENE_TYPY, maxProTyp, velikostVMB } from '@/lib/pribehy';

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

function nahrajDoUloziste(adresa: string, soubor: File, typ: string, pokrok: (p: number) => void) {
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

  async function odesli() {
    if (!soubor) return;
    const typ = typSouboru(soubor);
    setOdesilam(true);
    setChyba(null);
    setProcenta(0);
    try {
      const podpisRes = await fetch('/api/site/pribehy/podpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: soubor.name, typ, velikost: soubor.size }),
      });
      const podpis = await podpisRes.json().catch(() => ({}));
      if (!podpisRes.ok) throw new Error(podpis.error || t('pribehy.neodeslano'));

      await nahrajDoUloziste(podpis.uploadUrl, soubor, typ, setProcenta);
      setProcenta(null);

      const res = await fetch('/api/site/pribehy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klic: podpis.key, nazevSouboru: soubor.name, popisek }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || t('pribehy.neodeslano'));

      setSoubor(null);
      setPopisek('');
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
        <div className="grid gap-5 rounded-card border border-line bg-surface p-5 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="pribeh-soubor"
              className={`block cursor-pointer rounded-[22px] p-[2px] ${nahled ? KROUZEK : KROUZEK_KLID}`}
            >
              <span className="relative block aspect-[9/16] w-[160px] overflow-hidden rounded-[20px] bg-field">
                {nahled ? (
                  <>
                    {soubor && typSouboru(soubor).startsWith('video/') ? (
                      <video src={nahled} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={nahled} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2">
                      <span className="h-[3px] rounded-pill bg-white/90" />
                      <span className="flex items-center gap-1.5">
                        <Znacka velikost={18} />
                        <span className="truncate font-heading text-[10px] text-white drop-shadow">
                          {ucet ? `@${ucet}` : t('pribehy.nadpis')}
                        </span>
                      </span>
                    </span>
                    {popisek.trim() && (
                      <span className="pointer-events-none absolute inset-x-2 bottom-2 line-clamp-3 rounded-xl bg-black/55 px-2 py-1 font-body text-[10px] text-white backdrop-blur-sm">
                        {popisek}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-center">
                    <span className="flex flex-col items-center gap-1 px-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-purple font-display text-2xl leading-none text-white">
                        +
                      </span>
                      <span className="font-heading text-[11px] text-muted">{t('pribehy.vybratSoubor')}</span>
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
            <span className="font-body text-[11px] text-muted">
              {t(nahled ? 'pribehy.takhleToBude' : 'pribehy.devetNaSestnact')}
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
              rows={4}
              placeholder={t('pribehy.popisekPlaceholder')}
              className="w-full rounded-card border border-line bg-field/40 px-3 py-2 font-body text-sm text-ink outline-none focus:border-brand-purple"
            />
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

              {vybrany.popisek.trim() && (
                <div className="absolute inset-x-4 bottom-4 max-h-[40%] overflow-y-auto rounded-card bg-black/55 px-3 py-2 font-body text-sm text-white backdrop-blur-sm">
                  <p className="m-0 whitespace-pre-wrap">{vybrany.popisek}</p>
                </div>
              )}
            </div>

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
