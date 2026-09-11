import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  listCaflouProjectsForCompanyCached,
  mapCaflouProjects,
  type DisplayProject,
} from '@/lib/caflou';
import { canEditProjectMeta, isInternalRole } from '@/lib/roles';
import { ProjectsTable, type InternalProject, type InternalProjectMeta } from './shared';
import { FinishedProjectsSection } from './FinishedProjectsSection';
import { InternalProjectsBrowser } from './InternalProjectsBrowser';
import { NovyProjektForm } from './NovyProjektForm';
import { listProjectTypeOptions, mapaIkonTypu } from '@/lib/priceList';
import { nabidkaManazeru } from '@/lib/manazeriServer';
import { loadColumnSettings } from '@/lib/columnLabelsServer';
import { loadInternalProjects } from '@/lib/caflouProjectsServer';
import { loadNejnovejsiRodneListy, syncRodneListy } from '@/lib/rodnyListServer';
import { PROJECTS_TABLE_KEY } from '@/lib/columnLabels';
import { odkazNaFotku } from '@/lib/fotky';

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
    return (
      <InternalProjektySection
        isAdmin={session!.user.role === 'ADMIN'}
        muzeMenitStav={canEditProjectMeta(session!.user.role)}
      />
    );
  }

  // Klic tenant izolace: companyId bereme VYHRADNE ze session, nikdy z query/parametru.
  const companyId = session!.user.companyId;

  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

  // Projekty se ctou zive z Caflou (viz src/lib/caflou.ts) - portal je uz nikde
  // sam nezaklada ani needituje, "projekty se menezuji hlavne v Caflou".
  let active: DisplayProject[] = [];
  let finished: DisplayProject[] = [];
  let loadError = false;

  // Vlastni data maji prednost (prechod z Caflou, 10. 9. 2026). Jakmile je
  // projekt v portalu, klient ho vidi odtud a do Caflou se uz nechodi.
  // KDO CO VIDI (oprava 11. 9. 2026): klient nevidi vsechny projekty sve
  // firmy, ale jen ty, u kterych je napsany jako klient. U vetsich firem
  // (Audioteka) na sebe lide z ruznych oddeleni videli navzajem.
  const jaId = session!.user.id;

  const zPortalu = company
    ? await prisma.projectMeta.findMany({
        where: { companyId: company.id, klientUserId: jaId, name: { not: null } },
        select: {
          caflouProjectId: true,
          name: true,
          statusName: true,
          finished: true,
          priority: true,
          pageCount: true,
          narrator: true,
          releaseDate: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { name: 'asc' },
      })
    : [];

  if (zPortalu.length > 0) {
    const vsechny: DisplayProject[] = zPortalu.map((p) => ({
      id: Number(p.caflouProjectId),
      name: p.name ?? '',
      finished: p.finished,
      statusName: p.statusName ?? '',
      priority: p.priority,
      narrator: p.narrator,
      pageCount: p.pageCount,
      finishedAt: p.endDate,
      releaseDate: p.releaseDate,
      startDate: p.startDate,
      endDate: p.endDate,
      // Projekt uz je v portalu, takze stitek z Caflou nema co resit.
      clientTag: null,
    }));
    active = vsechny
      .filter((p) => !p.finished)
      .sort((a, b) => (a.endDate?.getTime() ?? Infinity) - (b.endDate?.getTime() ?? Infinity));
    finished = vsechny
      .filter((p) => p.finished)
      .sort(
        (a, b) =>
          (b.endDate?.getTime() ?? b.finishedAt?.getTime() ?? 0) -
          (a.endDate?.getTime() ?? a.finishedAt?.getTime() ?? 0),
      );
  } else if (company?.caflouCompanyId) {
    try {
      const result = await listCaflouProjectsForCompanyCached(company.caflouCompanyId);
      if (result.ok) {
        const all = await jenMojeProjekty(mapCaflouProjects(result.body), jaId);
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

  // Rodne listy radiovych spotu (zadani 9. 9. 2026) - klient je vidi rovnou
  // u projektu. Sloupec se vykresli, jen kdyz nejaky RL opravdu existuje;
  // u klienta, ktery spoty nedela, tak zbytecne nepribyva prazdny sloupec.
  const rodneListyMapa = await loadNejnovejsiRodneListy(
    [...active, ...finished].map((p) => String(p.id)),
  );
  const rodneListy = rodneListyMapa.size > 0 ? Object.fromEntries(rodneListyMapa) : undefined;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Projekty</h1>
        {!company?.caflouCompanyId && (
          <span className="text-xs font-heading text-brand-purpleDark bg-tint border border-line rounded-lg px-3 py-2">
            Napojení na Caflou zatím čeká na dokončení nastavení
          </span>
        )}
        {company?.caflouCompanyId && loadError && (
          <span className="text-xs font-heading text-danger bg-dangerTint border border-line rounded-lg px-3 py-2">
            Projekty se nepodařilo načíst z Caflou. Zkuste to prosím později.
          </span>
        )}
      </div>

      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
          Aktivní projekty
        </h2>
        {/* Tlacitko "Zeptat se" jen u KLIENTU AUDIOKNIH a jen u rozpracovanych
            projektu (zadani 11. 9. 2026). U dokoncenych se kanal uzavira, tak
            se tam ani nenabizi. */}
        <ProjectsTable
          projects={active}
          emptyText="Aktuálně tu nemáte žádný rozpracovaný projekt. Vidíte jen zakázky, u kterých jste vedení jako kontaktní osoba — kdyby vám nějaká chyběla, dejte nám vědět."
          rodneListy={rodneListy}
          dotazy={company?.dealsAudiobooks === true}
        />
      </div>

      <FinishedProjectsSection projects={finished} rodneListy={rodneListy} />
    </section>
  );
}

async function InternalProjektySection({
  isAdmin,
  muzeMenitStav,
}: {
  isAdmin: boolean;
  /** Prehazovat stav projektu smi Produkce a Zuzo-labuzo. */
  muzeMenitStav: boolean;
}) {
  // Seznam projektu se bere pres sdilenou cache (lib/caflouProjectsServer.ts):
  // pamet instance -> tabulka v databazi -> teprve pak Caflou. Stahovani
  // celeho uctu z Caflou je osm dotazu za sebou (mereno 12,5 s) a drive se
  // platilo pokazde, kdyz pozadavek obslouzila jina instance funkce.
  const { projects, error } = await loadInternalProjects();

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

  // Ciselniky pro zalozeni projektu (zadani 10. 9. 2026).
  const [firmyProFormular, klientiProFormular, manazeriProFormular, herciProFormular, typyProjektu, ikonyTypu] =
    await Promise.all([
    prisma.company.findMany({
      where: { type: 'KLIENT' },
      select: { id: true, name: true, driveFolderUrl: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: 'CLIENT', active: true },
      select: { id: true, name: true, email: true, companyId: true, company: { select: { name: true } } },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }),
    // Manazer projektu - jen ucty, ktere to maji na karte zaskrtnute
    // (zadani 10. 9. 2026). Viz lib/manazeriServer.ts.
    nabidkaManazeru(),
    // Ucty hercu - herec u projektu je konkretni osoba (zadani 10. 9. 2026).
    prisma.user.findMany({
      where: { role: 'HEREC', active: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }),
    listProjectTypeOptions(),
    // Ikony typu projektu (zadani 10. 9. 2026) - jednim dotazem pro cely
    // seznam, ne pro kazdy radek zvlast.
    mapaIkonTypu(),
  ]);

  // Nase vlastni atributy k projektum (priorita, typ, manazer) - jednim
  // dotazem pro vsechny nactene projekty najednou.
  const metas = projects.length
    ? await prisma.projectMeta.findMany({
        where: { caflouProjectId: { in: projects.map((p) => String(p.id)) } },
        include: {
          manager: { select: { name: true, email: true, photoUrl: true } },
          actor: { select: { name: true, email: true } },
          // Herci projektu (zadani 10. 9. 2026) - v prehledu se ukazuji vsichni.
          herci: { select: { id: true, name: true, email: true } },
        },
      })
    : [];
  const metaById = new Map(
    metas.map((m): [string, InternalProjectMeta] => [
      m.caflouProjectId,
      {
        priority: m.priority,
        projectType: m.projectType,
        managerName: m.manager ? m.manager.name || m.manager.email : null,
        managerPhotoUrl: m.managerUserId ? odkazNaFotku(m.managerUserId, m.manager?.photoUrl) : null,
        driveUrl: m.driveUrl,
        managerUserId: m.managerUserId,
        ikonaTypu: m.projectType ? ikonyTypu[m.projectType] ?? null : null,
        // Hlavni herec prvni, at prehled i detail ukazuji stejne poradi.
        herciJmena: [
          ...m.herci.filter((h) => h.id === m.actorUserId),
          ...m.herci.filter((h) => h.id !== m.actorUserId),
        ].map((h) => h.name || h.email),
      },
    ]),
  );
  // Stav a herec drzi od 10. 9. 2026 portal, ne Caflou - prehazuji se rucne.
  // Dokud u projektu stav z portalu neni (neprobehl prenos), plati ten z Caflou.
  const portalStav = new Map(
    metas.map((m) => [
      m.caflouProjectId,
      {
        statusName: m.statusName,
        finished: m.finished,
        // Prednost ma pridelený ucet herce; text z Caflou je jen zaloha,
        // dokud ucet prirazeny neni (zadani 10. 9. 2026).
        narrator: m.actor ? m.actor.name || m.actor.email : m.narrator,
      },
    ]),
  );

  const withMeta: InternalProject[] = projects.map((p) => {
    const nas = portalStav.get(String(p.id));
    return {
      ...p,
      statusName: nas?.statusName || p.statusName,
      finished: nas?.statusName ? nas.finished : p.finished,
      narrator: nas?.narrator || p.narrator,
      meta: metaById.get(String(p.id)) ?? null,
    };
  });

  // Sloupce tabulky - vychozi podoba prepsana tim, co si Zuzo-labuzo
  // nastavilo (nazev, poradi, skryti).
  const columnSettings = await loadColumnSettings(PROJECTS_TABLE_KEY);

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
          <span className="text-xs font-heading text-danger bg-dangerTint border border-line rounded-lg px-3 py-2">
            Projekty se nepodařilo načíst z Caflou. {error}
          </span>
        )}
      </div>

      <InternalProjectsBrowser
        novyProjekt={
          muzeMenitStav ? (
            <NovyProjektForm
              firmy={firmyProFormular.map((f) => ({
                id: f.id,
                label: f.name,
                maSlozku: Boolean(f.driveFolderUrl),
              }))}
              klienti={klientiProFormular.map((k) => ({
                id: k.id,
                label: k.company?.name ? `${k.name || k.email} — ${k.company.name}` : k.name || k.email,
                companyId: k.companyId,
              }))}
              manazeri={manazeriProFormular}
              herci={herciProFormular.map((h) => ({ id: h.id, label: h.name || h.email }))}
              typyProjektu={typyProjektu}
            />
          ) : null
        }
        active={active}
        finished={finished}
        columns={columnSettings}
        canEditLabels={isAdmin}
        canEditStatus={muzeMenitStav}
        manazeri={manazeriProFormular}
      />
    </section>
  );
}

