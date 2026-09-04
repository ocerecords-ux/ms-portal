import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listCaflouProjectsForCompany, mapCaflouProjects, type DisplayProject } from '@/lib/caflou';
import { ProjectsTable } from './shared';
import { FinishedProjectsSection } from './FinishedProjectsSection';

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
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Projekty</h1>
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

      <FinishedProjectsSection projects={finished} />
    </section>
  );
}
