'use client';

import { useEffect, useState } from 'react';

/**
 * HISTORIE KALENDÁŘE (zadání 23. 9. 2026: „ještě by to chtělo někam dát
 * historii, kdo kdy upravil nějakou věc v kalendáři").
 *
 * Štítek vedle kalendářů; po kliknutí se rozbalí posledních osmdesát změn -
 * co, kdy se to týkalo, kdo a kdy to udělal. Klik na řádek skočí v kalendáři
 * na den té události.
 *
 * Načítá se AŽ PŘI OTEVŘENÍ. Historie je věc, do které se člověk podívá
 * jednou za čas; tahat ji ke každému zobrazení kalendáře by bylo zbytečné.
 */

type Radek = {
  id: string;
  typ: string;
  akce: string;
  nazev: string;
  den: string | null;
  kdy: string | null;
  podrobnosti: string | null;
  kdo: string;
  kdyZmena: string;
};

const POPIS_AKCE: Record<string, { text: string; barva: string }> = {
  VZNIK: { text: 'zapsal(a)', barva: '#22c55e' },
  UPRAVA: { text: 'upravil(a)', barva: '#f2cb35' },
  ZRUSENI: { text: 'zrušil(a)', barva: '#ef4444' },
};

const POPIS_TYPU: Record<string, string> = {
  SLOT: 'Natáčení',
  BLOK: 'Událost',
  PORADA: 'Porada',
  SCHUZKA: 'Schůzka',
  MIMO: 'Mimo studio',
};

export function HistorieKalendare({ naDen }: { naDen: (den: string) => void }) {
  const [otevreno, setOtevreno] = useState(false);
  const [radky, setRadky] = useState<Radek[] | null>(null);

  useEffect(() => {
    if (!otevreno || radky) return;
    let platne = true;
    fetch('/api/kalendar/historie')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (platne) setRadky(Array.isArray(d?.radky) ? d.radky : []);
      })
      .catch(() => platne && setRadky([]));
    return () => {
      platne = false;
    };
  }, [otevreno, radky]);

  const kdyText = (iso: string) => {
    const d = new Date(iso);
    const dnes = new Date();
    const stejnyDen = d.toDateString() === dnes.toDateString();
    return new Intl.DateTimeFormat('cs-CZ', {
      timeZone: 'Europe/Prague',
      ...(stejnyDen ? {} : { day: 'numeric', month: 'numeric' }),
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  return (
    <span className="relative inline-flex shrink-0">
      {/* Jen ikona hodin se šipkou zpět (zadání 23. 9. 2026: „dej tam jen
          ikony") - u nadpisu Kalendář, vedle konfliktů. */}
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        aria-expanded={otevreno}
        aria-label="Historie kalendáře"
        title="Kdo kdy co v kalendáři změnil"
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-line transition-colors ${
          otevreno ? 'text-ink border-brand-purple' : 'text-muted hover:text-ink hover:border-brand-purple'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
          <path d="M3 3.5v4h4" />
          <path d="M12 7.5V12l3 1.8" />
        </svg>
      </button>

      {otevreno && (
        <span className="absolute left-0 top-full mt-2 z-40 w-[min(92vw,460px)] max-h-[60vh] overflow-y-auto rounded-card border border-line bg-surface shadow-lg p-3 flex flex-col gap-1.5">
          {radky === null && <span className="text-xs font-body text-muted px-1 py-2">Načítám…</span>}
          {radky !== null && radky.length === 0 && (
            <span className="text-xs font-body text-muted px-1 py-2">Zatím tu nic není.</span>
          )}
          {(radky ?? []).map((r) => {
            const akce = POPIS_AKCE[r.akce] ?? { text: r.akce, barva: '#A49FC0' };
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  if (r.den) naDen(r.den);
                  setOtevreno(false);
                }}
                className="text-left rounded-lg border border-line bg-paper hover:border-brand-purple px-3 py-2 flex flex-col gap-0.5 w-full"
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: akce.barva }}
                    aria-hidden
                  />
                  <span className="font-heading font-semibold text-xs text-ink">{r.kdo}</span>
                  <span className="text-xs font-body text-muted">{akce.text}</span>
                  <span className="text-xs font-body text-muted">{POPIS_TYPU[r.typ] ?? r.typ}</span>
                  <span className="text-[11px] font-heading text-muted ml-auto tabular-nums">{kdyText(r.kdyZmena)}</span>
                </span>
                <span className="text-sm font-body text-ink truncate">{r.nazev}</span>
                {(r.kdy || r.podrobnosti) && (
                  <span className="text-xs font-body text-muted">
                    {[r.kdy, r.podrobnosti].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}
