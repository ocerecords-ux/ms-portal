'use client';

import { useState } from 'react';
import { budgetUsedPercent, type Budget } from '@/lib/budget';
import { NakladyProjektu, type NakladovaPolozka } from './NakladyProjektu';

const czk = (v: number) => `${Math.round(v).toLocaleString('cs-CZ')} Kč`;

/**
 * Rozpocet audioknihy (zadani 6. 9. 2026) - vidi ho jen Zuzo-labuzo.
 *
 * DVE ODDELENE VECI (zadani 14. 9. 2026):
 *
 * 1. ROZPOCET NA VYROBU - nataceni, strih, bonus. Pocita se z normostran
 *    a proti nemu stoji vykazy zvukaru. Tenhle rozpocet se NEMENI a nic
 *    dalsiho do nej nesmi: „tyto polozky by nemely ovlivnovat rozpocet na
 *    vyrobu ... aby nam to neovlivnovalo, jak rozpocet tece."
 *
 * 2. CELKOVY ROZPOCET - jen u firem, pro ktere delame audioknihy NA KLIC
 *    (zaskrtavatko na karte firmy). Tam platime i herce a obcas jednorazove
 *    veci jako preposlech nebo upravu textu. Od castky, kterou fakturujeme,
 *    se odectou naklady na vyrobu a zvlast tyhle dalsi polozky; co zbyde,
 *    je zisk z knihy.
 *
 * Nataceni a strih zustavaji v celkovem rozpoctu na samostatnych radcich -
 * aby bylo videt, co z nich odchazi, a neslily se s polozkami do jednoho
 * cisla.
 *
 * ODKUD JE FAKTUROVANA CASTKA: z cenove nabidky u projektu (zadani
 * 14. 9. 2026: „castka, kterou pak fakturujeme, je znama z cenove nabidky
 * u projektu"). Kdyz nabidka neni, bere se z vystavene faktury, a teprve
 * kdyz neni ani ta, zbyva odhad z normostran krat sazba firmy - to je ale
 * jen odhad a je to u cisla napsane.
 */
