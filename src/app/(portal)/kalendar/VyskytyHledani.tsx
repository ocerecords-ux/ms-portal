'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * SEZNAM VÝSKYTŮ (zadání 20. 9. 2026: „ještě bychom mohli udělat v tom
 * kalendáři sofistikovanější hledání… aby našel všechny události podle
 * projektu, herce, zvukaře a ukázal jejich seznam. Seznam výskytů").
 *
 * Políčko nad kalendářem do teď jen protřídilo zobrazený týden. Teď se ptá
 * serveru na CELÝ kalendář: vypíše se, kolikrát se projekt, herec nebo
 * zvukař v kalendáři objevuje, od nejnovějšího, a kliknutím na řádek se
 * kalendář přesune na ten den.
 *
 * Panel visí pod hledáním a zavře se křížkem, klávesou Esc nebo smazáním
 * dotazu - kalendář pod ním zůstává, jak byl.
 */
export type Vyskyt = {
  id: string;
  kind: 'SLOT' | 'BLOCK';
  start: string;
  end: string;
  den: string;
  studioId: string;
  studioName: string;
  color: string;
  druh: string;
  projectName: string | null;
  actorName: string | null;
  zvukarName: string | null;
  proc: string[];
};

const PRAHA = 'Europe/Prague';

function denText(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PRAHA,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function cas(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PRAHA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function VyskytyHledani({
  dotaz,
  onSkoc,
  onZavri,
}: {
  dotaz: string;
  /** Skok na den výskytu (a na jeho studio, kdyby bylo vypnuté). */
  onSkoc: (den: string, studioId: string) => void;
  onZavri: () => void;
}) {
  const [vyskyty, setVyskyty] = useState<Vyskyt[] | null>(null);
  const [celkem, setCelkem] = useState(0);
  const [bezi, setBezi] = useState(false);

  useEffect(() => {
    const q = dotaz.trim();
    if (q.length < 2) {
      setVyskyty(null);
      return;
    }
    // Psani je rychlejsi nez sit - dotaz se posila az po kratke odmlce.
    let zrusen = false;
    const odklad = window.setTimeout(async () => {
      setBezi(true);
      try {
        const res = await fetch(`/api/kalendar/hledani?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        if (zrusen) return;
        setVyskyty(res.ok ? (data.vyskyty ?? []) : []);
        setCelkem(res.ok ? (data.celkem ?? 0) : 0);
      } finally {
        if (!zrusen) setBezi(false);
      }
    }, 300);
    return () => {
      zrusen = true;
      window.clearTimeout(odklad);
    };
  }, [dotaz]);

  useEffect(() => {
    function naKlavesu(e: KeyboardEvent) {
      if (e.key === 'Escape') onZavri();
    }
    document.addEventListener('keydown', naKlavesu);
    return () => document.removeEventListener('keydown', naKlavesu);
  }, [onZavri]);

  /** Kolikrát se kdo objevil - rychlý přehled nad seznamem. */
  const souhrn = useMemo(() => {
    if (!vyskyty) return [] as { popis: string; pocet: number }[];
    const mapa = new Map<string, number>();
    for (const v of vyskyty) {
      for (const klic of [v.projectName, v.actorName, v.zvukarName]) {
        if (!klic) continue;
        if (!klic.toLowerCase().includes(dotaz.trim().toLowerCase())) continue;
        mapa.set(klic, (mapa.get(klic) ?? 0) + 1);
      }
    }
    return [...mapa.entries()]
      .map(([popis, pocet]) => ({ popis, pocet }))
      .sort((a, b) => b.pocet - a.pocet)
      .slice(0, 6);
  }, [vyskyty, dotaz]);

  if (dotaz.trim().length < 2) return null;

  return (
    <section className="bg-surface rounded-card border border-line shadow-sm p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="font-heading font-semibold text-ink m-0">
          {bezi && !vyskyty
            ? 'Hledám v celém kalendáři…'
            : `Výskyty v kalendáři: ${celkem}${celkem > (vyskyty?.length ?? 0) ? ` (ukazuju ${vyskyty?.length})` : ''}`}
        </p>
        <span className="text-sm font-body text-muted">„{dotaz.trim()}"</span>
        <button
          type="button"
          onClick={onZavri}
          className="ml-auto text-xs font-heading text-muted underline hover:text-ink"
        >
          Zavřít seznam
        </button>
      </div>

      {souhrn.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {souhrn.map((s) => (
            <span
              key={s.popis}
              className="inline-flex items-center gap-2 rounded-pill border border-line px-3 py-1 text-xs font-heading text-ink"
            >
              {s.popis}
              <span className="tabular-nums text-muted">{s.pocet}×</span>
            </span>
          ))}
        </div>
      )}

      {vyskyty && vyskyty.length === 0 && !bezi && (
        <p className="text-sm font-body text-muted m-0">
          Nic takového v kalendáři není. Zkuste jen příjmení nebo část názvu projektu.
        </p>
      )}

      {vyskyty && vyskyty.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-1 max-h-[46vh] overflow-y-auto">
          {vyskyty.map((v) => (
            <li key={`${v.kind}-${v.id}`}>
              <button
                type="button"
                onClick={() => onSkoc(v.den, v.studioId)}
                title="Otevřít ten den v kalendáři"
                className="w-full text-left rounded-lg border border-line hover:border-brand-purple px-3 py-2 flex items-center gap-3 flex-wrap"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: v.color }} />
                <span className="font-heading font-semibold text-ink text-sm min-w-[150px] tabular-nums">
                  {denText(v.start)}
                </span>
                <span className="font-body text-sm text-muted tabular-nums min-w-[100px]">
                  {cas(v.start)}–{cas(v.end)}
                </span>
                <span className="font-heading text-sm text-ink mr-auto">
                  {v.projectName ?? v.druh}
                  {v.actorName ? ` — ${v.actorName}` : ''}
                </span>
                <span className="text-xs font-body text-muted">
                  {[v.druh, v.studioName, v.zvukarName ? `zvukař ${v.zvukarName}` : null].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
