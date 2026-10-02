import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NovaZadostForm } from './NovaZadostForm';
import { nactiJazyk } from '@/lib/jazykServer';
import { formatDatum, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * ŽÁDOSTI O ÚDAJE (zadání 16. 9. 2026: „posílat odkaz, na kterém bude
 * formulář, kde vyplní své údaje… a když ho vyplní, tak se nám to automaticky
 * propíše do systému a zahlásí Karolíně").
 *
 * Přehled je řazený tak, jak se s ním pracuje: nahoře to, co čeká na
 * odkliknutí, pak rozeslané a nevyplněné, a nakonec hotové.
 */
export const dynamic = 'force-dynamic';

const POPIS_STAVU: Record<string, { klic: string; barva: string }> = {
  VYPLNENA: { klic: 'zadost.stavVyplnena', barva: 'text-brand-purple border-brand-purple' },
  CEKA: { klic: 'zadost.stavCeka', barva: 'text-muted border-line' },
  HOTOVA: { klic: 'zadost.stavHotova', barva: 'text-brand-greenDeep border-brand-green' },
  ZRUSENA: { klic: 'zadost.stavZrusena', barva: 'text-muted border-line' },
};

/** Pořadí, ve kterém to má člověk před očima. */
const PORADI: Record<string, number> = { VYPLNENA: 0, CEKA: 1, HOTOVA: 2, ZRUSENA: 3 };

export default async function UdajePage() {
  const jazyk: Jazyk = nactiJazyk();
  const [zadosti, herci, firmy, prijemci] = await Promise.all([
    prisma.pozvankaUdaju
      .findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          user: { select: { name: true, email: true } },
          company: { select: { name: true } },
          vytvoril: { select: { name: true } },
        },
      })
      .catch(() => []),
    prisma.user.findMany({
      where: { role: 'HEREC', active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    }),
    prisma.company.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { dostavaVyplneneUdaje: true, active: true },
      select: { name: true, email: true },
    }),
  ]);

  const serazene = [...zadosti].sort(
    (a, b) => (PORADI[a.stav] ?? 9) - (PORADI[b.stav] ?? 9) || b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <section className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="hidden sm:block font-display text-3xl text-ink m-0">{prelozit(jazyk, 'zadost.nadpis')}</h1>
        <p className="text-sm font-body text-muted m-0 mt-1">{prelozit(jazyk, 'zadost.uvod')}</p>
      </div>

      <NovaZadostForm herci={herci} firmy={firmy} />

      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-heading font-semibold text-ink m-0">{prelozit(jazyk, 'zadost.rozeslane')}</h2>
          <p className="text-xs font-body text-muted m-0 mt-1">
            {prijemci.length === 0
              ? prelozit(jazyk, 'zadost.nikomuNechodi')
              : prelozitS(jazyk, 'zadost.udajeChodi', {
                  kdo: prijemci.map((p) => p.name || p.email).join(', '),
                })}
          </p>
        </div>

        {serazene.length === 0 ? (
          <p className="text-sm font-body text-muted m-0 px-5 py-6">{prelozit(jazyk, 'zadost.zadnaZadost')}</p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {serazene.map((z) => {
              const stav = POPIS_STAVU[z.stav] ?? POPIS_STAVU.CEKA;
              const kdo = z.user?.name || z.company?.name || z.jmeno || prelozit(jazyk, 'zadost.bezJmena');
              return (
                <li key={z.id} className="border-b border-line last:border-0">
                  <Link
                    href={`/admin/udaje/${z.id}`}
                    className="flex items-center gap-3 px-5 py-3 no-underline hover:bg-field flex-wrap"
                  >
                    <span className="text-xs font-heading uppercase tracking-wide text-muted w-14 shrink-0">
                      {prelozit(jazyk, z.druh === 'HEREC' ? 'zadost.druhHerec' : 'zadost.druhFirma')}
                    </span>
                    <span className="font-heading font-semibold text-ink flex-1 min-w-[160px]">{kdo}</span>
                    <span className={`text-xs font-heading rounded-pill border px-2.5 py-1 ${stav.barva}`}>
                      {prelozit(jazyk, stav.klic)}
                    </span>
                    <span className="text-xs font-body text-muted w-28 text-right">
                      {formatDatum(jazyk, z.vyplnenoAt ?? z.odeslanoAt ?? z.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
