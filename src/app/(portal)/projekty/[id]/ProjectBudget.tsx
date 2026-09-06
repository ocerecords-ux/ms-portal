import { budgetUsedPercent, type Budget } from '@/lib/budget';

const czk = (v: number) => `${v.toLocaleString('cs-CZ')} Kč`;

/**
 * Rozpocet projektu (zadani 6. 9. 2026) - vidi ho jen Zuzo-labuzo.
 * Naklady se pocitaji z poctu normostran, cerpani z vykazu zvukaru a zisk
 * jako cena zakazky minus naklady.
 */
export function ProjectBudget({
  budget,
  spent,
  revenue,
  ratePerPage,
  hoursLogged,
}: {
  budget: Budget;
  /** Uz vykazane penize podle vykazu zvukaru. */
  spent: number;
  /** Cena zakazky (normostrany x sazba firmy), null kdyz sazba chybi. */
  revenue: number | null;
  ratePerPage: number | null;
  hoursLogged: number;
}) {
  const percent = budgetUsedPercent(spent, budget.total);
  const over = spent > budget.total;
  const remaining = budget.total - spent;

  return (
    <div className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
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
            <td className="pt-2 text-ink font-semibold">Náklady celkem</td>
            <td></td>
            <td className="pt-2 text-ink tabular-nums text-right font-semibold">{czk(budget.total)}</td>
          </tr>
        </tbody>
      </table>

      <div>
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Čerpání</span>
          <span className={`text-sm font-heading font-semibold tabular-nums ${over ? 'text-red-600' : 'text-ink'}`}>
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

      <div className="border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Zisk</span>
          {revenue == null ? (
            <span className="text-sm font-body text-muted">
              Firma nemá nastavenou sazbu za normostranu, cenu zakázky proto nespočítáme.
            </span>
          ) : (
            <span className="text-sm font-heading text-ink tabular-nums">
              {czk(revenue)} − {czk(budget.total)} ={' '}
              <strong className={revenue - budget.total >= 0 ? 'text-brand-greenDeep' : 'text-red-600'}>
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
    </div>
  );
}
