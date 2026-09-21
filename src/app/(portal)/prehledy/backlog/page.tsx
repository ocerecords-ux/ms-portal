import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiBacklog } from '@/lib/backlogServer';
import { BacklogKlient } from '../../backlog/BacklogKlient';

/**
 * BACKLOG (zadání 18. 9. 2026): podařilo se nám projekt odevzdat v termínu,
 * nebo po termínu - a o kolik dní. Od 21. 9. 2026 („backlog dejme do
 * Přehledů") je to záložka Přehledů, ne samostatná položka lišty; stará
 * adresa /backlog sem přesměrovává.
 *
 * Vidí ho Žůžo-labůžo a Produkce: jsou to lidé, kteří termíny plánují a mění.
 */
export const dynamic = 'force-dynamic';

export default async function BacklogPrehledPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'ADMIN' && role !== 'PRODUKCE')) redirect('/projekty');

  const zaznamy = await nactiBacklog();

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-body text-muted m-0">
        Kdy měl být projekt hotový a kdy se opravdu odevzdal. Za odevzdání se bere okamžik, kdy projekt
        poprvé přešel do stavu „Dokončeno - ke schválení". Kladné číslo jsou dny k dobru, záporné dny
        skluzu — stejně jako u data v přehledu projektů.
      </p>
      <BacklogKlient zaznamy={zaznamy} />
    </div>
  );
}
