import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { DisplayProject } from '@/lib/projektyTypy';
import {
  canEditProjectMeta,
  canViewProjectBusinessInfo,
  isInternalRole,
  vidiProjektyVPriprave,
} from '@/lib/roles';
import { jeVPriprave } from '@/lib/stavyProjektu';
import { ProjectsTable, type InternalProject, type InternalProjectMeta } from './shared';
import { FinishedProjectsSection } from './FinishedProjectsSection';
import { InternalProjectsBrowser } from './InternalProjectsBrowser';
import { ZalozkyKlienta } from './ZalozkyKlienta';
import { DokonceneFirmy } from './DokonceneFirmy';
import { nactiPoradiStavu } from '@/lib/poradiStavuServer';
import { NovyProjektForm } from './NovyProjektForm';
import { HerecProjekty } from './HerecProjekty';
import { listProjectTypeOptions, listRodnyListProjectTypes, mapaIkonTypu, nazevTypuAudioknihy } from '@/lib/priceList';
import { nabidkaManazeru } from '@/lib/manazeriServer';
import { loadMojeSloupce } from '@/lib/columnLabelsServer';
import { loadInternalProjects } from '@/lib/projektySeznamServer';
import { loadNejnovejsiRodneListy, syncRodneListy } from '@/lib/rodnyListServer';
import { nactiPreposlechPrehled } from '@/lib/preposlechServer';
import { odkazyPreposlechu } from '@/lib/preposlechOdkaz';
import { PROJECTS_TABLE_KEY } from '@/lib/columnLabels';
import { odkazNaFotku } from '@/lib/fotky';
import { posledniStrany } from '@/lib/brunoServer';
import { nactiProgresNataceni } from '@/lib/progresNataceniServer';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitS } from '@/lib/jazyk';
import { bezTitulu } from '@/lib/jmena';
import { slozStavNabidky, stavyNabidekZDokladu } from '@/lib/nabidkaStavServer';
import { dokladyUProjektu } from '@/lib/dokladyUProjektuServer';

// DULEZITE: stránka čte projekty při každém zobrazení - nesmí ji Next.js
// pri buildu "zamrazit" jako statickou stránku (to by klientovi natvrdo
// zapeklo stav z okamžiku buildu a nikdy by se sám neopravil bez nasazení).
export const dynamic = 'force-dynamic';

