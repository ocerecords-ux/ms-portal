import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  canEditProjectMeta,
  canManageCalendar,
  canViewProjectBudget,
  canViewProjectBusinessInfo,
  canViewProjectDocuments,
  isInternalRole,
  vidiProjektyVPriprave,
} from '@/lib/roles';
import { jeVPriprave } from '@/lib/stavyProjektu';
import { STAV_ODEVZDANO, dnuDoPreklopeni, kdyVstoupilDoStavu } from '@/lib/cekameNaOpravyServer';
import { listProjectTypeOptions, listRodnyListProjectTypes, mapaIkonTypu } from '@/lib/priceList';
import { druhNotifikaceFirmy } from '@/lib/notifikaceFirmy';
import { DEFAULT_BUDGET_SETTINGS, computeBudget } from '@/lib/budget';
import { durationMinutes, entryAmount, toHours } from '@/lib/timesheets';
import { ProjectBudget } from './ProjectBudget';
import { ProjectBudgetZakazka } from './ProjectBudgetZakazka';
import { StatusPill } from '../shared';
import { ProjectMetaForm } from './ProjectMetaForm';
import { ProjectDocuments, invoiceStatus, offerStatus, type ProjectDocRow } from './ProjectDocuments';
import { ZnackaZWebu } from '@/components/ZnackaZWebu';
import { navrhNabidkyZObjednavky, objednavkaProjektu } from '@/lib/nabidkaZObjednavky';
import { CONTRACT_STATUS_CLASSES, CONTRACT_STATUS_LABELS } from '@/lib/contracts';
import { computeTotals } from '@/lib/doklady';
import { expenseTotalMinor } from '@/lib/expenses';
import { sessionsForPages } from '@/lib/calendar';
import { loadCalendarSettings, loadStudios } from '@/lib/calendarServer';
import { RecordingSection } from './RecordingSection';
import { ProjectTabs, type ProjectTab } from './ProjectTabs';
import { ProtokolNataceni } from './ProtokolNataceni';
import { VykazyProjektu, type BonusRadek, type VykazRadek } from './VykazyProjektu';
import { CerpaniPoDruzich } from './CerpaniPoDruzich';
import { RodnyListSection } from './RodnyListSection';
import { HistorieProjektu } from './HistorieProjektu';
import { Preposlech } from './Preposlech';
import { OdkazProKlienta } from './OdkazProKlienta';
import { nactiPreposlech } from '@/lib/preposlechServer';
import { stavOdkazu, zajistiOdkaz } from '@/lib/preposlechOdkaz';
import { nactiPripominky, seznamSpotu } from '@/lib/reklamaPripominky';
import { stavSchvaleni } from '@/lib/schvaleniKlientem';
import { SpotTagger } from '@/app/pripominkovat/[token]/VideoTagger';
import { nactiHistoriiProjektu } from '@/lib/projektLogServer';
import { findInternalProject } from '@/lib/projektySeznamServer';
import { nabidkaManazeru } from '@/lib/manazeriServer';
import { loadRodneListy } from '@/lib/rodnyListServer';
import { bezStarePredpony, dnesniDatum, vychoziNazevSpotu, VYCHOZI_REZIE } from '@/lib/rodnyList';
import { nactiPenizeProjektu } from '@/lib/projektPenizeServer';
import { natoceniProjektu } from '@/lib/brunoServer';
import { nactiProgresNataceni } from '@/lib/progresNataceniServer';
import { ProgresNataceniKarta } from './ProgresNataceniKarta';
import { bezTitulu } from '@/lib/jmena';

