'use client';

import { useState } from 'react';
import { barvaStavu } from '@/lib/stavyProjektu';

/**
 * POŘADÍ STAVŮ V PŘEHLEDU (zadání 24. 9. 2026: „potřebuju, abych si mohl
 * uspořádat projekty v přehledu podle stavu, ale abychom mohli ovlivnit
 * pořadí, jaký stav bude na jakém místě").
 *
 * Panel se otevře z lišty nad tabulkou a stavy se v něm přetahují - první
 * v seznamu bude v tabulce nahoře. Platí to pro celý tým (přehled je společná
 * tabulka), takže přerovnat ho smí Žůžo-labůžo a produkce; ostatní ho vidí
 * jen ke čtení.
 *
 * MĚNÍ SE JEN ŘAZENÍ TABULKY. Nabídka stavů u projektu ani cesta projektu se
 * tím nehýbe - viz lib/poradiStavuServer.ts.
 */
export function PoradiStavu({
  poradi,
  onZmena,
  muzeMenit,
}: {
  poradi: string[];
  /** Nové pořadí - přehled se podle něj hned přeřadí. */
  onZmena: (nove: string[]) => void;
  muzeMenit: boolean;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const [draft, setDraft] = useState<string[]>(poradi);
  const [taheny, setTaheny] = useState<number | null>(null);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  function otevri() {
    setDraft(poradi);
    setChyba(null);
    setOtevreno(true);
  }

  function presun(na: number) {
    setDraft((seznam) => {
      if (taheny === null || taheny === na) return seznam;
      const kopie = [...seznam];
      const [prvek] = kopie.splice(taheny, 1);
      kopie.splice(na, 0, prvek);
      return kopie;
    });
    setTaheny(null);
  }

  /** Šipky vedle řádku - přetahování na telefonu nefunguje. */
  function posun(index: number, smer: -1 | 1) {
    setDraft((seznam) => {
      const cil = index + smer;
      if (cil < 0 || cil >= seznam.length) return seznam;
      const kopie = [...seznam];
      [kopie[index], kopie[cil]] = [kopie[cil], kopie[index]];
      return kopie;
    });
  }

  async function uloz() {
    setUklada(true);
    setChyba(null);
    try {
      const odpoved = await fetch('/api/projekty/poradi-stavu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazvy: draft }),
      });
      const data = await odpoved.json().catch(() => null);
      if (!odpoved.ok) throw new Error(data?.error || 'Uložení se nezdařilo.');
      onZmena(Array.isArray(data?.poradi) ? data.poradi : draft);
      setOtevreno(false);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
    } finally {
      setUklada(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => (otevreno ? setOtevreno(false) : otevri())}
        title="V jakém pořadí se mají stavy řadit v tabulce"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-heading text-muted hover:text-ink hover:border-brand-purple transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M4 7h10M4 12h7M4 17h4" />
          <path d="M17 5v14M17 19l-2.5-2.5M17 19l2.5-2.5" />
        </svg>
        Pořadí stavů
      </button>

      {otevreno && (
        <span className="absolute left-0 top-full mt-2 z-40 w-[min(92vw,340px)] max-h-[70vh] overflow-y-auto rounded-card border border-line bg-surface shadow-lg p-3 flex flex-col gap-2">
          <span className="text-[11px] font-body text-muted">
            {muzeMenit
              ? 'Přetažením (nebo šipkami) nastavíte, v jakém pořadí se stavy řadí v tabulce. Platí pro celý tým.'
              : 'V tomhle pořadí se stavy řadí v tabulce. Měnit ho smí Žůžo-labůžo a produkce.'}
          </span>

          {draft.map((nazev, i) => (
            <span
              key={nazev}
              draggable={muzeMenit}
              onDragStart={() => setTaheny(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => presun(i)}
              onDragEnd={() => setTaheny(null)}
              className={`flex items-center gap-2 rounded-lg border border-line bg-paper px-2 py-1.5 ${
                muzeMenit ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              <span className="text-[11px] font-heading text-muted tabular-nums w-4 text-right">
                {i + 1}.
              </span>
              <span
                className={`min-w-0 truncate rounded-pill px-2.5 py-1 text-xs font-heading font-semibold ${barvaStavu(nazev)}`}
              >
                {nazev}
              </span>
              {muzeMenit && (
                <span className="ml-auto inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => posun(i, -1)}
                    disabled={i === 0}
                    aria-label={`Posunout ${nazev} výš`}
                    className="w-6 h-6 rounded text-muted hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => posun(i, 1)}
                    disabled={i === draft.length - 1}
                    aria-label={`Posunout ${nazev} níž`}
                    className="w-6 h-6 rounded text-muted hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                </span>
              )}
            </span>
          ))}

          {chyba && <span className="text-xs font-body text-danger">{chyba}</span>}

          {muzeMenit && (
            <span className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => void uloz()}
                disabled={uklada}
                className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-4 py-1.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                {uklada ? 'Ukládám…' : 'Uložit pořadí'}
              </button>
              <button
                type="button"
                onClick={() => setOtevreno(false)}
                className="text-xs font-heading text-muted hover:text-ink"
              >
                Zrušit
              </button>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
