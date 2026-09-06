import { prisma } from '@/lib/db';
import { PriceListEditor } from './PriceListEditor';
import { BudgetSettingsForm } from './BudgetSettingsForm';
import { DEFAULT_BUDGET_SETTINGS } from '@/lib/budget';

// Ceníky (zadani 5. 9. 2026). Polozky ceniku slouzi zaroven jako ciselnik
// typu projektu - viz lib/priceList.ts.
export const dynamic = 'force-dynamic';

export default async function PriceListPage() {
  const [items, budget] = await Promise.all([
    prisma.priceListItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.budgetSettings.findUnique({ where: { id: 'default' } }),
  ]);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Ceníky</h1>
        <p className="text-muted text-sm mt-1 font-body">
          Položky ceníku slouží zároveň jako typy projektu — u projektu jde vybrat jen to, co je tady. Cenu s DPH
          dopočítáme z ceny bez DPH, pokud ji nevyplníte.
        </p>
      </div>

      <PriceListEditor
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          priceExVat: i.priceExVat,
          priceIncVat: i.priceIncVat,
          active: i.active,
        }))}
      />

      <BudgetSettingsForm
        initial={
          budget
            ? {
                pagesPerSession: budget.pagesPerSession,
                sessionHours: budget.sessionHours,
                editingCoefficient: budget.editingCoefficient,
                bonusPerPage: budget.bonusPerPage,
                hourlyRate: budget.hourlyRate,
              }
            : DEFAULT_BUDGET_SETTINGS
        }
      />
    </section>
  );
}
