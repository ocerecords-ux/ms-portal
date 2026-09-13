import { prisma } from '@/lib/db';

/**
 * Peníze projektu: rozpočet a doklady (zadání 11. 9. 2026: „zvukaři by neměli
 * vidět u projektů žádné doklady ani rozpočty").
 *
 * Je to schválně jedna funkce a volá se jen tehdy, když na to má člověk právo
 * (`canViewProjectDocuments`). Nejde totiž jen o to, že se záložka nevykreslí
 * — komu to nepatří, tomu se ta čísla ani nenačtou. Kdyby se někdy někdo
 * v zobrazování upsal, není co prozradit; a zvukaři se detail projektu navíc
 * otevře rychleji, protože mu odpadne šest dotazů do databáze.
 */
export async function nactiPenizeProjektu(caflouProjectId: string) {
  const [budgetSettings, timesheets, offers, invoices, expenses, contracts, naklady] = await Promise.all([
    prisma.budgetSettings.findUnique({ where: { id: 'default' } }),
    // Vykazy k tomuhle projektu - z nich se pocita cerpani rozpoctu a od
    // 13. 9. 2026 se rovnou i vypisuji („u tech rozpoctu by bylo super videt
    // vsechny vykazy"), proto uz nestaci cisla na vypocet, ale i den, druh
    // prace a kdo ji vykazal.
    prisma.timesheetEntry.findMany({
      where: { caflouProjectId },
      orderBy: [{ date: 'desc' }, { startMinutes: 'desc' }],
      select: {
        id: true,
        date: true,
        startMinutes: true,
        endMinutes: true,
        hourlyRateSnapshot: true,
        workType: true,
        note: true,
        user: { select: { name: true, email: true } },
      },
    }),
    // Doklady navazane na projekt (zadani 8. 9. 2026). Vazba je pres ID
    // projektu, stejne jako u vykazu.
    prisma.offer.findMany({
      where: { caflouProjectId },
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      include: { items: true },
    }),
    prisma.invoice.findMany({
      where: { caflouProjectId },
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      include: { items: true },
    }),
    prisma.expense.findMany({
      where: { caflouProjectId },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.contract.findMany({
      where: { caflouProjectId },
      orderBy: [{ createdAt: 'desc' }],
    }),
    // Polozkove naklady, ktere si produkce napsala sama (zadani 11. 9. 2026).
    prisma.projektNaklad.findMany({
      where: { caflouProjectId },
      orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
      select: { nazev: true, castka: true },
    }),
  ]);

  return { budgetSettings, timesheets, offers, invoices, expenses, contracts, naklady };
}

export type PenizeProjektu = Awaited<ReturnType<typeof nactiPenizeProjektu>>;
