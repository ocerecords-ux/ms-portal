import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { findCaflouProjectInList, getCaflouProject } from '@/lib/caflou';
import { canEditProjectMeta, canManageCalendar, canViewProjectDocuments, isInternalRole, INTERNAL_ROLES } from '@/lib/roles';
import { PRIORITY_LABELS } from '@/lib/projectTypes';
import { listProjectTypeOptions } from '@/lib/priceList';
import { DEFAULT_BUDGET_SETTINGS, computeBudget } from '@/lib/budget';
import { durationMinutes, entryAmount, toHours } from '@/lib/timesheets';
import { ProjectBudget } from './ProjectBudget';
import { formatDate, StatusPill } from '../shared';
import { ProjectMetaForm } from './ProjectMetaForm';
import { ProjectDocuments, invoiceStatus, offerStatus, type ProjectDocRow } from './ProjectDocuments';
import { CONTRACT_STATUS_CLASSES, CONTRACT_STATUS_LABELS } from '@/lib/contracts';
import { computeTotals } from '@/lib/doklady';
import { expenseTotalMinor } from '@/lib/expenses';
import { sessionsForPages } from '@/lib/calendar';
import { loadCalendarSettings, loadStudios } from '@/lib/calendarServer';
import { RecordingSection } from './RecordingSection';

