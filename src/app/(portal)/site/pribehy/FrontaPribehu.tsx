'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatum } from '@/lib/jazyk';
import type { PribehRadek } from '@/lib/pribehyServer';
import {
  MAX_POPISEK,
  PRIJIMANE_PRIPONY,
  POVOLENE_TYPY,
  maxProTyp,
  velikostVMB,
} from '@/lib/pribehy';

/**
 * FRONTA PŘÍBĚHŮ (zadání 6. 10. 2026).
 *
 * SOUBOR JDE DO ÚLOŽIŠTĚ ROVNOU Z PROHLÍŽEČE - nejdřív si vyžádáme
 * podepsanou adresu, pak na ni pošleme soubor a teprve potom portálu řekneme
 * „zapiš příběh k tomuhle klíči". Přes portál by patnáctisekundové video
 * neprošlo (strop Vercelu 4,5 MB).
 *
 * Nahrávání jede přes XMLHttpRequest, ne fetch - jen on umí hlásit, kolik
 * procent je nahráno. U videa z telefonu to není kosmetika; bez toho člověk
 * půl minuty kouká na nehybné tlačítko a soubor pošle znovu.
 */

const TRIDY_STAVU: Record<string, string> = {
  CEKA: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40',
  VYVESENO: 'bg-okTint text-status-done border-transparent',
  ZAMITNUTO: 'bg-field text-muted border-line',
};

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

