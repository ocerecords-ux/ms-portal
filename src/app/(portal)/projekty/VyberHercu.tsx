'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BublinaHerce, type Herec } from './VyberHerce';
import { TRIDA_SLOUPCE_HERCU } from '@/lib/bublinaHerce';

/**
 * Výběr VÍCE herců k projektu (zadání 10. 9. 2026: „ještě nemám v detailu
 * projektu, když vkládám herce, mnohonásobný výběr — chci jich tam dát více").
 *
 * Víc lidí na jednu knihu je běžné: dabing, dvojhlas, vypravěč plus postavy.
 * Do té doby šel u projektu vyplnit jen jeden.
 *
 * HERCI JSOU ČÍSLOVANÍ - Herec 1, Herec 2, ... (zadání 10. 9. 2026:
 * „nelíbí se mi u herců označení hlavní, dal bych Herec 1, Herec 2").
 * Na pořadí záleží: podle prvního se předvyplňuje natáčecí frekvence,
 * a proto jde s bublinami hýbat - šipkou se herec posune dopředu.
 *
 * Vybraný herec se v nabídce už neukazuje: dvakrát tentýž herec u jednoho
 * projektu nedává smysl a databáze by to stejně odmítla.
 */

/** Porovnávací tvar - bez diakritiky, malá písmena. „cerny" najde „Černý". */
function zjednodus(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function VyberHercu({
  herci,
  hodnoty,
  onZmena,
  puvodniText,
  disabled,
  dotoceni,
  onPrepnoutDotoceno,
  dotoceniBezi,
}: {
  herci: Herec[];
  /** ID vybraných účtů v pořadí - první je Herec 1. */
  hodnoty: string[];
  onZmena: (ids: string[]) => void;
  /** Jméno herce, jak přišlo z Caflou - vodítko, dokud účet přiřazený není. */
  puvodniText?: string | null;
  disabled?: boolean;
  /**
   * Kdo z herců má dotočeno - ID účtu -> datum (zadání 11. 9. 2026).
   * Ukládá se zvlášť od zbytku formuláře: je to událost, ne vlastnost, kterou
   * by měl člověk „rozepsanou" a potvrzoval ji až spolu s ostatním.
   */
  dotoceni?: Record<string, string>;
  onPrepnoutDotoceno?: (userId: string, dotoceno: boolean) => void;
  /** ID herce, u kterého se zrovna ukládá - tlačítko na něj chvíli nereaguje. */
  dotoceniBezi?: string | null;
}) {
  const [hledani, setHledani] = useState('');
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLDivElement>(null);

  // Nabídku zavírá klik MIMO ni, ne opuštění políčka.
  //
  // Původně se zavírala na onBlur se zpožděním 120 ms — jenže blur přijde
  // hned při zmáčknutí tlačítka myši, zatímco klik až při puštění. Kdo
  // klikl pomaleji než za 120 ms (což při vybírání ze seznamu dělá skoro
  // každý), stihla se nabídka zavřít dřív, tlačítko zmizelo a herec se
  // nepřidal. Stejně to řeší i výběr jednoho herce ve VyberHerce.
  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  const vybrani = useMemo(
    () => hodnoty.map((id) => herci.find((h) => h.id === id)).filter((h): h is Herec => Boolean(h)),
    [herci, hodnoty],
  );

  const nalezeni = useMemo(() => {
    const dotaz = zjednodus(hledani);
    const zbyva = herci.filter((h) => !hodnoty.includes(h.id));
    if (!dotaz) return zbyva;
    return zbyva.filter((h) => zjednodus(h.label).includes(dotaz));
  }, [herci, hodnoty, hledani]);

  function pridej(id: string) {
    onZmena([...hodnoty, id]);
    setHledani('');
    setOtevreno(false);
  }

  function odeber(id: string) {
    onZmena(hodnoty.filter((h) => h !== id));
  }

  /** Posun o jedno místo dopředu - z Herce 3 se stane Herec 2. */
  function nahoru(id: string) {
    const i = hodnoty.indexOf(id);
    if (i <= 0) return;
    const nove = [...hodnoty];
    [nove[i - 1], nove[i]] = [nove[i], nove[i - 1]];
    onZmena(nove);
  }

  return (
    <div ref={obal} className="flex flex-col gap-2">
      {vybrani.length > 0 && (
        <div className={TRIDA_SLOUPCE_HERCU}>
          {vybrani.map((h, i) => (
            <span key={h.id} className="inline-flex items-center gap-2">
              <span className="text-[11px] font-heading text-muted w-[52px] shrink-0">Herec {i + 1}</span>
              <BublinaHerce
                jmeno={h.label}
                disabled={disabled}
                dotoceno={dotoceni?.[h.id]}
                // Klik na jmeno tady nic nemeni - herec se pridava a odebira,
                // ne prepisuje. Sipka ho posune o misto vys.
                onZmenit={() => nahoru(h.id)}
                onOdebrat={() => odeber(h.id)}
              />
              {/* Dotoceno u konkretniho herce (zadani 11. 9. 2026) - na
                  audioknize byva hercu vic a kazdy konci jindy. */}
              {onPrepnoutDotoceno &&
                (dotoceni?.[h.id] ? (
                  <button
                    type="button"
                    disabled={disabled || dotoceniBezi === h.id}
                    onClick={() => onPrepnoutDotoceno(h.id, false)}
                    title={`Dotočeno ${new Date(dotoceni[h.id]).toLocaleDateString('cs-CZ')} — klepnutím zrušíte`}
                    className="text-xs font-heading font-semibold rounded-pill border border-brand-green px-2.5 py-1 text-brand-greenDeep disabled:opacity-50"
                  >
                    Zrušit dotočeno
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled || dotoceniBezi === h.id}
                    onClick={() => onPrepnoutDotoceno(h.id, true)}
                    title="Označit, že tenhle herec má dotočeno"
                    className="text-xs font-heading font-semibold rounded-pill border border-line px-2.5 py-1 text-muted hover:border-brand-green hover:text-brand-greenDeep transition-colors disabled:opacity-50"
                  >
                    {dotoceniBezi === h.id ? 'Ukládám…' : 'Dotočeno'}
                  </button>
                ))}
              {i > 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => nahoru(h.id)}
                  title="Posunout výš"
                  className="text-xs text-muted hover:text-brand-purple disabled:opacity-50"
                >
                  ↑
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={hledani}
          onChange={(e) => {
            setHledani(e.target.value);
            setOtevreno(true);
          }}
          onFocus={() => setOtevreno(true)}
          placeholder={
            vybrani.length > 0
              ? 'přidat dalšího herce'
              : puvodniText
                ? `hledat herce (v Caflou: ${puvodniText})`
                : 'začněte psát jméno herce'
          }
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full"
        />

        {otevreno && (
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
            {nalezeni.length === 0 ? (
              <p className="px-3 py-2.5 text-sm font-body text-muted m-0">
                {herci.length === 0
                  ? 'V portálu zatím není žádný herec — nejdřív ho založte mezi uživateli.'
                  : hodnoty.length === herci.length
                    ? 'Všichni herci už jsou u projektu.'
                    : 'Nikdo takový tu není.'}
              </p>
            ) : (
              nalezeni.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => pridej(h.id)}
                  className="block w-full text-left px-3 py-2 text-sm font-heading text-ink hover:bg-tint transition-colors"
                >
                  {h.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
