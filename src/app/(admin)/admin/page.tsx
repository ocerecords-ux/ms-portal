import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NewCompanyForm } from './NewCompanyForm';
import { COMPANY_TYPE_TABS } from '@/lib/roles';
import { AdminSearch } from './AdminSearch';

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

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Firmy</h1>
        <p className="text-muted text-sm mt-1 font-body">
          Kliknutím na název firmu otevřete. Klienti mají navíc napojení na Caflou a složku na Disku.
        </p>
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
                active ? 'bg-white border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
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

      <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {activeTab.type === 'KLIENT' ? (
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-ink text-white font-heading text-xs">
                  <th className="text-left px-4 py-3.5">Kód</th>
                  <th className="text-left px-4 py-3.5">Firma</th>
                  <th className="text-left px-4 py-3.5">Sazba / normostrana</th>
                  <th className="text-left px-4 py-3.5">Uživatelé</th>
                  <th className="text-left px-4 py-3.5">Objednávky</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm font-body">
                      {q ? 'Hledání nic nenašlo.' : 'Zatím žádný klient. Založte prvního tlačítkem níže.'}
                    </td>
                  </tr>
                )}
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-line hover:bg-[#FAF8FF]">
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">{c.code || '—'}</td>
                    <td className="px-4 py-3.5 font-heading font-semibold text-sm whitespace-nowrap">
                      <Link href={`/admin/companies/${c.id}`} className="text-ink hover:text-brand-purple no-underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums">{c.ratePerPage ?? '—'} Kč</td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums">{c._count.users}</td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums">{c._count.orders}</td>

                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-ink text-white font-heading text-xs">
                  <th className="text-left px-4 py-3.5">Kód</th>
                  <th className="text-left px-4 py-3.5">Firma</th>
                  <th className="text-left px-4 py-3.5">Kontaktní osoba</th>
                  <th className="text-left px-4 py-3.5">Telefon / e-mail</th>
                  <th className="text-left px-4 py-3.5">IČ</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm font-body">
                      {q ? 'Hledání nic nenašlo.' : 'Zatím žádný dodavatel. Založte prvního tlačítkem níže.'}
                    </td>
                  </tr>
                )}
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-line hover:bg-[#FAF8FF]">
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">{c.code || '—'}</td>
                    <td className="px-4 py-3.5 font-heading font-semibold text-sm whitespace-nowrap">
                      <Link href={`/admin/companies/${c.id}`} className="text-ink hover:text-brand-purple no-underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading">{c.contactName || '—'}</td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted">
                      {[c.contactPhone, c.contactEmail].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums">{c.ic || '—'}</td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* key vynuti remount pri prepnuti zalozky Klienti/Dodavatele - stejny
          bug jako u /admin/users NewUserForm (5. 9. 2026): bez key si
          klientsky komponent drzi puvodni useState(type) z prvniho mountu. */}
      <div className="max-w-3xl w-full">
        <NewCompanyForm key={activeTab.key} defaultType={activeTab.type} />
      </div>
    </section>
  );
}
