import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listCaflouProjectsForCompany, mapCaflouProjects, type DisplayProject } from '@/lib/caflou';

function formatDate(d: Date | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('cs-CZ').format(d);
}

function StatusPill({ finished, statusName }: { finished: boolean; statusName: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-heading font-semibold px-3 py-1 rounded-pill ${
        finished ? 'bg-[#E3F9EC] text-status-done' : 'bg-[#FDF1DE] text-status-progress'
      }`}
    >
      {statusName}
    </span>
  );
}

function ProjectsTable({ projects, emptyText }: { projects: DisplayProject[]; emptyText: string }) {
  return (
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
                  {emptyText}
                </td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-line hover:bg-[#FAF8FF]">
                <td className="px-4 py-4 font-heading font-semibold text-sm text-ink">{p.name}</td>
                <td className="px-4 py-4">
                  <StatusPill finished={p.finished} statusName={p.statusName} />
                </td>
                <td className="px-4 py-4 text-sm font-heading">{p.narrator ?? '—'}</td>
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums">
                  {p.finished ? formatDate(p.finishedAt) : '—'}
                </td>
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums">{formatDate(p.releaseDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ProjektyPage() {
  const session = await getServerSession(authOptions);
  // Klic tenant izolace: companyId bereme VYHRADNE ze session, nikdy z query/parametru.
  const companyId = session!.user.companyId;

  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

  // Projekty se ctou zive z Caflou (viz src/lib/caflou.ts) - portal je uz nikde
  // sam nezaklada ani needituje, "projekty se menezuji hlavne v Caflou".
  let active: DisplayProject[] = [];
  let finished: DisplayProject[] = [];
  let loadError = false;

  if (company?.caflouCompanyId) {
    try {
      const result = await listCaflouProjectsForCompany(company.caflouCompanyId);
      if (result.ok) {
        const all = mapCaflouProjects(result.body);
        active = all
          .filter((p) => !p.finished)
          .sort((a, b) => (a.endDate?.getTime() ?? Infinity) - (b.endDate?.getTime() ?? Infinity));
        finished = all
          .filter((p) => p.finished)
          .sort(
            (a, b) =>
              (b.finishedAt?.getTime() ?? b.endDate?.getTime() ?? 0) -
              (a.finishedAt?.getTime() ?? a.endDate?.getTime() ?? 0),
          );
      } else {
        loadError = true;
      }
    } catch {
      loadError = true;
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Moje projekty</h1>
          <p className="text-muted text-sm mt-1 font-body">
            {company ? `${company.name} — aktivní i dokončené audioknihy` : 'Aktivní i dokončené audioknihy'}
          </p>
        </div>
        {!company?.caflouCompanyId && (
          <span className="text-xs font-heading text-brand-purpleDark bg-[#F1ECFF] border border-line rounded-lg px-3 py-2">
            Napojení na Caflou zatím čeká na dokončení nastavení
          </span>
        )}
        {company?.caflouCompanyId && loadError && (
          <span className="text-xs font-heading text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2">
            Projekty se nepodařilo načíst z Caflou. Zkuste to prosím později.
          </span>
        )}
      </div>

      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
          Aktivní projekty
        </h2>
        <ProjectsTable projects={active} emptyText="Aktuálně nemáte žádné rozpracované projekty." />
      </div>

      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
          Dokončené projekty
        </h2>
        <ProjectsTable projects={finished} emptyText="Zatím tu nemáte žádné dokončené projekty." />
      </div>
    </section>
  );
}
