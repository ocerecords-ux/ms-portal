/**
 * Rozpocet audioknihy (zadani 6. 9. 2026).
 *
 * Postup, jak ho pocita Mediaspace:
 *  1. Herec nacte 40 NS za jednu 4hodinovou natacecí frekvenci
 *     -> frekvence = zaokrouhleno nahoru (NS / 40).
 *  2. Strih je o 20 % delsi nez natáčení
 *     -> strih = zaokrouhleno nahoru (frekvence x 1,2).
 *  3. Bonus je jednorazova odmena zvukari za knihu dokoncenou samostatne a
 *     vcas -> NS x 4 Kc.
 *  4. Cena jedne frekvence i jedne strihove jednotky = delka frekvence x
 *     hodinova sazba (4 h x 250 Kc = 1 000 Kc).
 *
 * Priklad z zadani: 260 NS -> 7 frekvenci (7 000 Kc), 9 strihu (9 000 Kc),
 * bonus 1 040 Kc, naklady celkem 17 040 Kc.
 *
 * Vsechna cisla jsou parametry (model BudgetSettings), aby sly zmenit v
 * administraci bez zasahu do kodu.
 */

export type BudgetSettingsValues = {
  pagesPerSession: number;
  sessionHours: number;
  editingCoefficient: number;
  bonusPerPage: number;
  hourlyRate: number;
};

export const DEFAULT_BUDGET_SETTINGS: BudgetSettingsValues = {
  pagesPerSession: 40,
  sessionHours: 4,
  editingCoefficient: 120,
  bonusPerPage: 4,
  hourlyRate: 250,
};

export type Budget = {
  pageCount: number;
  /** Pocet natacecích frekvenci (zaokrouhleno nahoru). */
  sessions: number;
  /** Pocet strihovych jednotek (zaokrouhleno nahoru). */
  editingUnits: number;
  /** Cena jedne frekvence i jedne strihove jednotky. */
  unitPrice: number;
  recordingCost: number;
  editingCost: number;
  bonus: number;
  /** Naklady celkem - strop, ktery se nesmi prekrocit. */
  total: number;
};

export function computeBudget(pageCount: number, settings: BudgetSettingsValues): Budget {
  const pages = Math.max(0, Math.round(pageCount));
  const sessions = settings.pagesPerSession > 0 ? Math.ceil(pages / settings.pagesPerSession) : 0;
  const editingUnits = Math.ceil((sessions * settings.editingCoefficient) / 100);
  const unitPrice = settings.sessionHours * settings.hourlyRate;
  const recordingCost = sessions * unitPrice;
  const editingCost = editingUnits * unitPrice;
  const bonus = pages * settings.bonusPerPage;

  return {
    pageCount: pages,
    sessions,
    editingUnits,
    unitPrice,
    recordingCost,
    editingCost,
    bonus,
    total: recordingCost + editingCost + bonus,
  };
}

/** Kolik procent rozpoctu uz snedly vykazane hodiny (0-nekonecno). */
export function budgetUsedPercent(spent: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((spent / total) * 100);
}
