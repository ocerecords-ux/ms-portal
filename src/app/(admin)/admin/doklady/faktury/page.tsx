import Link from 'next/link';
import { prisma } from '@/lib/db';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { NewInvoiceForm } from './NewInvoiceForm';
import { FakturyTabulka, type FakturaRadek } from './FakturyTabulka';

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

// Poradi pri razeni podle stavu: co ceka na akci, jde napred.
const STATUS_PORADI: Record<string, number> = {
  SENT: 0,
  DRAFT: 1,
  PAID: 2,
  CANCELLED: 3,
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

  // Radky pro tabulku. Formatuje se tady na serveru, do prohlizece jde hotovy
  // text a k nemu cislo pro razeni - podle vypsaneho textu by razeni datumu
  // ani castek nefungovalo.
  const radkyTabulky: FakturaRadek[] = invoices.map((invoice) => {
    const totals = computeTotals(invoice.items);
    return {
      id: invoice.id,
      nazev: invoice.subject || 'Bez názvu',
      cislo: invoice.number,
      projekt: invoice.projectName || null,
      odberatel: invoice.company.name,
      vystaveno: formatDate(invoice.issueDate),
      vystavenoMs: invoice.issueDate ? new Date(invoice.issueDate).getTime() : null,
      splatnost: formatDate(invoice.dueDate),
      splatnostMs: invoice.dueDate ? new Date(invoice.dueDate).getTime() : null,
      poSplatnosti: Boolean(
        invoice.status === 'SENT' && invoice.dueDate && new Date(invoice.dueDate) < today,
      ),
      stav: STATUS_LABELS[invoice.status] ?? invoice.status,
      stavTrida: STATUS_CLASSES[invoice.status] ?? 'bg-field text-muted',
      stavPoradi: STATUS_PORADI[invoice.status] ?? 9,
      castka: formatMoney(totals.incVat, invoice.currency),
      castkaMinor: totals.incVat,
    };
  });

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

          <FakturyTabulka radky={radkyTabulky} />
        </>
      )}
    </div>
  );
}
