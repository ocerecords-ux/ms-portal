import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiPribehy, smiPoslatPribeh, smiSchvalovatPribehy } from '@/lib/pribehyServer';
import { FrontaPribehu } from './FrontaPribehu';

/**
 * PŘÍBĚHY NA INSTAGRAM (zadání 6. 10. 2026: „můžeme dát zvukařům přístup,
 * aby mohli posílat na instagram příběhy, aniž by měli přístup na
 * instagram?").
 *
 * Jedna obrazovka pro obě role. Kdo smí posílat, vidí nahoře formulář a pod
 * ním svoje příběhy; kdo smí schvalovat, vidí celou frontu a tlačítka. Kdo
 * smí obojí (Ondřej), má obojí. Dvě stránky by znamenaly dvakrát stejný
 * seznam a první rozejití by nikdo nepoznal.
 */
export const dynamic = 'force-dynamic';

export default async function PribehyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const kdo = { id: session.user.id, role: session.user.role };
  const [smiPoslat, smiSchvalit] = await Promise.all([
    smiPoslatPribeh(kdo),
    smiSchvalovatPribehy(kdo),
  ]);
  if (!smiPoslat && !smiSchvalit) redirect('/projekty');

  return (
    <FrontaPribehu
      pribehy={await nactiPribehy(kdo)}
      smiPoslat={smiPoslat}
      smiSchvalit={smiSchvalit}
      jaId={session.user.id}
    />
  );
}
