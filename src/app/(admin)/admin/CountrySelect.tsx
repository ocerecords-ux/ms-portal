'use client';

import { useMemo, useRef, useState } from 'react';
import { COUNTRIES, countryFlag, countryName } from '@/lib/countries';

/**
 * Výběr země s vlaječkami a hledáním (zadani 6. 9. 2026). Ukládá ISO kód.
 */
export function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle),
    );
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
        <div className="absolute z-20 mt-1 w-full bg-white border border-line rounded-lg shadow-lg overflow-hidden">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat zemi…"
            className="w-full border-b border-line px-3 py-2 text-sm font-heading text-ink outline-none"
          />
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
