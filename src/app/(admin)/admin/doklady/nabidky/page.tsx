import Link from 'next/link';
import { prisma } from '@/lib/db';
import { computeTotals, formatMoney, OFFER_STATUS_CLASSES } from '@/lib/doklady';
import { nactiJazyk } from '@/lib/jazykServer';
import { formatDatum, prelozit } from '@/lib/jazyk';
import { NewOfferForm } from './NewOfferForm';
import { NabidkyTabulka, type NabidkaRadek } from './NabidkyTabulka';

// Prehled nabidek (zadani 6. 9. 2026). Zalozky podle stavu, at je hned videt,
// co ceka na klienta a co uz je odsouhlasene.
export const dynamic = 'force-dynamic';

// Zalozka "Vse" tu byla navic (zadani 8. 9. 2026) - stavy pokryvaji vsechno.
const TABS = [
  { key: 'rozpracovane', klic: 'nabidka.zalozkaRozpracovane', statuses: ['DRAFT'] },
  { key: 'odeslane', klic: 'nabidka.zalozkaOdeslane', statuses: ['SENT'] },
  { key: 'schvalene', klic: 'nabidka.zalozkaSchvalene', statuses: ['APPROVED'] },
  { key: 'odmitnute', klic: 'nabidka.zalozkaOdmitnute', statuses: ['REJECTED'] },
] as const;

/**
 * Stav nabidky ve slovniku (davka 4). OFFER_STATUS_LABELS z lib/doklady je
 * jen cesky - klice necha stav prelozit i v anglicke verzi portalu.
 */
const KLICE_STAVU: Record<string, string> = {
  DRAFT: 'nabidka.stav.rozpracovana',
  SENT: 'nabidka.stav.odeslana',
  APPROVED: 'nabidka.stav.schvalena',
  REJECTED: 'nabidka.stav.odmitnuta',
};

export default async function OffersPage({ searchParams }: { searchParams: { tab?: string } }) {
  const jazyk = nactiJazyk();
  const activeTab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];

  const [offers, issuers, counts] = await Promise.all([
    prisma.offer.findMany({
      where: activeTab.statuses ? { status: { in: activeTab.statuses as never } } : {},
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      take: 300,
      include: { company: { select: { name: true } }, items: true },
    }),
    prisma.issuerCompany.findMany({ where: { active: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    prisma.offer.groupBy({ by: ['status'], _count: true }),
  ]);

  const countFor = (statuses: readonly string[] | null) =>
    statuses
      ? counts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count, 0)
      : counts.reduce((sum, c) => sum + c._count, 0);

  // Poradi pri razeni podle stavu: co ceka na akci, jde napred.
  const stavPoradi: Record<string, number> = { SENT: 0, DRAFT: 1, APPROVED: 2, REJECTED: 3 };

  const radkyTabulky: NabidkaRadek[] = offers.map((offer) => {
    const totals = computeTotals(offer.items, offer);
    return {
      id: offer.id,
      nazev: offer.subject || prelozit(jazyk, 'nabidka.bezNazvu'),
      cislo: offer.number,
      projekt: offer.projectName || null,
      odberatel: offer.company.name,
      vystaveno: formatDatum(jazyk, offer.issueDate),
      vystavenoMs: offer.issueDate ? new Date(offer.issueDate).getTime() : null,
      stav: KLICE_STAVU[offer.status] ? prelozit(jazyk, KLICE_STAVU[offer.status]) : offer.status,
      stavTrida: OFFER_STATUS_CLASSES[offer.status] ?? 'bg-field text-muted',
      stavPoradi: stavPoradi[offer.status] ?? 9,
      bezDph: formatMoney(totals.exVat, offer.currency, jazyk),
      bezDphMinor: totals.exVat,
      sDph: formatMoney(totals.incVat, offer.currency, jazyk),
      sDphMinor: totals.incVat,
    };
  });

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      {issuers.length === 0 ? (
        <div className="bg-surface rounded-card border border-line shadow-sm px-6 py-10 text-center">
          <p className="font-heading font-semibold text-ink m-0">
            {prelozit(jazyk, 'nabidka.nejdrivFirmaNadpis')}
          </p>
          <p className="text-sm text-muted font-body m-0 mt-1 max-w-lg mx-auto">
            {prelozit(jazyk, 'nabidka.nejdrivFirmaPopis')}
          </p>
          <Link
            href="/admin/doklady/moje-firmy"
            className="inline-block mt-4 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 no-underline"
          >
            {prelozit(jazyk, 'nabidka.prejitNaMojeFirmy')}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 w-[calc(100%+2rem)] sm:w-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((tab) => {
                const active = tab.key === activeTab.key;
                return (
                  <Link
                    key={tab.key}
                    href={`/admin/doklady/nabidky?tab=${tab.key}`}
                    className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-heading font-semibold rounded-pill no-underline transition-colors ${
                      active ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {prelozit(jazyk, tab.klic)}{' '}
                    <span className="tabular-nums opacity-80">({countFor(tab.statuses)})</span>
                  </Link>
                );
              })}
            </div>
            {/* Na telefonu se doklady nezakládají (21. 9. 2026: „takto zredukujme i stránku Doklady v mobilu") - stejně jako Nový projekt. */}
            <span className="hidden sm:contents">
              <NewOfferForm />
            </span>
          </div>

          <NabidkyTabulka radky={radkyTabulky} />
        </>
      )}
    </div>
  );
}
