import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NewCompanyForm } from './NewCompanyForm';

export default async function AdminHomePage() {
  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true, orders: true } } },
  });

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Klienti</h1>
        <p className="text-muted text-sm mt-1 font-body">
          Tady zadáváte, jaká firma má jakou sazbu za normostranu a složku na Disku — a zakládáte jí přihlašovací účty.
        </p>
      </div>

      <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-ink text-white font-heading text-xs">
                <th className="text-left px-4 py-3.5">Firma</th>
                <th className="text-left px-4 py-3.5">Sazba / normostrana</th>
                <th className="text-left px-4 py-3.5">Uživatelé</th>
                <th className="text-left px-4 py-3.5">Objednávky</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm font-body">
                    Zatím žádná firma. Založte první tlačítkem níže.
                  </td>
                </tr>
              )}
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-[#FAF8FF]">
                  <td className="px-4 py-3.5 font-heading font-semibold text-sm text-ink">{c.name}</td>
                  <td className="px-4 py-3.5 text-sm font-heading tabular-nums">{c.ratePerPage} Kč</td>
                  <td className="px-4 py-3.5 text-sm font-heading tabular-nums">{c._count.users}</td>
                  <td className="px-4 py-3.5 text-sm font-heading tabular-nums">{c._count.orders}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/admin/companies/${c.id}`} className="text-brand-purple text-sm font-heading font-semibold">
                      Upravit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewCompanyForm />
    </section>
  );
}
