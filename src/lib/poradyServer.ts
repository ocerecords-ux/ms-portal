import { prisma } from '@/lib/db';
import { vyskytyPorady, type DruhPorady, type Opakovani, type PoradaVKalendari } from '@/lib/porady';

/**
 * Porady a schůzky, na které je přihlášený pozvaný, rozepsané na výskyty
 * (zadání 21. 9. 2026). Cizí porady se sem nedostanou - hledá se podle
 * účastníka, ne podle role. Ani správce kalendáře nevidí poradu, na kterou
 * není pozvaný („vidíme to pak jen my").
 */
export async function nactiPorady(
  userId: string,
  od: Date,
  doKdy: Date,
): Promise<PoradaVKalendari[]> {
  try {
    /**
     * JEN ÚČASTNÍCI - U SCHŮZEK TAKÉ (zadání 8. 10. 2026: „lidi vidí
     * události v kalendáři, schůzky, když nejsou jejich účastníci. Navíc je
     * to upozorňuje").
     *
     * Od 23. 9. do 8. 10. 2026 viděla produkce a admini KAŽDOU schůzku, i tu,
     * na kterou nebyli pozvaní - a protože odsud čte i ranní přehled a
     * připomínka 15 minut předem, chodila jim upozornění na cizí schůzky.
     * Teď platí jedno pravidlo pro porady i schůzky: KDO NENÍ ÚČASTNÍK,
     * NEVIDÍ NIC. Kdo má cizí schůzku vidět, patří mezi její účastníky.
     */
    const komu = [{ ucastnici: { some: { userId } } }];

    const porady = await prisma.porada.findMany({
      where: {
        start: { lt: doKdy },
        AND: [
          { OR: komu },
          {
            // Neopakovaná musí do rozsahu zasahovat; opakovaná smí začít dávno,
            // stačí, že neskončila před ním.
            OR: [
              { opakovani: 'NE', end: { gt: od } },
              {
                opakovani: { not: 'NE' },
                OR: [
                  { opakovatDo: null },
                  { opakovatDo: { gte: new Date(od.getTime() - 24 * 3600 * 1000) } },
                ],
              },
            ],
          },
        ],
      },
      include: { ucastnici: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { start: 'asc' },
    });

    const vysledek: PoradaVKalendari[] = [];
    for (const p of porady) {
      const opakovatDo = p.opakovatDo ? p.opakovatDo.toISOString().slice(0, 10) : null;
      const ucastnici = p.ucastnici
        .map((u) => ({ id: u.user.id, label: u.user.name || u.user.email }))
        .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
      for (const v of vyskytyPorady(
        { start: p.start, end: p.end, opakovani: p.opakovani as Opakovani, opakovatDo, vynechano: p.vynechano },
        od,
        doKdy,
      )) {
        vysledek.push({
          id: `${p.id}:${v.den}`,
          poradaId: p.id,
          druh: (p.druh as DruhPorady) ?? 'PORADA',
          den: v.den,
          nazev: p.nazev,
          start: v.start.toISOString(),
          end: v.end.toISOString(),
          opakovani: p.opakovani as Opakovani,
          opakovatDo,
          odkazVideo: p.odkazVideo,
          poznamka: p.poznamka,
          ucastnici,
          zalozil: p.zalozilId,
          upraveno: p.updatedAt.toISOString(),
        });
      }
    }
    return vysledek;
  } catch (err) {
    // Tabulka Porada ještě nemusí existovat (nedoběhl db push) - kalendář
    // se kvůli tomu nesmí rozbít.
    console.error('Nacteni porad selhalo:', err);
    return [];
  }
}
