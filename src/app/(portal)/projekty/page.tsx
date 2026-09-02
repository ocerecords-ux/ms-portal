import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const STATUS_STYLE: Record<string, string> = {
  Nové: 'bg-[#F1ECFF] text-status-new',
  'V realizaci': 'bg-[#FDF1DE] text-status-progress',
  Hotovo: 'bg-[#E3F9EC] text-status-done',
};

function formatDate(d: Date | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('cs-CZ').format(d);
}

export default async function ProjektyPage() {
  const session = await getServerSession(authOptions);
  // Klic tenant izolace: companyId bereme VYHRADNE ze session, nikdy z query/parametru.
  const companyId = session!.user.companyId;

  const [company, projects] = companyId
    ? await Promise.all([
        prisma.company.findUnique({ where: { id: companyId } }),
        prisma.project.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
        }),
      ])
    : [null, []];

  return (
    <section>
      <div className="flex items-baseline justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Moje projekty</h1>
          <p className="text-muted text-sm mt-1 font-body">
            {company ? `${company.name} — aktivní i dokončené audioknihy` : 'Aktivní i dokončené audioknihy'}
          </p>
        </div>
        {!company?.caflouTag && (
          <span className="text-xs font-heading text-brand-purpleDark bg-[#F1ECFF] border border-line rounded-lg px-3 py-2">
            Napojení na Caflou zatím čeká na přiřazení štítku klienta
          </span>
        )}
      </div>

      <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-brand-purple text-white font-heading text-xs">
                <th className="text-left px-4 py-3.5">Projekt</th>
                <th className="text-left px-4 py-3.5">Stav</th>
                <th className="text-left px-4 py-3.5">Herec</th>
                <th className="text-left px-4 py-3.5">Datum dokončení</th>
                <th className="text-left px-4 py-3.5">Datum vydání</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm font-body">
                    Zatím tu nemáte žádné projekty. Nový vznikne automaticky po odeslání objednávky.
                  </td>
                </tr>
              )}
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-line hover:bg-[#FAF8FF]">
                  <td className="px-4 py-4 font-heading font-semibold text-sm text-ink">{p.name}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-heading font-semibold px-3 py-1 rounded-pill ${STATUS_STYLE[p.status ?? ''] ?? 'bg-field text-muted'}`}>
                      {p.status ?? 'Nové'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm font-heading">{p.narrator ?? '—'}</td>
                  <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums">{formatDate(p.finishDate)}</td>
                  <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums">{formatDate(p.releaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
