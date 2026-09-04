import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  listCaflouProjectsForCompany,
  listActiveCaflouProjectsForCompanies,
  mapCaflouProjects,
  type DisplayProject,
} from '@/lib/caflou';
import { ProjectsTable, AdminProjectsTable } from './shared';
import { FinishedProjectsSection } from './FinishedProjectsSection';

// DULEZITE: tato stranka tahá projekty ZIVE z Caflou při každém zobrazení -
// nesmí ji Next.js pri buildu "zamrazit" jako statickou stránku (to by
// klientovi natvrdo zapeklo výsledek jednoho dotazu z okamžiku buildu,
// včetně případné chyby, a nikdy by se sám neopravil bez nového nasazení).
export const dynamic = 'force-dynamic';

export default async function ProjektyPage() {
  const session = await getServerSession(authOptions);

  // ADMIN ucty nemaji companyId (nepatri pod zadnou firmu) - misto prazdne
  // "nemate zadne projekty" hlasky jim tu ukazeme prehled aktivnich projektu
  // NAPRIC vsemi firmami najednou, at maji rychly prehled z jednoho mista.
  if (session!.user.role === 'ADMIN') {
    return <AdminProjektySection />;
  }

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

async function AdminProjektySection() {
  const companies = await prisma.company.findMany({
    where: { active: true, caflouCompanyId: { not: null } },
    select: { name: true, caflouCompanyId: true },
    orderBy: { name: 'asc' },
  });

  const { projects, failedCompanies } = await listActiveCaflouProjectsForCompanies(
    companies.map((c) => ({ name: c.name, caflouCompanyId: c.caflouCompanyId! })),
  );

  const active = projects
    .filter((p) => !p.finished)
    .sort((a, b) => (a.endDate?.getTime() ?? Infinity) - (b.endDate?.getTime() ?? Infinity));

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Projekty — všechny firmy</h1>
        {companies.length === 0 && (
          <span className="text-xs font-heading text-brand-purpleDark bg-[#F1ECFF] border border-line rounded-lg px-3 py-2">
            Žádná firma zatím nemá napojení na Caflou
          </span>
        )}
        {failedCompanies.length > 0 && (
          <span className="text-xs font-heading text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2">
            Nepodařilo se načíst projekty z Caflou u: {failedCompanies.join(', ')}
          </span>
        )}
      </div>

      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
          Aktivní projekty
        </h2>
        <AdminProjectsTable projects={active} emptyText="Aktuálně nejsou žádné rozpracované projekty." />
      </div>
    </section>
  );
}