/**
 * Z projektů firmy nechá jen ty, které patří přihlášenému člověku
 * (oprava 11. 9. 2026: „vidí tam všechny projekty od Audioteky a to je
 * špatně, mělo by se to roztřídit tím, kdo je u projektu napsaný jako
 * klient").
 *
 * Rozhoduje přiřazení v portálu (ProjectMeta.klientUserId). Dokud ho projekt
 * nemá — u zakázek převzatých z Caflou ho nemá skoro žádný — bere se náhradní
 * vodítko: štítek v Caflou, kde je napsané jméno objednávajícího. Jméno se
 * porovnává bez ohledu na velikost písmen a diakritiku, protože v Caflou ho
 * psali lidé ručně. Jakmile někdo u projektu vyplní klienta v portálu, štítek
 * se už neřeší.
 */
async function jenMojeProjekty(projekty: DisplayProject[], userId: string): Promise<DisplayProject[]> {
  if (projekty.length === 0) return [];

  const [ja, prirazeni] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.projectMeta.findMany({
      where: { caflouProjectId: { in: projekty.map((p) => String(p.id)) }, klientUserId: { not: null } },
      select: { caflouProjectId: true, klientUserId: true },
    }),
  ]);

  const klientProjektu = new Map(prirazeni.map((p) => [p.caflouProjectId, p.klientUserId]));
  const mojeJmeno = bezDiakritiky(ja?.name ?? '');

  return projekty.filter((p) => {
    const prirazeny = klientProjektu.get(String(p.id));
    if (prirazeny) return prirazeny === userId;
    if (!mojeJmeno) return false;
    return bezDiakritiky(p.clientTag ?? '') === mojeJmeno;
  });
}

/** Porovnani jmen z ruznych zdroju - bez diakritiky, velikosti pismen a mezer navic. */
function bezDiakritiky(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
