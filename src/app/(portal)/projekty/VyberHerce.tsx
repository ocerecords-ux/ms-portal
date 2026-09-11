'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TRIDA_BUBLINY_DOTOCENO, TRIDA_BUBLINY_HERCE } from '@/lib/bublinaHerce';
import { FajfkaDotoceno } from './FajfkaDotoceno';

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
 *
 * VYBRANÝ HEREC JE BUBLINA (zadání 10. 9. 2026: „s těmi jmény herců bych
 * pracoval v bublině, jako s celky, ne s textem, aby bylo jasné, že je to
 * výběr"). Dokud vypadal jako text v poli, svádělo to psát do něj jméno -
 * jenže tady se vybírá konkrétní účet, na který se pak váží nabídky termínů
 * a smlouvy. Bublina je jeden celek: buď tam je, nebo není.
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
        <BublinaHerce
          jmeno={vybrany.label}
          disabled={disabled}
          onZmenit={() => {
            setHledani('');
            setOtevreno(true);
          }}
          onOdebrat={() => onZmena('')}
        />
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

/**
 * Vybraný herec jako bublina. Klik na jméno otevře hledání, křížek herce
 * odebere - obojí je uvnitř té samé bubliny, takže je vidět, že je to jeden
 * celek a ne rozepsaný text.
 */
export function BublinaHerce({
  jmeno,
  onZmenit,
  onOdebrat,
  disabled,
  dotoceno,
}: {
  jmeno: string;
  onZmenit: () => void;
  onOdebrat?: () => void;
  disabled?: boolean;
  /** Datum dotočení - fajfka patří DOVNITŘ bubliny (zadání 11. 9. 2026). */
  dotoceno?: string | null;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 max-w-full pl-3 pr-1.5 py-1 ${
        dotoceno ? TRIDA_BUBLINY_DOTOCENO : TRIDA_BUBLINY_HERCE
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onZmenit}
        title="Vybrat jiného herce"
        className="text-sm font-heading font-semibold truncate disabled:opacity-60"
      >
        {jmeno}
      </button>
      {/* Fajfka je uvnitr bubliny, stejne jako v prehledu projektu (zadani
          11. 9. 2026: „tu fajfku u herce dotoceno jsem chtel [do] toho
          ovalneho ramecku s napisem herec"). */}
      {dotoceno && <FajfkaDotoceno kdy={dotoceno} />}
      {onOdebrat && (
        <button
          type="button"
          disabled={disabled}
          onClick={onOdebrat}
          title="Odebrat herce"
          aria-label="Odebrat herce"
          className="shrink-0 grid place-items-center w-5 h-5 rounded-pill text-current/70 hover:text-danger hover:bg-surface disabled:opacity-50"
        >
          ×
        </button>
      )}
    </span>
  );
}
