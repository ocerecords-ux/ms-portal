import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiBacklog } from '@/lib/backlogServer';
import { BacklogKlient } from '../../backlog/BacklogKlient';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';

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
  const jazyk = nactiJazyk();

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'backlog.uvod')}</p>
      <BacklogKlient zaznamy={zaznamy} />
    </div>
  );
}