export default async function ProjektyPage() {
  const session = await getServerSession(authOptions);

  // Interni ucty Mediaspace (Zuzo-labuzo / Produkce / Zvukar) nemaji
  // companyId (nepatri pod zadnou firmu) - misto prazdne "nemate zadne
  // projekty" hlasky jim tu ukazeme prehled VSECH projektu napric firmami,
  // rozdeleny na aktivni a dokoncene (zadani 5. 9. 2026).
  if (isInternalRole(session!.user.role)) {
    return (
      <InternalProjektySection
        isAdmin={session!.user.role === 'ADMIN'}
        userId={session!.user.id}
        muzeMenitStav={canEditProjectMeta(session!.user.role)}
        vidiObchodniUdaje={canViewProjectBusinessInfo(session!.user.role)}
        vidiVPriprave={vidiProjektyVPriprave(session!.user.role)}
      />
    );
  }

  // Herec ma vlastni, uzsi prehled (zadani 19. 9. 2026) - nazev, NS, strana
  // z posledni frekvence a odkaz na text. Klientske sloupce nepotrebuje.
  if (session!.user.role === 'HEREC') {
    return <HerecProjekty userId={session!.user.id} />;
  }

  // Klic tenant izolace: companyId bereme VYHRADNE ze session, nikdy z query/parametru.
  const companyId = session!.user.companyId;

  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

  // Projekty se ctou z NASI databaze (od 11. 9. 2026 - odpojeni Caflou).
  //
  // KDO CO VIDI (oprava 11. 9. 2026): v prehledu „Moje projekty" ma klient
  // jen ty, u kterych je napsany jako klient - u vetsich firem (Audioteka)
  // na sebe lide z ruznych oddeleni videli navzajem. Od 24. 9. 2026 je vedle
  // toho zalozka „Cela firma": kdo potrebuje videt, co se u nas pro jeho
  // firmu deje, si ji otevre sam.
  let active: DisplayProject[] = [];
  let finished: DisplayProject[] = [];
  const jaId = session!.user.id;

  /**
   * CELÁ FIRMA NA DRUHÉ ZÁLOŽCE (zadání 24. 9. 2026: „nastav u klientů, aby
   * měli možnost vidět i někde v záložce projekty celé firmy - ostatních
   * kolegů"). Čte se jedním dotazem celá firma a teprve tady se rozdělí na
   * „moje" (jsem u nich vedený jako kontakt) a zbytek. První záložka tím
   * zůstává přesně taková, jaká byla.
   */
  const firemniMeta = company
    ? await prisma.projectMeta.findMany({
        where: { companyId: company.id, name: { not: null } },
        select: {
          klientUserId: true,
          klient: { select: { name: true, email: true } },
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
          // Herci do bubliny (zadani 12. 9. 2026) - hlavni herec prvni, at
          // to vypada stejne jako v internim prehledu.
          actorUserId: true,
          herci: { select: { id: true, name: true, email: true } },
        },
        orderBy: { name: 'asc' },
      })
    : [];

  const zPortalu = firemniMeta.filter((p) => p.klientUserId === jaId);
  const vsechnyFirmy = firemniMeta;

  /**
   * Kdo uz ma dotoceno - jednim dotazem pro celou stranku, stejne jako
   * v internim prehledu. Klic je projekt + herec: na jednom projektu muze
   * mit tyz herec dotoceno a na druhem ne.
   */
  const dotoceniKlienta = new Set(
    vsechnyFirmy.length
      ? (
          await prisma.herecDotocen.findMany({
            where: { caflouProjectId: { in: vsechnyFirmy.map((p) => p.caflouProjectId) } },
            select: { caflouProjectId: true, userId: true },
          })
        ).map((d) => `${d.caflouProjectId}:${d.userId}`)
      : [],
  );

  /** Z metadat projektu udělá řádek tabulky - stejně pro obě záložky. */
  const naRadek = (p: (typeof firemniMeta)[number]): DisplayProject => ({
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
    // Projekt uz je v portalu, takze stary stitek nema co resit.
    clientTag: null,
    herci: [
      ...p.herci.filter((h) => h.id === p.actorUserId),
      ...p.herci.filter((h) => h.id !== p.actorUserId),
    ].map((h) => ({
      jmeno: bezTitulu(h.name) || h.email,
      // Zelena linka „dotoceno" uz i u klienta (zadani 14. 9. 2026).
      dotoceno: dotoceniKlienta.has(`${p.caflouProjectId}:${h.id}`),
    })),
  });

  const odNejblizsiho = (a: DisplayProject, b: DisplayProject) =>
    (a.endDate?.getTime() ?? Infinity) - (b.endDate?.getTime() ?? Infinity);
  const odNejnovejsiho = (a: DisplayProject, b: DisplayProject) =>
    (b.endDate?.getTime() ?? b.finishedAt?.getTime() ?? 0) -
    (a.endDate?.getTime() ?? a.finishedAt?.getTime() ?? 0);

  if (zPortalu.length > 0) {
    const vsechny = zPortalu.map(naRadek);
    active = vsechny.filter((p) => !p.finished).sort(odNejblizsiho);
    finished = vsechny.filter((p) => p.finished).sort(odNejnovejsiho);
  }

  /**
   * ČÍ ZAKÁZKA TO JE (zadání 24. 9. 2026: „u těch projektů firmy by mohly být
   * ještě identifikované kolegyně, ať je jasné, čí projekt to je").
   *
   * U svých zakázek se místo jména píše „vy" - jméno sebe sama v každém
   * druhém řádku by bylo k ničemu. Zakázka bez kontaktu se pozná taky, ať je
   * vidět, že u ní někdo chybí.
   */
  const firemniKontakty = Object.fromEntries(
    vsechnyFirmy
      .map((p) => {
        if (p.klientUserId === jaId) return [p.caflouProjectId, 'vy'] as const;
        const jmeno = p.klient ? bezTitulu(p.klient.name) || p.klient.email : null;
        return jmeno ? ([p.caflouProjectId, jmeno] as const) : null;
      })
      .filter((x): x is readonly [string, string] => x !== null),
  );

  /** Záložka „Celá firma" - všechno, co u nás firma má (24. 9. 2026). */
  const firemniVse = vsechnyFirmy.map(naRadek);
  const firemniActive = firemniVse.filter((p) => !p.finished).sort(odNejblizsiho);
  const firemniFinished = firemniVse.filter((p) => p.finished).sort(odNejnovejsiho);

  // Rodne listy radiovych spotu (zadani 9. 9. 2026) - klient je vidi rovnou
  // u projektu. Sloupec se vykresli, jen kdyz nejaky RL opravdu existuje;
  // u klienta, ktery spoty nedela, tak zbytecne nepribyva prazdny sloupec.
  const rodneListyMapa = await loadNejnovejsiRodneListy(
    firemniVse.map((p) => String(p.id)),
  );
  const rodneListy = rodneListyMapa.size > 0 ? Object.fromEntries(rodneListyMapa) : undefined;

  /**
   * SCHVALOVÁNÍ V KLIENTSKÉM PORTÁLU (zadání 18. 9. 2026: „tuhle možnost bych
   * dal klientům i v klientském portálu, ale zapnul bych to zatím jen
   * u reklam").
   *
   * Sloupec se vykreslí jen firmě, která u nás dělá reklamy - u audioknih
   * vede cesta přes opravy a stav přehazujeme my. Schvaluje se CELÝ PROJEKT,
   * proto stačí jedno razítko na zakázku.
   */
  const schvaleniMapa = company?.dealsAds
    ? await prisma.projectMeta.findMany({
        where: { caflouProjectId: { in: [...active, ...finished].map((p) => String(p.id)) } },
        select: { caflouProjectId: true, schvalenoKlientemAt: true },
      })
    : [];
  const schvaleni = company?.dealsAds
    ? Object.fromEntries(
        schvaleniMapa.map((m) => [
          m.caflouProjectId,
          m.schvalenoKlientemAt ? m.schvalenoKlientemAt.toISOString() : null,
        ]),
      )
    : undefined;

  /**
   * PROGRES NATÁČENÍ u klienta (zadání 19. 9. 2026: „měl by ho vidět i
   * klient"). Jen rozpracované projekty - viz lib/progresNataceniServer.ts.
   */
  const progresMapa = await nactiProgresNataceni(
    zPortalu
      .filter((p) => !p.finished)
      .map((p) => ({ id: p.caflouProjectId, herciIds: p.herci.map((h) => h.id) })),
  );
  const progres = Object.fromEntries(Array.from(progresMapa, ([id, v]) => [id, v.celkem]));

  /** Progres i u zakázek kolegů - v záložce Celá firma (24. 9. 2026). */
  const firemniProgresMapa = await nactiProgresNataceni(
    vsechnyFirmy
      .filter((p) => !p.finished)
      .map((p) => ({ id: p.caflouProjectId, herciIds: p.herci.map((h) => h.id) })),
  );
  const firemniProgres = Object.fromEntries(
    Array.from(firemniProgresMapa, ([id, v]) => [id, v.celkem]),
  );

  // Stav preposlechu do dvou novych sloupcu (zadani 12. 9. 2026). Jen
  // u rozpracovanych projektu - u dokoncenych uz nema co ukazovat.
  const preposlechMapa = await nactiPreposlechPrehled(active.map((p) => String(p.id)));
  const preposlech = Object.fromEntries(preposlechMapa);

  // Proklik do AudioTaggeru misto zelene fajfky (zadani 14. 9. 2026). Jednim
  // dotazem pro celou stranku - viz odkazyPreposlechu.
  const odkazyAudioTaggeru = Object.fromEntries(
    await odkazyPreposlechu(active.map((p) => String(p.id))),
  );

  /**
   * NORMOSTRANY U REKLAMY NEJSOU (zadání 25. 9. 2026: „u firem a klientů,
   * kteří mají zaškrtnutou reklamu, dát pryč atribut NS - normostrany").
   * Firma, která u nás dělá i audioknihy, sloupec dál má - tam normostrany
   * pořád něco znamenají.
   */
  const ukazNormostrany = !(company?.dealsAds && !company?.dealsAudiobooks);

  const jazyk = nactiJazyk();

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        {/* Na telefonu bez nadpisu (21. 9. 2026: „nápis Projekty taky. Stačí,
            když to svítí zaškrtlé nahoře v nabídce na panelu"). */}
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">
          {prelozit(jazyk, 'projekty.nadpis')}
        </h1>
      </div>

      {/* DVĚ ZÁLOŽKY (zadání 24. 9. 2026). Obě se vykreslí na serveru,
          přepínač jen mění, co je vidět - viz ZalozkyKlienta.tsx. */}
      <ZalozkyKlienta
        pocetFirmy={firemniVse.length}
        moje={
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
                {prelozit(jazyk, 'projekty.aktivni')}
              </h2>
              {/* Tlacitko "Zeptat se" jen u KLIENTU AUDIOKNIH a jen u rozpracovanych
                  projektu (zadani 11. 9. 2026). U dokoncenych se kanal uzavira, tak
                  se tam ani nenabizi. */}
              <ProjectsTable
                projects={active}
                emptyText={prelozit(jazyk, 'projekty.zadneAktivni')}
                rodneListy={rodneListy}
                preposlech={preposlech}
                odkazyAudioTaggeru={odkazyAudioTaggeru}
                schvaleni={schvaleni}
                progres={progres}
                jazyk={jazyk}
                normostrany={ukazNormostrany}
              />
            </div>

            <FinishedProjectsSection
              projects={finished}
              rodneListy={rodneListy}
              normostrany={ukazNormostrany}
            />
          </div>
        }
        firma={
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
                {prelozitS(jazyk, 'projekty.aktivniFirmy', {
                  firma: company ? `— ${company.name}` : '',
                }).trim()}
              </h2>
              <p className="text-xs font-body text-muted m-0 mb-3">
                {prelozit(jazyk, 'projekty.firmaPopis')}
              </p>
              <ProjectsTable
                projects={firemniActive}
                emptyText={prelozit(jazyk, 'projekty.zadneFiremniAktivni')}
                rodneListy={rodneListy}
                progres={firemniProgres}
                kontakty={firemniKontakty}
                jazyk={jazyk}
                normostrany={ukazNormostrany}
              />
            </div>

            <DokonceneFirmy
              projects={firemniFinished}
              rodneListy={rodneListy}
              kontakty={firemniKontakty}
              normostrany={ukazNormostrany}
            />
          </div>
        }
      />
    </section>
  );
}

