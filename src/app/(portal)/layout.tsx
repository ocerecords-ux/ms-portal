import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Topbar } from './components/Topbar';
import { isInternalRole } from '@/lib/roles';

// Jediné místo, které chrání celou klientskou sekci portálu. Session je
// zdroj pravdy o tom, kdo je přihlášen a pod jakou firmu (companyId) patří
// - jednotlivé stránky pak vždy filtrují data podle session.user.companyId,
// nikdy podle čehokoliv poslaného z prohlížeče.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-paper">
      <Topbar
        userLabel={session.user.name || session.user.email}
        isAdmin={session.user.role === 'ADMIN'}
        isInternal={isInternalRole(session.user.role)}
      />
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8 sm:py-12">{children}</div>
    </div>
  );
}
