import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ExpenseEditor } from './ExpenseEditor';

// Detail prijateho dokladu.
export const dynamic = 'force-dynamic';

export default async function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const [expense, categories, companies] = await Promise.all([
    prisma.expense.findUnique({
      where: { id: params.id },
      include: { category: true, supplier: { select: { name: true } }, issuer: { select: { name: true } } },
    }),
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!expense) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link href="/admin/doklady/vydaje" className="text-muted text-sm font-heading no-underline">
        ← Zpět na výdaje
      </Link>

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
          attachmentUrl: expense.attachmentUrl,
          attachmentName: expense.attachmentName,
          note: expense.note ?? '',
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        companies={companies}
      />
    </div>
  );
}
