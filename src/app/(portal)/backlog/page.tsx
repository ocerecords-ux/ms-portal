import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiBacklog } from '@/lib/backlogServer';
import { BacklogKlient } from './BacklogKlient';

/**
 * BACKLOG (zadání 18. 9. 2026): podařilo se nám projekt odevzdat v termínu,
 * nebo po termínu - a o kolik dní.
 *
 * Vidí ho Žůžo-labůžo a Produkce: jsou to lidé, kteří termíny plánují a mění.
 * Zvukař ani klient tenhle pohled nepotřebuje a ani by mu nebyl příjemný.
 */
export const dynamic = 'force-dynamic';

export default async function BacklogPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'ADMIN' && role !== 'PRODUKCE')) redirect('/projekty');

  const zaznamy = await nactiBacklog();

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Backlog</h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Kdy měl být projekt hotový a kdy se opravdu odevzdal. Za odevzdání se bere okamžik, kdy
          projekt poprvé přešel do stavu „Dokončeno - ke schválení". Kladné číslo jsou dny k dobru,
          záporné dny skluzu — stejně jako u data v přehledu projektů.
        </p>
      </div>

      <BacklogKlient zaznamy={zaznamy} />
    </main>
  );
}
