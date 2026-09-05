import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { findCaflouProjectInList, getCaflouProject } from '@/lib/caflou';
import { canEditProjectMeta, isInternalRole, INTERNAL_ROLES } from '@/lib/roles';
import { formatDate, StatusPill } from '../shared';
import { ProjectMetaForm } from './ProjectMetaForm';

// Detail projektu (zadani 5. 9. 2026). Projekt sam o sobe zije v Caflou -
// tady se ctou jeho zakladni udaje a k nim se pripojuji NASE interni
// atributy (odkaz na KZ, manazer, priorita, typ projektu - model ProjectMeta).
//
// Vidi to jen interni ucty MEDIA SPACE; menit smi jen Produkce a Zuzo-labuzo,
// zvukar ma nahled ke cteni (viz lib/roles.ts).
export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isInternalRole(session.user.role)) redirect('/projekty');

  const caflouProjectId = params.id;
  const canEdit = canEditProjectMeta(session.user.role);

  const [caflouDirect, meta, managers] = await Promise.all([
    getCaflouProject(caflouProjectId),
    prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      include: { manager: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { role: { in: INTERNAL_ROLES }, active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Nektere ucty Caflou nevraci detail jednoho projektu - pak projekt
  // dohledame v seznamu vsech projektu.
  const caflou = caflouDirect ?? (await findCaflouProjectInList(caflouProjectId));

  // Nazev firmy k projektu doplnujeme z nasi databaze podle ID firmy v Caflou.
  const company = caflou?.caflouCompanyId
    ? await prisma.company.findFirst({
        where: { caflouCompanyId: caflou.caflouCompanyId },
        select: { id: true, name: true, driveFolderUrl: true },
      })
    : null;

  const project = caflou?.project ?? null;

  return (
    <section className="flex flex-col gap-8">
      <div>
        <Link href="/projekty" className="text-muted text-sm font-heading no-underline">
          ← Zpět na projekty
        </Link>
        <div className="flex items-center gap-4 flex-wrap mt-2">
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">
            {project?.name ?? `Projekt ${caflouProjectId}`}
          </h1>
          {project && <StatusPill finished={project.finished} statusName={project.statusName} />}
        </div>
        {company && <p className="text-muted text-sm font-body mt-1">{company.name}</p>}
      </div>

      {!project && (
        <p className="text-sm font-heading text-red-600 bg-red-50 border border-line rounded-lg px-4 py-3 m-0">
          Údaje o projektu se nepodařilo načíst z Caflou. Interní atributy níže se přesto dají vyplnit a uloží se.
        </p>
      )}

      {project && (
        <div className="bg-white rounded-card border border-line shadow-sm p-6">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0 mb-4">
            Z Caflou
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 m-0">
            <Field label="Herec" value={project.narrator ?? '—'} />
            <Field label="Normostrany" value={project.pageCount != null ? String(project.pageCount) : '—'} />
            <Field label="Zahájení" value={formatDate(project.startDate)} />
            <Field label="Termín" value={formatDate(project.endDate)} />
            <Field label="Dokončeno" value={project.finished ? formatDate(project.finishedAt) : '—'} />
            <Field label="Datum vydání" value={formatDate(project.releaseDate)} />
          </dl>
        </div>
      )}

      <ProjectMetaForm
        caflouProjectId={caflouProjectId}
        canEdit={canEdit}
        managers={managers.map((m) => ({ id: m.id, label: m.name || m.email }))}
        companyDriveFolderUrl={company?.driveFolderUrl ?? null}
        initial={{
          driveUrl: meta?.driveUrl ?? '',
          managerUserId: meta?.managerUserId ?? '',
          priority: meta?.priority ?? '',
          projectType: meta?.projectType ?? '',
        }}
      />
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-heading text-muted uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-heading text-ink m-0 mt-1">{value}</dd>
    </div>
  );
}
