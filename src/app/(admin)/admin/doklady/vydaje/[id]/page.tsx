import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ExpenseEditor } from './ExpenseEditor';
import { listProjectOptions } from '@/lib/projectOptions';
import { expenseTotalMinor } from '@/lib/expenses';
import { QrPlatba } from '@/components/QrPlatba';
import { NahledPrilohy } from './NahledPrilohy';

// Detail prijateho dokladu.
export const dynamic = 'force-dynamic';

export default async function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const [expense, categories, companies] = await Promise.all([
    prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        supplier: { select: { name: true, bankAccount: true } },
        issuer: { select: { name: true } },
      },
    }),
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!expense) notFound();

  const projects = await listProjectOptions();

  // Ucet je bud primo na dokladu (dorazil ze smlouvy s hercem), nebo u firmy
  // dodavatele. Kdyz neni ani jeden, QR se nekresli.
  const ucetPrijemce = expense.supplierAccount?.trim() || expense.supplier?.bankAccount?.trim() || null;
  const kUhrade = expenseTotalMinor(expense.amountExVatMinor, expense.vatRate);
  const prijemce = expense.supplier?.name ?? expense.supplierName ?? null;

  /**
   * NÁHLED PŘÍLOHY VEDLE FORMULÁŘE (zadání 16. 9. 2026: „ať se mi na pravé
   * straně obrazovky zobrazí rovnou náhled té přílohy").
   *
   * Účtenku člověk při vyplňování opisuje - částku, datum, dodavatele - a
   * otevírat ji na druhé záložce znamená přepínat u každého políčka. Doklad
   * bez přílohy zůstává úzký jako dřív; roztažená stránka s prázdnou půlkou
   * by vypadala rozbitě.
   */
  const maPrilohu = Boolean(expense.attachmentUrl);

  return (
    <div className={`flex flex-col gap-6 ${maPrilohu ? 'max-w-[1400px]' : 'max-w-3xl'}`}>
      <Link href="/admin/doklady/vydaje" className="text-muted text-sm font-heading no-underline">
        ← Zpět na výdaje
      </Link>

      <div
        className={
          maPrilohu
            ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(420px,44%)] gap-6 items-start'
            : ''
        }
      >
        <div className="flex flex-col gap-6 min-w-0">

      {!expense.paid && (
        <QrPlatba
          ucet={ucetPrijemce}
          castkaMinor={kUhrade}
          mena={expense.currency}
          variabilniSymbol={expense.number}
          zprava={[prijemce, expense.projectName].filter(Boolean).join(' - ') || expense.description}
          splatnost={expense.dueDate}
          prijemce={prijemce}
        />
      )}

      <ExpenseEditor
        expense={{
          id: expense.id,
          number: expense.number ?? '',
          supplierCompanyId: expense.supplierCompanyId ?? '',
          supplierName: expense.supplierName ?? '',
          supplierLabel: expense.supplier?.name ?? expense.supplierName ?? '—',
          categoryId: expense.categoryId ?? '',
          issuerName: expense.issuer?.name ?? null,
          currency: expense.currency,
          exchangeRate: expense.exchangeRate,
          exchangeRateDate: expense.exchangeRateDate ? expense.exchangeRateDate.toISOString() : null,
          description: expense.description ?? '',
          amountExVatMinor: expense.amountExVatMinor,
          vatRate: expense.vatRate,
          issueDate: expense.issueDate.toISOString().slice(0, 10),
          dueDate: expense.dueDate ? expense.dueDate.toISOString().slice(0, 10) : '',
          paid: expense.paid,
          paidAt: expense.paidAt ? expense.paidAt.toISOString() : null,
          paymentMethod: expense.paymentMethod,
          attachmentUrl: expense.attachmentUrl,
          attachmentName: expense.attachmentName,
          note: expense.note ?? '',
          caflouProjectId: expense.caflouProjectId ?? '',
          projectName: expense.projectName,
          stav: expense.stav,
          mailOd: expense.mailOd,
          mailPredmet: expense.mailPredmet,
          mailPrijatoAt: expense.mailPrijatoAt ? expense.mailPrijatoAt.toISOString() : null,
          navrhJson: expense.navrhJson,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        companies={companies}
        projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
      />
        </div>

        {/* Náhled drží na místě i při rolování formuláře - jinak by u delšího
            dokladu zmizel nahoře a byl by k ničemu. */}
        {maPrilohu && (
          <div className="xl:sticky xl:top-6">
            <NahledPrilohy expenseId={expense.id} nazev={expense.attachmentName} />
          </div>
        )}
      </div>
    </div>
  );
}
