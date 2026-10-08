'use client';

import { useEffect, useRef, useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import {
  MAX_HUDBA_BYTES,
  PRIJIMANE_PRIPONY_HUDBY,
  TYPY_HUDBY,
  casMinSek,
  typHudby,
  type SkladbaRadek,
} from '@/lib/hudba';
import { nahrajDoUloziste } from './spolecne';

/**
 * SPRÁVA HUDBY DO PŘÍBĚHŮ (zadání 8. 10. 2026).
 *
 * PROČ TADY, A NE V ADMINISTRACI. Knihovna je malá a používá se jen na téhle
 * stránce - sahat do ní jinde by znamenalo odejít od rozdělaného příběhu.
 * Panel je proto schovaný pod tlačítkem a vidí ho jen ten, kdo smí knihovnu
 * měnit (produkce).
 *
 * DÉLKU SPOČÍTÁ PROHLÍŽEČ. Server by na to potřeboval soubor rozebrat, ale
 * `<audio>` ji zná hned po načtení hlavičky - a bez délky by nešel nabídnout
 * posuvník „odkud má skladba hrát".
 */
export function Hudba({ onZmena }: { onZmena?: () => void }) {
  const t = usePreklad();
  const [skladby, setSkladby] = useState<SkladbaRadek[]>([]);
  const [otevreno, setOtevreno] = useState(false);
  const [pracuji, setPracuji] = useState(false);
  const [procenta, setProcenta] = useState<number | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const poleSouboru = useRef<HTMLInputElement | null>(null);

  async function nacti() {
    try {
      const res = await fetch('/api/site/hudba');
      if (!res.ok) return;
      const telo = await res.json();
      setSkladby(telo.skladby ?? []);
    } catch {
      // Ticho - bez knihovny se jen nic nenabídne.
    }
  }

  useEffect(() => {
    if (otevreno) void nacti();
  }, [otevreno]);

  /** Délka skladby ze souboru, ještě než se nahraje. */
  function zmerDelku(soubor: File): Promise<number> {
    return new Promise((hotovo) => {
      const adresa = URL.createObjectURL(soubor);
      const zvuk = new Audio();
      const uklid = (vysledek: number) => {
        URL.revokeObjectURL(adresa);
        hotovo(vysledek);
      };
      zvuk.onloadedmetadata = () => uklid(Number.isFinite(zvuk.duration) ? Math.round(zvuk.duration) : 0);
      zvuk.onerror = () => uklid(0);
      zvuk.src = adresa;
    });
  }

  async function pridej(soubor: File) {
    setChyba(null);
    const typ = typHudby(soubor);
    if (!TYPY_HUDBY.includes(typ)) {
      setChyba(t('pribehy.hudbaSpatnyTyp'));
      return;
    }
    if (soubor.size > MAX_HUDBA_BYTES) {
      setChyba(t('pribehy.hudbaVelka'));
      return;
    }
    setPracuji(true);
    setProcenta(0);
    try {
      const delka = await zmerDelku(soubor);
      const podpisRes = await fetch('/api/site/hudba/podpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: soubor.name, typ, velikost: soubor.size }),
      });
      const podpis = await podpisRes.json().catch(() => ({}));
      if (!podpisRes.ok) throw new Error(podpis.error || t('pribehy.neodeslano'));

      await nahrajDoUloziste(podpis.uploadUrl, soubor, typ, setProcenta);
      setProcenta(null);

      const res = await fetch('/api/site/hudba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Název souboru bez přípony je slušný první návrh; přejmenovat jde hned.
          nazev: soubor.name.replace(/\.[^.]+$/, ''),
          autor: '',
          klic: podpis.key,
          nazevSouboru: soubor.name,
          typSouboru: typ,
          velikost: soubor.size,
          delka,
        }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || t('pribehy.neodeslano'));
      await nacti();
      onZmena?.();
    } catch (err) {
      setChyba(err instanceof Error && err.message !== 'upload' ? err.message : t('pribehy.neodeslano'));
    } finally {
      setPracuji(false);
      setProcenta(null);
      if (poleSouboru.current) poleSouboru.current.value = '';
    }
  }

  async function uprav(id: string, zmena: { nazev?: string; autor?: string; aktivni?: boolean }) {
    await fetch(`/api/site/hudba/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zmena),
    });
    await nacti();
    onZmena?.();
  }

  async function smaz(id: string) {
    if (!window.confirm(t('pribehy.hudbaOpravduSmazat'))) return;
    await fetch(`/api/site/hudba/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await nacti();
    onZmena?.();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        aria-expanded={otevreno}
        className={`self-start cursor-pointer rounded-pill border px-3 py-1.5 font-heading text-xs transition-colors ${
          otevreno ? 'border-brand-purple bg-brand-purple/15 text-ink' : 'border-line text-muted hover:text-ink'
        }`}
      >
        {t('pribehy.spravaHudby')}
      </button>

      {otevreno && (
        <div className="flex flex-col gap-3 rounded-card border border-line p-3">
          <p className="m-0 font-body text-xs text-muted">{t('pribehy.hudbaProc')}</p>

          <span className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="hudba-soubor"
              className="cursor-pointer rounded-pill border border-line px-3 py-1.5 font-heading text-xs text-ink transition-colors hover:border-brand-purple"
            >
              {t('pribehy.hudbaPridat')}
            </label>
            <input
              id="hudba-soubor"
              ref={poleSouboru}
              type="file"
              accept={PRIJIMANE_PRIPONY_HUDBY}
              disabled={pracuji}
              onChange={(e) => {
                const s = e.target.files?.[0];
                if (s) void pridej(s);
              }}
              className="hidden"
            />
            {procenta !== null && (
              <span className="font-body text-xs tabular-nums text-muted">
                {t('pribehy.nahravam', { procenta: String(procenta) })}
              </span>
            )}
          </span>

          {chyba && (
            <p className="m-0 font-body text-sm text-danger" role="alert">
              {chyba}
            </p>
          )}

          {skladby.length === 0 ? (
            <p className="m-0 font-body text-xs text-muted">{t('pribehy.hudbaPrazdno')}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {skladby.map((sk) => (
                <li
                  key={sk.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 ${
                    sk.aktivni ? '' : 'opacity-60'
                  }`}
                >
                  <input
                    defaultValue={sk.nazev}
                    onBlur={(e) => {
                      const nova = e.target.value.trim();
                      if (nova && nova !== sk.nazev) void uprav(sk.id, { nazev: nova });
                    }}
                    aria-label={t('pribehy.hudbaNazev')}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-heading text-xs text-ink outline-none focus:border-line"
                  />
                  <input
                    defaultValue={sk.autor}
                    placeholder={t('pribehy.hudbaAutor')}
                    onBlur={(e) => {
                      const nova = e.target.value.trim();
                      if (nova !== sk.autor) void uprav(sk.id, { autor: nova });
                    }}
                    aria-label={t('pribehy.hudbaAutor')}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-body text-xs text-muted outline-none focus:border-line"
                  />
                  <span className="shrink-0 font-heading text-[11px] tabular-nums text-muted">
                    {casMinSek(sk.delka)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void uprav(sk.id, { aktivni: !sk.aktivni })}
                    className="shrink-0 cursor-pointer font-heading text-[11px] text-muted hover:text-ink"
                  >
                    {t(sk.aktivni ? 'pribehy.hudbaVypnout' : 'pribehy.hudbaZapnout')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void smaz(sk.id)}
                    className="shrink-0 cursor-pointer font-heading text-[11px] text-danger"
                  >
                    {t('pribehy.smazat')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
