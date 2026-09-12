import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { Topbar } from './components/Topbar';
import { TaskDock } from './components/TaskDock';
import { QuickDock } from './components/QuickDock';
import { ChatDock } from './components/ChatDock';
import { PoutkoDoku } from './components/PoutkoDoku';
import { NeprecteneVedleDoku } from './components/NeprecteneVedleDoku';
import { DotazyDock } from './components/DotazyDock';
import { loadMenuEntries, pageOptionsFor, visibleFor } from '@/lib/menuServer';
import { loadMyTasks } from '@/lib/tasksServer';
import { countUnread } from '@/lib/notifications';
import { loadQuickActions } from '@/lib/quickActionsServer';
import { quickActionsFor } from '@/lib/quickActions';
import { isInternalRole } from '@/lib/roles';
import { odkazNaFotku } from '@/lib/fotky';
import { zkusDatabazi } from '@/lib/dbZnovu';

// Jediné místo, které chrání celou klientskou sekci portálu. Session je
// zdroj pravdy o tom, kdo je přihlášen a pod jakou firmu (companyId) patří
// - jednotlivé stránky pak vždy filtrují data podle session.user.companyId,
// nikdy podle čehokoliv poslaného z prohlížeče.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const role = session.user.role;
  const internal = isInternalRole(role);

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
  let tasks: Awaited<ReturnType<typeof loadMyTasks>> = [];
  let unread = 0;
  let ucet: { photoUrl: string | null } | null = null;
  let quickActions: Awaited<ReturnType<typeof loadQuickActions>> = [];
  let nouzovyRezim = false;
  try {
    [entries, tasks, unread, ucet, quickActions] = await zkusDatabazi(() =>
      Promise.all([
        loadMenuEntries(session.user.id),
        loadMyTasks(session.user.id, role),
        countUnread(session.user.id),
        // Fotka do lišty (zadani 9. 9. 2026) - v session není, bere se z karty účtu.
        prisma.user.findUnique({ where: { id: session.user.id }, select: { photoUrl: true } }),
        // Rychle volby v levem panelu (zadani 9. 9. 2026).
        loadQuickActions(session.user.id, role),
      ]),
    );
  } catch (err) {
    console.error('Layout portálu: databáze neodpovídá, jedu v nouzovém režimu.', err);
    nouzovyRezim = true;
  }

  return (
    <div className="min-h-screen bg-paper">
      <Topbar
        userLabel={session.user.name || session.user.email}
        userPhotoUrl={odkazNaFotku(session.user.id, ucet?.photoUrl)}
        items={visibleFor(entries, role)}
        pageOptions={pageOptionsFor(role)}
        unreadNotifications={unread}
      />
      {/* Panel Úkolů je připnutý na pravé hraně okna, takže obsahu vpravo
          uvolníme místo - jinak se přes něj tabulky "usekávaly"
          (zadani 8. 9. 2026). */}
      {nouzovyRezim && (
        <p className="m-0 px-4 sm:px-6 py-2.5 bg-warnTint border-b border-line text-sm font-body text-status-progress text-center">
          Databáze má zrovna plno, takže portál jede v nouzovém režimu — nabídka a úkoly nemusí být úplné. Data jsou
          v pořádku, za chvíli dejte F5.
        </p>
      )}
      <div
        className={`obsah-portalu w-full px-4 sm:px-6 py-8 sm:py-12 pl-14 sm:pl-16 ${internal ? 'pr-16 sm:pr-20' : ''}`}
      >
        {children}
      </div>
      {/* Úkoly po ruce na každé stránce - vysouvací panel na pravé hraně
          (zadani 8. 9. 2026). Jen pro tým Mediaspace. */}
      {/* Rychle volby na leve hrane - zatazene jsou to jen zelene ikony
          na fialovem podkladu (zadani 9. 9. 2026). */}
      {/* RYCHLE VOLBY JSOU JEN PRO TYM (zadani 12. 9. 2026: „dal bych pryc cele
          ty rychle volby na leve strane stranky i s tim vysouvacim menu").
          Klient ma misto nich dok dotazu u prave hrany - jednu vec na jednom
          miste, ne dva vysouvaci panely na dvou stranach. */}
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
      {/* Klientsky dok dotazu k projektum (zadani 12. 9. 2026) - vypada jako
          nas dok, ale mluvi jen s /api/dotazy, kde se u kazdeho pozadavku
          overuje, ze projekt patri firme prihlaseneho klienta. */}
      {!internal && role === 'CLIENT' && <DotazyDock />}
    </div>
  );
}
