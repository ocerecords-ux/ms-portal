'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Rozbalovací pole, které se dá HLEDAT PSANÍM (zadání 15. 9. 2026: „všechna
 * pole prosím vyhledávací s lupou. Pojďme to tak nastavit na celém portálu
 * u polí, kde bude více jak pět položek").
 *
 * Krátký seznam zůstává obyčejným <select>: u tří možností je pole s lupou
 * jen práce navíc. Od šesti výš se místo něj ukáže políčko s lupou a nabídka
 * se pod ním zužuje podle toho, co se píše.
 *
 * Hledá se BEZ OHLEDU NA DIAKRITIKU a po slovech nezávisle na pořadí -
 * „audioteka cerny" najde „Audiotéka — Černý" i „Černý (Audiotéka)".
 *
 * Vzniklo to zobecněním výběru projektu (components/VyberProjektu.tsx), který
 * tohle uměl od 11. 9. 2026 jen pro projekty a herce.
 */

export type MoznostVyberu = {
  hodnota: string;
  popisek: string;
  /** Doplňkový text pod popiskem - třeba IČO nebo firma. */
  poznamka?: string;
  /** Řadí se až za ostatní a je šedivější (dokončené projekty apod.). */
  slabsi?: boolean;
};

/** Od kolika položek se místo seznamu ukáže pole s lupou. */
export const PRAH_LUPY = 5;

/** Porovnávací tvar - bez diakritiky, malými písmeny. */
function zjednodus(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function sedi(m: MoznostVyberu, hledani: string): boolean {
  if (!hledani) return true;
  const seno = zjednodus(`${m.popisek} ${m.poznamka ?? ''} ${m.hodnota}`);
  return zjednodus(hledani)
    .split(/\s+/)
    .filter(Boolean)
    .every((slovo) => seno.includes(slovo));
}

/** Kolik položek se najednou vykreslí. Víc než tohle stejně nikdo nepřečte. */
const STROP = 60;

export function VyberSLupou({
  moznosti,
  hodnota,
  onZmena,
  prazdnyPopisek,
  placeholder = 'Začněte psát…',
  prazdnyText = 'Nic takového jsme nenašli.',
  disabled,
  className,
  required,
  id,
}: {
  moznosti: MoznostVyberu[];
  hodnota: string;
  onZmena: (hodnota: string) => void;
  /** Text prázdné volby („— bez projektu —"). Bez něj je výběr povinný. */
  prazdnyPopisek?: string;
  placeholder?: string;
  prazdnyText?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  id?: string;
}) {
  const [hledani, setHledani] = useState('');
  const [otevreno, setOtevreno] = useState(false);
  const [zvyrazneny, setZvyrazneny] = useState(0);
  const obal = useRef<HTMLDivElement>(null);
  const poleRef = useRef<HTMLInputElement>(null);
  const praveVybrano = useRef(false);

  const vybrana = moznosti.find((m) => m.hodnota === hodnota) ?? null;

  const nalezene = useMemo(() => {
    const shody = moznosti.filter((m) => sedi(m, hledani.trim()));
    return [...shody].sort((a, b) => Number(a.slabsi ?? false) - Number(b.slabsi ?? false));
  }, [moznosti, hledani]);

  const viditelne = nalezene.slice(0, STROP);

  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  useEffect(() => {
    setZvyrazneny(0);
  }, [hledani, otevreno]);

  // KRÁTKÝ SEZNAM ZŮSTÁVÁ SEZNAMEM (zadání: „kde bude více jak pět položek").
  if (moznosti.length <= PRAH_LUPY) {
    return (
      <select
        id={id}
        value={hodnota}
        onChange={(e) => onZmena(e.target.value)}
        disabled={disabled}
        required={required}
        className={className}
      >
        {prazdnyPopisek !== undefined && <option value="">{prazdnyPopisek}</option>}
        {moznosti.map((m) => (
          <option key={m.hodnota} value={m.hodnota}>
            {m.popisek}
            {m.poznamka ? ` · ${m.poznamka}` : ''}
          </option>
        ))}
      </select>
    );
  }

  function vyber(cil: string) {
    praveVybrano.current = true;
    setTimeout(() => {
      praveVybrano.current = false;
    }, 0);
    onZmena(cil);
    setHledani('');
    setOtevreno(false);
    poleRef.current?.blur();
  }

  const trida = className
    ? `${className} pl-9 pr-9`
    : 'w-full rounded-lg border border-line bg-field pl-9 pr-9 py-2 text-ink font-heading text-sm outline-none';

  return (
    <div ref={obal} className="relative">
      <input
        id={id}
        ref={poleRef}
        type="text"
        role="combobox"
        aria-expanded={otevreno}
        aria-autocomplete="list"
        disabled={disabled}
        value={otevreno ? hledani : (vybrana?.popisek ?? '')}
        placeholder={vybrana ? vybrana.popisek : placeholder}
        onFocus={() => {
          if (praveVybrano.current) return;
          setHledani('');
          setOtevreno(true);
        }}
        onChange={(e) => {
          setHledani(e.target.value);
          setOtevreno(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOtevreno(true);
            setZvyrazneny((i) => Math.min(i + 1, viditelne.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setZvyrazneny((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            if (otevreno && viditelne[zvyrazneny]) {
              e.preventDefault();
              vyber(viditelne[zvyrazneny].hodnota);
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            if (otevreno) e.stopPropagation();
            setOtevreno(false);
            setHledani('');
          }
        }}
        className={`${trida} ${otevreno ? 'border-brand-purple' : ''} ${disabled ? 'opacity-60' : ''}`}
      />

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>

      {vybrana && !otevreno && !disabled && prazdnyPopisek !== undefined && (
        <button
          type="button"
          onClick={() => onZmena('')}
          title="Zrušit výběr"
          aria-label="Zrušit výběr"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full text-muted hover:text-danger hover:bg-surface"
        >
          ×
        </button>
      )}

      {otevreno && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-[280px] overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
          {viditelne.length === 0 ? (
            <p className="text-sm font-body text-muted m-0 px-3 py-3">{prazdnyText}</p>
          ) : (
            <ul className="list-none m-0 p-1 flex flex-col">
              {prazdnyPopisek !== undefined && !hledani.trim() && (
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => vyber('')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-body text-muted hover:bg-field"
                  >
                    {prazdnyPopisek}
                  </button>
                </li>
              )}
              {viditelne.map((m, i) => (
                <li key={m.hodnota}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setZvyrazneny(i)}
                    onClick={() => vyber(m.hodnota)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-heading ${
                      i === zvyrazneny ? 'bg-field' : ''
                    } ${m.slabsi ? 'text-muted' : 'text-ink'}`}
                  >
                    {m.popisek}
                    {m.poznamka && <span className="block text-xs font-body text-muted">{m.poznamka}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {nalezene.length > viditelne.length && (
            <p className="text-xs font-body text-muted m-0 px-3 py-2 border-t border-line">
              Ukazujeme prvních {STROP} — pište dál, ať se seznam zúží.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
