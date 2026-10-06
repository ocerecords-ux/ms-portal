'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import type { PribehRadek } from '@/lib/pribehyServer';
import {
  MAX_POPISEK,
  PRIJIMANE_PRIPONY,
  POVOLENE_TYPY,
  maxProTyp,
  velikostVMB,
} from '@/lib/pribehy';
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
import { KROUZEK, KROUZEK_KLID, Znacka, typSouboru } from './spolecne';

/**
 * EDITOR PŘÍBĚHU (zadání 6. 10. 2026: „pojďme to udělat tak, že pole textu
 * bude nalevo a ten náhled napravo… a možnost uložit koncept nebo rovnou
 * smazat nebo vyměnit fotku nebo začít znovu").
 *
 * NESCHVALUJE SE. Od tohohle zadání jde příběh ven rovnou („nemusíme to
 * nechávat schvalovat, všichni z týmu by měli mít možnost to tam dát").
 * Fronta zůstala jen jako místo, kde skončí to, co Instagram odmítl.
 *
 * TEXT SE U FOTKY VYPALUJE DO OBRÁZKU, až při odeslání - viz lib/pribehText.ts.
 * Koncept proto drží PŮVODNÍ fotku a podobu textu zvlášť, aby se dal otevřít
 * a dál upravovat; hotový příběh má text už v sobě.
 */

type Rozdelano = {
  id: string;
  popisek: string;
  styl: StylTextu;
};

