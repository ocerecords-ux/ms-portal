"use client";

import { useJazyk, usePrepnoutJazyk } from './JazykProvider';
import { JAZYKY, NAZVY_JAZYKU, ZKRATKY_JAZYKU } from '@/lib/jazyk';

/**
 * Přepínač jazyka v horní liště (zadání 13. 9. 2026: „přidej celkově na
 * portálu přepnutí jazyka do britské angličtiny").
 *
 * Dvě zkratky vedle sebe místo rozbalovacího seznamu - jazyky jsou dva a
 * v liště je málo místa. Volba se pamatuje v prohlížeči a platí rok.
 */
export function PrepinacJazyka() {
  const jazyk = useJazyk();
  const prepnout = usePrepnoutJazyk();

  return (
    <span
      className="inline-flex items-center rounded-pill border border-white/25 overflow-hidden shrink-0"
      role="group"
      aria-label="Jazyk / Language"
    >
      {JAZYKY.map((j) => (
        <button
          key={j}
          type="button"
          onClick={() => prepnout(j)}
          title={NAZVY_JAZYKU[j]}
          aria-pressed={j === jazyk}
          className={`px-2 py-0.5 text-[11px] font-heading font-bold tracking-wide transition-colors ${
            j === jazyk ? 'bg-brand-green text-onAccent' : 'text-white/75 hover:text-white'
          }`}
        >
          {ZKRATKY_JAZYKU[j]}
        </button>
      ))}
    </span>
  );
}
