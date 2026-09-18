'use client';

import { useState } from 'react';
import { NakladyProjektu, type NakladovaPolozka } from './NakladyProjektu';

const czk = (v: number) => `${Math.round(v).toLocaleString('cs-CZ')} Kč`;

/**
 * Rozpočet projektu, který se nepočítá z normostran (zadání 11. 9. 2026:
 * „rozpočet dej do každé karty projektu, bude se to akorát lišit tím, jestli
 * je to audiokniha nebo reklama").
 *
 * U audioknihy portál rozpočet SPOČÍTÁ — normostrany × sazby, viz
 * ProjectBudget. U reklamy žádný takový vzorec není: cena se bere z nabídky
 * (a dokud není, z vystavené faktury) a náklady si produkce napíše sama po
 * položkách — honorář herce, studio, hudba.
 *
 * ZISK = CENA Z NABÍDKY MÍNUS POLOŽKY, NIC JINÉHO (oprava 18. 9. 2026: „tady
 * to nepočítá správně zisk. Má to být vždy cena z nabídky minus ty položky
 * níže. Tam budu psát veškeré náklady. Ta položka se teď zdvojila").
 *
 * Do teď se k položkám ještě přičítaly výkazy zvukařů a výdaje z dokladů.
 * Jenže tentýž náklad se do portálu dostane obojí cestou — honorář herce je
 * i přijatá faktura — a v rozpočtu se pak počítal dvakrát: 3 000 Kč položka
 * a 3 000 Kč doklad daly náklady 6 000 Kč. Položky jsou jedno místo, kam se
 * píše všechno, takže jsou jediné, co do zisku vstupuje.
 *
 * Výkazy a výdaje z dokladů zůstávají vidět POD čárou jako přehled - jsou to
 * užitečná čísla, podle kterých se položky vyplňují, ale nic nepočítají.
 *
 * Zatím schválně jednoduché; Ondřej 11. 9. 2026: „u těch reklam to bude
 * trošku sofistikovanější, zatím to udělej jednoduše."
 *
 * Všechno bez DPH: daň projektu nevydělá ani nesežere.
 */
export function ProjectBudgetZakazka({
  caflouProjectId,
  cena,
  zdrojCeny,
  spent,
  hoursLogged,
  vydaje,
  pocatecniPolozky,
  jmenaHercu,
}: {
  caflouProjectId: string;
  /** Cena zakázky bez DPH v korunách; null = není z čeho ji vzít. */
  cena: number | null;
  zdrojCeny: 'nabidka' | 'faktura' | null;
  /** Vykázané peníze podle výkazů zvukařů. */
  spent: number;
  hoursLogged: number;
  /** Výdaje navázané na projekt (doklady), bez DPH. */
  vydaje: number;
  pocatecniPolozky: NakladovaPolozka[];
  /** Jména herců jako našeptávač u položek (zadání 14. 9. 2026). */
  jmenaHercu: string[];
}) {
  const [polozky, setPolozky] = useState(
    pocatecniPolozky.reduce((s, p) => s + p.castka, 0),
  );

  /**
   * NÁKLADY = JEN POLOŽKY (oprava 18. 9. 2026). Výkazy ani výdaje z dokladů
   * se nepřičítají - tentýž náklad je často v obojím a počítal by se dvakrát.
   */
  const naklady = polozky;
  const percent = cena && cena > 0 ? Math.round((naklady / cena) * 100) : 0;
  const over = cena != null && naklady > cena;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Rozpočet</h2>
        <span className="text-xs font-body text-muted">
          {zdrojCeny === 'nabidka'
            ? 'Cena podle nabídky'
            : zdrojCeny === 'faktura'
              ? 'Cena podle vystavené faktury'
              : 'Cena zakázky zatím není'}
        </span>
      </div>

      <table className="w-full text-sm font-heading">
        <tbody>
          <tr>
            <td className="py-1 text-ink">Cena zakázky</td>
            <td className="py-1 text-muted whitespace-nowrap">
              {zdrojCeny === 'nabidka' ? 'nabídnuto' : zdrojCeny === 'faktura' ? 'fakturováno' : '—'}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">{cena == null ? '—' : czk(cena)}</td>
          </tr>
          <tr className="border-t border-line">
            <td className="pt-2 text-ink font-semibold">Náklady</td>
            <td className="pt-2 text-muted whitespace-nowrap">položky níž</td>
            <td className="pt-2 text-ink tabular-nums text-right font-semibold">{czk(naklady)}</td>
          </tr>
        </tbody>
      </table>

      {/* JEN PRO PŘEHLED, DO ZISKU NEVSTUPUJE (oprava 18. 9. 2026). Čísla se
          hodí při vyplňování položek - ale sama se nepřičítají, protože tentýž
          náklad bývá zároveň dokladem i položkou. */}
      {(spent > 0 || vydaje > 0) && (
        <p className="text-xs font-body text-muted m-0 -mt-2">
          Jen pro přehled, do zisku se nepočítá:{' '}
          {spent > 0 && (
            <>
              práce ze&nbsp;výkazů {czk(spent)}
              {hoursLogged > 0
                ? ` (${hoursLogged.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h)`
                : ''}
              {vydaje > 0 ? ' · ' : ''}
            </>
          )}
          {vydaje > 0 && <>výdaje z dokladů {czk(vydaje)}</>}. Co se má do zisku promítnout,
          napište mezi položky.
        </p>
      )}

      {cena != null && cena > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Čerpání</span>
            <span className={`text-sm font-heading font-semibold tabular-nums ${over ? 'text-danger' : 'text-ink'}`}>
              {czk(naklady)} z {czk(cena)} · {percent} %
            </span>
          </div>
          <div className="h-2.5 w-full rounded-pill bg-line overflow-hidden">
            <div
              className={`h-full rounded-pill ${over ? 'bg-red-500' : percent >= 80 ? 'bg-status-progress' : 'bg-brand-green'}`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Zisk</span>
          {cena == null ? (
            <span className="text-sm font-body text-muted">
              Dokud u projektu není nabídka ani faktura, nemá portál cenu odkud vzít.
            </span>
          ) : (
            <span className="text-sm font-heading text-ink tabular-nums">
              {czk(cena)} − {czk(naklady)} ={' '}
              <strong className={cena - naklady >= 0 ? 'text-brand-greenDeep' : 'text-danger'}>
                {czk(cena - naklady)}
              </strong>
            </span>
          )}
        </div>
      </div>

      <NakladyProjektu
        caflouProjectId={caflouProjectId}
        pocatecni={pocatecniPolozky}
        onZmena={setPolozky}
        jmena={jmenaHercu}
      />
    </div>
  );
}
