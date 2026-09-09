import Link from 'next/link';
import { prisma } from '@/lib/db';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { NewInvoiceForm } from './NewInvoiceForm';

// Prehled vydanych faktur (zadani 6. 9. 2026). Zalozky podle stavu - nejdulezitejsi
// je videt, co je jeste neuhrazene a co je uz po splatnosti.
export const dynamic = 'force-dynamic';

// Zalozka "Vse" tu byla navic (zadani 8. 9. 2026) - stavy pokryvaji vsechno.
const TABS = [
  { key: 'rozpracovane', label: 'Rozpracované', statuses: ['DRAFT'] },
  { key: 'neuhrazene', label: 'Neuhrazené', statuses: ['SENT'] },
  { key: 'uhrazene', label: 'Uhrazené', statuses: ['PAID'] },
  { key: 'stornovane', label: 'Stornované', statuses: ['CANCELLED'] },
] as const;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rozpracovaná',
  SENT: 'Neuhrazená',
  PAID: 'Uhrazená',
  CANCELLED: 'Stornovaná',
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-tint text-brand-purpleDark',
  PAID: 'bg-okTint text-status-done',
  CANCELLED: 'bg-dangerTint text-danger',
};

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat('cs-CZ').format(date) : '—';
}

export default async function InvoicesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const activeTab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];

  const [invoices, issuers, companies, approvedOffers, counts] = await Promise.all([
    prisma.invoice.findMany({
      where: activeTab.statuses ? { status: { in: activeTab.statuses as never } } : {},
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      take: 300,
      include: { company: { select: { name: true } }, items: true },
    }),
    prisma.issuerCompany.findMany({ where: { active: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.offer.findMany({
      where: { status: 'APPROVED', invoice: null },
      orderBy: { issueDate: 'desc' },
      select: { id: true, number: true, subject: true, company: { select: { name: true } } },
    }),
    prisma.invoice.groupBy({ by: ['status'], _count: true }),
  ]);

  const countFor = (statuses: readonly string[] | null) =>
    statuses
      ? counts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count, 0)
      : counts.reduce((sum, c) => sum + c._count, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Souhrn nad seznamem - kolik je v jake mene neuhrazeno.
  const unpaid = invoices.filter((i) => i.status === 'SENT');
  const unpaidByCurrency = new Map<string, number>();
  for (const invoice of unpaid) {
    const totals = computeTotals(invoice.items);
    unpaidByCurrency.set(invoice.currency, (unpaidByCurrency.get(invoice.currency) ?? 0) + totals.incVat);
  }

  return (
    <div className="flex flex-col gap-6">
      {issuers.length === 0 ? (
        <div className="bg-surface rounded-card border border-line shadow-sm px-6 py-10 text-center">
          <p className="font-heading font-semibold text-ink m-0">Nejdřív si založte fakturační firmu</p>
          <p className="text-sm text-muted font-body m-0 mt-1 max-w-lg mx-auto">
            Faktura se vystavuje za konkrétní firmu a bere si z ní číselnou řadu i bankovní účet.
          </p>
          <Link
            href="/admin/doklady/moje-firmy"
            className="inline-block mt-4 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 no-underline"
          >
            Přejít na Moje firmy
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {TABS.map((tab) => {
                const active = tab.key === activeTab.key;
                return (
                  <Link
                    key={tab.key}
                    href={`/admin/doklady/faktury?tab=${tab.key}`}
                    className={`px-4 py-2 text-sm font-heading font-semibold rounded-pill no-underline transition-colors ${
                      active ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {tab.label} <span className="tabular-nums opacity-80">({countFor(tab.statuses)})</span>
                  </Link>
                );
              })}
            </div>
            <NewInvoiceForm
              issuers={issuers.map((i) => ({ id: i.id, name: i.name, isDefault: i.isDefault }))}
              companies={companies}
              offers={approvedOffers.map((o) => ({
                id: o.id,
                label: `${o.number} — ${o.company.name}${o.subject ? ` (${o.subject})` : ''}`,
              }))}
            />
          </div>

          {unpaidByCurrency.size > 0 && (
            <div className="bg-surface rounded-card border border-line shadow-sm px-5 py-4 flex items-center gap-6 flex-wrap">
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Neuhrazeno celkem</span>
              {Array.from(unpaidByCurrency.entries()).map(([currency, amount]) => (
                <span key={currency} className="font-display text-xl text-ink tabular-nums">
                  {formatMoney(amount, currency as never)}
                </span>
              ))}
            </div>
          )}

          <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-ink text-white font-heading text-xs">
                    {/* Nazev je prvni a proklikavaci - u vsech dokladu stejne
                        (zadani 8. 9. 2026). Cislo dokladu je pod nim. */}
                    <th className="text-left px-4 py-3.5">Název</th>
                    <th className="text-left px-4 py-3.5">Odběratel</th>
                    <th className="text-left px-4 py-3.5 whitespace-nowrap">Vystaveno</th>
                    <th className="text-left px-4 py-3.5 whitespace-nowrap">Splatnost</th>
                    <th className="text-left px-4 py-3.5 whitespace-nowrap">Stav</th>
                    <th className="text-right px-4 py-3.5 whitespace-nowrap">K úhradě</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm font-body">
                        Tady zatím nic není.
                      </td>
                    </tr>
                  )}
                  {invoices.map((invoice) => {
                    const totals = computeTotals(invoice.items);
                    const overdue =
                      invoice.status === 'SENT' && invoice.dueDate && new Date(invoice.dueDate) < today;
                    return (
                      <tr key={invoice.id} className="border-t border-line hover:bg-surfaceSoft">
                        <td className="px-4 py-3.5 font-heading font-semibold text-sm">
                          <Link
                            href={`/admin/doklady/faktury/${invoice.id}`}
                            className="text-ink hover:text-brand-purple no-underline"
                          >
                            {invoice.subject || 'Bez názvu'}
                          </Link>
                          <span className="block text-xs text-muted font-body">
                            <span className="tabular-nums">{invoice.number}</span>
                            {invoice.projectName ? ` · ${invoice.projectName}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-heading text-muted">{invoice.company.name}</td>
                        <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                          {formatDate(invoice.issueDate)}
                        </td>
                        <td
                          className={`px-4 py-3.5 text-sm font-heading tabular-nums whitespace-nowrap ${
                            overdue ? 'text-danger font-semibold' : 'text-muted'
                          }`}
                        >
                          {formatDate(invoice.dueDate)}
                          {overdue && <span className="block text-[11px] font-body">po splatnosti</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${STATUS_CLASSES[invoice.status]}`}
                          >
                            {STATUS_LABELS[invoice.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-heading text-ink tabular-nums text-right whitespace-nowrap">
                          {formatMoney(totals.incVat, invoice.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
