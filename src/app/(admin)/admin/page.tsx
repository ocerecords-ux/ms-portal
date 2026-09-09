import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NewCompanyForm } from './NewCompanyForm';
import { COMPANY_TYPE_TABS } from '@/lib/roles';
import { AdminSearch } from './AdminSearch';
import { FirmyTabulka, type FirmaRadek } from './FirmyTabulka';

// Firmy se od 5. 9. 2026 deli na zalozky Klienti / Dodavatele (zadani:
// "sekci Firmy bych rozdělil na Klienti a Dodavatele") - stejny vzor jako
// zalozky na /admin/users, jen podle CompanyType misto role.
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string };
}) {
  const activeTab = COMPANY_TYPE_TABS.find((t) => t.key === searchParams?.tab) ?? COMPANY_TYPE_TABS[0];
  // Hledani napric nazvem, IC, kodem i kontaktem (zadani 6. 9. 2026).
  const q = searchParams?.q?.trim() || '';

  const [companies, typeCounts] = await Promise.all([
    prisma.company.findMany({
      where: {
        type: activeTab.type,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { code: { contains: q, mode: 'insensitive' as const } },
                { ic: { contains: q, mode: 'insensitive' as const } },
                { contactName: { contains: q, mode: 'insensitive' as const } },
                { contactEmail: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, orders: true } } },
    }),
    prisma.company.groupBy({ by: ['type'], _count: { type: true } }),
  ]);

  const countFor = (type: string) => typeCounts.find((t) => t.type === type)?._count.type ?? 0;

  const radkyFirem: FirmaRadek[] = companies.map((c) => ({
    id: c.id,
    kod: c.code || null,
    nazev: c.name,
    sazba: c.ratePerPage ?? null,
    uzivatelu: c._count.users,
    objednavek: c._count.orders,
    kontaktniOsoba: c.contactName || null,
    telefonEmail: [c.contactPhone, c.contactEmail].filter(Boolean).join(' / ') || null,
    ic: c.ic || null,
  }));

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink m-0">Firmy</h1>
        </div>
        {/* Surovy seznam firem z Caflou k roztrideni (zadani 8. 9. 2026). */}
        <Link
          href="/admin/caflou-firmy"
          className="font-heading font-semibold text-sm rounded-lg border border-line bg-surface px-4 py-2.5 text-brand-purple no-underline hover:border-brand-purple transition-colors whitespace-nowrap"
        >
          Firmy z Caflou
        </Link>
      </div>

      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-line">
        <div className="flex items-center gap-1">
        {COMPANY_TYPE_TABS.map((tab) => {
          const active = tab.key === activeTab.key;
          return (
            <Link
              key={tab.key}
              href={`/admin?tab=${tab.key}`}
              className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                active ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label} <span className="tabular-nums">({countFor(tab.type)})</span>
            </Link>
          );
        })}
        </div>
        <div className="mb-2">
          <AdminSearch placeholder="Hledat firmu, IČ, kontakt…" />
        </div>
      </div>

      {/* Vlastni ramecek nepridavame - RaditelnaTabulka uz ho ma. */}
      <FirmyTabulka
        key={activeTab.key}
        radky={radkyFirem}
        druh={activeTab.type === 'KLIENT' ? 'klienti' : 'dodavatele'}
        prazdno={
          q
            ? 'Hledání nic nenašlo.'
            : activeTab.type === 'KLIENT'
              ? 'Zatím žádný klient. Založte prvního tlačítkem níže.'
              : 'Zatím žádný dodavatel. Založte prvního tlačítkem níže.'
        }
      />

      {/* key vynuti remount pri prepnuti zalozky Klienti/Dodavatele - stejny
          bug jako u /admin/users NewUserForm (5. 9. 2026): bez key si
          klientsky komponent drzi puvodni useState(type) z prvniho mountu. */}
      <div className="max-w-3xl w-full">
        <NewCompanyForm key={activeTab.key} defaultType={activeTab.type} />
      </div>
    </section>
  );
}
