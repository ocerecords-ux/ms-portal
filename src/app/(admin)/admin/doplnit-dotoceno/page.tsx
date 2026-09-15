import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DoplnitPanel, type ProjektKDoplneni } from './DoplnitPanel';
import { bezTitulu } from '@/lib/jmena';

/**
 * Doplnění „Dotočeno" zpětně (zadání 13. 9. 2026: „ve chvíli, kdy jsme
 * přenesli projekty v Caflou, jsme neměli dodělané tlačítko Dotočeno
 * s hercem").
 *
 * Stránka schválně NENÍ v menu - stejně jako přenos projektů z Caflou je to
 * jednorázové srovnání historie, ne něco, co má někdo denně po ruce.
 *
 * Vypisují se jen projekty, kde nějakému herci fajfka chybí: kde je všechno
 * zaškrtané, není co doplňovat a jen by to prodlužovalo seznam.
 */
export const dynamic = 'force-dynamic';

export default async function DoplnitDotocenoPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const projekty = await prisma.projectMeta.findMany({
    where: { herci: { some: {} } },
    select: {
      caflouProjectId: true,
      name: true,
      statusName: true,
      companyName: true,
      company: { select: { name: true } },
      herci: { select: { id: true, name: true, email: true } },
    },
    orderBy: { name: 'asc' },
  });

  // Kdo uz fajfku ma - jednim dotazem pro celou stranku, ne dotazem na projekt.
  const dotoceni = await prisma.herecDotocen.findMany({
    where: { caflouProjectId: { in: projekty.map((p) => p.caflouProjectId) } },
    select: { caflouProjectId: true, userId: true },
  });
  const maFajfku = new Set(dotoceni.map((d) => `${d.caflouProjectId}:${d.userId}`));

  const data: ProjektKDoplneni[] = projekty
    .map((p) => ({
      caflouProjectId: p.caflouProjectId,
      nazev: p.name || `Projekt ${p.caflouProjectId}`,
      firma: p.company?.name ?? p.companyName ?? null,
      stav: p.statusName ?? '',
      herci: p.herci.map((h) => ({
        id: h.id,
        jmeno: bezTitulu(h.name) || h.email,
        dotoceno: maFajfku.has(`${p.caflouProjectId}:${h.id}`),
      })),
    }))
    .filter((p) => p.herci.some((h) => !h.dotoceno));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Zpět do administrace
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Doplnit dotočeno zpětně</h1>
        <p className="text-sm font-body text-muted m-0 max-w-[70ch]">
          Pro projekty přenesené z Caflou, u kterých se dotočilo dřív, než tlačítko „Dotočeno"
          vzniklo. Zaškrtnutí uloží fajfku a u projektu v „Natáčíme" nebo „Natáčíme/stříháme"
          překlopí stav na „Dotočeno" / „Dotočeno&nbsp;/&nbsp;stříháme" — <strong>bez jediné
          odeslané zprávy</strong>, ani Heleně, ani klientovi. Do historie projektu se zápis
          udělá.
        </p>
      </div>
      <DoplnitPanel projekty={data} />
    </div>
  );
}