export function Editor({
  ucet,
  koncept,
  onHotovo,
}: {
  ucet: string | null;
  /** Otevřený koncept, nebo nic - pak se zakládá nový. */
  koncept: PribehRadek | null;
  onHotovo: () => void;
}) {
  const t = usePreklad();
  const router = useRouter();

  const vstupSouboru = useRef<HTMLInputElement | null>(null);
  const poleTextu = useRef<HTMLTextAreaElement | null>(null);
  const ramRef = useRef<HTMLSpanElement | null>(null);
  const taham = useRef(false);

  const [soubor, setSoubor] = useState<File | null>(null);
  const [nahled, setNahled] = useState<string | null>(null);
  const [zKonceptu, setZKonceptu] = useState<Rozdelano | null>(null);
  const [popisek, setPopisek] = useState('');
  const [styl, setStyl] = useState<StylTextu>(VYCHOZI_STYL);
  const [ramVyska, setRamVyska] = useState(0);
  const [procenta, setProcenta] = useState<number | null>(null);
  const [pracuji, setPracuji] = useState<'odeslat' | 'koncept' | 'smazat' | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  /** Otevření konceptu: stáhne jeho soubor zpátky do prohlížeče a naváže se na něj. */
  useEffect(() => {
    if (!koncept) return;
    let zruseno = false;
    setChyba(null);
    setPopisek(koncept.popisek);
    setStyl(orezStyl({ ...VYCHOZI_STYL, ...((koncept.textStyl as Partial<StylTextu>) ?? {}) }));
    setZKonceptu({ id: koncept.id, popisek: koncept.popisek, styl: VYCHOZI_STYL });
    (async () => {
      try {
        const res = await fetch(`/api/site/pribehy/${koncept.id}/soubor`);
        if (!res.ok) throw new Error('soubor');
        const blob = await res.blob();
        if (zruseno) return;
        setSoubor(new File([blob], koncept.nazevSouboru, { type: koncept.typSouboru }));
      } catch {
        if (!zruseno) setChyba(t('pribehy.konceptNeotevren'));
      }
    })();
    return () => {
      zruseno = true;
    };
  }, [koncept, t]);

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

  /** Výška rámu v bodech - velikost písma je v procentech výšky. */
  useEffect(() => {
    const prvek = ramRef.current;
    if (!prvek || typeof ResizeObserver === 'undefined') return;
    const hlidac = new ResizeObserver(() => setRamVyska(prvek.clientHeight));
    hlidac.observe(prvek);
    setRamVyska(prvek.clientHeight);
    return () => hlidac.disconnect();
  }, [nahled]);

  const jeVideo = soubor !== null && typSouboru(soubor).startsWith('video/');

  function vyber(e: React.ChangeEvent<HTMLInputElement>) {
    const vybrany = e.target.files?.[0] ?? null;
    setChyba(null);
    if (!vybrany) return;
    const typ = typSouboru(vybrany);
    if (!POVOLENE_TYPY.includes(typ)) {
      setChyba(t('pribehy.spatnyTyp'));
      return;
    }
    if (vybrany.size > maxProTyp(typ)) {
      setChyba(t('pribehy.mocVelky', { kolik: velikostVMB(maxProTyp(typ)) }));
      return;
    }
    setSoubor(vybrany);
  }

  function zacniZnovu() {
    setSoubor(null);
    setPopisek('');
    setStyl(VYCHOZI_STYL);
    setChyba(null);
    if (vstupSouboru.current) vstupSouboru.current.value = '';
  }

  /** Táhnutí textu po příběhu. Procenta, ne body - viz lib/pribehText.ts. */
  function chytText(e: React.PointerEvent<HTMLDivElement>) {
    if (!ramRef.current) return;
    taham.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function tahniText(e: React.PointerEvent<HTMLDivElement>) {
    const ram = ramRef.current;
    if (!taham.current || !ram) return;
    const r = ram.getBoundingClientRect();
    setStyl((st) =>
      orezStyl({ ...st, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }),
    );
  }
  function pustText(e: React.PointerEvent<HTMLDivElement>) {
    taham.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  /** Nahraje soubor do úložiště a vrátí klíč; vrací null, když není co měnit. */
  async function nahraj(): Promise<{ klic: string; nazev: string } | null> {
    if (!soubor) return null;
    let data: Blob = soubor;
    let typ = typSouboru(soubor);
    let nazev = soubor.name;
    if (!typ.startsWith('video/')) {
      // Fotka se ořízne na 9:16 a text se do ní vypálí - viz lib/pribehText.ts.
      data = await slozPribeh(soubor, popisek, styl);
      typ = 'image/jpeg';
      nazev = `${soubor.name.replace(/\.[^.]+$/, '')}.jpg`;
    }
    const res = await fetch('/api/site/pribehy/podpis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev, typ, velikost: data.size }),
    });
    const podpis = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(podpis.error || t('pribehy.neodeslano'));
    await nahrajDoUloziste(podpis.uploadUrl, data, typ, setProcenta);
    setProcenta(null);
    return { klic: podpis.key, nazev };
  }

  /** Původní (nevypálená) fotka do konceptu - text se do ní vypálí až nakonec. */
  async function nahrajPuvodni(): Promise<{ klic: string; nazev: string } | null> {
    if (!soubor) return null;
    const typ = typSouboru(soubor);
    const res = await fetch('/api/site/pribehy/podpis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: soubor.name, typ, velikost: soubor.size }),
    });
    const podpis = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(podpis.error || t('pribehy.neodeslano'));
    await nahrajDoUloziste(podpis.uploadUrl, soubor, typ, setProcenta);
    setProcenta(null);
    return { klic: podpis.key, nazev: soubor.name };
  }

  async function daj() {
    if (!soubor) return;
    setPracuji('odeslat');
    setChyba(null);
    setProcenta(0);
    try {
      const nahrane = await nahraj();
      if (!nahrane) throw new Error(t('pribehy.neodeslano'));
      const res = await fetch('/api/site/pribehy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klic: nahrane.klic, nazevSouboru: nahrane.nazev, popisek }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) throw new Error(telo.error || t('pribehy.neodeslano'));
      // 207: pribeh je ulozeny, jen ho Instagram nevzal - duvod se ukaze ve fronte.
      if (telo.chyba) setChyba(telo.chyba);
      if (zKonceptu) await fetch(`/api/site/pribehy/${zKonceptu.id}`, { method: 'DELETE' });
      zacniZnovu();
      setZKonceptu(null);
      onHotovo();
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error && err.message !== 'upload' ? err.message : t('pribehy.neodeslano'));
    } finally {
      setPracuji(null);
      setProcenta(null);
    }
  }

  async function ulozKoncept() {
    if (!soubor) return;
    setPracuji('koncept');
    setChyba(null);
    setProcenta(0);
    try {
      if (zKonceptu) {
        const nahrane = await nahrajPuvodni();
        const res = await fetch(`/api/site/pribehy/${zKonceptu.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stav: 'KONCEPT',
            popisek,
            textStyl: styl,
            klic: nahrane?.klic,
            nazevSouboru: nahrane?.nazev,
          }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(telo.error || t('pribehy.neodeslano'));
      } else {
        const nahrane = await nahrajPuvodni();
        if (!nahrane) throw new Error(t('pribehy.neodeslano'));
        const res = await fetch('/api/site/pribehy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            klic: nahrane.klic,
            nazevSouboru: nahrane.nazev,
            popisek,
            textStyl: styl,
            stav: 'KONCEPT',
          }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(telo.error || t('pribehy.neodeslano'));
      }
      zacniZnovu();
      setZKonceptu(null);
      onHotovo();
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error && err.message !== 'upload' ? err.message : t('pribehy.neodeslano'));
    } finally {
      setPracuji(null);
      setProcenta(null);
    }
  }

  async function smazKoncept() {
    if (!zKonceptu) {
      zacniZnovu();
      return;
    }
    setPracuji('smazat');
    try {
      await fetch(`/api/site/pribehy/${zKonceptu.id}`, { method: 'DELETE' });
      zacniZnovu();
      setZKonceptu(null);
      onHotovo();
      router.refresh();
    } finally {
      setPracuji(null);
    }
  }

  /** Vloží zmínku na místo kurzoru - viz Zminky. */
  function vlozZminku(znacka: string) {
    const pole = poleTextu.current;
    const kde = pole ? pole.selectionStart : popisek.length;
    const pred = popisek.slice(0, kde).replace(/@[A-Za-z0-9._]*$/, '');
    const za = popisek.slice(kde);
    const mezera = pred && !pred.endsWith(' ') && !pred.endsWith('\n') ? ' ' : '';
    const novy = `${pred}${mezera}${znacka} ${za}`.slice(0, MAX_POPISEK);
    setPopisek(novy);
    requestAnimationFrame(() => {
      pole?.focus();
      const pozice = (pred + mezera + znacka + ' ').length;
      pole?.setSelectionRange(pozice, pozice);
    });
  }

  return (
    <div className="grid gap-6 rounded-card border border-line bg-surface p-5 lg:grid-cols-[1fr_auto]">
      {/* --- VLEVO: text a jeho podoba ------------------------------------ */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="font-heading text-sm font-semibold text-ink" htmlFor="pribeh-popisek">
            {t('pribehy.popisek')}
          </label>
          {zKonceptu && (
            <span className="rounded-pill border border-line bg-field px-2.5 py-0.5 font-heading text-[11px] text-muted">
              {t('pribehy.upravujeteKoncept')}
            </span>
          )}
        </div>
        <textarea
          id="pribeh-popisek"
          ref={poleTextu}
          value={popisek}
          onChange={(e) => setPopisek(e.target.value.slice(0, MAX_POPISEK))}
          rows={5}
          placeholder={t('pribehy.popisekPlaceholder')}
          className="w-full rounded-card border border-line bg-field/40 px-3 py-2 font-body text-sm text-ink outline-none focus:border-brand-purple"
        />

        <Zminky text={popisek} naVlozeni={vlozZminku} />

        {popisek.trim() && !jeVideo && (
          <div className="flex flex-col gap-3 rounded-card border border-line bg-field/30 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                {t('pribehy.velikost')}
              </span>
              <span className="flex items-center gap-1">
                <Knoflik
                  popisek="−"
                  nazev={t('pribehy.zmensit')}
                  onClick={() => setStyl((st) => orezStyl({ ...st, velikost: st.velikost - 0.5 }))}
                  vypnuto={styl.velikost <= MIN_VELIKOST}
                />
                <span className="w-10 text-center font-heading text-xs tabular-nums text-ink">
                  {styl.velikost.toFixed(1)}
                </span>
                <Knoflik
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
                      styl.barva === b ? 'scale-110 border-brand-purple' : 'border-line'
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

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={!soubor || pracuji !== null}
            onClick={() => void daj()}
            className="cursor-pointer rounded-pill bg-brand-purple px-5 py-2 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-purpleDeep disabled:opacity-50"
          >
            {t(pracuji === 'odeslat' ? 'pribehy.vyvesuji' : 'pribehy.datNaInstagram')}
          </button>
          <button
            type="button"
            disabled={!soubor || pracuji !== null}
            onClick={() => void ulozKoncept()}
            className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-ink transition-colors hover:border-brand-purple disabled:opacity-50"
          >
            {t(pracuji === 'koncept' ? 'obecne.ukladam' : 'pribehy.ulozitKoncept')}
          </button>
          {soubor && (
            <>
              <label
                htmlFor="pribeh-soubor"
                className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-muted transition-colors hover:text-ink"
              >
                {t('pribehy.vymenitFotku')}
              </label>
              <button
                type="button"
                disabled={pracuji !== null}
                onClick={zacniZnovu}
                className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                {t('pribehy.zacitZnovu')}
              </button>
              <button
                type="button"
                disabled={pracuji !== null}
                onClick={() => void smazKoncept()}
                className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-danger transition-colors hover:border-danger disabled:opacity-50"
              >
                {t('pribehy.smazat')}
              </button>
            </>
          )}
          {procenta !== null && (
            <span className="font-body text-xs tabular-nums text-muted">
              {t('pribehy.nahravam', { procenta: String(procenta) })}
            </span>
          )}
        </div>

        {chyba && (
          <p className="m-0 font-body text-sm text-danger" role="alert">
            {chyba}
          </p>
        )}
      </div>

      {/* --- VPRAVO: náhled ----------------------------------------------- */}
      <div className="flex flex-col items-center gap-2 lg:order-last">
        <label
          htmlFor="pribeh-soubor"
          onClick={(e) => {
            // S náhledem se do rámu klikat nedá - tahalo by se tím textem.
            if (nahled) e.preventDefault();
          }}
          className={`block rounded-[26px] p-[2px] ${nahled ? KROUZEK : KROUZEK_KLID} ${nahled ? '' : 'cursor-pointer'}`}
        >
          <span
            ref={ramRef}
            className="relative block aspect-[9/16] w-[250px] overflow-hidden rounded-[24px] bg-field sm:w-[300px]"
          >
            {nahled ? (
              <>
                {jeVideo ? (
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
                {popisek.trim() && !jeVideo && (
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
        <span className="max-w-[300px] text-center font-body text-[11px] text-muted">
          {t(nahled ? (jeVideo ? 'pribehy.uVideaBezTextu' : 'pribehy.tahniText') : 'pribehy.devetNaSestnact')}
        </span>
      </div>
    </div>
  );
}

/**
 * ZMÍNKY (zadání 6. 10. 2026: „kdyby tam šli označit lidi přes zavináč,
 * zmínky a spolupráce").
 *
 * POZOR, CO INSTAGRAM UMÍ: oficiální API u příběhů NEUMÍ nalepit zmínkovou
 * nálepku ani přidat spolupracovníka - vyvěsí jen samotný obrázek. Zavináč
 * se tedy propíše do textu a je na příběhu vidět, ale není to klikací odkaz.
 * Kdo chce opravdovou nálepku, musí příběh vyvěsit z telefonu.
 *
 * Nabídka se staví z toho, co už kdo použil dřív (viz /api/site/pribehy/
 * zminky) - vlastní tabulka účtů by se stejně nikdy neudržovala.
 */
function Zminky({ text, naVlozeni }: { text: string; naVlozeni: (znacka: string) => void }) {
  const t = usePreklad();
  const [znamé, setZname] = useState<string[]>([]);

  useEffect(() => {
    let zruseno = false;
    fetch('/api/site/pribehy/zminky')
      .then((r) => (r.ok ? r.json() : { zminky: [] }))
      .then((d) => {
        if (!zruseno) setZname(Array.isArray(d.zminky) ? d.zminky : []);
      })
      .catch(() => undefined);
    return () => {
      zruseno = true;
    };
  }, []);

  const rozepsana = text.match(/@([A-Za-z0-9._]*)$/)?.[1]?.toLowerCase() ?? null;
  const nabidka =
    rozepsana === null
      ? znamé.slice(0, 6)
      : znamé.filter((z) => z.slice(1).startsWith(rozepsana)).slice(0, 6);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
          {t('pribehy.zminky')}
        </span>
        {nabidka.length === 0 ? (
          <span className="font-body text-xs text-muted">{t('pribehy.zminkyZatimZadne')}</span>
        ) : (
          nabidka.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => naVlozeni(z)}
              className="cursor-pointer rounded-pill border border-line px-2.5 py-1 font-heading text-[11px] text-ink transition-colors hover:border-brand-purple"
            >
              {z}
            </button>
          ))
        )}
      </div>
      <span className="font-body text-[11px] text-muted">{t('pribehy.zminkyPopis')}</span>
    </div>
  );
}

function Knoflik({
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
