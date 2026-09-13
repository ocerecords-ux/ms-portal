"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Výběr odběratele na dokladu (zadání 13. 9. 2026: „tady v nabídkách by měla
 * být spíše lupa na vyhledávání, ať tam můžu psát a rychle najít firmu").
 *
 * Firem jsou stovky a v rozbalovacím seznamu se v nich rolovalo donekonečna.
 * Tady se rovnou píše a seznam se filtruje — bez ohledu na diakritiku a
 * velikost písmen, takže „cesky rozhlas" najde „Český rozhlas". Hledá se
 * i podle IČ, protože firmy s podobným názvem se jinak nedají rozeznat.
 *
 * Chová se stejně jako výběr herce u projektu (VyberHerce), jen bez bubliny —
 * na dokladu je odběratel jedno pole formuláře, ne štítek.
 */

export type FirmaVolba = { id: string; name: string; ic?: string | null };

/** Porovnávací tvar - bez diakritiky, malá písmena, bez mezer navíc. */
function zjednodus(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function VyberFirmy({
  firmy,
  hodnota,
  onZmena,
  disabled,
  placeholder = 'Najít odběratele — začněte psát',
}: {
  firmy: FirmaVolba[];
  /** ID vybrané firmy, nebo prázdno. */
  hodnota: string;
  onZmena: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const vybrana = firmy.find((f) => f.id === hodnota) ?? null;
  const [hledani, setHledani] = useState('');
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLDivElement | null>(null);
  const poleRef = useRef<HTMLInputElement | null>(null);

  // Kliknutí mimo nabídku ji zavře - jinak by visela přes pole pod sebou.
  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  const nalezene = useMemo(() => {
    const dotaz = zjednodus(hledani);
    const vse = [...firmy].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    if (!dotaz) return vse.slice(0, 50);
    return vse
      .filter((f) => zjednodus(f.name).includes(dotaz) || (f.ic ?? '').includes(dotaz))
      .slice(0, 50);
  }, [firmy, hledani]);

  const tridaPole =
    'rounded-lg border border-line bg-field pl-9 pr-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:opacity-70';

  return (
    <div ref={obal} className="relative">
      {vybrana && !otevreno ? (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-field px-3 py-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setHledani('');
              setOtevreno(true);
              // Pole se objevi az pri prekresleni, proto az potom.
              setTimeout(() => poleRef.current?.focus(), 0);
            }}
            title="Vybrat jinou firmu"
            className="flex-1 min-w-0 text-left font-heading font-semibold text-sm text-ink truncate disabled:opacity-70"
          >
            {vybrana.name}
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={() => onZmena('')}
              title="Odebrat odběratele"
              aria-label="Odebrat odběratele"
              className="shrink-0 text-muted hover:text-danger text-sm font-heading px-1"
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        <>
          <Lupa />
          <input
            ref={poleRef}
            type="text"
            disabled={disabled}
            value={hledani}
            onChange={(e) => {
              setHledani(e.target.value);
              setOtevreno(true);
            }}
            onFocus={() => setOtevreno(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOtevreno(false);
              // Enter vybere jedinou nalezenou firmu - u presneho nazvu je to
              // rychlejsi nez sahat po mysi.
              if (e.key === 'Enter' && nalezene.length === 1) {
                e.preventDefault();
                onZmena(nalezene[0].id);
                setOtevreno(false);
                setHledani('');
              }
            }}
            placeholder={placeholder}
            className={tridaPole}
          />
        </>
      )}

      {otevreno && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
          {nalezene.length === 0 ? (
            <p className="px-3 py-2.5 text-sm font-body text-muted m-0">
              {firmy.length === 0 ? 'Zatím tu není žádná firma.' : 'Žádná firma tomu neodpovídá.'}
            </p>
          ) : (
            nalezene.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onZmena(f.id);
                  setOtevreno(false);
                  setHledani('');
                }}
                className={`block w-full text-left px-3 py-2 text-sm font-heading hover:bg-tint transition-colors ${
                  f.id === hodnota ? 'text-brand-purple font-semibold' : 'text-ink'
                }`}
              >
                {f.name}
                {f.ic && <span className="ml-2 text-xs font-body text-muted tabular-nums">IČ {f.ic}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Lupa v poli - aby bylo na první pohled vidět, že se sem píše a hledá. */
function Lupa() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