export function ProjectBudget({
  budget,
  spent,
  revenue,
  ratePerPage,
  hoursLogged,
  caflouProjectId,
  pocatecniPolozky,
  naKlic,
  cenaZDokladu,
  zdrojCeny,
}: {
  budget: Budget;
  /** Uz vykazane penize podle vykazu zvukaru. */
  spent: number;
  /** Cena zakazky z normostran x sazba firmy, null kdyz sazba chybi. */
  revenue: number | null;
  ratePerPage: number | null;
  hoursLogged: number;
  caflouProjectId: string;
  pocatecniPolozky: NakladovaPolozka[];
  /** Delame pro tuhle firmu audioknihy na klic? (Company.audioknihyNaKlic) */
  naKlic: boolean;
  /** Cena z nabidky, nebo z faktury - viz zdrojCeny. */
  cenaZDokladu: number | null;
  zdrojCeny: 'nabidka' | 'faktura' | null;
}) {
  const [polozky, setPolozky] = useState(pocatecniPolozky.reduce((s, p) => s + p.castka, 0));

  const percent = budgetUsedPercent(spent, budget.total);
  const over = spent > budget.total;
  const remaining = budget.total - spent;

  // Co budeme fakturovat. Nabidka/faktura ma prednost pred odhadem z normostran.
  const fakturujeme = cenaZDokladu ?? revenue;
  const popisCeny =
    zdrojCeny === 'nabidka'
      ? 'z cenové nabídky'
      : zdrojCeny === 'faktura'
        ? 'z vystavené faktury'
        : revenue != null
          ? 'odhad z normostran'
          : '—';
  const zisk = fakturujeme != null ? fakturujeme - budget.total - polozky : null;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Rozpočet</h2>
        <span className="text-xs font-body text-muted">
          {budget.pageCount} normostran · frekvence {budget.sessions} × {czk(budget.unitPrice)}
        </span>
      </div>

      <table className="w-full text-sm font-heading">
        <tbody>
          <tr>
            <td className="py-1 text-ink">Natáčení</td>
            <td className="py-1 text-muted tabular-nums whitespace-nowrap">
              {budget.sessions} × {czk(budget.unitPrice)}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(budget.recordingCost)}</td>
          </tr>
          <tr>
            <td className="py-1 text-ink">Střih</td>
            <td className="py-1 text-muted tabular-nums whitespace-nowrap">
              {budget.editingUnits} × {czk(budget.unitPrice)}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(budget.editingCost)}</td>
          </tr>
          <tr>
            <td className="py-1 text-ink">Bonus</td>
            <td className="py-1 text-muted tabular-nums whitespace-nowrap">
              {budget.pageCount} × {czk(budget.bonus / (budget.pageCount || 1))}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(budget.bonus)}</td>
          </tr>
          <tr className="border-t border-line">
            {/* Drive "Naklady celkem". Prejmenovano 14. 9. 2026, at je na prvni
                pohled jasne, ze dalsi polozky sem NEPATRI. */}
            <td className="pt-2 text-ink font-semibold">Náklady na výrobu</td>
            <td></td>
            <td className="pt-2 text-ink tabular-nums text-right font-semibold">{czk(budget.total)}</td>
          </tr>
        </tbody>
      </table>

      <div>
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Čerpání</span>
          <span className={`text-sm font-heading font-semibold tabular-nums ${over ? 'text-danger' : 'text-ink'}`}>
            {czk(spent)} z {czk(budget.total)} · {percent} %
          </span>
        </div>
        <div className="h-2.5 w-full rounded-pill bg-line overflow-hidden">
          <div
            className={`h-full rounded-pill ${over ? 'bg-red-500' : percent >= 80 ? 'bg-status-progress' : 'bg-brand-green'}`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
        <p className="text-xs font-body text-muted mt-1.5 m-0">
          {hoursLogged > 0
            ? `Vykázáno ${hoursLogged.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h. `
            : 'Zatím žádné výkazy. '}
          {over
            ? `Rozpočet je překročený o ${czk(spent - budget.total)}.`
            : `Zbývá ${czk(remaining)}.`}
        </p>
      </div>

      {/* Firma, pro kterou nedelame na klic: platime jen vyrobu, takze zisk
          je prosty rozdil ceny zakazky a vyroby - jako doted. */}
      {!naKlic && (
        <div className="border-t border-line pt-4 mt-auto">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Zisk</span>
            {revenue == null ? (
              <span className="text-sm font-body text-muted">
                Firma nemá nastavenou sazbu za normostranu, cenu zakázky proto nespočítáme.
              </span>
            ) : (
              <span className="text-sm font-heading text-ink tabular-nums">
                {czk(revenue)} − {czk(budget.total)} ={' '}
                <strong className={revenue - budget.total >= 0 ? 'text-brand-greenDeep' : 'text-danger'}>
                  {czk(revenue - budget.total)}
                </strong>
              </span>
            )}
          </div>
          {revenue != null && ratePerPage != null && (
            <p className="text-xs font-body text-muted mt-1 m-0">
              Cena zakázky = {budget.pageCount} normostran × {czk(ratePerPage)} (sazba firmy, bez DPH).
            </p>
          )}
        </div>
      )}

      {naKlic && (
        <>
          <NakladyProjektu
            caflouProjectId={caflouProjectId}
            pocatecni={pocatecniPolozky}
            onZmena={setPolozky}
            nadpis="Další položky"
            napoveda="Bez DPH. Honorář herce, přeposlech, úprava textu. Do rozpočtu na výrobu se nepočítají — sčítají se až v celkovém rozpočtu."
          />

          <div className="border-t border-line pt-4 mt-auto">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Celkový rozpočet</span>
            <table className="w-full text-sm font-heading mt-2">
              <tbody>
                <tr>
                  <td className="py-1 text-ink">Fakturujeme</td>
                  <td className="py-1 text-muted whitespace-nowrap">{popisCeny}</td>
                  <td className="py-1 text-ink tabular-nums text-right">
                    {fakturujeme == null ? '—' : czk(fakturujeme)}
                  </td>
                </tr>
                {/* Nataceni a strih zvlast (zadani 14. 9. 2026) - at je videt,
                    co z ceny ukrajuje vyroba a co az dalsi polozky. */}
                <tr>
                  <td className="py-1 text-muted">− Natáčení</td>
                  <td></td>
                  <td className="py-1 text-muted tabular-nums text-right">{czk(budget.recordingCost)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">− Střih</td>
                  <td></td>
                  <td className="py-1 text-muted tabular-nums text-right">{czk(budget.editingCost)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">− Bonus</td>
                  <td></td>
                  <td className="py-1 text-muted tabular-nums text-right">{czk(budget.bonus)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">− Další položky</td>
                  <td></td>
                  <td className="py-1 text-muted tabular-nums text-right">{czk(polozky)}</td>
                </tr>
                <tr className="border-t border-line">
                  <td className="pt-2 text-ink font-semibold">Zisk z knihy</td>
                  <td></td>
                  <td className="pt-2 tabular-nums text-right font-semibold">
                    {zisk == null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={zisk >= 0 ? 'text-brand-greenDeep' : 'text-danger'}>{czk(zisk)}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            {fakturujeme == null && (
              <p className="text-xs font-body text-muted mt-1.5 m-0">
                Dokud u projektu není nabídka ani faktura a firma nemá sazbu za normostranu, nemá portál co
                fakturovat — zisk proto nespočítáme.
              </p>
            )}
            {fakturujeme != null && zdrojCeny == null && (
              <p className="text-xs font-body text-muted mt-1.5 m-0">
                Zatím je to jen odhad: {budget.pageCount} normostran × {czk(ratePerPage ?? 0)}. Až u projektu
                bude nabídka, vezme se částka z ní.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
