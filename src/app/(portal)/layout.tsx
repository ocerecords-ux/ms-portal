import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Topbar } from './components/Topbar';
import { TaskDock } from './components/TaskDock';
import { loadMenuEntries, pageOptionsFor, visibleFor } from '@/lib/menuServer';
import { loadMyTasks } from '@/lib/tasksServer';
import { isInternalRole } from '@/lib/roles';

// Jediné místo, které chrání celou klientskou sekci portálu. Session je
// zdroj pravdy o tom, kdo je přihlášen a pod jakou firmu (companyId) patří
// - jednotlivé stránky pak vždy filtrují data podle session.user.companyId,
// nikdy podle čehokoliv poslaného z prohlížeče.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const role = session.user.role;
  const isAdmin = role === 'ADMIN';
  const internal = isInternalRole(role);

  // Lišta je editovatelná (viz Topbar) a patří KONKRÉTNÍMU uživateli - úprava
  // se nikomu jinému nepromítne (zadani 8. 9. 2026). Co v ní vůbec smí být se
  // nenastavuje, řídí se právy ke stránce (lib/menu.ts > PAGE_ACCESS).
  const [entries, tasks] = await Promise.all([
    loadMenuEntries(session.user.id),
    loadMyTasks(session.user.id, role),
  ]);

  return (
    <div className="min-h-screen bg-paper">
      <Topbar
        userLabel={session.user.name || session.user.email}
        isAdmin={isAdmin}
        items={visibleFor(entries, role)}
        pageOptions={pageOptionsFor(role)}
      />
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8 sm:py-12">{children}</div>
      {/* Úkoly po ruce na každé stránce - vysouvací panel na pravé hraně
          (zadani 8. 9. 2026). Jen pro tým Mediaspace. */}
      {internal && <TaskDock tasks={tasks} />}
    </div>
  );
}
