import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Topbar } from './components/Topbar';
import { loadMenuEntries, visibleFor } from '@/lib/menuServer';

// Jediné místo, které chrání celou klientskou sekci portálu. Session je
// zdroj pravdy o tom, kdo je přihlášen a pod jakou firmu (companyId) patří
// - jednotlivé stránky pak vždy filtrují data podle session.user.companyId,
// nikdy podle čehokoliv poslaného z prohlížeče.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const isAdmin = session.user.role === 'ADMIN';
  // Odkazy v liště jsou editovatelné (viz Topbar). Co uvidí konkrétní role se
  // nenastavuje - řídí se právy ke stránce (lib/menu.ts > PAGE_ACCESS).
  const entries = await loadMenuEntries();

  return (
    <div className="min-h-screen bg-paper">
      <Topbar
        userLabel={session.user.name || session.user.email}
        isAdmin={isAdmin}
        items={visibleFor(entries, session.user.role)}
        allItems={isAdmin ? entries : undefined}
      />
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8 sm:py-12">{children}</div>
    </div>
  );
}
