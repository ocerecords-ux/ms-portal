'use client';

import { useMemo, useState } from 'react';
import { BublinaHerce, type Herec } from './VyberHerce';
import { TRIDA_SLOUPCE_HERCU } from '@/lib/bublinaHerce';

/**
 * Výběr VÍCE herců k projektu (zadání 10. 9. 2026: „ještě nemám v detailu
 * projektu, když vkládám herce, mnohonásobný výběr — chci jich tam dát více").
 *
 * Víc lidí na jednu knihu je běžné: dabing, dvojhlas, vypravěč plus postavy.
 * Do té doby šel u projektu vyplnit jen jeden.
 *
 * PRVNÍ V SEZNAMU JE HLAVNÍ. Podle něj se předvyplňuje natáčecí frekvence,
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
}: {
  herci: Herec[];
  /** ID vybraných účtů v pořadí - první je hlavní. */
  hodnoty: string[];
  onZmena: (ids: string[]) => void;
  /** Jméno herce, jak přišlo z Caflou - vodítko, dokud účet přiřazený není. */
  puvodniText?: string | null;
  disabled?: boolean;
}) {
  const [hledani, setHledani] = useState('');
  const [otevreno, setOtevreno] = useState(false);

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

  /** Posun o jedno místo dopředu - první v seznamu je hlavní herec. */
  function nahoru(id: string) {
    const i = hodnoty.indexOf(id);
    if (i <= 0) return;
    const nove = [...hodnoty];
    [nove[i - 1], nove[i]] = [nove[i], nove[i - 1]];
    onZmena(nove);
  }

  return (
    <div className="flex flex-col gap-2">
      {vybrani.length > 0 && (
        <div className={TRIDA_SLOUPCE_HERCU}>
          {vybrani.map((h, i) => (
            <span key={h.id} className="inline-flex items-center gap-1">
              <BublinaHerce
                jmeno={h.label}
                disabled={disabled}
                // Klik na jmeno tady nic nemeni - herec se pridava a odebira,
                // ne prepisuje. Sipka ho posune na prvni misto.
                onZmenit={() => nahoru(h.id)}
                onOdebrat={() => odeber(h.id)}
              />
              {i === 0 ? (
                <span className="text-[11px] font-body text-muted">hlavní</span>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => nahoru(h.id)}
                  title="Posunout výš (první je hlavní herec)"
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
          // Nabidka se zaviraz az po kliknuti - kdyby se zavrela hned pri
          // opusteni policka, klik na jmeno v nabidce by se nestihl.
          onBlur={() => setTimeout(() => setOtevreno(false), 120)}
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
