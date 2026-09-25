'use client';

import { useState } from 'react';
import { DatumPole } from '@/components/DatumPole';

/**
 * ÚPRAVA VLASTNÍHO ÚKOLU (zadání 25. 9. 2026: „nemůžu upravovat své úkoly,
 * chci je editovat").
 *
 * Do teď šel vlastní úkol jen odškrtnout nebo smazat - překlep v názvu nebo
 * posunutý termín znamenaly napsat ho znovu. Server to uměl od začátku
 * (PATCH /api/tasks/[id] bere title, dueDate i dueTime), chybělo jen kde to
 * naťukat.
 *
 * Stejný formulář je v panelu Úkoly na pravé hraně i v záložce Úkoly v chatu,
 * aby se úkol upravoval všude stejně. Zadané úkoly (ty, které jsem dal někomu
 * jinému) mají vlastní podobu v ZadaneUkoly.tsx - tam se navíc píše, komu
 * úkol patří, a místo mazání se úkol ruší.
 */
const pole =
  'rounded-lg border border-line bg-field px-2 py-1.5 text-xs font-body text-ink outline-none focus:border-brand-purple';

export type MujUkolKUprave = {
  id: string;
  title: string;
  dueDate: string | null;
  dueTime?: string | null;
};

export function UpravaMehoUkolu({
  ukol,
  onKonec,
}: {
  ukol: MujUkolKUprave;
  /** `zmeneno` = seznam je potřeba načíst znovu. */
  onKonec: (zmeneno: boolean) => void;
}) {
  const [nazev, setNazev] = useState(ukol.title);
  const [den, setDen] = useState(ukol.dueDate ?? '');
  const [cas, setCas] = useState(ukol.dueTime ?? '');
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [potvrditSmazani, setPotvrditSmazani] = useState(false);

  async function posli(metoda: 'PATCH' | 'DELETE') {
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/tasks/${ukol.id}`, {
        method: metoda,
        headers: metoda === 'PATCH' ? { 'Content-Type': 'application/json' } : undefined,
        body:
          metoda === 'PATCH'
            ? JSON.stringify({
                title: nazev.trim(),
                dueDate: den || null,
                // Čas bez data nedává smysl - server si ho stejně zahodí.
                dueTime: den && cas ? cas : null,
              })
            : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || 'Nepodařilo se uložit.');
        return;
      }
      onKonec(true);
    } catch {
      setChyba('Nepodařilo se uložit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (nazev.trim()) void posli('PATCH');
      }}
      // Escape zavře úpravu - ruka zůstane na klávesnici.
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onKonec(false);
        }
      }}
      className="flex flex-col gap-1.5 rounded-lg border border-brand-purple/40 bg-tint/40 p-2 my-1"
    >
      <input
        autoFocus
        value={nazev}
        onChange={(e) => setNazev(e.target.value)}
        className={`${pole} text-sm`}
        aria-label="Název úkolu"
      />
      <div className="flex items-center gap-1.5">
        <DatumPole
          value={den}
          onChange={(e) => setDen(e.target.value)}
          className={`${pole} flex-1 min-w-0`}
          aria-label="Termín"
        />
        <input
          type="time"
          value={cas}
          onChange={(e) => setCas(e.target.value)}
          disabled={!den}
          title={den ? 'Do kolika hodin (nepovinné)' : 'Nejdřív vyberte datum'}
          className={`${pole} w-[92px] disabled:opacity-40`}
          aria-label="Čas"
        />
      </div>
      {chyba && <span className="text-[11px] font-body text-danger">{chyba}</span>}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="submit"
          disabled={busy || !nazev.trim()}
          className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          Uložit
        </button>
        <button
          type="button"
          onClick={() => onKonec(false)}
          className="text-xs font-heading text-muted hover:text-ink px-1"
        >
          Zpět
        </button>
        <span className="flex-1" />
        {/* Mazání až na druhé klepnutí - úkol se vrátit nedá. */}
        <button
          type="button"
          disabled={busy}
          onClick={() => (potvrditSmazani ? void posli('DELETE') : setPotvrditSmazani(true))}
          onBlur={() => setPotvrditSmazani(false)}
          className="text-xs font-heading font-semibold text-danger hover:underline px-1"
        >
          {potvrditSmazani ? 'Opravdu smazat?' : 'Smazat úkol'}
        </button>
      </div>
    </form>
  );
}
