import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { pocetOtevrenychPripominek } from '@/lib/pripominkyServer';
import { pocetBonusuKeSchvaleni } from '@/lib/bonusyServer';
import { authOptions } from '@/lib/auth';
import { Topbar } from './components/Topbar';
import { RozdeleneOkno } from './components/RozdeleneOkno';
import { TaskDock } from './components/TaskDock';
import { QuickDock } from './components/QuickDock';
import { ChatDock } from './components/ChatDock';
import { PoutkoDoku } from './components/PoutkoDoku';
import { NeprecteneVedleDoku } from './components/NeprecteneVedleDoku';
import { DotazyDock } from './components/DotazyDock';
import { loadMenuEntries, pageOptionsFor, sTabuli, visibleFor } from '@/lib/menuServer';
import { loadMyTasks } from '@/lib/tasksServer';
import { countUnread } from '@/lib/notifications';
import { loadQuickActions } from '@/lib/quickActionsServer';
import { quickActionsFor } from '@/lib/quickActions';
import { isInternalRole } from '@/lib/roles';
import { odkazNaFotku } from '@/lib/fotky';
import { zkusDatabazi } from '@/lib/dbZnovu';
import { nactiJazyk } from '@/lib/jazykServer';
import { JazykProvider } from './components/JazykProvider';
import { PrepinacNahledu } from './components/PrepinacNahledu';
import { nahledZHodnoty } from '@/lib/nahledRole';

