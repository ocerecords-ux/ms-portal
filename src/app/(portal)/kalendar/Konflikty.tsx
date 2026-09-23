'use client';

import { useEffect, useState } from 'react';

/**
 * ZNAK KONFLIKTŮ V KALENDÁŘI (zadání 23. 9. 2026: „měl by se objevit nějaký
 * znak u kalendářů, na který když kliknu, tak se dozvím, kde je konflikt").
 *
 * Štítek stojí vedle kalendářů a svítí jen tehdy, KDYŽ JE CO ŘEŠIT. Po
 * kliknutí se rozbalí seznam: co s čím se pere, v kolik a který den; klik na
 * řádek skočí v kalendáři na ten den.
 *
 * DVA ODDÍLY: „Moje" jsou dvě věci naráz u mě (casting a schůzka), „Natáčení"
 * je dvakrát obsazené studio nebo herec či zvukař na dvou místech. Natáčení
 * se ukazuje jen tam, KDE JE ČLOVĚK OZNAČENÝ (upřesnění 23. 9. 2026: „mě
 * nezajímají konflikty v natáčení. Jen tam, kde jsem označený").
 *
 * Počítá se to na serveru pro zobrazený rozsah - viz /api/kalendar/konflikty.
 */

type Konflikt = {
  id: string;
  druh: 'MOJE' | 'PROVOZ';
  den: string;
  cas: string;
  duvod: string;
  udalosti: { cas: string; popis: string }[];
};

const BARVA = '#f97316';

export function Konflikty({
  od,
  doKdy,
  naDen,
}: {
  /** Rozsah, který je zrovna v kalendáři vidět (ISO). */
  od: string;
  doKdy: string;
  /** Skok na den konfliktu. */
  naDen: (den: string) => void;
}) {
  const [moje, setMoje] = useState<Konflikt[]>([]);
  const [provoz, setProvoz] = useState<Konflikt[]>([]);
  const [otevreno, setOtevreno] = useState(false);

  useEffect(() => {
    let platne = true;
    fetch(`/api/kalendar/konflikty?od=${encodeURIComponent(od)}&do=${encodeURIComponent(doKdy)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!platne || !d) return;
        setMoje(Array.isArray(d.moje) ? d.moje : []);
        setProvoz(Array.isArray(d.provoz) ? d.provoz : []);
      })
      .catch(() => undefined);
    return () => {
      platne = false;
    };
  }, [od, doKdy]);

  const celkem = moje.length + provoz.length;
  if (celkem === 0) return null;

  const datum = (den: string) => {
    const [y, m, d] = den.split('-').map(Number);
    return new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(
      new Date(Date.UTC(y, m - 1, d, 12)),
    );
  };

  const radky = (seznam: Konflikt[]) =>
    seznam.map((k) => (
      <button
        key={k.id}
        type="button"
        onClick={() => {
          naDen(k.den);
          setOtevreno(false);
        }}
        className="text-left rounded-lg border border-line bg-paper hover:border-brand-purple px-3 py-2 flex flex-col gap-1 w-full"
      >
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-heading font-semibold text-xs text-ink">{datum(k.den)}</span>
          <span className="font-heading text-xs tabular-nums" style={{ color: BARVA }}>
            {k.cas}
          </span>
          <span className="text-xs font-body text-muted">{k.duvod}</span>
        </span>
        {k.udalosti.map((u, i) => (
          <span key={i} className="text-xs font-body text-muted pl-0.5">
            • {u.cas} — {u.popis}
          </span>
        ))}
      </button>
    ));

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        aria-expanded={otevreno}
        title="Kde se dvě věci perou"
        className="inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-heading font-semibold"
        style={{ borderColor: BARVA, backgroundColor: `${BARVA}1f`, color: BARVA }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3.5 22 20H2z" />
          <path d="M12 10v4M12 17.2v.1" />
        </svg>
        Konflikty {celkem}
      </button>

      {otevreno && (
        <span className="absolute left-0 top-full mt-2 z-40 w-[min(92vw,420px)] max-h-[60vh] overflow-y-auto rounded-card border border-line bg-surface shadow-lg p-3 flex flex-col gap-3">
          {moje.length > 0 && (
            <span className="flex flex-col gap-1.5">
              <span className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted">
                Moje ({moje.length}) — vidíte je jen vy
              </span>
              {radky(moje)}
            </span>
          )}
          {provoz.length > 0 && (
            <span className="flex flex-col gap-1.5">
              <span className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted">
                Natáčení ({provoz.length}) — kde jste označený
              </span>
              {radky(provoz)}
            </span>
          )}
          <span className="text-[11px] font-body text-muted">
            Portál nic nezakazuje — jen ukazuje, kde se to pere.
          </span>
        </span>
      )}
    </span>
  );
}