export function FrontaPribehu({
  pribehy,
  smiPoslat,
  smiSchvalit,
  presApi,
  jaId,
}: {
  pribehy: PribehRadek[];
  smiPoslat: boolean;
  smiSchvalit: boolean;
  /** Je Instagram připojený? Pak portál vyvěšuje sám, jinak zbývá ruční cesta. */
  presApi: boolean;
  jaId: string;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();

  const vstupSouboru = useRef<HTMLInputElement | null>(null);
  const [soubor, setSoubor] = useState<File | null>(null);
  const [popisek, setPopisek] = useState('');
  const [procenta, setProcenta] = useState<number | null>(null);
  const [odesilam, setOdesilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState<string | null>(null);
  const [zamitam, setZamitam] = useState<string | null>(null);
  const [vzkaz, setVzkaz] = useState('');
  const [pracuji, setPracuji] = useState<string | null>(null);

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
      setZamitam(null);
      setVzkaz('');
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

  const cekaji = pribehy.filter((p) => p.stav === 'CEKA');
  const vyrizene = pribehy.filter((p) => p.stav !== 'CEKA');

  function karta(p: PribehRadek) {
    const muj = p.autorId === jaId;
    return (
      <li
        key={p.id}
        className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:gap-4"
      >
        <div className="shrink-0 w-full sm:w-32">
          {p.jeVideo ? (
            <video
              src={`/api/site/pribehy/${p.id}/soubor`}
              controls
              preload="metadata"
              className="w-full rounded-card border border-line bg-black aspect-[9/16] object-contain"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/site/pribehy/${p.id}/soubor`}
              alt={p.nazevSouboru}
              className="w-full rounded-card border border-line bg-field aspect-[9/16] object-cover"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-pill border px-2 py-0.5 text-[11px] font-heading ${
                TRIDY_STAVU[p.stav] ?? TRIDY_STAVU.CEKA
              }`}
            >
              {t(`pribehy.stav.${p.stav}`)}
            </span>
            <span className="text-xs font-body text-muted">
              {t('pribehy.od', { kdo: p.autor, datum: formatDatum(jazyk, new Date(p.createdAt)) })}
            </span>
          </div>

          {p.popisek.trim() ? (
            <p className="m-0 whitespace-pre-wrap text-sm font-body text-ink">{p.popisek}</p>
          ) : (
            <p className="m-0 text-sm font-body text-muted italic">{t('pribehy.bezPopisku')}</p>
          )}

          {p.vzkaz && (
            <p className="m-0 rounded-card border border-line bg-field/50 px-3 py-2 text-xs font-body text-muted">
              {p.vzkaz}
            </p>
          )}

          {p.vyridil && p.vyrizenoAt && (
            <p className="m-0 text-[11px] font-body text-muted">
              {t('pribehy.vyridil', {
                kdo: p.vyridil,
                datum: formatDatum(jazyk, new Date(p.vyrizenoAt)),
              })}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <a
              href={`/api/site/pribehy/${p.id}/soubor?stahnout=1`}
              className="rounded-pill border border-line px-3 py-1.5 text-xs font-heading text-ink no-underline hover:border-brand-purple transition-colors"
            >
              {t('pribehy.stahnout')}
            </a>
            {p.popisek.trim() && (
              <button
                type="button"
                onClick={() => void zkopiruj(p.id, p.popisek)}
                className="rounded-pill border border-line px-3 py-1.5 text-xs font-heading text-ink hover:border-brand-purple transition-colors cursor-pointer"
              >
                {t(zkopirovano === p.id ? 'pribehy.zkopirovano' : 'pribehy.zkopirovatText')}
              </button>
            )}

            {smiSchvalit && p.stav === 'CEKA' && (
              <>
                {presApi && (
                  <button
                    type="button"
                    disabled={pracuji === p.id}
                    onClick={() => void vyrid(p.id, 'VYVESENO', undefined, 'API')}
                    className="rounded-pill bg-brand-purple px-4 py-1.5 text-xs font-heading font-semibold text-white hover:bg-brand-purpleDeep transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t(pracuji === p.id ? 'pribehy.vyvesuji' : 'pribehy.vyvesit')}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pracuji === p.id}
                  onClick={() => void vyrid(p.id, 'VYVESENO')}
                  className={`rounded-pill px-4 py-1.5 text-xs font-heading font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                    presApi
                      ? 'border border-line text-muted hover:text-ink'
                      : 'bg-brand-purple text-white hover:bg-brand-purpleDeep'
                  }`}
                >
                  {t(presApi ? 'pribehy.vyvesenoRucne' : 'pribehy.vyveseno')}
                </button>
                <button
                  type="button"
                  disabled={pracuji === p.id}
                  onClick={() => {
                    setZamitam(zamitam === p.id ? null : p.id);
                    setVzkaz('');
                  }}
                  className="rounded-pill border border-line px-3 py-1.5 text-xs font-heading text-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('pribehy.zamitnout')}
                </button>
              </>
            )}

            {muj && p.stav === 'CEKA' && (
              <button
                type="button"
                disabled={pracuji === p.id}
                onClick={() => void stahniZFronty(p.id)}
                className="rounded-pill border border-line px-3 py-1.5 text-xs font-heading text-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('pribehy.stahnoutZFronty')}
              </button>
            )}
          </div>

          {zamitam === p.id && (
            <div className="flex flex-col gap-2 rounded-card border border-line bg-field/40 p-3">
              <label className="text-xs font-heading font-semibold text-ink" htmlFor={`vzkaz-${p.id}`}>
                {t('pribehy.vzkaz')}
              </label>
              <textarea
                id={`vzkaz-${p.id}`}
                value={vzkaz}
                onChange={(e) => setVzkaz(e.target.value)}
                rows={2}
                placeholder={t('pribehy.vzkazPlaceholder')}
                className="w-full rounded-card border border-line bg-surface px-3 py-2 text-sm font-body text-ink"
              />
              <button
                type="button"
                disabled={pracuji === p.id}
                onClick={() => void vyrid(p.id, 'ZAMITNUTO', vzkaz)}
                className="self-start rounded-pill border border-line px-4 py-1.5 text-xs font-heading font-semibold text-ink hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('pribehy.potvrditZamitnuti')}
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl text-ink m-0">{t('pribehy.nadpis')}</h1>
        <p className="m-0 max-w-[68ch] text-sm font-body text-muted">
          {t(smiSchvalit ? 'pribehy.podnadpisSchvalovatel' : 'pribehy.podnadpis')}
        </p>
      </div>

      {smiPoslat && (
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-heading font-semibold text-ink" htmlFor="pribeh-soubor">
              {t('pribehy.soubor')}
            </label>
            <input
              id="pribeh-soubor"
              ref={vstupSouboru}
              type="file"
              accept={PRIJIMANE_PRIPONY}
              onChange={vyber}
              className="text-sm font-body text-ink"
            />
            <span className="text-xs font-body text-muted">{t('pribehy.souborPopis')}</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-heading font-semibold text-ink" htmlFor="pribeh-popisek">
              {t('pribehy.popisek')}
            </label>
            <textarea
              id="pribeh-popisek"
              value={popisek}
              onChange={(e) => setPopisek(e.target.value.slice(0, MAX_POPISEK))}
              rows={3}
              placeholder={t('pribehy.popisekPlaceholder')}
              className="w-full rounded-card border border-line bg-field/40 px-3 py-2 text-sm font-body text-ink"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!soubor || odesilam}
              onClick={() => void odesli()}
              className="rounded-pill bg-brand-purple px-5 py-2 text-sm font-heading font-semibold text-white hover:bg-brand-purpleDeep transition-colors cursor-pointer disabled:opacity-50"
            >
              {t(odesilam ? 'pribehy.odesilam' : 'pribehy.odeslat')}
            </button>
            {procenta !== null && (
              <span className="text-xs font-body text-muted tabular-nums">
                {t('pribehy.nahravam', { procenta: String(procenta) })}
              </span>
            )}
          </div>

          {chyba && (
            <p className="m-0 text-sm font-body text-status-error" role="alert">
              {chyba}
            </p>
          )}
        </div>
      )}

      {cekaji.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 font-heading text-lg text-ink">
            {t('pribehy.cekaji')} <span className="text-muted tabular-nums">{cekaji.length}</span>
          </h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-3">{cekaji.map(karta)}</ul>
        </section>
      )}

      {pribehy.length === 0 && (
        <div className="rounded-card border border-line bg-surface px-6 py-12 text-center">
          <p className="m-0 text-sm font-body text-muted">{t('pribehy.zatimNic')}</p>
        </div>
      )}

      {vyrizene.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 font-heading text-lg text-ink">{t('pribehy.vyrizene')}</h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-3">{vyrizene.map(karta)}</ul>
        </section>
      )}
    </div>
  );
}
