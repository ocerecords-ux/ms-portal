import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { CompanyForm } from './CompanyForm';
import { UserForm } from './UserForm';
import { CaflouTestPanel } from './CaflouTestPanel';

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: { users: { orderBy: { createdAt: 'asc' } } },
  });
  if (!company) notFound();

  return (
    <section className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-muted text-sm font-heading">
          ← Zpět na seznam klientů
        </Link>
        <h1 className="font-display text-3xl text-ink m-0 mt-2">{company.name}</h1>
      </div>

      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">Údaje firmy</h2>
        <CompanyForm company={company} />
        <div className="mt-4">
          <CaflouTestPanel companyId={company.id} />
        </div>
      </div>

      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">Přihlašovací účty</h2>
        <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-field text-ink font-heading text-xs">
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-left px-4 py-3">Jméno</th>
                <th className="text-left px-4 py-3">Založen</th>
              </tr>
            </thead>
            <tbody>
              {company.users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted text-sm font-body">
                    Tato firma zatím nemá žádný přihlašovací účet.
                  </td>
                </tr>
              )}
              {company.users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3 text-sm font-heading">{u.email}</td>
                  <td className="px-4 py-3 text-sm font-heading text-muted">{u.name || '—'}</td>
                  <td className="px-4 py-3 text-sm font-heading text-muted tabular-nums">
                    {new Intl.DateTimeFormat('cs-CZ').format(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <UserForm companyId={company.id} />
      </div>
    </section>
  );
}