async function InternalProjektySection({
  isAdmin,
  userId,
  muzeMenitStav,
  vidiObchodniUdaje,
  vidiVPriprave,
}: {
  isAdmin: boolean;
  /** Prihlaseny - sloupce si kazdy sklada sam (zadani 19. 9. 2026). */
  userId: string;
  /** Prehazovat stav projektu smi Produkce a Zuzo-labuzo. */
  muzeMenitStav: boolean;
  /** Zvukar nevidi datum vydani - viz canViewProjectBusinessInfo. */
  vidiObchodniUdaje: boolean;
  /** Zvukar vidi projekt az od stavu „Natáčíme" - viz vidiProjektyVPriprave. */
  vidiVPriprave: boolean;
}) {
  // Projekty jsou nase - jeden dotaz do databaze (viz lib/projektySeznamServer.ts).
  const { projects: vsechnyProjekty, error } = await loadInternalProjects();
  // Projekt v pripravě je zatim jen objednavka - zvukari se v seznamu
  // neukazuje (zadani 15. 9. 2026).
  const projects = vidiVPriprave
    ? vsechnyProjekty
    : vsechnyProjekty.filter((p) => !jeVPriprave(p.statusName));

  // Rodne listy reklamnich spotu (zadani 9. 9. 2026). Porovnava se s poslednim
  // videnym stavem prave tady - interni prehled projektu je misto, kam se
  // produkce diva nejcasteji. Kdyz se stav od minule nezmenil, neudela to nic;
  // opakovane nacteni stranky tedy zadny duplicitni dokument nevyrobi.
  await syncRodneListy(
    projects.map((p) => ({
      caflouProjectId: String(p.id),
      projectName: p.name,
      statusName: p.statusName,
      caflouCompanyId: p.caflouCompanyId,
    })),
  );

  // Ciselniky pro zalozeni projektu (zadani 10. 9. 2026).
  const [
    firmyProFormular,
    klientiProFormular,
    manazeriProFormular,
    herciProFormular,
    typyProjektu,
    ikonyTypu,
    typAudioknihy,
    typyReklamy,
    poradiStavu,
  ] = await Promise.all([
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
    // Typ projektu, ktery znamena audioknihu - jen u nej se ptame na
    // normostrany (zadani 17. 9. 2026).
    nazevTypuAudioknihy(),
    // Typy projektu = reklama (Rodný list) - u nich se nenabízí „Čekáme na
    // opravy“ (zadání 22. 9. 2026).
    listRodnyListProjectTypes(),
    // V jakém pořadí se v tabulce řadí stavy (zadání 24. 9. 2026).
    nactiPoradiStavu(),
  ]);

  /**
   * STAV NABÍDKY U REKLAM (zadání 23. 9. 2026: „chtěl bych někde vidět (jen
   * já) v přehledu i v detailu projektu, že je nabídka schválena"). Značka se
   * vykreslí jen tomu, kdo to má zaškrtnuté na kartě - zatím jen Ondřej.
   */
  const ja = await prisma.user.findUnique({
    where: { id: userId },
    select: { nabidkyReklam: true, vidiBanku: true },
  });
  const vidiNabidky = Boolean(ja?.nabidkyReklam);

  /**
   * IKONY DOKLADŮ U NÁZVU (zadání 25. 9. 2026: „ať mi to tam svítí a vím
   * rovnou, co je vyfakturováno a co ne. Uvidím to jen já a Barbora Šíblová").
   * Rozhoduje „Vidí Banku" na kartě - je to tatáž dvojice a tytéž peníze.
   */
  const vidiDoklady = Boolean(ja?.vidiBanku);

  // Nase vlastni atributy k projektum (priorita, typ, manazer) - jednim
  // dotazem pro vsechny nactene projekty najednou.
  const metas = projects.length
    ? await prisma.projectMeta.findMany({
        where: { caflouProjectId: { in: projects.map((p) => String(p.id)) } },
        include: {
          manager: { select: { name: true, email: true, maFotku: true } },
          actor: { select: { name: true, email: true } },
          // Herci projektu (zadani 10. 9. 2026) - v prehledu se ukazuji vsichni.
          herci: { select: { id: true, name: true, email: true } },
          // Druhy licence - ikonky pod ikonou typu (zadani 18. 9. 2026).
          licence: { select: { nazev: true, ikona: true }, orderBy: { poradi: 'asc' } },
          // Druh zakazek firmy - u reklamy je kratsi nabidka stavu
          // (zadani 18. 9. 2026).
          company: { select: { dealsAds: true, dealsAudiobooks: true } },
        },
      })
    : [];

  /**
   * Dotoceni herci (zadani 11. 9. 2026: "fajfku prosim v prehledu i v
   * detailu") - jednim dotazem pro cely prehled, ne projekt po projektu.
   * Klic je dvojice projekt + herec, protoze tentyz herec muze mit na jednom
   * projektu dotoceno a na druhem ne.
   */
  const dotoceni = new Set(
    projects.length
      ? (
          await prisma.herecDotocen.findMany({
            where: { caflouProjectId: { in: projects.map((p) => String(p.id)) } },
            select: { caflouProjectId: true, userId: true },
          })
        ).map((d) => `${d.caflouProjectId}:${d.userId}`)
      : [],
  );

  // Posledni strana u kazde dvojice projekt + herec (Bruno z chatu, zadani
  // 13. 9. 2026) - odznak s cislem u jmena herce.
  const strany = await posledniStrany(projects.map((p) => String(p.id)));

  /**
   * JAK DALEKO JE PŘEPOSLECH (zadání 25. 9. 2026: „chtělo by to nějakou ikonu,
   * že se částečně zapisují chyby v AudioTaggeru… v detailu projektu
   * i v přehledu"). Jedním dotazem pro celý seznam, bez sahání na Disk.
   */
  const preposlechMapa = await nactiPreposlechPrehled(projects.map((p) => String(p.id)));

  /**
   * Schválená nabídka v Dokladech přebíjí ruční značku (25. 9. 2026: „když dám
   * schválit nabídku ručně, tak je taky prostě schválená").
   */
  const nabidkyZDokladu = vidiNabidky
    ? await stavyNabidekZDokladu(projects.map((p) => String(p.id)))
    : new Map();

  const dokladyMapa = vidiDoklady
    ? await dokladyUProjektu(projects.map((p) => String(p.id)))
    : new Map();

  const metaById = new Map(
    metas.map((m): [string, InternalProjectMeta] => [
      m.caflouProjectId,
      {
        priority: m.priority,
        projectType: m.projectType,
        managerName: m.manager ? m.manager.name || m.manager.email : null,
        managerPhotoUrl: m.managerUserId ? odkazNaFotku(m.managerUserId, m.manager?.maFotku) : null,
        driveUrl: m.driveUrl,
        managerUserId: m.managerUserId,
        ikonaTypu: m.projectType ? ikonyTypu[m.projectType] ?? null : null,
        // Sluchatka se stavem preposlechu (25. 9. 2026).
        preposlech: preposlechMapa.get(m.caflouProjectId) ?? null,
        // „Reklamni firma" = dela reklamy a ne audioknihy; stejne pravidlo
        // jako u zprav klientovi (lib/notifikaceFirmy.ts).
        // Od 22. 9. 2026 i projekt, který je SÁM reklama (typ s Rodným
        // listem) - „u reklam se vůbec nemá počítat stav Čekáme na opravy“.
        reklamniFirma:
          Boolean(m.company?.dealsAds && !m.company?.dealsAudiobooks) ||
          Boolean(m.projectType && typyReklamy.includes(m.projectType)),
        // Hlavni herec prvni, at prehled i detail ukazuji stejne poradi.
        herci: [
          ...m.herci.filter((h) => h.id === m.actorUserId),
          ...m.herci.filter((h) => h.id !== m.actorUserId),
        ].map((h) => ({
          jmeno: bezTitulu(h.name) || h.email,
          dotoceno: dotoceni.has(`${m.caflouProjectId}:${h.id}`),
          // Zapis bez herce patri jedinemu herci projektu - stejne pravidlo
          // jako v detailu.
          strana:
            strany.get(`${m.caflouProjectId}:${h.id}`) ??
            (m.herci.length === 1 ? strany.get(`${m.caflouProjectId}:`) : undefined) ??
            null,
        })),
        herciJmenaText: m.herci.map((h) => bezTitulu(h.name) || h.email).join(' '),
        licence: m.licence.map((l) => ({ nazev: l.nazev, ikona: l.ikona })),
        // Nabídka - jen u reklam a jen tomu, kdo ji vidí.
        nabidka:
          vidiNabidky &&
          (Boolean(m.company?.dealsAds && !m.company?.dealsAudiobooks) ||
            Boolean(m.projectType && typyReklamy.includes(m.projectType)))
            ? slozStavNabidky(m.nabidkaStav, nabidkyZDokladu.get(m.caflouProjectId))
            : null,
        // Jaké doklady u zakázky visí - nabídka, faktura nebo obojí (25. 9. 2026).
        doklady: dokladyMapa.get(m.caflouProjectId) ?? null,
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
        narrator: m.actor ? bezTitulu(m.actor.name) || m.actor.email : m.narrator,
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

  // Sloupce tabulky - spolecne nazvy (meni Zuzo-labuzo) a k nim vlastni
  // poradi a vyber sloupcu kazdeho cloveka, zvlast pro pocitac a pro mobil
  // (zadani 19. 9. 2026).
  const sloupce = await loadMojeSloupce(PROJECTS_TABLE_KEY, userId);

  // DATUM VYDANI ZVUKARI NE (zadani 13. 9. 2026). Sloupec se zahazuje tady,
  // ne az v tabulce: takhle o nem nevi ani sirky sloupcu, ani razeni, ani
  // nastaveni sloupcu - proste pro nej neexistuje.
  const bezVydani = (cols: typeof sloupce.pocitac) =>
    vidiObchodniUdaje ? cols : cols.filter((c) => c.key !== 'releaseDate');

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
        {/* Na telefonu bez nadpisu (21. 9. 2026: „nápis Projekty taky. Stačí,
            když to svítí zaškrtlé nahoře v nabídce na panelu"). */}
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">Projekty</h1>
        {error && (
          <span className="text-xs font-heading text-danger bg-dangerTint border border-line rounded-lg px-3 py-2">
            Projekty se nepodařilo načíst. {error}
          </span>
        )}
      </div>

      <InternalProjectsBrowser
        poradiStavu={poradiStavu}
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
                jmeno: k.name || k.email,
                firma: k.company?.name ?? null,
                companyId: k.companyId,
              }))}
              manazeri={manazeriProFormular}
              herci={herciProFormular.map((h) => ({ id: h.id, label: bezTitulu(h.name) || h.email }))}
              typyProjektu={typyProjektu}
              typAudioknihy={typAudioknihy}
            />
          ) : null
        }
        active={active}
        finished={finished}
        columns={bezVydani(sloupce.pocitac)}
        columnsMobil={bezVydani(sloupce.mobil)}
        spolecneSloupce={bezVydani(sloupce.spolecne)}
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
