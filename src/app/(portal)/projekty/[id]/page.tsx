import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { findCaflouProjectInList, getCaflouProject } from '@/lib/caflou';
import { canEditProjectMeta, canManageCalendar, canViewProjectDocuments, isInternalRole, INTERNAL_ROLES } from '@/lib/roles';
import { PRIORITY_LABELS } from '@/lib/projectTypes';
import { listProjectTypeOptions, listRodnyListProjectTypes } from '@/lib/priceList';
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
import { ProjectTabs, type ProjectTab } from './ProjectTabs';
import { RodnyListSection } from './RodnyListSection';
import { findInternalProject } from '@/lib/caflouProjectsServer';
import { loadRodneListy, syncRodneListy } from '@/lib/rodnyListServer';

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

  // Kdo smi videt doklady - musi se vedet driv, nez se pro ne pojede do databaze.
  const showDocuments = canViewProjectDocuments(session.user.role);

  // POZOR NA PORADI (zprava 9. 9. 2026: "web se mi zdá zpomalený"): drive se
  // tady cekalo postupne na tri skupiny dotazu za sebou, a teprve pak na dalsi.
  // Kazda takova bariera znamena dalsi kolecko tam a zpet do Supabase - a
  // protoze si kazda instance funkce drzi jen JEDNO spojeni (viz lib/db.ts),
  // scitalo se to. Ted jde do databaze vsechno naraz a soubezne s tim bezi
  // dotaz do Caflou, takze se ceka jen na to nejpomalejsi z toho.
  const [
    caflouDirect,
    meta,
    managers,
    klientiUctu,
    klientskeFirmy,
    projectTypeOptions,
    rodnyListTypy,
    budgetSettings,
    timesheets,
    offers,
    invoices,
    expenses,
    contracts,
    recordingRequests,
    herci,
    studia,
    calendarSettings,
  ] = await Promise.all([
    // Nejdriv sdileny seznam projektu (lib/caflouProjectsServer.ts) - ma uz
    // vsechno, co se tu z Caflou ukazuje, a byva nacteny. Doptat se Caflou
    // primo se necha az jako zaloha nize.
    findInternalProject(caflouProjectId),
    prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      include: { manager: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { role: { in: INTERNAL_ROLES }, active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    // Ucty klientu - z nich se u projektu vybira, ci ten projekt je
    // (zadani 10. 9. 2026). Firma se zamerne neomezuje: u koprodukci sedi
    // u projektu clovek z jine firmy.
    prisma.user.findMany({
      where: { role: 'CLIENT', active: true },
      select: { id: true, name: true, email: true, companyId: true, company: { select: { name: true } } },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }),
    // Klientske firmy - pro kterou se projekt dela (zadani 10. 9. 2026:
    // "chci mit u projektu klienta i firmu").
    prisma.company.findMany({
      where: { type: 'KLIENT' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    listProjectTypeOptions(),
    // Typy projektu, u kterych se dela Rodny list - tedy radiove spoty.
    listRodnyListProjectTypes(),
    prisma.budgetSettings.findUnique({ where: { id: 'default' } }),
    // Vykazy k tomuhle projektu - z nich se pocita cerpani rozpoctu.
    prisma.timesheetEntry.findMany({
      where: { caflouProjectId },
      select: { startMinutes: true, endMinutes: true, hourlyRateSnapshot: true },
    }),
    // Doklady navazane na projekt (zadani 8. 9. 2026). Vazba je pres ID
    // projektu v Caflou, stejne jako u vykazu.
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
    // Natacecí frekvence (zadani 8. 9. 2026) - nabidky terminu k tomuhle
    // projektu, seznam hercu a studii pro zalozeni nove.
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

  // Zalohy pro pripad, ze projekt jeste neni ve sdilenem seznamu (zalozeny
  // pred chvili): detail jednoho projektu z Caflou, a kdyz ho ucet nevraci,
  // dohledani v seznamu vsech projektu.
  const caflou =
    caflouDirect ??
    (await getCaflouProject(caflouProjectId)) ??
    (await findCaflouProjectInList(caflouProjectId));

  // Nazev firmy k projektu doplnujeme z nasi databaze podle ID firmy v Caflou.
  const company = caflou?.caflouCompanyId
    ? await prisma.company.findFirst({
        where: { caflouCompanyId: caflou.caflouCompanyId },
        select: { id: true, name: true, driveFolderUrl: true, ratePerPage: true, dealsAudiobooks: true },
      })
    : null;

  const project = caflou?.project ?? null;

  // Rodny list reklamniho spotu (zadani 9. 9. 2026). Do 10. 9. 2026 se prechod
  // do stavu "Dokonceno - ke schvaleni" poznaval az tady pri otevreni detailu,
  // protoze stav prepinalo Caflou a nikdo nam to nehlasil. Ted stav prehazuje
  // clovek primo v portalu, takze se RL vyrabi rovnou pri te zmene
  // (/api/projects/[id]/meta) - a tohle uz tu byt nemusi.
  //
  // Kontrola pri otevreni zustava jen pro projekty, ktere jeste nemaji stav
  // z portalu; dokud neprobehne prenos, chodi porad z Caflou.
  if (project && !meta?.statusName) {
    await syncRodneListy([
      {
        caflouProjectId,
        projectName: project.name,
        statusName: project.statusName,
        caflouCompanyId: caflou?.caflouCompanyId ?? null,
      },
    ]);
  }

  // Rodny list se dela jen u radiovych spotu (upresneni 9. 9. 2026) - pozna se
  // to podle typu projektu, ne podle firmy. U ostatnich projektu se v zalozce
  // ukaze jen sekce Hudba ve spotu, kterou chtel mit uzivatel k dispozici
  // u projektu obecne.
  const jeRadiovySpot = rodnyListTypy.includes(meta?.projectType ?? '');
  const rodneListy = jeRadiovySpot ? await loadRodneListy(caflouProjectId) : [];
  // Meta se cte znovu, protoze synchronizace vyse mohla zapsat chybu.
  const metaPoSync = await prisma.projectMeta.findUnique({ where: { caflouProjectId } });

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
    statusClass: e.paid ? 'bg-okTint text-status-done' : 'bg-tint text-brand-purpleDark',
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

  // Zalozky (zprava uzivatele 8. 9. 2026: "u projektu uz to zacina byt trochu
  // neprehledne... Natacecí frekvence a doklady by mohly byt nahore v
  // zalozce"). Obsah se vykresli na serveru a do zalozek prijde hotovy.
  const prehled = (
    <>
      {!project && (
        <p className="text-sm font-heading text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">
          Údaje o projektu se nepodařilo načíst z Caflou. Interní atributy níže se přesto dají vyplnit a uloží se.
        </p>
      )}

      {project && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-6">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0 mb-4">
            Z Caflou
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 m-0">
            <Field label="Priorita" value={project.priority ? PRIORITY_LABELS[project.priority] : '—'} />
            <Field label="Herec" value={meta?.narrator ?? project.narrator ?? '—'} />
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

      <ProjectMetaForm
        caflouProjectId={caflouProjectId}
        canEdit={canEdit}
        managers={managers.map((m) => ({ id: m.id, label: m.name || m.email }))}
        klienti={klientiUctu.map((k) => ({
          id: k.id,
          label: k.company?.name ? `${k.name || k.email} — ${k.company.name}` : k.name || k.email,
          companyId: k.companyId,
        }))}
        firmy={klientskeFirmy.map((f) => ({ id: f.id, label: f.name }))}
        klientNameZCaflou={meta?.klientName ?? null}
        companyDriveFolderUrl={company?.driveFolderUrl ?? null}
        projectTypeOptions={projectTypeOptions}
        initial={{
          driveUrl: meta?.driveUrl ?? '',
          managerUserId: meta?.managerUserId ?? '',
          priority: meta?.priority ?? '',
          projectType: meta?.projectType ?? '',
          // Stav a herec: prednost ma to, co je v portalu. Dokud neprobehne
          // prenos, je tam prazdno a pouzije se posledni hodnota z Caflou.
          statusName: meta?.statusName ?? project?.statusName ?? '',
          narrator: meta?.narrator ?? project?.narrator ?? '',
          klientUserId: meta?.klientUserId ?? '',
          companyId: meta?.companyId ?? company?.id ?? '',
        }}
      />
    </>
  );

  const frekvence = (
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
  );

  const doklady = (
    <ProjectDocuments
      offers={offerRows}
      invoices={invoiceRows}
      expenses={expenseRows}
      contracts={contractRows}
      invoicedByCurrency={invoicedByCurrency}
      costsByCurrency={costsByCurrency}
    />
  );

  const rodnyList = (
    <RodnyListSection
      caflouProjectId={caflouProjectId}
      canEdit={canEdit}
      clientName={company?.name ?? ''}
      projectName={project?.name ?? `Projekt ${caflouProjectId}`}
      jeRadiovySpot={jeRadiovySpot}
      rlError={metaPoSync?.rlError ?? null}
      rodneListy={rodneListy.map((rl) => ({
        id: rl.id,
        version: rl.version,
        fileName: rl.fileName,
        createdAt: rl.createdAt.toISOString(),
        driveUrl: rl.driveUrl,
      }))}
      initial={{
        spotName: metaPoSync?.spotName ?? '',
        spotLengthSeconds: metaPoSync?.spotLengthSeconds != null ? String(metaPoSync.spotLengthSeconds) : '',
        directorName: metaPoSync?.directorName ?? '',
        musicTitle: metaPoSync?.musicTitle ?? '',
        musicAuthor: metaPoSync?.musicAuthor ?? '',
        noMusic: metaPoSync?.noMusic ?? false,
        productionDate: metaPoSync?.productionDate
          ? metaPoSync.productionDate.toISOString().slice(0, 10)
          : '',
      }}
    />
  );

  const tabs: ProjectTab[] = [{ key: 'prehled', label: 'Přehled', content: prehled }];
  if (isInternalRole(session.user.role)) {
    tabs.push({
      key: 'frekvence',
      label: 'Natáčecí frekvence',
      count: recordingRequests.length,
      content: frekvence,
    });
  }
  // Zalozka je u vsech projektu - u radioveho spotu jako Rodny list, jinak
  // jen jako Hudba ve spotu.
  tabs.push({
    key: 'rodny-list',
    label: jeRadiovySpot ? 'Rodný list' : 'Hudba ve spotu',
    count: jeRadiovySpot ? rodneListy.length : undefined,
    content: rodnyList,
  });
  if (showDocuments) {
    tabs.push({
      key: 'doklady',
      label: 'Doklady',
      count: offerRows.length + invoiceRows.length + expenseRows.length + contractRows.length,
      content: doklady,
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href="/projekty" className="text-muted text-sm font-heading no-underline">
          ← Zpět na projekty
        </Link>
        <div className="flex items-center gap-4 flex-wrap mt-2">
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">
            {project?.name ?? `Projekt ${caflouProjectId}`}
          </h1>
          {/* Stav z portalu ma prednost - od 10. 9. 2026 ho prehazuje clovek. */}
          {project && (
            <StatusPill
              finished={meta?.statusName ? meta.finished : project.finished}
              statusName={meta?.statusName ?? project.statusName}
            />
          )}
        </div>
        {company && <p className="text-muted text-sm font-body mt-1">{company.name}</p>}
      </div>

      <ProjectTabs tabs={tabs} />
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
