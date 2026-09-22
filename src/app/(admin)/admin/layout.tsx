import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Topbar } from '@/app/(portal)/components/Topbar';
import { RozdeleneOkno } from '@/app/(portal)/components/RozdeleneOkno';
import { TaskDock } from '@/app/(portal)/components/TaskDock';
import { QuickDock } from '@/app/(portal)/components/QuickDock';
import { ChatDock } from '@/app/(portal)/components/ChatDock';
import { PoutkoDoku } from '@/app/(portal)/components/PoutkoDoku';
import { NeprecteneVedleDoku } from '@/app/(portal)/components/NeprecteneVedleDoku';
import { loadMenuEntries, pageOptionsFor, visibleFor } from '@/lib/menuServer';
import { pocetOtevrenychPripominek } from '@/lib/pripominkyServer';
import { pocetBonusuKeSchvaleni } from '@/lib/bonusyServer';
import { loadMyTasks } from '@/lib/tasksServer';
import { loadQuickActions } from '@/lib/quickActionsServer';
import { quickActionsFor } from '@/lib/quickActions';
import { prisma } from '@/lib/db';
import { countUnread } from '@/lib/notifications';
import { odkazNaFotku } from '@/lib/fotky';

// Administrace Mediaspace - pristupna jen uctum s roli ADMIN. Middleware
// (src/middleware.ts) uz neprihlasene/neadminy blokuje na urovni routovani,
// tady je stejna kontrola znovu primo v serverove komponente (obrana do hloubky).
//
// Pouziva stejny Topbar jako zbytek portalu (zadani 9. 9. 2026: "Chci ať to
// zustane všechno jednoduše s tou fialovou lištou nahoře.").
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/login');

  const [entries, tasks, quickActions, bonusyKeSchvaleni, pripominkyKVyrizeni, entriesMobil, unread, ucet] = await Promise.all([
    loadMenuEntries(session.user.id),
    loadMyTasks(session.user.id, session.user.role),
    loadQuickActions(session.user.id, session.user.role),
    // Odznak u Vykazu - viz zadani 15. 9. 2026.
    pocetBonusuKeSchvaleni(),
    // Odznak u bubliny se zpetnou vazbou - viz zadani 15. 9. 2026.
    pocetOtevrenychPripominek(),
    // LISTA PRO MOBIL, FOTKA A ZVONEK (21. 9. 2026: „když kliknu na Doklady,
    // tak se mi tam ukáže výchozí nabídka na panelu"). Administrace (Doklady,
    // Firmy, Uživatelé…) má vlastní layout a do té doby liště neposílala
    // mobilní nabídku - telefon pak ukázal tu z počítače. Stejně tak chyběla
    // fotka a počet nepřečtených pod zvonkem.
    loadMenuEntries(session.user.id, 'MOBIL'),
    countUnread(session.user.id).catch(() => 0),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { maFotku: true } }).catch(() => null),
  ]);

  return (
    <div className="min-h-screen bg-paper">
      <Topbar
        userLabel={session.user.name || session.user.email}
        userPhotoUrl={odkazNaFotku(session.user.id, ucet?.maFotku)}
        items={visibleFor(entries, 'ADMIN')}
        itemsMobil={visibleFor(entriesMobil, 'ADMIN')}
        unreadNotifications={unread}
        napoveda
        pageOptions={pageOptionsFor('ADMIN')}
        odznaky={bonusyKeSchvaleni > 0 ? { '/vykazy': bonusyKeSchvaleni } : undefined}
        pripominky={pripominkyKVyrizeni}
        spravcePripominek
        interni
      />
      {/* Od 5. 9. 2026 stejne siroky obsah jako v klientske casti portalu
          (max-w-7xl): v max-w-4xl se tabulka uzivatelu nevesla a napr.
          telefonni cislo se lamalo na dva radky. */}
      {/* Vpravo je připnutý panel Úkolů - obsahu tam necháme místo. */}
      <div className="obsah-portalu w-full px-4 sm:px-6 pt-3 pb-8 sm:py-12 md:pl-16 md:pr-20">
        <RozdeleneOkno>{children}</RozdeleneOkno>
      </div>
      {/* NA TELEFONU ZADNE DOKY - stejne jako ve zbytku portalu, viz
          (portal)/layout.tsx. Chat a ukoly maji vlastni aplikaci MS Chat. */}
      <div data-doky className="hidden md:block">
        {/* Rychle volby na leve hrane - stejny panel jako ve zbytku portalu. */}
        <QuickDock actions={quickActions} available={quickActionsFor('ADMIN')} />
        {/* Úkoly po ruce i v administraci - stejný panel jako ve zbytku portálu. */}
        <TaskDock tasks={tasks} />
        {/* Chat týmu - stejný panel u spodní hrany (zadani 8. 9. 2026). */}
        <ChatDock />
        {/* Poutko na prave hrane - vykresluje ho layout, viz PoutkoDoku.tsx. */}
        <PoutkoDoku />
        <NeprecteneVedleDoku />
      </div>
    </div>
  );
}