// Detail projektu (zadani 5. 9. 2026). Od 11. 9. 2026 projekt zije v portalu -
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

  // Kdo co smi videt - musi se vedet driv, nez se pro to pojede do databaze.
  //
  // DVA RUZNE KRUHY (zadani 16. 9. 2026: „povol Helce, at vidi polozky
  // rozpoctu v detailu projektu. Nemela by videt doklady jako nabidky
  // a faktury"): rozpocet vidi Zuzo-labuzo i produkce, doklady jen
  // Zuzo-labuzo. Zvukar ani jedno.
  const showDocuments = canViewProjectDocuments(session.user.role);
  const showRozpocet = canViewProjectBudget(session.user.role);

  // POZOR NA PORADI (zprava 9. 9. 2026: "web se mi zdá zpomalený"): drive se
  // tady cekalo postupne na tri skupiny dotazu za sebou, a teprve pak na dalsi.
  // Kazda takova bariera znamena dalsi kolecko tam a zpet do Supabase - a
  // protoze si kazda instance funkce drzi jen JEDNO spojeni (viz lib/db.ts),
  // scitalo se to. Ted jde do databaze vsechno naraz, takze se ceka jen na to
  // nejpomalejsi z toho.
  const [
    zSeznamu,
    meta,
    managers,
    klientiUctu,
    klientskeFirmy,
    herciUctu,
    projectTypeOptions,
    rodnyListTypy,
    penize,
    recordingRequests,
    herci,
    studia,
    calendarSettings,
    historie,
    dotoceniHercu,
    ikonyTypu,
    natoceno,
    druhyLicence,
  ] = await Promise.all([
    // Projekt tak, jak se ukazuje v prehledu (lib/projektySeznamServer.ts).
    findInternalProject(caflouProjectId),
    prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        // Herci projektu (zadani 10. 9. 2026) - muze jich byt vic.
        herci: { select: { id: true } },
        // Druhy licence zaskrtnute u projektu (zadani 18. 9. 2026).
        licence: { select: { id: true } },
      },
    }),
    // Manazer projektu - jen ucty, ktere to maji na karte zaskrtnute
    // (zadani 10. 9. 2026). Viz lib/manazeriServer.ts.
    nabidkaManazeru(),
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
    // Ucty hercu - herec u projektu je konkretni osoba (zadani 10. 9. 2026).
    prisma.user.findMany({
      where: { role: 'HEREC', active: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }),
    listProjectTypeOptions(),
    // Typy projektu, u kterych se dela Rodny list - tedy radiove spoty.
    listRodnyListProjectTypes(),
    // Rozpocet a doklady - jen pro toho, kdo na ne ma pravo. Viz
    // lib/projektPenizeServer.ts; zvukari se ta cisla ani nenactou.
    //
    // Ridi se to rozpoctem, ne doklady: produkce rozpocet vidi, a ten se bez
    // nabidky nebo faktury nespocita (cena zakazky je z nich). Doklady same
    // se ji ale nikde nevypisuji - viz zalozka Doklady nize.
    showRozpocet ? nactiPenizeProjektu(caflouProjectId) : null,
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
    // Historie projektu (zadani 10. 9. 2026) - jede spolu se vsim ostatnim,
    // aby detail nemel dalsi kolecko do databaze navic.
    nactiHistoriiProjektu(caflouProjectId),
    // Kdo z hercu ma dotoceno (zadani 11. 9. 2026).
    prisma.herecDotocen.findMany({
      where: { caflouProjectId },
      select: { userId: true, dotocenoAt: true },
    }),
    // Ikony typu projektu z Ceniku - do odznaku u typu (zadani 10. 9. 2026).
    mapaIkonTypu(),
    // Natacecí protokol - vede ho Bruno z chatu (zadani 12. 9. 2026).
    natoceniProjektu(caflouProjectId),
    /**
     * DRUHY LICENCE (zadani 18. 9. 2026). Nabizeji se aktivni druhy - a k tomu
     * ty, ktere uz projekt ma, i kdyby je nekdo mezitim vyradil. Jinak by
     * zaskrtnuta licence z karty tise zmizela.
     */
    prisma.druhLicence.findMany({
      where: { OR: [{ active: true }, { projekty: { some: { caflouProjectId } } }] },
      orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }],
      select: { id: true, nazev: true, ikona: true },
    }),
  ]);

  // Dotoceni hercu do tvaru, ve kterem s tim pracuji komponenty: ucet -> datum.
  const dotoceniPodleHerce: Record<string, string> = Object.fromEntries(
    dotoceniHercu.map((d) => [d.userId, d.dotocenoAt.toISOString()]),
  );

  // Zapisy Bruna jako zaznamy (zadani 13. 9. 2026: „v detailu bych to delal
  // jako zaznamy: Datum a strana"). Od nejnovejsiho; herec muze chybet, kdyz
  // se ve zprave nevyjasnil.
  const zaznamyNatoceni = natoceno.map((n) => ({
    id: n.id,
    strana: n.strana,
    kdy: n.createdAt.toISOString(),
    userId: n.userId,
    jmeno: n.user ? n.user.name || n.user.email : null,
  }));

  // Firma projektu. Od 11. 9. 2026 ji projekt drzi primo (ProjectMeta.companyId);
  // dohledani podle stareho ID z Caflou zustava jen pro projekty, ktere jeste
  // vlastni firmu vyplnenou nemaji.
  const company = meta?.companyId
    ? await prisma.company.findUnique({
        where: { id: meta.companyId },
        select: {
          id: true,
          name: true,
          driveFolderUrl: true,
          ratePerPage: true,
          dealsAudiobooks: true,
          dealsAds: true,
          audioknihyNaKlic: true,
        },
      })
    : zSeznamu?.caflouCompanyId
      ? await prisma.company.findFirst({
          where: { caflouCompanyId: zSeznamu.caflouCompanyId },
          select: {
          id: true,
          name: true,
          driveFolderUrl: true,
          ratePerPage: true,
          dealsAudiobooks: true,
          dealsAds: true,
          audioknihyNaKlic: true,
        },
        })
      : null;

  const project = zSeznamu?.project ?? null;

  // Projekt v pripravě zvukar nevidi ani na primy odkaz (zadani 15. 9. 2026) -
  // jinak by staci otevrit adresu a seznam by ho chranil jen naoko.
  if (
    !vidiProjektyVPriprave(session.user.role) &&
    jeVPriprave(meta?.statusName ?? project?.statusName ?? null)
  ) {
    redirect('/projekty');
  }


  // Rodny list i Hudba ve spotu se delaji jen u radiovych spotu (upresneni
  // 9. 9. 2026, rozsireno 10. 9. 2026) - pozna se to podle typu projektu,
  // ne podle firmy. U ostatnich projektu se zalozka vubec neukazuje.
  const jeRadiovySpot = rodnyListTypy.includes(meta?.projectType ?? '');
  const rodneListy = jeRadiovySpot ? await loadRodneListy(caflouProjectId) : [];
  // Meta se cte znovu, protoze synchronizace vyse mohla zapsat chybu.
  const metaPoSync = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    include: { company: { select: { name: true } } },
  });
  // Firma projektu tak, jak je vyplnena v portalu.
  const firmaProjektu = metaPoSync?.company ?? null;

  /**
   * ZA KOLIK DNÍ SE STAV PŘEKLOPÍ SÁM (zadání 16. 9. 2026: „bylo by dobré tam
   * mít o tom nějaký údaj, za kolik dní se to překlopí").
   *
   * Počítá se jen u projektu, který v tom stavu opravdu je a není ukončený -
   * jinde by to bylo číslo bez významu. Odkdy v něm je, se bere z historie
   * projektu; viz lib/cekameNaOpravyServer.ts.
   */
  const dnuDoOprav =
    metaPoSync?.statusName === STAV_ODEVZDANO && !metaPoSync?.finished
      ? dnuDoPreklopeni(await kdyVstoupilDoStavu(caflouProjectId, STAV_ODEVZDANO))
      : null;

  // Rozpocet (zadani 6. 9. 2026) - jen u audioknih, kde zname pocet normostran.
  // Vidi ho Zuzo-labuzo a od 16. 9. 2026 i produkce; zvukar se k cislum
  // nedostane (zadani 11. 9. 2026) - viz canViewProjectBudget v lib/roles.ts.
  const { budgetSettings, timesheets, offers, invoices, expenses, contracts, naklady } = penize ?? {
    budgetSettings: null,
    timesheets: [],
    offers: [],
    invoices: [],
    expenses: [],
    contracts: [],
    naklady: [],
  };
  const nakladovePolozky = naklady.map((n) => ({ nazev: n.nazev, castka: n.castka }));
  /**
   * Jména herců k našeptávání u položkových nákladů (zadání 14. 9. 2026).
   * Je to jen nápověda - do políčka jde napsat i někdo, kdo v portálu účet
   * nemá, nebo úplně jiná položka. Viz NakladyProjektu.
   */
  const jmenaHercu = herci.map((h) => bezTitulu(h.name) || h.email).filter(Boolean);

  /**
   * PROGRES NATÁČENÍ (zadání 19. 9. 2026: „hlavně my v detailu projektu").
   * U reklam se nenatáčí podle stran textu, tam se karta neukazuje.
   */
  const herciProjektu = seradHerce(meta?.herci ?? [], meta?.actorUserId ?? null);
  const ukazatProgres = druhNotifikaceFirmy(company) !== 'REKLAMA' && !jeRadiovySpot;
  const progresNataceni = ukazatProgres
    ? ((await nactiProgresNataceni([{ id: caflouProjectId, herciIds: herciProjektu }])).get(caflouProjectId) ?? null)
    : null;
  const jmenoHerce = new Map(herciUctu.map((h) => [h.id, bezTitulu(h.name) || h.email]));

  const settings = budgetSettings ?? DEFAULT_BUDGET_SETTINGS;
  const showBudget =
    showRozpocet && company?.dealsAudiobooks === true && (project?.pageCount ?? 0) > 0;
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
      amountMinor: computeTotals(o.items, o).incVat,
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
      amountMinor: computeTotals(i.items, i).incVat,
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
      {ukazatProgres && (
        <ProgresNataceniKarta
          progres={progresNataceni}
          herci={herciProjektu.map((id) => ({ id, jmeno: jmenoHerce.get(id) ?? 'Herec' }))}
        />
      )}
      {/* Karta "Z Caflou" je od 10. 9. 2026 pryc (zadani). Ukazovala tytez
          udaje, ktere jsou hned pod ni ve formulari - jen ve verzi, kterou uz
          portal needituje. Dokud projekt zil v Caflou, mela smysl jako
          kontrola; ted, kdyz o projektu rozhoduje portal, by z ni byl jen
          druhy udaj vedle toho spravneho. Data z Caflou se porad ctou jako
          zaloha pro projekty, ktere jeste neprosly prenosem - jen se
          nevypisuji zvlast. */}

      {/* jeReklamniFirma: u reklamni firmy odejde jedina zprava (zadani
          14. 9. 2026) - at tlacitko „Poslat zpravu znovu" nenabizi stav,
          ve kterem stejne nic neodejde. */}
      <ProjectMetaForm
        caflouProjectId={caflouProjectId}
        canEdit={canEdit}
        managers={managers}
        klienti={klientiUctu.map((k) => ({
          id: k.id,
          // Jen jmeno, bez firmy (zadani 19. 9. 2026: „nazev firmy je
          // zbytecny") - firma je hned vedle ve vlastnim poli a lide z ni
          // jsou v nabidce nahore ve skupine „Z vybrane firmy".
          label: k.name || k.email,
          companyId: k.companyId,
        }))}
        firmy={klientskeFirmy.map((f) => ({ id: f.id, label: f.name }))}
        herci={herciUctu.map((h) => ({ id: h.id, label: bezTitulu(h.name) || h.email }))}
        dotoceniHercu={dotoceniPodleHerce}
        natoceniZaznamy={zaznamyNatoceni}
        vidiKlienta={canViewProjectBusinessInfo(session.user.role)}
        ukonceny={metaPoSync?.finished ?? project?.finished ?? false}
        dnuDoOprav={dnuDoOprav}
        herecZCaflou={meta?.narrator ?? project?.narrator ?? null}
        klientNameZCaflou={meta?.klientName ?? null}
        companyDriveFolderUrl={company?.driveFolderUrl ?? null}
        projectTypeOptions={projectTypeOptions}
        jeReklamniFirma={druhNotifikaceFirmy(company) === 'REKLAMA'}
        rodnyListTypy={rodnyListTypy}
        ikonyTypu={ikonyTypu}
        druhyLicence={druhyLicence}
        initial={{
          driveUrl: meta?.driveUrl ?? '',
          managerUserId: meta?.managerUserId ?? '',
          priority: meta?.priority ?? '',
          projectType: meta?.projectType ?? '',
          // Stav a herec: prednost ma to, co je v portalu. Dokud neprobehne
          // prenos, je tam prazdno a pouzije se posledni hodnota z Caflou.
          statusName: meta?.statusName ?? project?.statusName ?? '',
          // Poradi: hlavni herec (actorUserId) prvni, zbytek za nim. Vazba
          // sama poradi nedrzi, drzi ho prave tenhle sloupec.
          actorUserIds: seradHerce(meta?.herci ?? [], meta?.actorUserId ?? null),
          klientUserId: meta?.klientUserId ?? '',
          companyId: meta?.companyId ?? company?.id ?? '',
          // Data jsou v databazi ulozena jako pulnoc UTC, at se den neposune
          // podle pasma - do policka jdou proto uriznuta z ISO, ne pres
          // lokalni formatovani.
          endDate: naDatumPole(meta?.endDate ?? null),
          releaseDate: naDatumPole(meta?.releaseDate ?? null),
          // Ucel a uzemi uziti licence - predvyplni se do smlouvy (17. 9. 2026).
          licenceUziti: meta?.licenceUziti ?? '',
          licenceIds: (meta?.licence ?? []).map((l) => l.id),
        }}
      />
    </>
  );

  /**
   * Rozpocet ma vlastni zalozku (zadani 11. 9. 2026: „rozpocet v detailu
   * projektu dej do zalozky") a je U KAZDEHO PROJEKTU (zadani tyz den:
   * „rozpocet dej do kazde karty projektu, bude se to akorat lisit tim,
   * jestli je to audiokniha nebo reklama").
   *
   * Audiokniha: portal rozpocet SPOCITA z normostran (frekvence, strih,
   * bonus). Reklama: normostrany nejsou a cena se s klientem dohodne, takze
   * se bere z toho, co je na papire - z faktury, a dokud zadna neni,
   * z nabidky. Proti ni stoji vykazy a vydaje.
   */
  const vCzk = (mena: string) => mena === 'CZK';
  const korunyBezDph = (minor: number) => minor / 100;
  const cenaZFaktur = invoices
    .filter((i) => vCzk(i.currency) && invoiceStatus(i.status).label !== 'Stornovaná')
    .reduce((soucet, i) => soucet + korunyBezDph(computeTotals(i.items, i).exVat), 0);
  const cenaZNabidek = offers
    .filter((o) => vCzk(o.currency))
    .reduce((soucet, o) => soucet + korunyBezDph(computeTotals(o.items, o).exVat), 0);
  const vydajeCelkem = expenses
    .filter((e) => vCzk(e.currency))
    .reduce((soucet, e) => soucet + korunyBezDph(e.amountExVatMinor), 0);

  // Prednost ma NABIDKA (zadani 11. 9. 2026: „bude si brat cenu z nabidky").
  // Faktura je zaloha pro projekty, kde se nabidka nedelala.
  const cenaZakazky = cenaZNabidek > 0 ? cenaZNabidek : cenaZFaktur > 0 ? cenaZFaktur : null;
  const zdrojCeny = cenaZNabidek > 0 ? ('nabidka' as const) : cenaZFaktur > 0 ? ('faktura' as const) : null;

  // Vykazy pod rozpoctem (zadani 13. 9. 2026). Date se do klientske
  // komponenty posilat neda, proto ISO retezec.
  const vykazyRadky: VykazRadek[] = timesheets.map((t) => ({
    id: t.id,
    den: t.date.toISOString(),
    odMinut: t.startMinutes,
    doMinut: t.endMinutes,
    sazba: t.hourlyRateSnapshot,
    druh: t.workType,
    poznamka: t.note,
    kdo: t.user?.name || t.user?.email || '—',
  }));

  /**
   * Schvalene bonusy k projektu (zadani 15. 9. 2026: „ani v detailu projektu
   * v zalozce vykazy nevidime bonusy"). Jen schvalene - navrh, o kterem se
   * jeste nerozhodlo, nikomu nepatri.
   */
  const bonusyRadky: BonusRadek[] = showRozpocet
    ? (
        await prisma.bonusZvukare
          .findMany({
            where: { caflouProjectId, stav: 'SCHVALENO' },
            orderBy: { rozhodnutoAt: 'desc' },
            include: { user: { select: { name: true, email: true } } },
          })
          .catch(() => [])
      ).map((b) => ({
        id: b.id,
        kdo: b.user.name || b.user.email,
        castka: b.castka,
        schvalenoDen: b.rozhodnutoAt ? b.rozhodnutoAt.toISOString() : null,
        poznamka: b.poznamka,
      }))
    : [];

  // Vykazane penize zvlast za nataceni a zvlast za strih (zadani 14. 9. 2026).
  // „Ostatni" se nepocita - ten druh prace k projektu nepatri.
  const castka = (e: (typeof timesheets)[number]) =>
    entryAmount(e.startMinutes, e.endMinutes, e.hourlyRateSnapshot);
  const vykazanoNataceni = timesheets
    .filter((e) => e.workType === 'RECORDING')
    .reduce((sum, e) => sum + castka(e), 0);
  const vykazanoStrih = timesheets
    .filter((e) => e.workType === 'EDITING')
    .reduce((sum, e) => sum + castka(e), 0);

  const rozpocet = !showRozpocet ? null : budget ? (
    <ProjectBudget
      budget={budget}
      spent={spent}
      revenue={revenue}
      ratePerPage={company?.ratePerPage ?? null}
      hoursLogged={hoursLogged}
      caflouProjectId={caflouProjectId}
      pocatecniPolozky={nakladovePolozky}
      jmenaHercu={jmenaHercu}
      naKlic={company?.audioknihyNaKlic === true}
      cenaZDokladu={cenaZakazky}
      zdrojCeny={zdrojCeny}
    />
  ) : (
    <ProjectBudgetZakazka
      caflouProjectId={caflouProjectId}
      cena={cenaZakazky}
      zdrojCeny={zdrojCeny}
      spent={spent}
      hoursLogged={hoursLogged}
      vydaje={vydajeCelkem}
      pocatecniPolozky={nakladovePolozky}
      jmenaHercu={jmenaHercu}
    />
  );

  // Vykazy visi pod rozpoctem, at je to jedna obrazovka: „kolik to melo stat"
  // hned nad „kdo si co zapsal". Plati pro obe podoby rozpoctu (audiokniha
  // i zakazka), proto se to sklada az tady, ne uvnitr nich.
  /**
   * Graf cerpani stoji VEDLE rozpoctu (zadani 14. 9. 2026: „prehled muze byt
   * treba napravo vedle rozpoctu"). Jen u audioknihy - jinde rozpocet delenim
   * na nataceni a strih neprochazi, takze by graf nemel co ukazat.
   */
  const grafCerpani = budget ? (
    <CerpaniPoDruzich
      rozpocetNataceni={budget.recordingCost}
      rozpocetStrih={budget.editingCost}
      vykazanoNataceni={vykazanoNataceni}
      vykazanoStrih={vykazanoStrih}
    />
  ) : null;

  const rozpocetSVykazy = rozpocet && (
    <div className="flex flex-col gap-6">
      {/* Na sirokem okne rozpocet vlevo a graf vpravo, na uzkem pod sebou.
          STEJNE VYSOKE RAMECKY (zadani 14. 9. 2026: „jen srovnej ty ramecky,
          at nejsou ruzne velke"). Drive tu bylo items-start, takze si kazda
          karta vzala svou vysku a vedle sebe pak pusobily jako dva ruzne
          vysoke schody. Vychozi natahovani mrizky je srovna - vyssi z nich
          urcuje vysku radku a druha ji dorovna. */}
      {grafCerpani ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {rozpocet}
          {grafCerpani}
        </div>
      ) : (
        rozpocet
      )}
      <VykazyProjektu vykazy={vykazyRadky} bonusy={bonusyRadky} />
    </div>
  );

  const frekvence = (
    <RecordingSection
          caflouProjectId={caflouProjectId}
          projectName={project?.name ?? `Projekt ${caflouProjectId}`}
          companyId={company?.id ?? null}
          pageCount={project?.pageCount ?? null}
          sessionsFromPages={sessionsForPages(project?.pageCount ?? 0, calendarSettings.pagesPerSession)}
          narratorFromCaflou={project?.narrator ?? null}
          herci={herci.map((h) => ({ id: h.id, label: bezTitulu(h.name) || h.email }))}
          studios={studia.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          defaultActorUserId={meta?.actorUserId ?? null}
          datumOdevzdani={naDatumPole(meta?.endDate ?? null) || null}
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

  /**
   * OBJEDNÁVKA Z WEBU (zadání 18. 9. 2026). Podle ní se v hlavičce ukáže
   * značka „z webu" a v Dokladech předvyplněná nabídka. Poznává se podle
   * objednávky, ne podle příznaku na projektu - `zdroj` je „PORTAL" i
   * u projektu, který v portálu založila produkce.
   */
  const objednavkaZWebu = await objednavkaProjektu(caflouProjectId);
  // Nabidka je jen pro Zuzo-labuzo, stejne jako zbytek dokladu.
  const navrhNabidky = showDocuments ? await navrhNabidkyZObjednavky(caflouProjectId) : null;

  const doklady = (
    <ProjectDocuments
      offers={offerRows}
      invoices={invoiceRows}
      expenses={expenseRows}
      contracts={contractRows}
      invoicedByCurrency={invoicedByCurrency}
      costsByCurrency={costsByCurrency}
      caflouProjectId={caflouProjectId}
      companyId={meta?.companyId ?? company?.id ?? null}
      navrhNabidky={navrhNabidky}
    />
  );

  // Nazev firmy i projektu bereme Z PORTALU, ne pres Caflou. Projekt zalozeny
  // v portalu zadne caflouCompanyId nema, takze klient zustaval prazdny - a
  // protoze je klient povinny udaj, neslo u nej RL vyrobit vubec (zadani
  // 10. 9. 2026). Caflou zustava jako zaloha pro projekty pred prenosem.
  const rodnyList = (
    <RodnyListSection
      caflouProjectId={caflouProjectId}
      canEdit={canEdit}
      nazevFirmy={firmaProjektu?.name ?? company?.name ?? ''}
      projectName={metaPoSync?.name || project?.name || `Projekt ${caflouProjectId}`}
      jeRadiovySpot={jeRadiovySpot}
      rlError={metaPoSync?.rlError ?? null}
      rodneListy={rodneListy.map((rl) => ({
        id: rl.id,
        version: rl.version,
        fileName: rl.fileName,
        createdAt: rl.createdAt.toISOString(),
        driveUrl: rl.driveUrl,
        driveError: rl.driveError,
      }))}
      initial={{
        clientName: metaPoSync?.rlClientName || firmaProjektu?.name || company?.name || '',
        spotName: bezStarePredpony(
          metaPoSync?.spotName || vychoziNazevSpotu(metaPoSync?.name || project?.name || ''),
          metaPoSync?.name || project?.name || '',
        ),
        spotLengthSeconds: metaPoSync?.spotLengthSeconds != null ? String(metaPoSync.spotLengthSeconds) : '',
        // Rezie se predvyplnuje (zadani 10. 9. 2026) - jen kdyz u projektu
        // jeste zadna neni, at se rucne zadana nikdy neprepise.
        directorName: metaPoSync?.directorName || VYCHOZI_REZIE,
        musicTitle: metaPoSync?.musicTitle ?? '',
        musicAuthor: metaPoSync?.musicAuthor ?? '',
        noMusic: metaPoSync?.noMusic ?? false,
        // Datum vyroby se predvyplnuje na dnesek (zadani 10. 9. 2026) -
        // prazdne bylo nejcastejsi duvod, proc RL neslo vyrobit.
        productionDate: metaPoSync?.productionDate
          ? metaPoSync.productionDate.toISOString().slice(0, 10)
          : dnesniDatum(),
      }}
    />
  );

  const tabs: ProjectTab[] = [{ key: 'prehled', label: 'Přehled', content: prehled }];
  // Zalozka je u kazdeho projektu, ale jen pro toho, kdo na cisla ma pravo
  // (canViewProjectBudget) - Zuzo-labuzo a produkce ano, zvukar ne.
  if (rozpocet) {
    tabs.push({ key: 'rozpocet', label: 'Rozpočet', content: rozpocetSVykazy });
  }
  if (isInternalRole(session.user.role)) {
    tabs.push({
      key: 'frekvence',
      label: 'Natáčecí plán',
      count: recordingRequests.length,
      content: frekvence,
    });
  }
  // Zalozka JEN u radioveho spotu (zadani 10. 9. 2026: "hudba ve spotu bude
  // jen u typu projektu Radiovy spot").
  //
  // Do ted byla u vsech projektu - u spotu jako Rodny list, jinde aspon jako
  // Hudba ve spotu. U audioknihy ale zadny spot neni, takze to byla zalozka,
  // do ktere nikdo nemel co vyplnit.
  //
  // Radiovy spot se pozna podle typu projektu, a ten je polozka Ceniku
  // s priznakem "Rodny list" - neni to nikde v kodu napevno.
  if (jeRadiovySpot) {
    tabs.push({
      key: 'rodny-list',
      label: 'Rodný list',
      count: rodneListy.length,
      content: rodnyList,
    });
  }
  // AudioTagger - preposlech nahravky proti textu (zadani 11. 9. 2026).
  // Jen pro tym Mediaspace; zaznamy chyb patri tomuhle projektu.
  //
  // U REKLAMY JSOU TO PŘIPOMÍNKY (zadání 19. 9. 2026: „když jde o reklamu,
  // tak by se ta karta měla jmenovat Připomínky a mělo by to vypadat jako na
  // straně klienta. Tzn. vlevo tracky a napravo připomínky. Když tam bude
  // video, tak i náhled toho videa a informace o tom, jestli je schváleno").
  //
  // Reklama se nepřeposlouchává proti textu - klient si pustí spot a píše
  // k času, co drhne. Karta proto ukazuje TENTÝŽ tagger, který má klient na
  // odkazu, se stejnými připomínkami; jen bez tlačítka „Odeslat", které
  // patří klientovi. Reklama = firma má zaškrtnuté Reklamy, stejné pravidlo
  // jako u mailů.
  const jeReklama = druhNotifikaceFirmy(company) === 'REKLAMA';
  if (isInternalRole(session.user.role) && jeReklama) {
    /**
     * Tagger chodí pro soubory a připomínky přes token odkazu pro klienta -
     * stejnou cestou jako klient, takže vidíme přesně to, co on. Když odkaz
     * ještě není, založí se (klientovi nic neodchází, dokud mu ho někdo
     * nepošle).
     */
    const [odkaz, spoty, schvaleni, token] = await Promise.all([
      stavOdkazu(caflouProjectId),
      seznamSpotu(caflouProjectId),
      stavSchvaleni(caflouProjectId),
      zajistiOdkaz(caflouProjectId, session.user.name),
    ]);
    const prvni = spoty[0]?.id ?? '';
    const pripominky = prvni ? await nactiPripominky(caflouProjectId, prvni) : [];
    const kdySchvaleno = schvaleni.schvalenoAt
      ? new Intl.DateTimeFormat('cs-CZ', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(schvaleni.schvalenoAt))
      : null;

    tabs.push({
      key: 'pripominky',
      label: 'Připomínky',
      count: pripominky.filter((p) => !p.vyrizeno).length,
      content: (
        <div className="flex flex-col gap-4">
          {/* Schvaleni klientem - jen informace, schvaluje klient. */}
          {kdySchvaleno ? (
            <div className="rounded-card border border-brand-green bg-okTint px-4 py-3 flex items-center gap-2.5 flex-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-status-done shrink-0" aria-hidden="true">
                <path d="M4 12l6 6L20 6" />
              </svg>
              <span className="font-heading font-semibold text-sm text-ink">Klient zakázku schválil</span>
              <span className="text-xs font-body text-muted">{kdySchvaleno}</span>
            </div>
          ) : (
            <div className="rounded-card border border-line bg-surface px-4 py-3 flex items-center gap-2.5 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-status-progress shrink-0" aria-hidden="true" />
              <span className="font-heading font-semibold text-sm text-ink">Zatím neschváleno</span>
              <span className="text-xs font-body text-muted">
                Klient schvaluje tlačítkem Schválit v mailu, ve složce nebo ve svém portálu.
              </span>
            </div>
          )}

          <OdkazProKlienta caflouProjectId={caflouProjectId} pocatecni={odkaz} />

          {!token ? (
            <p className="text-sm font-body text-muted m-0">
              Odkaz pro klienta se nepodařilo připravit, a bez něj se nahrávky nenačtou. Zkuste
              stránku načíst znovu.
            </p>
          ) : spoty.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">
              Ve složce projektu zatím není žádný zvuk ani video. Jakmile tam něco přibude, objeví
              se tady i s připomínkami klienta.
            </p>
          ) : (
            <SpotTagger
              token={token}
              spoty={spoty}
              vybranyId={prvni}
              pocatecni={pripominky}
              jsemZTymu
              vKarteProjektu
            />
          )}
        </div>
      ),
    });
  } else if (isInternalRole(session.user.role)) {
    const [preposlech, odkaz] = await Promise.all([
      nactiPreposlech(caflouProjectId),
      stavOdkazu(caflouProjectId),
    ]);
    tabs.push({
      key: 'preposlech',
      label: 'Přeposlech',
      count: preposlech.chyby.length,
      content: (
        <div className="flex flex-col gap-4">
          {/* Odkaz, kterym klient posloucha - viz OdkazProKlienta.tsx. */}
          <OdkazProKlienta caflouProjectId={caflouProjectId} pocatecni={odkaz} />
          <Preposlech
            caflouProjectId={caflouProjectId}
            projectName={metaPoSync?.name || project?.name || `Projekt ${caflouProjectId}`}
            pocatecniStav={preposlech}
          />
        </div>
      ),
    });
  }
  // NATACECÍ PROTOKOL MA VLASTNI ZALOZKU (zadani 13. 9. 2026: „Natacecí
  // protokol presunme do zvlastni zalozky a nechme i v detailu u toho herce
  // jen odznak"). Drive visel pod hercem v prehledu projektu a u delsiho
  // nataceni odtlacil vsechno ostatni dolu.
  //
  // Zalozka je i kdyz je protokol prazdny - tam se clovek docte, ze se strany
  // beru z chatu. Kdyby se schovavala, vypadalo by to jako chybejici funkce.
  if (isInternalRole(session.user.role)) {
    tabs.push({
      key: 'protokol',
      label: 'Natáčecí protokol',
      count: zaznamyNatoceni.length,
      content: <ProtokolNataceni zaznamy={zaznamyNatoceni} />,
    });
  }
  // Historie je jen pro nas - klient se na detail projektu stejne nedostane,
  // ale zvukar ano a jemu se ukazuje ke cteni jako zbytek detailu.
  if (isInternalRole(session.user.role)) {
    tabs.push({
      key: 'historie',
      label: 'Historie',
      count: historie.length,
      content: <HistorieProjektu udalosti={historie} />,
    });
  }
  // DOKLADY ZUSTAVAJI JEN ZUZO-LABUZO (zadani 16. 9. 2026: „nemela by videt
  // doklady jako nabidky a faktury"). Produkce ma o zalozku vys rozpocet, ale
  // seznam nabidek, faktur, vydaju a smluv se ji tu neukaze - a odkazy z nej
  // vedou do /admin, kam ji middleware stejne nepusti.
  if (showDocuments) {
    tabs.push({
      key: 'doklady',
      label: 'Doklady',
      count: offerRows.length + invoiceRows.length + expenseRows.length + contractRows.length,
      content: doklady,
    });
  }

  // Detail je citaci a formularova stranka, ne tabulka - proto je omezeny
  // sirkou a vycentrovany (zadani 10. 9. 2026: "zbytecne dlouhe radky, kdyz
  // tam nic neni"). Seznam projektu zustava na celou obrazovku.
  return (
    <section className="flex flex-col gap-6 w-full max-w-[1180px] mx-auto">
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
          {/* Zakazka z objednavky na webu (zadani 18. 9. 2026). */}
          {objednavkaZWebu && <ZnackaZWebu objednanoAt={objednavkaZWebu.createdAt} />}
        </div>
        {company && <p className="text-muted text-sm font-body mt-1">{company.name}</p>}
      </div>

      <ProjectTabs tabs={tabs} />
    </section>
  );
}

/**
 * Herci projektu v pořadí: hlavní první.
 *
 * Vazba mezi projektem a herci pořadí sama nedrží — drží ho sloupec
 * `actorUserId` (hlavní herec). Ostatní jdou za ním tak, jak přijdou.
 */
function seradHerce(herci: { id: string }[], hlavni: string | null): string[] {
  const ids = herci.map((h) => h.id);
  if (!hlavni || !ids.includes(hlavni)) return ids;
  return [hlavni, ...ids.filter((id) => id !== hlavni)];
}

/**
 * Datum z databáze do políčka ve formuláři: „RRRR-MM-DD", nebo prázdno.
 *
 * Schválně přes ISO, ne přes lokální formátování - data se ukládají jako
 * půlnoc UTC a `getDate()` by v západním pásmu vrátilo den předtím.
 */
function naDatumPole(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}
