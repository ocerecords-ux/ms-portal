import Link from 'next/link';
import { prisma } from '@/lib/db';
import { computeTotals, formatMoney, OFFER_STATUS_CLASSES, OFFER_STATUS_LABELS } from '@/lib/doklady';
import { NewOfferForm } from './NewOfferForm';
import { NabidkyTabulka, type NabidkaRadek } from './NabidkyTabulka';

// Prehled nabidek (zadani 6. 9. 2026). Zalozky podle stavu, at je hned videt,
// co ceka na klienta a co uz je odsouhlasene.
export const dynamic = 'force-dynamic';

// Zalozka "Vse" tu byla navic (zadani 8. 9. 2026) - stavy pokryvaji vsechno.
const TABS = [
  { key: 'rozpracovane', label: 'Rozpracované', statuses: ['DRAFT'] },
  { key: 'odeslane', label: 'Odeslané', statuses: ['SENT'] },
  { key: 'schvalene', label: 'Schválené', statuses: ['APPROVED'] },
  { key: 'odmitnute', label: 'Odmítnuté', statuses: ['REJECTED'] },
] as const;

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat('cs-CZ').format(date) : '—';
}

export default async function OffersPage({ searchParams }: { searchParams: { tab?: string } }) {
  const activeTab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];

  const [offers, issuers, companies, counts] = await Promise.all([
    prisma.offer.findMany({
      where: activeTab.statuses ? { status: { in: activeTab.statuses as never } } : {},
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      take: 300,
      include: { company: { select: { name: true } }, items: true },
    }),
    prisma.issuerCompany.findMany({ where: { active: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.offer.groupBy({ by: ['status'], _count: true }),
  ]);

  const countFor = (statuses: readonly string[] | null) =>
    statuses
      ? counts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count, 0)
      : counts.reduce((sum, c) => sum + c._count, 0);

  // Poradi pri razeni podle stavu: co ceka na akci, jde napred.
  const stavPoradi: Record<string, number> = { SENT: 0, DRAFT: 1, APPROVED: 2, REJECTED: 3 };

  const radkyTabulky: NabidkaRadek[] = offers.map((offer) => {
    const totals = computeTotals(offer.items);
    return {
      id: offer.id,
      nazev: offer.subject || 'Bez názvu',
      cislo: offer.number,
      projekt: offer.projectName || null,
      odberatel: offer.company.name,
      vystaveno: formatDate(offer.issueDate),
      vystavenoMs: offer.issueDate ? new Date(offer.issueDate).getTime() : null,
      stav: OFFER_STATUS_LABELS[offer.status] ?? offer.status,
      stavTrida: OFFER_STATUS_CLASSES[offer.status] ?? 'bg-field text-muted',
      stavPoradi: stavPoradi[offer.status] ?? 9,
      bezDph: formatMoney(totals.exVat, offer.currency),
      bezDphMinor: totals.exVat,
      sDph: formatMoney(totals.incVat, offer.currency),
      sDphMinor: totals.incVat,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {issuers.length === 0 ? (
        <div className="bg-surface rounded-card border border-line shadow-sm px-6 py-10 text-center">
          <p className="font-heading font-semibold text-ink m-0">Nejdřív si založte fakturační firmu</p>
          <p className="text-sm text-muted font-body m-0 mt-1 max-w-lg mx-auto">
            Nabídka se vystavuje za konkrétní firmu a bere si z ní číselnou řadu.
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
                    href={`/admin/doklady/nabidky?tab=${tab.key}`}
                    className={`px-4 py-2 text-sm font-heading font-semibold rounded-pill no-underline transition-colors ${
                      active ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {tab.label} <span className="tabular-nums opacity-80">({countFor(tab.statuses)})</span>
                  </Link>
                );
              })}
            </div>
            <NewOfferForm
              issuers={issuers.map((i) => ({ id: i.id, name: i.name, isDefault: i.isDefault }))}
              companies={companies}
            />
          </div>

          <NabidkyTabulka radky={radkyTabulky} />
        </>
      )}
    </div>
  );
}
