import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NewUserForm } from './NewUserForm';
import { UsersTable, type UsersColumn, type UserRow } from './UsersTable';
import { ROLE_LABELS, USER_TABS } from '@/lib/roles';
import { AdminSearch } from '../AdminSearch';

// Bez companyId (default pohled) se uzivatele tridi do 3 zalozek podle
// zadani 5. 9. 2026 (upresneni) - Mediaspace / Klienti / Herci. Dodavatele uz
// tu nejsou, presunuly se pod sekci Firmy. Filtr podle konkretni firmy
// (prichozi z detailu firmy) tyto zalozky obchazi a zustava puvodni plocha
// tabulka - ale ted uz jen pro klienty, protoze jen ti maji companyId.
export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: { companyId?: string; tab?: string; q?: string };
}) {
  const companyId = searchParams?.companyId;
  // Hledani napric jmenem, e-mailem, telefonem a kodem uctu (zadani 6. 9. 2026).
  const q = searchParams?.q?.trim() || '';
  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q, mode: 'insensitive' as const } },
          { code: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};
  const activeTab = USER_TABS.find((t) => t.key === searchParams?.tab) ?? USER_TABS[0];

  const [users, companies, roleCounts] = await Promise.all([
    prisma.user.findMany({
      where: companyId ? { companyId, ...searchWhere } : { role: { in: activeTab.roles }, ...searchWhere },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.company.findMany({ where: { type: 'KLIENT' }, orderBy: { name: 'asc' } }),
    prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
  ]);

  const filteredCompany = companyId ? companies.find((c) => c.id === companyId) : null;
  const countFor = (roles: string[]) =>
    roleCounts.filter((r) => roles.includes(r.role)).reduce((sum, r) => sum + r._count.role, 0);

  const dateFmt = new Intl.DateTimeFormat('cs-CZ');

  // Jedna tabulka pro vsechny zalozky (zadani 9. 9. 2026) - lisi se uz jen
  // tim, ktere sloupce si zalozka vyzada. Jmeno je vzdycky prvni.
  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name ?? '',
    email: u.email,
    phone: u.phone,
    roleLabel: ROLE_LABELS[u.role],
    active: u.active,
    photoUrl: u.photoUrl ?? null,
    birthDate: u.birthDate ? dateFmt.format(u.birthDate) : null,
    birthDateMs: u.birthDate ? u.birthDate.getTime() : null,
    studioLocations: u.studioLocations.length > 0 ? u.studioLocations.join(', ') : null,
    companyName: u.company?.name ?? null,
    companyId: u.company?.id ?? null,
  }));

  const sloupce: UsersColumn[] = filteredCompany
    ? ['jmeno', 'kod', 'email', 'telefon', 'role', 'aktivni']
    : activeTab.key === 'mediaspace'
      ? ['jmeno', 'kod', 'email', 'telefon', 'role', 'narozeni', 'aktivni']
      : activeTab.key === 'herci'
        ? ['jmeno', 'kod', 'email', 'telefon', 'lokace', 'aktivni']
        : ['jmeno', 'kod', 'email', 'telefon', 'firma', 'aktivni'];

  const zalozitUzivatele = (
    <NewUserForm
      // key vynuti remount pri prepnuti zalozky/filtru - jinak si klientsky
      // komponent drzi svuj puvodni useState(role) z prvniho mountu (bug
      // nahlaseny 5. 9. 2026: na zalozce Herci se po prepnuti z jine
      // zalozky ukazovala stara role/pole).
      key={filteredCompany ? `company:${filteredCompany.id}` : `tab:${activeTab.key}`}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      defaultCompanyId={companyId}
      defaultRole={filteredCompany ? 'CLIENT' : activeTab.roles[0]}
    />
  );

  return (
    <section className="flex flex-col gap-8">
      {/* Zalozeni uctu patri nahoru (zadani 9. 9. 2026) - drive bylo az pod
          tabulkou, kde ho pri delsim seznamu nebylo videt. */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink m-0">Uživatelé</h1>
          <p className="text-muted text-sm mt-1 font-body">
            Všechny přihlašovací účty napříč firmami i interní účty Mediaspace. Kliknutím na jméno účet
            otevřete — pozvánku do portálu odešlete odtamtud.
          </p>
          {filteredCompany && (
            <p className="text-sm font-heading mt-2">
              Filtr: <strong>{filteredCompany.name}</strong>{' '}
              <Link href="/admin/users" className="text-brand-purple">
                (zrušit filtr)
              </Link>
            </p>
          )}
        </div>
        <div className="max-w-3xl w-full sm:w-auto">{zalozitUzivatele}</div>
      </div>

      {!filteredCompany && (
        <div className="flex items-end justify-between gap-4 flex-wrap border-b border-line">
          <div className="flex items-center gap-1">
          {USER_TABS.map((tab) => {
            const active = tab.key === activeTab.key;
            return (
              <Link
                key={tab.key}
                href={`/admin/users?tab=${tab.key}`}
                className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                  active
                    ? 'bg-white border-line text-brand-purple'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {tab.label} <span className="tabular-nums">({countFor(tab.roles)})</span>
              </Link>
            );
          })}
          </div>
          <div className="mb-2">
            <AdminSearch placeholder="Hledat jméno, e-mail, telefon…" />
          </div>
        </div>
      )}

      <UsersTable
        rows={rows}
        columns={sloupce}
        emptyText={q ? 'Hledání nic nenašlo.' : 'Žádný uživatel neodpovídá filtru.'}
      />
    </section>
  );
}
