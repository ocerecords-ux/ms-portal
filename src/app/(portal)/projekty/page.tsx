import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  listCaflouProjectsForCompany,
  listAllCaflouProjectsForInternal,
  mapCaflouProjects,
  type DisplayProject,
} from '@/lib/caflou';
import { isInternalRole } from '@/lib/roles';
import { ProjectsTable, type InternalProject, type InternalProjectMeta } from './shared';
import { FinishedProjectsSection } from './FinishedProjectsSection';
import { InternalProjectsBrowser } from './InternalProjectsBrowser';
import { loadColumnLabels } from '@/lib/columnLabelsServer';
import { loadNejnovejsiRodneListy, syncRodneListy } from '@/lib/rodnyListServer';
import { PROJECTS_TABLE_KEY } from '@/lib/columnLabels';

// DULEZITE: tato stranka tahá projekty ZIVE z Caflou při každém zobrazení -
// nesmí ji Next.js pri buildu "zamrazit" jako statickou stránku (to by
// klientovi natvrdo zapeklo výsledek jednoho dotazu z okamžiku buildu,
// včetně případné chyby, a nikdy by se sám neopravil bez nového nasazení).
export const dynamic = 'force-dynamic';

export default async function ProjektyPage() {
  const session = await getServerSession(authOptions);

  // Interni ucty Mediaspace (Zuzo-labuzo / Produkce / Zvukar) nemaji
  // companyId (nepatri pod zadnou firmu) - misto prazdne "nemate zadne
  // projekty" hlasky jim tu ukazeme prehled VSECH projektu z Caflou napric
  // firmami, rozdeleny na aktivni a dokoncene (zadani 5. 9. 2026).
  if (isInternalRole(session!.user.role)) {
    return <InternalProjektySection isAdmin={session!.user.role === 'ADMIN'} />;
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
              (b.endDate?.getTime() ?? b.finishedAt?.getTime() ?? 0) -
              (a.endDate?.getTime() ?? a.finishedAt?.getTime() ?? 0),
          );
      } else {
        loadError = true;
      }
    } catch {
      loadError = true;
    }
  }

  // Rodne listy reklamnich spotu (zadani 9. 9. 2026) - klient je vidi rovnou
  // u projektu. U firmy, ktera reklamy nedela, se sloupec vubec nevykresli.
  const rodneListy = company?.dealsAds
    ? Object.fromEntries(
        await loadNejnovejsiRodneListy([...active, ...finished].map((p) => String(p.id))),
      )
    : undefined;

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
        <ProjectsTable
          projects={active}
          emptyText="Aktuálně nemáte žádné rozpracované projekty."
          rodneListy={rodneListy}
        />
      </div>

      <FinishedProjectsSection projects={finished} rodneListy={rodneListy} />
    </section>
  );
}

async function InternalProjektySection({ isAdmin }: { isAdmin: boolean }) {
  // Nazvy firem si drzime u sebe (Caflou u projektu vraci hlavne ID firmy) -
  // slouzi jen k doplneni sloupce "Firma", samotne projekty uz tahame z
  // Caflou jednim dotazem za cely ucet (viz listAllCaflouProjectsForInternal).
  const companies = await prisma.company.findMany({
    where: { caflouCompanyId: { not: null } },
    select: { name: true, caflouCompanyId: true },
    orderBy: { name: 'asc' },
  });
  const { projects, error } = await listAllCaflouProjectsForInternal(
    companies.map((c) => ({ name: c.name, caflouCompanyId: c.caflouCompanyId! })),
  );

  // Rodne listy reklamnich spotu (zadani 9. 9. 2026). Caflou nam zmenu stavu
  // nehlasi, takze se porovna s poslednim videnym stavem prave tady - interni
  // prehled projektu je misto, kam se produkce diva nejcasteji. Kdyz se stav
  // od minule nezmenil, neudela to nic; opakovane nacteni stranky tedy zadny
  // duplicitni dokument nevyrobi.
  await syncRodneListy(
    projects.map((p) => ({
      caflouProjectId: String(p.id),
      projectName: p.name,
      statusName: p.statusName,
      caflouCompanyId: p.caflouCompanyId,
    })),
  );

  // Nase vlastni atributy k projektum (priorita, typ, manazer) - jednim
  // dotazem pro vsechny nactene projekty najednou.
  const metas = projects.length
    ? await prisma.projectMeta.findMany({
        where: { caflouProjectId: { in: projects.map((p) => String(p.id)) } },
        include: { manager: { select: { name: true, email: true } } },
      })
    : [];
  const metaById = new Map(
    metas.map((m): [string, InternalProjectMeta] => [
      m.caflouProjectId,
      {
        priority: m.priority,
        projectType: m.projectType,
        managerName: m.manager ? m.manager.name || m.manager.email : null,
      },
    ]),
  );

  const withMeta: InternalProject[] = projects.map((p) => ({
    ...p,
    meta: metaById.get(String(p.id)) ?? null,
  }));

  // Nazvy sloupcu - vychozi prepsane tim, co si Zuzo-labuzo prejmenovalo.
  const columnLabels = await loadColumnLabels(PROJECTS_TABLE_KEY);

  const active = withMeta
    .filter((p) => !p.finished)
    .sort((a, b) => (a.endDate?.getTime() ?? Infinity) - (b.endDate?.getTime() ?? Infinity));
  const finished = withMeta
    .filter((p) => p.finished)
    .sort(
      (a, b) =>
        (b.endDate?.getTime() ?? b.finishedAt?.getTime() ?? 0) -
        (a.endDate?.getTime() ?? a.finishedAt?.getTime() ?? 0),
    );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Projekty</h1>
        {error && (
          <span className="text-xs font-heading text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2">
            Projekty se nepodařilo načíst z Caflou. {error}
          </span>
        )}
      </div>

      <InternalProjectsBrowser
        active={active}
        finished={finished}
        labels={columnLabels}
        canEditLabels={isAdmin}
      />
    </section>
  );
}
