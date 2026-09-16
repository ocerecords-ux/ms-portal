'use client';

import { useMemo, useRef, useState } from 'react';
import { bezDiakritiky, COUNTRIES, countryFlag, countryName } from '@/lib/countries';

/**
 * Výběr země s vlaječkami a hledáním (zadání 6. 9. 2026). Ukládá ISO kód.
 *
 * HLEDÁ SE BEZ OHLEDU NA HÁČKY A ČÁRKY (doplněno 16. 9. 2026: „ať mi to hledá
 * rovnou pod lupou zemi s vlaječkou"): kdo napíše „svycarsko" nebo „nemecko",
 * musí zemi najít stejně jako ten, kdo píše s diakritikou. Hledá se i podle
 * kódu, takže „CZ" nebo „SK" funguje taky.
 *
 * Enter vybere první zemi v seznamu - psaní „slov" a Enter je rychlejší než
 * hledat myší.
 */
export function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const needle = bezDiakritiky(query);
    if (!needle) return COUNTRIES;
    const shoda = COUNTRIES.filter(
      (c) => bezDiakritiky(c.name).includes(needle) || c.code.toLowerCase().includes(needle),
    );
    // Co začíná na hledané, patří nahoru: „ma" má napřed Maďarsko, ne Rumunsko.
    return [...shoda].sort((a, b) => {
      const za = bezDiakritiky(a.name).startsWith(needle) || a.code.toLowerCase().startsWith(needle);
      const zb = bezDiakritiky(b.name).startsWith(needle) || b.code.toLowerCase().startsWith(needle);
      return za === zb ? 0 : za ? -1 : 1;
    });
  }, [query]);

  return (
    <div
      ref={boxRef}
      className="relative"
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery('');
        }}
        className="admin-input text-left flex items-center gap-2"
      >
        <span aria-hidden="true">{countryFlag(value)}</span>
        <span className="flex-1 truncate">{countryName(value) || 'Vyberte zemi'}</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0 text-muted">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-line rounded-lg shadow-lg overflow-hidden">
          <div className="relative border-b border-line">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L18 18" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const prvni = filtered[0];
                  if (prvni) {
                    onChange(prvni.code);
                    setOpen(false);
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder="Hledat zemi…"
              className="w-full pl-9 pr-3 py-2 text-sm font-heading text-ink bg-transparent outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted font-body m-0">Nic neodpovídá.</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm font-heading flex items-center gap-2 hover:bg-field ${
                  c.code === value ? 'text-brand-purple' : 'text-ink'
                }`}
              >
                <span aria-hidden="true">{countryFlag(c.code)}</span>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
