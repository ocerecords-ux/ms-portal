import { prisma } from '@/lib/db';
import { nactiPrirukuProUpravy } from '@/lib/brunoPrirucka';
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
        <h1 className="font-display text-3xl text-ink m-0">Bruno</h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Co Bruno ví o naší práci, než se rozhodne, jestli něco zapíše.
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
          <h2 className="font-heading font-semibold text-ink m-0">Co si Bruno všiml sám</h2>
          <p className="text-sm font-body text-muted m-0 mt-1">
            Zvyklosti, které si po rozhodnutích uložil z chatu. Tohle nepíšeme my — je to jeho
            poznámkový blok a je tu jen ke čtení. Když je v něm něco špatně, napište pravidlo do
            příručky výš; ta má přednost.
          </p>
        </div>

        {poznamky.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">Zatím si nic nepoznamenal.</p>
        ) : (
          <ul className="flex flex-col gap-2 m-0 p-0 list-none">
            {poznamky.map((p) => (
              <li key={p.id} className="text-sm font-body text-ink border-b border-line pb-2 last:border-0">
                {p.poznamka}
                <span className="block text-xs text-muted mt-0.5">
                  {p.caflouProjectId
                    ? `${nazevProjektu.get(p.caflouProjectId) || `projekt ${p.caflouProjectId}`} · `
                    : 'platí všude · '}
                  {p.createdAt.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
