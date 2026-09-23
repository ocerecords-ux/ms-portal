'use client';

import { useEffect, useState } from 'react';
import { KresbaIkony } from '@/lib/ikonyTypu';

/**
 * OKNO S PŘEHLEDEM DNE (zadání 23. 9. 2026: „ať se mi v portálu otevře
 * průhledné vyskakovací okno a tam to bude" + „celé bych to představoval
 * lépe graficky provedené. Třeba bych použil i ikony u typů události, které
 * už máme").
 *
 * Otevře se samo, jednou za den, po prvním otevření portálu po sedmé ráno -
 * komu je přehled zapnutý v Můj účet. Data skládá server (/api/prehled-dne),
 * tady se z nich kreslí karty: čas, ikona druhu, název, druhý řádek s hercem
 * nebo účastníky a štítek studia.
 *
 * PRŮHLEDNÉ, NE ŠEDIVÉ. Pozadí zůstává vidět a rozostřené: je to zpráva na
 * dobré ráno, ne dialog, který něco blokuje. Zavře ho křížek, Escape, klik
 * mimo i tlačítko - a do dalšího rána se neukáže.
 */

type Druh = 'NATACENI' | 'STRIH' | 'CASTING' | 'PORADA' | 'SCHUZKA' | 'JINE';

type Udalost = {
  cas: string;
  druh: Druh;
  nazev: string;
  detail: string | null;
  studio: string | null;
  rezie: boolean;
};

type Data = { den: string; udalosti: Udalost[]; ukoly: { text: string; cas: string | null }[] };

/** Ikona a barva podle druhu - ikony jsou tytéž jako v kalendáři. */
const PODLE_DRUHU: Record<Druh, { ikona: string; barva: string; popis: string }> = {
  NATACENI: { ikona: 'mikrofon-studio', barva: '#7b55ff', popis: 'Natáčení' },
  STRIH: { ikona: 'strih', barva: '#3B82F6', popis: 'Střih' },
  CASTING: { ikona: 'casting', barva: '#EC4899', popis: 'Casting' },
  PORADA: { ikona: 'lide', barva: '#F2CB35', popis: 'Porada' },
  SCHUZKA: { ikona: 'hodiny', barva: '#14B8A6', popis: 'Schůzka' },
  JINE: { ikona: 'stitek', barva: '#A49FC0', popis: 'Blokace' },
};

const BARVA_REZIE = '#ef4444';

export function PrehledDne() {
  const [data, setData] = useState<Data | null>(null);
  const [zavirame, setZavirame] = useState(false);

  useEffect(() => {
    let platne = true;
    // Až po načtení stránky - ať se dotaz nepere s vykreslením portálu.
    const casovac = setTimeout(() => {
      fetch('/api/prehled-dne')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (platne && d?.ukazat && typeof d.den === 'string') {
            setData({ den: d.den, udalosti: d.udalosti ?? [], ukoly: d.ukoly ?? [] });
          }
        })
        .catch(() => undefined);
    }, 1200);
    return () => {
      platne = false;
      clearTimeout(casovac);
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') zavri();
    };
    window.addEventListener('keydown', naKlavesu);
    return () => window.removeEventListener('keydown', naKlavesu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function zavri() {
    if (zavirame) return;
    setZavirame(true);
    setData(null);
    // Poznámka na server, ať se dneska neotevře znovu. Když se to nepovede,
    // nic se neděje - nanejvýš okno vyskočí na jiné záložce ještě jednou.
    fetch('/api/prehled-dne', { method: 'POST' }).catch(() => undefined);
  }

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/25 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Přehled dne"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) zavri();
      }}
    >
      <div className="w-full max-w-[560px] my-auto rounded-card border border-line bg-surface/85 backdrop-blur-md shadow-lg overflow-hidden">
        {/* Hlavička - den a kolik toho je. */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-line/70">
          <div>
            <p className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted m-0">Přehled dne</p>
            <h2 className="font-display text-2xl sm:text-[28px] text-ink m-0 mt-0.5">{data.den}</h2>
          </div>
          <button
            type="button"
            onClick={zavri}
            aria-label="Zavřít"
            className="text-muted hover:text-ink text-xl leading-none mt-1"
          >
            ×
          </button>
        </div>

        <div className="px-5 sm:px-6 py-4 flex flex-col gap-4">
          {data.udalosti.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">V kalendáři dnes nic vašeho nemám.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.udalosti.map((u, i) => {
                const vzhled = PODLE_DRUHU[u.druh] ?? PODLE_DRUHU.JINE;
                const barva = u.rezie ? BARVA_REZIE : vzhled.barva;
                return (
                  <div
                    key={`${u.cas}-${i}`}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                    style={{ borderColor: `${barva}55`, backgroundColor: `${barva}14` }}
                  >
                    <span
                      className="shrink-0 grid place-items-center w-9 h-9 rounded-pill"
                      style={{ backgroundColor: `${barva}26`, color: barva }}
                      title={u.rezie ? `${vzhled.popis} · režie na dálku` : vzhled.popis}
                    >
                      <KresbaIkony klic={u.rezie ? 'rezie-na-dalku' : vzhled.ikona} velikost={18} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-heading font-semibold text-sm text-ink tabular-nums">{u.cas}</span>
                        <span className="font-heading text-sm text-ink truncate">{u.nazev}</span>
                      </span>
                      {(u.detail || u.rezie) && (
                        <span className="block text-xs font-body text-muted truncate">
                          {u.detail}
                          {u.detail && u.rezie ? ' · ' : ''}
                          {u.rezie ? 'režie na dálku' : ''}
                        </span>
                      )}
                    </span>

                    {u.studio && (
                      <span className="shrink-0 rounded-pill border border-line px-2 py-0.5 text-[11px] font-heading text-muted">
                        {u.studio}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Úkoly jen na dnešek (23. 9. 2026) - dlouhodobé sem nepatří. */}
          {data.ukoly.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted m-0">Úkoly na dnešek</p>
              {data.ukoly.map((u, i) => (
                <div key={`${u.text}-${i}`} className="flex items-center gap-2.5">
                  <span className="shrink-0 w-4 h-4 rounded-[5px] border border-line" aria-hidden />
                  <span className="text-sm font-body text-ink truncate">{u.text}</span>
                  {u.cas && <span className="text-xs font-heading text-muted tabular-nums">{u.cas}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 sm:px-6 pb-5">
          <button
            type="button"
            onClick={zavri}
            className="rounded-pill bg-brand-purple text-white font-heading text-sm px-5 py-2"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