// Jediné místo, které chrání celou klientskou sekci portálu. Session je
// zdroj pravdy o tom, kdo je přihlášen a pod jakou firmu (companyId) patří
// - jednotlivé stránky pak vždy filtrují data podle session.user.companyId,
// nikdy podle čehokoliv poslaného z prohlížeče.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  // Účet obrazovky ve studiu do portálu nesmí - jen na svou tabuli (22. 9. 2026).
  if (session.user.role === 'TABULE') redirect('/tabule/moje');

  const role = session.user.role;
  const internal = isInternalRole(role);
  // Jazyk portalu (zadani 13. 9. 2026). Cte se z cookie, takze stranka prijde
  // ze serveru rovnou prelozena.
  const jazyk = nactiJazyk();

  // Lišta je editovatelná (viz Topbar) a patří KONKRÉTNÍMU uživateli - úprava
  // se nikomu jinému nepromítne (zadani 8. 9. 2026). Co v ní vůbec smí být se
  // nenastavuje, řídí se právy ke stránce (lib/menu.ts > PAGE_ACCESS).
  //
  // NOUZOVÝ REŽIM (zadání 12. 9. 2026: „nedokážem tam zobrazit v tyto případy
  // alespoň nějaký nouzový režim? Nebo aspoň zprávu, o co jde?").
  //
  // Když se nepovede načíst lištu, celý portál dřív spadl na bílou stránku s
  // „Application error". Přitom je to skoro vždycky přeplněný pooler Supabase,
  // který se za pár set milisekund uvolní. Dotaz se proto párkrát zopakuje a
  // když ani pak neprojde, stránka se vykreslí bez lišty a s pruhem, který
  // říká, co se děje - obsah samotné stránky může mít data z jiného zdroje a
  // fungovat dál.
  let entries: Awaited<ReturnType<typeof loadMenuEntries>> = [];
  let entriesMobil: Awaited<ReturnType<typeof loadMenuEntries>> = [];
  let tasks: Awaited<ReturnType<typeof loadMyTasks>> = [];
  let unread = 0;
  // Stub Prismy vrací celý User; zajímají nás jen tyhle tři věci.
  let ucet: { maFotku: boolean; udajeDoplneny: boolean; tabulePristup?: { id: string }[] } | null = null;
  let quickActions: Awaited<ReturnType<typeof loadQuickActions>> = [];
  let nouzovyRezim = false;
  try {
    [entries, tasks, unread, ucet, quickActions, entriesMobil] = await zkusDatabazi(() =>
      Promise.all([
        loadMenuEntries(session.user.id),
        loadMyTasks(session.user.id, role),
        countUnread(session.user.id),
        // Fotka do lišty (zadani 9. 9. 2026) - v session není, bere se z karty účtu.
        // Jen priznak, ne samotna fotka - ta se vydava zvlast a prohlizec si
        // ji drzi v mezipameti (12. 9. 2026, egress na Supabase).
        prisma.user.findUnique({
          where: { id: session.user.id },
          // `udajeDoplneny` je brana nize - herec, ktery prisel pozvankou,
          // ma napred vyplnit sve udaje (zadani 16. 9. 2026).
          // Tabule v liště (23. 9. 2026) - stačí vědět, jestli nějakou má.
          select: { maFotku: true, udajeDoplneny: true, tabulePristup: { select: { id: true } } },
        }) as Promise<{ maFotku: boolean; udajeDoplneny: boolean; tabulePristup?: { id: string }[] } | null>,
        // Rychle volby v levem panelu (zadani 9. 9. 2026).
        loadQuickActions(session.user.id, role),
        // Lista pro mobil (zadani 19. 9. 2026) - kdo si ji neupravil, ma
        // stejnou jako na pocitaci.
        loadMenuEntries(session.user.id, 'MOBIL'),
      ]),
    );
  } catch (err) {
    console.error('Layout portálu: databáze neodpovídá, jedu v nouzovém režimu.', err);
    nouzovyRezim = true;
  }

  /**
   * Tabule v liště (23. 9. 2026) - komu ji admin na kartě povolil. Admin ji
   * má vždycky: vybere si na /tabule/moje, kterou pobočku chce (oprava
   * 23. 9. 2026: „když kliknu na odkaz tabule na hlavní liště, tam mě to
   * přesměruje na projekty").
   */
  const maTabuli = role === 'ADMIN' || ((ucet?.tabulePristup ?? []) as { id: string }[]).length > 0;

  /**
   * NOVÝ HEREC NEJDŘÍV DOPLNÍ ÚDAJE (zadání 16. 9. 2026: „po tom, co si herec
   * nastaví heslo, ho to vyzve, ať doplní údaje").
   *
   * Brána stojí tady, ne až po nastavení hesla: herec se po pozvánce přihlásí
   * jako každý jiný a rovnou z přihlášení jde do portálu. Zastaví ho to
   * i v případě, že formulář poprvé zavřel.
   *
   * V nouzovém režimu (`ucet` chybí) se nezastavuje nikdo - nefunkční
   * databáze nesmí zavřít portál.
   */
  if (role === 'HEREC' && ucet && !ucet.udajeDoplneny) redirect('/doplnit-udaje');

  // Bonusy ke schvaleni do odznaku v liste (zadani 15. 9. 2026). Vlastni
  // dotaz mimo blok vys: kdyz nevyjde, lista se kvuli nemu nema rozbit.
  const bonusyKeSchvaleni = role === 'ADMIN' ? await pocetBonusuKeSchvaleni() : 0;
  // Pripominky k portalu ceka vyridit jen Zuzo-labuzo (zadani 15. 9. 2026).
  const pripominkyKVyrizeni = role === 'ADMIN' ? await pocetOtevrenychPripominek() : 0;
  /**
   * Otazník Nápovědy (zadání 19. 9. 2026: „herci a klienti by neměli vidět
   * naše interní nápovědy"). Tým ho má vždy; herec a klient jen tehdy, když
   * je zveřejněný návod zaškrtnutý přímo pro jejich roli.
   */
  const maNapovedu = internal
    ? true
    : await prisma.navod
        .count({ where: { zverejneno: true, proRole: { has: role } } })
        .then((n) => n > 0)
        .catch(() => false);

  return (
    <JazykProvider jazyk={jazyk}>
    <div className="min-h-screen bg-paper">
      {/* odznaky: kolik bonusu ceka na schvaleni u odkazu Vykazy (zadani
          15. 9. 2026). Tyka se jen Zuzo-labuzo - zvukar bonusy neschvaluje. */}
      <Topbar
        userLabel={session.user.name || session.user.email}
        userPhotoUrl={odkazNaFotku(session.user.id, ucet?.maFotku)}
        items={sTabuli(visibleFor(entries, role), maTabuli, vychoziLista(entries))}
        itemsMobil={sTabuli(visibleFor(entriesMobil, role), maTabuli, vychoziLista(entriesMobil))}
        pageOptions={pageOptionsFor(role, maTabuli)}
        unreadNotifications={unread}
        odznaky={bonusyKeSchvaleni > 0 ? { '/vykazy': bonusyKeSchvaleni } : undefined}
        pripominky={pripominkyKVyrizeni}
        spravcePripominek={role === 'ADMIN'}
        interni={internal}
        napoveda={maNapovedu}
      />
      {/* Pruh náhledového účtu (zadání 18. 9. 2026). Vidí ho jen ten jeden
          účet - ostatním se nevykreslí vůbec. */}
      {session.user.jenNahled && (
        <PrepinacNahledu volba={nahledZHodnoty(session.user.nahledVolba)} />
      )}
      {/* Panel Úkolů je připnutý na pravé hraně okna, takže obsahu vpravo
          uvolníme místo - jinak se přes něj tabulky "usekávaly"
          (zadani 8. 9. 2026). */}
      {nouzovyRezim && (
        <p className="m-0 px-4 sm:px-6 py-2.5 bg-warnTint border-b border-line text-sm font-body text-status-progress text-center">
          {jazyk === 'en'
            ? 'The database is busy right now, so the portal is running in reduced mode — the menu and tasks may be incomplete. Your data is safe; please refresh in a moment.'
            : 'Databáze má zrovna plno, takže portál jede v nouzovém režimu — nabídka a úkoly nemusí být úplné. Data jsou v pořádku, za chvíli dejte F5.'}
        </p>
      )}
      <div
        // Odsazeni na doky plati az od md - na telefonu zadne doky nejsou
        // (viz nize), takze by z nich zbyl jen prazdny pruh po stranach.
        className={`obsah-portalu w-full px-4 sm:px-6 pt-3 pb-8 sm:py-12 md:pl-16 ${internal ? 'md:pr-20' : ''}`}
      >
        {internal ? <RozdeleneOkno>{children}</RozdeleneOkno> : children}
      </div>
      {/* Úkoly po ruce na každé stránce - vysouvací panel na pravé hraně
          (zadani 8. 9. 2026). Jen pro tým Mediaspace. */}
      {/* Rychle volby na leve hrane - zatazene jsou to jen zelene ikony
          na fialovem podkladu (zadani 9. 9. 2026). */}
      {/* RYCHLE VOLBY JSOU JEN PRO TYM (zadani 12. 9. 2026: „dal bych pryc cele
          ty rychle volby na leve strane stranky i s tim vysouvacim menu").
          Klient ma misto nich dok dotazu u prave hrany - jednu vec na jednom
          miste, ne dva vysouvaci panely na dvou stranach. */}
      {/* NA TELEFONU ŽÁDNÉ DOKY (zadání 14. 9. 2026: „v aplikaci MS portal bych
          dal pryč chat a úkoly, na to máme samostatnou aplikaci… a rychlé
          volby nalevo taky smaž").
          
          Chat a úkoly mají vlastní aplikaci MS Chat, takže je portál na
          telefonu nemá zdvojovat. Rychlé volby jsou navíc panel, který se
          vysouvá z levé hrany — na šířku telefonu zabíral pruh přes celou
          výšku a překrýval tabulku.

          Schované šířkou, ne smazané: na počítači zůstávají všechny. Obal
          `hidden md:block` je kvůli tomu, že panely samy jsou `position:
          fixed` — schovat se musí přes rodiče, jinak by dál visely nad
          stránkou. */}
      <div data-doky className="hidden md:block">
        {internal && <QuickDock actions={quickActions} available={quickActionsFor(role)} />}
        {internal && <TaskDock tasks={tasks} />}
        {/* Chat týmu - stejný vysouvací panel, jen u spodní hrany
            (zadani 8. 9. 2026). Taky jen pro tým Mediaspace. */}
        {internal && <ChatDock />}
        {/* Poutko na prave hrane, kterym se panel otevira. Vykresluje ho layout,
            ne nektery z panelu - oprava 11. 9. 2026, viz PoutkoDoku.tsx. */}
        {internal && <PoutkoDoku />}
        {/* Tvare neprectenych rozhovoru nalevo od poutka (zadani 12. 9. 2026). */}
        {internal && <NeprecteneVedleDoku />}
      </div>
      {/* Klientsky dok dotazu k projektum (zadani 12. 9. 2026) - vypada jako
          nas dok, ale mluvi jen s /api/dotazy, kde se u kazdeho pozadavku
          overuje, ze projekt patri firme prihlaseneho klienta. */}
      {!internal && role === 'CLIENT' && <DotazyDock />}
    </div>
    </JazykProvider>
  );
}

/** Lišta, kterou si uživatel nikdy neupravoval - položky mají výchozí id. */
function vychoziLista(entries: { id: string }[]): boolean {
  return entries.every((e) => e.id.startsWith('default-'));
}
