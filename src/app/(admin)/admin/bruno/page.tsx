import { prisma } from '@/lib/db';
import { nactiPrirukuProUpravy } from '@/lib/brunoPrirucka';
import { nactiJazyk } from '@/lib/jazykServer';
import { kodJazyka, prelozit, prelozitS } from '@/lib/jazyk';
import { PrirukaForm } from './PrirukaForm';

/**
 * BRUNO — co ví o naší práci (zadání 16. 9. 2026: „nedokázali bychom Bruna
 * naučit vnímat i naši workflow? Aby se učil třeba z chatu a znal, jak
 * funguje portál a naše procesy?").
 *
 * Jsou tu vedle sebe DVĚ RŮZNÉ VĚCI a schválně se nemíchají:
 *
 * PŘÍRUČKA je to, co mu řekneme my. Píše se tady, Bruno ji jen čte a platí
 * mu víc než cokoliv, co si přečte v chatu. Patří sem pravidla, na kterých
 * jsme se domluvili.
 *
 * PAMĚŤ je to, co si všiml sám — zvyklosti lidí a projektů, které si po
 * rozhodnutích ukládá. Tady je jen ke čtení, aby bylo vidět, proč se chová,
 * jak se chová.
 */
export const dynamic = 'force-dynamic';

export default async function BrunoPage() {
  const jazyk = nactiJazyk();
  const [prirucka, poznamky] = await Promise.all([
    nactiPrirukuProUpravy(),
    prisma.brunoPamet
      .findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { id: true, poznamka: true, caflouProjectId: true, createdAt: true },
      })
      .catch(() => []),
  ]);

  // Nazvy projektu k poznamkam - at u nich nestoji holé číslo projektu.
  const idProjektu = Array.from(
    new Set(poznamky.map((p) => p.caflouProjectId).filter((id): id is string => Boolean(id))),
  );
  const nazvy = idProjektu.length
    ? await prisma.projectMeta
        .findMany({
          where: { caflouProjectId: { in: idProjektu } },
          select: { caflouProjectId: true, name: true },
        })
        .catch(() => [])
    : [];
  const nazevProjektu = new Map(nazvy.map((p) => [p.caflouProjectId, p.name]));

  return (
    <section className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="hidden sm:block font-display text-3xl text-ink m-0">
          {prelozit(jazyk, 'brunoAdmin.nadpis')}
        </h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          {prelozit(jazyk, 'brunoAdmin.uvod')}
        </p>
      </div>

      <PrirukaForm
        pocatecni={prirucka.text}
        vychozi={prirucka.vychozi}
        ulozilKdo={prirucka.ulozilKdo}
        ulozenoKdy={prirucka.ulozenoKdy}
      />

      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-heading font-semibold text-ink m-0">
            {prelozit(jazyk, 'brunoAdmin.pametNadpis')}
          </h2>
          <p className="text-sm font-body text-muted m-0 mt-1">
            {prelozit(jazyk, 'brunoAdmin.pametUvod')}
          </p>
        </div>

        {poznamky.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">
            {prelozit(jazyk, 'brunoAdmin.pametPrazdno')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 m-0 p-0 list-none">
            {poznamky.map((p) => (
              <li key={p.id} className="text-sm font-body text-ink border-b border-line pb-2 last:border-0">
                {p.poznamka}
                <span className="block text-xs text-muted mt-0.5">
                  {p.caflouProjectId
                    ? prelozitS(jazyk, 'brunoAdmin.projektPred', {
                        nazev:
                          nazevProjektu.get(p.caflouProjectId) ||
                          prelozitS(jazyk, 'brunoAdmin.zalohaProjektu', { id: p.caflouProjectId }),
                      })
                    : prelozit(jazyk, 'brunoAdmin.platiVsude')}
                  {p.createdAt.toLocaleDateString(kodJazyka(jazyk), { timeZone: 'Europe/Prague' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