// Detail projektu (zadani 5. 9. 2026). Projekt sam o sobe zije v Caflou -
// tady se ctou jeho zakladni udaje a k nim se pripojuji NASE interni
// atributy (odkaz na KZ, manazer, priorita, typ projektu - model ProjectMeta).
//
// Vidi to jen interni ucty Mediaspace; menit smi jen Produkce a Zuzo-labuzo,
// zvukar ma nahled ke cteni (viz lib/roles.ts).
export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isInternalRole(session.user.role)) redirect('/projekty');

  const caflouProjectId = params.id;
  const canEdit = canEditProjectMeta(session.user.role);

  const [caflouDirect, meta, managers, projectTypeOptions, budgetSettings, timesheets] = await Promise.all([
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
    listProjectTypeOptions(),
    prisma.budgetSettings.findUnique({ where: { id: 'default' } }),
    // Vykazy k tomuhle projektu - z nich se pocita cerpani rozpoctu.
    prisma.timesheetEntry.findMany({
      where: { caflouProjectId },
      select: { startMinutes: true, endMinutes: true, hourlyRateSnapshot: true },
    }),
  ]);

  // Doklady navazane na projekt (zadani 8. 9. 2026). Vazba je pres ID projektu
  // v Caflou, stejne jako u vykazu.
  const showDocuments = canViewProjectDocuments(session.user.role);
  const [offers, invoices, expenses, contracts] = await Promise.all([
    prisma.offer.findMany({
      where: { caflouProjectId },
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      include: { items: true },
    }),
    prisma.invoice.findMany({
      where: { caflouProjectId },
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      include: { items: true },
    }),
    prisma.expense.findMany({
      where: { caflouProjectId },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.contract.findMany({
      where: { caflouProjectId },
      orderBy: [{ createdAt: 'desc' }],
    }),
  ]);

  // Nektere ucty Caflou nevraci detail jednoho projektu - pak projekt
  // dohledame v seznamu vsech projektu.
  const caflou = caflouDirect ?? (await findCaflouProjectInList(caflouProjectId));

  // Nazev firmy k projektu doplnujeme z nasi databaze podle ID firmy v Caflou.
  const company = caflou?.caflouCompanyId
    ? await prisma.company.findFirst({
        where: { caflouCompanyId: caflou.caflouCompanyId },
        select: { id: true, name: true, driveFolderUrl: true, ratePerPage: true, dealsAudiobooks: true },
      })
    : null;

  const project = caflou?.project ?? null;

  // Rozpocet (zadani 6. 9. 2026) - jen u audioknih, kde zname pocet normostran,
  // a vidi ho jen Zuzo-labuzo.
  const settings = budgetSettings ?? DEFAULT_BUDGET_SETTINGS;
  const showBudget =
    session.user.role === 'ADMIN' && company?.dealsAudiobooks === true && (project?.pageCount ?? 0) > 0;
  const budget = showBudget ? computeBudget(project!.pageCount!, settings) : null;
  const spent = timesheets.reduce(
    (sum, e) => sum + entryAmount(e.startMinutes, e.endMinutes, e.hourlyRateSnapshot),
    0,
  );
  const hoursLogged = timesheets.reduce((sum, e) => sum + toHours(durationMinutes(e.startMinutes, e.endMinutes)), 0);
  const revenue =
    budget && company?.ratePerPage != null ? budget.pageCount * company.ratePerPage : null;

  // Natacecí frekvence (zadani 8. 9. 2026) - nabidky terminu k tomuhle
  // projektu, seznam hercu a studii pro zalozeni nove.
  const [recordingRequests, herci, studia, calendarSettings] = await Promise.all([
    prisma.recordingRequest.findMany({
      where: { caflouProjectId },
      orderBy: { createdAt: 'desc' },
      include: { studio: { select: { name: true } }, slots: { select: { state: true } } },
    }),
    prisma.user.findMany({
      where: { role: 'HEREC', active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    }),
    loadStudios(),
    loadCalendarSettings(),
  ]);

  const dokladDatum = (date: Date | null) => (date ? new Intl.DateTimeFormat('cs-CZ').format(date) : '');

  const offerRows: ProjectDocRow[] = offers.map((o) => {
    const stav = offerStatus(o.status);
    return {
      id: o.id,
      href: `/admin/doklady/nabidky/${o.id}`,
      title: o.subject || 'Bez názvu',
      number: o.number,
      date: dokladDatum(o.issueDate),
      amountMinor: computeTotals(o.items).incVat,
      currency: o.currency,
      statusLabel: stav.label,
      statusClass: stav.className,
    };
  });

  const invoiceRows: ProjectDocRow[] = invoices.map((i) => {
    const stav = invoiceStatus(i.status);
    return {
      id: i.id,
      href: `/admin/doklady/faktury/${i.id}`,
      title: i.subject || 'Bez názvu',
      number: i.number,
      date: dokladDatum(i.issueDate),
      amountMinor: computeTotals(i.items).incVat,
      currency: i.currency,
      statusLabel: stav.label,
      statusClass: stav.className,
    };
  });

  const expenseRows: ProjectDocRow[] = expenses.map((e) => ({
    id: e.id,
    href: `/admin/doklady/vydaje/${e.id}`,
    title: e.description || 'Bez názvu',
    number: e.number || '',
    date: dokladDatum(e.issueDate),
    amountMinor: expenseTotalMinor(e.amountExVatMinor, e.vatRate),
    currency: e.currency,
    statusLabel: e.paid ? 'Uhrazeno' : 'Neuhrazeno',
    statusClass: e.paid ? 'bg-[#E3F9EC] text-status-done' : 'bg-[#F1ECFF] text-brand-purpleDark',
  }));

  const contractRows: ProjectDocRow[] = contracts.map((c) => ({
    id: c.id,
    href: `/admin/doklady/smlouvy/${c.id}`,
    title: c.title,
    number: c.number,
    date: dokladDatum(c.createdAt),
    amountMinor: 0,
    currency: 'CZK' as never,
    statusLabel: CONTRACT_STATUS_LABELS[c.status] ?? c.status,
    statusClass: CONTRACT_STATUS_CLASSES[c.status] ?? 'bg-field text-muted',
  }));

  // Souctuje se po menach - jablka s hruskami se nescitaji. Stornovane
  // faktury se do fakturovaneho nepocitaji.
  const soucet = (rows: ProjectDocRow[], skip: (row: ProjectDocRow) => boolean = () => false) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (skip(row)) continue;
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.amountMinor);
    }
    return Array.from(map.entries()).map(([currency, minor]) => ({ currency: currency as never, minor }));
  };
  const invoicedByCurrency = soucet(invoiceRows, (r) => r.statusLabel === 'Stornovaná');
  const costsByCurrency = soucet(expenseRows);

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
            <Field label="Priorita" value={project.priority ? PRIORITY_LABELS[project.priority] : '—'} />
            <Field label="Herec" value={project.narrator ?? '—'} />
            <Field label="Normostrany" value={project.pageCount != null ? String(project.pageCount) : '—'} />
            <Field label="Zahájení" value={formatDate(project.startDate)} />
            {/* "Konec" z Caflou je pro nas datum dokonceni; datum vydani je
                nas vlastni sloupec v Caflou (zadani 8. 9. 2026). */}
            <Field label="Datum dokončení" value={formatDate(project.endDate)} />
            <Field label="Datum vydání" value={formatDate(project.releaseDate)} />
          </dl>
        </div>
      )}

      {budget && (
        <ProjectBudget
          budget={budget}
          spent={spent}
          revenue={revenue}
          ratePerPage={company?.ratePerPage ?? null}
          hoursLogged={hoursLogged}
        />
      )}

      {isInternalRole(session.user.role) && (
        <RecordingSection
          caflouProjectId={caflouProjectId}
          projectName={project?.name ?? `Projekt ${caflouProjectId}`}
          companyId={company?.id ?? null}
          pageCount={project?.pageCount ?? null}
          sessionsFromPages={sessionsForPages(project?.pageCount ?? 0, calendarSettings.pagesPerSession)}
          narratorFromCaflou={project?.narrator ?? null}
          herci={herci.map((h) => ({ id: h.id, label: h.name || h.email }))}
          studios={studia.map((s) => ({ id: s.id, name: s.name }))}
          defaultActorUserId={meta?.actorUserId ?? null}
          requests={recordingRequests.map((r) => ({
            id: r.id,
            actorName: r.actorName,
            studioName: r.studio.name,
            requiredSessions: r.requiredSessions,
            offeredCount: r.slots.filter((s) => s.state === 'OFFERED').length,
            selectedCount: r.slots.filter((s) => s.state === 'SELECTED').length,
            confirmedCount: r.slots.filter((s) => s.state === 'CONFIRMED').length,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
          }))}
          canManage={canManageCalendar(session.user.role)}
        />
      )}

      {showDocuments && (
        <ProjectDocuments
          offers={offerRows}
          invoices={invoiceRows}
          expenses={expenseRows}
          contracts={contractRows}
          invoicedByCurrency={invoicedByCurrency}
          costsByCurrency={costsByCurrency}
        />
      )}

      <ProjectMetaForm
        caflouProjectId={caflouProjectId}
        canEdit={canEdit}
        managers={managers.map((m) => ({ id: m.id, label: m.name || m.email }))}
        companyDriveFolderUrl={company?.driveFolderUrl ?? null}
        caflouPriority={project?.priority ?? null}
        projectTypeOptions={projectTypeOptions}
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
