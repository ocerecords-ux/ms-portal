'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePreklad } from '../components/JazykProvider';
import type { TerminKlienta } from '@/lib/terminyKlientaServer';

/**
 * NATÁČECÍ PLÁN V PŘEHLEDU KLIENTA (zadání 30. 9. 2026: „potřebuji udělat,
 * aby klienti viděli všechny natáčecí frekvence s hercem" + upřesnění: „mohl
 * by tam být atribut Natáčecí plán a tam Zobrazit termíny s šipkou dolů
 * a pod řádkem projektu by se rozbalila karta a tam to bude").
 *
 * KARTA SE OTEVÍRÁ POD ŘÁDKEM, ne v okně uprostřed obrazovky - klient se dívá
 * na svoji zakázku a termíny má číst u ní. Kreslí se napevno usazená
 * (`position: fixed`) pod tlačítkem, protože rozbalit další řádek uvnitř
 * tabulky by rozhodilo šířky sloupců, které jsou po celém přehledu společné.
 *
 * Zavírá se Escapem, klepnutím mimo i posunem stránky - stejně jako ostatní
 * vyskakovací okna v portálu (výběr herců, dokumenty u licence).
 */

const SIRKA = 340;

export function TerminyKlienta({ terminy }: { terminy: TerminKlienta[] }) {
  const t = usePreklad();
  const [kotva, setKotva] = useState<{ left: number; top: number } | null>(null);
  const oknoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!kotva || !oknoRef.current) return;
    const r = oknoRef.current.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      const novyVrsek = Math.max(8, window.innerHeight - r.height - 8);
      if (Math.abs(novyVrsek - kotva.top) > 1) setKotva({ ...kotva, top: novyVrsek });
    }
  }, [kotva]);

  useEffect(() => {
    if (!kotva) return;
    const zavri = (e?: Event) => {
      const cil = e?.target;
      if (cil instanceof Node && oknoRef.current?.contains(cil)) return;
      setKotva(null);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKotva(null);
    };
    const mimo = (e: MouseEvent) => {
      if (oknoRef.current && !oknoRef.current.contains(e.target as Node)) setKotva(null);
    };
    window.addEventListener('keydown', klavesa);
    window.addEventListener('scroll', zavri, true);
    window.addEventListener('resize', zavri);
    const id = window.setTimeout(() => document.addEventListener('mousedown', mimo), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', klavesa);
      window.removeEventListener('scroll', zavri, true);
      window.removeEventListener('resize', zavri);
      document.removeEventListener('mousedown', mimo);
    };
  }, [kotva]);

  if (terminy.length === 0) {
    return <span className="text-muted text-sm">—</span>;
  }

  const pristi = terminy.find((x) => !x.odtoceno) ?? null;
  /**
   * KOLIK UŽ SE USKUTEČNILO (30. 9. 2026: „u těch přehledů termínů
   * v natáčecím plánu by bylo dobré nějak vidět, které frekvence se už
   * uskutečnily"). V seznamu je to u každého řádku, tohle je ta odpověď
   * na jeden pohled - i na tlačítku, aby se kvůli ní nemuselo rozbalovat.
   */
  const odtoceno = terminy.filter((x) => x.odtoceno).length;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (kotva) {
            setKotva(null);
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          setKotva({
            left: Math.min(r.left, window.innerWidth - SIRKA - 8),
            top: r.bottom + 6,
          });
        }}
        aria-expanded={Boolean(kotva)}
        title={t('terminy.napoveda')}
        className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-2.5 py-1 text-xs font-heading text-ink cursor-pointer hover:text-brand-purple hover:border-brand-purple transition-colors whitespace-nowrap"
      >
        {t('terminy.zobrazit')}
        <span className="tabular-nums text-muted">
          {odtoceno > 0 ? `${odtoceno}/${terminy.length}` : terminy.length}
        </span>
        <span aria-hidden className={`text-[9px] transition-transform ${kotva ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {kotva && (
        <div
          ref={oknoRef}
          style={{ position: 'fixed', left: kotva.left, top: kotva.top, width: SIRKA }}
          className="z-[90] flex flex-col gap-2 rounded-card border border-line bg-surface shadow-2xl p-3"
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
              {t('terminy.nadpis')}
            </span>
            <span className="text-[11px] font-body text-muted">
              {odtoceno === terminy.length
                ? t('terminy.vseOdtoceno')
                : t('terminy.souhrn', { odtoceno, celkem: terminy.length })}
            </span>
          </div>

          <ul className="list-none p-0 m-0 flex flex-col gap-1 max-h-[320px] overflow-y-auto">
            {terminy.map((x) => (
              <li
                key={x.id}
                className={`flex items-baseline gap-2 flex-wrap rounded-lg px-2 py-1.5 ${
                  x.odtoceno ? 'text-muted' : 'bg-field/50 text-ink'
                } ${pristi && x.id === pristi.id ? 'border border-brand-purple/40' : ''}`}
              >
                <span className="font-heading text-sm tabular-nums whitespace-nowrap">
                  {kdy(x.start, x.end)}
                </span>
                {x.herec && <span className="text-xs font-body">{x.herec}</span>}
                <span className="ml-auto text-[11px] font-body text-muted">{x.studio}</span>
                {x.odtoceno ? (
                  <span
                    title={t('terminy.odtoceno')}
                    className="shrink-0 text-[11px] font-heading text-status-done"
                  >
                    ✓ {t('terminy.odtoceno')}
                  </span>
                ) : (
                  pristi &&
                  x.id === pristi.id && (
                    <span className="shrink-0 text-[11px] font-heading text-brand-purple">
                      {t('terminy.nejblizsi')}
                    </span>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** „út 7. 10. · 10:00–13:00" - v pásmu toho, kdo se dívá. */
function kdy(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const den = new Intl.DateTimeFormat('cs-CZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(s);
  const cas = (d: Date) =>
    new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${den} · ${cas(s)}–${cas(e)}`;
}
