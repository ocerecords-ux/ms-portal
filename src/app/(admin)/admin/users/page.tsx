import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NewUserForm } from './NewUserForm';
import { ROLE_LABELS } from '@/lib/roles';

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: { companyId?: string };
}) {
  const companyId = searchParams?.companyId;

  const [users, companies] = await Promise.all([
    prisma.user.findMany({
      where: companyId ? { companyId } : {},
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.company.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const filteredCompany = companyId ? companies.find((c) => c.id === companyId) : null;

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Uživatelé</h1>
        <p className="text-muted text-sm mt-1 font-body">
          Všechny přihlašovací účty napříč firmami i interní účty MEDIA SPACE. Uživatele zakládáte tady a párujete s firmou.
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

      <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="bg-ink text-white font-heading text-xs">
                <th className="text-left px-4 py-3.5">Jméno</th>
                <th className="text-left px-4 py-3.5">E-mail</th>
                <th className="text-left px-4 py-3.5">Telefon</th>
                <th className="text-left px-4 py-3.5">Role</th>
                <th className="text-left px-4 py-3.5">Firma</th>
                <th className="text-left px-4 py-3.5">Aktivní</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted text-sm font-body">
                    Žádný uživatel neodpovídá filtru.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line hover:bg-[#FAF8FF]">
                  <td className="px-4 py-3.5 font-heading font-semibold text-sm text-ink">{u.name || '—'}</td>
                  <td className="px-4 py-3.5 text-sm font-heading">{u.email}</td>
                  <td className="px-4 py-3.5 text-sm font-heading tabular-nums">{u.phone || '—'}</td>
                  <td className="px-4 py-3.5 text-sm font-heading">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-3.5 text-sm font-heading text-muted">
                    {u.company ? (
                      <Link href={`/admin/companies/${u.company.id}`} className="hover:text-brand-purple">
                        {u.company.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-heading">
                    {u.active ? 'Ano' : <span className="text-red-600">Ne</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/admin/users/${u.id}`} className="text-brand-purple text-sm font-heading font-semibold">
                      Upravit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewUserForm companies={companies.map((c) => ({ id: c.id, name: c.name }))} defaultCompanyId={companyId} />
    </section>
  );
}
