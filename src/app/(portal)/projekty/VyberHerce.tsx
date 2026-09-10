'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Výběr herce z účtů v portálu (zadání 10. 9. 2026: "pole Herec musí být na
 * výběr, ne jako text. Jsou tam pak totiž návaznosti na konkrétní osobu").
 *
 * Herců jsou desítky, takže obyčejný <select> by znamenal rolování dlouhým
 * seznamem — proto se píše a rovnou se filtruje. Hledá se bez ohledu na
 * diakritiku a velikost písmen: „cerny" najde „Černý".
 *
 * Uložený je vždycky ÚČET, ne jméno. Text z Caflou (`puvodniText`) se ukazuje
 * jen jako vodítko, dokud účet přiřazený není.
 */

export type Herec = { id: string; label: string };

/** Porovnávací tvar - bez diakritiky, malá písmena, bez mezer navíc. */
function zjednodus(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function VyberHerce({
  herci,
  hodnota,
  onZmena,
  puvodniText,
  disabled,
}: {
  herci: Herec[];
  /** ID vybraného účtu herce, nebo prázdno. */
  hodnota: string;
  onZmena: (id: string) => void;
  /** Jméno herce, jak přišlo z Caflou - vodítko při přiřazování účtu. */
  puvodniText?: string | null;
  disabled?: boolean;
}) {
  const vybrany = herci.find((h) => h.id === hodnota) ?? null;
  const [hledani, setHledani] = useState('');
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLDivElement>(null);

  // Kliknutí mimo nabídku ji zavře. Bez toho by zůstala viset přes zbytek
  // formuláře a překrývala pole pod sebou.
  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  const nalezeni = useMemo(() => {
    const dotaz = zjednodus(hledani);
    if (!dotaz) return herci;
    return herci.filter((h) => zjednodus(h.label).includes(dotaz));
  }, [herci, hledani]);

  const tridaPole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div ref={obal} className="relative">
      {vybrany && !otevreno ? (
        <div className={`${tridaPole} flex items-center justify-between gap-2`}>
          <span className="truncate">{vybrany.label}</span>
          <span className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setHledani('');
                setOtevreno(true);
              }}
              className="text-xs font-heading text-brand-purple hover:underline disabled:opacity-50"
            >
              Změnit
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onZmena('')}
              title="Odebrat herce"
              className="text-muted hover:text-danger disabled:opacity-50"
            >
              ×
            </button>
          </span>
        </div>
      ) : (
        <input
          type="text"
          disabled={disabled}
          value={hledani}
          onChange={(e) => {
            setHledani(e.target.value);
            setOtevreno(true);
          }}
          onFocus={() => setOtevreno(true)}
          placeholder={puvodniText ? `hledat herce (v Caflou: ${puvodniText})` : 'začněte psát jméno herce'}
          className={tridaPole}
        />
      )}

      {otevreno && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
          {nalezeni.length === 0 ? (
            <p className="px-3 py-2.5 text-sm font-body text-muted m-0">
              {herci.length === 0
                ? 'V portálu zatím není žádný herec — nejdřív ho založte mezi uživateli.'
                : 'Nikdo takový tu není.'}
            </p>
          ) : (
            nalezeni.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  onZmena(h.id);
                  setOtevreno(false);
                  setHledani('');
                }}
                className={`block w-full text-left px-3 py-2 text-sm font-heading hover:bg-tint transition-colors ${
                  h.id === hodnota ? 'text-brand-purple font-semibold' : 'text-ink'
                }`}
              >
                {h.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
