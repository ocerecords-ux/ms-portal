import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nactiZapnuti } from '@/lib/oznameniServer';
import { minulyMesic, nazevMesice } from '@/lib/mesicniPrehledServer';
import { ZpravyPanel, type Odeslany } from './ZpravyPanel';

/**
 * Zprávy, které portál posílá NÁM (zadání 15. 9. 2026: „udělejme pro tyhle
 * maily a notifikace pak někde administraci").
 *
 * Zprávy klientovi mají vlastní obrazovku (Vzory zpráv) - tahle je o mailech
 * zvukařům: bonus a měsíční přehled.
 */
export const dynamic = 'force-dynamic';

export default async function ZpravyPortaluPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const [zapnuti, odeslaneRaw] = await Promise.all([
    nactiZapnuti(),
    prisma.mesicniPrehledOdeslan
      .findMany({ orderBy: { odeslanoAt: 'desc' }, take: 40 })
      .catch(() => []),
  ]);

  // Jmena se dotahuji zvlast - model si drzi jen ID, aby zustal citelny
  // i po smazani uctu.
  const uzivatele = odeslaneRaw.length
    ? await prisma.user.findMany({
        where: { id: { in: odeslaneRaw.map((o) => o.userId) } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const jmena = new Map(uzivatele.map((u) => [u.id, u.name || u.email]));

  const odeslane: Odeslany[] = odeslaneRaw.map((o) => ({
    mesic: nazevMesice(o.mesic),
    komu: jmena.get(o.userId) ?? 'Smazaný účet',
    prijemce: o.prijemce,
    kdy: new Intl.DateTimeFormat('cs-CZ').format(o.odeslanoAt),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Zpět do administrace
      </Link>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Zprávy portálu</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[80ch]">
          Maily a oznámení, která portál posílá nám — zvukařům o bonusu a o měsíčním přehledu výkazů.
          Zprávy klientovi se píšou jinde, ve Vzorech zpráv.
        </p>
      </div>
      <ZpravyPanel zapnuti={zapnuti} odeslane={odeslane} minulyMesic={minulyMesic()} />
    </div>
  );
}
