'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useJazyk, usePreklad } from '../components/JazykProvider';
import { formatDatum } from '@/lib/jazyk';

/**
 * MOJE FAKTURY VE VÝKAZECH (zadání 20. 11. 2026: „potřebuju, aby mohli
 * fakturu vkládat zvukaři tam, kde mají výkazy… a třeba tam i viděli stav,
 * v jakém to je").
 *
 * Nahrání je jedno tlačítko: soubor jde do Dokladů jako NEZAŘAZENÝ výdaj,
 * stejně jako faktura, která přijde do účtárenské schránky. Zvukař pak vidí,
 * kde faktura stojí - čeká na účetní, je zpracovaná, nebo zaplacená.
 */
export type MojeFaktura = {
  id: string;
  nazev: string | null;
  nahranoAt: string;
  castkaMinor: number;
  mena: string;
  stav: 'ceka' | 'zpracovana' | 'castecne' | 'uhrazena';
  uhrazenoAt: string | null;
  splatnost: string | null;
  /**
   * ČÁSTEČNÁ ÚHRADA (zadání 23. 11. 2026: „dej zvukařům i stav faktury jejich
   * jako uhrazeno částečně - kolik a kdy, ať mají přehled"). Kolik už dorazilo
   * a jednotlivé splátky, od nejstarší.
   */
  uhrazenoMinor: number;
  uhrady: { castkaMinor: number; datum: string }[];
};

const BAREVNOST: Record<MojeFaktura['stav'], string> = {
  ceka: 'bg-warnTint text-status-progress',
  zpracovana: 'bg-tint text-brand-purple',
  castecne: 'bg-warnTint text-status-progress',
  uhrazena: 'bg-okTint text-status-ok',
};

export function FakturyZvukare({ faktury }: { faktury: MojeFaktura[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const vstup = useRef<HTMLInputElement | null>(null);
  const [vybrany, setVybrany] = useState<File | null>(null);
  const [posilam, setPosilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function nahraj() {
    if (!vybrany || posilam) return;
    setPosilam(true);
    setChyba(null);
    const telo = new FormData();
    telo.append('soubor', vybrany);
    const res = await fetch('/api/vykazy/faktura', { method: 'POST', body: telo }).catch(() => null);
    setPosilam(false);
    if (!res?.ok) {
      setChyba(t('vykazFaktura.chyba'));
      return;
    }
    setVybrany(null);
    if (vstup.current) vstup.current.value = '';
    router.refresh();
  }

  const penize = (minor: number, mena: string) =>
    `${(minor / 100).toLocaleString(jazyk === 'en' ? 'en-GB' : 'cs-CZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${mena}`;

  const castka = (f: MojeFaktura) => (f.castkaMinor > 0 ? penize(f.castkaMinor, f.mena) : '—');

  return (
    <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-heading font-semibold text-sm text-ink m-0">{t('vykazFaktura.nadpis')}</h2>
        <p className="text-xs font-body text-muted m-0 mt-1">{t('vykazFaktura.popis')}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={vstup}
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => {
            setVybrany(e.target.files?.[0] ?? null);
            setChyba(null);
          }}
          className="text-xs font-body text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-field file:px-3 file:py-1.5 file:text-xs file:font-heading file:text-ink"
        />
        <button
          type="button"
          onClick={() => void nahraj()}
          disabled={!vybrany || posilam}
          className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer disabled:opacity-50"
        >
          {posilam ? t('vykazFaktura.nahravam') : t('vykazFaktura.nahrat')}
        </button>
        {chyba && <span className="text-xs font-body text-danger">{chyba}</span>}
      </div>

      {faktury.length === 0 ? (
        <p className="text-xs font-body text-muted m-0">{t('vykazFaktura.zadne')}</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {faktury.map((f) => (
            <li key={f.id} className="flex flex-col gap-1 text-sm font-body">
              <span className="flex items-center gap-3 flex-wrap">
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-0.5 text-[11px] font-heading font-semibold ${BAREVNOST[f.stav]}`}
                >
                  {t(`vykazFaktura.stav.${f.stav}`)}
                </span>
                <span className="text-ink grow min-w-0 truncate">
                  {f.nazev || t('vykazFaktura.bezNazvu')}
                </span>
                <span className="text-xs text-muted tabular-nums shrink-0">{castka(f)}</span>
                <span className="text-xs text-muted shrink-0">
                  {formatDatum(jazyk, new Date(f.nahranoAt))}
                </span>
              </span>

              {/* KOLIK A KDY DORAZILO (23. 11. 2026). U částečné úhrady je
                  vidět, co už přišlo a co zbývá; u splátek i jednotlivé dny. */}
              {f.uhrazenoMinor > 0 && f.castkaMinor > 0 && (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-1 text-xs font-body text-muted">
                  <span className="tabular-nums">
                    {t('vykazFaktura.uhrazenoZ', {
                      uhrazeno: penize(f.uhrazenoMinor, f.mena),
                      celkem: penize(f.castkaMinor, f.mena),
                    })}
                  </span>
                  {f.castkaMinor > f.uhrazenoMinor && (
                    <span className="tabular-nums text-status-progress">
                      {t('vykazFaktura.zbyva', {
                        castka: penize(f.castkaMinor - f.uhrazenoMinor, f.mena),
                      })}
                    </span>
                  )}
                  {f.uhrady.map((u, i) => (
                    <span key={`${f.id}-${i}`} className="tabular-nums">
                      {formatDatum(jazyk, new Date(u.datum))} · {penize(u.castkaMinor, f.mena)}
                    </span>
                  ))}
                  {f.uhrady.length === 0 && f.uhrazenoAt && (
                    <span>{formatDatum(jazyk, new Date(f.uhrazenoAt))}</span>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
