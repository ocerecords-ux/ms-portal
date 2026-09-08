import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Topbar } from '@/app/(portal)/components/Topbar';
import { TaskDock } from '@/app/(portal)/components/TaskDock';
import { loadMenuEntries, pageOptionsFor, visibleFor } from '@/lib/menuServer';
import { loadMyTasks } from '@/lib/tasksServer';

// Administrace Mediaspace - pristupna jen uctum s roli ADMIN. Middleware
// (src/middleware.ts) uz neprihlasene/neadminy blokuje na urovni routovani,
// tady je stejna kontrola znovu primo v serverove komponente (obrana do hloubky).
//
// Pouziva stejny Topbar jako zbytek portalu (zadani 9. 9. 2026: "Chci ať to
// zustane všechno jednoduše s tou fialovou lištou nahoře.").
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/login');

  const [entries, tasks] = await Promise.all([
    loadMenuEntries(session.user.id),
    loadMyTasks(session.user.id, session.user.role),
  ]);

  return (
    <div className="min-h-screen bg-paper">
      <Topbar
        userLabel={session.user.name || session.user.email}
        isAdmin
        items={visibleFor(entries, 'ADMIN')}
        pageOptions={pageOptionsFor('ADMIN')}
      />
      {/* Od 5. 9. 2026 stejne siroky obsah jako v klientske casti portalu
          (max-w-7xl): v max-w-4xl se tabulka uzivatelu nevesla a napr.
          telefonni cislo se lamalo na dva radky. */}
      {/* Vpravo je připnutý panel Úkolů - obsahu tam necháme místo. */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8 sm:py-12 pr-16 sm:pr-20">{children}</div>
      {/* Úkoly po ruce i v administraci - stejný panel jako ve zbytku portálu. */}
      <TaskDock tasks={tasks} />
    </div>
  );
}
