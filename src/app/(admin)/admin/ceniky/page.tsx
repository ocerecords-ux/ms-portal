import { prisma } from '@/lib/db';
import { PriceListEditor } from './PriceListEditor';
import { BudgetSettingsForm } from './BudgetSettingsForm';
import { LicenceEditor } from './LicenceEditor';
import { DEFAULT_BUDGET_SETTINGS } from '@/lib/budget';

// Ceníky (zadani 5. 9. 2026). Polozky ceniku slouzi zaroven jako ciselnik
// typu projektu - viz lib/priceList.ts.
export const dynamic = 'force-dynamic';

export default async function PriceListPage() {
  const [items, budget, licence] = await Promise.all([
    prisma.priceListItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.budgetSettings.findUnique({ where: { id: 'default' } }),
    // Druhy licence jsou ciselnik jako typy projektu, proto bydli tady
    // (zadani 18. 9. 2026). U kazdeho se pocita, kolik projektu ho ma -
    // podle toho se pozna, jestli jde smazat, nebo se jen vyradi.
    prisma.druhLicence.findMany({
      orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }],
      include: { _count: { select: { projekty: true } } },
    }),
  ]);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Ceníky</h1>
      </div>

      <PriceListEditor
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          priceExVat: i.priceExVat,
          priceIncVat: i.priceIncVat,
          active: i.active,
          rodnyList: i.rodnyList,
          proObjednavkyAudioknih: i.proObjednavkyAudioknih,
          ikona: i.ikona,
        }))}
      />

      <LicenceEditor
        druhy={licence.map((d) => ({
          id: d.id,
          nazev: d.nazev,
          ikona: d.ikona,
          poradi: d.poradi,
          active: d.active,
          projektu: d._count.projekty,
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
