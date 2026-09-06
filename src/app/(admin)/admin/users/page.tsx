import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NewUserForm } from './NewUserForm';
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

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Uživatelé</h1>
        <p className="text-muted text-sm mt-1 font-body">
          Všechny přihlašovací účty napříč firmami i interní účty Mediaspace. Kliknutím na jméno účet otevřete — pozvánku do portálu odešlete odtamtud.
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

      <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {filteredCompany ? (
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-ink text-white font-heading text-xs">
                  <th className="text-left px-4 py-3.5">Kód</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Jméno</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">E-mail</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Telefon</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Typ přístupu</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Aktivní</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm font-body">
                      {q ? 'Hledání nic nenašlo.' : 'Žádný uživatel neodpovídá filtru.'}
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line hover:bg-[#FAF8FF]">
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">{u.code || '—'}</td>
                    <td className="px-4 py-3.5 font-heading font-semibold text-sm whitespace-nowrap">
                      <Link href={`/admin/users/${u.id}`} className="text-ink hover:text-brand-purple no-underline">
                        {u.name || u.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums whitespace-nowrap">{u.phone || '—'}</td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{u.active ? 'Ano' : <span className="text-red-600">Ne</span>}</td>

                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab.key === 'mediaspace' ? (
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-ink text-white font-heading text-xs">
                  <th className="text-left px-4 py-3.5">Kód</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Jméno</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">E-mail</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Telefon</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Typ přístupu</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Datum narození</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Aktivní</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted text-sm font-body">
                      {q ? 'Hledání nic nenašlo.' : 'Žádný uživatel neodpovídá filtru.'}
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line hover:bg-[#FAF8FF]">
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">{u.code || '—'}</td>
                    <td className="px-4 py-3.5 font-heading font-semibold text-sm whitespace-nowrap">
                      <Link href={`/admin/users/${u.id}`} className="text-ink hover:text-brand-purple no-underline">
                        {u.photoUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={u.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover inline-block mr-2 align-middle" />
                        )}
                        {u.name || u.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums whitespace-nowrap">{u.phone || '—'}</td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">
                      {u.birthDate ? dateFmt.format(u.birthDate) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{u.active ? 'Ano' : <span className="text-red-600">Ne</span>}</td>

                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab.key === 'herci' ? (
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="bg-ink text-white font-heading text-xs">
                  <th className="text-left px-4 py-3.5">Kód</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Jméno</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">E-mail</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Telefon</th>
                  <th className="text-left px-4 py-3.5">Lokace</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Aktivní</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm font-body">
                      {q ? 'Hledání nic nenašlo.' : 'Žádný uživatel neodpovídá filtru.'}
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line hover:bg-[#FAF8FF]">
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">{u.code || '—'}</td>
                    <td className="px-4 py-3.5 font-heading font-semibold text-sm whitespace-nowrap">
                      <Link href={`/admin/users/${u.id}`} className="text-ink hover:text-brand-purple no-underline">
                        {u.name || u.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums whitespace-nowrap">{u.phone || '—'}</td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted">
                      {u.studioLocations.length > 0 ? u.studioLocations.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{u.active ? 'Ano' : <span className="text-red-600">Ne</span>}</td>

                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-ink text-white font-heading text-xs">
                  <th className="text-left px-4 py-3.5">Kód</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Jméno</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">E-mail</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Telefon</th>
                  <th className="text-left px-4 py-3.5">Firma</th>
                  <th className="text-left px-4 py-3.5 whitespace-nowrap">Aktivní</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm font-body">
                      {q ? 'Hledání nic nenašlo.' : 'Žádný uživatel neodpovídá filtru.'}
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line hover:bg-[#FAF8FF]">
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">{u.code || '—'}</td>
                    <td className="px-4 py-3.5 font-heading font-semibold text-sm whitespace-nowrap">
                      <Link href={`/admin/users/${u.id}`} className="text-ink hover:text-brand-purple no-underline">
                        {u.name || u.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums whitespace-nowrap">{u.phone || '—'}</td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted">
                      {u.company ? (
                        <Link href={`/admin/companies/${u.company.id}`} className="hover:text-brand-purple">
                          {u.company.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">{u.active ? 'Ano' : <span className="text-red-600">Ne</span>}</td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="max-w-3xl w-full">
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
      </div>
    </section>
  );
}
