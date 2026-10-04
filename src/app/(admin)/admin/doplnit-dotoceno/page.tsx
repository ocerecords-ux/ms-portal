import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DoplnitPanel, type ProjektKDoplneni } from './DoplnitPanel';
import { bezTitulu } from '@/lib/jmena';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitS } from '@/lib/jazyk';

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
  const jazyk = nactiJazyk();

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
      nazev: p.name || prelozitS(jazyk, 'doplnit.zalohaNazvu', { id: p.caflouProjectId }),
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
        {prelozit(jazyk, 'doplnit.zpet')}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">
          {prelozit(jazyk, 'doplnit.nadpis')}
        </h1>
        <p className="text-sm font-body text-muted m-0 max-w-[70ch]">
          {prelozit(jazyk, 'doplnit.uvodPred')}
          <strong>{prelozit(jazyk, 'doplnit.uvodTucne')}</strong>
          {prelozit(jazyk, 'doplnit.uvodZa')}
        </p>
      </div>
      <DoplnitPanel projekty={data} />
    </div>
  );
}
