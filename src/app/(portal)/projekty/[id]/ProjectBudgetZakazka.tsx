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
 * položkách — honorář herce, studio, hudba. K nim se přičte, co portál ví
 * sám: výkazy zvukařů a výdaje navázané na projekt.
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
}) {
  const [polozky, setPolozky] = useState(
    pocatecniPolozky.reduce((s, p) => s + p.castka, 0),
  );

  const naklady = spent + vydaje + polozky;
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
          <tr>
            <td className="py-1 text-ink">Práce (výkazy)</td>
            <td className="py-1 text-muted tabular-nums whitespace-nowrap">
              {hoursLogged > 0 ? `${hoursLogged.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h` : '—'}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(spent)}</td>
          </tr>
          <tr>
            <td className="py-1 text-ink">Výdaje z dokladů</td>
            <td className="py-1 text-muted whitespace-nowrap">záložka Doklady</td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(vydaje)}</td>
          </tr>
          <tr>
            <td className="py-1 text-ink">Náklady po položkách</td>
            <td className="py-1 text-muted whitespace-nowrap">viz níž</td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(polozky)}</td>
          </tr>
          <tr className="border-t border-line">
            <td className="pt-2 text-ink font-semibold">Náklady celkem</td>
            <td></td>
            <td className="pt-2 text-ink tabular-nums text-right font-semibold">{czk(naklady)}</td>
          </tr>
        </tbody>
      </table>

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
      />
    </div>
  );
}
