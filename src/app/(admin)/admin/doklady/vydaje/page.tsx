import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/doklady';
import { ensureExpenseCategories, expenseTotalMinor } from '@/lib/expenses';
import { NewExpenseForm } from './NewExpenseForm';
import { CategoryManager } from './CategoryManager';
import { VydajeTabulka, type VydajRadek } from './VydajeTabulka';
import { listProjectOptions } from '@/lib/projectOptions';

// Prijate doklady (zadani 6. 9. 2026). Zalozky Uhrazeno / Neuhrazeno stejne
// jako Aktivni / Dokoncene u projektu, nahore soucty.
export const dynamic = 'force-dynamic';

// Zalozka "Vse" tu byla navic (zadani 8. 9. 2026) - uhrazene a neuhrazene
// pokryvaji vsechno.
const TABS = [
  { key: 'neuhrazene', label: 'Neuhrazené', paid: false },
  { key: 'uhrazene', label: 'Uhrazené', paid: true },
] as const;

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat('cs-CZ').format(date) : '—';
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { tab?: string; kategorie?: string };
}) {
  await ensureExpenseCategories();

  const activeTab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];
  const categoryFilter = searchParams?.kategorie || '';

  const [expenses, categories, issuers, counts] = await Promise.all([
    prisma.expense.findMany({
      where: {
        paid: activeTab.paid,
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
      include: { category: true, supplier: { select: { name: true } } },
    }),
    prisma.expenseCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { expenses: true } } },
    }),
    prisma.issuerCompany.findMany({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true, defaultCurrency: true },
    }),
    prisma.expense.groupBy({ by: ['paid'], _count: true }),
  ]);

  const projects = await listProjectOptions();

  const countFor = (paid: boolean) => counts.find((c) => c.paid === paid)?._count ?? 0;

  // Soucty za to, co je zrovna videt - po menach, at se nescitaji jablka s hruskami.
  const totals = new Map<string, { exVat: number; incVat: number }>();
  for (const e of expenses) {
    const current = totals.get(e.currency) ?? { exVat: 0, incVat: 0 };
    current.exVat += e.amountExVatMinor;
    current.incVat += expenseTotalMinor(e.amountExVatMinor, e.vatRate);
    totals.set(e.currency, current);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Radky pro tabulku. Texty se formatuji uz tady na serveru, do prohlizece
  // jde jen hotovy retezec a k nemu cislo, podle ktereho se ma radit -
  // podle naformatovaneho textu by razeni nefungovalo ("9. 10." je jako text
  // vetsi nez "10. 9." a stovka s mezerami se nesecte).
  const radkyTabulky: VydajRadek[] = expenses.map((e) => {
    const poSplatnosti = Boolean(!e.paid && e.dueDate && new Date(e.dueDate) < today);
    const podnadpis = [
      e.supplier?.name || e.supplierName,
      e.number ? `č. ${e.number}` : null,
      e.projectName,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      id: e.id,
      nazev: e.description || 'Bez názvu',
      podnadpis: podnadpis || null,
      maPrilohu: Boolean(e.attachmentUrl),
      datum: formatDate(e.issueDate),
      datumMs: e.issueDate ? new Date(e.issueDate).getTime() : null,
      kategorie: e.category?.name || '—',
      splatnost: formatDate(e.dueDate),
      splatnostMs: e.dueDate ? new Date(e.dueDate).getTime() : null,
      poSplatnosti,
      bezDph: formatMoney(e.amountExVatMinor, e.currency),
      bezDphMinor: e.amountExVatMinor,
      celkem: formatMoney(expenseTotalMinor(e.amountExVatMinor, e.vatRate), e.currency),
      celkemMinor: expenseTotalMinor(e.amountExVatMinor, e.vatRate),
      dph: e.vatRate === 0 ? 'bez DPH' : `DPH ${e.vatRate} %`,
      uhrazeno: e.paid,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {TABS.map((tab) => {
            const active = tab.key === activeTab.key;
            const href = `/admin/doklady/vydaje?tab=${tab.key}${categoryFilter ? `&kategorie=${categoryFilter}` : ''}`;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`px-4 py-2 text-sm font-heading font-semibold rounded-pill no-underline transition-colors ${
                  active ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label} <span className="tabular-nums opacity-80">({countFor(tab.paid)})</span>
              </Link>
            );
          })}
        </div>
        <NewExpenseForm
          categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          issuers={issuers.map((i) => ({ id: i.id, name: i.name, isDefault: i.isDefault, currency: i.defaultCurrency }))}
          projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
        />
      </div>

      {/* Soucty za aktualni vyber */}
      {totals.size > 0 && (
        <div className="bg-surface rounded-card border border-line shadow-sm px-5 py-4 flex items-center gap-8 flex-wrap">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {activeTab.label} celkem ({expenses.length})
          </span>
          {Array.from(totals.entries()).map(([currency, sum]) => (
            <span key={currency} className="flex items-baseline gap-3">
              <span className="font-display text-xl text-ink tabular-nums">
                {formatMoney(sum.incVat, currency as never)}
              </span>
              <span className="text-xs font-body text-muted tabular-nums">
                bez DPH {formatMoney(sum.exVat, currency as never)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Filtr podle kategorie. Sprava kategorii sedi hned vedle (zadani
          8. 9. 2026) - drive byla schovana az uplne dole pod tabulkou. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/admin/doklady/vydaje?tab=${activeTab.key}`}
          className={`px-3 py-1.5 text-xs font-heading font-semibold rounded-pill no-underline transition-colors ${
            !categoryFilter ? 'bg-bar text-white' : 'bg-surface border border-line text-muted hover:text-ink'
          }`}
        >
          Všechny kategorie
        </Link>
        {categories
          .filter((c) => c.active || c._count.expenses > 0)
          .map((c) => (
            <Link
              key={c.id}
              href={`/admin/doklady/vydaje?tab=${activeTab.key}&kategorie=${c.id}`}
              className={`px-3 py-1.5 text-xs font-heading font-semibold rounded-pill no-underline transition-colors ${
                categoryFilter === c.id ? 'bg-bar text-white' : 'bg-surface border border-line text-muted hover:text-ink'
              }`}
              >
                {c.name} <span className="tabular-nums opacity-70">({c._count.expenses})</span>
              </Link>
            ))}
        </div>

        <CategoryManager
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            active: c.active,
            usedBy: c._count.expenses,
          }))}
        />
      </div>

      <VydajeTabulka radky={radkyTabulky} />

    </div>
  );
}
