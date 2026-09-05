'use client';

import { useMemo, useRef, useState } from 'react';

export type NarratorOption = { id: string; label: string };

/**
 * Vyber preferovaneho herce/hercu do objednavky (zadani 12. 9. 2026): misto
 * jednoho volneho textoveho pole jde vybrat vice hercu z databaze (s
 * vyhledavanim), nebo pripsat vlastni jmeno, ktere v databazi neni. Vysledek
 * se posila jako jeden string oddeleny carkami (preferredNarrator na
 * Order zustava beze zmeny schematu - je to porad jen "preni klienta").
 */
export function NarratorMultiSelect({
  options,
  value,
  onChange,
}: {
  options: NarratorOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedSelected = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !normalizedSelected.has(o.label.toLowerCase()))
      .filter((o) => (q ? o.label.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [options, query, normalizedSelected]);

  const exactMatch = options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());
  const canAddFreeText = query.trim().length > 0 && !exactMatch && !normalizedSelected.has(query.trim().toLowerCase());

  function addValue(label: string) {
    const trimmed = label.trim();
    if (!trimmed || normalizedSelected.has(trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeValue(label: string) {
    onChange(value.filter((v) => v !== label));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[0]) addValue(suggestions[0].label);
      else if (canAddFreeText) addValue(query);
    } else if (e.key === 'Backspace' && query === '' && value.length > 0) {
      removeValue(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex items-center gap-1.5 flex-wrap border-[1.5px] border-brand-green rounded-lg bg-white px-2 py-1.5 min-h-[42px] cursor-text"
      >
        {value.map((label) => (
          <span
            key={label}
            className="flex items-center gap-1 bg-brand-purple/10 text-brand-purpleDeep text-xs font-heading font-medium rounded-md pl-2 pr-1 py-1"
          >
            {label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeValue(label);
              }}
              className="text-brand-purpleDeep/60 hover:text-brand-purpleDeep leading-none px-0.5"
              aria-label={`Odebrat ${label}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={value.length ? '' : 'Hledat herce, nebo napsat vlastní jméno…'}
          className="flex-1 min-w-[140px] border-0 outline-none text-[14.5px] font-body text-ink py-1"
        />
      </div>

      {open && (suggestions.length > 0 || canAddFreeText) && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg py-1 z-20 max-h-56 overflow-auto">
          {suggestions.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addValue(o.label)}
              className="w-full text-left px-3 py-2 text-sm font-body text-ink hover:bg-field"
            >
              {o.label}
            </button>
          ))}
          {canAddFreeText && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addValue(query)}
              className="w-full text-left px-3 py-2 text-sm font-body text-brand-purpleDeep hover:bg-field"
            >
              + Přidat „{query.trim()}“
            </button>
          )}
        </div>
      )}
    </div>
  );
}
